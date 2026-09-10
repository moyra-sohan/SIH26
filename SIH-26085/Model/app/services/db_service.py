"""
Database Service layer for urban_flood_nowcasting_db.
Handles table querying, spatial joins, location-based ward mapping,
roads and drainage data filtering, and 3H nowcasting simulation metrics.
"""
from typing import Dict, List, Any, Optional
import math
from app.data.database import (
    ALL_TABLES,
    TABLE_METADATA,
    KOLKATA_ROADS_NETWORK,
    KOLKATA_DRAINAGE_NETWORK,
    THREE_HOUR_SITUATION_TIMELINE,
    KOLKATA_ZONES_METADATA,
)
from app.core.logging import logger


class DatabaseService:
    def get_table_names(self) -> List[str]:
        """Returns the names of all 9 database tables."""
        return list(ALL_TABLES.keys())

    def get_all_tables_metadata(self) -> Dict[str, Any]:
        """Returns schemas, row counts, and metadata for all 9 tables."""
        meta = {}
        for name, table_data in ALL_TABLES.items():
            info = TABLE_METADATA.get(name, {})
            columns = list(table_data[0].keys()) if table_data else []
            meta[name] = {
                "table_name": name,
                "row_count": len(table_data),
                "column_count": info.get("column_count", len(columns)),
                "primary_keys": info.get("primary_keys", ["ward_id", "forecast_month"]),
                "description": info.get("description", ""),
                "columns": columns
            }
        return meta

    def query_table(
        self,
        table_name: str,
        ward_id: Optional[int] = None,
        zone: Optional[str] = None,
        forecast_month: Optional[str] = None,
        search: Optional[str] = None,
        limit: int = 100,
        offset: int = 0
    ) -> Dict[str, Any]:
        """Queries records from a specific table with multiple optional filters."""
        if table_name not in ALL_TABLES:
            raise ValueError(f"Table '{table_name}' does not exist in urban_flood_nowcasting_db.")

        rows = ALL_TABLES[table_name]

        # Apply filters
        filtered = rows
        if ward_id is not None:
            filtered = [r for r in filtered if r.get("ward_id") == ward_id]
        if zone:
            filtered = [r for r in filtered if r.get("zone", "").lower() == zone.lower()]
        if forecast_month:
            filtered = [r for r in filtered if r.get("forecast_month", "").lower() == forecast_month.lower()]
        if search:
            s_lower = search.lower()
            filtered = [
                r for r in filtered
                if any(s_lower in str(v).lower() for v in r.values())
            ]

        total = len(filtered)
        paginated = filtered[offset:offset + limit]

        return {
            "table_name": table_name,
            "total_records": total,
            "limit": limit,
            "offset": offset,
            "columns": list(rows[0].keys()) if rows else [],
            "records": paginated
        }

    def get_unified_database_dump(self) -> Dict[str, Any]:
        """Returns the full contents of all 9 database tables plus roads, drains, and zones."""
        return {
            "database_name": "urban_flood_nowcasting_db",
            "table_count": len(ALL_TABLES),
            "tables": ALL_TABLES,
            "metadata": self.get_all_tables_metadata(),
            "roads_network": KOLKATA_ROADS_NETWORK,
            "drainage_network": KOLKATA_DRAINAGE_NETWORK,
            "zones_metadata": KOLKATA_ZONES_METADATA,
            "three_hour_situation": THREE_HOUR_SITUATION_TIMELINE
        }

    def get_roads(
        self,
        zone: Optional[str] = None,
        status: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """Returns road segments with real-time waterlogging status."""
        roads = KOLKATA_ROADS_NETWORK
        if zone:
            roads = [r for r in roads if r.get("zone", "").lower() == zone.lower()]
        if status:
            roads = [r for r in roads if r.get("waterlogging_status", "").lower() == status.lower()]
        return roads

    def get_drainage(
        self,
        zone: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """Returns drainage channels and pumping stations."""
        drains = KOLKATA_DRAINAGE_NETWORK
        if zone:
            drains = [d for d in drains if d.get("zone", "").lower() == zone.lower()]
        return drains

    def get_zones(self) -> Dict[str, Any]:
        """Returns zone metadata and summaries."""
        return KOLKATA_ZONES_METADATA

    def get_3h_situation(self, time_step: Optional[str] = None) -> Dict[str, Any]:
        """Returns 3H situation timeline simulation data."""
        if time_step and time_step in THREE_HOUR_SITUATION_TIMELINE:
            return {
                "time_step": time_step,
                "data": THREE_HOUR_SITUATION_TIMELINE[time_step]
            }
        return {
            "all_steps": THREE_HOUR_SITUATION_TIMELINE
        }

    def find_nearest_ward(self, latitude: float, longitude: float) -> Dict[str, Any]:
        """Finds the closest monitored ward to given GPS coordinates using Euclidean distance."""
        forecast_table = ALL_TABLES["ward_flood_forecast"]
        best_ward = forecast_table[0]
        min_dist = float("inf")

        for w in forecast_table:
            w_lat = w.get("latitude", 22.5726)
            w_lon = w.get("longitude", 88.3639)
            dist = math.hypot(latitude - w_lat, longitude - w_lon)
            if dist < min_dist:
                min_dist = dist
                best_ward = w

        return {
            "matched_ward_id": best_ward["ward_id"],
            "ward_name": best_ward["ward_name"],
            "zone": best_ward["zone"],
            "distance_degrees": round(min_dist, 5),
            "distance_approx_km": round(min_dist * 111.0, 2),
            "latitude": best_ward["latitude"],
            "longitude": best_ward["longitude"],
            "elevation_m": best_ward["elevation_m"],
            "flood_risk_level": best_ward["flood_risk_level"]
        }


db_service = DatabaseService()
