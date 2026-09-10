"""
Feature Columns and Metadata Endpoints.
"""
from fastapi import APIRouter
from app.schemas.common import FeaturesResponse
from app.services.model_service import model_service

router = APIRouter(tags=["ML Features & Metadata"])


@router.get("/features", response_model=FeaturesResponse, summary="Get Model Feature Columns & Metadata")
def get_features():
    """
    Returns the exact 60 feature column names, types, and categorical category values
    required by the underlying Scikit-Learn pipeline.
    """
    model_service.ensure_loaded()
    return FeaturesResponse(
        total_features=len(model_service.feature_columns),
        feature_columns=model_service.feature_columns,
        meta=model_service.feature_meta
    )
