"""
Backward compatibility shim for Kolkata wards data.
The canonical dataset is now located in `app.data.kolkata_wards`.
"""
from app.data.kolkata_wards import KOLKATA_WARDS

__all__ = ["KOLKATA_WARDS"]
