from pydantic_settings import BaseSettings
from typing import List

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

    model_config = {"env_file": ".env", "case_sensitive": True}

settings = Settings()
