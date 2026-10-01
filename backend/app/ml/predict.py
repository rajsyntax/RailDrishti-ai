"""
RailDrishti AI - Hybrid ETA Inference Engine
Combines physics-based domain rules, LightGBM/GradientBoosting ML models,
and strict operational safety constraints for dynamic ETA forecasting.
"""

import os
import datetime
import numpy as np
import pandas as pd
import joblib
from typing import Dict, Any, Optional

from app.ml.train_model import (
    NUMERICAL_FEATURES,
    CATEGORICAL_FEATURES,
)


class HybridETAPredictor:
    """
    Hybrid ETA predictor combining:
    1. Rule-based physics baseline (always available as fallback).
    2. ML gradient boosting model trained on historical sectional runs.
    3. Strict operational constraint guards (speed limits, signal halt minimums, TSR bounds).
    """

    def __init__(self):
        self.model_bundle: Optional[Dict[str, Any]] = None
        self.is_ml_loaded: bool = False
        self.model_version: str = "v1.0-rule-baseline"
        self._load_model()

    def _load_model(self):
        """Attempt to load saved model artifact."""
        try:
            ml_dir = os.path.dirname(os.path.abspath(__file__))
            model_path = os.path.join(ml_dir, "models", "eta_model.joblib")
            if os.path.exists(model_path):
                self.model_bundle = joblib.load(model_path)
                self.is_ml_loaded = True
                self.model_version = self.model_bundle.get("model_version", "v2.4-hybrid-lgbm")
                print(f"[HybridETAPredictor] Successfully loaded ML model: {self.model_version}")
            else:
                self.is_ml_loaded = False
                self.model_version = "v1.0-rule-baseline"
                print("[HybridETAPredictor] Model file not found. Operating with Rule-based fallback.")
        except Exception as e:
            self.is_ml_loaded = False
            self.model_version = "v1.0-rule-baseline"
            print(f"[HybridETAPredictor] Model load error ({e}). Operating with Rule-based fallback.")

    def reload(self):
        """Reload model after retraining."""
        self._load_model()

    def predict_remaining_time(
        self,
        current_speed_kmph: float,
        distance_to_next_station_km: float,
        current_delay_minutes: float = 0.0,
        historical_section_median_minutes: float = 60.0,
        hour_of_day: Optional[int] = None,
        day_of_week: Optional[int] = None,
        congestion_score: float = 0.2,
        trains_ahead: int = 0,
        restriction_active: int = 0,
        weather_severity: float = 0.0,
        unscheduled_halt_minutes: float = 0.0,
        scheduled_recovery_margin: float = 4.0,
        gps_freshness_seconds: float = 5.0,
        section_id: str = "SEC_SWM_KOTA",
        train_category: str = "Rajdhani Express",
        max_section_speed_kmph: float = 120.0,
    ) -> Dict[str, Any]:
        """
        Calculate dynamic remaining transit time to next station with P10/P50/P90 brackets,
        attributions, and constraint validation.
        """
        now = datetime.datetime.now()
        if hour_of_day is None:
            hour_of_day = now.hour
        if day_of_week is None:
            day_of_week = now.weekday()

        # ── 1. Calculate Rule-Based Baseline ─────────────────────────────────────
        # Kinematic estimate with basic domain rules
        effective_rule_speed = max(20.0, min(max_section_speed_kmph, current_speed_kmph if current_speed_kmph > 15 else max_section_speed_kmph * 0.75))
        if restriction_active:
            effective_rule_speed = min(effective_rule_speed, 40.0)

        kinematic_time_min = (distance_to_next_station_km / effective_rule_speed) * 60.0
        rule_congestion_delta = congestion_score * (6.0 + trains_ahead * 3.0)
        rule_weather_delta = weather_severity * 6.0
        rule_restriction_delta = 5.0 if restriction_active else 0.0
        rule_recovery_benefit = min(scheduled_recovery_margin, kinematic_time_min * 0.1)

        rule_p50 = max(
            3.0,
            kinematic_time_min
            + unscheduled_halt_minutes
            + rule_congestion_delta
            + rule_weather_delta
            + rule_restriction_delta
            - rule_recovery_benefit
        )

        rule_p10 = max(2.0, rule_p50 - max(3.0, rule_p50 * 0.12))
        rule_p90 = rule_p50 + max(4.0, rule_p50 * 0.18 + unscheduled_halt_minutes * 0.5)

        raw_p50 = rule_p50
        raw_p10 = rule_p10
        raw_p90 = rule_p90
        prediction_mode = "RULE_BASED_BASELINE"

        # ── 2. Run ML Model if loaded ──────────────────────────────────────────
        if self.is_ml_loaded and self.model_bundle:
            try:
                features_dict = {
                    "current_speed_kmph": float(current_speed_kmph),
                    "distance_to_next_station_km": float(distance_to_next_station_km),
                    "current_delay_minutes": float(current_delay_minutes),
                    "historical_section_median_minutes": float(historical_section_median_minutes),
                    "hour_of_day": int(hour_of_day),
                    "day_of_week": int(day_of_week),
                    "congestion_score": float(congestion_score),
                    "trains_ahead": int(trains_ahead),
                    "restriction_active": int(restriction_active),
                    "weather_severity": float(weather_severity),
                    "unscheduled_halt_minutes": float(unscheduled_halt_minutes),
                    "scheduled_recovery_margin": float(scheduled_recovery_margin),
                    "gps_freshness_seconds": float(gps_freshness_seconds),
                    "section_id": str(section_id),
                    "train_category": str(train_category),
                }

                input_df = pd.DataFrame([features_dict])
                preprocessor = self.model_bundle["preprocessor"]
                main_reg = self.model_bundle["main_regressor"]
                q10_reg = self.model_bundle.get("q10_regressor")
                q90_reg = self.model_bundle.get("q90_regressor")

                X_trans = preprocessor.transform(input_df)

                # ML Predictions
                ml_p50 = float(main_reg.predict(X_trans)[0])
                ml_p10 = float(q10_reg.predict(X_trans)[0]) if q10_reg else ml_p50 - 4.0
                ml_p90 = float(q90_reg.predict(X_trans)[0]) if q90_reg else ml_p50 + 6.0

                raw_p50 = ml_p50
                raw_p10 = ml_p10
                raw_p90 = ml_p90
                prediction_mode = "HYBRID_ML_ONLINE"
            except Exception as infer_err:
                print(f"[HybridETAPredictor] ML inference fallback: {infer_err}")
                raw_p50 = rule_p50
                raw_p10 = rule_p10
                raw_p90 = rule_p90
                prediction_mode = "RULE_BASED_FALLBACK"

        # ── 3. Operational Constraint Guards & Overrides ─────────────────────────
        # Physical minimum transit time constraint (train cannot exceed physical line speed)
        min_physical_time_min = (distance_to_next_station_km / max(30.0, max_section_speed_kmph)) * 60.0
        p50_constrained = max(min_physical_time_min, raw_p50)

        # Halt minimum constraint
        if unscheduled_halt_minutes > 0:
            p50_constrained = max(p50_constrained, kinematic_time_min + unscheduled_halt_minutes)

        # Speed restriction cap constraint
        if restriction_active and distance_to_next_station_km > 10.0:
            tsr_min_time = (distance_to_next_station_km / 45.0) * 60.0
            p50_constrained = max(p50_constrained, tsr_min_time)

        # Quantile ordering & consistency
        p10_final = max(min_physical_time_min * 0.9, min(raw_p10, p50_constrained - 2.0))
        p90_final = max(p50_constrained + 3.0, raw_p90)
        p50_final = round(float(p50_constrained), 1)
        p10_final = round(float(p10_final), 1)
        p90_final = round(float(p90_final), 1)

        # ── 4. Confidence & Uncertainty Scoring ─────────────────────────────────
        uncertainty_spread = p90_final - p10_final
        if uncertainty_spread <= 8.0 and current_delay_minutes < 15.0 and unscheduled_halt_minutes == 0:
            confidence_label = "HIGH"
            confidence_score = 0.94
        elif uncertainty_spread <= 18.0 and current_delay_minutes < 35.0:
            confidence_label = "MEDIUM"
            confidence_score = 0.76
        else:
            confidence_label = "LOW"
            confidence_score = 0.48

        # ── 5. Feature Attributions & Factor Deltas ──────────────────────────────
        attributions = [
            {
                "factor": "temporary_speed_restriction",
                "label": "Caution Order (TSR)",
                "delta_min": round(float(rule_restriction_delta), 1),
                "description": "Active speed restriction on track segment." if restriction_active else "No active TSR restriction.",
            },
            {
                "factor": "section_congestion",
                "label": "Corridor Congestion",
                "delta_min": round(float(rule_congestion_delta), 1),
                "description": f"Line utilization at {int(congestion_score * 100)}% with {trains_ahead} trains ahead.",
            },
            {
                "factor": "unscheduled_halt",
                "label": "Signal / Station Halt",
                "delta_min": round(float(unscheduled_halt_minutes), 1),
                "description": f"Unscheduled halt dwell of {unscheduled_halt_minutes} min at signal/loop." if unscheduled_halt_minutes > 0 else "Nominal line headway.",
            },
            {
                "factor": "weather_visibility",
                "label": "Adverse Weather",
                "delta_min": round(float(rule_weather_delta), 1),
                "description": f"Reduced visibility severity {weather_severity}." if weather_severity > 0 else "Clear atmospheric visibility.",
            },
            {
                "factor": "timetable_recovery",
                "label": "Timetable Slack Headroom",
                "delta_min": -round(float(rule_recovery_benefit), 1),
                "description": f"Scheduled slack allows recovering {round(rule_recovery_benefit, 1)} minutes.",
            }
        ]

        return {
            "predicted_remaining_minutes": p50_final,
            "predicted_p10_minutes": p10_final,
            "predicted_p50_minutes": p50_final,
            "predicted_p90_minutes": p90_final,
            "uncertainty_spread_minutes": round(p90_final - p10_final, 1),
            "confidence_label": confidence_label,
            "confidence_score": confidence_score,
            "prediction_mode": prediction_mode,
            "is_hybrid_active": self.is_ml_loaded,
            "model_version": self.model_version,
            "attributions": attributions,
            "baseline_comparison": {
                "rule_p50": round(rule_p50, 1),
                "delta_from_baseline": round(p50_final - rule_p50, 1),
            }
        }


# Singleton instance
hybrid_predictor = HybridETAPredictor()
