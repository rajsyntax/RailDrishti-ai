"""
app/services/congestion_engine.py

Section congestion scoring.

CongestionScore = 0.35*occupancy + 0.25*trains_ahead + 0.20*low_headway_risk + 0.20*restriction_severity
Normalized to [0,1].  Labels: 0.00-0.30 LOW | 0.31-0.60 MODERATE | 0.61-1.00 HIGH
"""

import random
import asyncio
from datetime import datetime, timezone
from typing import Dict, Any, List

from app.services.corridor_data import SECTIONS, STATION_ORDER, SECTION_KEYS_ORDER

# ---------------------------------------------------------------------------
# In-memory congestion state  { section_id -> CongestionRecord }
# ---------------------------------------------------------------------------
_congestion: Dict[str, Dict[str, Any]] = {}
_section_overrides: Dict[str, Dict[str, Any]] = {}
_lock = asyncio.Lock()


def set_section_override(
    section_id: str,
    weather_condition: str = None,
    restriction_active: bool = None,
    extra_congestion: float = None
):
    if section_id not in _section_overrides:
        _section_overrides[section_id] = {}
    if weather_condition is not None:
        _section_overrides[section_id]["weather_condition"] = weather_condition
    if restriction_active is not None:
        _section_overrides[section_id]["restriction_active"] = restriction_active
    if extra_congestion is not None:
        _section_overrides[section_id]["extra_congestion"] = extra_congestion


def clear_section_override(section_id: str):
    _section_overrides.pop(section_id, None)


def clear_all_overrides():
    _section_overrides.clear()


def get_section_overrides() -> Dict[str, Dict[str, Any]]:
    return dict(_section_overrides)


def _label(score: float) -> str:
    if score <= 0.30:
        return "LOW"
    elif score <= 0.60:
        return "MODERATE"
    return "HIGH"


def _compute_section_congestion(
    section_id: str,
    trains_in_section: int,
    trains_ahead: int,
    restriction_active: bool,
    weather_condition: str = "CLEAR",
) -> Dict[str, Any]:
    """
    Rule-based congestion score computation for one section.
    All sub-scores are clamped to [0,1] before weighting.
    """
    sec = SECTIONS.get(section_id)
    if not sec:
        return {}

    # -- Sub-score 1: occupancy (how many trains are in this section vs capacity)
    # capacity_score from corridor_data is the *section* capacity rating (higher = more headroom)
    # More trains → higher occupancy sub-score
    max_trains = 3  # practical max for a single block section in simulation
    occupancy_raw = min(trains_in_section / max_trains, 1.0)
    # invert capacity_score: low capacity → higher occupancy risk
    occupancy = occupancy_raw * (1.0 - float(sec.capacity_score) * 0.4)
    occupancy = min(1.0, occupancy)

    # -- Sub-score 2: trains ahead blocking
    trains_ahead_score = min(trains_ahead / 3.0, 1.0)

    # -- Sub-score 3: low headway risk
    # If multiple trains in section, headway risk rises sharply
    headway_risk = 0.0
    if trains_in_section >= 2:
        headway_risk = 0.6 + (trains_in_section - 2) * 0.2
    elif trains_in_section == 1 and trains_ahead >= 1:
        headway_risk = 0.3
    headway_risk = min(1.0, headway_risk)

    # -- Sub-score 4: restriction severity
    weather_penalty = {"CLEAR": 0.0, "FOG": 0.4, "RAIN": 0.3, "STORM": 0.8}.get(weather_condition, 0.0)
    restriction_score = min(1.0, (0.5 if restriction_active else 0.0) + weather_penalty)

    # -- Weighted composite
    score = (
        0.35 * occupancy
        + 0.25 * trains_ahead_score
        + 0.20 * headway_risk
        + 0.20 * restriction_score
    )
    score = round(min(1.0, max(0.0, score)), 4)

    return {
        "section_id": section_id,
        "from_station": sec.from_station,
        "to_station": sec.to_station,
        "score": score,
        "label": _label(score),
        "sub_scores": {
            "occupancy": round(occupancy, 4),
            "trains_ahead": round(trains_ahead_score, 4),
            "headway_risk": round(headway_risk, 4),
            "restriction_severity": round(restriction_score, 4),
        },
        "trains_in_section": trains_in_section,
        "restriction_active": restriction_active,
        "weather_condition": weather_condition,
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }


async def update_all_congestion(all_train_states: List[Dict[str, Any]]) -> None:
    """
    Recalculate congestion for every section based on current live train states.
    Called by the simulator after each tick.
    """
    # Count trains per section
    section_occupancy: Dict[str, int] = {k: 0 for k in SECTION_KEYS_ORDER}
    for state in all_train_states:
        sec = state.get("current_section")
        if sec and sec in section_occupancy:
            section_occupancy[sec] += 1

    # Determine trains ahead per section (trains in the next section down the corridor)
    new_congestion: Dict[str, Dict[str, Any]] = {}
    for i, sec_id in enumerate(SECTION_KEYS_ORDER):
        trains_in = section_occupancy.get(sec_id, 0)
        # "trains ahead" = occupancy of the next section
        next_sec = SECTION_KEYS_ORDER[i + 1] if i + 1 < len(SECTION_KEYS_ORDER) else None
        trains_ahead = section_occupancy.get(next_sec, 0) if next_sec else 0

        # Weather: pull from any train currently in section, else CLEAR
        weather = "CLEAR"
        for state in all_train_states:
            if state.get("current_section") == sec_id:
                weather = state.get("weather_condition", "CLEAR")
                break

        # Default restriction seeded by section hash
        restriction = (hash(sec_id) % 17 == 0)

        # Check if manual/simulated override is active
        override = _section_overrides.get(sec_id, {})
        if "weather_condition" in override:
            weather = override["weather_condition"]
        if "restriction_active" in override:
            restriction = override["restriction_active"]

        record = _compute_section_congestion(
            section_id=sec_id,
            trains_in_section=trains_in,
            trains_ahead=trains_ahead,
            restriction_active=restriction,
            weather_condition=weather,
        )

        if "extra_congestion" in override and record:
            record["score"] = round(min(1.0, max(0.0, record["score"] + override["extra_congestion"])), 4)
            record["label"] = _label(record["score"])

        new_congestion[sec_id] = record

    async with _lock:
        _congestion.clear()
        _congestion.update(new_congestion)


async def get_section_congestion(section_id: str) -> Dict[str, Any]:
    async with _lock:
        return dict(_congestion.get(section_id, {}))


async def get_all_congestion() -> List[Dict[str, Any]]:
    async with _lock:
        return [dict(v) for v in _congestion.values()]
