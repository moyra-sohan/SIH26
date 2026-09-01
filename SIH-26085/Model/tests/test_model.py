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

# Let's create a test row with default/dummy values matching the feature list
print("\n--- Testing Pipeline / Prediction ---")
sample_data = {col: [0] for col in features}
# Assign some realistic defaults for categorical features
for col in features:
    if "category" in col or "type" in col or "body" in col or "zone" in col or "drainage" in col:
        sample_data[col] = ["urban"] if "landscape" in col or "land_use" in col else ["Zone A"]
    elif "latitude" in col:
        sample_data[col] = [22.5726]
    elif "longitude" in col:
        sample_data[col] = [88.3639]
    elif "elevation" in col:
        sample_data[col] = [9.0]
    elif "rainfall" in col:
        sample_data[col] = [82.0]
    elif "humidity" in col:
        sample_data[col] = [82.0]
    elif "temperature" in col:
        sample_data[col] = [28.0]

df_sample = pd.DataFrame(sample_data)
print("Sample DataFrame shape:", df_sample.shape)

try:
    transformed = prep.transform(df_sample)
    print("Preprocessed shape:", transformed.shape)
    pred = model.predict(transformed)
    print("Prediction:", pred)
    if hasattr(model, "predict_proba"):
        prob = model.predict_proba(transformed)
        print("Prediction Probabilities:", prob)
except Exception as e:
    print("Transform / predict exception:", type(e), e)
    import traceback
    traceback.print_exc()
