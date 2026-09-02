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

prep = joblib.load("d:/SIH_2026/github/SIH26/SIH-26085/Model/preprocessor.pkl")
model = joblib.load("d:/SIH_2026/github/SIH26/SIH-26085/Model/best_flood_model.pkl")
features = joblib.load("d:/SIH_2026/github/SIH26/SIH-26085/Model/feature_columns.pkl")

# Patch any SimpleImputer instances in prep to support newer sklearn if needed
for name, trans in prep.named_transformers_.items():
    if hasattr(trans, 'named_steps'):
        for sname, step in trans.named_steps.items():
            if isinstance(step, SimpleImputer):
                if not hasattr(step, '_fill_dtype') and hasattr(step, '_fit_dtype'):
                    step._fill_dtype = step._fit_dtype
                    print(f"Patched {name}.{sname} with _fill_dtype = {step._fit_dtype}")
                elif not hasattr(step, '_fill_dtype'):
                    step._fill_dtype = np.float64
                    print(f"Patched {name}.{sname} with default float64 _fill_dtype")

with open("d:/SIH_2026/github/SIH26/SIH-26085/Model/feature_meta.json", "r") as f:
    meta = json.load(f)

sample = {}
for col in meta["numeric_features"]:
    sample[col] = 0.0

for col in meta["categorical_features"]:
    cats = meta["categories"].get(col, [])
    sample[col] = cats[0] if cats else "Unknown"

# Realistic values
sample.update({
    "ward_id": 63,
    "latitude": 22.5526,
    "longitude": 88.3539,
    "elevation_m": 6.2,
    "drainage_index_1to10": 4.5,
    "road_density_index_1to10": 8.0,
    "historical_rainfall_mm_reference": 75.0,
    "flood_waterlogging_events": 5,
    "estimated_avg_waterlogging_duration_hours": 3.5,
    "distance_from_city_center_km": 2.1,
    "approx_ward_area_sqkm": 1.45,
    "approx_boundary_perimeter_km": 5.2,
    "estimated_waterlogged_area_percent": 35.0,
    "relative_elevation_vs_sample_mean_m": -1.8,
    "groundwater_table_depth_m": 2.1,
    "impervious_surface_percent": 78.0,
    "water_surface_percent": 4.0,
    "green_cover_baseline_percent": 12.0,
    "seasonal_green_cover_percent": 15.0,
    "approx_road_network_length_km": 18.5,
    "storm_drain_coverage_percent": 65.0,
    "drain_load_utilization_percent": 88.0,
    "reported_road_waterlogging_incidents": 12,
    "historical_rainfall_mm": 95.0,
    "citywide_normal_rainfall_mm": 50.0,
    "deviation_from_normal_percent": 90.0,
    "estimated_rainy_days": 18,
    "forecast_rainfall_mm": 85.0,
    "forecast_vs_historical_error_percent": 10.0,
    "forecast_issue_lead_time_days": 1,
    "avg_humidity_percent": 84.0,
    "citywide_normal_humidity_percent": 75.0,
    "avg_temperature_c_reference": 28.5,
    "heat_index_c": 33.0,
    "avg_temperature_c": 28.0,
    "estimated_max_temperature_c": 31.0,
    "estimated_min_temperature_c": 25.0,
    "citywide_normal_temperature_c": 29.0,
    "deviation_from_normal_c": -1.0,
    "is_monsoon": 1,
    "rainfall_intensity": 18.5,
    "drain_efficiency_index": 4.2,
    "zone": "Central",
    "administrative_body": "KMC",
    "landscape_type": "Dense low-lying residential",
    "near_hooghly_river": "Yes",
    "boundary_type": "KMC Ward",
    "within_kmc_limits": "Yes",
    "elevation_category": "Low",
    "flood_vulnerability_class_by_elevation": "High",
    "waterlogging_risk_from_shallow_table": "Yes",
    "land_use_category": "Commercial/Historic core",
    "water_body_proximity": "Yes (Hooghly-adjacent)",
    "drainage_system_type": "Colonial-era combined sewer, canal-side, pump-assisted",
    "silt_accumulation_level": "High",
    "rainfall_category": "Wet",
    "forecast_rainfall_category": "Very Wet",
    "humidity_category": "High",
    "temperature_category": "Warm"
})

for col in features:
    if col not in sample:
        sample[col] = 0

# Patch any SimpleImputer instances in model to support newer sklearn if needed
for step_name, step_obj in getattr(model, "steps", []):
    if hasattr(step_obj, "named_transformers_"):
        for tname, trans in step_obj.named_transformers_.items():
            if hasattr(trans, "named_steps"):
                for sname, sstep in trans.named_steps.items():
                    if isinstance(sstep, SimpleImputer):
                        if not hasattr(sstep, "_fill_dtype") and hasattr(sstep, "_fit_dtype"):
                            sstep._fill_dtype = sstep._fit_dtype
                            print(f"Patched {tname}.{sname} with _fill_dtype = {sstep._fit_dtype}")
                        elif not hasattr(sstep, "_fill_dtype"):
                            sstep._fill_dtype = np.float64
                            print(f"Patched {tname}.{sname} with default float64 _fill_dtype")

df = pd.DataFrame([sample])[features]
pred = model.predict(df)
prob = model.predict_proba(df)

print("SUCCESS!")
print(f"Prediction: {pred[0]}")
print(f"Probabilities: Safe={prob[0][0]:.4f}, FloodRisk={prob[0][1]:.4f}")
