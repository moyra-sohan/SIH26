from fastapi import APIRouter, HTTPException
from typing import Dict, Any
from app.services.ward_service import ward_service
from app.services.model_service import model_service
from app.services.feature_builder import feature_builder
from app.services.risk_insights import risk_insights_service
from app.schemas.prediction import PredictionInput
from app.core.logging import logger
from weather_service import get_weather_for_ward, weather_to_model_features, get_api_key

router = APIRouter(tags=["Real-Time Weather & ML"])

WEATHER_REFRESH_INTERVAL_MINUTES = 10


@router.get("/weather/{ward_id}", summary="Get Real-Time Weather for a Ward")
def get_ward_weather(ward_id: str):
    """
    Fetch real-time weather for a Kolkata ward using its lat/lon.
    Uses OpenWeatherMap (if WEATHER_API_KEY is configured) or Open-Meteo live feed.
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
    except Exception as exc:
        error_msg = str(exc)
        logger.error(f"Weather fetch failed for ward '{ward_name}': {error_msg}")
        raise HTTPException(
            status_code=502,
            detail={
                "error": error_msg,
                "error_type": "weather_api_error",
                "ward": ward_name,
                "hint": "Check weather service or API keys"
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
    }


@router.get("/weather-predict/{ward_id}", summary="Ward Real-Time Weather + ML Prediction")
def get_ward_weather_prediction(ward_id: str):
    """
    Full pipeline: Ward -> Real-Time Weather -> ML Model -> Flood Prediction.
    """
    model_service.ensure_loaded()

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
    except Exception as exc:
        error_msg = str(exc)
        logger.error(f"Weather fetch failed for prediction - ward '{ward_name}': {error_msg}")
        raise HTTPException(
            status_code=503,
            detail={
                "error": f"Cannot run weather-based prediction: {error_msg}",
                "error_type": "weather_unavailable",
                "ward": ward_name,
                "hint": "Ensure weather service is reachable."
            }
        )

    weather_features = weather_to_model_features(weather, ward)

    payload = PredictionInput(
        ward_id=ward["id"],
        rainfall_mm=weather.get("rainfall_24h_estimate_mm", 82.0),
        forecast_rainfall_mm=weather.get("forecast_rainfall_mm", 90.0),
        avg_humidity_percent=float(weather.get("humidity", 80)),
        avg_temperature_c=weather.get("temperature", 28.0),
        is_monsoon=weather_features.get("is_monsoon", 1),
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

        insights = risk_insights_service.generate_risk_insights(
            flood_prob, prediction_int, summary
        )
    except Exception as exc:
        logger.error(f"ML prediction failed for ward '{ward_name}': {exc}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"ML prediction failed after weather fetch: {str(exc)}"
        )

    weather_summary = {
        "temperature": weather.get("temperature"),
        "feels_like": weather.get("feels_like"),
        "humidity": weather.get("humidity"),
        "pressure": weather.get("pressure"),
        "wind_speed_kmh": weather.get("wind_speed_kmh"),
        "cloud_cover": weather.get("cloud_cover"),
        "rainfall_1h_mm": weather.get("rainfall_1h_mm"),
        "rainfall_24h_estimate_mm": weather.get("rainfall_24h_estimate_mm"),
        "forecast_rainfall_mm": weather.get("forecast_rainfall_mm"),
        "weather_main": weather.get("weather_main"),
        "weather_description": weather.get("weather_description"),
        "weather_icon": weather.get("weather_icon"),
        "observed_at_ist": weather.get("observed_at_ist"),
        "source": weather.get("source", "open_meteo"),
        "rainfall_note": weather.get("rainfall_note", ""),
    }

    return {
        "success": True,
        "data_source": "real_time_weather",
        "ward": ward_name,
        "ward_id": ward["ward_id"],
        "ward_slug": ward["id"],
        "zone": ward["zone"],
        "elevation_m": ward["elevation_m"],
        "weather": weather_summary,
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
        "model_info": {
            "version": "1.1.0",
            "algorithm": "RandomForestClassifier (sklearn Pipeline)",
            "feature_count": len(model_service.feature_columns),
            "weather_features_used": list(weather_features.keys()),
            "predict_proba_available": True,
        },
        "weather_refresh_interval_minutes": WEATHER_REFRESH_INTERVAL_MINUTES,
    }
