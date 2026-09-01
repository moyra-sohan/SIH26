"""
Machine Learning Pipeline Inference & Model Management Service.
"""
import os
import json
from typing import Dict, List, Any, Optional
from datetime import datetime
import joblib
import numpy as np
from sklearn.impute import SimpleImputer

from app.core.config import settings
from app.core.logging import logger
from app.core.shims import apply_sklearn_shims
from app.schemas.prediction import (
    PredictionInput,
    BatchPredictionInput,
    PredictionResponse,
    BatchPredictionResponse,
    BatchItemResult,
)
from app.schemas.wards import WardForecastItem, WardForecastsResponse
from app.services.feature_builder import feature_builder
from app.services.risk_insights import risk_insights_service
from app.data import KOLKATA_WARDS


class MLModelService:
    def __init__(self):
        self.model: Optional[Any] = None
        self.feature_columns: List[str] = []
        self.feature_meta: Dict[str, Any] = {}
        self.is_loaded: bool = False

    def load_assets(self) -> None:
        """Loads serialized ML pipeline artifacts and metadata into memory."""
        apply_sklearn_shims()

        try:
            logger.info(f"Loading feature columns from: {settings.FEATURES_PATH}")
            self.feature_columns = joblib.load(settings.FEATURES_PATH)
            logger.info(f"Loaded {len(self.feature_columns)} feature columns successfully.")

            if os.path.exists(settings.META_PATH):
                with open(settings.META_PATH, "r") as f:
                    self.feature_meta = json.load(f)
            else:
                self.feature_meta = {
                    "all_features": self.feature_columns,
                    "numeric_features": [],
                    "categorical_features": [],
                    "categories": {}
                }

            logger.info(f"Loading model pipeline from: {settings.MODEL_PATH}")
            self.model = joblib.load(settings.MODEL_PATH)
            logger.info(f"Model loaded: {type(self.model)}")

            # Patch SimpleImputer attributes on loaded pipeline for forward compatibility
            for step_name, step_obj in getattr(self.model, "steps", []):
                if hasattr(step_obj, "named_transformers_"):
                    for tname, trans in step_obj.named_transformers_.items():
                        if hasattr(trans, "named_steps"):
                            for sname, sstep in trans.named_steps.items():
                                if isinstance(sstep, SimpleImputer):
                                    if not hasattr(sstep, "_fill_dtype") and hasattr(sstep, "_fit_dtype"):
                                        sstep._fill_dtype = sstep._fit_dtype
                                    elif not hasattr(sstep, "_fill_dtype"):
                                        sstep._fill_dtype = np.float64
                                    logger.info(f"Patched imputer in model: {tname}.{sname}")

            self.is_loaded = True
            logger.info("ML Pipeline initialized and ready for real-time inference.")
        except Exception as e:
            self.is_loaded = False
            logger.error(f"Error loading ML assets: {e}", exc_info=True)
            raise RuntimeError(f"Failed to load ML artifacts: {e}")

    def ensure_loaded(self) -> None:
        """Ensures ML assets are loaded, initializing if not already done."""
        if not self.is_loaded or self.model is None:
            self.load_assets()

    def predict_single(self, payload: PredictionInput) -> PredictionResponse:
        """Performs flood prediction for a single input record."""
        self.ensure_loaded()

        df, summary = feature_builder.build_feature_dataframe(
            payload, self.feature_columns, self.feature_meta
        )

        preds = self.model.predict(df)
        probs = self.model.predict_proba(df)

        prediction_int = int(preds[0])
        flood_prob = float(probs[0][1])
        safe_prob = float(probs[0][0])

        insights = risk_insights_service.generate_risk_insights(
            flood_prob, prediction_int, summary
        )

        return PredictionResponse(
            success=True,
            prediction=prediction_int,
            is_flood_risk=bool(prediction_int == 1 or flood_prob >= 0.5),
            flood_probability=round(flood_prob, 4),
            safe_probability=round(safe_prob, 4),
            risk_index=round(flood_prob, 2),
            risk_level=insights["risk_level"],
            risk_color=insights["risk_color"],
            status_text=insights["status_text"],
            estimated_waterlogging_depth_cm=insights["estimated_waterlogging_depth_cm"],
            estimated_duration_hours=insights["estimated_duration_hours"],
            advisories=insights["advisories"],
            key_risk_drivers=insights["key_risk_drivers"],
            inputs_summary=summary,
            timestamp=datetime.now().isoformat()
        )

    def predict_batch(self, payload: BatchPredictionInput) -> BatchPredictionResponse:
        """Performs batch flood predictions over a list of records."""
        self.ensure_loaded()

        results: List[BatchItemResult] = []
        for item in payload.items:
            try:
                df, summary = feature_builder.build_feature_dataframe(
                    item, self.feature_columns, self.feature_meta
                )
                preds = self.model.predict(df)
                probs = self.model.predict_proba(df)

                p_int = int(preds[0])
                prob = float(probs[0][1])
                insights = risk_insights_service.generate_risk_insights(
                    prob, p_int, summary
                )

                results.append(BatchItemResult(
                    success=True,
                    prediction=p_int,
                    flood_probability=round(prob, 4),
                    risk_level=insights["risk_level"],
                    risk_color=insights["risk_color"],
                    status_text=insights["status_text"],
                    estimated_waterlogging_depth_cm=insights["estimated_waterlogging_depth_cm"],
                    estimated_duration_hours=insights["estimated_duration_hours"],
                    advisories=insights["advisories"],
                    key_risk_drivers=insights["key_risk_drivers"],
                    summary=summary
                ))
            except Exception as e:
                results.append(BatchItemResult(
                    success=False,
                    error=str(e)
                ))

        return BatchPredictionResponse(
            count=len(results),
            results=results,
            timestamp=datetime.now().isoformat()
        )

    def generate_all_ward_forecasts(
        self, current_rainfall: float = 82.0, is_monsoon: int = 1
    ) -> WardForecastsResponse:
        """Calculates real-time ML flood predictions across all monitored Kolkata wards."""
        self.ensure_loaded()

        results: List[WardForecastItem] = []
        for ward in KOLKATA_WARDS:
            try:
                # Spatial rainfall variability modifier
                zone_modifier = {
                    "Central": 1.0,
                    "North Central": 1.15,
                    "Central East": 1.08,
                    "East": 0.85,
                    "North": 0.95
                }.get(ward["zone"], 1.0)

                ward_rain = round(current_rainfall * zone_modifier, 1)

                inp = PredictionInput(
                    ward_id=ward["id"],
                    rainfall_mm=ward_rain,
                    forecast_rainfall_mm=round(ward_rain * 1.1, 1),
                    avg_humidity_percent=82.0,
                    avg_temperature_c=28.0,
                    is_monsoon=is_monsoon
                )

                df, summary = feature_builder.build_feature_dataframe(
                    inp, self.feature_columns, self.feature_meta
                )
                preds = self.model.predict(df)
                probs = self.model.predict_proba(df)

                p_int = int(preds[0])
                prob = float(probs[0][1])
                insights = risk_insights_service.generate_risk_insights(
                    prob, p_int, summary
                )

                results.append(WardForecastItem(
                    ward_id=ward["ward_id"],
                    slug=ward["id"],
                    name=ward["name"],
                    zone=ward["zone"],
                    coordinates=[ward["longitude"], ward["latitude"]],
                    elevation_m=ward["elevation_m"],
                    rainfall_mm=ward_rain,
                    prediction=p_int,
                    flood_probability=round(prob, 3),
                    risk_index=round(prob, 2),
                    risk_level=insights["risk_level"],
                    risk_color=insights["risk_color"],
                    status_text=insights["status_text"],
                    estimated_waterlogging_depth_cm=insights["estimated_waterlogging_depth_cm"],
                    estimated_duration_hours=insights["estimated_duration_hours"],
                    advisories=insights["advisories"],
                    key_risk_drivers=insights["key_risk_drivers"]
                ))
            except Exception as e:
                logger.warning(f"Error computing forecast for ward {ward['name']}: {e}")

        return WardForecastsResponse(
            count=len(results),
            citywide_rainfall_mm=current_rainfall,
            is_monsoon=bool(is_monsoon),
            forecasts=results,
            timestamp=datetime.now().isoformat()
        )


model_service = MLModelService()
