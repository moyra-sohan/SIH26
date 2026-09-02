"""
Ward Data and Spatial Lookup Services for Kolkata Urban Sectors.
"""
from typing import List, Dict, Any, Optional
from app.data import KOLKATA_WARDS


class WardService:
    @staticmethod
    def get_all_wards() -> List[Dict[str, Any]]:
        """Returns all configured Kolkata ward profiles."""
        return KOLKATA_WARDS

    @staticmethod
    def get_ward_by_identifier(identifier: Any) -> Optional[Dict[str, Any]]:
        """
        Searches for a ward by ward_id (numeric/str), slug id (e.g. 'behala-ward-120'), or name.
        """
        if identifier is None:
            return None
        ident_str = str(identifier).strip().lower()
        for w in KOLKATA_WARDS:
            if (
                str(w["ward_id"]) == ident_str
                or w["id"].lower() == ident_str
                or str(w["name"]).lower() == ident_str
            ):
                return w
        return None


ward_service = WardService()
