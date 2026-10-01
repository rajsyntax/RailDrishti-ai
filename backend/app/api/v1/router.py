from fastapi import APIRouter
from app.api.v1 import health, trains, simulation, stations, sections, alerts, analytics

api_router = APIRouter()

# Health router at /api/v1/health
api_router.include_router(health.router, tags=["Health & Status"])

# Trains live tracking at /api/v1/trains
api_router.include_router(trains.router)

# Stations at /api/v1/stations
api_router.include_router(stations.router)

# Rail sections at /api/v1/sections
api_router.include_router(sections.router)

# Alerts at /api/v1/alerts
api_router.include_router(alerts.router)

# Simulation control at /api/v1/simulate
api_router.include_router(simulation.router)

# Analytics & AI Diagnostics at /api/v1/analytics
api_router.include_router(analytics.router)

# NOTE: WebSocket (/ws/live-updates) is mounted at top-level in main.py, NOT here.
# Mounting it here would register it as /api/v1/ws/live-updates (wrong path).


