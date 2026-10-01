"""
app/services/eta_engine.py

Rule-based Dynamic ETA Intelligence Layer for RailDrishti AI.

Formula & Architecture:
1. Effective Speed Model:
     effective_speed = base_speed
                     * traffic_multiplier
                     * weather_multiplier
                     * restriction_multiplier
                     * random_variation

2. Per upcoming station calculation:
   - Remaining distance / effective speed -> base travel time
   - Congestion delay contribution
   - Temporary speed restriction delay
   - Adverse weather speed reduction delay
   - Unscheduled halt / signal halt delay
   - Station dwell time
   - Timetable recovery margin (-delay)
   - Secondary delay propagation from leading trains

3. Probabilistic bounds (P10, P50, P90) derived from sectional historical run distributions.

4. Confidence logic:
   - HIGH:   (P90 - P10) <= 8 minutes  AND  GPS freshness <= 30s
   - MEDIUM: (P90 - P10) range 9–20 minutes (freshness <= 120s)
   - LOW:    (P90 - P10) > 20 minutes  OR   GPS stale > 120s

5. Delay trend:
   - IMPROVING: delay decreasing by >= 2 minutes downstream
   - WORSENING: delay increasing by >= 2 minutes downstream
   - STABLE:    within ±2 minutes
"""

import random
from datetime import datetime, timezone, timedelta
from typing import Dict, Any, List, Optional, Tuple

from app.services.corridor_data import (
    STATIONS, STATION_ORDER, SECTIONS, SECTION_KEYS_ORDER, TRAINS
)

# Station dwell times in minutes
_DWELL_MINUTES: Dict[str, int] = {
    "NDLS": 0, "MTJ": 2, "BTE": 2, "GGC": 2,
    "SWM": 2, "KOTA": 5, "RATL": 5, "BRC": 3, "MMCT": 0,
}

# Weather speed multipliers
_WEATHER_MULT = {
    "CLEAR": 1.00,
    "FOG": 0.78,
    "RAIN": 0.88,
    "STORM": 0.60
}

# Timetable recovery headroom fraction
_RECOVERY_FRACTION = 0.05


def _get_congestion_multiplier(congestion_score: float) -> float:
    """Map a 0-1 congestion score to a speed multiplier (0.70 – 1.00)."""
    return round(1.0 - 0.30 * congestion_score, 4)


def _stable_jitter(train_id: str, section_id: str) -> float:
    """
    Deterministic ±2% variation so live presentations remain stable
    without flickering between updates.
    """
    seed = hash(f"{train_id}_{section_id}") % 1000
    r = random.Random(seed)
    return 1.0 + r.uniform(-0.02, 0.02)


