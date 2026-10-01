"""
seed_db.py – Load corridor reference data into PostgreSQL.

Usage:
    # From repo root, with venv activated and PostgreSQL running:
    python backend/scripts/seed_db.py

    # Reset mode (clears existing data before seeding):
    python backend/scripts/seed_db.py --reset

This script:
  1. Creates all tables (if they don't already exist).
  2. Loads stations, trains, rail_sections, train_schedule from CSV files in data/.
  3. Loads historical_section_runs and weather_events from CSV files.
  4. Is idempotent – skips rows that already exist (by PK).
"""

import asyncio
import csv
import os
import sys
import uuid
from pathlib import Path

# Allow imports from backend/app
sys.path.insert(0, str(Path(__file__).parent.parent))

from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy import text

from app.database.models import (
    Base, StationModel, TrainModel, RailSectionModel,
    TrainScheduleModel, HistoricalSectionRunModel, WeatherEventModel
)
from app.core.config import settings

DATA_DIR = Path(__file__).parent.parent.parent / "data"


def _read_csv(filename: str) -> list[dict]:
    path = DATA_DIR / filename
    with open(path, newline="", encoding="utf-8") as f:
        return list(csv.DictReader(f))


async def seed(session: AsyncSession):
    # ── stations ─────────────────────────────────────────────────────────────
    print("Seeding stations...")
    for row in _read_csv("stations.csv"):
        stmt = pg_insert(StationModel).values(
            station_code=row["station_code"],
            station_name=row["station_name"],
            latitude=float(row["latitude"]),
            longitude=float(row["longitude"]),
            zone=row["zone"],
            division=row["division"],
            platform_count=int(row["platform_count"]),
        ).on_conflict_do_nothing(index_elements=["station_code"])
        await session.execute(stmt)

    # ── trains ───────────────────────────────────────────────────────────────
    print("Seeding trains...")
    for row in _read_csv("trains.csv"):
        stmt = pg_insert(TrainModel).values(
            train_id=row["train_id"],
            train_name=row["train_name"],
            category=row["category"],
            priority=int(row["priority"]),
            source_station=row["source_station"],
            destination_station=row["destination_station"],
            total_distance_km=float(row["total_distance_km"]),
            rake_type=row["rake_type"],
            is_active=True,
        ).on_conflict_do_nothing(index_elements=["train_id"])
        await session.execute(stmt)

    # ── rail_sections ─────────────────────────────────────────────────────────
    print("Seeding rail sections...")
    for row in _read_csv("rail_sections.csv"):
        stmt = pg_insert(RailSectionModel).values(
            section_id=row["section_id"],
            from_station=row["from_station"],
            to_station=row["to_station"],
            distance_km=float(row["distance_km"]),
            normal_speed_kmph=float(row["normal_speed_kmph"]),
            capacity_score=float(row["capacity_score"]),
            historical_median_minutes=float(row["historical_median_minutes"]),
            historical_p90_minutes=float(row["historical_p90_minutes"]),
        ).on_conflict_do_nothing(index_elements=["section_id"])
        await session.execute(stmt)

    # ── train_schedule ─────────────────────────────────────────────────────────
    print("Seeding train schedules...")
    for row in _read_csv("train_schedule.csv"):
        stmt = pg_insert(TrainScheduleModel).values(
            id=str(uuid.uuid4()),
            train_id=row["train_id"],
            station_code=row["station_code"],
            sequence_number=int(row["sequence_number"]),
            scheduled_arrival=row["scheduled_arrival"] or None,
            scheduled_departure=row["scheduled_departure"] or None,
            day_offset=int(row["day_offset"]),
            distance_from_source=float(row["distance_from_source"]),
            halt_minutes=int(row["halt_minutes"]),
        ).on_conflict_do_nothing()
        await session.execute(stmt)

    # ── historical_section_runs ───────────────────────────────────────────────
    print("Seeding historical section runs (7320 rows)...")
    batch, batch_size = [], 500
    for row in _read_csv("historical_section_runs.csv"):
        batch.append({
            "id": str(uuid.uuid4()),
            "train_id": row["train_id"],
            "section_id": row["section_id"],
            "run_date": row["run_date"],
            "scheduled_run_minutes": float(row["scheduled_run_minutes"]),
            "actual_run_minutes": float(row["actual_run_minutes"]),
            "average_speed_kmph": float(row["average_speed_kmph"]),
            "departure_delay_min": int(row["departure_delay_minutes"]),
            "arrival_delay_min": int(row["arrival_delay_minutes"]),
            "congestion_score": float(row["congestion_score"]),
            "weather_condition": row["weather_condition"],
            "restriction_active": row["restriction_active"].lower() == "true",
            "day_of_week": int(row["day_of_week"]),
            "hour_of_day": int(row["hour_of_day"]),
        })
        if len(batch) >= batch_size:
            await session.execute(pg_insert(HistoricalSectionRunModel).values(batch).on_conflict_do_nothing())
            batch.clear()
    if batch:
        await session.execute(pg_insert(HistoricalSectionRunModel).values(batch).on_conflict_do_nothing())

    # ── weather_events ─────────────────────────────────────────────────────────
    print("Seeding weather events...")
    for row in _read_csv("weather_events.csv"):
        stmt = pg_insert(WeatherEventModel).values(
            event_id=row["event_id"],
            station_code=row["station_code"],
            condition=row["condition"],
            intensity=row["intensity"] or None,
            visibility_m=int(row["visibility_m"]) if row["visibility_m"] else None,
            wind_kmph=float(row["wind_kmph"]) if row["wind_kmph"] else None,
            temp_celsius=float(row["temp_celsius"]) if row["temp_celsius"] else None,
            started_at=row["started_at"],
            ended_at=row["ended_at"] or None,
            is_active=row["is_active"].lower() == "true",
            description=row["description"],
        ).on_conflict_do_nothing(index_elements=["event_id"])
        await session.execute(stmt)

    await session.commit()
    print("Seed complete.")


async def main():
    reset = "--reset" in sys.argv

    if reset:
        print("=" * 60)
        print("WARNING: --reset mode enabled.")
        print("This will DELETE all existing data before re-seeding.")
        print("This action is NOT recommended for production databases.")
        print("=" * 60)
        confirm = input("Type 'yes' to confirm reset: ")
        if confirm.strip().lower() != "yes":
            print("Reset cancelled.")
            return

    print(f"Connecting to: {settings.DATABASE_URL}")
    engine = create_async_engine(settings.DATABASE_URL, echo=False, future=True)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    if reset:
        print("Clearing existing data...")
        async with engine.begin() as conn:
            for table in reversed(Base.metadata.sorted_tables):
                await conn.execute(text(f"TRUNCATE TABLE {table.name} CASCADE"))
        print("All tables cleared.")

    SessionLocal = async_sessionmaker(bind=engine, class_=AsyncSession, expire_on_commit=False)
    async with SessionLocal() as session:
        await seed(session)
    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(main())
