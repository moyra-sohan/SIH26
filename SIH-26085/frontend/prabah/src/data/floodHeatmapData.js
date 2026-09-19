/**
 * Kolkata Urban Flood Spatial Layers:
 * 1. Chromatic Risk Heatmap / Contours
 * 2. Real-Time Rainfall Isohyet Isobars
 * 3. Water Level & River Surge Zones
 * 4. Road Arteries & Passability Network
 * 5. Critical Warning Triangles
 */

// 1. CHROMATIC FLOOD RISK CONTOURS (All Layers & Overview)
export const FLOOD_HEATMAP_GEOJSON = {
  type: "FeatureCollection",
  features: [
    // BEHALA & SOUTH-WEST (Critical Basin)
    {
      type: "Feature",
      properties: { name: "Behala Core Inundation", risk: 0.94, level: "Critical", color: "#ef4444", fillOpacity: 0.85, layer: "risk" },
      geometry: {
        type: "Polygon",
        coordinates: [[[88.3000, 22.4850], [88.3120, 22.4980], [88.3240, 22.4930], [88.3280, 22.4810], [88.3180, 22.4720], [88.3050, 22.4760], [88.3000, 22.4850]]]
      }
    },
    {
      type: "Feature",
      properties: { name: "Behala Inner Ring", risk: 0.78, level: "High", color: "#f97316", fillOpacity: 0.72, layer: "risk" },
      geometry: {
        type: "Polygon",
        coordinates: [[[88.2880, 22.4800], [88.3040, 22.5080], [88.3360, 22.5020], [88.3420, 22.4760], [88.3250, 22.4630], [88.2950, 22.4680], [88.2880, 22.4800]]]
      }
    },
    {
      type: "Feature",
      properties: { name: "Behala Mid Dispersion", risk: 0.55, level: "Moderate", color: "#facc15", fillOpacity: 0.58, layer: "risk" },
      geometry: {
        type: "Polygon",
        coordinates: [[[88.2750, 22.4740], [88.2950, 22.5180], [88.3520, 22.5120], [88.3600, 22.4700], [88.3380, 22.4540], [88.2850, 22.4590], [88.2750, 22.4740]]]
      }
    },
    {
      type: "Feature",
      properties: { name: "Behala Outer Green", risk: 0.35, level: "Low", color: "#4ade80", fillOpacity: 0.42, layer: "risk" },
      geometry: {
        type: "Polygon",
        coordinates: [[[88.2600, 22.4680], [88.2850, 22.5300], [88.3680, 22.5220], [88.3780, 22.4620], [88.3480, 22.4450], [88.2720, 22.4500], [88.2600, 22.4680]]]
      }
    },

    // BALLY / DANKUNI / NORTH SURGE
    {
      type: "Feature",
      properties: { name: "Bally/Dankuni Core", risk: 0.91, level: "Critical", color: "#ef4444", fillOpacity: 0.85, layer: "risk" },
      geometry: {
        type: "Polygon",
        coordinates: [[[88.2850, 22.6450], [88.2980, 22.6580], [88.3090, 22.6490], [88.3040, 22.6340], [88.2910, 22.6300], [88.2850, 22.6450]]]
      }
    },
    {
      type: "Feature",
      properties: { name: "Bally Mid Ring", risk: 0.72, level: "High", color: "#f97316", fillOpacity: 0.72, layer: "risk" },
      geometry: {
        type: "Polygon",
        coordinates: [[[88.2720, 22.6400], [88.2920, 22.6700], [88.3220, 22.6600], [88.3180, 22.6240], [88.2840, 22.6180], [88.2720, 22.6400]]]
      }
    },
    {
      type: "Feature",
      properties: { name: "Bally Outer Dispersion", risk: 0.48, level: "Moderate", color: "#facc15", fillOpacity: 0.52, layer: "risk" },
      geometry: {
        type: "Polygon",
        coordinates: [[[88.2580, 22.6320], [88.2850, 22.6820], [88.3350, 22.6720], [88.3300, 22.6120], [88.2720, 22.6050], [88.2580, 22.6320]]]
      }
    },

    // SHIBPUR & HOWRAH
    {
      type: "Feature",
      properties: { name: "Shibpur Core", risk: 0.68, level: "High", color: "#f97316", fillOpacity: 0.70, layer: "risk" },
      geometry: {
        type: "Polygon",
        coordinates: [[[88.3150, 22.5700], [88.3300, 22.5850], [88.3420, 22.5750], [88.3320, 22.5580], [88.3180, 22.5600], [88.3150, 22.5700]]]
      }
    },
    {
      type: "Feature",
      properties: { name: "Shibpur Mid Zone", risk: 0.45, level: "Moderate", color: "#facc15", fillOpacity: 0.55, layer: "risk" },
      geometry: {
        type: "Polygon",
        coordinates: [[[88.3050, 22.5640], [88.3280, 22.5980], [88.3550, 22.5850], [88.3450, 22.5480], [88.3100, 22.5500], [88.3050, 22.5640]]]
      }
    },

    // SALT LAKE & NEW TOWN
    {
      type: "Feature",
      properties: { name: "Salt Lake Sector V Canal", risk: 0.85, level: "Critical", color: "#ef4444", fillOpacity: 0.80, layer: "risk" },
      geometry: {
        type: "Polygon",
        coordinates: [[[88.4200, 22.5800], [88.4350, 22.5920], [88.4480, 22.5840], [88.4400, 22.5680], [88.4240, 22.5700], [88.4200, 22.5800]]]
      }
    },
    {
      type: "Feature",
      properties: { name: "Salt Lake Mid Ring", risk: 0.60, level: "High", color: "#f97316", fillOpacity: 0.65, layer: "risk" },
      geometry: {
        type: "Polygon",
        coordinates: [[[88.4080, 22.5720], [88.4320, 22.6050], [88.4620, 22.5950], [88.4520, 22.5580], [88.4150, 22.5600], [88.4080, 22.5720]]]
      }
    },

    // PARK CIRCUS & JADAVPUR
    {
      type: "Feature",
      properties: { name: "Park Circus Core", risk: 0.88, level: "Critical", color: "#ef4444", fillOpacity: 0.82, layer: "risk" },
      geometry: {
        type: "Polygon",
        coordinates: [[[88.3680, 22.5350], [88.3820, 22.5460], [88.3950, 22.5380], [88.3880, 22.5240], [88.3720, 22.5260], [88.3680, 22.5350]]]
      }
    },
    {
      type: "Feature",
      properties: { name: "Park Circus Mid Zone", risk: 0.65, level: "High", color: "#f97316", fillOpacity: 0.68, layer: "risk" },
      geometry: {
        type: "Polygon",
        coordinates: [[[88.3550, 22.5280], [88.3780, 22.5580], [88.4080, 22.5480], [88.4000, 22.5140], [88.3620, 22.5160], [88.3550, 22.5280]]]
      }
    }
  ]
};