def compute_eta(
    train_id: str,
    live_state: Dict[str, Any],
    congestion_map: Dict[str, Dict[str, Any]],
    propagation_info: Optional[Dict[str, Any]] = None,
    now: Optional[datetime] = None,
) -> Dict[str, Any]:
    """
    Compute comprehensive ETA projection for a train across all upcoming stations.
    """
    if now is None:
        now = datetime.now(timezone.utc)

    train_meta = TRAINS.get(train_id)
    if not train_meta:
        return {}

    status = live_state.get("status", "RUNNING")
    current_section_id = live_state.get("current_section")
    next_station_code = live_state.get("next_station")
    dist_to_next = float(live_state.get("distance_to_next_station_km", 0.0))
    current_speed = float(live_state.get("speed_kmph", 80.0))
    current_delay = int(live_state.get("delay_minutes", 0))

    # GPS freshness check
    ts_str = live_state.get("timestamp", now.isoformat())
    try:
        ts_dt = datetime.fromisoformat(ts_str.replace("Z", "+00:00"))
        freshness_sec = max(0.0, (now - ts_dt).total_seconds())
    except Exception:
        freshness_sec = 0.0

    # Determine starting station index in corridor sequence
    if next_station_code and next_station_code in STATION_ORDER:
        start_idx = STATION_ORDER.index(next_station_code)
    else:
        start_idx = len(STATION_ORDER)  # Completed journey

    running_time = now
    accumulated_delay = current_delay
    all_factors: List[Dict[str, Any]] = []

    # Current status halt delay impact
    if status == "SIGNAL_HALT":
        halt_delay_min = 4
        accumulated_delay += halt_delay_min
        all_factors.append({
            "factor": "signal_halt",
            "label": "Signal halt",
            "delta_min": halt_delay_min,
            "description": f"Train is currently halted at a red signal near {next_station_code} (+{halt_delay_min} min).",
        })
    elif status == "UNSCHEDULED_HALT":
        halt_delay_min = 6
        accumulated_delay += halt_delay_min
        all_factors.append({
            "factor": "unscheduled_halt",
            "label": "Unscheduled halt",
            "delta_min": halt_delay_min,
            "description": f"Train has made an unscheduled halt on the track (+{halt_delay_min} min).",
        })
    elif status == "AT_STATION":
        dwell_overrun = 1
        accumulated_delay += dwell_overrun
        all_factors.append({
            "factor": "station_dwell_overrun",
            "label": "Station dwell overrun",
            "delta_min": dwell_overrun,
            "description": f"Extended station dwell buffer (+{dwell_overrun} min).",
        })

    # Add secondary delay propagation if applicable
    if propagation_info:
        sec_delay = int(propagation_info.get("secondary_delay_min", 0))
        if sec_delay > 0:
            accumulated_delay += sec_delay
            all_factors.append({
                "factor": "delay_propagation",
                "label": "Downstream delay propagation",
                "delta_min": sec_delay,
                "description": propagation_info.get("reason", f"Secondary headway risk (+{sec_delay} min)."),
            })

    # Low current speed factor
    if current_speed < 45.0 and status == "RUNNING":
        low_speed_delta = round((70.0 - current_speed) / 70.0 * 3.0, 1)
        accumulated_delay += round(low_speed_delta)
        all_factors.append({
            "factor": "low_current_speed",
            "label": "Low current speed",
            "delta_min": low_speed_delta,
            "description": f"Train running at {current_speed:.0f} km/h, below section speed norm (+{low_speed_delta:.1f} min).",
        })

    upcoming_stations_eta: List[Dict[str, Any]] = []

    for idx in range(start_idx, len(STATION_ORDER)):
        st_code = STATION_ORDER[idx]
        st = STATIONS[st_code]
        dwell = _DWELL_MINUTES.get(st_code, 2)

        if idx == start_idx:
            remaining_km = dist_to_next
            sec_id = current_section_id
            if not sec_id:
                sec_id = f"SEC_{STATION_ORDER[idx-1]}_{st_code}" if idx > 0 else SECTION_KEYS_ORDER[0]
        else:
            prev_code = STATION_ORDER[idx - 1]
            sec_id = f"SEC_{prev_code}_{st_code}"
            remaining_km = SECTIONS[sec_id].distance_km if sec_id in SECTIONS else 0.0

        sec = SECTIONS.get(sec_id) if sec_id else None
        base_speed = sec.normal_speed_kmph if sec else 100.0

        # Category/Priority speed scaling
        priority_factor = 1.0 - (train_meta.priority - 1) * 0.04

        # Congestion factor
        cong_record = congestion_map.get(sec_id, {})
        cong_score = float(cong_record.get("score", 0.20))
        traffic_mult = _get_congestion_multiplier(cong_score)

        # Weather factor
        weather = cong_record.get("weather_condition", "CLEAR")
        weather_mult = _WEATHER_MULT.get(weather, 1.0)

        # Restriction factor
        restriction_active = cong_record.get("restriction_active", False)
        restriction_mult = 0.70 if restriction_active else 1.0

        # Safe effective speed formula
        jitter = _stable_jitter(train_id, sec_id or "")
        effective_speed = max(35.0, (
            base_speed * traffic_mult * weather_mult * restriction_mult * jitter * priority_factor
        ))

        # Travel time in minutes
        if effective_speed > 0 and remaining_km > 0:
            travel_min = (remaining_km / effective_speed) * 60.0
        else:
            travel_min = 0.0

        # Section-level historical spread
        if sec:
            hist_med = sec.historical_median_time_min
            hist_p90 = sec.historical_p90_time_min
            base_spread = max(1.5, hist_p90 - hist_med)
            frac = (remaining_km / sec.distance_km) if (idx == start_idx and sec.distance_km > 0) else 1.0
            spread = base_spread * frac
        else:
            spread = 3.0

        # Timetable recovery margin (negative delta)
        scheduled_travel = (sec.historical_median_time_min * frac) if sec else travel_min
        recovery_min = -(scheduled_travel * _RECOVERY_FRACTION)

        # Per-section delay additions
        cong_delay = round(cong_score * 5.0, 1) if cong_score > 0.30 else 0.0
        weather_delay = round((1.0 - weather_mult) * travel_min * 0.4, 1) if weather != "CLEAR" else 0.0
        restriction_delay = round((1.0 - restriction_mult) * travel_min * 0.5, 1) if restriction_active else 0.0

        section_extra_delay = cong_delay + weather_delay + restriction_delay + recovery_min
        accumulated_delay = max(0, accumulated_delay + round(section_extra_delay))
        running_time = running_time + timedelta(minutes=travel_min + dwell)

        # P10, P50, P90 ETA calculation
        p50 = running_time + timedelta(minutes=accumulated_delay)
        p10 = p50 - timedelta(minutes=spread * 0.5)
        p90 = p50 + timedelta(minutes=spread * 1.0)

        # Scheduled arrival
        sched_arrival_time = now + timedelta(minutes=travel_min * (idx - start_idx + 1))
        sched_arrival_str = sched_arrival_time.strftime("%H:%M IST")

        # Confidence logic per requirement:
        # High: range <= 8 min and freshness <= 30s
        # Medium: range 9-20 min
        # Low: range > 20 min or freshness > 120s
        p90_p10_range = (p90 - p10).total_seconds() / 60.0
        if freshness_sec > 120.0 or p90_p10_range > 20.0:
            confidence = "LOW"
        elif p90_p10_range <= 8.0 and freshness_sec <= 30.0:
            confidence = "HIGH"
        else:
            confidence = "MEDIUM"

        # Delay trend
        if accumulated_delay < current_delay - 2:
            trend = "IMPROVING"
        elif accumulated_delay > current_delay + 2:
            trend = "WORSENING"
        else:
            trend = "STABLE"

        # Recovery probability
        recovery_prob = max(0.0, min(1.0, 1.0 - accumulated_delay / 35.0))

        # Collect section factors
        sec_factors: List[Dict[str, Any]] = []
        if cong_delay > 0:
            cong_label = cong_record.get("label", "MODERATE")
            sec_factors.append({
                "factor": "downstream_congestion",
                "label": f"{cong_label.capitalize()} downstream congestion",
                "delta_min": cong_delay,
                "description": f"{cong_label.capitalize()} congestion on section to {st.name} (+{cong_delay:.0f} min).",
            })
        if weather_delay > 0:
            sec_factors.append({
                "factor": "weather_speed_reduction",
                "label": f"{weather.capitalize()} weather reduction",
                "delta_min": weather_delay,
                "description": f"{weather.capitalize()} conditions reducing line speed (+{weather_delay:.1f} min).",
            })
        if restriction_delay > 0:
            sec_factors.append({
                "factor": "temporary_speed_restriction",
                "label": "Temporary speed restriction",
                "delta_min": restriction_delay,
                "description": f"Track maintenance speed restriction active on {sec_id} (+{restriction_delay:.1f} min).",
            })
        if recovery_min < -0.5:
            sec_factors.append({
                "factor": "timetable_recovery_margin",
                "label": "Timetable recovery margin",
                "delta_min": round(recovery_min, 1),
                "description": f"Timetable slack buffer provides {abs(round(recovery_min,1)):.1f} min recovery.",
            })

        all_factors.extend(sec_factors)

        station_record = {
            "station_code": st.code,
            "station_name": st.name,
            "sequence": st.sequence,
            "distance_remaining_km": round(remaining_km if idx == start_idx else (SECTIONS.get(sec_id).distance_km if sec else 0.0), 1),
            "scheduled_arrival": sched_arrival_str,
            "predicted_p10_eta": p10.strftime("%H:%M IST"),
            "predicted_p50_eta": p50.strftime("%H:%M IST"),
            "predicted_p90_eta": p90.strftime("%H:%M IST"),
            "predicted_delay": accumulated_delay,
            "predicted_delay_minutes": accumulated_delay,
            "confidence_label": confidence,
            "confidence": confidence,
            "delay_trend": trend,
            "recovery_probability": round(recovery_prob, 2),
            "top_eta_factors": sec_factors[:3],
            "top_factors": sec_factors[:3],
            "effective_speed_kmph": round(effective_speed, 1),
        }
        upcoming_stations_eta.append(station_record)

    # Deduplicate all factors across route, keeping highest impact per factor type
    factor_map: Dict[str, Dict[str, Any]] = {}
    for f in all_factors:
        k = f["factor"]
        if k not in factor_map or abs(f["delta_min"]) > abs(factor_map[k]["delta_min"]):
            factor_map[k] = f
    top_eta_factors = sorted(factor_map.values(), key=lambda x: abs(x["delta_min"]), reverse=True)[:5]

    # Destination / summary values
    if upcoming_stations_eta:
        final_st = upcoming_stations_eta[-1]
        sched_arrival = final_st["scheduled_arrival"]
        p10_str = final_st["predicted_p10_eta"]
        p50_str = final_st["predicted_p50_eta"]
        p90_str = final_st["predicted_p90_eta"]
        pred_delay = final_st["predicted_delay"]
        confidence_label = upcoming_stations_eta[0]["confidence_label"]
        recovery_prob = final_st["recovery_probability"]
        delay_trend = final_st["delay_trend"]
    else:
        sched_arrival = now.strftime("%H:%M IST")
        p10_str = now.strftime("%H:%M IST")
        p50_str = now.strftime("%H:%M IST")
        p90_str = now.strftime("%H:%M IST")
        pred_delay = current_delay
        confidence_label = "HIGH"
        recovery_prob = 1.0
        delay_trend = "STABLE"

    return {
        "train_id": train_id,
        "train_name": train_meta.train_name,
        "generated_at": now.isoformat(),
        "data_freshness_seconds": round(freshness_sec, 1),
        "data_freshness_sec": round(freshness_sec, 1),
        "current_live_state": live_state,
        "upcoming_stations_eta": upcoming_stations_eta,
        "eta_stations": upcoming_stations_eta,
        "scheduled_arrival": sched_arrival,
        "predicted_p10_eta": p10_str,
        "predicted_p50_eta": p50_str,
        "predicted_p90_eta": p90_str,
        "predicted_delay": pred_delay,
        "predicted_delay_minutes": pred_delay,
        "overall_delay_min": pred_delay,
        "confidence_label": confidence_label,
        "confidence": confidence_label,
        "top_eta_factors": top_eta_factors,
        "top_factors": top_eta_factors,
        "recovery_probability": round(recovery_prob, 2),
        "delay_trend": delay_trend,
    }
