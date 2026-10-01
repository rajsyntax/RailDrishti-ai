from fastapi import APIRouter, HTTPException
from typing import List, Dict, Any
from datetime import datetime, timezone, timedelta

from app.models.schemas import (
    TrainLiveState, TrainRouteResponse, RouteStation, Section,
    UpcomingStationsResponse, UpcomingStation, TrainDetailResponse
)
from app.services.store import train_store
from app.services.corridor_data import (
    TRAINS, STATIONS, STATION_ORDER, SECTIONS
)

router = APIRouter(prefix="/trains", tags=["Trains & Live Tracking"])

@router.get("", response_model=List[TrainLiveState], summary="Get All Active Trains Live State")
async def get_all_trains():
    """
    Retrieve current real-time state for all simulated coaching trains in the corridor.
    """
    states = await train_store.get_all_train_states()
    if not states:
        # Fallback if store is empty
        return []
    return states

@router.get("/{train_id}/live", response_model=TrainLiveState, summary="Get Train Live State")
async def get_train_live(train_id: str):
    """
    Retrieve real-time telemetry and state for a specific train by train_id.
    """
    state = await train_store.get_train_state(train_id)
    if not state:
        raise HTTPException(status_code=404, detail=f"Train '{train_id}' not found")
    return state

@router.get("/{train_id}/route", response_model=TrainRouteResponse, summary="Get Train Route & Section Data")
async def get_train_route(train_id: str):
    """
    Retrieve full synthetic route configuration, stations sequence, and section metrics for a train.
    """
    meta = TRAINS.get(train_id)
    if not meta:
        raise HTTPException(status_code=404, detail=f"Train '{train_id}' not found")

    stations_list: List[RouteStation] = []
    cumulative_dist = 0.0

    # Build sequence of stations along NDLS -> MMCT main corridor
    for idx, st_code in enumerate(STATION_ORDER):
        st = STATIONS[st_code]
        if idx > 0:
            prev_code = STATION_ORDER[idx - 1]
            sec_key = f"SEC_{prev_code}_{st_code}"
            if sec_key in SECTIONS:
                cumulative_dist += SECTIONS[sec_key].distance_km

        # Synthetic scheduled timings
        base_time = datetime.now(timezone.utc) + timedelta(minutes=idx * 45)
        arr_str = (base_time - timedelta(minutes=5)).strftime("%H:%M") if idx > 0 else "SOURCE"
        dep_str = base_time.strftime("%H:%M") if idx < len(STATION_ORDER) - 1 else "DEST"

        stations_list.append(RouteStation(
            station_code=st.code,
            station_name=st.name,
            sequence_number=st.sequence,
            distance_from_source_km=round(cumulative_dist, 1),
            scheduled_arrival=arr_str,
            scheduled_departure=dep_str,
            latitude=st.latitude,
            longitude=st.longitude
        ))

    sections_list = list(SECTIONS.values())

    return TrainRouteResponse(
        train_id=meta.train_id,
        train_name=meta.train_name,
        category=meta.category,
        priority=meta.priority,
        source_station=meta.source_station,
        destination_station=meta.destination_station,
        stations=stations_list,
        sections=sections_list
    )

