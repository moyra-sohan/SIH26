"""
Real-Time Weather & Weather-Based ML Prediction Endpoints.

- GET /api/weather/{ward_id}: Fetch live weather from OpenWeatherMap for a ward.
- GET /api/weather-predict/{ward_id}: Full pipeline: Weather → ML Model → Flood Prediction.
"""
import os
from datetime import datetime
from fastapi import APIRouter, HTTPException

from app.core.logging import logger
from app.services.ward_service import ward_service
from app.services.model_service import model_service
from app.services.feature_builder import feature_builder
from app.services.risk_insights import risk_insights_service
from app.schemas.prediction import PredictionInput

# Import weather service from root-level module
from weather_service import get_weather_for_ward, weather_to_model_features

# Weather refresh interval (informational — enforced on frontend)
WEATHER_REFRESH_INTERVAL_MINUTES = int(os.environ.get("WEATHER_REFRESH_INTERVAL_MINUTES", "10"))

router = APIRouter(tags=["Real-Time Weather"])


@router.get("/weather/{ward_id}", summary="Fetch Real-Time Weather for a Ward")
def get_ward_weather(ward_id: str):
    """
    Fetch real-time weather for a Kolkata ward using its lat/lon.

    Calls OpenWeatherMap API (key from WEATHER_API_KEY env var).
    Never returns fabricated values — returns 503 with clear error on any failure.
    """
    ward = ward_service.get_ward_by_identifier(ward_id)
    if not ward:
        raise HTTPException(
            status_code=404,
            detail=f"Ward '{ward_id}' not found. Use /api/wards to list valid ward IDs."
        )

    lat = ward["latitude"]
    lon = ward["longitude"]
    ward_name = ward["name"]

    try:
        weather = get_weather_for_ward(lat=lat, lon=lon, ward_name=ward_name, include_forecast=True)
    except RuntimeError as exc:
        error_msg = str(exc)
        logger.error(f"Weather fetch failed for ward '{ward_name}': {error_msg}")

        # Classify error type for helpful frontend display
        if "WEATHER_API_KEY" in error_msg and "not set" in error_msg:
            status_code = 503
            error_type = "api_key_missing"
        elif "Invalid" in error_msg and "KEY" in error_msg:
            status_code = 502
            error_type = "invalid_api_key"
        elif "rate limit" in error_msg.lower():
            status_code = 429
            error_type = "rate_limit"
        elif "timed out" in error_msg.lower():
            status_code = 504
            error_type = "timeout"
        else:
            status_code = 502
            error_type = "weather_api_error"

        raise HTTPException(
            status_code=status_code,
            detail={
                "error": error_msg,
                "error_type": error_type,
                "ward": ward_name,
                "hint": "Set WEATHER_API_KEY in backend/.env or Model/.env"
            }
        )

    return {
        "success": True,
        "ward_id": ward["ward_id"],
        "ward_slug": ward["id"],
        "ward_name": ward_name,
        "zone": ward["zone"],
        "weather": weather,
        "weather_refresh_interval_minutes": WEATHER_REFRESH_INTERVAL_MINUTES,
        "timestamp": datetime.now().isoformat(),
    }


