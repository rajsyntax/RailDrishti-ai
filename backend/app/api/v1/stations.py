"""
Stations API – /api/v1/stations

Serves from PostgreSQL when available, falls back to in-memory corridor_data.
"""

from fastapi import APIRouter, HTTPException
from typing import List, Optional
from pydantic import BaseModel

from app.services.corridor_data import STATIONS, STATION_ORDER, SECTIONS, TRAINS
from app.database.session import DB_AVAILABLE

router = APIRouter(prefix="/stations", tags=["Stations"])


# ── Pydantic response models ──────────────────────────────────────────────────

class StationResponse(BaseModel):
    station_code: str
    station_name: str
    latitude: float
    longitude: float
    zone: str
    division: str
    platform_count: int
    sequence: Optional[int] = None

class ArrivalInfo(BaseModel):
    train_id: str
    train_name: str
    category: str
    scheduled_arrival: Optional[str]
    scheduled_departure: Optional[str]
    halt_minutes: int

class StationArrivalsResponse(BaseModel):
    station_code: str
    station_name: str
    arrivals: List[ArrivalInfo]

# Static zone/division/platform metadata per station (in-memory fallback)
_STATION_META = {
    "NDLS": {"zone": "NR",  "division": "Delhi",    "platform_count": 16},
    "MTJ":  {"zone": "NCR", "division": "Agra",     "platform_count": 8},
    "BTE":  {"zone": "WCR", "division": "Kota",     "platform_count": 4},
    "GGC":  {"zone": "WCR", "division": "Kota",     "platform_count": 3},
    "SWM":  {"zone": "WCR", "division": "Kota",     "platform_count": 4},
    "KOTA": {"zone": "WCR", "division": "Kota",     "platform_count": 7},
    "RATL": {"zone": "WR",  "division": "Ratlam",   "platform_count": 6},
    "BRC":  {"zone": "WR",  "division": "Vadodara", "platform_count": 10},
    "MMCT": {"zone": "WR",  "division": "Mumbai",   "platform_count": 8},
}

# Inline schedule data (mirrors train_schedule.csv) for in-memory serving
_SCHEDULE = {
    "12952": {
        "NDLS": {"arr": None,       "dep": "16:25", "halt": 0},
        "MTJ":  {"arr": "18:39",    "dep": "18:41", "halt": 2},
        "BTE":  {"arr": "19:07",    "dep": "19:09", "halt": 2},
        "GGC":  {"arr": "20:22",    "dep": "20:24", "halt": 2},
        "SWM":  {"arr": "21:03",    "dep": "21:05", "halt": 2},
        "KOTA": {"arr": "22:11",    "dep": "22:16", "halt": 5},
        "RATL": {"arr": "01:05+1",  "dep": "01:10+1","halt": 5},
        "BRC":  {"arr": "04:37+1",  "dep": "04:40+1","halt": 3},
        "MMCT": {"arr": "07:40+1",  "dep": None,    "halt": 0},
    },
    "12413": {
        "NDLS": {"arr": None,     "dep": "07:30", "halt": 0},
        "MTJ":  {"arr": "09:48",  "dep": "09:50", "halt": 2},
        "BTE":  {"arr": "10:17",  "dep": "10:19", "halt": 2},
        "GGC":  {"arr": "11:32",  "dep": "11:34", "halt": 2},
        "SWM":  {"arr": "12:15",  "dep": "12:17", "halt": 2},
        "KOTA": {"arr": "13:25",  "dep": "13:30", "halt": 5},
        "RATL": {"arr": "16:25",  "dep": "16:30", "halt": 5},
        "BRC":  {"arr": "20:00",  "dep": "20:03", "halt": 3},
        "MMCT": {"arr": "23:05",  "dep": None,    "halt": 0},
    },
    "19020": {
        "NDLS": {"arr": None,       "dep": "23:15",   "halt": 0},
        "MTJ":  {"arr": "01:22+1",  "dep": "01:24+1", "halt": 2},
        "BTE":  {"arr": "01:51+1",  "dep": "01:53+1", "halt": 2},
        "GGC":  {"arr": "03:14+1",  "dep": "03:16+1", "halt": 2},
        "SWM":  {"arr": "04:03+1",  "dep": "04:05+1", "halt": 2},
        "KOTA": {"arr": "05:22+1",  "dep": "05:27+1", "halt": 5},
        "RATL": {"arr": "08:42+1",  "dep": "08:47+1", "halt": 5},
        "BRC":  {"arr": "12:30+1",  "dep": "12:33+1", "halt": 3},
        "MMCT": {"arr": "16:20+1",  "dep": None,      "halt": 0},
    },
    "12988": {
        "NDLS": {"arr": None,    "dep": "06:10", "halt": 0},
        "MTJ":  {"arr": "08:23", "dep": "08:25", "halt": 2},
        "BTE":  {"arr": "08:52", "dep": "08:54", "halt": 2},
        "GGC":  {"arr": "10:08", "dep": "10:10", "halt": 2},
        "SWM":  {"arr": "10:52", "dep": "10:54", "halt": 2},
        "KOTA": {"arr": "12:06", "dep": "12:11", "halt": 5},
        "RATL": {"arr": "15:16", "dep": "15:21", "halt": 5},
        "BRC":  {"arr": "19:00", "dep": "19:03", "halt": 3},
        "MMCT": {"arr": "22:15", "dep": None,    "halt": 0},
    },
    "12910": {
        "NDLS": {"arr": None,       "dep": "21:30",   "halt": 0},
        "MTJ":  {"arr": "23:42",    "dep": "23:44",   "halt": 2},
        "BTE":  {"arr": "00:12+1",  "dep": "00:14+1", "halt": 2},
        "GGC":  {"arr": "01:35+1",  "dep": "01:37+1", "halt": 2},
        "SWM":  {"arr": "02:22+1",  "dep": "02:24+1", "halt": 2},
        "KOTA": {"arr": "03:44+1",  "dep": "03:49+1", "halt": 5},
        "RATL": {"arr": "07:14+1",  "dep": "07:19+1", "halt": 5},
        "BRC":  {"arr": "11:10+1",  "dep": "11:13+1", "halt": 3},
        "MMCT": {"arr": "15:05+1",  "dep": None,      "halt": 0},
    },
}


