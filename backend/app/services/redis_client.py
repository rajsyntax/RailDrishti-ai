"""
RailDrishti AI – Redis client abstraction.

Provides optional Redis caching with graceful fallback.
If Redis is unavailable, all operations degrade safely to no-ops.
"""

import json
import logging
from typing import Optional, Any, Dict, List
from datetime import datetime, timezone

import redis.asyncio as aioredis

from app.core.config import settings

logger = logging.getLogger(__name__)

REDIS_AVAILABLE: bool = False
_redis_client: Optional[aioredis.Redis] = None


async def init_redis() -> bool:
    """Attempt to connect to Redis. Returns True if successful."""
    global REDIS_AVAILABLE, _redis_client

    if not settings.REDIS_URL:
        logger.warning("REDIS_URL not configured – running without Redis cache.")
        return False

    try:
        _redis_client = aioredis.from_url(
            settings.REDIS_URL,
            encoding="utf-8",
            decode_responses=True,
            socket_connect_timeout=5,
            socket_timeout=5,
        )
        await _redis_client.ping()
        REDIS_AVAILABLE = True
        logger.info("Redis connected successfully.")
        return True
    except Exception as e:
        logger.warning(
            f"Redis unavailable ({type(e).__name__}: {e}). "
            "Continuing without Redis cache."
        )
        REDIS_AVAILABLE = False
        _redis_client = None
        return False


async def close_redis():
    """Close Redis connection on shutdown."""
    global _redis_client
    if _redis_client:
        await _redis_client.close()
        logger.info("Redis connection closed.")


async def cache_train_state(train_id: str, state: Dict[str, Any], ttl: int = 120) -> bool:
    """Cache train live state with TTL."""
    if not REDIS_AVAILABLE or not _redis_client:
        return False
    try:
        key = f"train:{train_id}:live_state"
        await _redis_client.setex(key, ttl, json.dumps(state, default=str))
        return True
    except Exception:
        return False


async def get_cached_train_state(train_id: str) -> Optional[Dict[str, Any]]:
    """Retrieve cached train live state."""
    if not REDIS_AVAILABLE or not _redis_client:
        return None
    try:
        key = f"train:{train_id}:live_state"
        data = await _redis_client.get(key)
        if data:
            return json.loads(data)
    except Exception:
        pass
    return None


async def cache_train_eta(train_id: str, eta_data: Dict[str, Any], ttl: int = 60) -> bool:
    """Cache train ETA data with TTL."""
    if not REDIS_AVAILABLE or not _redis_client:
        return False
    try:
        key = f"train:{train_id}:eta"
        await _redis_client.setex(key, ttl, json.dumps(eta_data, default=str))
        return True
    except Exception:
        return False


async def get_cached_train_eta(train_id: str) -> Optional[Dict[str, Any]]:
    """Retrieve cached train ETA data."""
    if not REDIS_AVAILABLE or not _redis_client:
        return None
    try:
        key = f"train:{train_id}:eta"
        data = await _redis_client.get(key)
        if data:
            return json.loads(data)
    except Exception:
        pass
    return None


async def cache_section_congestion(section_id: str, congestion: Dict[str, Any], ttl: int = 60) -> bool:
    """Cache section congestion data with TTL."""
    if not REDIS_AVAILABLE or not _redis_client:
        return False
    try:
        key = f"section:{section_id}:congestion"
        await _redis_client.setex(key, ttl, json.dumps(congestion, default=str))
        return True
    except Exception:
        return False


async def get_cached_section_congestion(section_id: str) -> Optional[Dict[str, Any]]:
    """Retrieve cached section congestion data."""
    if not REDIS_AVAILABLE or not _redis_client:
        return None
    try:
        key = f"section:{section_id}:congestion"
        data = await _redis_client.get(key)
        if data:
            return json.loads(data)
    except Exception:
        pass
    return None


async def cache_live_alerts(alerts: List[Dict[str, Any]], ttl: int = 120) -> bool:
    """Cache live alerts with TTL."""
    if not REDIS_AVAILABLE or not _redis_client:
        return False
    try:
        key = "alerts:live"
        await _redis_client.setex(key, ttl, json.dumps(alerts, default=str))
        return True
    except Exception:
        return False


async def get_cached_live_alerts() -> Optional[List[Dict[str, Any]]]:
    """Retrieve cached live alerts."""
    if not REDIS_AVAILABLE or not _redis_client:
        return None
    try:
        key = "alerts:live"
        data = await _redis_client.get(key)
        if data:
            return json.loads(data)
    except Exception:
        pass
    return None


async def publish_train_update(channel: str, message: Dict[str, Any]) -> bool:
    """Publish a message to a Redis channel."""
    if not REDIS_AVAILABLE or not _redis_client:
        return False
    try:
        await _redis_client.publish(channel, json.dumps(message, default=str))
        return True
    except Exception:
        return False


def is_redis_available() -> bool:
    """Check if Redis is currently available."""
    return REDIS_AVAILABLE
