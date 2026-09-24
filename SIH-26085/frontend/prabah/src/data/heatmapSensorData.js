/**
 * Kolkata Urban Flood & Precipitation Sensor Network
 * Point datasets powering MapLibre native Gaussian KDE Heatmaps and station telemetry:
 * 1. Flood Risk & Inundation Index (Basins & Depressions)
 * 2. Real-Time Rainfall Rate (Automated Weather Stations)
 * 3. Waterlogging Depth & River/Canal Surge Gauges
 * 4. Ward Civic Vulnerability Centroids
 * 5. Multi-Step Radar Simulation Timeline Frames
 */

export const HEATMAP_CONDITIONS = {
  flood: {
    key: 'flood',
    label: 'Flood Risk Severity',
    icon: '🌊',
    unit: 'Risk Index (0–1.0)',
    property: 'risk',
    colorStops: [
      [0.0, 'rgba(0, 0, 0, 0)'],
      [0.2, '#22c55e'],  // Low (green)
      [0.45, '#eab308'], // Moderate (yellow)
      [0.7, '#f97316'],  // High (orange)
      [0.88, '#ef4444'], // Critical (red)
      [1.0, '#991b1b']   // Severe (crimson)
    ],
    description: 'Calculated from elevation depressions, historical waterlogging basins, and drainage bottlenecks.'
  },
  rainfall: {
    key: 'rainfall',
    label: 'Rainfall Intensity (mm/h)',
    icon: '🌧️',
    unit: 'mm/h',
    property: 'rainfall_rate',
    colorStops: [
      [0.0, 'rgba(0, 0, 0, 0)'],
      [0.15, '#06b6d4'], // Light showers (cyan)
      [0.35, '#22c55e'], // Moderate rain (green)
      [0.55, '#eab308'], // Heavy downpour (yellow)
      [0.75, '#f97316'], // Very heavy (orange)
      [0.9, '#ef4444'],  // Torrential (red)
      [1.0, '#8b5cf6']   // Cloudburst (purple)
    ],
    description: 'Telemetry from 26 Automated Weather Stations (AWS) and Doppler weather radar nowcasts.'
  },
  water_level: {
    key: 'water_level',
    label: 'Canal & River Surge Level',
    icon: '📏',
    unit: 'm (Above Datum)',
    property: 'water_level',
    colorStops: [
      [0.0, 'rgba(0, 0, 0, 0)'],
      [0.25, '#38bdf8'], // Safe (sky blue)
      [0.5, '#0284c7'],  // Warning (blue)
      [0.75, '#f59e0b'], // High Tide Alert (amber)
      [0.9, '#ef4444'],  // Choke Overspill (red)
      [1.0, '#7f1d1d']   // Flood Gate Overrun (deep red)
    ],
    description: 'Monitored lock gates, drainage pumping station sumps, and Hooghly tidal surge gauges.'
  },
  vulnerability: {
    key: 'vulnerability',
    label: 'Ward Vulnerability Index',
    icon: '🛡️',
    unit: 'Score (1–100)',
    property: 'vulnerability_score',
    colorStops: [
      [0.0, 'rgba(0, 0, 0, 0)'],
      [0.25, '#4ade80'], // Low Vulnerability
      [0.5, '#facc15'],  // Moderate Vulnerability
      [0.75, '#fb923c'], // High Vulnerability
      [0.9, '#f87171'],  // Severe Vulnerability
      [1.0, '#b91c1c']   // Critical Low-Lying Ward
    ],
    description: 'Composite score combining population density, road drainage slope, and emergency service proximity.'
  }
};

