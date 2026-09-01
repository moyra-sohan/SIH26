import os
import sys
import json
import logging
from typing import Dict, List, Any, Optional
from datetime import datetime

import joblib
import pandas as pd
import numpy as np
from fastapi import FastAPI, HTTPException, Query, Body
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
import sklearn.compose._column_transformer as _ct
from sklearn.impute import SimpleImputer

from wards_data import KOLKATA_WARDS

# ---------------------------------------------------------
# Logging Configuration
# ---------------------------------------------------------
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger("FloodNowcastML")

# ---------------------------------------------------------
# Compatibility Shims for Scikit-Learn Model Loading
# ---------------------------------------------------------
if not hasattr(_ct, "_RemainderColsList"):
    class _RemainderColsList:
        """Backward compatibility shim for ColumnTransformer remainder list."""
        def __init__(self, *args, **kwargs):
            pass
    _ct._RemainderColsList = _RemainderColsList

# ---------------------------------------------------------
# Global Model Storage & Initialization
# ---------------------------------------------------------
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
MODEL_PATH = os.path.join(BASE_DIR, "best_flood_model.pkl")
FEATURES_PATH = os.path.join(BASE_DIR, "feature_columns.pkl")
PREPROCESSOR_PATH = os.path.join(BASE_DIR, "preprocessor.pkl")
META_PATH = os.path.join(BASE_DIR, "feature_meta.json")

model = None
feature_columns: List[str] = []
feature_meta: Dict[str, Any] = {}

def load_ml_assets():
    global model, feature_columns, feature_meta
    try:
        logger.info(f"Loading feature columns from: {FEATURES_PATH}")
        feature_columns = joblib.load(FEATURES_PATH)
        logger.info(f"Loaded {len(feature_columns)} feature columns successfully.")

        if os.path.exists(META_PATH):
            with open(META_PATH, "r") as f:
                feature_meta = json.load(f)
        else:
            feature_meta = {"all_features": feature_columns, "numeric_features": [], "categorical_features": {}}

        logger.info(f"Loading model pipeline from: {MODEL_PATH}")
        model = joblib.load(MODEL_PATH)
        logger.info(f"Model loaded: {type(model)}")

        # Patch SimpleImputer attributes on loaded pipeline for forward compatibility
        for step_name, step_obj in getattr(model, "steps", []):
            if hasattr(step_obj, "named_transformers_"):
                for tname, trans in step_obj.named_transformers_.items():
                    if hasattr(trans, "named_steps"):
                        for sname, sstep in trans.named_steps.items():
                            if isinstance(sstep, SimpleImputer):
                                if not hasattr(sstep, "_fill_dtype") and hasattr(sstep, "_fit_dtype"):
                                    sstep._fill_dtype = sstep._fit_dtype
                                elif not hasattr(sstep, "_fill_dtype"):
                                    sstep._fill_dtype = np.float64
                                logger.info(f"Patched imputer in model: {tname}.{sname}")
        logger.info("ML Pipeline initialized and ready for real-time inference.")
    except Exception as e:
        logger.error(f"Error loading ML assets: {e}", exc_info=True)
        raise RuntimeError(f"Failed to load ML artifacts: {e}")

load_ml_assets()

