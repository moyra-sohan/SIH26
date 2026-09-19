# 🎨 PRABAH (প্রবাহ) — Frontend Web Application

[![React 19](https://img.shields.io/badge/React-19.0-61DAFB.svg?style=for-the-badge&logo=react&logoColor=black)](https://react.dev/)
[![Vite 8](https://img.shields.io/badge/Vite-8.x-646CFF.svg?style=for-the-badge&logo=vite&logoColor=white)](https://vitejs.dev/)
[![MapLibre GL](https://img.shields.io/badge/MapLibre-GL--JS-396B94.svg?style=for-the-badge&logo=maplibre&logoColor=white)](https://maplibre.org/)
[![Recharts](https://img.shields.io/badge/Recharts-2.x-22B5BF.svg?style=for-the-badge)](https://recharts.org/)
[![Lucide Icons](https://img.shields.io/badge/Lucide-React-F56565.svg?style=for-the-badge&logo=lucide&logoColor=white)](https://lucide.dev/)

The **PRABAH Frontend** is a modern, high-performance, real-time urban flood monitoring and decision support web application built with **React 19** and **Vite 8**. It delivers hyper-local flood nowcasts, live weather analytics, interactive MapLibre GL 2D spatial maps, interactive "what-if" ML simulation modals, and civic emergency resources for the Kolkata Metropolitan Region.

---

## 📑 Table of Contents

1. [Architectural Overview](#-architectural-overview)
2. [Directory Hierarchy & Component Breakdown](#-directory-hierarchy--component-breakdown)
3. [Key Pages & User Flows](#-key-pages--user-flows)
4. [Interactive Components & Modals](#-interactive-components--modals)
5. [Geospatial Mapping & Visualization](#-geospatial-mapping--visualization)
6. [State Management & API Client](#-state-management--api-client)
7. [Design System & CSS Styling](#-design-system--css-styling)
8. [Prerequisites & Installation](#-prerequisites--installation)
9. [Available Scripts](#-available-scripts)

---

## 🏛️ Architectural Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                            REACT 19 CLIENT ROOT                             │
│                                 (App.jsx)                                   │
│                                     │                                       │
│                         ┌───────────┴───────────┐                           │
│                         ▼                       ▼                           │
│                 AuthContext Provider     React Router DOM                   │
│                                                 │                           │
│         ┌───────────────────┬───────────────────┼───────────────────┐       │
│         ▼                   ▼                   ▼                   ▼       │
│    AuthPage (`/`)   DashboardPage (`/dashboard`) MapPage (`/map`) Emergency │
│         │                   │                   │                   │       │
│         │           ┌───────┴───────┐   ┌───────┴───────┐           │       │
│         │           │ Layout Header │   │ MapLibre GL   │           │       │
│         │           │ Sidebar Nav   │   │ GeoJSON Layer │           │       │
│         │           │ Live ML Modal │   │ Telemetry Pop │           │       │
│         │           └───────┬───────┘   └───────┬───────┘           │       │
│         │                   │                   │                   │       │
│         └───────────────────┼───────────────────┴───────────────────┘       │
│                             ▼                                               │
│                   Unified API Service (api.js)                              │
│              • Primary: Node.js Backend Gateway (:5000)                     │
│              • Direct Fallback: Python FastAPI ML (:8000)                   │
│              • Offline Fallback: Embedded GeoJSON / Mock Datasets           │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 📁 Directory Hierarchy & Component Breakdown

```text
frontend/prabah/
├── public/                                  # Static icons and assets
├── index.html                               # HTML5 entry with Google Fonts (Inter)
├── package.json                             # Dependencies and NPM scripts
├── vite.config.js                           # Vite build configuration
└── src/
    ├── main.jsx                             # React DOM root render
    ├── App.jsx                              # Route definitions & AuthContext wrapper
    │
    ├── components/                          # Modular UI Components
    │   ├── Layout.jsx                       # Top Header + Sidebar wrapper for authenticated routes
    │   ├── Sidebar.jsx                      # Collapsible left navigation bar with active route markers
    │   ├── NotificationCenter.jsx           # Slide-out alert notification drawer
    │   ├── PrabahLogo.jsx                   # High-res SVG animated brand logo
    │   ├── ProtectedRoute.jsx               # Route protection guard requiring authentication
    │   ├── LiveWeatherAnimation.jsx         # Dynamic CSS rain/cloud weather effect
    │   ├── CloudSkyBackground.jsx           # Animated atmospheric sky background for auth screen
    │   │
    │   ├── dashboard/                       # Dashboard Telemetry Cards & Widgets
    │   │   ├── CurrentWeatherCard.jsx       # Live temperature, humidity, pressure, wind & condition
    │   │   ├── FloodRiskCard.jsx            # Dynamic risk meter, waterlogging depth (cm) & duration (h)
    │   │   ├── StatsRow.jsx                 # 5 Key stat cards (Rainfall 24h, Risk Index, Water Level, Drainage, Affected Roads)
    │   │   ├── WeatherForecast.jsx          # Tabbed hourly & 3-day meteorological forecast
    │   │   ├── RainfallTrendChart.jsx       # Interactive Recharts bar visualization with custom tooltips
    │   │   ├── LandEnvironmentCard.jsx      # Topographic stats (Elevation, Soil Type, Green Cover %, Impervious Surface %)
    │   │   ├── RecentAlerts.jsx             # Severity-tagged warning feed (Critical / High / Moderate)
    │   │   ├── AdvisoryCard.jsx             # Actionable civic and municipal flood advisories
    │   │   ├── DashboardHeader.jsx          # Location selector & last updated timestamp
    │   │   └── LiveMLPredictorModal.jsx     # Interactive ML what-if simulator with real-time sliders
    │   │
    │   └── map/                             # MapLibre GL Geospatial Components
    │       ├── KolkataMap.jsx               # Base 2D MapLibre instance with OpenStreetMap raster tiles
    │       ├── FloodTelemetryPanel.jsx      # Slide-in deep telemetry inspector for selected wards
    │       ├── LocationPredictionCard.jsx   # GPS coordinates / user address ML nowcast calculator
    │       ├── ThreeHourSituationBar.jsx    # 3-Hour timeline progression simulation bar (t+0h to t+3h)
    │       ├── FilterBox.jsx                # Multi-layer visibility toggles (Heatmap, Roads, Drains, Pumping)
    │       └── ShowAllDataModal.jsx         # Full tabular modal inspection of all Kolkata ward metrics
    │
    ├── context/
    │   └── AuthContext.jsx                  # Authentication provider managing user state, tokens & login/logout
    │
    ├── data/
    │   ├── cityBoundaries.js                # GeoJSON polygon boundaries for Kolkata municipal wards
    │   ├── floodHeatmapData.js              # Geographic coordinates and baseline vulnerability weights
    │   ├── weatherData.js                   # Fallback weather metrics and baseline ward environmental profiles
    │   ├── rainfallData.js                  # Time-series rainfall points for Recharts bar chart
    │   └── alertsData.js                    # Safety guidelines and priority emergency advisories
    │
    ├── hooks/
    │   └── useInView.js                     # Viewport intersection observer hook for smooth fade-in animations
    │
    ├── pages/
    │   ├── AuthPage.jsx                     # Sign In / Sign Up dual-tab view with comprehensive address form
    │   ├── DashboardPage.jsx                # Primary live flood telemetry and prediction dashboard
    │   ├── map.jsx                          # Fullscreen geospatial nowcasting map interface
    │   └── EmergencySupport.jsx             # Emergency contacts, hotlines, and NDRF relief coordinates
    │
    ├── services/
    │   └── api.js                           # Centralized API service with intelligent proxy fallback
    │
    └── styles/
        ├── global.css                       # Design tokens, color palette, and CSS resets
        ├── layout.css                       # App shell, sidebar, and header styling
        ├── auth.css                         # Auth page glassmorphism & responsive forms
        ├── dashboard.css                    # Grid layouts, widgets, and simulator modal styling
        └── map.css                          # Fullscreen map overrides, panel positioning, and controls
```

---

## 🌐 Key Pages & User Flows

### 1. Authentication Page (`/`)
- **Dual Mode (Sign In / Register):** Smooth tab-switching between login and registration.
- **Detailed Citizen Profile:** Registration includes full geographic metadata:
  - Full Name & Username
  - Email Address & Password (with show/hide visibility toggle)
  - Address: House No, Street/Road, Area/Locality, City, District, State, PIN Code.
- **Visual Design:** Glassmorphic translucent cards floating above an animated rain and cityscape background.

---

### 2. Flood Risk Dashboard (`/dashboard`)
- **Real-Time Weather Widget:** Displays live temperature, feels like, relative humidity, barometric pressure, wind speed ($km/h$), and cloud cover.
- **Inundation Risk Card:** Highlights the current ward's flood status (`Safe`, `Moderate Risk`, `High Risk`, `Critical Danger`) with:
  - Flood probability percentage.
  - Calculated standing water depth ($cm$).
  - Estimated drainage clearance duration ($hours$).
- **Rainfall Trend Chart:** Interactive 24-hour bar chart rendered with **Recharts**, featuring custom hover tooltips and dynamic color scaling.
- **Environmental Baseline:** Shows surface permeability, elevation ($m$ above sea level), and soil drainage coefficients.
- **Live Simulator Modal:** Click the **"Live ML Predictor"** button to adjust rainfall ($0–200\text{ mm}$), humidity, and drainage load in real-time.

---

### 3. Spatial Nowcast Map (`/map`)
- **MapLibre GL 2D Engine:** High-performance vector/raster map rendering centered on the Kolkata Metropolitan Area.
- **Interactive Ward Polygons:** Color-coded municipal boundaries based on real-time flood severity.
- **Multi-Layer Toggle Filters:**
  - 🌊 **Flood Risk Heatmap:** High-density inundation hotspot overlay.
  - 🛣️ **Road Network Status:** Live road submergence indicators (Normal, Caution, Submerged).
  - 🚰 **Drainage Channels & Pumps:** Silt load percentages and pumping station operational statuses.
- **3-Hour Progression Timeline:** Step through $t+0h$, $t+1h$, $t+2h$, and $t+3h$ nowcast simulations.
- **Location Prediction Tool:** Input custom GPS coordinates or select a landmark to obtain an instant ML nowcast for that exact location.

---

### 4. Emergency Support (`/emergency`)
- **Quick-Dial Emergency Directory:**
  - 🚨 **KMC Disaster Control Room:** `033-2286-1212` / `1800-345-5678`
  - 👮 **Kolkata Police Disaster Management:** `100` / `033-2214-3024`
  - 🚒 **West Bengal Fire & Emergency Services:** `101` / `033-2252-1165`
  - 🛡️ **NDRF 2nd Battalion (Haringhata):** `033-2587-2044`
  - ⚡ **CESC Power Emergency:** `1912` / `033-3555-1212`

---

## 🎛️ Interactive Components & Modals

### Live ML Predictor Modal (`LiveMLPredictorModal.jsx`)
Allows city planners, disaster response teams, and citizens to run what-if simulations by manipulating:
- 🌧️ **24h Rainfall Slider:** $0\text{ mm}$ to $200\text{ mm}$
- 🌦️ **Forecast Rainfall Slider:** $0\text{ mm}$ to $150\text{ mm}$
- 💧 **Relative Humidity Slider:** $30\%$ to $100\%$
- 🌡️ **Temperature Slider:** $15^\circ\text{C}$ to $45^\circ\text{C}$
- 🚰 **Drainage Efficiency Index:** $1.0$ (Severely Clogged) to $10.0$ (Optimal)
- ⏳ **Silt Accumulation:** `Low`, `Moderate`, `High`, `Very High`

Clicking **"Run ML Simulation"** triggers a real-time call to the Scikit-Learn inference engine and displays updated risk levels, estimated depth, and civic advisories.

---

## 🗺️ Geospatial Mapping & Visualization

The mapping engine is built upon **MapLibre GL JS** using robust **OpenStreetMap raster tiles**, ensuring reliable map rendering without third-party token limits or CORS restrictions.

### Monitored Kolkata Zones & Wards:
- **Behala (Ward 118 / 119):** Low-lying southern zone prone to heavy waterlogging.
- **Howrah Strand (Ward 24):** Riverfront zone influenced by Hooghly high-tide backflow.
- **Park Street / Camac Street (Ward 63):** High-density commercial district.
- **Tollygunge / Kudghat (Ward 97):** Adi Ganga canal basin.
- **Salt Lake Sector V (Ward 31 - NKDA):** IT Hub with planned drainage infrastructure.
- **Jadavpur / Garia (Ward 96):** Southern residential catchment.
- **Dum Dum (Ward 8):** Northern transport corridor and airport zone.
- **New Town Action Area I/II (NKDA):** Smart city canal network.

---

## 🔄 State Management & API Client

The frontend utilizes a robust API layer in `src/services/api.js` designed for high availability:

1. **Primary Request Pipeline:** Sends authenticated requests to the **Node.js Fastify Backend Gateway** (`http://localhost:5000/api/*`).
2. **Direct ML Fallback:** If the Node.js gateway is undergoing maintenance, `api.js` can directly query the **Python FastAPI ML Microservice** (`http://localhost:8000/api/*`).
3. **Offline Mock Fallback:** If network services are unavailable, the application gracefully degrades to embedded GeoJSON and static telemetry models without crashing.

---

## 🎨 Design System & CSS Styling

PRABAH uses clean, responsive **Vanilla CSS** with a curated design token system:

```css
:root {
  --primary-blue:     #2563EB;
  --primary-hover:    #1D4ED8;
  --secondary-blue:   #3B82F6;
  --accent-cyan:      #06B6D4;
  --dark-bg:          #0F172A;
  --card-bg:          #FFFFFF;
  --page-bg:          #F8FAFC;
  --border-color:     #E2E8F0;
  --text-main:        #0F172A;
  --text-muted:       #64748B;
  --risk-safe:        #16A34A;
  --risk-moderate:    #F59E0B;
  --risk-high:        #EA580C;
  --risk-critical:    #DC2626;
  --font-family:      'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
  --radius-sm:        8px;
  --radius-md:        12px;
  --radius-lg:        20px;
  --shadow-card:      0 10px 25px -5px rgba(0, 0, 0, 0.05), 0 8px 10px -6px rgba(0, 0, 0, 0.01);
}
```

### Responsive Breakpoints:
- **Desktop Ultrawide ($>1440\text{px}$):** Full sidebar, 5-column metric grid, 3-column analysis row.
- **Standard Laptop ($1024\text{px} - 1440\text{px}$):** Sidebar + 3-column stats with stacked analysis.
- **Tablet ($768\text{px} - 1023\text{px}$):** Compact sidebar + 2-column metrics.
- **Mobile ($<768\text{px}$):** Hamburger menu overlay, single-column full-width responsive cards.

---

## 📦 Prerequisites & Installation

Ensure you have **Node.js** (`>= 18.0.0`) installed.

```bash
# 1. Navigate to the prabah directory
cd SIH-26085/frontend/prabah

# 2. Install dependencies
npm install

# 3. Start local development server
npm run dev
```

The web application will be accessible at: `http://localhost:5173/`

---

## 🛠️ Available Scripts

| Command | Action |
|---|---|
| `npm run dev` | Starts Vite local development server with Hot Module Replacement (HMR) |
| `npm run build` | Compiles and optimizes assets into `dist/` for production deployment |
| `npm run preview` | Locally serves the production `dist/` build for verification |
| `npm run lint` | Runs Oxlint / ESLint static code analysis checks |
