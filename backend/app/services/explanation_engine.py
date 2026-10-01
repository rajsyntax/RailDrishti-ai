"""
app/services/explanation_engine.py

Rule-based explanation engine for RailDrishti AI ETA Intelligence.
Deconstructs delay causes into transparent, quantifiable factor contributions
and constructs natural language explanations for operators and passengers.

Factor Contributions:
- signal halt
- downstream congestion
- temporary speed restriction
- weather speed reduction
- station dwell overrun
- low current speed
- timetable recovery margin
- delay propagation (from leading train)

Produces natural language explanations such as:
“ETA changed by 14 minutes due to a signal halt near Kota (+8 min),
moderate downstream congestion (+5 min), and available recovery margin (-3 min).”
"""

from typing import Dict, Any, List, Optional
from datetime import datetime, timezone


def _format_factor_clause(factor: Dict[str, Any]) -> str:
    """Format an individual factor into a human-readable clause with signed minutes."""
    delta = factor.get("delta_min", 0.0)
    sign = "+" if delta >= 0 else "-"
    delta_abs = abs(delta)
    delta_str = f"{sign}{delta_abs:.0f} min" if delta_abs == int(delta_abs) else f"{sign}{delta_abs:.1f} min"
    
    label = factor.get("label", "operational factor").lower()
    return f"{label} ({delta_str})"


def generate_explanation(
    train_id: str,
    train_name: str,
    eta_data: Dict[str, Any],
    propagation_info: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """
    Generate an explainability report for a train's current ETA.
    """
    now_iso = datetime.now(timezone.utc).isoformat()
    live_state = eta_data.get("current_live_state", {})
    current_delay = int(live_state.get("delay_minutes", 0))
    predicted_delay = int(eta_data.get("predicted_delay", eta_data.get("overall_delay_min", current_delay)))
    delta_delay = predicted_delay - current_delay
    
    factors: List[Dict[str, Any]] = list(eta_data.get("top_eta_factors", eta_data.get("top_factors", [])))
    
    # If propagation info is present and not already in factors, inject it
    if propagation_info and not any(f.get("factor") == "delay_propagation" for f in factors):
        p_delta = propagation_info.get("secondary_delay_min", 0)
        if p_delta > 0:
            factors.append({
                "factor": "delay_propagation",
                "label": f"Delay propagation from train {propagation_info.get('leading_train_id')}",
                "delta_min": p_delta,
                "description": propagation_info.get("reason", "Secondary headway delay from leading train."),
            })

    # Sort factors by absolute impact
    factors.sort(key=lambda x: abs(x.get("delta_min", 0)), reverse=True)
    
    # Pick top contributing factors for explanation sentence (up to 3 positive/negative drivers)
    clauses = []
    for f in factors[:4]:
        if abs(f.get("delta_min", 0)) >= 0.5:
            clauses.append(_format_factor_clause(f))
            
    # Construct natural language sentence
    if predicted_delay == 0 and not clauses:
        summary_text = (
            f"Train {train_id} ({train_name}) is running strictly on schedule (+0 min) "
            "with clear tracks and nominal operational speeds."
        )
    elif not clauses:
        sign = "+" if predicted_delay >= 0 else "-"
        summary_text = (
            f"ETA projected with {sign}{abs(predicted_delay)} minutes delay based on "
            "nominal section runtimes and current track progression."
        )
    else:
        clause_str = ", ".join(clauses[:-1]) + f", and {clauses[-1]}" if len(clauses) > 1 else clauses[0]
        if predicted_delay > 0:
            summary_text = (
                f"ETA changed by {predicted_delay} minutes due to {clause_str}."
            )
        elif predicted_delay < 0:
            summary_text = (
                f"Train is running {abs(predicted_delay)} minutes ahead of schedule due to {clause_str}."
            )
        else:
            summary_text = (
                f"ETA is on schedule (+0 min) with {clause_str}."
            )

    # Actionable operational insight
    actionable_insight = "Continue monitoring section speeds."
    if any(f.get("factor") == "signal_halt" for f in factors):
        actionable_insight = "Signal halt detected: priority dispatching recommended to prevent trailing congestion."
    elif any(f.get("factor") == "downstream_congestion" for f in factors):
        actionable_insight = "Moderate-to-high downstream congestion: regulate block signaling or loop siding diversion."
    elif any(f.get("factor") == "speed_restriction" for f in factors):
        actionable_insight = "Engineering speed restriction in force: speed recovery possible once exiting restricted zone."
    elif any(f.get("factor") == "weather_speed_reduction" for f in factors):
        actionable_insight = "Adverse weather caution: foggy/stormy conditions necessitate reduced headway buffers."
    elif propagation_info:
        actionable_insight = f"Hold or regulate trailing headway for train {train_id} to absorb leading train delay."

    return {
        "train_id": train_id,
        "train_name": train_name,
        "generated_at": now_iso,
        "current_delay_minutes": current_delay,
        "predicted_delay_minutes": predicted_delay,
        "delay_delta_minutes": delta_delay,
        "delay_trend": eta_data.get("delay_trend", "STABLE"),
        "confidence_label": eta_data.get("confidence_label", eta_data.get("confidence", "MEDIUM")),
        "recovery_probability": eta_data.get("recovery_probability", 1.0),
        "summary_explanation": summary_text,
        "factor_contributions": factors,
        "propagation_impact": propagation_info,
        "actionable_insight": actionable_insight,
    }
