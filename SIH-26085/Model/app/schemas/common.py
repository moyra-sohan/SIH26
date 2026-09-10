"""
Common Pydantic Schemas for Health, Features, and Generic Responses.
"""
from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field


class RootResponse(BaseModel):
    service: str = Field(..., description="Service identifier name")
    version: str = Field(..., description="API version")
    status: str = Field(..., description="Current online status")
    endpoints: List[str] = Field(..., description="List of primary public endpoints")
    timestamp: str = Field(..., description="ISO formatted timestamp")


class HealthResponse(BaseModel):
    status: str = Field(..., description="Overall service health status")
    model_loaded: bool = Field(..., description="True if ML pipeline model is loaded in memory")
    feature_count: int = Field(..., description="Total feature count used by model")
    wards_count: int = Field(..., description="Total monitored wards in knowledge base")
    timestamp: str = Field(..., description="ISO formatted timestamp")


class FeatureMetaDetail(BaseModel):
    feature_count: Optional[int] = None
    all_features: Optional[List[str]] = None
    numeric_features: Optional[List[str]] = None
    categorical_features: Optional[Any] = None
    categories: Optional[Dict[str, List[str]]] = None


class FeaturesResponse(BaseModel):
    total_features: int = Field(..., description="Count of feature columns expected by ML pipeline")
    feature_columns: List[str] = Field(..., description="Ordered list of feature column names")
    meta: Dict[str, Any] = Field(default_factory=dict, description="Detailed feature metadata and category mappings")


class ErrorResponse(BaseModel):
    success: bool = False
    error: str = Field(..., description="Error message details")
    detail: Optional[Any] = None
