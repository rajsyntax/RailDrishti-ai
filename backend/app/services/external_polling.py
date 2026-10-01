"""
RailDrishti AI – External Train Data Polling Service.

Polls configured tracked train numbers from the external provider at
TRAIN_STATUS_POLL_SECONDS intervals. Disabled unless LIVE_DATA_MODE is true.
"""

import asyncio
import logging
from datetime import datetime, timezone
from typing import Dict, Any, Optional, Set

from app.core.config import settings
from app.services.external_train_feed import generic_http_provider, ProviderError
from app.services.data_source_manager import data_source_manager
from app.services.redis_client import cache_train_state
from app.services.websocket import ws_manager

logger = logging.getLogger(__name__)

_polling_task: Optional[asyncio.Task] = None
_is_running = False
_last_poll_results: Dict[str, Dict[str, Any]] = {}
_in_flight: Set[str] = set()


async def start_polling():
    """Start the external data polling service."""
    global _polling_task, _is_running

    if _is_running:
        return

    if not settings.LIVE_DATA_MODE:
        logger.info("External polling disabled: LIVE_DATA_MODE is false.")
        return

    if not settings.TRAIN_STATUS_API_BASE_URL:
        logger.warning("External polling disabled: TRAIN_STATUS_API_BASE_URL not configured.")
        return

    _is_running = True
    _polling_task = asyncio.create_task(_polling_loop(), name="external_data_polling")
    logger.info("External data polling service started.")


async def stop_polling():
    """Stop the external data polling service."""
    global _polling_task, _is_running

    _is_running = False
    if _polling_task:
        _polling_task.cancel()
        try:
            await _polling_task
        except asyncio.CancelledError:
            pass
        _polling_task = None
    logger.info("External data polling service stopped.")


async def _polling_loop():
    """Main polling loop."""
    while _is_running:
        try:
            await poll_all_tracks()
        except Exception as e:
            logger.error(f"Polling loop error: {e}")

        await asyncio.sleep(settings.TRAIN_STATUS_POLL_SECONDS)


async def poll_all_tracks() -> Dict[str, Any]:
    """
    Poll all tracked train numbers. Prevents overlapping calls for the same train.
    """
    from app.services.corridor_data import TRAINS

    results = {}
    for train_id in TRAINS.keys():
        if train_id in _in_flight:
            continue

        _in_flight.add(train_id)
        try:
            status = await generic_http_provider.get_live_status(
                train_number=train_id,
                journey_date=datetime.now(timezone.utc).strftime("%Y-%m-%d"),
            )
            results[train_id] = status
            _last_poll_results[train_id] = {
                "status": status,
                "fetched_at": datetime.now(timezone.utc).isoformat(),
            }

            # Cache in Redis if available
            await cache_train_state(train_id, status)

            # Broadcast via WebSocket
            await ws_manager.broadcast({
                "type": "TRAIN_UPDATE",
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "data": [status],
            })

        except ProviderError as e:
            logger.warning(f"Provider error for train {train_id}: {e}")
            _last_poll_results[train_id] = {
                "error": str(e),
                "fetched_at": datetime.now(timezone.utc).isoformat(),
            }
        except Exception as e:
            logger.error(f"Unexpected error polling train {train_id}: {e}")
        finally:
            _in_flight.discard(train_id)

    return results


async def refresh_train_status(train_number: str, journey_date: str) -> Dict[str, Any]:
    """
    Manually refresh a single train's status from the external provider.
    Returns the normalized status with source metadata.
    """
    if not settings.LIVE_DATA_MODE:
        raise ProviderError("Live data mode is disabled. Set LIVE_DATA_MODE=true to enable.")

    if not settings.TRAIN_STATUS_API_BASE_URL:
        raise ProviderError("TRAIN_STATUS_API_BASE_URL is not configured.")

    status = await generic_http_provider.get_live_status(train_number, journey_date)

    # Cache in Redis if available
    await cache_train_state(train_number, status)

    # Broadcast via WebSocket
    await ws_manager.broadcast({
        "type": "TRAIN_UPDATE",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "data": [status],
    })

    return {
        "train_number": train_number,
        "journey_date": journey_date,
        "source_type": "THIRD_PARTY_API",
        "fetched_at": datetime.now(timezone.utc).isoformat(),
        "data": status,
    }


def get_polling_status() -> Dict[str, Any]:
    """Get current polling service status."""
    return {
        "is_running": _is_running,
        "live_data_mode": settings.LIVE_DATA_MODE,
        "poll_interval_seconds": settings.TRAIN_STATUS_POLL_SECONDS,
        "last_poll_results": {
            k: {"fetched_at": v.get("fetched_at"), "has_error": "error" in v}
            for k, v in _last_poll_results.items()
        },
    }
