import sys
import joblib
import pandas as pd
import numpy as np
import sklearn.compose._column_transformer as _ct

# Backward-compat shim for _RemainderColsList
if not hasattr(_ct, "_RemainderColsList"):
    class _RemainderColsList:
        """Stub for backward compatibility."""
        def __init__(self, *args, **kwargs):
            pass
    _ct._RemainderColsList = _RemainderColsList

import os

ROOT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
ARTIFACTS_DIR = os.path.join(ROOT_DIR, "artifacts")

print("Loading feature_columns.pkl...")
features = joblib.load(os.path.join(ARTIFACTS_DIR, "feature_columns.pkl"))
print(f"Features ({len(features)}):", features)

print("\nLoading preprocessor.pkl...")
prep = joblib.load(os.path.join(ARTIFACTS_DIR, "preprocessor.pkl"))
print("Preprocessor successfully loaded:", type(prep))

print("\nLoading best_flood_model.pkl...")
model = joblib.load(os.path.join(ARTIFACTS_DIR, "best_flood_model.pkl"))
print("Model successfully loaded:", type(model))

# Let's inspect transformers and features
print("\n--- Model inspection ---")
print("Model classes:", getattr(model, "classes_", None))
if hasattr(model, "predict_proba"):
    print("Model has predict_proba: True")

import json
with open("d:/SIH_2026/github/SIH26/SIH-26085/Model/feature_meta.json", "r") as f:
    meta = json.load(f)

# Patch SimpleImputer instances in model
for step_name, step_obj in getattr(model, "steps", []):
    if hasattr(step_obj, "named_transformers_"):
        for tname, trans in step_obj.named_transformers_.items():
            if hasattr(trans, "named_steps"):
                for sname, sstep in trans.named_steps.items():
                    if hasattr(sstep, "_fill_dtype") is False and hasattr(sstep, "_fit_dtype"):
                        sstep._fill_dtype = sstep._fit_dtype
                    elif hasattr(sstep, "_fill_dtype") is False:
                        sstep._fill_dtype = np.float64

# Let's create a test row matching feature_meta schema
print("\n--- Testing Pipeline / Prediction ---")
sample_data = {}
for col in features:
    if col in meta.get("categorical_features", []):
        cats = meta.get("categories", {}).get(col, [])
        sample_data[col] = [cats[0] if cats else "Unknown"]
    else:
        sample_data[col] = [0.0]

# Assign some realistic defaults
sample_data.update({
    "ward_id": [63],
    "latitude": [22.5526],
    "longitude": [88.3639],
    "elevation_m": [9.0],
    "historical_rainfall_mm": [82.0],
    "forecast_rainfall_mm": [85.0],
    "avg_humidity_percent": [82.0],
    "avg_temperature_c": [28.0],
    "month_idx": [9],
    "is_monsoon": [1],
})

df_sample = pd.DataFrame(sample_data)[features]
print("Sample DataFrame shape:", df_sample.shape)

try:
    pred = model.predict(df_sample)
    print("Prediction:", pred)
    if hasattr(model, "predict_proba"):
        prob = model.predict_proba(df_sample)
        print("Prediction Probabilities:", prob)
except Exception as e:
    print("Prediction exception:", type(e), e)
    import traceback
    traceback.print_exc()
