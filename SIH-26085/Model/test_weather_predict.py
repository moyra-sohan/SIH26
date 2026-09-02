"""
test_weather_predict.py — End-to-end test: Ward → Weather → ML Model → Prediction

Tests the full pipeline from ward selection to flood probability output.
Requires WEATHER_API_KEY to be set.

Run:
    cd d:\SIH_2026\github\SIH26\SIH-26085\Model
    python test_weather_predict.py
"""

import os
import sys

# Compat shim FIRST
import sklearn.compose._column_transformer as _ct
if not hasattr(_ct, "_RemainderColsList"):
    class _RemainderColsList:
        def __init__(self, *args, **kwargs): pass
    _ct._RemainderColsList = _RemainderColsList

from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(os.path.abspath(__file__)), ".env"))

API_KEY = os.environ.get("WEATHER_API_KEY", "").strip()

PASS = "[PASS]"
FAIL = "[FAIL]"
failures = []

def check(condition: bool, name: str, detail: str = ""):
    if condition:
        print(f"  {PASS}  {name}")
    else:
        msg = f"  {FAIL}  {name}" + (f"  [{detail}]" if detail else "")
        print(msg)
        failures.append(name)


print("\n" + "="*60)
print("  END-TO-END WEATHER PREDICT TEST")
print("="*60)

# ----------------------------------------------------------------
# Phase A: Test existing model pipeline (no weather API needed)
# ----------------------------------------------------------------
print("\n[A] Existing model pipeline (test_predict_pipeline baseline)")

from wards_data import KOLKATA_WARDS
from predict import predict_flood

# Build a mock weather dict with known values to test without a live API key
MOCK_WEATHER = {
    "temperature":               31.0,
    "humidity":                  88.0,
    "rainfall_24h_estimate_mm":  95.0,
    "forecast_rainfall_mm":      80.0,
    "rainfall_1h_mm":            4.0,
    "temp_min":                  27.0,
    "temp_max":                  34.0,
    "pressure":                  1002.0,
    "wind_speed_kmh":            14.4,
    "weather_main":              "Rain",
    "weather_description":       "moderate rain",
    "observed_at_ist":           "2026-09-02T12:00:00+05:30",
    # required by weather_to_model_features in predict.py
    "rainfall_note":             "mock",
}

test_wards = [
    "behala-ward-120",
    "park-street-ward-63",
    "salt-lake-sector-5",
    "new-town-action-area-1",
]

for ward_slug in test_wards:
    try:
        result = predict_flood(ward_slug, MOCK_WEATHER)

        check("prediction" in result, f"[{ward_slug}] prediction key present")
        pred = result["prediction"]

        check(pred["class"] in (0, 1), f"[{ward_slug}] class is 0 or 1",
              f"got {pred['class']}")
        check(0.0 <= pred["flood_probability"] <= 1.0,
              f"[{ward_slug}] flood_probability in [0,1]",
              f"got {pred['flood_probability']}")
        check(0.0 <= pred["safe_probability"] <= 1.0,
              f"[{ward_slug}] safe_probability in [0,1]",
              f"got {pred['safe_probability']}")
        check(abs(pred["flood_probability"] + pred["safe_probability"] - 1.0) < 0.001,
              f"[{ward_slug}] probabilities sum to ~1.0")
        check(pred["risk_level"] in ("LOW", "MODERATE", "HIGH", "CRITICAL"),
              f"[{ward_slug}] risk_level valid",
              f"got {pred['risk_level']}")
        check("model_info" in result, f"[{ward_slug}] model_info present")
        check(result["model_info"]["predict_proba_available"],
              f"[{ward_slug}] predict_proba available")

        print(f"\n    > {result['ward']} ({result['zone']})")
        print(f"      Flood prob: {pred['flood_probability']:.4f}  "
              f"Risk: {pred['risk_level']}  "
              f"Label: {pred['label']}")

    except Exception as exc:
        print(f"  {FAIL}  [{ward_slug}] predict_flood() raised: {type(exc).__name__}: {exc}")
        failures.append(f"predict_flood({ward_slug})")
        import traceback
        traceback.print_exc()

# ----------------------------------------------------------------
# Phase B: Live API test (only if key is set)
# ----------------------------------------------------------------
if not API_KEY:
    print("\n[B] Live API test — SKIPPED (WEATHER_API_KEY not set)")
    print("    To run: add WEATHER_API_KEY to Model/.env")
else:
    print("\n[B] Live API test — Ward → OpenWeatherMap → Model")
    from weather_service import get_weather_for_ward

    ward_obj = next(w for w in KOLKATA_WARDS if w["id"] == "behala-ward-120")

    try:
        print(f"    Fetching live weather for {ward_obj['name']} "
              f"({ward_obj['latitude']}, {ward_obj['longitude']})...")
        live_weather = get_weather_for_ward(
            lat=ward_obj["latitude"],
            lon=ward_obj["longitude"],
            ward_name=ward_obj["name"],
            include_forecast=True,
        )

        check("temperature" in live_weather, "Live weather: temperature present")
        check("humidity" in live_weather, "Live weather: humidity present")
        check("rainfall_24h_estimate_mm" in live_weather, "Live weather: rainfall present")

        live_result = predict_flood("behala-ward-120", live_weather)

        pred = live_result["prediction"]
        check(0.0 <= pred["flood_probability"] <= 1.0,
              "Live prediction: flood_probability in [0,1]",
              f"got {pred['flood_probability']}")
        check(pred["risk_level"] in ("LOW", "MODERATE", "HIGH", "CRITICAL"),
              f"Live prediction: risk_level valid",
              f"got {pred['risk_level']}")

        print(f"\n    ➤ LIVE RESULT for {live_result['ward']}:")
        print(f"      Real-time temp: {live_weather['temperature']}°C")
        print(f"      Real-time humidity: {live_weather['humidity']}%")
        print(f"      Real-time rainfall (1h): {live_weather['rainfall_1h_mm']}mm")
        print(f"      Forecast 24h: {live_weather['forecast_rainfall_mm']}mm")
        print(f"      ML Flood Probability: {pred['flood_probability']:.4f}")
        print(f"      Risk Level: {pred['risk_level']}")
        print(f"      Source: {live_weather['source']}")

    except RuntimeError as exc:
        print(f"  {FAIL}  Live weather fetch failed: {exc}")
        failures.append("live API fetch")
    except Exception as exc:
        print(f"  {FAIL}  Live prediction failed: {type(exc).__name__}: {exc}")
        failures.append("live prediction")
        import traceback
        traceback.print_exc()

# ----------------------------------------------------------------
# Summary
# ----------------------------------------------------------------
print("\n" + "="*60)
if not failures:
    print("  [SUCCESS] ALL TESTS PASSED")
else:
    print(f"  [FAILURE] FAILED: {len(failures)} test(s)")
    for f in failures:
        print(f"    - {f}")
print("="*60)
sys.exit(1 if failures else 0)
