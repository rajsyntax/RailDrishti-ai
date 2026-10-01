from pydantic_settings import BaseSettings
from typing import List, Optional

class Settings(BaseSettings):
    PROJECT_NAME: str = "RailDrishti AI"
    VERSION: str = "1.0.0"
    API_V1_STR: str = "/api/v1"
    DESCRIPTION: str = (
        "Real-time, Explainable ETA Prediction and Railway Operations Intelligence Platform "
        "for Indian Railway Coaching Trains (Smart India Hackathon Prototype)"
    )

    # Mode
    PROTOTYPE_MODE: bool = True
    DATA_MODE_DISCLAIMER: str = (
        "Prototype mode — using simulated railway operational data. "
        "Production integration requires authorized Railway feeds."
    )

    # CORS — explicit allowed origins only (no wildcard to avoid client conflicts)
    BACKEND_CORS_ORIGINS: List[str] = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:8000",
        "http://127.0.0.1:8000",
        "http://localhost:80",
        "http://localhost",
    ]

    # Database and Redis
    DATABASE_URL: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/raildrishti"
    REDIS_URL: str = "redis://localhost:6379/0"

    # Data source mode: SIMULATOR | LIVE_API | HYBRID | PRODUCTION_AUTHORIZED
    DATA_SOURCE_MODE: str = "SIMULATOR"

    # External train status provider (generic adapter)
    LIVE_DATA_MODE: bool = False
    TRAIN_STATUS_PROVIDER: str = "generic_http"
    TRAIN_STATUS_API_BASE_URL: str = ""
    TRAIN_STATUS_API_KEY: str = ""
    TRAIN_STATUS_AUTH_HEADER: str = "Authorization"
    TRAIN_STATUS_AUTH_PREFIX: str = "Bearer"
    TRAIN_STATUS_ENDPOINT_TEMPLATE: str = "/trains/{train_number}/live"
    TRAIN_STATUS_POLL_SECONDS: int = 60
    TRAIN_STATUS_CONNECT_TIMEOUT: float = 10.0
    TRAIN_STATUS_READ_TIMEOUT: float = 15.0
    TRAIN_STATUS_MAX_RETRIES: int = 3

    # Weather provider (generic adapter, disabled by default)
    WEATHER_PROVIDER: str = "generic_http"
    WEATHER_API_BASE_URL: str = ""
    WEATHER_API_KEY: str = ""
    WEATHER_ENABLED: bool = False

    # Simulator persistence interval (seconds)
    SIMULATOR_PERSIST_INTERVAL: int = 30

    model_config = {"env_file": ".env", "case_sensitive": True}

settings = Settings()
