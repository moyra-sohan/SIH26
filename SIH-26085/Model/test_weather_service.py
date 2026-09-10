"""
test_weather_service.py — Verify real-time weather API integration.

Tests the OpenWeatherMap call for Kolkata center coordinates.
Does NOT hardcode expected weather values (weather changes!).
Only asserts structural presence and realistic value ranges.

Run:
    cd d:\SIH_2026\github\SIH26\SIH-26085\Model
    python test_weather_service.py
"""

import os
import sys
import json

# Apply compat shim before anything else
import sklearn.compose._column_transformer as _ct
if not hasattr(_ct, "_RemainderColsList"):
    class _RemainderColsList:
        def __init__(self, *args, **kwargs): pass
    _ct._RemainderColsList = _RemainderColsList

from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(os.path.abspath(__file__)), ".env"))

# ----------------------------------------------------------------
# Pre-flight: check API key
# ----------------------------------------------------------------
API_KEY = os.environ.get("WEATHER_API_KEY", "").strip()
if not API_KEY:
    print("\n" + "="*60)
    print("  WEATHER_API_KEY is not set.")
    print("  Add it to Model/.env or backend/.env:")
    print("  WEATHER_API_KEY=your_openweathermap_key")
    print("="*60)
    print("\nSkipping live API tests (no key available).")
    print("To get a free key: https://home.openweathermap.org/api_keys")
    sys.exit(0)

from weather_service import (
    fetch_current_weather,
    fetch_forecast_rainfall_24h,
    get_weather_for_ward,
    weather_to_model_features,
)

# Kolkata city center — used as the test location
KOLKATA_LAT = 22.5726
KOLKATA_LON = 88.3639

PASS = "[PASS]"
FAIL = "[FAIL]"

failures = []

def check(condition: bool, name: str, detail: str = ""):
    if condition:
        print(f"  {PASS}  {name}")
    else:
        msg = f"  {FAIL}  {name}" + (f" — {detail}" if detail else "")
        print(msg)
        failures.append(name)


print("\n" + "="*60)
print("  WEATHER SERVICE TEST — Kolkata Real-Time API")
print("="*60)

# ----------------------------------------------------------------
# Test 1: Current Weather
# ----------------------------------------------------------------
print("\n[1] fetch_current_weather()")
try:
    current = fetch_current_weather(KOLKATA_LAT, KOLKATA_LON)
    print(f"    Raw response (truncated): {json.dumps({k: current[k] for k in list(current.keys())[:8]}, indent=2)}")

    check("temperature" in current, "temperature field present")
    check(isinstance(current["temperature"], (int, float)), "temperature is numeric")
    check(-10 <= current["temperature"] <= 55, "temperature in realistic range [-10, 55]°C",
          f"got {current['temperature']}")

    check("humidity" in current, "humidity field present")
    check(0 <= current["humidity"] <= 100, "humidity in [0,100]%", f"got {current['humidity']}")

    check("pressure" in current, "pressure field present")
    check(850 <= current["pressure"] <= 1100, "pressure in realistic range", f"got {current['pressure']}")

    check("wind_speed" in current, "wind_speed field present")
    check(current["wind_speed"] >= 0, "wind_speed >= 0", f"got {current['wind_speed']}")

    check("rainfall_1h_mm" in current, "rainfall_1h_mm field present")
    check(current["rainfall_1h_mm"] >= 0, "rainfall_1h_mm >= 0")

    check("rainfall_24h_estimate_mm" in current, "rainfall_24h_estimate_mm field present")
    check("timestamp" in current, "timestamp field present")
    check("observed_at_ist" in current, "observed_at_ist field present")
    check("weather_main" in current, "weather_main field present")
    check("weather_description" in current, "weather_description field present")
    check("location" in current, "location field present")
    check("source" in current, "source field present")
    check(current["source"] == "openweathermap_current", "source = openweathermap_current")

    print(f"\n    Summary: {current['location']} — "
          f"{current['temperature']}°C, {current['humidity']}% RH, "
          f"{current['weather_description']}")

