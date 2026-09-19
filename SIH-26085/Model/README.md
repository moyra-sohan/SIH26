# 🧠 PRABAH (প্রবাহ) — Machine Learning Microservice

[![FastAPI](https://img.shields.io/badge/FastAPI-0.100+-009688.svg?style=for-the-badge&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com)
[![Python](https://img.shields.io/badge/Python-3.10%20%7C%203.11%20%7C%203.12-blue.svg?style=for-the-badge&logo=python&logoColor=white)](https://www.python.org/)
[![Scikit-Learn](https://img.shields.io/badge/Scikit--Learn-1.4+-F7931E.svg?style=for-the-badge&logo=scikit-learn&logoColor=white)](https://scikit-learn.org/)
[![Pandas](https://img.shields.io/badge/Pandas-2.x-150458.svg?style=for-the-badge&logo=pandas&logoColor=white)](https://pandas.pydata.org/)
[![Pydantic v2](https://img.shields.io/badge/Pydantic-v2.x-E92063.svg?style=for-the-badge&logo=pydantic&logoColor=white)](https://docs.pydantic.dev/)

The **PRABAH Machine Learning Microservice** is a high-resolution urban flood nowcasting, waterlogging depth estimation, and drainage load assessment engine built with **Python 3** and **FastAPI**. It powers real-time inundation predictions across the Kolkata Metropolitan Area using a **60-feature Scikit-Learn ensemble pipeline**, live **OpenWeatherMap** atmospheric feeds, and a **9-table spatial hydrological database**.

---

## 📑 Table of Contents

1. [Architectural Overview](#-architectural-overview)
2. [60-Feature Vector Taxonomy](#-60-feature-vector-taxonomy)
3. [Machine Learning Pipeline & Artifacts](#-machine-learning-pipeline--artifacts)
4. [Real-Time Weather Ingestion Pipeline](#-real-time-weather-ingestion-pipeline)
5. [Inundation Depth & Advisory Engine](#-inundation-depth--advisory-engine)
6. [9-Table Urban Flood Database & GIS Baselines](#-9-table-urban-flood-database--gis-baselines)
7. [API Endpoints Reference](#-api-endpoints-reference)
8. [Directory Structure](#-directory-structure)
9. [Prerequisites & Quick Start](#-prerequisites--quick-start)
10. [Automated Testing Suite](#-automated-testing-suite)

---

## 🏛️ Architectural Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           FASTAPI ML APPLICATION                            │
│                             (Port 8000 /docs)                               │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │
        ┌──────────────────────────────┼──────────────────────────────┐
        ▼                              ▼                              ▼
┌──────────────────┐         ┌──────────────────┐         ┌──────────────────┐
│  LIVE WEATHER    │         │  FEATURE BUILDER │         │  SPATIAL DB (9T) │
│  OpenWeatherMap  │         │  60-Vector Matrix│         │  Roads & Drains  │
│  Weather Service │         │  GIS Baselines   │         │  Ward Baselines  │
└────────┬─────────┘         └────────┬─────────┘         └────────┬─────────┘
         │                            │                            │
         └────────────────────────────┼────────────────────────────┘
                                      ▼
                   ┌──────────────────────────────────────┐
                   │  PREPROCESSOR & IMPUTER PIPELINE     │
                   │  • preprocessor.pkl                  │
                   │  • ColumnTransformer & Shims         │
                   └──────────────────┬───────────────────┘
                                      ▼
                   ┌──────────────────────────────────────┐
                   │  BEST FLOOD MODEL PIPELINE           │
                   │  • best_flood_model.pkl              │
                   │  • RandomForest Ensemble Classifier  │
                   └──────────────────┬───────────────────┘
                                      ▼
                   ┌──────────────────────────────────────┐
                   │  RISK INSIGHTS & ADVISORY ENGINE     │
                   │  • Probability % (0.00 – 1.00)       │
                   │  • Waterlogging Depth ($cm$)         │
                   │  • Drainage Clearance Duration ($h$) │
                   │  • Civic & Municipal Advisories      │
                   └──────────────────────────────────────┘
```

---

## 🔬 60-Feature Vector Taxonomy

The model utilizes a comprehensive 60-feature matrix categorized across 5 domain pillars:

| Category | Key Features Included |
|---|---|
| **1. Meteorological** | `rainfall_mm` (24h), `forecast_rainfall_mm`, `rainfall_intensity_1h`, `avg_humidity_percent`, `avg_temperature_c`, `heat_index_c`, `atmospheric_pressure_hpa`, `wind_speed_kmh`, `cloud_cover_percent`, `is_monsoon` |
| **2. Hydrological & Drainage** | `drain_efficiency_index` (1-10), `drain_load_utilization_percent`, `silt_accumulation_level`, `pumping_capacity_cusecs`, `outfall_tidal_lock_status`, `canal_water_level_m` |
| **3. Topographical & Soil** | `elevation_m`, `slope_percent`, `soil_type` (Alluvial/Clayey/Loamy), `soil_infiltration_rate_mmh`, `impervious_surface_percent`, `green_cover_percent` |
| **4. Spatial & Structural** | `ward_id`, `zone` (South, Central, North, East, Riverfront, NKDA), `population_density_sqkm`, `road_density_km_sqkm`, `low_lying_pocket_count` |
| **5. Temporal & Seasonal** | `forecast_month`, `time_of_day_hour`, `tide_cycle_phase` (High Tide / Low Tide / Ebb), `antecedent_precipitation_3d` |

---

## ⚙️ Machine Learning Pipeline & Artifacts

The microservice automatically loads all serialized artifacts from `artifacts/` during startup:

1. **`artifacts/best_flood_model.pkl`**: The trained Scikit-Learn classification model (`RandomForestClassifier` ensemble) outputting binary flood state and continuous calibrated probabilities via `predict_proba`.
2. **`artifacts/preprocessor.pkl`**: Fitted `ColumnTransformer` handling numerical median imputation, robust scaling, and categorical one-hot encodings.
3. **`artifacts/feature_columns.pkl`**: Exact 60-feature ordering expected by the model.
4. **`artifacts/feature_meta.json`**: Categorical vocabulary dictionaries and numerical bounds.
5. **`app/core/shims.py`**: Dynamic Scikit-Learn backward-compatibility shims preventing `ModuleNotFoundError` across different Python and scikit-learn versions.

---

## 🌦️ Real-Time Weather Ingestion Pipeline

The microservice includes a live weather client in `weather_service.py` connected to **OpenWeatherMap**:

- **Reverse Geolocation Mapping:** Automatically maps Kolkata ward latitude/longitude to hyper-local weather stations.
- **Dynamic Feature Conversion:** Transforms live temperature, humidity, rainfall (1h and 24h estimates), and wind speeds into model features via `weather_to_model_features()`.
- **Zero Fabrication Policy:** If live weather fails, the service returns clear, diagnostic error codes without generating fake data.

---

## 🌊 Inundation Depth & Advisory Engine

The raw classification probability is translated into actionable municipal and citizen intelligence by `risk_insights.py`:

```
┌─────────────────┬─────────────────┬───────────────────┬─────────────────────┐
│ Risk Category   │ Probability Range│ Depth Range ($cm$) │ Clearance Time ($h$)│
├─────────────────┼─────────────────┼───────────────────┼─────────────────────┤
│ 🟢 Safe         │ 0.00 – 0.25     │ 0.0 – 2.5 cm      │ 0.0 – 0.5 hours     │
│ 🟡 Moderate     │ 0.25 – 0.50     │ 2.5 – 12.0 cm     │ 0.5 – 2.5 hours     │
│ 🟠 High Risk    │ 0.50 – 0.75     │ 12.0 – 35.0 cm    │ 2.5 – 6.0 hours     │
│ 🔴 Critical     │ 0.75 – 1.00     │ 35.0 – 85.0+ cm   │ 6.0 – 18.0+ hours   │
└─────────────────┴─────────────────┴───────────────────┴─────────────────────┘
```

---

## 🗃️ 9-Table Urban Flood Database & GIS Baselines

The microservice hosts a complete spatial data engine (`urban_flood_nowcasting_db`) covering:

1. **`wards`**: 8+ Monitored Kolkata ward GIS coordinates, baseline elevations, and populations.
2. **`road_network`**: Key transit corridors (EM Bypass, Diamond Harbour Road, Central Ave) with live waterlogging flags.
3. **`drainage_infrastructure`**: Primary outfall canals (Circular Canal, Chetla Lock, Palmer Bridge) and silt levels.
4. **`pumping_stations`**: Heavy-duty municipal pumping stations with active discharge cusecs.
5. **`meteorological_history`**: Historic precipitation records for Kolkata.
6. **`historical_inundation_events`**: Historic flood records (2007, 2013, 2019, 2020 Cyclone Amphan, 2021 Cyclone Yaas).
7. **`elevation_profiles`**: High-resolution Digital Elevation Model (DEM) samples.
8. **`zone_classifications`**: KMC administrative zone boundaries.
9. **`nowcast_timeline_3h`**: Simulated flood progression states at $t+0h$, $t+1h$, $t+2h$, and $t+3h$.

---

## 📡 API Endpoints Reference

### 1. Health & Inspection
- `GET /`: Microservice metadata and available endpoints list.
- `GET /health`: Health probe verifying `model_loaded: true` and artifact integrity.
- `GET /api/features`: Complete list of 60 model features and category mappings.
- `GET /api/wards`: Spatial profiles for monitored Kolkata wards.

### 2. Predictions
- `POST /api/predict`: Single-ward nowcast with depth and advisory generation.
- `POST /api/batch-predict`: High-throughput batch inference across multiple ward payloads.
- `GET /api/ward-forecasts`: Citywide multi-ward nowcast with spatial rain modifiers.

### 3. Real-Time Weather
- `GET /api/weather/{ward_id}`: Live OpenWeatherMap data for a ward.
- `GET /api/weather-predict/{ward_id}`: End-to-end: Live Weather $\to$ Feature Transform $\to$ ML Prediction.

### 4. Spatial Database Queries (`/api/db/*`)
- `GET /api/db/tables`: List all 9 database tables and schemas.
- `GET /api/db/table/{table_name}`: Filtered record queries for any table.
- `GET /api/db/all`: Unified full database dump.
- `GET /api/db/roads`: Road network waterlogging statuses.
- `GET /api/db/drains`: Drainage network and pumping stations.
- `GET /api/db/3h-situation`: 3-hour nowcast simulation timeline.
- `POST /api/db/predict-location`: Reverse geolocates GPS coordinates to the nearest ward and executes ML inference.

---

## 📁 Directory Structure

```text
Model/
├── artifacts/
│   ├── best_flood_model.pkl          # Serialized Scikit-Learn Pipeline
│   ├── preprocessor.pkl              # Fitted ColumnTransformer
│   ├── feature_columns.pkl           # 60 Feature Names
│   └── feature_meta.json             # Numeric and Categorical Metadata
├── app/
│   ├── main.py                       # FastAPI Application Factory
│   ├── core/
│   │   ├── config.py                 # Dynamic artifact path resolvers & settings
│   │   ├── logging.py                # Structured logging setup
│   │   └── shims.py                  # Scikit-Learn compatibility shims
│   ├── schemas/
│   │   ├── common.py                 # Health and Root response schemas
│   │   ├── prediction.py             # PredictionInput and PredictionResponse schemas
│   │   └── wards.py                  # WardProfile and Forecast schemas
│   ├── services/
│   │   ├── model_service.py          # Model unpickling and inference execution
│   │   ├── feature_builder.py        # 60-feature vector assembler
│   │   ├── risk_insights.py          # Depth & duration calculation engine
│   │   ├── ward_service.py           # Ward catalog lookups
│   │   └── db_service.py             # 9-table spatial database manager
│   ├── data/
│   │   └── kolkata_wards.py          # Ward coordinates & GIS spatial baselines
│   └── api/v1/endpoints/
│       ├── predict.py                # Single & batch prediction endpoints
│       ├── wards.py                  # Ward catalog and forecast routes
│       ├── features.py               # Feature schemas route
│       ├── weather.py                # Live weather & weather-predict routes
│       └── database.py               # 9-Table spatial database & location predictor
├── scripts/                          # Model & pipeline inspection utilities
├── tests/                            # Automated test suite
├── weather_service.py                # OpenWeatherMap live ingestion client
├── main.py                           # Microservice entry point
├── app.py                            # Backward-compatible hook
└── requirements.txt                  # Python dependencies
```

---

## 🚀 Prerequisites & Quick Start

Ensure you have **Python 3.10+** installed.

```powershell
# 1. Navigate to Model directory
cd SIH-26085/Model

# 2. Activate Python Virtual Environment
.\.env\Scripts\Activate.ps1
# On Linux/macOS: source .env/bin/activate

# 3. Install dependencies
pip install -r requirements.txt

# 4. Start the FastAPI server
python main.py
```

- 🟢 **API is live at:** `http://localhost:8000`
- 📖 **Interactive Swagger UI:** `http://localhost:8000/docs`
- 📖 **ReDoc Documentation:** `http://localhost:8000/redoc`

---

## 🧪 Automated Testing Suite

Execute the test suite to verify model inference, feature engineering, and API endpoints:

```powershell
# Run all unit and integration tests:
python -m unittest discover tests

# Or run specific test modules:
python tests/test_api_endpoints.py
python tests/test_predict_pipeline.py
python tests/test_end_to_end.py
```