// 1. FLOOD RISK GAUSSIAN HEATMAP POINTS (Over 35 monitored lowlands)
export const FLOOD_RISK_HEATMAP_POINTS = {
  type: "FeatureCollection",
  features: [
    // Behala Basin (Critical southern depression)
    { type: "Feature", properties: { id: "fr-1", name: "Behala Chowrasta Basin", ward: "Ward 120", risk: 0.96, depth_cm: 65, level: "Critical", status: "Submerged" }, geometry: { type: "Point", coordinates: [88.3120, 22.4920] } },
    { type: "Feature", properties: { id: "fr-2", name: "Parnasree Lowland", ward: "Ward 131", risk: 0.91, depth_cm: 52, level: "Critical", status: "Severe Waterlogging" }, geometry: { type: "Point", coordinates: [88.3020, 22.5020] } },
    { type: "Feature", properties: { id: "fr-3", name: "Thakur Pukur Depression", ward: "Ward 124", risk: 0.88, depth_cm: 46, level: "Critical", status: "Severe Waterlogging" }, geometry: { type: "Point", coordinates: [88.3080, 22.4680] } },
    { type: "Feature", properties: { id: "fr-4", name: "James Long Sarani Junction", ward: "Ward 119", risk: 0.82, depth_cm: 40, level: "High", status: "Submerged Lanes" }, geometry: { type: "Point", coordinates: [88.3220, 22.4850] } },
    { type: "Feature", properties: { id: "fr-5", name: "Taratala Industrial Basin", ward: "Ward 80", risk: 0.85, depth_cm: 44, level: "High", status: "Waterlogged" }, geometry: { type: "Point", coordinates: [88.3160, 22.5180] } },

    // Central & South-Central Kolkata
    { type: "Feature", properties: { id: "fr-6", name: "Park Circus 7-Point Depression", ward: "Ward 64", risk: 0.89, depth_cm: 48, level: "Critical", status: "Traffic Stalled" }, geometry: { type: "Point", coordinates: [88.3720, 22.5380] } },
    { type: "Feature", properties: { id: "fr-7", name: "Camac Street & Theatre Road", ward: "Ward 63", risk: 0.76, depth_cm: 32, level: "High", status: "Slow Drainage" }, geometry: { type: "Point", coordinates: [88.3510, 22.5460] } },
    { type: "Feature", properties: { id: "fr-8", name: "College Street / Thanthania", ward: "Ward 40", risk: 0.94, depth_cm: 58, level: "Critical", status: "Historic Lowland Flood" }, geometry: { type: "Point", coordinates: [88.3650, 22.5760] } },
    { type: "Feature", properties: { id: "fr-9", name: "Amherst Street Basin", ward: "Ward 38", risk: 0.92, depth_cm: 54, level: "Critical", status: "Submerged" }, geometry: { type: "Point", coordinates: [88.3700, 22.5720] } },
    { type: "Feature", properties: { id: "fr-10", name: "BBD Bagh / Strand Road", ward: "Ward 45", risk: 0.78, depth_cm: 35, level: "High", status: "Lock Gate Surcharge" }, geometry: { type: "Point", coordinates: [88.3430, 22.5710] } },

    // North Kolkata & Outfalls
    { type: "Feature", properties: { id: "fr-11", name: "Ultadanga Underpass", ward: "Ward 32", risk: 0.93, depth_cm: 62, level: "Critical", status: "Underpass Blocked" }, geometry: { type: "Point", coordinates: [88.3890, 22.5950] } },
    { type: "Feature", properties: { id: "fr-12", name: "Maniktala Main Road", ward: "Ward 31", risk: 0.74, depth_cm: 30, level: "High", status: "Waterlogged" }, geometry: { type: "Point", coordinates: [88.3780, 22.5850] } },
    { type: "Feature", properties: { id: "fr-13", name: "Shyambazar Five Point", ward: "Ward 10", risk: 0.65, depth_cm: 22, level: "Moderate", status: "Minor Ponding" }, geometry: { type: "Point", coordinates: [88.3710, 22.6020] } },
    { type: "Feature", properties: { id: "fr-14", name: "Cossipore Railway Siding", ward: "Ward 1", risk: 0.84, depth_cm: 42, level: "High", status: "Slow Outflow" }, geometry: { type: "Point", coordinates: [88.3680, 22.6240] } },
    { type: "Feature", properties: { id: "fr-15", name: "Belgachia North Lowland", ward: "Ward 3", risk: 0.81, depth_cm: 38, level: "High", status: "Canal Backflow" }, geometry: { type: "Point", coordinates: [88.3820, 22.6120] } },

    // East Kolkata & IT Sector
    { type: "Feature", properties: { id: "fr-16", name: "Salt Lake Sector V College More", ward: "Ward 201", risk: 0.86, depth_cm: 45, level: "Critical", status: "Canal High" }, geometry: { type: "Point", coordinates: [88.4320, 22.5810] } },
    { type: "Feature", properties: { id: "fr-17", name: "Salt Lake Karunamoyee", ward: "Ward 202", risk: 0.58, depth_cm: 18, level: "Moderate", status: "Passable" }, geometry: { type: "Point", coordinates: [88.4190, 22.5890] } },
    { type: "Feature", properties: { id: "fr-18", name: "EM Bypass - Ruby Hospital", ward: "Ward 107", risk: 0.72, depth_cm: 28, level: "High", status: "Underpass Water" }, geometry: { type: "Point", coordinates: [88.4020, 22.5130] } },
    { type: "Feature", properties: { id: "fr-19", name: "Beliaghata Canal Junction", ward: "Ward 34", risk: 0.83, depth_cm: 41, level: "High", status: "High Sump Level" }, geometry: { type: "Point", coordinates: [88.3950, 22.5680] } },
    { type: "Feature", properties: { id: "fr-20", name: "Topsia Tannery Basin", ward: "Ward 58", risk: 0.87, depth_cm: 47, level: "Critical", status: "Drainage Choked" }, geometry: { type: "Point", coordinates: [88.3880, 22.5440] } },

    // South Kolkata & Jadavpur
    { type: "Feature", properties: { id: "fr-21", name: "Jadavpur 8B Bus Stand", ward: "Ward 96", risk: 0.75, depth_cm: 32, level: "High", status: "Waterlogged" }, geometry: { type: "Point", coordinates: [88.3710, 22.4980] } },
    { type: "Feature", properties: { id: "fr-22", name: "Lake Gardens Railway Bridge", ward: "Ward 93", risk: 0.85, depth_cm: 44, level: "Critical", status: "Underpass Submerged" }, geometry: { type: "Point", coordinates: [88.3580, 22.5080] } },
    { type: "Feature", properties: { id: "fr-23", name: "Tollygunge Phari Lowlands", ward: "Ward 94", risk: 0.82, depth_cm: 39, level: "High", status: "Nullah Surcharge" }, geometry: { type: "Point", coordinates: [88.3450, 22.5020] } },
    { type: "Feature", properties: { id: "fr-24", name: "Kalighat Temple Approach", ward: "Ward 83", risk: 0.79, depth_cm: 36, level: "High", status: "Adi Ganga Overflow" }, geometry: { type: "Point", coordinates: [88.3420, 22.5220] } },
    { type: "Feature", properties: { id: "fr-25", name: "Ballygunge Circular Road", ward: "Ward 69", risk: 0.62, depth_cm: 20, level: "Moderate", status: "Pumping Active" }, geometry: { type: "Point", coordinates: [88.3620, 22.5290] } },

    // Port & South-West
    { type: "Feature", properties: { id: "fr-26", name: "Khidirpur 5-Vent Sluice", ward: "Ward 76", risk: 0.90, depth_cm: 50, level: "Critical", status: "Tidal Lock Active" }, geometry: { type: "Point", coordinates: [88.3240, 22.5360] } },
    { type: "Feature", properties: { id: "fr-27", name: "Garden Reach Road Sump", ward: "Ward 133", risk: 0.88, depth_cm: 48, level: "Critical", status: "River Surcharge" }, geometry: { type: "Point", coordinates: [88.2950, 22.5410] } },
    { type: "Feature", properties: { id: "fr-28", name: "Metiabruz Riverside Lowland", ward: "Ward 137", risk: 0.86, depth_cm: 45, level: "Critical", status: "Waterlogged" }, geometry: { type: "Point", coordinates: [88.2780, 22.5280] } },
    { type: "Feature", properties: { id: "fr-29", name: "Garia Railway Station Lowlands", ward: "Ward 110", risk: 0.77, depth_cm: 34, level: "High", status: "Slow Draining" }, geometry: { type: "Point", coordinates: [88.3840, 22.4620] } },
    { type: "Feature", properties: { id: "fr-30", name: "Kasba Rathala Junction", ward: "Ward 67", risk: 0.78, depth_cm: 35, level: "High", status: "Waterlogged" }, geometry: { type: "Point", coordinates: [88.3820, 22.5180] } }
  ]
};

