# Urban Flood Nowcasting ML API Service

High-resolution Machine Learning backend for Kolkata urban flood risk nowcasting, waterlogging depth estimation, and drainage load assessment.

---

## 📁 Directory Hierarchy & Architecture

```
Model/
├── app/                              # Core Application Package
│   ├── __init__.py                   # Exposes app & create_app
│   ├── main.py                       # FastAPI application factory, CORS, lifespan & router registration
│   ├── core/                         # Core Configurations, Settings & Shims
│   │   ├── __init__.py
│   │   ├── config.py                 # Central settings & dynamic artifact path resolution
│   │   ├── logging.py                # Structured logging configuration
│   │   └── shims.py                  # Scikit-Learn backward-compatibility shims
│   ├── schemas/                      # Pydantic Request & Response Data Models
│   │   ├── __init__.py
│   │   ├── common.py                 # RootResponse, HealthResponse, FeaturesResponse, ErrorResponse
│   │   ├── prediction.py             # PredictionInput, BatchPredictionInput, PredictionResponse
│   │   └── wards.py                  # WardProfile, WardForecastItem, WardForecastsResponse
│   ├── services/                     # Business Logic & Machine Learning Services
│   │   ├── __init__.py
│   │   ├── model_service.py          # ML Pipeline management, unpickling, and inferencing
│   │   ├── feature_builder.py        # 60-feature vector generation, weather mapping & encoding
│   │   ├── risk_insights.py          # Risk index scoring, waterlogging depth/duration & advisories
│   │   └── ward_service.py           # Kolkata ward lookup and spatial profiling
│   ├── api/                          # API Route Controllers (Routers)
│   │   ├── __init__.py
│   │   ├── health.py                 # GET / and GET /health routes
│   │   └── v1/
│   │       ├── __init__.py
│   │       ├── router.py             # Main v1 aggregator router
│   │       └── endpoints/
│   │           ├── __init__.py
│   │           ├── predict.py        # POST /api/predict & POST /api/batch-predict
│   │           ├── wards.py          # GET /api/wards & GET /api/ward-forecasts
│   │           └── features.py       # GET /api/features
│   └── data/                         # Static Knowledge Base & Spatial Data
│       ├── __init__.py
│       └── kolkata_wards.py          # Ward definitions and GIS spatial baselines
├── artifacts/                        # Serialized Model Artifacts & Metadata
│   ├── best_flood_model.pkl          # Trained Scikit-Learn Pipeline
│   ├── feature_columns.pkl           # Feature name column mappings (60 features)
│   ├── feature_meta.json             # Numeric / categorical categories metadata
│   └── preprocessor.pkl              # Fitted ColumnTransformer & Imputer
├── scripts/                          # Utility & Inspection Scripts
│   ├── extract_meta.py               # Feature metadata extraction script
│   ├── inspect_models.py             # Model structure inspector
│   ├── inspect_pipeline_steps.py     # Pipeline step inspector
│   └── joblib_inspect.py             # Pickle inspection script
├── tests/                            # Automated Integration and Unit Tests
│   ├── __init__.py
│   ├── test_api_endpoints.py         # End-to-end FastAPI endpoint integration tests
│   ├── test_predict_pipeline.py      # ML preprocessor and model transformation tests
│   ├── test_end_to_end.py            # Scenario-based flood risk simulation tests
│   └── test_model.py                 # Raw pipeline verification script
├── app.py                            # Backward-compatible entrypoint (`uvicorn app:app`)
├── main.py                           # Standard entrypoint (`uvicorn main:app` or `python main.py`)
├── requirements.txt                  # Python dependencies
├── .gitignore                        # Git ignore rules for virtualenv, bytecode, and logs
└── README.md                         # Architecture and API documentation
```

---

## 🚀 Quick Start

### 1. Activate Environment & Install Dependencies
```powershell
# In the Model directory:
.\.env\Scripts\Activate.ps1
pip install -r requirements.txt
```

### 2. Run Development Server
You can launch the server using any of the following standard methods:
```powershell
# Method 1: Direct python run
python main.py
# or
python app.py

# Method 2: Uvicorn CLI
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
# or (Backward-compatible)
uvicorn app:app --host 0.0.0.0 --port 8000 --reload
```

---

## 📡 API Endpoints Reference

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/` | Service status, metadata, and available endpoints |
| `GET` | `/health` | Health readiness check & model loaded state |
| `GET` | `/api/features` | Total feature list (60 features) and category mappings |
| `GET` | `/api/wards` | Monitored Kolkata ward profiles and baseline attributes |
| `POST` | `/api/predict` | Single ward flood prediction with depth & advisories |
| `GET` | `/api/ward-forecasts` | Citywide multi-ward nowcast with spatial rain modifiers |
| `POST` | `/api/batch-predict` | Batch predictions across multiple custom input items |

### Interactive API Documentation
Once running, explore the interactive Swagger UI at:
* **Swagger UI**: [http://localhost:8000/docs](http://localhost:8000/docs)
* **ReDoc**: [http://localhost:8000/redoc](http://localhost:8000/redoc)

---

## 🧪 Testing

Run the automated test suite:
```powershell
python -m unittest discover tests
# or run the endpoint test directly:
python tests/test_api_endpoints.py
```
