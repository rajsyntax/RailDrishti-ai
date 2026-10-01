"""
RailDrishti AI – Weather Provider Adapter.

Provider-agnostic weather data adapter. Disabled by default.
Existing synthetic weather simulation remains the default.
"""

import logging
from abc import ABC, abstractmethod
from datetime import datetime, timezone
from typing import Dict, Any, Optional

import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)


class WeatherProvider(ABC):
    """Abstract interface for weather data providers."""

    @abstractmethod
    async def get_weather(
        self,
        latitude: float,
        longitude: float,
    ) -> Dict[str, Any]:
        """Fetch weather data for a location. Returns normalized internal schema."""
        raise NotImplementedError


class GenericHttpWeatherProvider(WeatherProvider):
    """
    Generic HTTP-based weather provider.

    Reads configuration from environment variables:
    - WEATHER_API_BASE_URL
    - WEATHER_API_KEY

    The normalize() method must be customized to match the provider's
    official response format.
    """

    def __init__(self):
        self._client: Optional[httpx.AsyncClient] = None

    async def _get_client(self) -> httpx.AsyncClient:
        if self._client is None:
            self._client = httpx.AsyncClient(
                timeout=httpx.Timeout(connect=10.0, read=15.0),
                headers={
                    "Accept": "application/json",
                    "User-Agent": "RailDrishti-AI/1.0",
                },
            )
        return self._client

    async def close(self):
        if self._client:
            await self._client.aclose()
            self._client = None

    async def get_weather(
        self,
        latitude: float,
        longitude: float,
    ) -> Dict[str, Any]:
        """Fetch weather data from the external provider."""
        if not settings.WEATHER_ENABLED:
            raise WeatherError("Weather provider is disabled. Set WEATHER_ENABLED=true to enable.")

        if not settings.WEATHER_API_BASE_URL:
            raise WeatherError("WEATHER_API_BASE_URL is not configured.")

        url = settings.WEATHER_API_BASE_URL.rstrip("/")
        headers = {}
        if settings.WEATHER_API_KEY:
            headers["Authorization"] = f"Bearer {settings.WEATHER_API_KEY}"

        try:
            client = await self._get_client()
            response = await client.get(
                url,
                headers=headers,
                params={"lat": latitude, "lon": longitude},
            )
            response.raise_for_status()
            raw_data = response.json()
            return self.normalize(raw_data, latitude, longitude)

        except httpx.HTTPStatusError as e:
            raise WeatherError(f"HTTP {e.response.status_code}")
        except httpx.RequestError as e:
            raise WeatherError(f"Request error: {type(e).__name__}")
        except Exception as e:
            raise WeatherError(f"Unexpected error: {type(e).__name__}")

    def normalize(
        self,
        raw_data: Dict[str, Any],
        latitude: float,
        longitude: float,
    ) -> Dict[str, Any]:
        """
        Normalize a generic weather provider response into RailDrishti's internal schema.

        IMPORTANT: Customize this method to match the provider's official response format.
        """
        return {
            "location_reference": f"{latitude},{longitude}",
            "event_time": datetime.now(timezone.utc).isoformat(),
            "weather_condition": str(raw_data.get("condition", "CLEAR")).upper(),
            "rain_intensity": raw_data.get("rain_intensity"),
            "visibility_km": raw_data.get("visibility_km"),
            "severity": raw_data.get("severity", "LOW"),
            "source_type": "THIRD_PARTY_API",
        }


class WeatherError(Exception):
    """Raised when a weather provider operation fails."""
    pass


# Global provider instance
generic_http_weather_provider = GenericHttpWeatherProvider()
