"""
generate_historical_data.py
Run once to regenerate data/historical_section_runs.csv and data/weather_events.csv.
Usage: python scripts/generate_historical_data.py
"""

import csv
import random
import uuid
from datetime import date, timedelta, datetime, timezone

random.seed(42)

TRAINS = [
    ("12952", 1), ("12413", 2), ("19020", 3), ("12988", 2), ("12910", 3)
]

SECTIONS = [
    ("SEC_NDLS_MTJ",  95.0,  115.0, 141.0),
    ("SEC_MTJ_BTE",   25.0,   32.0,  34.0),
    ("SEC_BTE_GGC",   75.0,   90.0, 119.0),
    ("SEC_GGC_SWM",   42.0,   52.0,  64.0),
    ("SEC_SWM_KOTA",  65.0,   80.0, 108.0),
    ("SEC_KOTA_RATL", 170.0, 200.0, 266.0),
    ("SEC_RATL_BRC",  165.0, 195.0, 261.0),
    ("SEC_BRC_MMCT",  250.0, 290.0, 392.0),
]

WEATHER_CONDITIONS = ["CLEAR", "CLEAR", "CLEAR", "FOG", "RAIN", "STORM"]
INTENSITIES = {"CLEAR": None, "FOG": "MODERATE", "RAIN": "LIGHT", "STORM": "HEAVY"}

START_DATE = date(2026, 4, 1)
NUM_DAYS = 183  # ~6 months

# ── historical_section_runs ──────────────────────────────────────────────────
hist_rows = []
for day_offset in range(NUM_DAYS):
    run_date = START_DATE + timedelta(days=day_offset)
    dow = run_date.weekday()          # 0=Mon … 6=Sun
    is_weekend = dow >= 5
    
    for (train_id, priority) in TRAINS:
        # Departure hour varies by train
        base_dep_hour = {"12952": 16, "12413": 7, "19020": 23, "12988": 6, "12910": 21}[train_id]

        dep_delay_base = random.randint(0, 5) * (priority - 1)
        
        for (sec_id, median_min, p90_min, dist_km) in SECTIONS:
            weather = random.choice(WEATHER_CONDITIONS)
            restriction = weather == "STORM" or random.random() < 0.03
            congestion = round(random.uniform(0.1, 0.9 if is_weekend else 0.7), 3)
            
            # Realistic actual time: median + noise + weather/restriction penalties
            noise = random.gauss(0, (p90_min - median_min) / 3)
            weather_penalty = {"CLEAR": 0, "FOG": random.uniform(5, 20), "RAIN": random.uniform(3, 12), "STORM": random.uniform(15, 40)}.get(weather, 0)
            restriction_penalty = random.uniform(8, 25) if restriction else 0
            congestion_penalty = congestion * 10 * (priority - 1) * 0.3
            
            actual_min = round(max(median_min * 0.95, median_min + noise + weather_penalty + restriction_penalty + congestion_penalty), 1)
            avg_speed = round((dist_km / actual_min) * 60, 1)
            
            arr_delay = dep_delay_base + round(max(0, actual_min - median_min))
            dep_hour = (base_dep_hour + SECTIONS.index((sec_id, median_min, p90_min, dist_km)) * 2) % 24
            
            hist_rows.append({
                "train_id": train_id,
                "run_date": run_date.isoformat(),
                "section_id": sec_id,
                "scheduled_run_minutes": median_min,
                "actual_run_minutes": actual_min,
                "average_speed_kmph": avg_speed,
                "departure_delay_minutes": dep_delay_base,
                "arrival_delay_minutes": arr_delay,
                "congestion_score": congestion,
                "weather_condition": weather,
                "restriction_active": restriction,
                "day_of_week": dow,
                "hour_of_day": dep_hour,
            })

import os
repo_root = os.path.join(os.path.dirname(__file__), "..", "..")
hist_path = os.path.join(repo_root, "data", "historical_section_runs.csv")
with open(hist_path, "w", newline="") as f:
    writer = csv.DictWriter(f, fieldnames=list(hist_rows[0].keys()))
    writer.writeheader()
    writer.writerows(hist_rows)
print(f"Wrote {len(hist_rows)} rows to historical_section_runs.csv")

# ── weather_events ───────────────────────────────────────────────────────────
STATIONS_LIST = ["NDLS", "MTJ", "BTE", "GGC", "SWM", "KOTA", "RATL", "BRC", "MMCT"]
weather_rows = []
for day_offset in range(NUM_DAYS):
    event_date = START_DATE + timedelta(days=day_offset)
    # ~30% chance of a weather event on any given day
    if random.random() < 0.30:
        station = random.choice(STATIONS_LIST)
        cond = random.choice(["FOG", "RAIN", "STORM"])
        intensity = INTENSITIES.get(cond, "MODERATE")
        started = datetime(event_date.year, event_date.month, event_date.day,
                           random.randint(0, 22), 0, tzinfo=timezone.utc)
        duration_h = random.randint(1, 8)
        ended = started + timedelta(hours=duration_h)
        weather_rows.append({
            "event_id": str(uuid.uuid4()),
            "station_code": station,
            "condition": cond,
            "intensity": intensity,
            "visibility_m": random.randint(100, 2000) if cond == "FOG" else random.randint(2000, 10000),
            "wind_kmph": round(random.uniform(5, 80), 1),
            "temp_celsius": round(random.uniform(10, 42), 1),
            "started_at": started.isoformat(),
            "ended_at": ended.isoformat(),
            "is_active": False,
            "description": f"{intensity} {cond.lower()} near {station} lasting ~{duration_h}h",
        })

weather_path = os.path.join(repo_root, "data", "weather_events.csv")
with open(weather_path, "w", newline="") as f:
    writer = csv.DictWriter(f, fieldnames=list(weather_rows[0].keys()))
    writer.writeheader()
    writer.writerows(weather_rows)
print(f"Wrote {len(weather_rows)} rows to weather_events.csv")
