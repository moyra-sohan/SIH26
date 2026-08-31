import joblib
import sklearn.compose._column_transformer as _ct
import json

if not hasattr(_ct, "_RemainderColsList"):
    class _RemainderColsList:
        def __init__(self, *args, **kwargs): pass
    _ct._RemainderColsList = _RemainderColsList

prep = joblib.load("d:/SIH_2026/github/SIH26/SIH-26085/Model/preprocessor.pkl")
model = joblib.load("d:/SIH_2026/github/SIH26/SIH-26085/Model/best_flood_model.pkl")
features = joblib.load("d:/SIH_2026/github/SIH26/SIH-26085/Model/feature_columns.pkl")

print("--- Preprocessor Transformers ---")
num_cols = []
cat_cols = []
for name, trans, cols in prep.transformers_:
    print(f"Name: {name}, Transformer: {type(trans)}, Cols count: {len(cols) if hasattr(cols, '__len__') else cols}")
    print(f"Cols: {cols}\n")
    if name == 'num' or 'num' in name:
        num_cols = list(cols)
    elif name == 'cat' or 'cat' in name:
        cat_cols = list(cols)

# Check categorical unique categories if available
cat_categories = {}
for name, step in prep.named_transformers_.items():
    if hasattr(step, 'named_steps'):
        for sname, sstep in step.named_steps.items():
            if hasattr(sstep, 'categories_'):
                print(f"Step {sname} categories count: {len(sstep.categories_)}")
                for i, col in enumerate(cat_cols):
                    if i < len(sstep.categories_):
                        cat_categories[col] = list(sstep.categories_[i])
                        print(f"  {col}: {list(sstep.categories_[i])[:5]}")

summary = {
    "feature_count": len(features),
    "all_features": features,
    "numeric_features": num_cols,
    "categorical_features": cat_cols,
    "categories": {k: [str(x) for x in v] for k, v in cat_categories.items()}
}

with open("d:/SIH_2026/github/SIH26/SIH-26085/Model/feature_meta.json", "w") as f:
    json.dump(summary, f, indent=2)

print("Saved feature_meta.json successfully!")
