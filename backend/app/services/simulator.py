import asyncio
import math
import random
import logging
import time
import uuid
from datetime import datetime, timezone, timedelta
from typing import Dict, Any, List, Optional

from app.models.schemas import TrainStatusEnum, TrainLiveState
from app.services.corridor_data import (
    STATIONS, STATION_ORDER, SECTIONS, TRAINS, TRAIN_INITIAL_CONFIGS
)
from app.services.store import train_store
from app.services.websocket import ws_manager

logger = logging.getLogger(__name__)

def calculate_bearing(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Calculate compass heading (0-360 deg) from point 1 to point 2."""
    dlon = math.radians(lon2 - lon1)
    l1 = math.radians(lat1)
    l2 = math.radians(lat2)
    x = math.sin(dlon) * math.cos(l2)
    y = math.cos(l1) * math.sin(l2) - math.sin(l1) * math.cos(l2) * math.cos(dlon)
    initial_bearing = math.atan2(x, y)
    compass_bearing = (math.degrees(initial_bearing) + 360) % 360
    return round(compass_bearing, 2)

def interpolate_coords(lat1: float, lon1: float, lat2: float, lon2: float, fraction: float):
    """Interpolate coordinates along straight-line segment between two points."""
    fraction = max(0.0, min(1.0, fraction))
    lat = lat1 + (lat2 - lat1) * fraction
    lon = lon1 + (lon2 - lon1) * fraction
    return round(lat, 5), round(lon, 5)

class TrainSimulator:
    def __init__(self):
        self.section_keys = list(SECTIONS.keys())
        self.sim_states: Dict[str, Dict[str, Any]] = {}
        self.active_events: Dict[str, Dict[str, Any]] = {}
        self.is_running = False
        self._seed_trains()

    def _seed_trains(self):
        """Initialize train positions according to seed configurations."""
        self.sim_states.clear()
        for train_id, meta in TRAINS.items():
            config = TRAIN_INITIAL_CONFIGS.get(train_id, {"start_sec_index": 0, "progress_pct": 0.0, "delay_minutes": 0})
            sec_idx = config["start_sec_index"]
            sec_key = self.section_keys[sec_idx]
            section = SECTIONS[sec_key]
            
            dist_in_sec = section.distance_km * config["progress_pct"]
            
            self.sim_states[train_id] = {
                "train_id": train_id,
                "train_name": meta.train_name,
                "category": meta.category,
                "priority": meta.priority,
                "section_index": sec_idx,
                "distance_in_sec_km": dist_in_sec,
                "status": TrainStatusEnum.RUNNING,
                "dwell_ticks": 0,
                "halt_ticks": 0,
                "delay_minutes": config["delay_minutes"],
                "speed_kmph": section.normal_speed_kmph * (1.0 - (meta.priority - 1) * 0.05),
            }

    async def initialize_store(self):
        """Sync initial state with store, congestion engine, and alert engine."""
        for train_id in list(self.sim_states.keys()):
            live_state = self._compute_live_state(train_id)
            await train_store.set_train_state(train_id, live_state.model_dump())

        all_states = await train_store.get_all_train_states()
        from app.services.congestion_engine import update_all_congestion, get_all_congestion
        from app.services.propagation_engine import propagation_engine
        await update_all_congestion(all_states)
        cong_records = await get_all_congestion()
        await propagation_engine.evaluate_propagation_and_alerts(all_states, cong_records)

    def reset_simulation(self):
        """Reset all trains to initial seeded state and clear all overrides."""
        self._seed_trains()
        self.active_events.clear()
        from app.services.congestion_engine import clear_all_overrides
        clear_all_overrides()

    def _compute_live_state(self, train_id: str) -> TrainLiveState:
        state = self.sim_states[train_id]
        sec_idx = state["section_index"]
        
        # Check if GPS is simulated as stale (timestamp shifted into the past)
        if state.get("gps_stale"):
            ts_str = (datetime.now(timezone.utc) - timedelta(seconds=240)).isoformat()
        else:
            ts_str = datetime.now(timezone.utc).isoformat()

        if sec_idx >= len(self.section_keys):
            # Train has completed full route
            last_station_code = STATION_ORDER[-1]
            st = STATIONS[last_station_code]
            return TrainLiveState(
                train_id=train_id,
                train_name=state["train_name"],
                timestamp=ts_str,
                latitude=st.latitude,
                longitude=st.longitude,
                speed_kmph=0.0,
                heading=0.0,
                current_section=None,
                distance_to_next_station_km=0.0,
                delay_minutes=state["delay_minutes"],
                status=TrainStatusEnum.COMPLETED,
                current_station=last_station_code,
                next_station=None,
                category=state["category"],
                priority=state["priority"]
            )

        sec_key = self.section_keys[sec_idx]
        section = SECTIONS[sec_key]
        from_st = STATIONS[section.from_station]
        to_st = STATIONS[section.to_station]

        dist_total = section.distance_km
        dist_current = state["distance_in_sec_km"]
        dist_to_next = max(0.0, dist_total - dist_current)
        fraction = dist_current / dist_total if dist_total > 0 else 1.0

        lat, lng = interpolate_coords(from_st.latitude, from_st.longitude, to_st.latitude, to_st.longitude, fraction)
        heading = calculate_bearing(from_st.latitude, from_st.longitude, to_st.latitude, to_st.longitude)

        curr_st_code = from_st.code if fraction < 0.05 else None

        return TrainLiveState(
            train_id=train_id,
            train_name=state["train_name"],
            timestamp=ts_str,
            latitude=lat,
            longitude=lng,
            speed_kmph=round(state["speed_kmph"], 1),
            heading=heading,
            current_section=section.section_id,
            distance_to_next_station_km=round(dist_to_next, 2),
            delay_minutes=state["delay_minutes"],
            status=state["status"],
            current_station=curr_st_code,
            next_station=to_st.code,
            category=state["category"],
            priority=state["priority"]
        )

    async def sync_and_broadcast(self):
        """Update stores and broadcast real-time state via WebSockets."""
        # 1. Update store for all trains
        for train_id in list(self.sim_states.keys()):
            live_state = self._compute_live_state(train_id)
            await train_store.set_train_state(train_id, live_state.model_dump())

        all_states = await train_store.get_all_train_states()
        now_iso = datetime.now(timezone.utc).isoformat()

        # Broadcast Train Telemetry
        await ws_manager.broadcast({
            "type": "TRAIN_UPDATE",
            "timestamp": now_iso,
            "data": all_states
        })

        # Update and Broadcast Section Congestion
        from app.services.congestion_engine import update_all_congestion, get_all_congestion
        from app.services.eta_engine import compute_eta
        from app.services.propagation_engine import propagation_engine

        await update_all_congestion(all_states)
        cong_records = await get_all_congestion()
        await ws_manager.broadcast({
            "type": "CONGESTION_UPDATE",
            "timestamp": now_iso,
            "data": cong_records
        })

        # Compute and Broadcast Dynamic ETA Projections
        cong_map = {c["section_id"]: c for c in cong_records if "section_id" in c}
        eta_results: Dict[str, Dict[str, Any]] = {}
        for state in all_states:
            t_id = state.get("train_id")
            prop_info = propagation_engine.get_propagation_for_train(t_id)
            eta_results[t_id] = compute_eta(
                train_id=t_id,
                live_state=state,
                congestion_map=cong_map,
                propagation_info=prop_info
            )

        await ws_manager.broadcast({
            "type": "ETA_UPDATE",
            "timestamp": now_iso,
            "data": eta_results
        })

        # Evaluate delay propagation and trigger control-room alerts
        await propagation_engine.evaluate_propagation_and_alerts(
            all_train_states=all_states,
            congestion_records=cong_records,
            eta_results=eta_results
        )

    async def inject_event(self, event_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Inject an operational what-if event into the simulation.
        Updates train behavior, section congestion, triggers propagation,
        adds alerts to alert_store, and broadcasts via WebSockets immediately.
        """
        event_id = f"EVT_{int(time.time())}_{uuid.uuid4().hex[:6]}"
        event_type = event_data.get("event_type", "SIGNAL_HALT")
        train_id = event_data.get("affected_train")
        section_id = event_data.get("affected_section")
        duration_min = int(event_data.get("duration_minutes", 15))
        severity = event_data.get("severity", "HIGH")
        speed_limit = event_data.get("speed_limit_kmph")
        desc = event_data.get("description") or f"Simulated {event_type} event active."

        if not train_id:
            if section_id:
                for tid, st in self.sim_states.items():
                    sec_key = self.section_keys[st["section_index"]] if st["section_index"] < len(self.section_keys) else None
                    if sec_key == section_id:
                        train_id = tid
                        break
            if not train_id:
                train_id = "12952"

        if not section_id and train_id in self.sim_states:
            st = self.sim_states[train_id]
            sec_idx = st["section_index"]
            if sec_idx < len(self.section_keys):
                section_id = self.section_keys[sec_idx]

        from app.services.congestion_engine import set_section_override
        from app.services.alert_store import alert_store

        if event_type == "SIGNAL_HALT":
            if train_id in self.sim_states:
                st = self.sim_states[train_id]
                st["status"] = TrainStatusEnum.SIGNAL_HALT
                st["speed_kmph"] = 0.0
                st["delay_minutes"] += max(5, duration_min)
                st["halt_ticks"] = max(4, int(duration_min * 60 / 5))
            alert_category = "SIGNAL_HALT"

        elif event_type == "UNSCHEDULED_STOP":
            if train_id in self.sim_states:
                st = self.sim_states[train_id]
                st["status"] = TrainStatusEnum.UNSCHEDULED_HALT
                st["speed_kmph"] = 0.0
                st["delay_minutes"] += max(6, duration_min)
                st["halt_ticks"] = max(4, int(duration_min * 60 / 5))
            alert_category = "SIGNAL_HALT"

        elif event_type == "SPEED_RESTRICTION":
            if section_id:
                lim = float(speed_limit) if speed_limit else 35.0
                set_section_override(section_id, restriction_active=True, extra_congestion=0.30)
                if train_id in self.sim_states:
                    st = self.sim_states[train_id]
                    st["speed_kmph"] = min(st["speed_kmph"], lim)
                    st["delay_minutes"] += max(4, int(duration_min * 0.4))
            alert_category = "HIGH_CONGESTION"

        elif event_type == "HEAVY_RAIN":
            if section_id:
                set_section_override(section_id, weather_condition="RAIN", extra_congestion=0.25)
                if train_id in self.sim_states:
                    st = self.sim_states[train_id]
                    st["speed_kmph"] = max(40.0, st["speed_kmph"] * 0.75)
                    st["delay_minutes"] += max(3, int(duration_min * 0.3))
            alert_category = "HIGH_CONGESTION"

        elif event_type == "CONGESTION":
            if section_id:
                set_section_override(section_id, extra_congestion=0.55)
                if train_id in self.sim_states:
                    st = self.sim_states[train_id]
                    st["delay_minutes"] += max(4, int(duration_min * 0.5))
            alert_category = "HIGH_CONGESTION"

        elif event_type == "GPS_OUTAGE":
            if train_id in self.sim_states:
                self.sim_states[train_id]["gps_stale"] = True
            alert_category = "GPS_STALE"

        else:
            alert_category = "ETA_CHANGED"

        event_record = {
            "event_id": event_id,
            "event_type": event_type,
            "affected_train": train_id,
            "affected_section": section_id,
            "duration_minutes": duration_min,
            "severity": severity,
            "speed_limit_kmph": speed_limit,
            "description": desc,
            "status": "ACTIVE",
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        self.active_events[event_id] = event_record

        await alert_store.add_alert(
            category=alert_category,
            severity=severity,
            train_id=train_id,
            section_id=section_id,
            title=f"What-If: {event_type.replace('_', ' ').title()}",
            message=desc,
        )

        await self.sync_and_broadcast()
        return event_record

    async def clear_event(self, event_id: str) -> bool:
        """Clear an active simulated event and revert overrides."""
        if event_id not in self.active_events:
            return False
        evt = self.active_events.pop(event_id)
        from app.services.congestion_engine import clear_section_override
        if evt.get("affected_section"):
            clear_section_override(evt["affected_section"])
        
        train_id = evt.get("affected_train")
        if train_id and train_id in self.sim_states:
            st = self.sim_states[train_id]
            st.pop("gps_stale", None)
            if st["status"] in (TrainStatusEnum.SIGNAL_HALT, TrainStatusEnum.UNSCHEDULED_HALT):
                st["status"] = TrainStatusEnum.RUNNING
                st["halt_ticks"] = 0

        await self.sync_and_broadcast()
        return True

    def get_active_events(self) -> List[Dict[str, Any]]:
        return list(self.active_events.values())

    async def step(self):
        """Execute one simulation cycle (5 seconds)."""
        dt_seconds = 5.0
        
        for train_id, state in self.sim_states.items():
            status = state["status"]
            sec_idx = state["section_index"]

            if sec_idx >= len(self.section_keys):
                state["status"] = TrainStatusEnum.COMPLETED
                state["speed_kmph"] = 0.0
                continue

            sec_key = self.section_keys[sec_idx]
            section = SECTIONS[sec_key]

            if status == TrainStatusEnum.AT_STATION:
                state["speed_kmph"] = 0.0
                state["dwell_ticks"] -= 1
                if state["dwell_ticks"] <= 0:
                    state["section_index"] += 1
                    state["distance_in_sec_km"] = 0.0
                    if state["section_index"] >= len(self.section_keys):
                        state["status"] = TrainStatusEnum.COMPLETED
                    else:
                        state["status"] = TrainStatusEnum.RUNNING

            elif status in (TrainStatusEnum.SIGNAL_HALT, TrainStatusEnum.UNSCHEDULED_HALT):
                state["speed_kmph"] = 0.0
                state["halt_ticks"] -= 1
                state["delay_minutes"] += random.choice([0, 1])
                if state["halt_ticks"] <= 0:
                    state["status"] = TrainStatusEnum.RUNNING

            elif status == TrainStatusEnum.RUNNING:
                base_speed = section.normal_speed_kmph * (1.0 - (state["priority"] - 1) * 0.04)
                jitter = random.uniform(-4.0, 4.0)
                current_speed = max(30.0, min(130.0, base_speed + jitter))
                state["speed_kmph"] = current_speed

                distance_moved = current_speed * (dt_seconds / 3600.0)
                state["distance_in_sec_km"] += distance_moved

                if state["distance_in_sec_km"] >= section.distance_km:
                    state["distance_in_sec_km"] = section.distance_km
                    state["status"] = TrainStatusEnum.AT_STATION
                    state["speed_kmph"] = 0.0
                    state["dwell_ticks"] = random.randint(3, 5)

                else:
                    if random.random() < 0.01 and state["priority"] > 1:
                        state["status"] = TrainStatusEnum.SIGNAL_HALT
                        state["halt_ticks"] = random.randint(2, 4)
                        state["speed_kmph"] = 0.0

        await self.sync_and_broadcast()

# Global simulator instance
simulator = TrainSimulator()

async def run_simulation_loop():
    """Background simulation task updating every 5 seconds."""
    logger.info("Starting RailDrishti AI background train simulation loop...")
    await simulator.initialize_store()
    try:
        while True:
            await asyncio.sleep(5)
            await simulator.step()
    except asyncio.CancelledError:
        logger.info("Simulation loop stopped.")
    except Exception as e:
        logger.error(f"Error in simulation loop: {e}", exc_info=True)