@router.get("/weather-predict/{ward_id}", summary="Weather → ML Prediction Pipeline")
def get_ward_weather_prediction(ward_id: str):
    """
    Full pipeline: Ward → Real-Time Weather → ML Model → Flood Prediction.

    1. Resolves ward lat/lon from KOLKATA_WARDS
    2. Fetches live weather from OpenWeatherMap
    3. Maps weather to model features via weather_to_model_features()
    4. Combines with ward structural baseline via build_feature_dict()
    5. Runs preprocessor.pkl + best_flood_model.pkl
    6. Returns prediction + weather + risk level

    The ML model genuinely uses real-time weather features (CASE A):
    avg_temperature_c, avg_humidity_percent, historical_rainfall_mm,
    forecast_rainfall_mm, rainfall_intensity, heat_index_c + derived categories.
    """
    if not model_service.is_loaded:
        raise HTTPException(status_code=503, detail="ML model is not loaded.")

    ward = ward_service.get_ward_by_identifier(ward_id)
    if not ward:
        raise HTTPException(
            status_code=404,
            detail=f"Ward '{ward_id}' not found. Use /api/wards to list valid ward IDs."
        )

    lat = ward["latitude"]
    lon = ward["longitude"]
    ward_name = ward["name"]

    # --- Step 1: Fetch real-time weather ---
    try:
        weather = get_weather_for_ward(lat=lat, lon=lon, ward_name=ward_name, include_forecast=True)
    except RuntimeError as exc:
        error_msg = str(exc)
        logger.error(f"Weather fetch failed for prediction — ward '{ward_name}': {error_msg}")
        raise HTTPException(
            status_code=503,
            detail={
                "error": f"Cannot run weather-based prediction: {error_msg}",
                "error_type": "weather_unavailable",
                "ward": ward_name,
                "hint": "Ensure WEATHER_API_KEY is set and the API is reachable."
            }
        )

    # --- Step 2: Map weather to model features ---
    weather_features = weather_to_model_features(weather, ward)

    # --- Step 3: Build 60-feature DataFrame using existing pipeline ---
    # Inject weather features as custom overrides into PredictionInput
    payload = PredictionInput(
        ward_id=ward["id"],
        rainfall_mm=weather["rainfall_24h_estimate_mm"],
        forecast_rainfall_mm=weather["forecast_rainfall_mm"],
        avg_humidity_percent=float(weather["humidity"]),
        avg_temperature_c=weather["temperature"],
        is_monsoon=weather_features["is_monsoon"],
        custom_features=weather_features,
    )

    try:
        df, summary = feature_builder.build_feature_dataframe(
            payload, model_service.feature_columns, model_service.feature_meta
        )
        preds = model_service.model.predict(df)
        probs = model_service.model.predict_proba(df)

        prediction_int = int(preds[0])
        flood_prob = float(probs[0][1])
        safe_prob = float(probs[0][0])

        insights = risk_insights_service.generate_risk_insights(flood_prob, prediction_int, summary)

    except Exception as exc:
        logger.error(f"ML prediction failed for ward '{ward_name}': {exc}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"ML prediction failed after weather fetch: {str(exc)}"
        )

    # --- Step 4: Build response ---
    # Concise weather summary for the response (excludes raw metadata)
    weather_summary = {
        "temperature":           weather["temperature"],
        "feels_like":            weather["feels_like"],
        "humidity":              weather["humidity"],
        "pressure":              weather["pressure"],
        "wind_speed_kmh":        weather["wind_speed_kmh"],
        "cloud_cover":           weather["cloud_cover"],
        "rainfall_1h_mm":        weather["rainfall_1h_mm"],
        "rainfall_24h_estimate_mm": weather["rainfall_24h_estimate_mm"],
        "forecast_rainfall_mm": weather["forecast_rainfall_mm"],
        "weather_main":          weather["weather_main"],
        "weather_description":   weather["weather_description"],
        "weather_icon":          weather["weather_icon"],
        "observed_at_ist":       weather["observed_at_ist"],
        "source":                "openweathermap",
        "rainfall_note":         weather.get("rainfall_note", ""),
    }

    return {
        "success": True,
        "data_source": "real_time_weather",
        "ward": ward_name,
        "ward_id": ward["ward_id"],
        "ward_slug": ward["id"],
        "zone": ward["zone"],
        "elevation_m": ward["elevation_m"],

        # Real-time weather used by the model
        "weather": weather_summary,

        # ML Model prediction
        "prediction": {
            "class": prediction_int,
            "label": "Flood Risk" if prediction_int == 1 else "Safe",
            "flood_probability": round(flood_prob, 4),
            "safe_probability": round(safe_prob, 4),
            "risk_level": insights["risk_level"],
            "risk_color": insights["risk_color"],
            "status_text": insights["status_text"],
            "estimated_waterlogging_depth_cm": insights["estimated_waterlogging_depth_cm"],
            "estimated_duration_hours": insights["estimated_duration_hours"],
            "advisories": insights["advisories"],
            "key_risk_drivers": insights["key_risk_drivers"],
        },

        # Model info
        "model_info": {
            "version": "1.1.0",
            "algorithm": "RandomForestClassifier (sklearn Pipeline)",
            "feature_count": len(model_service.feature_columns),
            "weather_features_used": list(weather_features.keys()),
            "predict_proba_available": True,
        },

        "weather_refresh_interval_minutes": WEATHER_REFRESH_INTERVAL_MINUTES,
        "timestamp": datetime.now().isoformat(),
    }
