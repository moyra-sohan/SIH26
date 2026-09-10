# 🌊 PRABAH (প্রবাহ) — Urban Flood Nowcasting & Decision Support System

[![Smart India Hackathon 2026](https://img.shields.io/badge/SIH-2026-blue.svg?style=for-the-badge&logo=codeforces)](https://www.sih.gov.in/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.100+-009688.svg?style=for-the-badge&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com)
[![Fastify](https://img.shields.io/badge/Fastify-5.x-000000.svg?style=for-the-badge&logo=fastify&logoColor=white)](https://fastify.dev/)
[![React 19](https://img.shields.io/badge/React-19.0-61DAFB.svg?style=for-the-badge&logo=react&logoColor=black)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Vite-8.x-646CFF.svg?style=for-the-badge&logo=vite&logoColor=white)](https://vitejs.dev/)
[![Neon PostgreSQL](https://img.shields.io/badge/Neon-PostgreSQL-00E599.svg?style=for-the-badge&logo=postgresql&logoColor=black)](https://neon.tech/)
[![MapLibre GL](https://img.shields.io/badge/MapLibre-GL--JS-396B94.svg?style=for-the-badge&logo=maplibre&logoColor=white)](https://maplibre.org/)
[![Scikit-Learn](https://img.shields.io/badge/Scikit--Learn-1.4+-F7931E.svg?style=for-the-badge&logo=scikit-learn&logoColor=white)](https://scikit-learn.org/)

**PRABAH (Urban Flood Nowcasting System)** is an enterprise-grade, AI-driven, hyper-local urban flood prediction and real-time decision support platform engineered specifically for the Kolkata Metropolitan Area (Kolkata Municipal Corporation - KMC & New Town Kolkata Development Authority - NKDA).

Developed for **Smart India Hackathon (SIH 2026)**, PRABAH bridges live meteorological feeds, geospatial hydrological topology, municipal drainage infrastructure metrics, and a 60-feature Machine Learning pipeline to deliver ward-level nowcasts, waterlogging depth estimates, drainage clearance times, and civic advisories.

---

## 📑 Table of Contents

1. [Problem Statement & Vision](#-problem-statement--vision)
2. [End-to-End System Architecture](#-end-to-end-system-architecture)
3. [Key Modules & Capabilities](#-key-modules--capabilities)
4. [Tech Stack Summary](#-tech-stack-summary)
5. [Repository Structure](#-repository-structure)
6. [Prerequisites & System Requirements](#-prerequisites--system-requirements)
7. [Step-by-Step Quick Start Guide](#-step-by-step-quick-start-guide)
8. [Fullstack Integration Verification](#-fullstack-integration-verification)
9. [Detailed Subsystem Documentation](#-detailed-subsystem-documentation)
10. [Environment Variables Matrix](#-environment-variables-matrix)
11. [API Endpoints Directory](#-api-endpoints-directory)
12. [Contributing & License](#-contributing--license)

---

## 🎯 Problem Statement & Vision

During the Indian monsoon season, urban agglomerations like Kolkata suffer from severe waterlogging, sudden cloudbursts, tidal river backflow (Hooghly river), and drainage capacity bottlenecks. Traditional citywide weather alerts lack hyper-local resolution and actionable depth predictions.

**PRABAH solves this challenge by:**
- **Hyper-Local Resolution:** Ingesting live coordinates and ward spatial profiles across 8+ major Kolkata zones (Behala, Howrah Strand, Park Street, Tollygunge, Salt Lake, Jadavpur, Dum Dum, New Town).
- **Multi-Factor ML Inundation Modeling:** Computing flood probabilities using a 60-feature vector combining precipitation, humidity, soil permeability, elevation, drain efficiency, and tidal lock indices.
- **Physical Impact Nowcasting:** Translating raw probabilities into physical metrics: waterlogging depth ($cm$), duration to dry ($hours$), and road submergence flags.
- **Interactive Decision Support:** Empowering municipal authorities and citizens with live what-if simulation sliders, road/drain network telemetry, and emergency dispatch links.

---

## 🏛️ End-to-End System Architecture

```
┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│                                 PRESENTATION LAYER (Frontend)                               │
│                         React 19 • Vite 8 • MapLibre GL JS • Recharts                       │
│  ┌─────────────────────────┐  ┌─────────────────────────┐  ┌─────────────────────────────┐  │
│  │    Citizen / Admin      │  │    Live Flood & Weather │  │   Interactive MapLibre GL   │  │
│  │   Auth & Registration   │  │   Telemetry Dashboard   │  │    Ward Inundation Map      │  │
│  │  (Session / JWT / DB)   │  │  (Live ML Simulator)    │  │   (Roads, Drains, Heatmap)  │  │
│  └────────────┬────────────┘  └────────────┬────────────┘  └──────────────┬──────────────┘  │
└───────────────┼────────────────────────────┼──────────────────────────────┼─────────────────┘
                │                            │                              │
                │ HTTP / REST (Port 5173)    │ REST Proxy                   │ Direct Fallback
                ▼                            ▼                              ▼
┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│                                APPLICATION GATEWAY (Backend)                                │
│                              Node.js • Fastify 5 • Prisma ORM                               │
│  • Authentication Controller: Password Hashing (bcrypt), JWT Token Generation, Sessions     │
│  • Health Probes: Database connectivity check & ML microservice liveness checks             │
│  • Reverse Proxy Layer: Proxies ML requests, handles CORS, fault tolerance & caching        │
└───────────────┬───────────────────────────────────────────────────────────┬─────────────────┘
                │                                                           │
                │ Prisma Client Queries                                     │ HTTP (Port 8000)
                ▼                                                           ▼
┌───────────────────────────────┐               ┌─────────────────────────────────────────────┐
│       PERSISTENCE LAYER       │               │             AI / ML MICROSERVICE            │
│   Neon Serverless PostgreSQL  │               │           Python 3.10+ • FastAPI            │
│  • Users & Profiles Table     │               │  ┌───────────────────────────────────────┐  │
│  • Geographic Addresses       │               │  │  Live Weather Service (OpenWeatherMap)│  │
│  • Audit Timestamps           │               │  └───────────────────┬───────────────────┘  │
└───────────────────────────────┘               │                      ▼                      │
                                                │  ┌───────────────────────────────────────┐  │
                                                │  │ 60-Feature Engineering & Imputer Pipe │  │
                                                │  │  • Scikit-Learn Pipeline & Shims      │  │
                                                │  │  • Preprocessor.pkl & Metadata Schema │  │
                                                │  └───────────────────┬───────────────────┘  │
                                                │                      ▼                      │
                                                │  ┌───────────────────────────────────────┐  │
                                                │  │ Inundation Classifier & Risk Engine   │  │
                                                │  │  • Waterlogging Depth ($cm$) Estimation │
                                                │  │  • Clearance Duration ($h$) Engine    │  │
                                                │  │  • 9-Table Kolkata Spatial DB Module  │  │
                                                │  └───────────────────────────────────────┘  │
                                                └─────────────────────────────────────────────┘
```

---

## ⚡ Key Modules & Capabilities

### 1. 🖥️ Interactive Web Dashboard (`frontend/prabah`)
- **Live Weather Visualizations:** Real-time temperature, relative humidity, barometric pressure, wind velocity, and precipitation trends.
- **Dynamic Risk Gauge:** Real-time color-coded classification: `Safe` (Green), `Moderate` (Yellow), `High` (Orange), `Critical` (Red).
- **Scenario Simulator:** Live interactive modal sliders allowing users and city planners to simulate rainfall bursts ($0–200\text{ mm}$), drain blockage, and humidity changes with immediate ML recalculations.
- **Spatial Map Page:** High-performance MapLibre GL instance with custom GeoJSON polygons, road waterlogging overlays, drainage pumping stations, and search filters.
- **Emergency Support Portal:** Immediate access to Kolkata Municipal Corporation (KMC) control rooms, NDRF helplines, and evacuation center coordinates.

### 2. 🔐 Secure Backend Gateway (`backend`)
- **Modern Fastify 5 Engine:** High-throughput async routing with lower latency than traditional Express apps.
- **Session & JWT Auth:** Dual security using signed HTTP-only secure cookies and Bearer tokens.
- **Neon Cloud PostgreSQL:** Fully typed database access via Prisma ORM storing detailed citizen profiles and locations.
- **Resilient Fallback Routing:** If the ML backend is booting, the API gateway offers structured degradation messages without crashing the frontend.

### 3. 🧠 Machine Learning Nowcasting Service (`Model`)
- **60-Feature Pipeline:** Considers precipitation (1h, 3h, 24h, forecast), soil moisture, surface runoff index, drain load utilization %, elevation ($m$), tidal river lock flags, and monsoon indicators.
- **Live OpenWeatherMap Telemetry:** Live weather ingestion pipeline with coordinate-to-ward mapping.
- **Risk & Depth Heuristics:** Calibrated regression-heuristic bridge computing precise expected standing water depths in centimeters and clearance hours.
- **9-Table Spatial Knowledge Base:** Built-in spatial database covering Kolkata road arteries, pumping stations, drainage canals, and 3-hour nowcast timeline progressions.

---

## 🧰 Tech Stack Summary

| Layer | Technologies | Primary Roles |
|---|---|---|
| **Frontend** | React 19, Vite 8, MapLibre GL JS, Recharts, Lucide Icons | Responsive UI, interactive maps, telemetry charts, state management |
| **Backend Gateway** | Node.js, Fastify 5, Prisma ORM, bcryptjs, Fastify JWT | Auth management, session cookies, database access, ML request proxy |
| **Database** | Neon Serverless PostgreSQL | Cloud relational database for users, credentials, and geographic profiles |
| **AI / ML Service** | Python 3.10+, FastAPI, Uvicorn, Scikit-Learn, Pandas, NumPy, Pydantic | Inundation classification, 60-feature vector generation, risk scoring |
| **External APIs** | OpenWeatherMap API, OpenStreetMap Raster Tiles | Live atmospheric data feeds and base map raster rendering |

---

## 📁 Repository Structure

```text
SIH/
├── README.md                                  # Workspace Master Documentation
└── SIH-26085/                                 # Primary Hackathon Submission Root
    ├── verify_fullstack.py                    # Automated 4-tier integration test runner
    ├── README.md                              # SIH-26085 Master Architecture & Setup Guide
    │
    ├── frontend/                              # Frontend Subsystem
    │   ├── README.md                          # Frontend Architecture & Component Documentation
    │   └── prabah/                            # React 19 + Vite Application
    │       ├── index.html                     # HTML5 Entry Point
    │       ├── package.json                   # Dependencies & Scripts
    │       ├── vite.config.js                 # Vite Dev Server Configuration
    │       └── src/
    │           ├── main.jsx                   # Application Bootstrap
    │           ├── App.jsx                    # Client Routing & Auth Provider
    │           ├── components/                # Modular UI Components
    │           │   ├── Layout.jsx             # Sidebar + Header Application Wrapper
    │           │   ├── Sidebar.jsx            # Dynamic Navigation Menu
    │           │   ├── NotificationCenter.jsx # Real-time Alerts Notification Drawer
    │           │   ├── dashboard/             # Dashboard Widgets (Weather, FloodRisk, Chart, LiveSimulator)
    │           │   └── map/                   # MapLibre GL Map, Telemetry Panel, Filter Box, 3H Situation Bar
    │           ├── context/                   # AuthContext & Session State
    │           ├── data/                      # GeoJSON City Boundaries & Spatial Datasets
    │           ├── pages/                     # AuthPage, DashboardPage, MapPage, EmergencySupport
    │           ├── services/                  # api.js API Client (Backend Proxy + Direct Fallback)
    │           └── styles/                    # High-Performance Vanilla CSS Modules
    │
    ├── backend/                               # Backend Gateway Subsystem
    │   ├── README.md                          # Backend & Prisma Database Documentation
    │   ├── package.json                       # Node.js Dependencies & Scripts
    │   ├── .env.example                       # Environment Variables Blueprint
    │   ├── verify_db.js                       # Prisma Database Connection Validator
    │   ├── prisma/
    │   │   └── schema.prisma                  # PostgreSQL User Model & Database Schema
    │   └── src/
    │       ├── server.js                      # Fastify 5 Application Entry Point
    │       ├── lib/prisma.js                  # Singleton Prisma Client Instance
    │       └── routes/
    │           ├── auth.js                    # Registration, Login, Session, /me, & Logout
    │           └── ml.js                      # Reverse Proxy to Python FastAPI ML Microservice
    │
    └── Model/                                 # Machine Learning Microservice Subsystem
        ├── README.md                          # ML Pipeline & API Reference Documentation
        ├── requirements.txt                   # Python Dependencies
        ├── main.py                            # FastAPI Microservice Entry Point
        ├── app.py                             # Backward-Compatible Application Hook
        ├── weather_service.py                 # OpenWeatherMap Integration Module
        ├── artifacts/                         # Serialized AI Pipelines & Schema Metadata
        │   ├── best_flood_model.pkl           # Trained Scikit-Learn Classifier
        │   ├── preprocessor.pkl               # Fitted ColumnTransformer & Imputer
        │   ├── feature_columns.pkl            # 60-Feature Names List
        │   └── feature_meta.json              # Continuous & Categorical Feature Metadata
        ├── app/                               # Modular FastAPI Architecture
        │   ├── core/                          # Settings, Config & Scikit-Learn Shims
        │   ├── schemas/                       # Pydantic Request/Response Models
        │   ├── services/                      # Feature Builder, Model Inference, Risk Insights
        │   └── api/v1/endpoints/              # Predict, Wards, Weather, Database, Features
        ├── scripts/                           # ML Inspection & Metadata Extractors
        └── tests/                             # Unit & Integration Test Suite
```

---

## 📋 Prerequisites & System Requirements

Before running the platform, ensure the following software is installed:

- **Node.js**: `v18.0.0` or later ([Download Node.js](https://nodejs.org/))
- **Python**: `3.10`, `3.11`, or `3.12` ([Download Python](https://www.python.org/))
- **Git**: For version control and cloning
- **PowerShell (Windows)** or **Bash (Linux/macOS)**

---

## 🚀 Step-by-Step Quick Start Guide

To run the entire PRABAH platform locally, open **3 separate terminal windows** (one for each microservice layer):

```
┌────────────────────────┐  ┌────────────────────────┐  ┌────────────────────────┐
│  TERMINAL 1: ML Model  │  │  TERMINAL 2: Backend   │  │  TERMINAL 3: Frontend  │
│  FastAPI (Port 8000)   │  │  Fastify (Port 5000)   │  │  Vite (Port 5173)      │
└────────────────────────┘  └────────────────────────┘  └────────────────────────┘

```
> 🟢 **Web Application is live at:** `http://localhost:5173`

---

## 🧪 Fullstack Integration Verification

The repository includes an automated end-to-end integration tester that verifies all 4 system layers in under 2 seconds.

```powershell
# From the SIH-26085 directory:
cd d:\BCA_5_SEM\SIH\SIH-26085
.\Model\.env\Scripts\python.exe verify_fullstack.py
```

### Expected Output:
```text
============================================================
 URBAN FLOOD NOWCASTING - FULLSTACK END-TO-END VERIFICATION
============================================================
[1] Testing Python FastAPI ML Microservice (:8000)... -> Status: 200 (Model Loaded: True)
[2] Testing Node.js Fastify Backend Proxy (:5000)...  -> Status: 200 (ML Status: Connected)
[3] Testing React Vite Frontend Server (:5173)...     -> Status: 200 (HTML Available)
[4] Testing Neon PostgreSQL Database...              -> Status: 200 (DB Connected)

============================================================
 ALL CHECKS PASSED: PLATFORM IS FULLY CONNECTED & OPERATIONAL!
============================================================
```

---

## 📖 Detailed Subsystem Documentation

Each major module in the repository includes its own standalone, in-depth documentation guide:

- **[Frontend Architecture & UI Documentation]**  
  Covers React component breakdown, MapLibre GL layers, Recharts visualizations, state management, CSS variables, and responsive layouts.
- **[Backend Gateway & Database Documentation]**  
  Covers Fastify plugins, Neon PostgreSQL connection strings, Prisma ORM schema, JWT and Session cookie authentication, and reverse proxy routes.
- **[Machine Learning Microservice Documentation]**  
  Covers the 60-feature vector specification, Scikit-Learn model artifacts, real-time OpenWeatherMap telemetry pipeline, risk scoring algorithms, and the 9-table spatial database.

---

## 📡 API Endpoints Directory

### Authentication & Gateway (`http://localhost:5000`)
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/health` | Neon PostgreSQL & Fastify gateway health check |
| `POST` | `/api/auth/register` | Register new citizen account with geographic address |
| `POST` | `/api/auth/login` | Authenticate with Email/Username & Password |
| `GET` | `/api/auth/session` | Inspect active session state and authenticated user |
| `GET` | `/api/auth/me` | Fetch authenticated user profile via JWT/Session |
| `POST` | `/api/auth/logout` | Clear session and revoke signed authentication cookies |

### AI / ML Microservice & Proxied Routes (`http://localhost:8000` or `/api/ml/*`)
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/health` / `/api/ml/health` | ML model loaded status and API health |
| `POST` | `/api/predict` / `/api/ml/predict` | Single ward nowcast (risk probability, depth, duration) |
| `GET` | `/api/weather/:ward_id` | Live OpenWeatherMap telemetry for specific Kolkata ward |
| `GET` | `/api/weather-predict/:ward_id` | Full pipeline: Live Weather $\to$ Feature Transform $\to$ ML Prediction |
| `GET` | `/api/ward-forecasts` | Multi-ward citywide flood risk forecasts |
| `POST` | `/api/batch-predict` | Batch predictions across custom input arrays |
| `GET` | `/api/wards` | Monitored Kolkata ward baseline profiles |
| `GET` | `/api/features` | Metadata and schemas for all 60 ML features |
| `GET` | `/api/db/roads` | Real-time road network submergence statuses |
| `GET` | `/api/db/drains` | Drainage channels & pumping station telemetry |
| `GET` | `/api/db/3h-situation` | 3-hour flood progression timeline simulation |
| `POST` | `/api/db/predict-location` | Predict flood risk for arbitrary GPS coordinates |

---

## 👥 Team & Submission Information

- **Project:** PRABAH — Urban Flood Nowcasting & Decision Support System
- **Event:** Smart India Hackathon (SIH 2026)
- **Problem Statement Code:** SIH-26085
- **Focus Area:** Smart Automation / Disaster Management / Urban Resilience

---

## 📄 License

This project is developed for educational, research, and hackathon presentation purposes under the Smart India Hackathon (SIH 2026) guidelines.
