"""
External Feed API – /api/v1/external-feed

Provides endpoints for manually refreshing train status from external providers.
All external data access happens only in the FastAPI backend.
"""

from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException, Query

from app.core.config import settings
from app.services.external_polling import refresh_train_status, get_polling_status
from app.services.external_train_feed import ProviderError
from app.services.data_source_manager import data_source_manager

router = APIRouter(prefix="/external-feed", tags=["External Data Feed"])


@router.get("/status", summary="Get External Feed Status")
async def external_feed_status():
    """
    Return the current status of the external data feed service.
    """
    polling = get_polling_status()
    source = data_source_manager.get_status()

    return {
        "live_data_mode": settings.LIVE_DATA_MODE,
        "provider": settings.TRAIN_STATUS_PROVIDER,
        "api_base_url_configured": bool(settings.TRAIN_STATUS_API_BASE_URL),
        "api_key_configured": bool(settings.TRAIN_STATUS_API_KEY),
        "polling": polling,
        "data_source": source,
    }


@router.post("/trains/{train_number}/refresh", summary="Manually Refresh Train Status")
async def refresh_train(
    train_number: str,
    journey_date: str = Query(..., description="Journey date in YYYY-MM-DD format"),
):
    """
    Manually fetch live status for a specific train from the external provider.

    Returns 400 if live mode is disabled or provider is not configured.
    Never exposes API keys or credentials.
    """
    if not settings.LIVE_DATA_MODE:
        raise HTTPException(
            status_code=400,
            detail="Live data mode is disabled. Set LIVE_DATA_MODE=true to enable external feed.",
        )

    if not settings.TRAIN_STATUS_API_BASE_URL:
        raise HTTPException(
            status_code=400,
            detail="External provider is not configured. Set TRAIN_STATUS_API_BASE_URL.",
        )

    try:
        result = await refresh_train_status(train_number, journey_date)
        return result
    except ProviderError as e:
        raise HTTPException(status_code=502, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Unexpected error: {type(e).__name__}")