except RuntimeError as exc:
    print(f"  {FAIL}  fetch_current_weather() raised RuntimeError: {exc}")
    failures.append("fetch_current_weather() — exception")

# ----------------------------------------------------------------
# Test 2: Forecast Rainfall
# ----------------------------------------------------------------
print("\n[2] fetch_forecast_rainfall_24h()")
try:
    forecast = fetch_forecast_rainfall_24h(KOLKATA_LAT, KOLKATA_LON)
    check("forecast_rainfall_mm" in forecast, "forecast_rainfall_mm field present")
    check(forecast["forecast_rainfall_mm"] >= 0, "forecast_rainfall_mm >= 0",
          f"got {forecast['forecast_rainfall_mm']}")
    check("forecast_entries" in forecast, "forecast_entries field present")
    check(forecast.get("forecast_entries", 0) > 0, "at least 1 forecast slot returned")
    print(f"    24h forecast rainfall: {forecast['forecast_rainfall_mm']}mm "
          f"from {forecast.get('forecast_entries',0)} slots")

except RuntimeError as exc:
    print(f"  {FAIL}  fetch_forecast_rainfall_24h() raised RuntimeError: {exc}")
    failures.append("fetch_forecast_rainfall_24h() — exception")

# ----------------------------------------------------------------
# Test 3: Combined get_weather_for_ward()
# ----------------------------------------------------------------
print("\n[3] get_weather_for_ward() — Behala Ward 120")
from wards_data import KOLKATA_WARDS
ward = next(w for w in KOLKATA_WARDS if w["id"] == "behala-ward-120")

try:
    weather = get_weather_for_ward(
        lat=ward["latitude"],
        lon=ward["longitude"],
        ward_name=ward["name"],
        include_forecast=True,
    )
    check("forecast_rainfall_mm" in weather, "forecast_rainfall_mm in combined result")
    check("ward_name" in weather, "ward_name in result")
    check(weather["ward_name"] == ward["name"], f"ward_name == {ward['name']}")
    check("source" in weather, "source field present")
    check(weather["source"] == "openweathermap_current", "source = openweathermap_current")

    print(f"    Ward: {weather['ward_name']}")
    print(f"    Temp: {weather['temperature']}°C  Humidity: {weather['humidity']}%")
    print(f"    Rainfall (1h): {weather['rainfall_1h_mm']}mm")
    print(f"    Rainfall (24h estimate): {weather['rainfall_24h_estimate_mm']}mm")
    print(f"    Forecast (next 24h): {weather['forecast_rainfall_mm']}mm")

except RuntimeError as exc:
    print(f"  {FAIL}  get_weather_for_ward() raised RuntimeError: {exc}")
    failures.append("get_weather_for_ward() — exception")

# ----------------------------------------------------------------
# Test 4: Feature mapping
# ----------------------------------------------------------------
print("\n[4] weather_to_model_features()")
try:
    features = weather_to_model_features(weather, ward)

    expected_feature_keys = [
        "avg_temperature_c", "avg_humidity_percent", "historical_rainfall_mm",
        "forecast_rainfall_mm", "rainfall_intensity", "heat_index_c",
        "rainfall_category", "humidity_category", "temperature_category",
        "is_monsoon", "month_idx",
    ]
    for key in expected_feature_keys:
        check(key in features, f"feature '{key}' present in mapping")

    check(features["avg_temperature_c"] == weather["temperature"],
          "avg_temperature_c == weather.temperature")
    check(features["historical_rainfall_mm"] == weather["rainfall_24h_estimate_mm"],
          "historical_rainfall_mm == weather.rainfall_24h_estimate_mm")
    check(features["is_monsoon"] in (0, 1), "is_monsoon is 0 or 1")
    check(features["rainfall_category"] in ("Dry", "Moderate", "Wet", "Very Wet"),
          f"rainfall_category valid: {features['rainfall_category']}")

except Exception as exc:
    print(f"  {FAIL}  weather_to_model_features() raised: {exc}")
    failures.append("weather_to_model_features() — exception")

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
