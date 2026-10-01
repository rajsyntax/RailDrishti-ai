"""
RailDrishti AI – Generic External Train Status Provider.

Provider-agnostic adapter for fetching live train status from third-party APIs.
Disabled by default. Requires LIVE_DATA_MODE=true and provider configuration.

Security rules:
- API keys are read from environment variables only
- API keys are never logged or returned in responses
- Raw payloads are sanitized before storage
- No credentials are stored in the database
"""

import asyncio
import hashlib
import logging
from abc import ABC, abstractmethod
from datetime import datetime, timezone
from typing import Dict, Any, Optional

import httpx

from app.core.config import settings
from app.services.data_source_manager import data_source_manager

logger = logging.getLogger(__name__)


class TrainStatusProvider(ABC):
    """Abstract interface for train status providers."""

    @abstractmethod
    async def get_live_status(
        self,
        train_number: str,
        journey_date: str,
    ) -> Dict[str, Any]:
        """Fetch live status for a train. Returns normalized internal schema."""
        raise NotImplementedError


class GenericHttpTrainStatusProvider(TrainStatusProvider):
    """
    Generic HTTP-based train status provider.

    Reads configuration from environment variables:
    - TRAIN_STATUS_API_BASE_URL
    - TRAIN_STATUS_API_KEY
    - TRAIN_STATUS_AUTH_HEADER
    - TRAIN_STATUS_AUTH_PREFIX
    - TRAIN_STATUS_ENDPOINT_TEMPLATE

    The normalize() method must be customized to match the provider's
    official response format.
    """

    def __init__(self):
        self._client: Optional[httpx.AsyncClient] = None
        self._lock = asyncio.Lock()

    async def _get_client(self) -> httpx.AsyncClient:
        """Get or create the HTTP client."""
        if self._client is None:
            self._client = httpx.AsyncClient(
                timeout=httpx.Timeout(
                    connect=settings.TRAIN_STATUS_CONNECT_TIMEOUT,
                    read=settings.TRAIN_STATUS_READ_TIMEOUT,
                ),
                headers={
                    "Accept": "application/json",
                    "User-Agent": "RailDrishti-AI/1.0",
                },
            )
        return self._client

    async def close(self):
        """Close the HTTP client."""
        if self._client:
            await self._client.aclose()
            self._client = None

    def _build_url(self, train_number: str) -> str:
        """Build the request URL from the endpoint template."""
        base = settings.TRAIN_STATUS_API_BASE_URL.rstrip("/")
        template = settings.TRAIN_STATUS_ENDPOINT_TEMPLATE
        path = template.format(train_number=train_number)
        return f"{base}{path}"

    def _build_headers(self) -> Dict[str, str]:
        """Build request headers with authentication."""
        headers = {}
        if settings.TRAIN_STATUS_API_KEY:
            prefix = settings.TRAIN_STATUS_AUTH_PREFIX
            key = settings.TRAIN_STATUS_API_KEY
            headers[settings.TRAIN_STATUS_AUTH_HEADER] = f"{prefix} {key}".strip()
        return headers

    async def get_live_status(
        self,
        train_number: str,
        journey_date: str,
    ) -> Dict[str, Any]:
        """
        Fetch live status for a train from the external provider.
        Returns normalized internal schema.
        """
        if not settings.LIVE_DATA_MODE:
            raise ProviderError("Live data mode is disabled. Set LIVE_DATA_MODE=true to enable.")

        if not settings.TRAIN_STATUS_API_BASE_URL:
            raise ProviderError("TRAIN_STATUS_API_BASE_URL is not configured.")

        if not settings.TRAIN_STATUS_API_KEY:
            raise ProviderError("TRAIN_STATUS_API_KEY is not configured.")

        url = self._build_url(train_number)
        headers = self._build_headers()

        last_error = None
        for attempt in range(settings.TRAIN_STATUS_MAX_RETRIES):
            try:
                client = await self._get_client()
                response = await client.get(url, headers=headers, params={"journey_date": journey_date})
                response.raise_for_status()

                raw_data = response.json()
                normalized = self.normalize(raw_data, train_number, journey_date)

                data_source_manager.record_external_fetch()
                return normalized

            except httpx.HTTPStatusError as e:
                last_error = f"HTTP {e.response.status_code}"
                logger.warning(f"Provider fetch failed (attempt {attempt + 1}): {last_error}")
            except httpx.RequestError as e:
                last_error = f"Request error: {type(e).__name__}"
                logger.warning(f"Provider fetch failed (attempt {attempt + 1}): {last_error}")
            except Exception as e:
                last_error = f"Unexpected error: {type(e).__name__}"
                logger.warning(f"Provider fetch failed (attempt {attempt + 1}): {last_error}")

            if attempt < settings.TRAIN_STATUS_MAX_RETRIES - 1:
                wait = 2 ** attempt
                await asyncio.sleep(wait)

        error_msg = f"Provider fetch failed after {settings.TRAIN_STATUS_MAX_RETRIES} attempts: {last_error}"
        data_source_manager.record_external_error(error_msg)
        raise ProviderError(error_msg)

    def normalize(
        self,
        raw_data: Dict[str, Any],
        train_number: str,
        journey_date: str,
    ) -> Dict[str, Any]:
        """
        Normalize a generic provider response into RailDrishti's internal schema.

        IMPORTANT: This method must be customized to match the provider's
        official response format. The default implementation assumes a
        generic structure and performs basic validation.

        Expected internal schema:
        {
            "train_id": str,
            "train_name": str,
            "timestamp": str (ISO format),
            "latitude": float,
            "longitude": float,
            "speed_kmph": float,
            "heading": float,
            "current_section": str | None,
            "distance_to_next_station_km": float,
            "delay_minutes": int,
            "status": str,
            "current_station": str | None,
            "next_station": str | None,
            "source_type": "THIRD_PARTY_API",
            "source_timestamp": str,
            "data_freshness_seconds": float,
        }
        """
        # Default normalization — customize this for your provider
        normalized = {
            "train_id": str(raw_data.get("train_number", train_number)),
            "train_name": str(raw_data.get("train_name", "")),
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "latitude": self._validate_coordinate(raw_data.get("latitude"), -90, 90),
            "longitude": self._validate_coordinate(raw_data.get("longitude"), -180, 180),
            "speed_kmph": self._validate_non_negative(raw_data.get("speed_kmph", 0)),
            "heading": self._validate_coordinate(raw_data.get("heading"), 0, 360),
            "current_section": raw_data.get("current_section"),
            "distance_to_next_station_km": self._validate_non_negative(
                raw_data.get("distance_to_next_station_km", 0)
            ),
            "delay_minutes": int(raw_data.get("delay_minutes", 0)),
            "status": self._validate_status(raw_data.get("status", "RUNNING")),
            "current_station": raw_data.get("current_station"),
            "next_station": raw_data.get("next_station"),
            "source_type": "THIRD_PARTY_API",
            "source_timestamp": raw_data.get("timestamp"),
            "data_freshness_seconds": 0.0,
        }

        self._validate_normalized(normalized)
        return normalized

    def _validate_normalized(self, data: Dict[str, Any]):
        """Validate normalized data. Raises ProviderError if invalid."""
        if not data.get("train_id"):
            raise ProviderError("Provider response missing train_id")
        if data["latitude"] is None or data["longitude"] is None:
            raise ProviderError("Provider response missing valid coordinates")
        if data["speed_kmph"] < 0:
            raise ProviderError("Provider response has negative speed")

    @staticmethod
    def _validate_coordinate(value: Any, min_val: float, max_val: float) -> Optional[float]:
        """Validate a coordinate value."""
        if value is None:
            return None
        try:
            val = float(value)
            if min_val <= val <= max_val:
                return round(val, 5)
        except (TypeError, ValueError):
            pass
        return None

    @staticmethod
    def _validate_non_negative(value: Any) -> float:
        """Validate a non-negative numeric value."""
        try:
            val = float(value)
            return max(0.0, val)
        except (TypeError, ValueError):
            return 0.0

    @staticmethod
    def _validate_status(value: Any) -> str:
        """Validate train status."""
        valid_statuses = {"RUNNING", "AT_STATION", "SIGNAL_HALT", "UNSCHEDULED_HALT", "COMPLETED"}
        status = str(value).upper() if value else "RUNNING"
        return status if status in valid_statuses else "RUNNING"

    @staticmethod
    def compute_payload_hash(raw_data: Dict[str, Any]) -> str:
        """Compute a hash of the raw payload for deduplication."""
        import json
        payload_str = json.dumps(raw_data, sort_keys=True, default=str)
        return hashlib.sha256(payload_str.encode()).hexdigest()


class ProviderError(Exception):
    """Raised when a provider operation fails."""
    pass


# Global provider instance
generic_http_provider = GenericHttpTrainStatusProvider()
