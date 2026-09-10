"""
Prediction Endpoints for Single Ward and Batch Flood Nowcasting.
"""
from fastapi import APIRouter, HTTPException
from app.schemas.prediction import (
    PredictionInput,
    BatchPredictionInput,
    PredictionResponse,
    BatchPredictionResponse,
)
from app.services.model_service import model_service
from app.core.logging import logger

router = APIRouter(tags=["ML Predictions"])


@router.post(
    "/predict",
    response_model=PredictionResponse,
    summary="Predict Flood Risk (Single Ward)"
)
def predict_flood_risk(payload: PredictionInput):
    """
    Computes real-time urban flood risk probability, depth, clearance duration,
    and municipal advisories for a given ward or weather condition.
    """
    if not model_service.is_loaded:
        raise HTTPException(status_code=503, detail="ML model is not loaded.")

    try:
        return model_service.predict_single(payload)
    except Exception as e:
        logger.error(f"Prediction error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Prediction error: {str(e)}")


@router.post(
    "/batch-predict",
    response_model=BatchPredictionResponse,
    summary="Batch Predict Flood Risk"
)
def batch_predict(payload: BatchPredictionInput):
    """
    Evaluates flood risk for multiple input scenarios in a single batch request.
    """
    if not model_service.is_loaded:
        raise HTTPException(status_code=503, detail="ML model is not loaded.")

    try:
        return model_service.predict_batch(payload)
    except Exception as e:
        logger.error(f"Batch prediction error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Batch prediction error: {str(e)}")
