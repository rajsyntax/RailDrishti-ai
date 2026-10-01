"""
Sections API – /api/v1/sections

Serves section/route data from in-memory corridor_data (always available).
"""

from fastapi import APIRouter, HTTPException
from typing import List
from pydantic import BaseModel

from app.services.corridor_data import SECTIONS, SECTION_KEYS_ORDER, STATIONS

router = APIRouter(prefix="/sections", tags=["Rail Sections"])


class SectionResponse(BaseModel):
    section_id: str
    from_station: str
    from_station_name: str
    to_station: str
    to_station_name: str
    distance_km: float
    normal_speed_kmph: float
    capacity_score: float
    historical_median_minutes: float
    historical_p90_minutes: float
    historical_median_time_min: float
    historical_p90_time_min: float


def _enrich(sec_id: str) -> SectionResponse:
    s = SECTIONS[sec_id]
    return SectionResponse(
        section_id=s.section_id,
        from_station=s.from_station,
        from_station_name=STATIONS[s.from_station].name,
        to_station=s.to_station,
        to_station_name=STATIONS[s.to_station].name,
        distance_km=s.distance_km,
        normal_speed_kmph=s.normal_speed_kmph,
        capacity_score=float(s.capacity_score),
        historical_median_minutes=s.historical_median_time_min,
        historical_p90_minutes=s.historical_p90_time_min,
        historical_median_time_min=s.historical_median_time_min,
        historical_p90_time_min=s.historical_p90_time_min,
    )


@router.get("", response_model=List[SectionResponse], summary="List All Corridor Sections")
async def list_sections():
    """
    Return all rail sections on the NDLS–MMCT corridor in route order.
    """
    return [_enrich(k) for k in SECTION_KEYS_ORDER]


@router.get("/congestion/all", summary="Get Congestion for All Corridor Sections")
async def get_all_sections_congestion():
    """
    Retrieve real-time congestion scores and sub-factor breakdowns for all sections.
    """
    from app.services.congestion_engine import get_all_congestion
    return await get_all_congestion()


@router.get("/{section_id}/congestion", summary="Get Section Congestion Score")
async def get_section_congestion_endpoint(section_id: str):
    """
    Retrieve detailed congestion scoring for a specific rail section:
    CongestionScore = 0.35*occupancy + 0.25*trains_ahead + 0.20*headway_risk + 0.20*restriction_severity
    Labels: 0.00-0.30 LOW | 0.31-0.60 MODERATE | 0.61-1.00 HIGH
    """
    sid = section_id.upper()
    if sid not in SECTIONS:
        raise HTTPException(status_code=404, detail=f"Section '{section_id}' not found.")
    
    from app.services.congestion_engine import get_section_congestion
    record = await get_section_congestion(sid)
    if not record:
        sec = SECTIONS[sid]
        # Return fallback zero baseline if not yet computed
        return {
            "section_id": sid,
            "from_station": sec.from_station,
            "to_station": sec.to_station,
            "score": 0.15,
            "label": "LOW",
            "sub_scores": {
                "occupancy": 0.1,
                "trains_ahead": 0.0,
                "headway_risk": 0.0,
                "restriction_severity": 0.0
            },
            "trains_in_section": 0,
            "trains_ahead": 0,
            "restriction_active": False,
            "weather_condition": "CLEAR"
        }
    return record


@router.get("/{section_id}", response_model=SectionResponse, summary="Get Section Details")
async def get_section(section_id: str):
    """
    Return detailed metrics for a specific rail section by ID.
    """
    sid = section_id.upper()
    if sid not in SECTIONS:
        raise HTTPException(status_code=404, detail=f"Section '{section_id}' not found.")
    return _enrich(sid)