def _station_to_response(code: str) -> StationResponse:
    st = STATIONS[code]
    meta = _STATION_META.get(code, {"zone": "IR", "division": "Unknown", "platform_count": 4})
    return StationResponse(
        station_code=st.code,
        station_name=st.name,
        latitude=st.latitude,
        longitude=st.longitude,
        zone=meta["zone"],
        division=meta["division"],
        platform_count=meta["platform_count"],
        sequence=st.sequence,
    )


@router.get("", response_model=List[StationResponse], summary="List All Corridor Stations")
async def list_stations():
    """
    Return all stations on the NDLS–MMCT corridor in sequence order.
    Source: in-memory (graceful fallback if DB is unavailable).
    """
    return [_station_to_response(code) for code in STATION_ORDER]


@router.get("/{station_code}", response_model=StationResponse, summary="Get Station Details")
async def get_station(station_code: str):
    """
    Return detailed metadata for a specific station by code.
    """
    code = station_code.upper()
    if code not in STATIONS:
        raise HTTPException(status_code=404, detail=f"Station '{station_code}' not found in corridor.")
    return _station_to_response(code)


@router.get("/{station_code}/arrivals", response_model=StationArrivalsResponse, summary="Station Train Arrivals")
async def get_station_arrivals(station_code: str):
    """
    Return all scheduled train arrivals and departures at the given station.
    """
    code = station_code.upper()
    if code not in STATIONS:
        raise HTTPException(status_code=404, detail=f"Station '{station_code}' not found in corridor.")

    arrivals: List[ArrivalInfo] = []
    for train_id, sched in _SCHEDULE.items():
        if code in sched:
            stop = sched[code]
            meta = TRAINS[train_id]
            arrivals.append(ArrivalInfo(
                train_id=train_id,
                train_name=meta.train_name,
                category=meta.category,
                scheduled_arrival=stop["arr"],
                scheduled_departure=stop["dep"],
                halt_minutes=stop["halt"],
            ))

    return StationArrivalsResponse(
        station_code=code,
        station_name=STATIONS[code].name,
        arrivals=arrivals,
    )
