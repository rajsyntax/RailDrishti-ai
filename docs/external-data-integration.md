# RailDrishti AI — External Data Integration Guide

## Overview

This document describes how to integrate a third-party train status API with RailDrishti AI. The external feed adapter is provider-agnostic and disabled by default. All external data access happens only in the FastAPI backend — the frontend never makes direct calls to third-party APIs.

---

## What Data Fields Are Needed

The external provider's response must be normalized into RailDrishti's internal train state schema:

```json
{
  "train_id": "string",
  "train_name": "string",
  "timestamp": "ISO 8601",
  "latitude": "float (-90 to 90)",
  "longitude": "float (-180 to 180)",
  "speed_kmph": "float (≥ 0)",
  "heading": "float (0-360)",
  "current_section": "string | null",
  "distance_to_next_station_km": "float (≥ 0)",
  "delay_minutes": "int (≥ 0)",
  "status": "RUNNING | AT_STATION | SIGNAL_HALT | UNSCHEDULED_HALT | COMPLETED",
  "current_station": "string | null",
  "next_station": "string | null",
  "source_type": "THIRD_PARTY_API",
  "source_timestamp": "ISO 8601 | null",
  "data_freshness_seconds": "float"
}
```

---

## Provider Checklist

Before integrating a third-party provider, verify:

- [ ] **Legal Access**: Provider grants explicit API access for your use case
- [ ] **Terms of Service**: Allows real-time data consumption and redistribution
- [ ] **Rate Limits**: Documented and sufficient for your polling frequency (default: 60s)
- [ ] **Coverage**: Provider covers all trains on your corridor (NDLS–MMCT)
- [ ] **Freshness**: Data freshness meets your requirements (< 30s ideal)
- [ ] **Documentation**: Official API documentation with response schema examples
- [ ] **Authentication**: Standard Bearer token or API key in header
- [ ] **Error Codes**: Documented HTTP status codes and error formats
- [ ] **Support**: Provider offers technical support for integration issues

---

## Generic Adapter Configuration

### Environment Variables

```bash
# Enable live data mode
LIVE_DATA_MODE=true

# Provider settings
TRAIN_STATUS_PROVIDER=generic_http
TRAIN_STATUS_API_BASE_URL=https://api.provider.com/v1
TRAIN_STATUS_API_KEY=your_api_key_here
TRAIN_STATUS_AUTH_HEADER=Authorization
TRAIN_STATUS_AUTH_PREFIX=Bearer
TRAIN_STATUS_ENDPOINT_TEMPLATE=/trains/{train_number}/live
TRAIN_STATUS_POLL_SECONDS=60
TRAIN_STATUS_CONNECT_TIMEOUT=10.0
TRAIN_STATUS_READ_TIMEOUT=15.0
TRAIN_STATUS_MAX_RETRIES=3
```

### Customizing the Normalizer

The `normalize()` method in `backend/app/services/external_train_feed.py` **must be customized** to match your provider's official response format. The default implementation assumes a generic structure and performs basic validation.

Example customization:

```python
def normalize(self, raw_data, train_number, journey_date):
    # Example: Provider returns data in a nested structure
    train_data = raw_data.get("data", {}).get("train", {})
    
    normalized = {
        "train_id": str(train_data.get("number", train_number)),
        "train_name": str(train_data.get("name", "")),
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "latitude": self._validate_coordinate(train_data.get("lat"), -90, 90),
        "longitude": self._validate_coordinate(train_data.get("lon"), -180, 180),
        "speed_kmph": self._validate_non_negative(train_data.get("speed")),
        "heading": self._validate_coordinate(train_data.get("bearing"), 0, 360),
        "current_section": train_data.get("current_section"),
        "distance_to_next_station_km": self._validate_non_negative(
            train_data.get("distance_to_next_station")
        ),
        "delay_minutes": int(train_data.get("delay", 0)),
        "status": self._validate_status(train_data.get("status", "RUNNING")),
        "current_station": train_data.get("current_station"),
        "next_station": train_data.get("next_station"),
        "source_type": "THIRD_PARTY_API",
        "source_timestamp": train_data.get("last_update"),
        "data_freshness_seconds": 0.0,
    }
    
    self._validate_normalized(normalized)
    return normalized
```

---

## Security Rules

- **API keys**: Stored in `.env` only — never committed to Git
- **Backend-only access**: Frontend never makes direct calls to third-party APIs
- **Raw payload sanitization**: Raw provider responses are sanitized before storage in `external_feed_raw_events`
- **No credentials in database**: API keys, tokens, and headers are never stored
- **No scraping**: Do not scrape NTES, IRCTC, RailYatri, Where Is My Train, or any website without authorized public API
- **Payload hashing**: Raw payloads are SHA-256 hashed for deduplication

---

## Example Mode Behavior

| Mode | Behavior |
|------|----------|
| `SIMULATOR` | Kinematic simulator only (default) |
| `LIVE_API` | External API only — fails if provider unavailable |
| `HYBRID` | API primary, simulator for demo trains |
| `PRODUCTION_AUTHORIZED` | Placeholder — no implementation |

---

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/v1/external-feed/status` | GET | External feed service status |
| `/api/v1/external-feed/trains/{train_number}/refresh` | POST | Manually refresh train status |

---

## No Frontend API Key Rule

The frontend **never** receives or stores API keys. All external data flows through the backend:

```
Third-Party API → Backend Adapter → Normalization → Redis/PostgreSQL → Frontend (via WebSocket/REST)
```

---

## Production Authorized-Feed Roadmap

| Data Need | Current | Authorized Railway Source |
|-----------|---------|---------------------------|
| GPS / Train Location | Simulated | RTIS / REMMLOT |
| Arrival/Departure Events | Simulated | COA (A/D Events) |
| Timetable | Static CSV | NTES / FOIS |
| Speed Restrictions | Simulated | CRS / Division Registers |
| Weather | Simulated | IMD / Authorized Weather Feed |
| Occupancy / Traffic | Simulated | Train Traffic Control Systems |

---

## Example: Integrating a New Provider

1. **Obtain credentials**: Get API base URL and API key from provider
2. **Update `.env`**: Set `LIVE_DATA_MODE=true` and provider settings
3. **Customize normalizer**: Edit `backend/app/services/external_train_feed.py` `normalize()` method
4. **Test manually**: Use `POST /api/v1/external-feed/trains/{train_number}/refresh`
5. **Enable polling**: Polling starts automatically if `LIVE_DATA_MODE=true`
5. **Monitor**: Check `/api/v1/health` and Admin Analytics for data source status