@router.get("/{train_id}/upcoming-stations", response_model=UpcomingStationsResponse, summary="Get Upcoming Stations & Predicted ETAs")
async def get_upcoming_stations(train_id: str):
    """
    Retrieve list of upcoming stations down the corridor with scheduled vs predicted arrival times and delay metrics.
    """
    state_dict = await train_store.get_train_state(train_id)
    if not state_dict:
        raise HTTPException(status_code=404, detail=f"Train '{train_id}' not found")

    curr_sec_id = state_dict.get("current_section")
    next_st_code = state_dict.get("next_station")
    delay = state_dict.get("delay_minutes", 0)

    # Determine remaining stations starting from next_station
    upcoming_list: List[UpcomingStation] = []
    
    start_index = 0
    if next_st_code and next_st_code in STATION_ORDER:
        start_index = STATION_ORDER.index(next_st_code)

    now = datetime.now(timezone.utc)
    accumulated_km = state_dict.get("distance_to_next_station_km", 0.0)

    for i in range(start_index, len(STATION_ORDER)):
        st_code = STATION_ORDER[i]
        st = STATIONS[st_code]
        
        if i > start_index:
            prev_code = STATION_ORDER[i - 1]
            sec_key = f"SEC_{prev_code}_{st_code}"
            if sec_key in SECTIONS:
                accumulated_km += SECTIONS[sec_key].distance_km

        # Scheduled arrival & predicted arrival
        minutes_to_travel = (accumulated_km / 100.0) * 60.0  # Approx 100 km/h average
        sched_time = now + timedelta(minutes=minutes_to_travel)
        pred_time = sched_time + timedelta(minutes=delay)

        upcoming_list.append(UpcomingStation(
            station_code=st.code,
            station_name=st.name,
            distance_remaining_km=round(accumulated_km, 1),
            scheduled_arrival=sched_time.strftime("%H:%M IST"),
            predicted_arrival=pred_time.strftime("%H:%M IST"),
            delay_minutes=delay,
            dwell_time_minutes=2 if i < len(STATION_ORDER) - 1 else 0
        ))

    return UpcomingStationsResponse(
        train_id=train_id,
        train_name=state_dict.get("train_name", ""),
        current_station_code=state_dict.get("current_station"),
        next_station_code=next_st_code,
        upcoming_stations=upcoming_list
    )


@router.get("/{train_id}/eta", summary="Get Full Dynamic ETA Intelligence")
async def get_train_eta(train_id: str):
    """
    Compute rule-based baseline dynamic ETA for every upcoming station,
    factoring in current speed, effective speed, congestion multipliers,
    weather impacts, temporary restrictions, halts, and timetable recovery margins.
    Returns P10/P50/P90 probabilistic bounds and confidence classifications.
    """
    state_dict = await train_store.get_train_state(train_id)
    if not state_dict:
        raise HTTPException(status_code=404, detail=f"Train '{train_id}' not found")
        
    from app.services.congestion_engine import get_all_congestion
    from app.services.propagation_engine import propagation_engine
    from app.services.eta_engine import compute_eta
    
    cong_list = await get_all_congestion()
    cong_map = {c["section_id"]: c for c in cong_list if "section_id" in c}
    prop_info = propagation_engine.get_propagation_for_train(train_id)
    
    return compute_eta(
        train_id=train_id,
        live_state=state_dict,
        congestion_map=cong_map,
        propagation_info=prop_info
    )


@router.get("/{train_id}/explain", summary="Explain ETA Prediction and Delay Attribution")
async def get_train_explain(train_id: str):
    """
    Explainability engine endpoint: Deconstructs factors contributing to ETA adjustments
    (signal halt, downstream congestion, temporary speed restriction, weather reduction,
    station dwell overrun, low speed, timetable recovery margin, propagation).
    Returns a natural language explanation and factor-level breakdown.
    """
    state_dict = await train_store.get_train_state(train_id)
    if not state_dict:
        raise HTTPException(status_code=404, detail=f"Train '{train_id}' not found")
        
    from app.services.congestion_engine import get_all_congestion
    from app.services.propagation_engine import propagation_engine
    from app.services.eta_engine import compute_eta
    from app.services.explanation_engine import generate_explanation
    
    cong_list = await get_all_congestion()
    cong_map = {c["section_id"]: c for c in cong_list if "section_id" in c}
    prop_info = propagation_engine.get_propagation_for_train(train_id)
    
    eta_data = compute_eta(
        train_id=train_id,
        live_state=state_dict,
        congestion_map=cong_map,
        propagation_info=prop_info
    )
    
    train_name = state_dict.get(
        "train_name",
        TRAINS[train_id].train_name if train_id in TRAINS else train_id
    )
    return generate_explanation(
        train_id=train_id,
        train_name=train_name,
        eta_data=eta_data,
        propagation_info=prop_info
    )

