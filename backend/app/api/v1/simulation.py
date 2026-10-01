from fastapi import APIRouter, HTTPException
from datetime import datetime, timezone
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field

from app.models.schemas import ResetSimulationResponse
from app.services.simulator import simulator
from app.services.store import train_store

router = APIRouter(prefix="/simulate", tags=["Simulation Control"])


class SimulateEventRequest(BaseModel):
    event_type: str = Field(..., description="SIGNAL_HALT, SPEED_RESTRICTION, HEAVY_RAIN, CONGESTION, UNSCHEDULED_STOP, GPS_OUTAGE")
    affected_train: Optional[str] = Field(None, description="e.g. 12952, 12413, 19020")
    affected_section: Optional[str] = Field(None, description="e.g. SEC_SWM_KOTA, SEC_KOTA_RATL")
    duration_minutes: int = Field(15, ge=1, le=180, description="Duration of event impact in minutes")
    severity: str = Field("HIGH", description="CRITICAL, HIGH, MODERATE, LOW")
    speed_limit_kmph: Optional[float] = Field(None, description="Speed limit for speed restriction events")
    description: Optional[str] = Field(None, description="Operational event description")


class SimulatedEventRecord(BaseModel):
    event_id: str
    event_type: str
    affected_train: Optional[str] = None
    affected_section: Optional[str] = None
    duration_minutes: int
    severity: str
    speed_limit_kmph: Optional[float] = None
    description: str
    status: str = "ACTIVE"
    created_at: str


@router.post("/event", response_model=SimulatedEventRecord, summary="Inject What-If Operational Event")
async def inject_simulation_event(event_req: SimulateEventRequest):
    """
    Inject an operational what-if event into the live simulation sandbox.
    Directly recalculates train speeds, halts, section congestion, triggers delay propagation,
    creates control-room alerts, and broadcasts updates via WebSockets.
    """
    evt = await simulator.inject_event(event_req.model_dump())
    return SimulatedEventRecord(**evt)


@router.get("/events", response_model=List[SimulatedEventRecord], summary="List Active Simulated Events")
async def list_simulation_events():
    """
    Retrieve all currently active what-if simulation events.
    """
    events = simulator.get_active_events()
    return [SimulatedEventRecord(**e) for e in events]


@router.post("/clear-event/{event_id}", summary="Clear a Simulated What-If Event")
async def clear_simulation_event(event_id: str):
    """
    Revert a what-if event, restoring normal section restrictions and running statuses.
    """
    cleared = await simulator.clear_event(event_id)
    if not cleared:
        raise HTTPException(status_code=404, detail=f"Simulated event '{event_id}' not found.")
    return {"status": "success", "event_id": event_id, "message": "Event cleared and normal operations restored."}


@router.post("/reset", response_model=ResetSimulationResponse, summary="Reset Simulation State (Seed Mode)")
async def reset_simulation():
    """
    Seed/Reset endpoint for prototype use. Resets all train positions, delays, and telemetry to starting seed configurations.
    """
    simulator.reset_simulation()
    await simulator.initialize_store()
    active_states = await train_store.get_all_train_states()
    
    return ResetSimulationResponse(
        status="success",
        message="Simulation state reset successfully to prototype seed configurations.",
        active_trains_count=len(active_states),
        timestamp=datetime.now(timezone.utc).isoformat()
    )