// 2. REAL-TIME RAINFALL TELEMETRY STATIONS (Automated Weather Stations Network)
export const RAIN_GAUGE_STATIONS = [
  { id: "aws-alipore", name: "Alipore IMD Observatory", ward: "Ward 74", coords: [88.3248, 22.5312], rainfall_rate: 86.4, accumulation_24h: 114.2, temp_c: 26.2, humidity: 96, trend: "Rising", status: "Torrential", alert: "Orange" },
  { id: "aws-behala", name: "Behala Chowrasta AWS", ward: "Ward 120", coords: [88.3105, 22.4932], rainfall_rate: 118.2, accumulation_24h: 148.6, temp_c: 25.8, humidity: 98, trend: "Surging", status: "Cloudburst", alert: "Red" },
  { id: "aws-dumdum", name: "Dum Dum Airport AWS", ward: "North", coords: [88.4467, 22.6547], rainfall_rate: 74.0, accumulation_24h: 96.5, temp_c: 26.5, humidity: 94, trend: "Steady", status: "Heavy", alert: "Orange" },
  { id: "aws-ballygunge", name: "Ballygunge Drainage PS", ward: "Ward 68", coords: [88.3654, 22.5285], rainfall_rate: 92.5, accumulation_24h: 122.0, temp_c: 25.9, humidity: 97, trend: "Rising", status: "Torrential", alert: "Red" },
  { id: "aws-jadavpur", name: "Jadavpur University AWS", ward: "Ward 96", coords: [88.3712, 22.4988], rainfall_rate: 81.0, accumulation_24h: 108.4, temp_c: 26.1, humidity: 95, trend: "Rising", status: "Heavy", alert: "Orange" },
  { id: "aws-saltlake", name: "Salt Lake Sector V Tech Hub", ward: "Ward 201", coords: [88.4325, 22.5808], rainfall_rate: 68.4, accumulation_24h: 88.0, temp_c: 26.4, humidity: 93, trend: "Moderate", status: "Heavy", alert: "Yellow" },
  { id: "aws-dhapa", name: "Dhapa / EM Bypass AWS", ward: "Ward 58", coords: [88.4050, 22.5480], rainfall_rate: 76.5, accumulation_24h: 98.2, temp_c: 26.0, humidity: 96, trend: "Steady", status: "Heavy", alert: "Orange" },
  { id: "aws-cossipore", name: "Cossipore North AWS", ward: "Ward 1", coords: [88.3710, 22.6280], rainfall_rate: 62.0, accumulation_24h: 82.5, temp_c: 26.6, humidity: 92, trend: "Falling", status: "Moderate", alert: "Yellow" },
  { id: "aws-gardenreach", name: "Garden Reach Port AWS", ward: "Ward 133", coords: [88.2910, 22.5420], rainfall_rate: 98.0, accumulation_24h: 132.8, temp_c: 25.7, humidity: 98, trend: "Rising", status: "Torrential", alert: "Red" },
  { id: "aws-shyambazar", name: "Shyambazar Circle AWS", ward: "Ward 10", coords: [88.3698, 22.6015], rainfall_rate: 58.5, accumulation_24h: 75.0, temp_c: 26.8, humidity: 91, trend: "Steady", status: "Moderate", alert: "Yellow" },
  { id: "aws-parkcircus", name: "Park Circus 7-Point AWS", ward: "Ward 64", coords: [88.3715, 22.5385], rainfall_rate: 89.2, accumulation_24h: 118.5, temp_c: 25.9, humidity: 97, trend: "Rising", status: "Torrential", alert: "Red" },
  { id: "aws-college-st", name: "College Street / Thanthania", ward: "Ward 40", coords: [88.3645, 22.5765], rainfall_rate: 84.0, accumulation_24h: 111.0, temp_c: 26.1, humidity: 96, trend: "Steady", status: "Heavy", alert: "Orange" },
  { id: "aws-ultadanga", name: "Ultadanga Hub AWS", ward: "Ward 32", coords: [88.3892, 22.5948], rainfall_rate: 79.5, accumulation_24h: 104.2, temp_c: 26.2, humidity: 95, trend: "Rising", status: "Heavy", alert: "Orange" },
  { id: "aws-garia", name: "Garia South Metro AWS", ward: "Ward 110", coords: [88.3845, 22.4625], rainfall_rate: 71.0, accumulation_24h: 93.0, temp_c: 26.3, humidity: 94, trend: "Steady", status: "Heavy", alert: "Orange" },
  { id: "aws-taratala", name: "Taratala Crossing AWS", ward: "Ward 80", coords: [88.3155, 22.5185], rainfall_rate: 104.5, accumulation_24h: 139.0, temp_c: 25.8, humidity: 98, trend: "Surging", status: "Cloudburst", alert: "Red" },
  { id: "aws-shibpur", name: "Shibpur / Howrah AWS", ward: "Howrah", coords: [88.3210, 22.5680], rainfall_rate: 65.2, accumulation_24h: 86.4, temp_c: 26.4, humidity: 93, trend: "Steady", status: "Moderate", alert: "Yellow" },
  { id: "aws-bally", name: "Bally Canal AWS", ward: "Howrah North", coords: [88.2950, 22.6480], rainfall_rate: 73.0, accumulation_24h: 95.8, temp_c: 26.5, humidity: 94, trend: "Rising", status: "Heavy", alert: "Orange" },
  { id: "aws-newtown", name: "New Town Action Area 1", ward: "Bidhannagar", coords: [88.4550, 22.5890], rainfall_rate: 54.0, accumulation_24h: 71.5, temp_c: 26.9, humidity: 90, trend: "Falling", status: "Moderate", alert: "Yellow" },
  { id: "aws-kasba", name: "Kasba New Market AWS", ward: "Ward 67", coords: [88.3825, 22.5182], rainfall_rate: 77.0, accumulation_24h: 101.5, temp_c: 26.2, humidity: 95, trend: "Rising", status: "Heavy", alert: "Orange" },
  { id: "aws-kalighat", name: "Kalighat Bridge AWS", ward: "Ward 83", coords: [88.3418, 22.5225], rainfall_rate: 85.0, accumulation_24h: 112.5, temp_c: 26.0, humidity: 96, trend: "Rising", status: "Torrential", alert: "Orange" }
];

