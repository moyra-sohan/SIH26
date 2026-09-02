"""
Ward Profiles and Citywide Spatial Forecast Endpoints.
"""
from fastapi import APIRouter, HTTPException, Query
from app.schemas.wards import WardListResponse, WardForecastsResponse
from app.services.ward_service import ward_service
from app.services.model_service import model_service
from app.core.logging import logger

router = APIRouter(tags=["Wards & Spatial Nowcasting"])


@router.get("/wards", response_model=WardListResponse, summary="List All Monitored Wards")
def get_wards():
    """
    Returns the knowledge base of monitored Kolkata municipal wards,
    including baseline elevation, drainage index, and vulnerability ratings.
    """
    wards = ward_service.get_all_wards()
    return WardListResponse(
        count=len(wards),
        wards=wards
    )


@router.get(
    "/ward-forecasts",
    response_model=WardForecastsResponse,
    summary="Citywide Ward-Level Forecasts"
)
@router.get(
    "/forecasts",
    response_model=WardForecastsResponse,
    include_in_schema=False
)
def get_all_ward_forecasts(
    current_rainfall: float = Query(82.0, alias="rainfall", description="Citywide rainfall in mm"),
    is_monsoon: int = Query(1, description="Monsoon toggle (1 for monsoon season, 0 otherwise)")
):
    """
    Calculates real-time ML flood predictions across all monitored Kolkata wards
    with spatial zone micro-adjustments.
    """
    if not model_service.is_loaded:
        raise HTTPException(status_code=503, detail="ML model is not loaded.")

    try:
        return model_service.generate_all_ward_forecasts(
            current_rainfall=current_rainfall,
            is_monsoon=is_monsoon
        )
    except Exception as e:
        logger.error(f"Ward forecasts generation failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Ward forecasts error: {str(e)}")
