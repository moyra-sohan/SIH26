# 🌧️ Urban Flood Nowcasting System

A real-time urban flood monitoring and nowcasting dashboard built with **React + Vite**. Provides live weather data, flood risk assessment, rainfall trends, and early warning alerts for urban areas.

---

## 🚀 Quick Start

```bash
# Navigate to the frontend directory
cd SIH-26085/frontend/prabah

# Install dependencies
npm install

# Start development server
npm run dev
```

Opens at `http://localhost:5173/`

---

## 📦 Tech Stack

| Technology | Purpose |
|---|---|
| React 19 | UI framework |
| Vite 8 | Build tool & dev server |
| React Router DOM | Client-side routing |
| MapLibre GL JS | Interactive 2D mapping and rendering |
| Lucide React | Icon library |
| Recharts | Rainfall trend bar chart |
| CSS | Styling (no frameworks) |

---

## 📁 Project Structure

```text
SIH-26085/
├── backend/                         # Backend API (Node/Python, etc.)
└── frontend/
    └── prabah/                      # React Frontend application
        ├── public/                  # Static assets
        ├── src/
        │   ├── components/
        │   │   ├── Layout.jsx                   # Shared layout wrapper (Sidebar + Header)
        │   │   ├── Sidebar.jsx                  # Main navigation sidebar
        │   │   ├── dashboard/
        │   │   │   ├── CurrentWeatherCard.jsx   # Current weather display
        │   │   │   ├── FloodRiskCard.jsx        # Flood risk warning card
        │   │   │   ├── StatsRow.jsx             # Reusable stat cards
        │   │   │   ├── WeatherForecast.jsx      # Hourly & 3-Day forecast
        │   │   │   ├── RainfallTrendChart.jsx   # Interactive bar chart (Recharts)
        │   │   │   ├── LandEnvironmentCard.jsx  # Land & environment stats
        │   │   │   ├── RecentAlerts.jsx         # Severity-based alerts
        │   │   │   └── AdvisoryCard.jsx         # Safety advisories
        │   │   └── map/
        │   │       └── KolkataMap.jsx           # MapLibre GL instance for Kolkata
        │   ├── data/
        │   │   ├── weatherData.js               # Weather & stats mock data
        │   │   ├── rainfallData.js              # Rainfall chart data
        │   │   └── alertsData.js                # Alerts & advisories
        │   ├── pages/
        │   │   ├── AuthPage.jsx                 # Login / Sign-up page
        │   │   ├── DashboardPage.jsx            # Main dashboard interface
        │   │   └── map.jsx                      # Map page containing KolkataMap
        │   ├── styles/
        │   │   ├── global.css                   # Global resets and variables
        │   │   ├── layout.css                   # Sidebar and header styles
        │   │   ├── auth.css                     # Auth page styles
        │   │   ├── dashboard.css                # Dashboard specific styles
        │   │   └── map.css                      # Map layout overrides
        │   ├── App.jsx                          # Application routing
        │   └── main.jsx                         # React entry point
        ├── index.html               # Main HTML entry
        ├── package.json             # Project dependencies
        └── vite.config.js           # Vite configuration
```

---

## 🗺️ Routes

| Route | Page | Description |
|---|---|---|
| `/` | Auth Page | Login / Sign-up with glassmorphism card |
| `/dashboard` | Dashboard | Flood monitoring dashboard (wrapped in Layout) |
| `/map` | Map | Interactive 2D Kolkata flood risk map (wrapped in Layout) |

---

## 🎯 Features

### Authentication Page
- Sign In / Sign Up tab switching
- Username, Email, Password inputs with icons
- Show/hide password toggle
- Forgot password link
- Animated rain + city skyline background
- Feature badges (Real-time Monitoring, Smart Prediction, Early Alerts)