export const RAINFALL_SENSOR_HEATMAP_POINTS = {
  type: "FeatureCollection",
  features: RAIN_GAUGE_STATIONS.map(s => ({
    type: "Feature",
    properties: {
      id: s.id,
      name: s.name,
      ward: s.ward,
      rainfall_rate: s.rainfall_rate,
      accumulation_24h: s.accumulation_24h,
      trend: s.trend,
      status: s.status,
      alert: s.alert,
      // Normalize weight 0-1 for MapLibre KDE
      weight: Math.min(1.0, Math.max(0.1, s.rainfall_rate / 120))
    },
    geometry: {
      type: "Point",
      coordinates: s.coords
    }
  }))
};

// 3. WATER LEVEL & CANAL SURGE SENSORS
export const WATER_LEVEL_HEATMAP_POINTS = {
  type: "FeatureCollection",
  features: [
    { type: "Feature", properties: { id: "wl-1", name: "Palmer Bridge Drainage PS", ward: "Ward 56", water_level: 5.45, danger_level: 5.20, status: "Critical Overflow", surge_pct: 105 }, geometry: { type: "Point", coordinates: [88.3850, 22.5560] } },
    { type: "Feature", properties: { id: "wl-2", name: "Ballygunge Drainage Pumping Sump", ward: "Ward 68", water_level: 4.88, danger_level: 4.50, status: "Over Danger Level", surge_pct: 108 }, geometry: { type: "Point", coordinates: [88.3650, 22.5280] } },
    { type: "Feature", properties: { id: "wl-3", name: "Chetla Lock Gate (Adi Ganga)", ward: "Ward 82", water_level: 4.60, danger_level: 4.20, status: "Tidal Surge High", surge_pct: 110 }, geometry: { type: "Point", coordinates: [88.3360, 22.5210] } },
    { type: "Feature", properties: { id: "wl-4", name: "Cossipore Outfall Lock", ward: "Ward 1", water_level: 4.92, danger_level: 4.60, status: "Hooghly Backflow", surge_pct: 107 }, geometry: { type: "Point", coordinates: [88.3680, 22.6240] } },
    { type: "Feature", properties: { id: "wl-5", name: "Bagjola Canal Outfall Sluice", ward: "Ward 28", water_level: 5.15, danger_level: 4.80, status: "Severe Congestion", surge_pct: 107 }, geometry: { type: "Point", coordinates: [88.4200, 22.6100] } },
    { type: "Feature", properties: { id: "wl-6", name: "Kestopur Canal Sluice", ward: "Ward 32", water_level: 4.40, danger_level: 4.20, status: "Warning Level", surge_pct: 105 }, geometry: { type: "Point", coordinates: [88.4050, 22.5920] } },
    { type: "Feature", properties: { id: "wl-7", name: "Circular Canal Junction", ward: "Ward 30", water_level: 4.75, danger_level: 4.50, status: "High Sump", surge_pct: 106 }, geometry: { type: "Point", coordinates: [88.3750, 22.5880] } },
    { type: "Feature", properties: { id: "wl-8", name: "Behala Moni Canal Outfall", ward: "Ward 121", water_level: 4.95, danger_level: 4.30, status: "Basin Submerged", surge_pct: 115 }, geometry: { type: "Point", coordinates: [88.3050, 22.4850] } },
    { type: "Feature", properties: { id: "wl-9", name: "Topsia Point Drainage Sump", ward: "Ward 59", water_level: 4.30, danger_level: 4.10, status: "Operating 6/6 Pumps", surge_pct: 105 }, geometry: { type: "Point", coordinates: [88.3920, 22.5380] } },
    { type: "Feature", properties: { id: "wl-10", name: "Garden Reach Coal Dock Lock", ward: "Ward 134", water_level: 5.30, danger_level: 4.90, status: "High Tide Lock Shut", surge_pct: 108 }, geometry: { type: "Point", coordinates: [88.3010, 22.5360] } }
  ]
};

