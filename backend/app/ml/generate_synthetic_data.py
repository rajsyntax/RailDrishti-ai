"""
RailDrishti AI - Synthetic Historical Section Run Data Generator
Generates realistic sectional train running data based on physics, track geometry,
corridor traffic congestion, operational disruptions, and weather effects.
"""

import os
import random
import numpy as np
import pandas as pd
from typing import Optional

# Corridor sections metadata
CORRIDOR_SECTIONS = [
    {"section_id": "SEC_NDLS_MTJ", "distance_km": 141.0, "max_speed_kmph": 110, "historical_median_min": 95},
    {"section_id": "SEC_MTJ_BTE",  "distance_km": 34.0,  "max_speed_kmph": 100, "historical_median_min": 25},
    {"section_id": "SEC_BTE_GGC",  "distance_km": 119.0, "max_speed_kmph": 110, "historical_median_min": 75},
    {"section_id": "SEC_GGC_SWM",  "distance_km": 64.0,  "max_speed_kmph": 110, "historical_median_min": 42},
    {"section_id": "SEC_SWM_KOTA", "distance_km": 108.0, "max_speed_kmph": 120, "historical_median_min": 65},
    {"section_id": "SEC_KOTA_RATL", "distance_km": 266.0, "max_speed_kmph": 110, "historical_median_min": 170},
    {"section_id": "SEC_RATL_BRC", "distance_km": 261.0, "max_speed_kmph": 110, "historical_median_min": 165},
    {"section_id": "SEC_BRC_MMCT", "distance_km": 392.0, "max_speed_kmph": 120, "historical_median_min": 250},
]

TRAIN_CATEGORIES = [
    {"category": "Rajdhani Express", "priority": 1, "avg_speed_factor": 1.05, "recovery_headroom": 8.0},
    {"category": "Superfast Express", "priority": 2, "avg_speed_factor": 0.98, "recovery_headroom": 5.0},
    {"category": "Express",           "priority": 3, "avg_speed_factor": 0.90, "recovery_headroom": 3.0},
    {"category": "Mail Express",      "priority": 3, "avg_speed_factor": 0.88, "recovery_headroom": 3.0},
]


def generate_synthetic_historical_dataset(
    num_samples: int = 6000,
    random_seed: int = 42,
    output_path: Optional[str] = None
) -> pd.DataFrame:
    """
    Generate synthetic historical train sectional observations.
    Each sample represents a train snapshot midway or beginning a section,
    with operational factors and true remaining time to the destination station.
    """
    np.random.seed(random_seed)
    random.seed(random_seed)

    records = []

    for _ in range(num_samples):
        # Pick section and train category
        section = random.choice(CORRIDOR_SECTIONS)
        category_meta = random.choice(TRAIN_CATEGORIES)

        total_sec_distance = section["distance_km"]
        hist_median = section["historical_median_min"]
        max_speed = section["max_speed_kmph"]

        # Random progress through the section (distance remaining: 5 km to full section distance)
        progress_ratio = np.random.beta(2, 2)  # Centered around middle
        distance_remaining_km = round(max(4.0, total_sec_distance * progress_ratio), 1)

        # Operational features
        hour = random.randint(0, 23)
        day_of_week = random.randint(0, 6)

        # Peak hours (08-11 and 17-21) increase congestion
        is_peak = (8 <= hour <= 11) or (17 <= hour <= 21)
        base_congestion = np.random.uniform(0.35, 0.85) if is_peak else np.random.uniform(0.1, 0.5)
        congestion_score = round(float(np.clip(base_congestion, 0.0, 1.0)), 2)

        trains_ahead = np.random.choice([0, 1, 2, 3, 4], p=[0.45, 0.30, 0.15, 0.07, 0.03])
        restriction_active = 1 if np.random.random() < 0.18 else 0
        weather_severity = round(float(np.random.choice([0.0, 0.1, 0.3, 0.6, 0.9], p=[0.60, 0.20, 0.10, 0.07, 0.03])), 2)

        # Speed and halts
        if restriction_active:
            target_speed = np.random.uniform(25, 45)
        elif congestion_score > 0.7 or trains_ahead >= 2:
            target_speed = np.random.uniform(40, max_speed * 0.75)
        else:
            target_speed = np.random.uniform(max_speed * 0.80, max_speed * category_meta["avg_speed_factor"])

        current_speed_kmph = round(float(np.clip(target_speed + np.random.normal(0, 5), 15, 130)), 1)
        
        # Halt probability
        has_halt = np.random.random() < (0.12 if trains_ahead > 0 else 0.04)
        unscheduled_halt_minutes = round(float(np.random.exponential(12.0) if has_halt else 0.0), 1)
        if unscheduled_halt_minutes > 0 and np.random.random() < 0.3:
            current_speed_kmph = 0.0  # Train currently stationary at signal/outer

        current_delay_minutes = round(float(max(-2.0, np.random.exponential(8.0) + (10 if has_halt else 0))), 1)
        scheduled_recovery_margin = round(float(np.random.uniform(1.0, category_meta["recovery_headroom"])), 1)
        gps_freshness_seconds = round(float(np.random.exponential(15.0)), 1)

        # Ground truth calculation: physics-based time + stochastic delay propagation
        # Nominal running speed accounting for upcoming track constraints
        effective_speed = max(25.0, current_speed_kmph if current_speed_kmph > 20 else max_speed * 0.7)
        nominal_running_minutes = (distance_remaining_km / effective_speed) * 60.0

        # Penalties and adjustments
        congestion_penalty = congestion_score * (8.0 + trains_ahead * 4.0) * (distance_remaining_km / total_sec_distance)
        weather_penalty = weather_severity * 9.0 * (distance_remaining_km / total_sec_distance)
        restriction_penalty = (restriction_active * 6.0) if distance_remaining_km > 10 else 0.0
        recovery_benefit = min(scheduled_recovery_margin, nominal_running_minutes * 0.12)

        noise = np.random.normal(0, 1.8)

        remaining_time_minutes = (
            nominal_running_minutes
            + unscheduled_halt_minutes
            + congestion_penalty
            + weather_penalty
            + restriction_penalty
            - recovery_benefit
            + noise
        )

        remaining_time_minutes = max(3.0, round(float(remaining_time_minutes), 1))

        records.append({
            "current_speed_kmph": current_speed_kmph,
            "distance_to_next_station_km": distance_remaining_km,
            "current_delay_minutes": current_delay_minutes,
            "historical_section_median_minutes": hist_median,
            "hour_of_day": hour,
            "day_of_week": day_of_week,
            "congestion_score": congestion_score,
            "trains_ahead": int(trains_ahead),
            "restriction_active": int(restriction_active),
            "weather_severity": weather_severity,
            "unscheduled_halt_minutes": unscheduled_halt_minutes,
            "scheduled_recovery_margin": scheduled_recovery_margin,
            "gps_freshness_seconds": gps_freshness_seconds,
            "section_id": section["section_id"],
            "train_category": category_meta["category"],
            "remaining_time_to_next_station_minutes": remaining_time_minutes
        })

    df = pd.DataFrame(records)

    if output_path:
        os.makedirs(os.path.dirname(os.path.abspath(output_path)), exist_ok=True)
        df.to_csv(output_path, index=False, encoding="utf-8")
        print(f"[generate_synthetic_data] Saved {len(df)} samples to {os.path.basename(output_path)}")

    return df


if __name__ == "__main__":
    current_dir = os.path.dirname(os.path.abspath(__file__))
    out_csv = os.path.join(current_dir, "synthetic_historical_runs.csv")
    generate_synthetic_historical_dataset(num_samples=8000, output_path=out_csv)
