"""
Aggregation Router for API v1 Endpoints.
"""
from fastapi import APIRouter
from app.api.v1.endpoints.predict import router as predict_router
from app.api.v1.endpoints.wards import router as wards_router
from app.api.v1.endpoints.features import router as features_router
from app.api.v1.endpoints.database import router as database_router
from app.api.v1.endpoints.weather import router as weather_router

api_v1_router = APIRouter()

# Register sub-routers
api_v1_router.include_router(predict_router)
api_v1_router.include_router(wards_router)
api_v1_router.include_router(features_router)
api_v1_router.include_router(database_router)
api_v1_router.include_router(weather_router)

