import joblib
import sklearn.compose._column_transformer as _ct
from sklearn.impute import SimpleImputer
import numpy as np

if not hasattr(_ct, "_RemainderColsList"):
    class _RemainderColsList:
        def __init__(self, *args, **kwargs): pass
    _ct._RemainderColsList = _RemainderColsList

model = joblib.load("d:/SIH_2026/github/SIH26/SIH-26085/Model/best_flood_model.pkl")
print("Model steps:", model.steps)
for step_name, step_obj in model.steps:
    print(f"\nStep: {step_name}, Type: {type(step_obj)}")
    if hasattr(step_obj, 'named_transformers_'):
        print("  Transformers in step:", step_obj.named_transformers_.keys())
        for tname, trans in step_obj.named_transformers_.items():
            if hasattr(trans, 'named_steps'):
                for sname, sstep in trans.named_steps.items():
                    if isinstance(sstep, SimpleImputer):
                        if not hasattr(sstep, '_fill_dtype') and hasattr(sstep, '_fit_dtype'):
                            sstep._fill_dtype = sstep._fit_dtype
                        elif not hasattr(sstep, '_fill_dtype'):
                            sstep._fill_dtype = np.float64
                        print(f"  Patched imputer in model: {tname}.{sname}")