// 4. WARD VULNERABILITY CENTROIDS (High density mapping across Kolkata)
export const WARD_VULNERABILITY_HEATMAP_POINTS = {
  type: "FeatureCollection",
  features: [
    { type: "Feature", properties: { id: "wv-120", ward: "Ward 120", name: "Behala", vulnerability_score: 95, status: "Critical Basin" }, geometry: { type: "Point", coordinates: [88.3105, 22.4932] } },
    { type: "Feature", properties: { id: "wv-131", ward: "Ward 131", name: "Parnasree", vulnerability_score: 91, status: "Critical Basin" }, geometry: { type: "Point", coordinates: [88.3020, 22.5020] } },
    { type: "Feature", properties: { id: "wv-40", ward: "Ward 40", name: "Thanthania", vulnerability_score: 94, status: "Historic Lowland" }, geometry: { type: "Point", coordinates: [88.3645, 22.5765] } },
    { type: "Feature", properties: { id: "wv-38", ward: "Ward 38", name: "Amherst Street", vulnerability_score: 90, status: "Historic Lowland" }, geometry: { type: "Point", coordinates: [88.3700, 22.5720] } },
    { type: "Feature", properties: { id: "wv-64", ward: "Ward 64", name: "Park Circus", vulnerability_score: 88, status: "Severe Choke" }, geometry: { type: "Point", coordinates: [88.3715, 22.5385] } },
    { type: "Feature", properties: { id: "wv-63", ward: "Ward 63", name: "Camac Street", vulnerability_score: 82, status: "Commercial Risk" }, geometry: { type: "Point", coordinates: [88.3510, 22.5460] } },
    { type: "Feature", properties: { id: "wv-32", ward: "Ward 32", name: "Ultadanga", vulnerability_score: 89, status: "Underpass Bottleneck" }, geometry: { type: "Point", coordinates: [88.3892, 22.5948] } },
    { type: "Feature", properties: { id: "wv-1", ward: "Ward 1", name: "Cossipore", vulnerability_score: 84, status: "River Outfall Risk" }, geometry: { type: "Point", coordinates: [88.3710, 22.6280] } },
    { type: "Feature", properties: { id: "wv-133", ward: "Ward 133", name: "Garden Reach", vulnerability_score: 87, status: "Dock Surcharge" }, geometry: { type: "Point", coordinates: [88.2910, 22.5420] } },
    { type: "Feature", properties: { id: "wv-201", ward: "Ward 201", name: "Sector V", vulnerability_score: 85, status: "Canal Backflow" }, geometry: { type: "Point", coordinates: [88.4325, 22.5808] } },
    { type: "Feature", properties: { id: "wv-93", ward: "Ward 93", name: "Lake Gardens", vulnerability_score: 80, status: "Railway Underpass" }, geometry: { type: "Point", coordinates: [88.3580, 22.5080] } },
    { type: "Feature", properties: { id: "wv-96", ward: "Ward 96", name: "Jadavpur", vulnerability_score: 75, status: "Moderate Basin" }, geometry: { type: "Point", coordinates: [88.3712, 22.4988] } },
    { type: "Feature", properties: { id: "wv-107", ward: "Ward 107", name: "Ruby EM Bypass", vulnerability_score: 78, status: "Bypass Underpass" }, geometry: { type: "Point", coordinates: [88.4020, 22.5130] } },
    { type: "Feature", properties: { id: "wv-45", ward: "Ward 45", name: "BBD Bagh", vulnerability_score: 74, status: "Lock Gate Surcharge" }, geometry: { type: "Point", coordinates: [88.3430, 22.5710] } }
  ]
};

