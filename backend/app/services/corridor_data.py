from typing import Dict, List
from app.models.schemas import Station, Section, TrainMeta

# Realistic simulated railway corridor stations (NDLS to MMCT)
STATIONS: Dict[str, Station] = {
    "NDLS": Station(code="NDLS", name="New Delhi", latitude=28.6430, longitude=77.2194, sequence=1),
    "MTJ": Station(code="MTJ", name="Mathura Junction", latitude=27.4924, longitude=77.6737, sequence=2),
    "BTE": Station(code="BTE", name="Bharatpur Junction", latitude=27.2152, longitude=77.4930, sequence=3),
    "GGC": Station(code="GGC", name="Gangapur City", latitude=26.4714, longitude=76.7196, sequence=4),
    "SWM": Station(code="SWM", name="Sawai Madhopur Junction", latitude=25.9934, longitude=76.3688, sequence=5),
    "KOTA": Station(code="KOTA", name="Kota Junction", latitude=25.2138, longitude=75.8648, sequence=6),
    "RATL": Station(code="RATL", name="Ratlam Junction", latitude=23.3441, longitude=75.0360, sequence=7),
    "BRC": Station(code="BRC", name="Vadodara Junction", latitude=22.3107, longitude=73.1926, sequence=8),
    "MMCT": Station(code="MMCT", name="Mumbai Central", latitude=18.9696, longitude=72.8193, sequence=9),
}

STATION_ORDER: List[str] = ["NDLS", "MTJ", "BTE", "GGC", "SWM", "KOTA", "RATL", "BRC", "MMCT"]

# Synthetic route / section data connecting sequential stations
SECTIONS: Dict[str, Section] = {
    "SEC_NDLS_MTJ": Section(
        section_id="SEC_NDLS_MTJ",
        from_station="NDLS",
        to_station="MTJ",
        distance_km=141.0,
        normal_speed_kmph=110.0,
        capacity_score=0.85,
        historical_median_time_min=95.0,
        historical_p90_time_min=115.0
    ),
    "SEC_MTJ_BTE": Section(
        section_id="SEC_MTJ_BTE",
        from_station="MTJ",
        to_station="BTE",
        distance_km=34.0,
        normal_speed_kmph=100.0,
        capacity_score=0.90,
        historical_median_time_min=25.0,
        historical_p90_time_min=32.0
    ),
    "SEC_BTE_GGC": Section(
        section_id="SEC_BTE_GGC",
        from_station="BTE",
        to_station="GGC",
        distance_km=119.0,
        normal_speed_kmph=110.0,
        capacity_score=0.80,
        historical_median_time_min=75.0,
        historical_p90_time_min=90.0
    ),
    "SEC_GGC_SWM": Section(
        section_id="SEC_GGC_SWM",
        from_station="GGC",
        to_station="SWM",
        distance_km=64.0,
        normal_speed_kmph=110.0,
        capacity_score=0.88,
        historical_median_time_min=42.0,
        historical_p90_time_min=52.0
    ),
    "SEC_SWM_KOTA": Section(
        section_id="SEC_SWM_KOTA",
        from_station="SWM",
        to_station="KOTA",
        distance_km=108.0,
        normal_speed_kmph=120.0,
        capacity_score=0.82,
        historical_median_time_min=65.0,
        historical_p90_time_min=80.0
    ),
    "SEC_KOTA_RATL": Section(
        section_id="SEC_KOTA_RATL",
        from_station="KOTA",
        to_station="RATL",
        distance_km=266.0,
        normal_speed_kmph=110.0,
        capacity_score=0.75,
        historical_median_time_min=170.0,
        historical_p90_time_min=200.0
    ),
    "SEC_RATL_BRC": Section(
        section_id="SEC_RATL_BRC",
        from_station="RATL",
        to_station="BRC",
        distance_km=261.0,
        normal_speed_kmph=110.0,
        capacity_score=0.78,
        historical_median_time_min=165.0,
        historical_p90_time_min=195.0
    ),
    "SEC_BRC_MMCT": Section(
        section_id="SEC_BRC_MMCT",
        from_station="BRC",
        to_station="MMCT",
        distance_km=392.0,
        normal_speed_kmph=120.0,
        capacity_score=0.70,
        historical_median_time_min=250.0,
        historical_p90_time_min=290.0
    )
}

# Ordered list of section keys (NDLS → MMCT route order)
SECTION_KEYS_ORDER: List[str] = list(SECTIONS.keys())

# 5 Simulated Coaching Trains
TRAINS: Dict[str, TrainMeta] = {
    "12952": TrainMeta(
        train_id="12952",
        train_name="Mumbai Rajdhani",
        category="Rajdhani",
        priority=1,
        source_station="NDLS",
        destination_station="MMCT"
    ),
    "12413": TrainMeta(
        train_id="12413",
        train_name="Rajdhani Express",
        category="Express",
        priority=2,
        source_station="NDLS",
        destination_station="MMCT"
    ),
    "19020": TrainMeta(
        train_id="19020",
        train_name="Dehradun Express",
        category="Express",
        priority=3,
        source_station="NDLS",
        destination_station="MMCT"
    ),
    "12988": TrainMeta(
        train_id="12988",
        train_name="Ajmer Superfast",
        category="Superfast",
        priority=2,
        source_station="NDLS",
        destination_station="MMCT"
    ),
    "12910": TrainMeta(
        train_id="12910",
        train_name="Gujarat Mail",
        category="Mail Express",
        priority=3,
        source_station="NDLS",
        destination_station="MMCT"
    ),
}

# Initial starting configurations for prototype simulation seed
TRAIN_INITIAL_CONFIGS = {
    "12952": {"start_sec_index": 0, "progress_pct": 0.10, "delay_minutes": 2},   # NDLS -> MTJ
    "12413": {"start_sec_index": 1, "progress_pct": 0.40, "delay_minutes": 8},   # MTJ -> BTE
    "19020": {"start_sec_index": 3, "progress_pct": 0.25, "delay_minutes": 15},  # GGC -> SWM
    "12988": {"start_sec_index": 5, "progress_pct": 0.50, "delay_minutes": 5},   # KOTA -> RATL
    "12910": {"start_sec_index": 6, "progress_pct": 0.70, "delay_minutes": 22},  # RATL -> BRC
}