### Shared Layout
- **Global Sidebar** — Collapsible, dark-themed sidebar acting as the primary navigation hub across all authenticated pages. Uses active route detection.
- **Sticky Header** — Context-aware header displaying page-specific titles, current location badge, and user profile snippet.

### Dashboard
- **Current Weather** — Temperature, humidity, wind, pressure, visibility
- **Flood Risk Status** — High/Medium/Low risk with warning card
- **Statistics** — Rainfall (24h), Flood Risk Index, Water Level, Drainage Status, Affected Roads
- **Weather Forecast** — Today / Tomorrow / 3 Days tabs with hourly data
- **Rainfall Trend** — Interactive bar chart (Recharts) with tooltip
- **Land & Environment** — Land type, elevation, soil type, green cover, impervious surface
- **Recent Alerts** — Severity-based alerts with timestamps
- **Advisory** — Safety recommendations

### Kolkata Map (MapLibre GL)
- **Interactive 2D Map** — Centered on Kolkata utilizing MapLibre GL JS.
- **Reliable Base Tiles** — OpenStreetMap raster tile integration for robust local/production tile loading without API keys or CORS restrictions.
- **Risk Zones** — Plotted 7 key flood-prone areas in Kolkata (Salt Lake, Behala, Howrah Bridge, etc.) with dynamic color-coding and hover interactions.
- **Map Controls** — Fullscreen, Navigation (Compass/Zoom), Scale, and Geolocate controls included.

---

## 🔗 Backend Integration (JSON Payloads)

All user interactions generate JSON payloads logged to the browser console. Replace `console.log` with `fetch`/`axios` calls to connect to your backend.

### Auth Actions

```json
{
  "action": "login",
  "username": "john_doe",
  "email": "john@example.com",
  "password": "****",
  "timestamp": "2026-08-28T17:30:00.000Z"
}
```

```json
{
  "action": "register",
  "username": "john_doe",
  "email": "john@example.com",
  "password": "****",
  "timestamp": "2026-08-28T17:30:00.000Z"
}
```

### Dashboard Actions

```json
{ "action": "logout", "timestamp": "..." }
{ "action": "navigate", "page": "map", "timestamp": "..." }
{ "action": "profile_click", "timestamp": "..." }
{ "action": "view_flood_details", "riskLevel": "high", "riskIndex": 0.78, "timestamp": "..." }
{ "action": "view_full_forecast", "forecastPeriod": "today", "data": [...], "timestamp": "..." }
{ "action": "change_rainfall_period", "period": "24h", "timestamp": "..." }
```

---

## 📱 Responsive Breakpoints

| Breakpoint | Layout |
|---|---|
| 1440px+ | Full sidebar + 5-column stats + 3-column middle row |
| 1024px–1440px | Sidebar + 3-column stats + stacked sections |
| 768px–1024px | Sidebar + 2-column stats + single column |
| < 768px | Hamburger menu + single column layout |

---

## 🎨 Design System

```
Primary Blue:     #2563EB
Dark Text:        #0F172A
Secondary Text:   #64748B
Page Background:  #F8FAFC
Card Background:  #FFFFFF
Border:           #E2E8F0
Success:          #16A34A
Warning:          #F59E0B
Danger:           #DC2626
Font:             Inter (Google Fonts)
Border Radius:    12px–20px
```

---

## 📝 Mock Data

All data is stored in `SIH-26085/frontend/prabah/src/data/` and can be replaced with live API responses:

- **weatherData.js** — Current weather, forecasts, stat cards, land environment
- **rainfallData.js** — 8 time-series data points for the bar chart
- **alertsData.js** — 3 alerts with severity levels + advisory tips

---

## 🛠️ Scripts

```bash
npm run dev       # Start development server
npm run build     # Build for production
npm run preview   # Preview production build
npm run lint      # Run linter
```

---

## 👥 Team

Built for **Smart India Hackathon (SIH) 2026**

---

## 📄 License

This project is for educational and hackathon purposes.