// 2. RAINFALL LAYER (Real-Time Isohyet Cloud Precipitation Bands)
export const RAINFALL_LAYER_GEOJSON = {
  type: "FeatureCollection",
  features: [
    {
      type: "Feature",
      properties: { name: "Monsoon Cloud Torrent Band (>100mm)", rainfall_mm: 112, color: "#8b5cf6", fillOpacity: 0.70, type: "Heavy Torrent" },
      geometry: {
        type: "Polygon",
        coordinates: [[[88.2900, 22.4700], [88.3200, 22.5200], [88.3600, 22.5000], [88.3400, 22.4500], [88.2900, 22.4700]]]
      }
    },
    {
      type: "Feature",
      properties: { name: "Intense Downpour Band (75–100mm)", rainfall_mm: 88, color: "#3b82f6", fillOpacity: 0.60, type: "Intense Rain" },
      geometry: {
        type: "Polygon",
        coordinates: [[[88.2700, 22.4600], [88.3100, 22.5400], [88.3900, 22.5200], [88.3600, 22.4300], [88.2700, 22.4600]]]
      }
    },
    {
      type: "Feature",
      properties: { name: "North Kolkata Rain Cell (60–80mm)", rainfall_mm: 74, color: "#06b6d4", fillOpacity: 0.55, type: "Moderate-Heavy" },
      geometry: {
        type: "Polygon",
        coordinates: [[[88.2700, 22.6200], [88.3000, 22.6800], [88.3500, 22.6600], [88.3300, 22.6000], [88.2700, 22.6200]]]
      }
    },
    {
      type: "Feature",
      properties: { name: "East Kolkata Wetlands Showers (35–50mm)", rainfall_mm: 45, color: "#10b981", fillOpacity: 0.45, type: "Passing Showers" },
      geometry: {
        type: "Polygon",
        coordinates: [[[88.3800, 22.5400], [88.4200, 22.6200], [88.4800, 22.5800], [88.4500, 22.5200], [88.3800, 22.5400]]]
      }
    }
  ]
};

// 3. WATER LEVEL LAYER (Hooghly River, Canals, Lock Gates, Inundation Depth)
export const WATER_LEVEL_LAYER_GEOJSON = {
  type: "FeatureCollection",
  features: [
    // Hooghly River Main Corridor (Dynamic Surge Water)
    {
      type: "Feature",
      properties: { name: "Hooghly River (Live Tide Level: 4.85m)", water_level_m: 4.85, status: "High Tide Surge", color: "#0284c7" },
      geometry: {
        type: "LineString",
        coordinates: [
          [88.3780, 22.6850], [88.3680, 22.6450], [88.3580, 22.6100],
          [88.3520, 22.5850], [88.3420, 22.5600], [88.3300, 22.5350],
          [88.3050, 22.5050], [88.2800, 22.4800], [88.2400, 22.4500]
        ]
      }
    },
    // Circular / Tolly's Nullah Canal
    {
      type: "Feature",
      properties: { name: "Adi Ganga / Tolly's Nullah (Water Level: 3.40m)", water_level_m: 3.40, status: "Moderate Overspill", color: "#0ea5e9" },
      geometry: {
        type: "LineString",
        coordinates: [
          [88.3300, 22.5350], [88.3450, 22.5150], [88.3600, 22.4900], [88.3800, 22.4650]
        ]
      }
    },
    // Bagjola Canal Outfall
    {
      type: "Feature",
      properties: { name: "Bagjola Canal Outfall (Water Level: 4.10m)", water_level_m: 4.10, status: "Critical Capacity", color: "#ef4444" },
      geometry: {
        type: "LineString",
        coordinates: [
          [88.3700, 22.6300], [88.4200, 22.6100], [88.4600, 22.5900]
        ]
      }
    },
    // Inundation Basins
    {
      type: "Feature",
      properties: { name: "Behala Low-Lying Basin (Submergence: 3.75m)", water_level_m: 3.75, color: "#ef4444", fillOpacity: 0.65 },
      geometry: {
        type: "Polygon",
        coordinates: [[[88.2950, 22.4800], [88.3250, 22.5000], [88.3350, 22.4850], [88.3050, 22.4700], [88.2950, 22.4800]]]
      }
    }
  ]
};

