"""
Compatibility shims for unpickling legacy Scikit-Learn models and transformers.
"""
import sklearn.compose._column_transformer as _ct


def apply_sklearn_shims():
    """Patches missing attributes in sklearn ColumnTransformer for forward/backward compatibility."""
    if not hasattr(_ct, "_RemainderColsList"):
        class _RemainderColsList:
            """Backward compatibility stub for ColumnTransformer remainder list."""
            def __init__(self, *args, **kwargs):
                pass
        _ct._RemainderColsList = _RemainderColsList
