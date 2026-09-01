# 🌊 Urban Flood Nowcasting Platform (PRABAH)

An AI-powered real-time Urban Flood Nowcasting and Waterlogging Decision Support System for the Kolkata Metropolitan Area (KMC & NKDA Wards).

---

## 🏛️ Fullstack Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                 React + Vite Frontend (:5173)               │
│         • Live Risk Dashboard & Weather Visualizations      │
│         • Interactive MapLibre GL Flood Severity Map        │
│         • Citizen / Municipal Login & Registration          │
└───────────────┬─────────────────────────────┬───────────────┘
                │ (Primary API Route)         │ (Direct Fallback)
                ▼                             ▼
┌───────────────────────────────┐   ┌──────────────────────────────┐
│  Node.js Fastify API (:5000)   │   │  Python FastAPI ML (:8000)   │
│  • /api/auth/* ── Auth/JWT    │   │  • /api/predict              │
│  • /api/ml/*   ── ML Proxy    │   │  • /api/ward-forecasts       │
└───────────────┬───────────────┘   │  • /api/wards & /features    │
                │                   └──────────────────────────────┘
                │ (Prisma ORM)                      ▲
                ▼                                   │
┌───────────────────────────────┐                   │
│   Neon PostgreSQL Database    │                   │
│   • Persistent User Accounts  │                   │
│   • Session Storage           │                   │
└───────────────────────────────┘───────────────────┘
```

---

## 📋 Prerequisites

Ensure you have the following installed on your system:
- **Node.js**: `v18.0.0` or higher ([Download Node.js](https://nodejs.org/))
- **Python**: `3.10`, `3.11`, or `3.12` ([Download Python](https://www.python.org/))
- **Git**: For cloning and version control

---

## 🚀 How to Run the Entire Application on Web

To run the complete platform locally, open **3 separate terminal windows** (one for each service):

### 🔹 Terminal 1: Start Python FastAPI ML Service (Port 8000)

```powershell
# 1. Navigate to the Model directory
cd d:\BCA_5_SEM\SIH\SIH-26085\Model

# 2. Activate Python Virtual Environment (Windows PowerShell)
.\.env\Scripts\Activate.ps1
# (On macOS/Linux: source .env/bin/activate)

# 3. Install dependencies (if not already installed)
pip install -r requirements.txt

# 4. Start the FastAPI ML Server
python main.py
# or using uvicorn directly:
# uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```
> ✅ **ML API will run at:** `http://localhost:8000`  
> 📖 **Interactive Swagger Docs:** `http://localhost:8000/docs`

---

### 🔹 Terminal 2: Start Node.js Fastify Backend (Port 5000)

```powershell
# 1. Navigate to the backend directory
cd d:\BCA_5_SEM\SIH\SIH-26085\backend

# 2. Install Node dependencies (if first time)
npm install

# 3. Generate Prisma client (connects to Neon PostgreSQL)
npx prisma generate

# 4. Start the Backend Server
node src/server.js
# (For dev mode with auto-restart: npm run dev)
```
> ✅ **Backend Gateway will run at:** `http://localhost:5000`  
> 🩺 **Database Health Check:** `http://localhost:5000/api/health`

---

### 🔹 Terminal 3: Start React + Vite Frontend (Port 5173)

```powershell
# 1. Navigate to the frontend directory
cd d:\BCA_5_SEM\SIH\SIH-26085\frontend\prabah

# 2. Install Frontend dependencies (if first time)
npm install

# 3. Start Vite Development Server
npm run dev
```
> ✅ **Web App is live at:** `http://localhost:5173`

---

## 🧪 Verify Fullstack Integration

You can test that all 4 layers (ML Service + Node.js Gateway + Neon Database + Frontend) are connected and responding with a single command:

```powershell
# In the root workspace directory:
cd d:\BCA_5_SEM\SIH\SIH-26085
.\Model\.env\Scripts\python.exe verify_fullstack.py
```

Expected output:
```
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

## 🌐 Web Application Features & Navigation

Once you open `http://localhost:5173` in your browser:

1. **Authentication Page (`/`)**:
   - Register a new citizen account or login.
   - Credentials are encrypted with `bcrypt` and stored in **Neon PostgreSQL**.
2. **Flood Risk Dashboard (`/dashboard`)**:
   - Real-time weather parameters and flood probability meters.
   - Waterlogging depth estimations (cm) and clearance duration predictions (hours).
   - **Interactive Live Simulator Modal**: Adjust rainfall, humidity, and drainage efficiency sliders to test what-if scenarios in real-time.
3. **Spatial Nowcast Map (`/map`)**:
   - Live MapLibre GL map showing Kolkata municipal wards (Behala, Howrah Strand, Park Street, Tollygunge, Salt Lake, Jadavpur, Dum Dum, New Town).
   - Color-coded risk markers (Green: Low, Yellow: Moderate, Orange: High, Red: Critical) with popup telemetry.

---

## 📁 Repository Directory Structure

```
SIH-26085/
├── Model/                            # Python FastAPI ML Microservice
│   ├── app/                          # Modular API package (core, schemas, services, api)
│   ├── artifacts/                    # Serialized AI model (.pkl) & 60-feature metadata (.json)
│   ├── scripts/                      # ML utility & inspection scripts
│   ├── tests/                        # Automated unit & integration tests
│   ├── main.py                       # FastAPI entry point
│   ├── requirements.txt              # Python packages
│   └── README.md                     # ML service documentation
├── backend/                          # Node.js Fastify Backend Gateway
│   ├── prisma/                       # Database schema & migrations for Neon PostgreSQL
│   ├── src/                          # Server entry point, auth routes, and ML proxy
│   └── package.json                  # Backend dependencies
├── frontend/
│   └── prabah/                       # React + Vite Frontend Web App
│       ├── src/                      # Dashboard, Map, Auth pages, components, & styles
│       ├── package.json              # Frontend dependencies
│       └── vite.config.js            # Vite build configuration
├── verify_fullstack.py               # Automated end-to-end integration test runner
└── README.md                         # This Master Documentation File
```

---

## 🛠️ Environment Configuration (.env)

### Backend (`backend/.env`):
```env
DATABASE_URL="postgresql://neondb_owner:***@ep-dawn-heart-a5liig8g-pooler.us-east-2.aws.neon.tech/neondb?sslmode=require"
PORT=5000
JWT_SECRET="sih_urban_flood_secret_key_2026_jwt_token"
SESSION_SECRET="sih_flood_session_secret_key_minimum_32_characters_long_2026!"
COOKIE_SECRET="sih_flood_cookie_secret_key_minimum_32_characters_long_2026!"
ML_SERVICE_URL="http://127.0.0.1:8000"
```

---

## 🚢 Building for Production

If building static frontend bundles and production binaries:

```powershell
# Build Frontend
cd frontend/prabah
npm run build
# Built artifacts will be generated in frontend/prabah/dist/
```