// Helper: Get GeoJSON dataset by selected condition key
export function getHeatmapDataByCondition(conditionKey) {
  switch (conditionKey) {
    case 'rainfall':
      return RAINFALL_SENSOR_HEATMAP_POINTS;
    case 'water_level':
      return WATER_LEVEL_HEATMAP_POINTS;
    case 'vulnerability':
      return WARD_VULNERABILITY_HEATMAP_POINTS;
    case 'flood':
    default:
      return FLOOD_RISK_HEATMAP_POINTS;
  }
}

// 5. RADAR SIMULATION TIMELINE (Multi-step storm progression)
export const RADAR_TIMELINE_STEPS = [
  { id: 't-60', label: 'T - 60 min', timestamp: '1 hour ago', storm_intensity: 0.45, centerOffset: [-0.04, -0.03], description: 'South-west monsoon squall line forming over Bay & South 24 Parganas.' },
  { id: 't-30', label: 'T - 30 min', timestamp: '30 mins ago', storm_intensity: 0.70, centerOffset: [-0.02, -0.015], description: 'Storm cell convergence intensifying over Behala, Alipore, and Khidirpur.' },
  { id: 'live', label: 'LIVE NOW', timestamp: 'Real-time telemetry', storm_intensity: 1.0, centerOffset: [0, 0], description: 'Peak cloudburst band stationary over Central & South Kolkata. Torrential downpour.' },
  { id: 't+15', label: 'T + 15 min', timestamp: 'Nowcast projection', storm_intensity: 0.90, centerOffset: [0.015, 0.01], description: 'Cell migrating northeast towards Park Circus, Salt Lake Sector V, and New Town.' },
  { id: 't+30', label: 'T + 30 min', timestamp: 'Nowcast projection', storm_intensity: 0.75, centerOffset: [0.03, 0.02], description: 'Heavy showers continuing in Bidhannagar and Dum Dum; moderate in Behala.' },
  { id: 't+60', label: 'T + 60 min', timestamp: 'Nowcast projection', storm_intensity: 0.50, centerOffset: [0.05, 0.035], description: 'Storm system dispersing towards North 24 Parganas wetlands. Residual showers.' }
];

// Helper: Generates simulated GeoJSON point grid for a specific radar timeline step
export function getRainfallTimelineData(stepIndex) {
  const step = RADAR_TIMELINE_STEPS[stepIndex] || RADAR_TIMELINE_STEPS[2]; // Default to LIVE
  const [dx, dy] = step.centerOffset;
  const factor = step.storm_intensity;

  return {
    type: "FeatureCollection",
    features: RAIN_GAUGE_STATIONS.map((s, idx) => {
      // Modify rainfall rate and coordinates slightly to simulate Doppler radar cloud motion
      const adjustedRate = Math.round(s.rainfall_rate * factor * (0.85 + (idx % 4) * 0.1));
      return {
        type: "Feature",
        properties: {
          ...s,
          rainfall_rate: adjustedRate,
          step_label: step.label,
          weight: Math.min(1.0, Math.max(0.12, adjustedRate / 120))
        },
        geometry: {
          type: "Point",
          coordinates: [s.coords[0] + dx * 0.4, s.coords[1] + dy * 0.4]
        }
      };
    })
  };
}
