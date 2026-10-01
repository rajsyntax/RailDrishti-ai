"""
RailDrishti AI – Data Source Manager.

Manages the active data source mode and provides a unified interface
for switching between SIMULATOR, LIVE_API, HYBRID, and PRODUCTION_AUTHORIZED modes.
"""

import logging
from enum import Enum
from typing import Dict, Any, Optional
from datetime import datetime, timezone

from app.core.config import settings

logger = logging.getLogger(__name__)


class DataSourceMode(str, Enum):
    SIMULATOR = "SIMULATOR"
    LIVE_API = "LIVE_API"
    HYBRID = "HYBRID"
    PRODUCTION_AUTHORIZED = "PRODUCTION_AUTHORIZED"


class DataSourceManager:
    """
    Manages the active data source for train status information.

    Modes:
    - SIMULATOR: Use only the kinematic simulator (default for demo)
    - LIVE_API: Use only external third-party API data
    - HYBRID: Use API data when available, simulator for demo trains
    - PRODUCTION_AUTHORIZED: Placeholder for authorized Railway feeds
    """

    def __init__(self):
        self._mode = DataSourceMode.SIMULATOR
        self._active_source = "kinematic_simulator"
        self._last_external_fetch: Optional[datetime] = None
        self._last_external_error: Optional[str] = None
        self._external_fetch_count: int = 0
        self._external_error_count: int = 0

    @property
    def mode(self) -> DataSourceMode:
        return self._mode

    @property
    def active_source(self) -> str:
        return self._active_source

    def set_mode(self, mode: DataSourceMode) -> bool:
        """
        Switch data source mode. Returns True if the switch was successful.
        """
        if mode == DataSourceMode.LIVE_API:
            if not settings.LIVE_DATA_MODE:
                logger.warning(
                    "Cannot switch to LIVE_API: LIVE_DATA_MODE is disabled. "
                    "Set LIVE_DATA_MODE=true and configure provider settings."
                )
                return False
            if not settings.TRAIN_STATUS_API_BASE_URL:
                logger.warning(
                    "Cannot switch to LIVE_API: TRAIN_STATUS_API_BASE_URL is not configured."
                )
                return False

        if mode == DataSourceMode.PRODUCTION_AUTHORIZED:
            logger.warning(
                "PRODUCTION_AUTHORIZED mode requires authorized Railway feeds. "
                "This is a placeholder — no implementation available."
            )
            return False

        self._mode = mode
        self._active_source = self._resolve_source_name(mode)
        logger.info(f"Data source mode switched to: {mode.value} (source: {self._active_source})")
        return True

    def _resolve_source_name(self, mode: DataSourceMode) -> str:
        if mode == DataSourceMode.SIMULATOR:
            return "kinematic_simulator"
        elif mode == DataSourceMode.LIVE_API:
            return settings.TRAIN_STATUS_PROVIDER
        elif mode == DataSourceMode.HYBRID:
            return "hybrid_api_with_simulator_fallback"
        elif mode == DataSourceMode.PRODUCTION_AUTHORIZED:
            return "authorized_railway_feed"
        return "unknown"

    def record_external_fetch(self):
        """Record a successful external data fetch."""
        self._last_external_fetch = datetime.now(timezone.utc)
        self._external_fetch_count += 1

    def record_external_error(self, error_summary: str):
        """Record an external data fetch error (no secret leakage)."""
        self._last_external_error = error_summary
        self._external_error_count += 1

    def get_status(self) -> Dict[str, Any]:
        """Return current data source status for health API and UI."""
        return {
            "mode": self._mode.value,
            "active_source": self._active_source,
            "last_external_fetch": self._last_external_fetch.isoformat() if self._last_external_fetch else None,
            "last_external_error": self._last_external_error,
            "external_fetch_count": self._external_fetch_count,
            "external_error_count": self._external_error_count,
            "source_freshness_seconds": self._compute_freshness(),
        }

    def _compute_freshness(self) -> Optional[float]:
        """Compute seconds since last successful external fetch."""
        if not self._last_external_fetch:
            return None
        delta = datetime.now(timezone.utc) - self._last_external_fetch
        return round(delta.total_seconds(), 1)

    def should_use_simulator(self) -> bool:
        """Check if simulator should be used for data."""
        return self._mode in (DataSourceMode.SIMULATOR, DataSourceMode.HYBRID)

    def should_use_external_api(self) -> bool:
        """Check if external API should be used for data."""
        return self._mode in (DataSourceMode.LIVE_API, DataSourceMode.HYBRID)


# Global singleton
data_source_manager = DataSourceManager()