// 4. ROADS PASSABILITY LAYER (Arterials with live passability colors)
export const ROADS_LAYER_GEOJSON = {
  type: "FeatureCollection",
  features: [
    {
      type: "Feature",
      properties: { name: "Diamond Harbour Road (Behala)", status: "Submerged", water_depth_cm: 48, color: "#ef4444", advisory: "Heavy waterlogging. Diversion in effect." },
      geometry: {
        type: "LineString",
        coordinates: [[88.3150, 22.5200], [88.3100, 22.4900], [88.3050, 22.4600], [88.2980, 22.4300]]
      }
    },
    {
      type: "Feature",
      properties: { name: "Strand Road / Howrah Approach", status: "Submerged", water_depth_cm: 42, color: "#ef4444", advisory: "River overflow near lock gates. Avoid route." },
      geometry: {
        type: "LineString",
        coordinates: [[88.3450, 22.5900], [88.3480, 22.5700], [88.3420, 22.5500]]
      }
    },
    {
      type: "Feature",
      properties: { name: "EM Bypass (Science City - Ruby)", status: "Minor Waterlogging", water_depth_cm: 14, color: "#eab308", advisory: "Slow moving traffic in low-lying underpasses." },
      geometry: {
        type: "LineString",
        coordinates: [[88.4000, 22.5600], [88.3980, 22.5300], [88.4020, 22.5000], [88.4050, 22.4700]]
      }
    },
    {
      type: "Feature",
      properties: { name: "VIP Road / Airport Corridor", status: "Clear / Passable", water_depth_cm: 4, color: "#22c55e", advisory: "Normal transit. Flyovers fully operational." },
      geometry: {
        type: "LineString",
        coordinates: [[88.3800, 22.6000], [88.4100, 22.6200], [88.4400, 22.6400]]
      }
    },
    {
      type: "Feature",
      properties: { name: "Central Avenue (CR Avenue)", status: "Minor Waterlogging", water_depth_cm: 18, color: "#eab308", advisory: "Water accumulation on curb lanes." },
      geometry: {
        type: "LineString",
        coordinates: [[88.3600, 22.6000], [88.3580, 22.5700], [88.3550, 22.5500]]
      }
    },
    {
      type: "Feature",
      properties: { name: "AJC Bose Road / Park Circus", status: "Severe Waterlogging", water_depth_cm: 32, color: "#f97316", advisory: "Flyover open, surface road heavily congested." },
      geometry: {
        type: "LineString",
        coordinates: [[88.3450, 22.5400], [88.3650, 22.5420], [88.3850, 22.5440]]
      }
    },
    {
      type: "Feature",
      properties: { name: "Kona Expressway (Howrah)", status: "Clear / Passable", water_depth_cm: 6, color: "#22c55e", advisory: "Passable with normal precautions." },
      geometry: {
        type: "LineString",
        coordinates: [[88.2900, 22.5800], [88.3200, 22.5650], [88.3400, 22.5550]]
      }
    }
  ]
};

// 5. CRITICAL WARNING POINTS (Warning Triangles)
export const CRITICAL_WARNING_POINTS = [
  { id: 'warn-1', name: 'Salt Lake Bypass Outfall', coords: [88.4240, 22.5820], description: 'Severe Pumping Station Congestion • Water Level 5.63m' },
  { id: 'warn-2', name: 'Cossipore Lock Gate Outfall', coords: [88.3690, 22.6180], description: 'High Tide Lock Gate Active • River Surge' }
];

export const HOOGHLY_RIVER_GEOJSON = {
  type: "FeatureCollection",
  features: [
    {
      type: "Feature",
      properties: { name: "Hooghly River", stroke: "#0284c7" },
      geometry: {
        type: "LineString",
        coordinates: [
          [88.3780, 22.6850], [88.3680, 22.6450], [88.3580, 22.6100],
          [88.3520, 22.5850], [88.3420, 22.5600], [88.3300, 22.5350],
          [88.3050, 22.5050], [88.2800, 22.4800], [88.2400, 22.4500]
        ]
      }
    }
  ]
};
