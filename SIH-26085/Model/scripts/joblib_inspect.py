import sys
import joblib
import traceback

import os

BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "artifacts"))
out_file = os.path.join(os.path.dirname(__file__), "joblib_inspect_result.txt")
with open(out_file, "w") as out:
    try:
        prep = joblib.load(os.path.join(BASE_DIR, "preprocessor.pkl"))
        out.write(f"Joblib Preprocessor: {type(prep)}\n{prep}\n\n")
    except Exception as e:
        out.write(f"Joblib Preprocessor error: {e}\n{traceback.format_exc()}\n\n")
    
    try:
        model = joblib.load(os.path.join(BASE_DIR, "best_flood_model.pkl"))
        out.write(f"Joblib Model: {type(model)}\n{model}\n")
        if hasattr(model, "classes_"):
            out.write(f"Classes: {model.classes_}\n")
        if hasattr(model, "predict_proba"):
            out.write(f"Predict Proba available\n")
    except Exception as e:
        out.write(f"Joblib Model error: {e}\n{traceback.format_exc()}\n\n")
