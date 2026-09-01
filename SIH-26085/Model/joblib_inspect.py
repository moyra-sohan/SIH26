import sys
import joblib
import traceback

out_file = "d:/SIH_2026/github/SIH26/SIH-26085/Model/joblib_inspect_result.txt"
with open(out_file, "w") as out:
    try:
        prep = joblib.load("d:/SIH_2026/github/SIH26/SIH-26085/Model/preprocessor.pkl")
        out.write(f"Joblib Preprocessor: {type(prep)}\n{prep}\n\n")
    except Exception as e:
        out.write(f"Joblib Preprocessor error: {e}\n{traceback.format_exc()}\n\n")
    
    try:
        model = joblib.load("d:/SIH_2026/github/SIH26/SIH-26085/Model/best_flood_model.pkl")
        out.write(f"Joblib Model: {type(model)}\n{model}\n")
        if hasattr(model, "classes_"):
            out.write(f"Classes: {model.classes_}\n")
        if hasattr(model, "predict_proba"):
            out.write(f"Predict Proba available\n")
    except Exception as e:
        out.write(f"Joblib Model error: {e}\n{traceback.format_exc()}\n\n")
