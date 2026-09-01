"""
API Endpoints for urban_flood_nowcasting_db Database queries,
Road Networks, Drainage Infrastructure, Ward Zones, and 3H Nowcast Simulation.
"""
from typing import Optional, Dict, Any
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field
from app.services.db_service import db_service
from app.services.model_service import model_service
from app.schemas.prediction import PredictionInput, PredictionResponse
from app.core.logging import logger

router = APIRouter(prefix="/db", tags=["Urban Flood Nowcasting Database"])


class LocationPredictionInput(BaseModel):
    latitude: float = Field(..., description="GPS Latitude (e.g. 22.4900 for Behala)")
    longitude: float = Field(..., description="GPS Longitude (e.g. 88.3100 for Behala)")
    rainfall_mm: Optional[float] = Field(82.0, description="Precipitation in mm")
    forecast_rainfall_mm: Optional[float] = Field(None, description="Forecast rain in mm")
    avg_humidity_percent: Optional[float] = Field(84.0, description="Relative humidity %")
    avg_temperature_c: Optional[float] = Field(28.0, description="Temperature in °C")
    is_monsoon: Optional[int] = Field(1, description="1 for Monsoon season, 0 otherwise")
    drain_efficiency_index: Optional[float] = Field(None, description="Drain efficiency index (1-10)")
    drain_load_utilization_percent: Optional[float] = Field(None, description="Drain load %")
    silt_accumulation_level: Optional[str] = Field(None, description="Low/Moderate/High/Very High")


@router.get("/tables", summary="List All 9 Tables & Metadata")
def list_tables():
    """Returns schemas, primary keys, and metadata for all 9 database tables."""
    return {
        "database": "urban_flood_nowcasting_db",
        "tables": db_service.get_all_tables_metadata()
    }


@router.get("/table/{table_name}", summary="Query Specific Table Records")
def query_table(
    table_name: str,
    ward_id: Optional[int] = Query(None, description="Filter by ward ID"),
    zone: Optional[str] = Query(None, description="Filter by zone name"),
    forecast_month: Optional[str] = Query(None, description="Filter by month (e.g. August)"),
    search: Optional[str] = Query(None, description="Full-text search keyword"),
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0)
):
    """Fetches records from any of the 9 database tables with optional filters."""
    try:
        return db_service.query_table(
            table_name=table_name,
            ward_id=ward_id,
            zone=zone,
            forecast_month=forecast_month,
            search=search,
            limit=limit,
            offset=offset
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        logger.error(f"Error querying table {table_name}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/all", summary="Full Database Dump")
def get_all_database_data():
    """Returns complete contents of all 9 database tables and spatial networks."""
    return db_service.get_unified_database_dump()


@router.get("/roads", summary="Get Road Network & Waterlogging Statuses")
def get_roads(
    zone: Optional[str] = Query(None, description="Filter by zone"),
    status: Optional[str] = Query(None, description="Filter by waterlogging status (e.g. Submerged)")
):
    """Returns Kolkata road network arteries with live waterlogging statuses and traffic advisories."""
    roads = db_service.get_roads(zone=zone, status=status)
    return {
        "count": len(roads),
        "roads": roads
    }


@router.get("/drains", summary="Get Drainage Network & Pumping Station Statuses")
def get_drainage(
    zone: Optional[str] = Query(None, description="Filter by zone")
):
    """Returns drainage channels, outfalls, and pumping stations with load % and silt levels."""
    drains = db_service.get_drainage(zone=zone)
    return {
        "count": len(drains),
        "drainage": drains
    }


@router.get("/zones", summary="Get Ward-Wise Zone Classifications")
def get_zones():
    """Returns Kolkata zone classifications, average elevations, and primary drainage hubs."""
    return {
        "zones": db_service.get_zones()
    }


@router.get("/3h-situation", summary="Get 3-Hour Nowcasting Timeline Progression")
def get_3h_situation(
    time_step: Optional[str] = Query(None, description="Time step (t_plus_0h, t_plus_1h, t_plus_2h, t_plus_3h)")
):
    """Returns 3H situation nowcasting timeline simulation metrics and flood progression data."""
    return db_service.get_3h_situation(time_step=time_step)


@router.post("/predict-location", response_model=Dict[str, Any], summary="Predict Flood Risk on User Location/Coordinates")
def predict_location(payload: LocationPredictionInput):
    """
    Performs real-time ML flood nowcasting for given GPS coordinates or user data.
    Automatically maps to the nearest monitored ward environmental profile and executes the ML pipeline.
    """
    try:
        nearest = db_service.find_nearest_ward(payload.latitude, payload.longitude)
        
        # Prepare ML Prediction Input
        ml_input = PredictionInput(
            ward_id=f"ward-{nearest['matched_ward_id']}",
            rainfall_mm=payload.rainfall_mm,
            forecast_rainfall_mm=payload.forecast_rainfall_mm,
            avg_humidity_percent=payload.avg_humidity_percent,
            avg_temperature_c=payload.avg_temperature_c,
            is_monsoon=payload.is_monsoon,
            drain_efficiency_index=payload.drain_efficiency_index,
            drain_load_utilization_percent=payload.drain_load_utilization_percent,
            silt_accumulation_level=payload.silt_accumulation_level
        )
        
        # Run ML model prediction
        res = model_service.predict_single(ml_input)
        
        return {
            "success": True,
            "queried_location": {
                "latitude": payload.latitude,
                "longitude": payload.longitude,
            },
            "nearest_ward": nearest,
            "prediction": res.dict()
        }
    except Exception as e:
        logger.error(f"Error predicting flood risk for location: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Location prediction error: {str(e)}")
