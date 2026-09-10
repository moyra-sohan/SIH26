import os
import sys

base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
artifacts_dir = os.path.join(base_dir, "artifacts")
out_file = os.path.join(base_dir, "inspect_result.txt")
with open(out_file, "w") as out:
    out.write(f"Python: {sys.executable}\n")
    
    import pickle
    out.write("1. Reading feature_columns.pkl...\n")
    with open(os.path.join(artifacts_dir, "feature_columns.pkl"), "rb") as f:
        cols = pickle.load(f)
    out.write(f"Columns ({len(cols)}):\n{cols}\n\n")
    out.flush()

    out.write("2. Reading preprocessor.pkl...\n")
    try:
        with open(os.path.join(artifacts_dir, "preprocessor.pkl"), "rb") as f:
            prep = pickle.load(f)
        out.write(f"Preprocessor: {type(prep)}\n{prep}\n\n")
    except Exception as e:
        out.write(f"Preprocessor error: {e}\n")
    out.flush()

    out.write("3. Reading best_flood_model.pkl...\n")
    try:
        with open(os.path.join(artifacts_dir, "best_flood_model.pkl"), "rb") as f:
            model = pickle.load(f)
        out.write(f"Model: {type(model)}\n{model}\n")
        if hasattr(model, "classes_"):
            out.write(f"Classes: {model.classes_}\n")
    except Exception as e:
        out.write(f"Model error: {e}\n")
    out.flush()

print("Inspection completed.")