# ---------------------------------------------------------
# FastAPI App & CORS Setup
# ---------------------------------------------------------
app = FastAPI(
    title="Urban Flood Nowcasting Machine Learning API",
    description="High-resolution Machine Learning backend for Kolkata urban flood risk nowcasting and waterlogging prediction.",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------------------------------------
# Pydantic Schemas
# ---------------------------------------------------------
class PredictionInput(BaseModel):
    ward_id: Optional[Any] = Field(default=None, description="Kolkata Ward ID or slug (e.g., 63, 120, 'behala-ward-120')")
    rainfall_mm: Optional[float] = Field(default=None, description="Recorded 24h rainfall in mm")
    forecast_rainfall_mm: Optional[float] = Field(default=None, description="Forecasted rainfall for next 24h in mm")
    rainfall_intensity: Optional[float] = Field(default=None, description="Peak rainfall intensity in mm/hr")
    avg_humidity_percent: Optional[float] = Field(default=None, description="Average relative humidity %")
    avg_temperature_c: Optional[float] = Field(default=None, description="Ambient temperature in °C")
    drain_efficiency_index: Optional[float] = Field(default=None, description="Drainage operational efficiency (1 to 10)")
    drain_load_utilization_percent: Optional[float] = Field(default=None, description="Drainage capacity load %")
    silt_accumulation_level: Optional[str] = Field(default=None, description="Low, Moderate, High, or Very High")
    is_monsoon: Optional[int] = Field(default=1, description="1 if monsoon period, 0 otherwise")
    custom_features: Optional[Dict[str, Any]] = Field(default=None, description="Direct overrides for any of the 60 feature fields")

class BatchPredictionInput(BaseModel):
    items: List[PredictionInput]

# ---------------------------------------------------------
# Helper Functions
# ---------------------------------------------------------
def get_ward_by_identifier(identifier: Any) -> Optional[Dict[str, Any]]:
    if identifier is None:
        return None
    ident_str = str(identifier).strip().lower()
    for w in KOLKATA_WARDS:
        if str(w["ward_id"]) == ident_str or w["id"].lower() == ident_str or str(w["name"]).lower() == ident_str:
            return w
    return None

def determine_rainfall_category(mm: float) -> str:
    if mm <= 25:
        return "Dry"
    elif mm <= 60:
        return "Moderate"
    elif mm <= 100:
        return "Wet"
    else:
        return "Very Wet"

def determine_humidity_category(h: float) -> str:
    if h <= 70:
        return "Moderate"
    elif h <= 85:
        return "High"
    else:
        return "Very High"

def determine_temperature_category(t: float) -> str:
    if t < 20:
        return "Cool"
    elif t < 26:
        return "Mild"
    elif t < 32:
        return "Warm"
    else:
        return "Hot"

def build_feature_dict(input_data: PredictionInput) -> tuple[pd.DataFrame, Dict[str, Any]]:
    """Builds a complete, valid single-row DataFrame aligned with feature_columns."""
    ward_profile = get_ward_by_identifier(input_data.ward_id)
    if not ward_profile:
        ward_profile = KOLKATA_WARDS[0] # Default to Behala / Ward 120

    record: Dict[str, Any] = {}

    # Initialize all columns with defaults
    for col in feature_columns:
        if col in feature_meta.get("categorical_features", []):
            cats = feature_meta.get("categories", {}).get(col, [])
            record[col] = cats[0] if cats else "Unknown"
        else:
            record[col] = 0.0

    # Fill baseline values from the selected ward profile
    for k, v in ward_profile.items():
        if k in feature_columns:
            record[k] = v

    # Current/weather parameters
    rainfall = input_data.rainfall_mm if input_data.rainfall_mm is not None else 82.0
    forecast_rain = input_data.forecast_rainfall_mm if input_data.forecast_rainfall_mm is not None else rainfall * 1.05
    intensity = input_data.rainfall_intensity if input_data.rainfall_intensity is not None else (rainfall / 4.0)
    humidity = input_data.avg_humidity_percent if input_data.avg_humidity_percent is not None else 84.0
    temp = input_data.avg_temperature_c if input_data.avg_temperature_c is not None else 28.0
    drain_eff = input_data.drain_efficiency_index if input_data.drain_efficiency_index is not None else ward_profile.get("drainage_index_1to10", 4.5)
    drain_load = input_data.drain_load_utilization_percent if input_data.drain_load_utilization_percent is not None else ward_profile.get("drain_load_utilization_percent", 75.0)
    silt_level = input_data.silt_accumulation_level or ward_profile.get("silt_accumulation_level", "High")
    is_monsoon = input_data.is_monsoon if input_data.is_monsoon is not None else 1

    normal_rainfall = ward_profile.get("citywide_normal_rainfall_mm", 50.0)
    dev_percent = ((rainfall - normal_rainfall) / normal_rainfall) * 100.0 if normal_rainfall else 0.0

    record.update({
        "historical_rainfall_mm": rainfall,
        "forecast_rainfall_mm": forecast_rain,
        "rainfall_intensity": intensity,
        "avg_humidity_percent": humidity,
        "avg_temperature_c": temp,
        "drain_efficiency_index": drain_eff,
        "drain_load_utilization_percent": drain_load,
        "silt_accumulation_level": silt_level,
        "is_monsoon": is_monsoon,
        "deviation_from_normal_percent": dev_percent,
        "month_idx": datetime.now().month,
        "rainfall_category": determine_rainfall_category(rainfall),
        "forecast_rainfall_category": determine_rainfall_category(forecast_rain),
        "humidity_category": determine_humidity_category(humidity),
        "temperature_category": determine_temperature_category(temp),
        "heat_index_c": temp + (0.5555 * (6.11 * (10 ** ((7.5 * temp) / (237.3 + temp))) * (humidity / 100) - 10)),
        "forecast_issue_lead_time_days": 1,
    })

    # Apply custom overrides if specified
    if input_data.custom_features:
        for k, v in input_data.custom_features.items():
            if k in feature_columns:
                record[k] = v

    df = pd.DataFrame([record])[feature_columns]
    return df, {
        "ward": ward_profile["name"],
        "ward_id": ward_profile["ward_id"],
        "zone": ward_profile["zone"],
        "elevation_m": ward_profile["elevation_m"],
        "rainfall_mm": rainfall,
        "forecast_rainfall_mm": forecast_rain,
        "humidity_percent": humidity,
        "temperature_c": temp,
        "drainage_load_percent": drain_load,
        "drain_efficiency_index": drain_eff,
    }

def generate_risk_insights(prob: float, pred: int, summary: Dict[str, Any]) -> Dict[str, Any]:
    """Generates user-friendly risk levels, colors, waterlogging estimations, and advisories."""
    if prob >= 0.75:
        risk_level = "Critical"
        risk_color = "#ef4444"
        depth_cm = round(15.0 + (prob - 0.75) * 60.0 + (summary["rainfall_mm"] * 0.15), 1)
        duration_hrs = round(3.5 + (prob * 4.0), 1)
        advisories = [
            "Severe waterlogging expected in major arterial roads and low-lying sectors.",
            "High-capacity municipal stormwater pumps operating at peak load.",
            "Avoid travel through underpasses and canal-adjacent routes.",
            "Move electrical appliances and vehicles to elevated areas.",
        ]
        status_text = "High Risk - Rising"
    elif prob >= 0.50:
        risk_level = "High"
        risk_color = "#f97316"
        depth_cm = round(8.0 + (prob - 0.50) * 30.0 + (summary["rainfall_mm"] * 0.08), 1)
        duration_hrs = round(2.0 + (prob * 3.0), 1)
        advisories = [
            "Moderate to high water accumulation detected on key roads.",
            "Traffic diversions likely in effect near low-elevation ward zones.",
            "Keep emergency contact numbers handy and monitor rainfall nowcasts.",
        ]
        status_text = "Elevated Risk"
    elif prob >= 0.30:
        risk_level = "Moderate"
        risk_color = "#eab308"
        depth_cm = round(3.0 + (prob - 0.30) * 15.0, 1)
        duration_hrs = round(1.0 + (prob * 2.0), 1)
        advisories = [
            "Localized minor puddle formation in internal streets.",
            "Drainage systems are clearing stormwater steadily.",
            "Exercise caution while driving or commuting in peak rain hours.",
        ]
        status_text = "Moderate Warning"
    else:
        risk_level = "Low"
        risk_color = "#22c55e"
        depth_cm = round(max(0.0, prob * 5.0), 1)
        duration_hrs = 0.5
        advisories = [
            "Normal urban conditions. Storm drains operating with optimal clearance.",
            "Safe for transit and outdoor activities.",
        ]
        status_text = "Safe / Low Risk"

    # Identify primary risk drivers
    key_drivers = []
    if summary["elevation_m"] <= 5.0:
        key_drivers.append(f"Low Elevation ({summary['elevation_m']}m MSL)")
    if summary["rainfall_mm"] >= 65.0:
        key_drivers.append(f"Heavy Rainfall ({summary['rainfall_mm']}mm/24h)")
    if summary["drainage_load_percent"] >= 80.0:
        key_drivers.append(f"High Drainage Load ({summary['drainage_load_percent']}%)")
    if summary["drain_efficiency_index"] <= 4.0:
        key_drivers.append("Reduced Drainage Capacity / Silt Accumulation")
    if not key_drivers:
        key_drivers.append("Standard Monsoon Baseline")

    return {
        "risk_level": risk_level,
        "risk_color": risk_color,
        "status_text": status_text,
        "estimated_waterlogging_depth_cm": depth_cm,
        "estimated_duration_hours": duration_hrs,
        "advisories": advisories,
        "key_risk_drivers": key_drivers
    }

# ---------------------------------------------------------
# API Endpoints
# ---------------------------------------------------------
@app.get("/")
def root():
    return {
        "service": "Urban Flood Nowcasting ML API",
        "version": "1.0.0",
        "status": "online",
        "endpoints": [
            "/health",
            "/api/features",
            "/api/wards",
            "/api/predict",
            "/api/ward-forecasts",
            "/api/batch-predict",
        ],
        "timestamp": datetime.now().isoformat()
    }

@app.get("/health")
def health():
    return {
        "status": "healthy",
        "model_loaded": model is not None,
        "feature_count": len(feature_columns),
        "wards_count": len(KOLKATA_WARDS),
        "timestamp": datetime.now().isoformat()
    }

@app.get("/api/features")
def get_features():
    return {
        "total_features": len(feature_columns),
        "feature_columns": feature_columns,
        "meta": feature_meta
    }

@app.get("/api/wards")
def get_wards():
    return {
        "count": len(KOLKATA_WARDS),
        "wards": KOLKATA_WARDS
    }

@app.post("/api/predict")
def predict_flood_risk(payload: PredictionInput):
    if model is None:
        raise HTTPException(status_code=503, detail="ML model is not loaded.")

    try:
        df, summary = build_feature_dict(payload)
        preds = model.predict(df)
        probs = model.predict_proba(df)

        prediction_int = int(preds[0])
        flood_prob = float(probs[0][1])
        safe_prob = float(probs[0][0])

        insights = generate_risk_insights(flood_prob, prediction_int, summary)

        return {
            "success": True,
            "prediction": prediction_int,
            "is_flood_risk": bool(prediction_int == 1 or flood_prob >= 0.5),
            "flood_probability": round(flood_prob, 4),
            "safe_probability": round(safe_prob, 4),
            "risk_index": round(flood_prob, 2),
            **insights,
            "inputs_summary": summary,
            "timestamp": datetime.now().isoformat()
        }
    except Exception as e:
        logger.error(f"Prediction failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Prediction error: {str(e)}")

@app.get("/api/ward-forecasts")
def get_all_ward_forecasts(
    current_rainfall: float = Query(82.0, description="Citywide rainfall in mm"),
    is_monsoon: int = Query(1, description="Monsoon toggle")
):
    """Calculates real-time ML flood predictions across all monitored Kolkata wards."""
    if model is None:
        raise HTTPException(status_code=503, detail="ML model is not loaded.")

    results = []
    for ward in KOLKATA_WARDS:
        try:
            # Vary local rainfall slightly per ward zone for realistic spatial nowcasting
            zone_modifier = {
                "Central": 1.0,
                "North Central": 1.15,
                "Central East": 1.08,
                "East": 0.85,
                "North": 0.95
            }.get(ward["zone"], 1.0)
            
            ward_rain = round(current_rainfall * zone_modifier, 1)

            inp = PredictionInput(
                ward_id=ward["id"],
                rainfall_mm=ward_rain,
                forecast_rainfall_mm=round(ward_rain * 1.1, 1),
                avg_humidity_percent=82.0,
                avg_temperature_c=28.0,
                is_monsoon=is_monsoon
            )

            df, summary = build_feature_dict(inp)
            preds = model.predict(df)
            probs = model.predict_proba(df)

            p_int = int(preds[0])
            prob = float(probs[0][1])
            insights = generate_risk_insights(prob, p_int, summary)

            results.append({
                "ward_id": ward["ward_id"],
                "slug": ward["id"],
                "name": ward["name"],
                "zone": ward["zone"],
                "coordinates": [ward["longitude"], ward["latitude"]],
                "elevation_m": ward["elevation_m"],
                "rainfall_mm": ward_rain,
                "prediction": p_int,
                "flood_probability": round(prob, 3),
                "risk_index": round(prob, 2),
                **insights
            })
        except Exception as e:
            logger.warning(f"Error computing forecast for ward {ward['name']}: {e}")

    return {
        "count": len(results),
        "citywide_rainfall_mm": current_rainfall,
        "is_monsoon": bool(is_monsoon),
        "forecasts": results,
        "timestamp": datetime.now().isoformat()
    }

@app.post("/api/batch-predict")
def batch_predict(payload: BatchPredictionInput):
    results = []
    for item in payload.items:
        try:
            df, summary = build_feature_dict(item)
            preds = model.predict(df)
            probs = model.predict_proba(df)

            p_int = int(preds[0])
            prob = float(probs[0][1])
            insights = generate_risk_insights(prob, p_int, summary)

            results.append({
                "success": True,
                "prediction": p_int,
                "flood_probability": round(prob, 4),
                **insights,
                "summary": summary
            })
        except Exception as e:
            results.append({
                "success": False,
                "error": str(e)
            })

    return {
        "count": len(results),
        "results": results,
        "timestamp": datetime.now().isoformat()
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app:app", host="0.0.0.0", port=8000, reload=True)
