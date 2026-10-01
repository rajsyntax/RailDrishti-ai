"""
RailDrishti AI - ML Training Pipeline
Trains LightGBM / HistGradientBoosting regressors for dynamic ETA prediction
alongside quantile uncertainty models (P10, P50, P90) and baseline comparison.
"""

import os
import json
import datetime
import numpy as np
import pandas as pd
import joblib
from typing import Dict, Any, Tuple

from app.ml.generate_synthetic_data import generate_synthetic_historical_dataset

# Check library availability
HAVE_LIGHTGBM = False
try:
    import lightgbm as lgb
    HAVE_LIGHTGBM = True
except ImportError:
    pass

from sklearn.model_selection import train_test_split
from sklearn.preprocessing import OneHotEncoder, StandardScaler
from sklearn.compose import ColumnTransformer
from sklearn.pipeline import Pipeline
from sklearn.ensemble import HistGradientBoostingRegressor, GradientBoostingRegressor
from sklearn.linear_model import Ridge
from sklearn.metrics import mean_absolute_error, median_absolute_error

NUMERICAL_FEATURES = [
    "current_speed_kmph",
    "distance_to_next_station_km",
    "current_delay_minutes",
    "historical_section_median_minutes",
    "hour_of_day",
    "day_of_week",
    "congestion_score",
    "trains_ahead",
    "restriction_active",
    "weather_severity",
    "unscheduled_halt_minutes",
    "scheduled_recovery_margin",
    "gps_freshness_seconds",
]

CATEGORICAL_FEATURES = [
    "section_id",
    "train_category",
]

TARGET = "remaining_time_to_next_station_minutes"


class PhysicsBaselineModel:
    """Physics-based kinematic baseline estimating time = distance / max(20, speed)."""
    def fit(self, X, y=None):
        return self

    def predict(self, X: pd.DataFrame) -> np.ndarray:
        speeds = np.maximum(20.0, X["current_speed_kmph"].values)
        distances = X["distance_to_next_station_km"].values
        delays = X["current_delay_minutes"].values * 0.3
        halts = X["unscheduled_halt_minutes"].values
        base_time = (distances / speeds) * 60.0 + delays + halts
        return np.maximum(3.0, base_time)


def build_preprocessor() -> ColumnTransformer:
    return ColumnTransformer(
        transformers=[
            ("num", StandardScaler(), NUMERICAL_FEATURES),
            ("cat", OneHotEncoder(handle_unknown="ignore", sparse_output=False), CATEGORICAL_FEATURES),
        ]
    )


def compute_metrics(y_true: np.ndarray, y_pred: np.ndarray) -> Dict[str, Any]:
    errors = np.abs(y_true - y_pred)
    mae = float(mean_absolute_error(y_true, y_pred))
    medae = float(median_absolute_error(y_true, y_pred))
    pct_5min = float(np.mean(errors <= 5.0) * 100.0)
    pct_10min = float(np.mean(errors <= 10.0) * 100.0)
    p90_error = float(np.percentile(errors, 90))

    return {
        "mae": round(mae, 2),
        "median_absolute_error": round(medae, 2),
        "pct_within_5min": round(pct_5min, 1),
        "pct_within_10min": round(pct_10min, 1),
        "p90_absolute_error": round(p90_error, 2),
    }


