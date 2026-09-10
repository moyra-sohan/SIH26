"""
predict.py — Standalone flood prediction function.
Wraps the full pipeline: ward data + real-time weather → best_flood_model.pkl → prediction.

Usage:
    from predict import predict_flood

    result = predict_flood("behala-ward-120", weather_data={
        "temperature": 31.0,
        "humidity": 90,
        "rainfall_24h_estimate_mm": 10.0,
        "forecast_rainfall_mm": 12.0,
        "rainfall_1h_mm": 0.5,
        "temp_min": 27.0,
        "temp_max": 33.0,
    })
"""

import os
import json
import logging
from typing import Dict, Any, Optional
from datetime import datetime

import joblib
import pandas as pd
import numpy as np
import sklearn.compose._column_transformer as _ct
from sklearn.impute import SimpleImputer

logger = logging.getLogger("FloodNowcastML.Predict")

# ---------------------------------------------------------------------------
# Backward compat shim (must be applied BEFORE loading any pkl)
# ---------------------------------------------------------------------------
if not hasattr(_ct, "_RemainderColsList"):
    class _RemainderColsList:
        """Backward compatibility shim for ColumnTransformer remainder list."""
        def __init__(self, *args, **kwargs):
            pass
    _ct._RemainderColsList = _RemainderColsList

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
MODEL_PATH       = os.path.join(BASE_DIR, "best_flood_model.pkl")
PREPROCESSOR_PATH = os.path.join(BASE_DIR, "preprocessor.pkl")
FEATURES_PATH    = os.path.join(BASE_DIR, "feature_columns.pkl")
META_PATH        = os.path.join(BASE_DIR, "feature_meta.json")

# ---------------------------------------------------------------------------
# Risk Thresholds — single source of truth
# ---------------------------------------------------------------------------
RISK_THRESHOLDS = [
    (0.75, 1.01, "CRITICAL", "#ef4444"),
    (0.50, 0.75, "HIGH",     "#f97316"),
    (0.30, 0.50, "MODERATE", "#eab308"),
    (0.00, 0.30, "LOW",      "#22c55e"),
]

# ---------------------------------------------------------------------------
# Lazy-loaded model assets
# ---------------------------------------------------------------------------
_model = None
_preprocessor = None
_feature_columns = None
_feature_meta = None


def _load_assets():
    """Load model artifacts lazily (once per process)."""
    global _model, _preprocessor, _feature_columns, _feature_meta

    if _model is not None:
        return  # Already loaded

    logger.info("Loading ML assets for predict.py ...")

    _feature_columns = joblib.load(FEATURES_PATH)

    with open(META_PATH, "r") as f:
        _feature_meta = json.load(f)

    _preprocessor = joblib.load(PREPROCESSOR_PATH)

    # Patch SimpleImputer for sklearn version compatibility
    for name, trans in _preprocessor.named_transformers_.items():
        if hasattr(trans, "named_steps"):
            for sname, step in trans.named_steps.items():
                if isinstance(step, SimpleImputer):
                    if not hasattr(step, "_fill_dtype") and hasattr(step, "_fit_dtype"):
                        step._fill_dtype = step._fit_dtype
                    elif not hasattr(step, "_fill_dtype"):
                        step._fill_dtype = np.float64

    _model = joblib.load(MODEL_PATH)
    # Patch SimpleImputer in _model pipeline
    for step_name, step_obj in getattr(_model, "steps", []):
        if hasattr(step_obj, "named_transformers_"):
            for tname, trans in step_obj.named_transformers_.items():
                if hasattr(trans, "named_steps"):
                    for sname, sstep in trans.named_steps.items():
                        if isinstance(sstep, SimpleImputer):
                            if not hasattr(sstep, "_fill_dtype") and hasattr(sstep, "_fit_dtype"):
                                sstep._fill_dtype = sstep._fit_dtype
                            elif not hasattr(sstep, "_fill_dtype"):
                                sstep._fill_dtype = np.float64
    logger.info(
        f"Assets loaded: model={type(_model).__name__}, "
        f"features={len(_feature_columns)}, "
        f"predict_proba={hasattr(_model, 'predict_proba')}"
    )


