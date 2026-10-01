"""
RailDrishti AI – Database session and engine management.

Supports graceful fallback: if DATABASE_URL is not set or the database is
unreachable, DB_AVAILABLE is set to False and the app runs in memory-only mode.
All callers should guard with `if DB_AVAILABLE`.
"""

import logging
from typing import Optional, AsyncGenerator

from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy.exc import OperationalError

from app.core.config import settings
from app.database.models import Base

logger = logging.getLogger(__name__)

DB_AVAILABLE: bool = False
_engine = None
_AsyncSession: Optional[async_sessionmaker] = None

def _build_engine():
    """Create async SQLAlchemy engine from settings."""
    return create_async_engine(
        settings.DATABASE_URL,
        echo=False,
        future=True,
        pool_pre_ping=True,        # detect stale connections
        pool_size=5,
        max_overflow=10,
        connect_args={}
    )

async def init_db() -> bool:
    """
    Attempt to connect to the database and create all tables.
    Returns True if successful, False if DB is unavailable (graceful fallback).
    """
    global DB_AVAILABLE, _engine, _AsyncSession

    if not settings.DATABASE_URL or "sqlite" not in settings.DATABASE_URL and "postgresql" not in settings.DATABASE_URL:
        logger.warning("DATABASE_URL not configured – running in memory-only mode.")
        return False

    try:
        _engine = _build_engine()
        # Verify connectivity
        async with _engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)

        _AsyncSession = async_sessionmaker(
            bind=_engine,
            class_=AsyncSession,
            expire_on_commit=False,
            autoflush=False,
            autocommit=False,
        )
        DB_AVAILABLE = True
        logger.info("✅ PostgreSQL connected – all tables verified/created.")
        return True

    except Exception as e:
        logger.warning(
            f"⚠️  Database unavailable ({type(e).__name__}: {e}). "
            "Running in memory-only mode. Start PostgreSQL to persist data."
        )
        DB_AVAILABLE = False
        _engine = None
        _AsyncSession = None
        return False


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """
    FastAPI dependency that yields an async DB session.
    Raises RuntimeError if DB is not available so callers can handle gracefully.
    """
    if not DB_AVAILABLE or _AsyncSession is None:
        raise RuntimeError("Database not available – running in memory-only mode.")
    async with _AsyncSession() as session:
        try:
            yield session
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


async def close_db():
    """Dispose engine on shutdown."""
    global _engine
    if _engine:
        await _engine.dispose()
        logger.info("Database engine disposed.")
