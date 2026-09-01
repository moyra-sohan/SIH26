"""
Feature Vector Construction and Categorical Mapping Engine.
"""
from typing import Dict, Any, List, Tuple
from datetime import datetime
import pandas as pd
from app.schemas.prediction import PredictionInput
from app.services.ward_service import ward_service
from app.data import KOLKATA_WARDS


class FeatureBuilderService:
    @staticmethod
    def determine_rainfall_category(mm: float) -> str:
        if mm <= 25:
            return "Dry"
        elif mm <= 60:
            return "Moderate"
        elif mm <= 100:
            return "Wet"
        else:
            return "Very Wet"

    @staticmethod
    def determine_humidity_category(h: float) -> str:
        if h <= 70:
            return "Moderate"
        elif h <= 85:
            return "High"
        else:
            return "Very High"

    @staticmethod
    def determine_temperature_category(t: float) -> str:
        if t < 20:
            return "Cool"
        elif t < 26:
            return "Mild"
        elif t < 32:
            return "Warm"
        else:
            return "Hot"

    @classmethod
    def build_feature_dataframe(
        cls,
        input_data: PredictionInput,
        feature_columns: List[str],
        feature_meta: Dict[str, Any]
    ) -> Tuple[pd.DataFrame, Dict[str, Any]]:
        """
        Builds a single-row pandas DataFrame strictly matching the feature columns
        expected by the trained ML pipeline, merging ward baseline profile with dynamic inputs.
        """
        ward_profile = ward_service.get_ward_by_identifier(input_data.ward_id)
        if not ward_profile:
            ward_profile = KOLKATA_WARDS[0]  # Default to Behala / Ward 120

        record: Dict[str, Any] = {}

        # 1. Initialize all columns with appropriate defaults
        for col in feature_columns:
            if col in feature_meta.get("categorical_features", []):
                cats = feature_meta.get("categories", {}).get(col, [])
                record[col] = cats[0] if cats else "Unknown"
            else:
                record[col] = 0.0

        # 2. Populate baseline spatial features from selected ward profile
        for k, v in ward_profile.items():
            if k in feature_columns:
                record[k] = v

        # 3. Process dynamic weather and drainage inputs
        rainfall = input_data.rainfall_mm if input_data.rainfall_mm is not None else 82.0
        forecast_rain = (
            input_data.forecast_rainfall_mm
            if input_data.forecast_rainfall_mm is not None
            else rainfall * 1.05
        )
        intensity = (
            input_data.rainfall_intensity
            if input_data.rainfall_intensity is not None
            else (rainfall / 4.0)
        )
        humidity = (
            input_data.avg_humidity_percent
            if input_data.avg_humidity_percent is not None
            else 84.0
        )
        temp = (
            input_data.avg_temperature_c
            if input_data.avg_temperature_c is not None
            else 28.0
        )
        drain_eff = (
            input_data.drain_efficiency_index
            if input_data.drain_efficiency_index is not None
            else ward_profile.get("drainage_index_1to10", 4.5)
        )
        drain_load = (
            input_data.drain_load_utilization_percent
            if input_data.drain_load_utilization_percent is not None
            else ward_profile.get("drain_load_utilization_percent", 75.0)
        )
        silt_level = input_data.silt_accumulation_level or ward_profile.get("silt_accumulation_level", "High")
        is_monsoon = input_data.is_monsoon if input_data.is_monsoon is not None else 1

        normal_rainfall = ward_profile.get("citywide_normal_rainfall_mm", 50.0)
        dev_percent = (
            ((rainfall - normal_rainfall) / normal_rainfall) * 100.0
            if normal_rainfall
            else 0.0
        )

        record.update({
            "historical_rainfall_mm": rainfall,
            "forecast_rainfall_mm": forecast_rain,
            "rainfall_intensity": intensity,
            "avg_humidity_percent": humidity,
            "avg_temperature_c": temp,
            "drain_efficiency_index": drain_eff,
            "drain_load_utilization_percent": drain_load,
            "silt_accumulation_level": silt_level,
            "is_monsoon": is_monsoon,
            "deviation_from_normal_percent": dev_percent,
            "month_idx": datetime.now().month,
            "rainfall_category": cls.determine_rainfall_category(rainfall),
            "forecast_rainfall_category": cls.determine_rainfall_category(forecast_rain),
            "humidity_category": cls.determine_humidity_category(humidity),
            "temperature_category": cls.determine_temperature_category(temp),
            "heat_index_c": temp + (0.5555 * (6.11 * (10 ** ((7.5 * temp) / (237.3 + temp))) * (humidity / 100) - 10)),
            "forecast_issue_lead_time_days": 1,
        })

        # 4. Apply custom feature overrides if specified
        if input_data.custom_features:
            for k, v in input_data.custom_features.items():
                if k in feature_columns:
                    record[k] = v

        df = pd.DataFrame([record])[feature_columns]
        summary = {
            "ward": ward_profile["name"],
            "ward_id": ward_profile["ward_id"],
            "zone": ward_profile["zone"],
            "elevation_m": ward_profile["elevation_m"],
            "rainfall_mm": rainfall,
            "forecast_rainfall_mm": forecast_rain,
            "humidity_percent": humidity,
            "temperature_c": temp,
            "drainage_load_percent": drain_load,
            "drain_efficiency_index": drain_eff,
        }
        return df, summary


feature_builder = FeatureBuilderService()
