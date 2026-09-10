"""
Pydantic Schemas for Single & Batch Flood Prediction Requests and Responses.
"""
from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field


class PredictionInput(BaseModel):
    ward_id: Optional[Any] = Field(default=None, description="Kolkata Ward ID or slug (e.g., 63, 120, 'behala-ward-120')")
    rainfall_mm: Optional[float] = Field(default=None, description="Recorded 24h rainfall in mm")
    forecast_rainfall_mm: Optional[float] = Field(default=None, description="Forecasted rainfall for next 24h in mm")
    rainfall_intensity: Optional[float] = Field(default=None, description="Peak rainfall intensity in mm/hr")
    avg_humidity_percent: Optional[float] = Field(default=None, description="Average relative humidity %")
    avg_temperature_c: Optional[float] = Field(default=None, description="Ambient temperature in °C")
    drain_efficiency_index: Optional[float] = Field(default=None, description="Drainage operational efficiency (1 to 10)")
    drain_load_utilization_percent: Optional[float] = Field(default=None, description="Drainage capacity load %")
    silt_accumulation_level: Optional[str] = Field(default=None, description="Low, Moderate, High, or Very High")
    is_monsoon: Optional[int] = Field(default=1, description="1 if monsoon period, 0 otherwise")
    custom_features: Optional[Dict[str, Any]] = Field(default=None, description="Direct overrides for any of the 60 feature fields")


class BatchPredictionInput(BaseModel):
    items: List[PredictionInput] = Field(..., description="List of prediction input items")


class RiskInsights(BaseModel):
    risk_level: str = Field(..., description="Risk category: Low, Moderate, High, Critical")
    risk_color: str = Field(..., description="Hex color code associated with risk level")
    status_text: str = Field(..., description="Descriptive status banner text")
    estimated_waterlogging_depth_cm: float = Field(..., description="Estimated flood waterlogging depth in cm")
    estimated_duration_hours: float = Field(..., description="Estimated waterlogging clearance duration in hours")
    advisories: List[str] = Field(default_factory=list, description="Actionable civic/citizen safety advisories")
    key_risk_drivers: List[str] = Field(default_factory=list, description="Identified environmental/infrastructure drivers")


class PredictionResponse(BaseModel):
    success: bool = True
    prediction: int = Field(..., description="Binary classification (1 = Flood Risk, 0 = Safe)")
    is_flood_risk: bool = Field(..., description="True if flood threshold breached")
    flood_probability: float = Field(..., description="Probability of flood occurrence (0.0 to 1.0)")
    safe_probability: float = Field(..., description="Probability of safe condition (0.0 to 1.0)")
    risk_index: float = Field(..., description="Normalized Risk Index score (0.0 to 1.0)")
    risk_level: str
    risk_color: str
    status_text: str
    estimated_waterlogging_depth_cm: float
    estimated_duration_hours: float
    advisories: List[str]
    key_risk_drivers: List[str]
    inputs_summary: Dict[str, Any]
    timestamp: str


class BatchItemResult(BaseModel):
    success: bool
    prediction: Optional[int] = None
    flood_probability: Optional[float] = None
    risk_level: Optional[str] = None
    risk_color: Optional[str] = None
    status_text: Optional[str] = None
    estimated_waterlogging_depth_cm: Optional[float] = None
    estimated_duration_hours: Optional[float] = None
    advisories: Optional[List[str]] = None
    key_risk_drivers: Optional[List[str]] = None
    summary: Optional[Dict[str, Any]] = None
    error: Optional[str] = None


class BatchPredictionResponse(BaseModel):
    count: int
    results: List[BatchItemResult]
    timestamp: str
