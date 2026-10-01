"""
RailDrishti AI – Simulator Persistence Service.

Persists important train state snapshots, operational events, ETA predictions,
and alerts to PostgreSQL at a controlled rate. Does not write every WebSocket tick.
"""

import asyncio
import logging
from datetime import datetime, timezone
from typing import Dict, Any, List, Optional, Set

from app.core.config import settings
from app.database.session import DB_AVAILABLE, _AsyncSession

logger = logging.getLogger(__name__)

_last_persist_time: Optional[datetime] = None
_persisted_train_ids: Set[str] = set()


async def persist_train_state(train_id: str, state: Dict[str, Any]) -> bool:
    """
    Persist a single train state snapshot to the database.
    Returns True if persisted, False if DB unavailable.
    """
    if not DB_AVAILABLE or _AsyncSession is None:
        return False

    try:
        async with _AsyncSession() as session:
            from app.database.models import LiveTrainStateModel

            record = LiveTrainStateModel(
                train_id=train_id,
                event_time=datetime.now(timezone.utc),
                latitude=state.get("latitude", 0.0),
                longitude=state.get("longitude", 0.0),
                speed_kmph=state.get("speed_kmph", 0.0),
                heading=state.get("heading"),
                current_section=state.get("current_section"),
                distance_to_next_station=state.get("distance_to_next_station_km"),
                delay_minutes=state.get("delay_minutes", 0),
                status=state.get("status", "RUNNING"),
                source_type="SIMULATOR",
                source_timestamp=state.get("timestamp"),
                data_freshness_seconds=5.0,
            )
            session.add(record)
            await session.commit()
            return True
    except Exception as e:
        logger.warning(f"Failed to persist train state for {train_id}: {e}")
        return False


async def persist_operational_event(event: Dict[str, Any]) -> bool:
    """
    Persist an operational event to the database.
    Returns True if persisted, False if DB unavailable.
    """
    if not DB_AVAILABLE or _AsyncSession is None:
        return False

    try:
        async with _AsyncSession() as session:
            from app.database.models import OperationalEventModel

            record = OperationalEventModel(
                event_type=event.get("event_type", "UNKNOWN"),
                severity=event.get("severity", "MEDIUM"),
                affected_train_id=event.get("affected_train"),
                affected_section=event.get("affected_section"),
                started_at=datetime.now(timezone.utc),
                duration_minutes=event.get("duration_minutes"),
                speed_limit_kmph=event.get("speed_limit_kmph"),
                description=event.get("description"),
                is_active=event.get("status") == "ACTIVE",
                source_type="SIMULATOR",
            )
            session.add(record)
            await session.commit()
            return True
    except Exception as e:
        logger.warning(f"Failed to persist operational event: {e}")
        return False


async def persist_eta_prediction(train_id: str, eta_data: Dict[str, Any]) -> bool:
    """
    Persist an ETA prediction to the database.
    Returns True if persisted, False if DB unavailable.
    """
    if not DB_AVAILABLE or _AsyncSession is None:
        return False

    try:
        async with _AsyncSession() as session:
            from app.database.models import EtaPredictionModel

            upcoming = eta_data.get("upcoming_stations_eta", [])
            if not upcoming:
                return False

            final_station = upcoming[-1]
            record = EtaPredictionModel(
                train_id=train_id,
                target_station_code=final_station.get("station_code", ""),
                predicted_at=datetime.now(timezone.utc),
                predicted_arrival=datetime.now(timezone.utc),
                delay_minutes=final_station.get("predicted_delay", 0),
                confidence_score=0.9,
                model_version="v1.0-sim",
                feature_snapshot=None,
            )
            session.add(record)
            await session.commit()
            return True
    except Exception as e:
        logger.warning(f"Failed to persist ETA prediction for {train_id}: {e}")
        return False


async def persist_alert(alert: Dict[str, Any]) -> bool:
    """
    Persist an alert to the database.
    Returns True if persisted, False if DB unavailable.
    """
    if not DB_AVAILABLE or _AsyncSession is None:
        return False

    try:
        async with _AsyncSession() as session:
            from app.database.models import AlertModel

            record = AlertModel(
                alert_type=alert.get("category", "INFO"),
                train_id=alert.get("train_id"),
                station_code=alert.get("station_code"),
                severity=alert.get("severity", "INFO"),
                title=alert.get("title", "Alert"),
                message=alert.get("message", ""),
                is_read=False,
                is_active=alert.get("is_active", True),
                source_mode="SIMULATOR",
            )
            session.add(record)
            await session.commit()
            return True
    except Exception as e:
        logger.warning(f"Failed to persist alert: {e}")
        return False


async def should_persist_now() -> bool:
    """
    Check if enough time has passed since the last persistence cycle.
    Uses SIMULATOR_PERSIST_INTERVAL setting (default 30 seconds).
    """
    global _last_persist_time

    now = datetime.now(timezone.utc)
    if _last_persist_time is None:
        _last_persist_time = now
        return True

    elapsed = (now - _last_persist_time).total_seconds()
    if elapsed >= settings.SIMULATOR_PERSIST_INTERVAL:
        _last_persist_time = now
        return True
    return False


async def persist_all_train_states(train_states: List[Dict[str, Any]]) -> int:
    """
    Persist all train states if the persistence interval has elapsed.
    Returns the number of states persisted.
    """
    if not await should_persist_now():
        return 0

    persisted = 0
    for state in train_states:
        if await persist_train_state(state.get("train_id", ""), state):
            persisted += 1

    if persisted > 0:
        logger.info(f"Persisted {persisted} train state snapshots to database.")

    return persisted