def train_eta_pipeline(data_path: str = None) -> Tuple[Dict[str, Any], Dict[str, Any]]:
    """
    Train full hybrid ETA model pipeline with baseline comparison and quantile regressors.
    """
    ml_dir = os.path.dirname(os.path.abspath(__file__))
    models_dir = os.path.join(ml_dir, "models")
    os.makedirs(models_dir, exist_ok=True)

    if not data_path:
        data_path = os.path.join(ml_dir, "synthetic_historical_runs.csv")

    if not os.path.exists(data_path):
        print("[train_model] Generating synthetic training data...")
        df = generate_synthetic_historical_dataset(num_samples=8000, output_path=data_path)
    else:
        df = pd.read_csv(data_path)

    print(f"[train_model] Loaded {len(df)} records for training.")

    X = df[NUMERICAL_FEATURES + CATEGORICAL_FEATURES]
    y = df[TARGET].values

    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.20, random_state=42)

    # 1. Baseline Evaluation
    baseline = PhysicsBaselineModel()
    y_pred_baseline = baseline.predict(X_test)
    baseline_metrics = compute_metrics(y_test, y_pred_baseline)

    # 2. Main ML Regressor
    model_algorithm = "HistGradientBoostingRegressor"
    preprocessor = build_preprocessor()

    if HAVE_LIGHTGBM:
        try:
            model_algorithm = "LightGBM Regressor"
            main_regressor = lgb.LGBMRegressor(
                n_estimators=150,
                learning_rate=0.06,
                max_depth=6,
                num_leaves=31,
                random_state=42,
                verbosity=-1
            )
            # Quantile models for P10 and P90
            q10_regressor = lgb.LGBMRegressor(
                objective="quantile",
                alpha=0.10,
                n_estimators=100,
                learning_rate=0.08,
                random_state=42,
                verbosity=-1
            )
            q90_regressor = lgb.LGBMRegressor(
                objective="quantile",
                alpha=0.90,
                n_estimators=100,
                learning_rate=0.08,
                random_state=42,
                verbosity=-1
            )
        except Exception:
            main_regressor = HistGradientBoostingRegressor(max_iter=150, learning_rate=0.06, random_state=42)
            q10_regressor = GradientBoostingRegressor(loss="quantile", alpha=0.10, n_estimators=80, random_state=42)
            q90_regressor = GradientBoostingRegressor(loss="quantile", alpha=0.90, n_estimators=80, random_state=42)
    else:
        main_regressor = HistGradientBoostingRegressor(max_iter=150, learning_rate=0.06, random_state=42)
        q10_regressor = GradientBoostingRegressor(loss="quantile", alpha=0.10, n_estimators=80, random_state=42)
        q90_regressor = GradientBoostingRegressor(loss="quantile", alpha=0.90, n_estimators=80, random_state=42)

    # Transform features
    X_train_trans = preprocessor.fit_transform(X_train)
    X_test_trans = preprocessor.transform(X_test)

    # Fit models
    print(f"[train_model] Training {model_algorithm} and quantile heads...")
    main_regressor.fit(X_train_trans, y_train)
    q10_regressor.fit(X_train_trans, y_train)
    q90_regressor.fit(X_train_trans, y_train)

    # Predict test
    y_pred_ml = main_regressor.predict(X_test_trans)
    ml_metrics = compute_metrics(y_test, y_pred_ml)

    # Per-section performance metrics
    section_breakdown = {}
    for sec_id in df["section_id"].unique():
        sec_mask = (X_test["section_id"] == sec_id).values
        if np.sum(sec_mask) > 10:
            sec_y_true = y_test[sec_mask]
            sec_y_pred_ml = y_pred_ml[sec_mask]
            sec_y_pred_base = y_pred_baseline[sec_mask]
            section_breakdown[sec_id] = {
                "samples": int(np.sum(sec_mask)),
                "ml_mae": round(float(mean_absolute_error(sec_y_true, sec_y_pred_ml)), 2),
                "baseline_mae": round(float(mean_absolute_error(sec_y_true, sec_y_pred_base)), 2),
                "accuracy_5min": round(float(np.mean(np.abs(sec_y_true - sec_y_pred_ml) <= 5.0) * 100), 1),
            }

    # Extract feature importances if available
    feature_importances = {}
    feature_names = []
    try:
        cat_encoder = preprocessor.named_transformers_["cat"]
        cat_cols = list(cat_encoder.get_feature_names_out(CATEGORICAL_FEATURES))
        feature_names = NUMERICAL_FEATURES + cat_cols

        if hasattr(main_regressor, "feature_importances_"):
            raw_imp = main_regressor.feature_importances_
            total_imp = sum(raw_imp) if sum(raw_imp) > 0 else 1.0
            for name, imp in zip(feature_names, raw_imp):
                feature_importances[name] = round(float(imp / total_imp), 4)
    except Exception as e:
        print("[train_model] Feature importance calculation note:", e)

    # Build model artifact bundle
    model_bundle = {
        "model_version": "v2.4-hybrid-lgbm",
        "algorithm": model_algorithm,
        "preprocessor": preprocessor,
        "main_regressor": main_regressor,
        "q10_regressor": q10_regressor,
        "q90_regressor": q90_regressor,
        "feature_names": feature_names,
        "numerical_features": NUMERICAL_FEATURES,
        "categorical_features": CATEGORICAL_FEATURES,
        "training_timestamp": datetime.datetime.now(datetime.timezone.utc).isoformat(),
    }

    model_save_path = os.path.join(models_dir, "eta_model.joblib")
    joblib.dump(model_bundle, model_save_path)
    print(f"[train_model] Saved model artifact bundle to {os.path.basename(model_save_path)}")

    # Metadata & Metrics JSON for admin API
    metrics_summary = {
        "model_version": "v2.4-hybrid-lgbm",
        "model_status": "ONLINE_ACTIVE",
        "algorithm": model_algorithm,
        "training_timestamp": datetime.datetime.now(datetime.timezone.utc).isoformat(),
        "total_training_samples": len(df),
        "test_evaluation_samples": len(X_test),
        "metrics": {
            "ml_model": ml_metrics,
            "baseline_model": baseline_metrics,
            "mae_improvement_pct": round(
                float(((baseline_metrics["mae"] - ml_metrics["mae"]) / baseline_metrics["mae"]) * 100), 1
            ),
        },
        "feature_importance_top": sorted(
            [{"feature": k, "importance": v} for k, v in feature_importances.items()],
            key=lambda x: x["importance"],
            reverse=True
        )[:10],
        "section_performance": section_breakdown,
        "is_hybrid_active": True,
    }

    metrics_save_path = os.path.join(models_dir, "model_metrics.json")
    with open(metrics_save_path, "w", encoding="utf-8") as f:
        json.dump(metrics_summary, f, indent=2)
    print(f"[train_model] Saved model metrics summary to {os.path.basename(metrics_save_path)}")

    return model_bundle, metrics_summary


if __name__ == "__main__":
    train_eta_pipeline()
