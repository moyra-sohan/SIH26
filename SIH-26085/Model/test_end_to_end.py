import joblib
import pandas as pd
import numpy as np
import sklearn.compose._column_transformer as _ct
from sklearn.impute import SimpleImputer
import json

if not hasattr(_ct, "_RemainderColsList"):
    class _RemainderColsList:
        def __init__(self, *args, **kwargs): pass
    _ct._RemainderColsList = _RemainderColsList

model = joblib.load("d:/SIH_2026/github/SIH26/SIH-26085/Model/best_flood_model.pkl")
features = joblib.load("d:/SIH_2026/github/SIH26/SIH-26085/Model/feature_columns.pkl")

# Patch imputer attributes for forward compatibility
for step_name, step_obj in model.steps:
    if hasattr(step_obj, 'named_transformers_'):
        for tname, trans in step_obj.named_transformers_.items():
            if hasattr(trans, 'named_steps'):
                for sname, sstep in trans.named_steps.items():
                    if isinstance(sstep, SimpleImputer):
                        if not hasattr(sstep, '_fill_dtype') and hasattr(sstep, '_fit_dtype'):
                            sstep._fill_dtype = sstep._fit_dtype
                        elif not hasattr(sstep, '_fill_dtype'):
                            sstep._fill_dtype = np.float64

with open("d:/SIH_2026/github/SIH26/SIH-26085/Model/feature_meta.json", "r") as f:
    meta = json.load(f)

def build_default_record():
    rec = {}
    for col in features:
        if col in meta["categorical_features"]:
            cats = meta["categories"].get(col, [])
            rec[col] = cats[0] if cats else "Unknown"
        else:
            rec[col] = 0.0
    return rec

# Scenario 1: High flood risk ward (low elevation, high rain, near river)
sample_high_risk = build_default_record()
sample_high_risk.update({
    "ward_id": 63,
    "latitude": 22.5526,
    "longitude": 88.3539,
    "elevation_m": 4.2,
    "drainage_index_1to10": 3.0,
    "road_density_index_1to10": 8.5,
    "historical_rainfall_mm_reference": 120.0,
    "flood_waterlogging_events": 8,
    "estimated_avg_waterlogging_duration_hours": 6.5,
    "distance_from_city_center_km": 1.5,
    "approx_ward_area_sqkm": 1.8,
    "approx_boundary_perimeter_km": 6.0,
    "estimated_waterlogged_area_percent": 65.0,
    "relative_elevation_vs_sample_mean_m": -2.8,
    "groundwater_table_depth_m": 1.2,
    "impervious_surface_percent": 85.0,
    "water_surface_percent": 8.0,
    "green_cover_baseline_percent": 8.0,
    "seasonal_green_cover_percent": 10.0,
    "approx_road_network_length_km": 22.0,
    "storm_drain_coverage_percent": 50.0,
    "drain_load_utilization_percent": 95.0,
    "reported_road_waterlogging_incidents": 18,
    "historical_rainfall_mm": 110.0,
    "citywide_normal_rainfall_mm": 45.0,
    "deviation_from_normal_percent": 144.0,
    "estimated_rainy_days": 22,
    "forecast_rainfall_mm": 125.0,
    "forecast_vs_historical_error_percent": 12.0,
    "forecast_issue_lead_time_days": 1,
    "avg_humidity_percent": 92.0,
    "citywide_normal_humidity_percent": 75.0,
    "avg_temperature_c_reference": 29.0,
    "heat_index_c": 36.0,
    "avg_temperature_c": 28.5,
    "estimated_max_temperature_c": 32.0,
    "estimated_min_temperature_c": 25.0,
    "citywide_normal_temperature_c": 29.0,
    "deviation_from_normal_c": -0.5,
    "month_idx": 8,
    "is_monsoon": 1,
    "rainfall_intensity": 28.5,
    "drain_efficiency_index": 2.5,
    "zone": "Central",
    "administrative_body": "KMC",
    "landscape_type": "Dense low-lying residential",
    "near_hooghly_river": "Yes",
    "boundary_type": "KMC Ward",
    "within_kmc_limits": "Yes",
    "elevation_category": "Very Low",
    "flood_vulnerability_class_by_elevation": "Very High",
    "waterlogging_risk_from_shallow_table": "Yes",
    "land_use_category": "Mixed (Residential/Commercial)",
    "water_body_proximity": "Yes (Hooghly-adjacent)",
    "drainage_system_type": "Colonial-era combined sewer, canal-side, pump-assisted",
    "silt_accumulation_level": "Very High",
    "rainfall_category": "Very Wet",
    "forecast_rainfall_category": "Very Wet",
    "humidity_category": "Very High",
    "temperature_category": "Warm"
})

