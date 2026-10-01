"""
app/services/propagation_engine.py

Delay propagation and automated operations alert generation for RailDrishti AI.

Requirements:
- Leading train delayed in a section -> identify trailing trains in same direction.
- If headway is low (< 40 km) and section occupancy is elevated, add secondary delay risk.
- Include propagation reason in affected train explanations.
- Generate control-room alerts for:
  - ETA_CHANGED
  - SIGNAL_HALT
  - HIGH_CONGESTION
  - PROPAGATION_RISK
  - GPS_STALE
  - PLATFORM_PREPARATION
"""

import time
import asyncio
from datetime import datetime, timezone
from typing import Dict, Any, List, Optional, Tuple

from app.services.corridor_data import (
    SECTIONS, SECTION_KEYS_ORDER, TRAINS, STATIONS
)
from app.services.alert_store import alert_store
from app.services.websocket import ws_manager


class PropagationEngine:
    def __init__(self):
        # Map of train_id -> latest propagation impact dict
        self._propagation_map: Dict[str, Dict[str, Any]] = {}
        # Cooldown map: alert_key -> timestamp of last generation (avoid duplicate spam)
        self._alert_cooldowns: Dict[str, float] = {}
        # Previous predicted delay per train for ETA_CHANGED detection
        self._previous_delays: Dict[str, int] = {}
        self._lock = asyncio.Lock()

    def get_propagation_for_train(self, train_id: str) -> Optional[Dict[str, Any]]:
        return self._propagation_map.get(train_id)

    async def evaluate_propagation_and_alerts(
        self,
        all_train_states: List[Dict[str, Any]],
        congestion_records: List[Dict[str, Any]],
        eta_results: Optional[Dict[str, Dict[str, Any]]] = None,
    ) -> List[Dict[str, Any]]:
        """
        Analyze all trains and sections for delay propagation and generate
        control-room alerts across all 6 categories.
        """
        now = datetime.now(timezone.utc)
        now_ts = time.time()
        new_alerts: List[Dict[str, Any]] = []

        # Build quick lookup of trains per section
        trains_by_section: Dict[str, List[Dict[str, Any]]] = {k: [] for k in SECTION_KEYS_ORDER}
        for st in all_train_states:
            sec = st.get("current_section")
            if sec and sec in trains_by_section:
                trains_by_section[sec].append(st)

        # Build congestion map lookup
        cong_by_sec = {c["section_id"]: c for c in congestion_records if "section_id" in c}

        new_propagation_map: Dict[str, Dict[str, Any]] = {}

        # -------------------------------------------------------------------
        # 1. Delay Propagation Detection
        # -------------------------------------------------------------------
        for sec_idx, sec_id in enumerate(SECTION_KEYS_ORDER):
            section = SECTIONS.get(sec_id)
            if not section:
                continue

            sec_trains = trains_by_section[sec_id]
            # If multiple trains in same section:
            # Sort by distance_to_next_station_km ascending (lower distance = closer to next station = leading)
            sec_trains_sorted = sorted(
                sec_trains,
                key=lambda t: float(t.get("distance_to_next_station_km", 0.0))
            )

            for i in range(len(sec_trains_sorted) - 1):
                leading = sec_trains_sorted[i]
                trailing = sec_trains_sorted[i + 1]

                leading_dist = float(leading.get("distance_to_next_station_km", 0.0))
                trailing_dist = float(trailing.get("distance_to_next_station_km", 0.0))
                headway_km = abs(trailing_dist - leading_dist)

                leading_delay = int(leading.get("delay_minutes", 0))
                leading_halted = leading.get("status") in ("SIGNAL_HALT", "UNSCHEDULED_HALT")

                if (leading_delay >= 8 or leading_halted) and headway_km < 40.0:
                    secondary_delay = min(8, max(3, int(leading_delay * 0.4)))
                    if leading_halted:
                        secondary_delay = max(secondary_delay, 5)

                    trailing_id = trailing.get("train_id")
                    leading_id = leading.get("train_id")
                    leading_name = leading.get("train_name", leading_id)

                    prop_info = {
                        "trailing_train_id": trailing_id,
                        "leading_train_id": leading_id,
                        "leading_train_name": leading_name,
                        "section_id": sec_id,
                        "headway_km": round(headway_km, 1),
                        "secondary_delay_min": secondary_delay,
                        "reason": (
                            f"Trailing train {trailing_id} is {headway_km:.1f} km behind delayed "
                            f"{leading_id} ({leading_name}) in {sec_id}; reduced headway introduces "
                            f"+{secondary_delay} min secondary delay risk."
                        ),
                    }
                    new_propagation_map[trailing_id] = prop_info

                    # Emit PROPAGATION_RISK alert
                    alert_key = f"PROP_{trailing_id}_{leading_id}_{sec_id}"
                    if self._can_emit(alert_key, now_ts, cooldown_sec=60):
                        alert_dict = {
                            "category": "PROPAGATION_RISK",
                            "alert_type": "PROPAGATION_RISK",
                            "severity": "HIGH",
                            "train_id": trailing_id,
                            "section_id": sec_id,
                            "title": f"Propagation Risk: Train {trailing_id}",
                            "message": prop_info["reason"],
                            "is_active": True,
                        }
                        new_alerts.append(alert_dict)

            # Cross-section propagation:
            # If train at beginning of sec_idx is trailing a delayed train at end of sec_idx + 1
            if sec_idx + 1 < len(SECTION_KEYS_ORDER):
                downstream_sec_id = SECTION_KEYS_ORDER[sec_idx + 1]
                downstream_trains = trains_by_section[downstream_sec_id]
                if downstream_trains and sec_trains:
                    downstream_leading = min(downstream_trains, key=lambda t: float(t.get("distance_to_next_station_km", 0.0)))
                    upstream_trailing = max(sec_trains, key=lambda t: float(t.get("distance_to_next_station_km", 0.0)))
                    
                    downstream_delay = int(downstream_leading.get("delay_minutes", 0))
                    downstream_halt = downstream_leading.get("status") in ("SIGNAL_HALT", "UNSCHEDULED_HALT")
                    upstream_trailing_dist = float(upstream_trailing.get("distance_to_next_station_km", 0.0))

                    if (downstream_delay >= 10 or downstream_halt) and upstream_trailing_dist < 20.0:
                        tr_id = upstream_trailing.get("train_id")
                        if tr_id not in new_propagation_map:
                            sec_delay = min(6, max(3, int(downstream_delay * 0.3)))
                            ld_id = downstream_leading.get("train_id")
                            ld_name = downstream_leading.get("train_name", ld_id)
                            prop_info = {
                                "trailing_train_id": tr_id,
                                "leading_train_id": ld_id,
                                "leading_train_name": ld_name,
                                "section_id": sec_id,
                                "headway_km": round(upstream_trailing_dist, 1),
                                "secondary_delay_min": sec_delay,
                                "reason": (
                                    f"Train {tr_id} approaching congested downstream section {downstream_sec_id} "
                                    f"behind delayed train {ld_id} ({ld_name}) (+{sec_delay} min risk)."
                                ),
                            }
                            new_propagation_map[tr_id] = prop_info

        self._propagation_map = new_propagation_map

        # -------------------------------------------------------------------
        # 2. HIGH_CONGESTION Alerts
        # -------------------------------------------------------------------
        for c in congestion_records:
            sec_id = c.get("section_id", "")
            score = float(c.get("score", 0.0))
            label = c.get("label", "LOW")
            if score >= 0.61 or label == "HIGH":
                alert_key = f"CONG_{sec_id}"
                if self._can_emit(alert_key, now_ts, cooldown_sec=90):
                    new_alerts.append({
                        "category": "HIGH_CONGESTION",
                        "alert_type": "HIGH_CONGESTION",
                        "severity": "HIGH",
                        "section_id": sec_id,
                        "title": f"High Congestion: Section {sec_id}",
                        "message": (
                            f"Section {sec_id} congestion index is {score:.2f} (HIGH). "
                            f"Trains in section: {c.get('trains_in_section', 0)}, "
                            f"restriction active: {c.get('restriction_active', False)}."
                        ),
                        "is_active": True,
                    })

        # -------------------------------------------------------------------
        # 3. Train-specific Alerts (SIGNAL_HALT, GPS_STALE, PLATFORM_PREPARATION, ETA_CHANGED)
        # -------------------------------------------------------------------
        for st in all_train_states:
            t_id = st.get("train_id")
            t_name = st.get("train_name", t_id)
            status = st.get("status")
            dist_next = float(st.get("distance_to_next_station_km", 0.0))
            next_st = st.get("next_station", "")
            curr_delay = int(st.get("delay_minutes", 0))

            # SIGNAL_HALT
            if status == "SIGNAL_HALT":
                alert_key = f"HALT_{t_id}_{next_st}"
                if self._can_emit(alert_key, now_ts, cooldown_sec=60):
                    new_alerts.append({
                        "category": "SIGNAL_HALT",
                        "alert_type": "SIGNAL_HALT",
                        "severity": "MEDIUM",
                        "train_id": t_id,
                        "station_code": next_st,
                        "title": f"Signal Halt: {t_id} {t_name}",
                        "message": f"Train {t_id} ({t_name}) stopped at red signal approaching {next_st}.",
                        "is_active": True,
                    })

            # GPS_STALE
            ts_str = st.get("timestamp", now.isoformat())
            try:
                ts_dt = datetime.fromisoformat(ts_str.replace("Z", "+00:00"))
                freshness_sec = max(0, (now - ts_dt).total_seconds())
            except Exception:
                freshness_sec = 0.0

            if freshness_sec > 120.0:
                alert_key = f"GPS_{t_id}"
                if self._can_emit(alert_key, now_ts, cooldown_sec=120):
                    new_alerts.append({
                        "category": "GPS_STALE",
                        "alert_type": "GPS_STALE",
                        "severity": "LOW",
                        "train_id": t_id,
                        "title": f"GPS Telemetry Stale: Train {t_id}",
                        "message": f"GPS fix for Train {t_id} is {freshness_sec:.0f}s old (> 120s threshold).",
                        "is_active": True,
                    })

            # PLATFORM_PREPARATION
            if status == "RUNNING" and 0.5 < dist_next <= 15.0 and next_st:
                alert_key = f"PLAT_{t_id}_{next_st}"
                if self._can_emit(alert_key, now_ts, cooldown_sec=180):
                    st_name = STATIONS[next_st].name if next_st in STATIONS else next_st
                    new_alerts.append({
                        "category": "PLATFORM_PREPARATION",
                        "alert_type": "PLATFORM_PREPARATION",
                        "severity": "INFO",
                        "train_id": t_id,
                        "station_code": next_st,
                        "title": f"Platform Preparation: {t_name} -> {next_st}",
                        "message": (
                            f"Train {t_id} ({t_name}) is {dist_next:.1f} km from {st_name} ({next_st}). "
                            "Ready platform line and passenger display boards."
                        ),
                        "is_active": True,
                    })

            # ETA_CHANGED
            if eta_results and t_id in eta_results:
                pred_delay = int(eta_results[t_id].get("predicted_delay", curr_delay))
                prev_delay = self._previous_delays.get(t_id, curr_delay)
                delay_delta = pred_delay - prev_delay
                if abs(delay_delta) >= 5:
                    alert_key = f"ETA_CHG_{t_id}_{pred_delay}"
                    if self._can_emit(alert_key, now_ts, cooldown_sec=90):
                        sign = "+" if delay_delta > 0 else "-"
                        new_alerts.append({
                            "category": "ETA_CHANGED",
                            "alert_type": "ETA_CHANGED",
                            "severity": "INFO",
                            "train_id": t_id,
                            "title": f"ETA Revised: Train {t_id} ({sign}{abs(delay_delta)} min)",
                            "message": (
                                f"Predicted delay for {t_name} adjusted to {pred_delay} min "
                                f"({sign}{abs(delay_delta)} min revision from previous estimate)."
                            ),
                            "is_active": True,
                        })
                self._previous_delays[t_id] = pred_delay

        # -------------------------------------------------------------------
        # 4. Push new alerts into store and broadcast
        # -------------------------------------------------------------------
        for alert in new_alerts:
            await alert_store.push(alert)

        if new_alerts:
            await ws_manager.broadcast({
                "type": "ALERT_NEW",
                "timestamp": now.isoformat(),
                "data": new_alerts,
            })

        return new_alerts

    def _can_emit(self, alert_key: str, now_ts: float, cooldown_sec: float) -> bool:
        last_time = self._alert_cooldowns.get(alert_key, 0.0)
        if now_ts - last_time >= cooldown_sec:
            self._alert_cooldowns[alert_key] = now_ts
            return True
        return False


# Global singleton
propagation_engine = PropagationEngine()
