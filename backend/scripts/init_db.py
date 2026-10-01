"""
init_db.py – Database initialization script.

Creates all tables defined in SQLAlchemy models if they do not exist.
Usage:
    python backend/scripts/init_db.py
"""

import asyncio
import sys
from pathlib import Path

# Add backend directory to sys.path so 'app' modules can be imported
sys.path.insert(0, str(Path(__file__).parent.parent))

from sqlalchemy.ext.asyncio import create_async_engine
from app.database.models import Base
from app.core.config import settings

async def main():
    print(f"Connecting to database: {settings.DATABASE_URL}")
    try:
        engine = create_async_engine(settings.DATABASE_URL, echo=True, future=True)
        async with engine.begin() as conn:
            print("Creating all tables in PostgreSQL...")
            await conn.run_sync(Base.metadata.create_all)
        await engine.dispose()
        print("✅ Database tables initialized successfully.")
    except Exception as e:
        print(f"❌ Failed to initialize database: {e}")
        print("Note: The application includes graceful fallback to memory mode when PostgreSQL is unavailable.")
        sys.exit(1)

if __name__ == "__main__":
    asyncio.run(main())