# Scenario 2: Low flood risk ward (elevated, good drainage, low rain)
sample_low_risk = build_default_record()
sample_low_risk.update({
    "ward_id": 105,
    "latitude": 22.5800,
    "longitude": 88.4200,
    "elevation_m": 12.0,
    "drainage_index_1to10": 8.5,
    "road_density_index_1to10": 5.0,
    "historical_rainfall_mm_reference": 30.0,
    "flood_waterlogging_events": 0,
    "estimated_avg_waterlogging_duration_hours": 0.5,
    "distance_from_city_center_km": 8.0,
    "approx_ward_area_sqkm": 3.2,
    "approx_boundary_perimeter_km": 8.5,
    "estimated_waterlogged_area_percent": 5.0,
    "relative_elevation_vs_sample_mean_m": 4.5,
    "groundwater_table_depth_m": 6.5,
    "impervious_surface_percent": 45.0,
    "water_surface_percent": 2.0,
    "green_cover_baseline_percent": 35.0,
    "seasonal_green_cover_percent": 38.0,
    "approx_road_network_length_km": 12.0,
    "storm_drain_coverage_percent": 90.0,
    "drain_load_utilization_percent": 40.0,
    "reported_road_waterlogging_incidents": 1,
    "historical_rainfall_mm": 20.0,
    "citywide_normal_rainfall_mm": 50.0,
    "deviation_from_normal_percent": -60.0,
    "estimated_rainy_days": 5,
    "forecast_rainfall_mm": 15.0,
    "forecast_vs_historical_error_percent": 5.0,
    "forecast_issue_lead_time_days": 2,
    "avg_humidity_percent": 65.0,
    "citywide_normal_humidity_percent": 75.0,
    "avg_temperature_c_reference": 27.0,
    "heat_index_c": 28.0,
    "avg_temperature_c": 27.0,
    "estimated_max_temperature_c": 30.0,
    "estimated_min_temperature_c": 24.0,
    "citywide_normal_temperature_c": 29.0,
    "deviation_from_normal_c": -2.0,
    "month_idx": 1,
    "is_monsoon": 0,
    "rainfall_intensity": 5.0,
    "drain_efficiency_index": 8.5,
    "zone": "East",
    "administrative_body": "NKDA",
    "landscape_type": "Green/institutional, elevated",
    "near_hooghly_river": "No",
    "boundary_type": "NKDA Planning Area",
    "within_kmc_limits": "No",
    "elevation_category": "Relatively High",
    "flood_vulnerability_class_by_elevation": "Low",
    "waterlogging_risk_from_shallow_table": "No",
    "land_use_category": "Institutional/Green",
    "water_body_proximity": "No",
    "drainage_system_type": "Colonial-era combined sewer/stormwater, well-maintained",
    "silt_accumulation_level": "Low",
    "rainfall_category": "Dry",
    "forecast_rainfall_category": "Dry",
    "humidity_category": "Moderate",
    "temperature_category": "Mild"
})

df = pd.DataFrame([sample_high_risk, sample_low_risk])[features]
preds = model.predict(df)
probs = model.predict_proba(df)

print("\n--- RESULTS ---")
print(f"Scenario 1 (High Risk Zone): Prediction = {preds[0]}, Flood Risk Probability = {probs[0][1]*100:.1f}%, Safe Probability = {probs[0][0]*100:.1f}%")
print(f"Scenario 2 (Low Risk Zone):  Prediction = {preds[1]}, Flood Risk Probability = {probs[1][1]*100:.1f}%, Safe Probability = {probs[1][0]*100:.1f}%")
