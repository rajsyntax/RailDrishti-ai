"""
RailDrishti AI - Model Evaluation & Diagnostics Module
Evaluates model predictions, error residual distributions, calibration intervals,
and section benchmarks.
"""

import os
import json
import numpy as np
import pandas as pd
import joblib
from typing import Dict, Any

from app.ml.train_model import (
    NUMERICAL_FEATURES,
    CATEGORICAL_FEATURES,
    TARGET,
    PhysicsBaselineModel,
    compute_metrics,
)


def evaluate_existing_model(data_path: str = None) -> Dict[str, Any]:
    """
    Load saved model artifact and run full evaluation suite on historical data.
    """
    ml_dir = os.path.dirname(os.path.abspath(__file__))
    model_path = os.path.join(ml_dir, "models", "eta_model.joblib")
    metrics_path = os.path.join(ml_dir, "models", "model_metrics.json")

    if not os.path.exists(model_path):
        return {
            "status": "NO_MODEL_FOUND",
            "message": "Model has not been trained yet. Operating in rule-based fallback mode.",
            "is_hybrid_active": False,
        }

    if not data_path:
        data_path = os.path.join(ml_dir, "synthetic_historical_runs.csv")

    if not os.path.exists(data_path):
        return {
            "status": "NO_DATA_FOUND",
            "message": "Evaluation data missing.",
            "is_hybrid_active": False,
        }

    model_bundle = joblib.load(model_path)
    df = pd.read_csv(data_path)

    preprocessor = model_bundle["preprocessor"]
    main_model = model_bundle["main_regressor"]

    X = df[NUMERICAL_FEATURES + CATEGORICAL_FEATURES]
    y_true = df[TARGET].values

    X_trans = preprocessor.transform(X)
    y_pred = main_model.predict(X_trans)

    # Baseline comparison
    baseline = PhysicsBaselineModel()
    y_pred_base = baseline.predict(X)

    ml_metrics = compute_metrics(y_true, y_pred)
    base_metrics = compute_metrics(y_true, y_pred_base)

    # Residuals & Error Distribution bins (<=2m, 2-5m, 5-10m, >10m)
    errors = np.abs(y_true - y_pred)
    error_bins = {
        "within_2min_pct": round(float(np.mean(errors <= 2.0) * 100), 1),
        "within_5min_pct": round(float(np.mean(errors <= 5.0) * 100), 1),
        "within_10min_pct": round(float(np.mean(errors <= 10.0) * 100), 1),
        "above_10min_pct": round(float(np.mean(errors > 10.0) * 100), 1),
    }

    evaluation_report = {
        "status": "HEALTHY",
        "model_version": model_bundle.get("model_version", "v2.4-hybrid-lgbm"),
        "algorithm": model_bundle.get("algorithm", "LightGBM / HistGradientBoosting"),
        "evaluation_samples": len(df),
        "metrics": ml_metrics,
        "baseline_metrics": base_metrics,
        "error_distribution": error_bins,
        "is_hybrid_active": True,
    }

    return evaluation_report


if __name__ == "__main__":
    rep = evaluate_existing_model()
    print(json.dumps(rep, indent=2))
