import asyncio
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.api.v1.router import api_router
from app.api.v1.websocket import router as ws_router
from app.services.simulator import run_simulation_loop
from app.database.session import init_db, close_db

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s – %(message)s")
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Startup:
      1. Attempt PostgreSQL init (non-blocking – continues on failure).
      2. Launch the train simulator as a background task.
    Shutdown:
      1. Cancel simulator task.
      2. Dispose DB engine.
    """
    # DB init (graceful fallback if unavailable)
    await init_db()

    # Start simulator in background – does NOT block requests
    sim_task = asyncio.create_task(run_simulation_loop(), name="train_simulator")
    logger.info("Train simulator background task started.")

    yield  # app is running

    # Clean shutdown
    sim_task.cancel()
    try:
        await sim_task
    except asyncio.CancelledError:
        pass

    await close_db()
    logger.info("RailDrishti AI shutdown complete.")


app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    description=(
        f"{settings.DESCRIPTION}\n\n"
        f"**Notice:** {settings.DATA_MODE_DISCLAIMER}"
    ),
    openapi_url=f"{settings.API_V1_STR}/openapi.json",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)

# ── CORS ─────────────────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.BACKEND_CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Routers ───────────────────────────────────────────────────────────────────
# REST APIs under /api/v1
app.include_router(api_router, prefix=settings.API_V1_STR)

# WebSocket at /ws/live-updates (top-level, outside /api/v1 prefix)
app.include_router(ws_router)


@app.get("/", summary="Root Welcome & Metadata")
async def root():
    from app.database.session import DB_AVAILABLE
    return {
        "message": f"Welcome to {settings.PROJECT_NAME} API",
        "version": settings.VERSION,
        "docs_url": "/docs",
        "health_endpoint": f"{settings.API_V1_STR}/health",
        "websocket_endpoint": "/ws/live-updates",
        "database_mode": "postgresql" if DB_AVAILABLE else "memory-only",
        "disclaimer": settings.DATA_MODE_DISCLAIMER,
    }
