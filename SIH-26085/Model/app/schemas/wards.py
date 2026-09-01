"""
Pydantic Schemas for Kolkata Ward Profiles and Spatial Forecast Responses.
"""
from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field


class WardProfile(BaseModel):
    id: str = Field(..., description="Unique slug for ward")
    name: str = Field(..., description="Display name of ward")
    zone: str = Field(..., description="Kolkata zone name (e.g. Central, North, East)")
    administrative_body: str
    ward_id: int
    latitude: float
    longitude: float
    elevation_m: float
    elevation_category: str
    flood_vulnerability_class_by_elevation: str
    drainage_index_1to10: float
    road_density_index_1to10: float
    near_hooghly_river: str
    distance_from_city_center_km: float
    approx_ward_area_sqkm: float
    approx_boundary_perimeter_km: float
    estimated_waterlogged_area_percent: float
    relative_elevation_vs_sample_mean_m: float
    groundwater_table_depth_m: float
    waterlogging_risk_from_shallow_table: str
    landscape_type: str
    land_use_category: str
    water_body_proximity: str
    impervious_surface_percent: float
    water_surface_percent: float
    green_cover_baseline_percent: float
    seasonal_green_cover_percent: float
    approx_road_network_length_km: float
    boundary_type: str
    within_kmc_limits: str
    drainage_system_type: str
    storm_drain_coverage_percent: float
    drain_load_utilization_percent: float
    silt_accumulation_level: str
    historical_rainfall_mm_reference: float
    flood_waterlogging_events: int
    estimated_avg_waterlogging_duration_hours: float
    reported_road_waterlogging_incidents: int
    citywide_normal_rainfall_mm: float
    citywide_normal_humidity_percent: float
    citywide_normal_temperature_c: float


class WardListResponse(BaseModel):
    count: int = Field(..., description="Number of wards returned")
    wards: List[Dict[str, Any]] = Field(..., description="List of ward profile objects")


class WardForecastItem(BaseModel):
    ward_id: int
    slug: str
    name: str
    zone: str
    coordinates: List[float]
    elevation_m: float
    rainfall_mm: float
    prediction: int
    flood_probability: float
    risk_index: float
    risk_level: str
    risk_color: str
    status_text: str
    estimated_waterlogging_depth_cm: float
    estimated_duration_hours: float
    advisories: List[str]
    key_risk_drivers: List[str]


class WardForecastsResponse(BaseModel):
    count: int
    citywide_rainfall_mm: float
    is_monsoon: bool
    forecasts: List[WardForecastItem]
    timestamp: str
