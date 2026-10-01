from datetime import datetime, timezone
from fastapi import APIRouter

from app.core.config import settings
from app.database.session import DB_AVAILABLE
from app.services.redis_client import is_redis_available
from app.services.data_source_manager import data_source_manager

router = APIRouter()


@router.get("/health", summary="System Health & Mode Status")
async def health_check():
    """
    Health check endpoint returning system status, timestamp,
    database/Redis connectivity, data source mode, and simulator status.
    """
    source_info = data_source_manager.get_status()

    return {
        "status": "healthy",
        "service": settings.PROJECT_NAME,
        "version": settings.VERSION,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "mode": "PROTOTYPE_SIMULATION",
        "disclaimer": settings.DATA_MODE_DISCLAIMER,
        "operating_mode": "database" if DB_AVAILABLE else "memory-only",
        "database_connected": DB_AVAILABLE,
        "redis_connected": is_redis_available(),
        "simulator_status": "active",
        "live_data_mode": settings.LIVE_DATA_MODE,
        "data_source": source_info,
        "components": {
            "api": "online",
            "eta_inference_engine": "online",
            "simulator_stream": "active",
            "database": "connected" if DB_AVAILABLE else "unavailable",
            "redis_cache": "connected" if is_redis_available() else "unavailable",
        },
    }
