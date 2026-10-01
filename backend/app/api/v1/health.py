from datetime import datetime, timezone
from fastapi import APIRouter
from app.core.config import settings

router = APIRouter()

@router.get("/health", summary="System Health & Mode Status")
async def health_check():
    """
    Health check endpoint returning system status, timestamp,
    active ML engine state, and hackathon prototype notice.
    """
    return {
        "status": "healthy",
        "service": settings.PROJECT_NAME,
        "version": settings.VERSION,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "mode": "PROTOTYPE_SIMULATION",
        "disclaimer": settings.DATA_MODE_DISCLAIMER,
        "components": {
            "api": "online",
            "eta_inference_engine": "online",
            "simulator_stream": "active",
            "database": "configured",
            "redis_cache": "ready"
        }
    }