# ---------------------------------------------------------------------------
# Category Helpers
# ---------------------------------------------------------------------------
def _rainfall_category(mm: float) -> str:
    if mm <= 25:    return "Dry"
    elif mm <= 60:  return "Moderate"
    elif mm <= 100: return "Wet"
    else:           return "Very Wet"


def _humidity_category(h: float) -> str:
    if h <= 70:     return "Moderate"
    elif h <= 85:   return "High"
    else:           return "Very High"


def _temperature_category(t: float) -> str:
    if t < 20:      return "Cool"
    elif t < 26:    return "Mild"
    elif t < 32:    return "Warm"
    else:           return "Hot"


def _get_risk_level(prob: float):
    for low, high, level, color in RISK_THRESHOLDS:
        if low <= prob < high:
            return level, color
    return "CRITICAL", "#ef4444"


# ---------------------------------------------------------------------------
# Core predict function
# ---------------------------------------------------------------------------
def predict_flood(
    ward_id: str,
    weather_data: Dict[str, Any],
    wards_list: Optional[list] = None,
) -> Dict[str, Any]:
    """
    Predict flood risk for a ward using real-time weather data.

    Args:
        ward_id: Ward ID string (e.g., "behala-ward-120", "63", "120")
        weather_data: Dict from weather_service.get_weather_for_ward()
                      Required keys:
                        temperature, humidity, rainfall_24h_estimate_mm,
                        forecast_rainfall_mm, rainfall_1h_mm, temp_min, temp_max
        wards_list: Optional KOLKATA_WARDS list (auto-imports if None)

    Returns:
        {
            "ward": str,
            "weather": {...},
            "prediction": {
                "class": int,
                "label": str,
                "flood_probability": float,
                "safe_probability": float,
                "risk_level": str,
                "risk_color": str,
            },
            "model_info": {...},
            "timestamp": str,
        }

    Raises:
        ValueError: Invalid ward_id
        RuntimeError: Model not loaded or prediction failed
    """
    _load_assets()

    # Load wards if not provided
    if wards_list is None:
        from wards_data import KOLKATA_WARDS
        wards_list = KOLKATA_WARDS

    # Resolve ward
    ward = None
    ident = str(ward_id).strip().lower()
    for w in wards_list:
        if (str(w["ward_id"]) == ident
                or w["id"].lower() == ident
                or str(w["name"]).lower() == ident):
            ward = w
            break

    if ward is None:
        raise ValueError(
            f"Ward '{ward_id}' not found. "
            f"Valid IDs: {[w['id'] for w in wards_list]}"
        )

    # ---------------------------------------------------------------------------
    # Extract weather values (required — no silent fallbacks)
    # ---------------------------------------------------------------------------
    required_keys = [
        "temperature", "humidity", "rainfall_24h_estimate_mm",
        "forecast_rainfall_mm", "rainfall_1h_mm", "temp_min", "temp_max",
    ]
    for key in required_keys:
        if key not in weather_data:
            raise ValueError(
                f"weather_data is missing required key '{key}'. "
                f"Use weather_service.get_weather_for_ward() to fetch valid data."
            )

    temp          = float(weather_data["temperature"])
    humidity      = float(weather_data["humidity"])
    rainfall      = float(weather_data["rainfall_24h_estimate_mm"])
    forecast_rain = float(weather_data["forecast_rainfall_mm"])
    rain_1h       = float(weather_data["rainfall_1h_mm"])
    temp_min      = float(weather_data["temp_min"])
    temp_max      = float(weather_data["temp_max"])

    # Ward city-wide normals
    normal_rainfall = float(ward.get("citywide_normal_rainfall_mm", 50.0))
    normal_temp     = float(ward.get("citywide_normal_temperature_c", 29.0))

    # Derived values
    dev_rain = ((rainfall - normal_rainfall) / normal_rainfall * 100.0) if normal_rainfall else 0.0
    dev_temp = temp - normal_temp

    heat_idx = temp + (0.5555 * (6.11 * (10 ** ((7.5 * temp) / (237.3 + temp))) * (humidity / 100) - 10))

    month = datetime.now().month
    is_monsoon = 1 if month in (6, 7, 8, 9, 10) else 0
    forecast_error = abs(forecast_rain - rainfall) / max(rainfall, 1.0) * 100.0

    # ---------------------------------------------------------------------------
    # Build 60-feature record
    # ---------------------------------------------------------------------------
    record: Dict[str, Any] = {}

    # Initialize with defaults
    for col in _feature_columns:
        if col in _feature_meta.get("categorical_features", []):
            cats = _feature_meta.get("categories", {}).get(col, [])
            record[col] = cats[0] if cats else "Unknown"
        else:
            record[col] = 0.0

    # Ward structural baseline
    for k, v in ward.items():
        if k in _feature_columns:
            record[k] = v

    # Real-time weather features
    record.update({
        "avg_temperature_c":               temp,
        "avg_temperature_c_reference":     temp,
        "estimated_max_temperature_c":     temp_max,
        "estimated_min_temperature_c":     temp_min,
        "avg_humidity_percent":            humidity,
        "historical_rainfall_mm":          rainfall,
        "forecast_rainfall_mm":            forecast_rain,
        "rainfall_intensity":              rain_1h,
        "heat_index_c":                    round(heat_idx, 1),
        "deviation_from_normal_percent":   round(dev_rain, 1),
        "deviation_from_normal_c":         round(dev_temp, 1),
        "citywide_normal_temperature_c":   normal_temp,
        "month_idx":                       month,
        "is_monsoon":                      is_monsoon,
        "estimated_rainy_days":            18 if is_monsoon else 5,
        "forecast_vs_historical_error_percent": round(forecast_error, 1),
        "forecast_issue_lead_time_days":   1,
        "rainfall_category":               _rainfall_category(rainfall),
        "forecast_rainfall_category":      _rainfall_category(forecast_rain),
        "humidity_category":               _humidity_category(humidity),
        "temperature_category":            _temperature_category(temp),
    })

    # Build DataFrame in exact feature order
    df = pd.DataFrame([record])[_feature_columns]

    # ---------------------------------------------------------------------------
    # Run Model Pipeline (contains preprocessor + classifier)
    # ---------------------------------------------------------------------------
    try:
        preds = _model.predict(df)
        probs = _model.predict_proba(df) if hasattr(_model, "predict_proba") else None
    except Exception as exc:
        raise RuntimeError(f"Model prediction failed: {exc}") from exc

    prediction_int = int(preds[0])
    flood_prob     = float(probs[0][1]) if probs is not None else float(prediction_int)
    safe_prob      = float(probs[0][0]) if probs is not None else 1.0 - flood_prob

    risk_level, risk_color = _get_risk_level(flood_prob)

    return {
        "ward": ward["name"],
        "ward_id": ward["ward_id"],
        "ward_slug": ward["id"],
        "zone": ward["zone"],
        "elevation_m": ward["elevation_m"],
        "weather": {
            "temperature":               temp,
            "humidity":                  humidity,
            "rainfall_24h_estimate_mm":  rainfall,
            "forecast_rainfall_mm":      forecast_rain,
            "rainfall_intensity_1h":     rain_1h,
            "pressure":                  weather_data.get("pressure"),
            "wind_speed_kmh":            weather_data.get("wind_speed_kmh"),
            "weather_main":              weather_data.get("weather_main", "Unknown"),
            "weather_description":       weather_data.get("weather_description", ""),
            "observed_at_ist":           weather_data.get("observed_at_ist"),
        },
        "prediction": {
            "class": prediction_int,
            "label": "Flood Risk" if prediction_int == 1 else "Safe",
            "flood_probability": round(flood_prob, 4),
            "safe_probability": round(safe_prob, 4),
            "risk_level": risk_level,
            "risk_color": risk_color,
        },
        "model_info": {
            "algorithm": "RandomForestClassifier (sklearn Pipeline)",
            "feature_count": len(_feature_columns),
            "predict_proba_available": probs is not None,
            "version": "1.1.0",
        },
        "timestamp": datetime.now().isoformat(),
    }
