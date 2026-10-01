from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from datetime import datetime
from enum import Enum

class TrainStatusEnum(str, Enum):
    RUNNING = "RUNNING"
    AT_STATION = "AT_STATION"
    SIGNAL_HALT = "SIGNAL_HALT"
    UNSCHEDULED_HALT = "UNSCHEDULED_HALT"
    COMPLETED = "COMPLETED"

class Station(BaseModel):
    code: str
    name: str
    latitude: float
    longitude: float
    sequence: int

class Section(BaseModel):
    section_id: str
    from_station: str
    to_station: str
    distance_km: float
    normal_speed_kmph: float
    capacity_score: float = Field(..., ge=0.0, le=1.0)
    historical_median_time_min: float
    historical_p90_time_min: float

class TrainMeta(BaseModel):
    train_id: str
    train_name: str
    category: str
    priority: int
    source_station: str
    destination_station: str

class TrainLiveState(BaseModel):
    train_id: str
    train_name: str
    timestamp: str
    latitude: float
    longitude: float
    speed_kmph: float
    heading: float
    current_section: Optional[str] = None
    distance_to_next_station_km: float
    delay_minutes: int
    status: TrainStatusEnum
    current_station: Optional[str] = None
    next_station: Optional[str] = None
    category: Optional[str] = None
    priority: Optional[int] = None

class TrainDetailResponse(BaseModel):
    meta: TrainMeta
    live_state: TrainLiveState

class RouteStation(BaseModel):
    station_code: str
    station_name: str
    sequence_number: int
    distance_from_source_km: float
    scheduled_arrival: Optional[str] = None
    scheduled_departure: Optional[str] = None
    latitude: float
    longitude: float

class TrainRouteResponse(BaseModel):
    train_id: str
    train_name: str
    category: str
    priority: int
    source_station: str
    destination_station: str
    stations: List[RouteStation]
    sections: List[Section]

class UpcomingStation(BaseModel):
    station_code: str
    station_name: str
    distance_remaining_km: float
    scheduled_arrival: str
    predicted_arrival: str
    delay_minutes: int
    dwell_time_minutes: int

class UpcomingStationsResponse(BaseModel):
    train_id: str
    train_name: str
    current_station_code: Optional[str] = None
    next_station_code: Optional[str] = None
    upcoming_stations: List[UpcomingStation]

class WSMessage(BaseModel):
    type: str = "TRAIN_UPDATE"
    timestamp: str
    data: Any

class ResetSimulationResponse(BaseModel):
    status: str
    message: str
    active_trains_count: int
    timestamp: str

# Legacy models for backward compatibility
class StationETA(BaseModel):
    station_code: str
    station_name: str
    scheduled_arrival: str
    predicted_arrival: str
    delay_minutes: int
    confidence_score: float = Field(default=0.95, ge=0.0, le=1.0)
    delay_reasons: List[str] = []

class TrainLiveStatus(BaseModel):
    train_number: str
    train_name: str
    source_station: str
    destination_station: str
    current_station_code: Optional[str] = None
    next_station_code: str
    current_speed_kmh: float
    current_lat: float
    current_lng: float
    last_updated: datetime
    overall_delay_minutes: int
    status_label: str
    upcoming_etainfo: List[StationETA] = []
    explanation_factors: Dict[str, Any] = {}
