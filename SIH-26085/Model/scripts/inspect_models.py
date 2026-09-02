import os
import sys

out_file = "d:/SIH_2026/github/SIH26/SIH-26085/Model/inspect_result.txt"
with open(out_file, "w") as out:
    out.write(f"Python: {sys.executable}\n")
    
    import pickle
    out.write("1. Reading feature_columns.pkl...\n")
    with open("d:/SIH_2026/github/SIH26/SIH-26085/Model/feature_columns.pkl", "rb") as f:
        cols = pickle.load(f)
    out.write(f"Columns ({len(cols)}):\n{cols}\n\n")
    out.flush()

    out.write("2. Reading preprocessor.pkl...\n")
    try:
        with open("d:/SIH_2026/github/SIH26/SIH-26085/Model/preprocessor.pkl", "rb") as f:
            prep = pickle.load(f)
        out.write(f"Preprocessor: {type(prep)}\n{prep}\n\n")
    except Exception as e:
        out.write(f"Preprocessor error: {e}\n")
    out.flush()

    out.write("3. Reading best_flood_model.pkl...\n")
    try:
        with open("d:/SIH_2026/github/SIH26/SIH-26085/Model/best_flood_model.pkl", "rb") as f:
            model = pickle.load(f)
        out.write(f"Model: {type(model)}\n{model}\n")
        if hasattr(model, "classes_"):
            out.write(f"Classes: {model.classes_}\n")
    except Exception as e:
        out.write(f"Model error: {e}\n")
    out.flush()

print("Inspection completed.")
