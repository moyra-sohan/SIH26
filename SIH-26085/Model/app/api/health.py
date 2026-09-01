"""
System Health and Root Information Endpoints.
"""
from datetime import datetime
from fastapi import APIRouter
from app.schemas.common import RootResponse, HealthResponse
from app.services.model_service import model_service
from app.data import KOLKATA_WARDS
from app.core.config import settings

router = APIRouter(tags=["System & Health"])


@router.get("/", response_model=RootResponse, summary="Root Service Information")
def root():
    """Returns basic service metadata, status, and discoverable endpoints."""
    return RootResponse(
        service=settings.PROJECT_NAME,
        version=settings.VERSION,
        status="online",
        endpoints=[
            "/health",
            "/api/features",
            "/api/wards",
            "/api/predict",
            "/api/ward-forecasts",
            "/api/batch-predict",
        ],
        timestamp=datetime.now().isoformat()
    )


@router.get("/health", response_model=HealthResponse, summary="Health Check")
def health():
    """Returns the operational health and readiness state of the ML inference engine."""
    try:
        model_service.ensure_loaded()
    except Exception:
        pass

    return HealthResponse(
        status="healthy" if model_service.is_loaded else "degraded",
        model_loaded=model_service.is_loaded,
        feature_count=len(model_service.feature_columns),
        wards_count=len(KOLKATA_WARDS),
        timestamp=datetime.now().isoformat()
    )
