import { useEffect, useRef, useState, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { Map, Marker, Popup, setWorkerUrl } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';
import api from '../services/api';
import FloodTelemetryPanel from '../components/map/FloodTelemetryPanel.jsx';
import {
    WATER_LEVEL_LAYER_GEOJSON,
    ROADS_LAYER_GEOJSON,
    CRITICAL_WARNING_POINTS,
    HOOGHLY_RIVER_GEOJSON
} from '../data/floodHeatmapData.js';
import {
    HEATMAP_CONDITIONS,
    getHeatmapDataByCondition,
    RAIN_GAUGE_STATIONS,
    RADAR_TIMELINE_STEPS,
    getRainfallTimelineData
} from '../data/heatmapSensorData.js';
import {
    DRAINAGE_AND_WATER_STATIONS,
    TIDAL_TIMELINE_STEPS,
    ROADS_PASSABILITY_CORRIDORS,
    MULTI_HAZARD_DOMAINS
} from '../data/mapThematicData.js';
import {
    KOLKATA_BOUNDS,
    KOLKATA_CENTER,
    isPointInKolkata
} from '../data/cityBoundaries.js';
import {
    KOLKATA_WARDS_DATA,
    KOLKATA_WARDS_GEOJSON,
    getWardByNumber,
    getWardBounds,
    getSelectedWardGeoJson
} from '../data/kolkataWardsBoundaries.js';
import {
    Search,
    Layers,
    CloudRain,
    Waves,
    Compass,
    Plus,
    Minus,
    Navigation,
    Maximize2,
    ChevronDown,
    Flame,
    Play,
    Pause,
    RotateCcw,
    TrendingUp,
    Droplets,
    AlertTriangle,
    ShieldAlert,
    Gauge,
    Car,
    Sliders,
    CheckCircle2,
    ArrowRight,
    Activity
} from 'lucide-react';
import "../styles/map.css";

setWorkerUrl(workerUrl);

// Light Positron Basemap Styles
const OPENFREEMAP_POSITRON_URL = 'https://tiles.openfreemap.org/styles/positron';
const SATELLITE_TILE_URL = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';

const FALLBACK_POSITRON_STYLE = {
    version: 8,
    sources: {
        openmaptiles: {
            type: "vector",
            url: "https://tiles.openfreemap.org/planet"
        }
    },
    sprite: "https://tiles.openfreemap.org/sprites/ofm_f384/ofm",
    glyphs: "https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf",
    layers: [
        { id: "background", type: "background", paint: { "background-color": "#f8fafc" } },
        { id: "water", type: "fill", source: "openmaptiles", "source-layer": "water", paint: { "fill-color": "#38bdf8", "fill-opacity": 0.8 } },
        { id: "waterway", type: "line", source: "openmaptiles", "source-layer": "waterway", paint: { "line-color": "#0284c7", "line-width": 3 } },
        { id: "highway_minor", type: "line", source: "openmaptiles", "source-layer": "transportation", paint: { "line-color": "#e2e8f0", "line-width": 1.2 } },
        { id: "highway_major", type: "line", source: "openmaptiles", "source-layer": "transportation", paint: { "line-color": "#cbd5e1", "line-width": 2.5 } }
    ]
};

// Filter out noisy POI markers from vector tiles
function filterBasemapClutter(rawStyle) {
    if (!rawStyle || !rawStyle.layers) return rawStyle;
    const filteredLayers = rawStyle.layers.filter((layer) => {
        const id = layer.id || '';
        return !(
            id.startsWith('poi') ||
            id.startsWith('label_village') ||
            id.startsWith('label_other') ||
            id.startsWith('aeroway') ||
            id === 'airport' ||
            id.startsWith('road_shield')
        );
    });
    return { ...rawStyle, layers: filteredLayers };
}

// GeoJSON collection for Kolkata drainage and water level stations
const WATER_STATIONS_GEOJSON = {
    type: "FeatureCollection",
    features: DRAINAGE_AND_WATER_STATIONS.map(st => ({
        type: "Feature",
        properties: { ...st },
        geometry: {
            type: "Point",
            coordinates: st.coords
        }
    }))
};

export default function MapPage() {
    const mapContainer = useRef(null);
    const mapRef = useRef(null);
    const userLocationMarkerRef = useRef(null);
    const warningMarkersRef = useRef([]);
    const roadPopupRef = useRef(null);
    const heatmapStationPopupRef = useRef(null);

    // Map & Style States
    const [mapStyleMode, setMapStyleMode] = useState('map'); // 'map' | 'satellite'

    // URL Search Params Synchronizer
    const [searchParams, setSearchParams] = useSearchParams();

    // Layer Filter Pills: 'all' | 'heatmap' | 'rainfall' | 'water' | 'roads'
    const [activeLayerFilter, setActiveLayerFilter] = useState('all');

    // Heatmap Condition: 'flood' | 'rainfall' | 'water_level' | 'vulnerability'
    const [activeHeatmapCondition, setActiveHeatmapCondition] = useState('flood');
    const activeHeatmapConditionRef = useRef('flood');
    activeHeatmapConditionRef.current = activeHeatmapCondition;
    const [isHeatmapDropdownOpen, setIsHeatmapDropdownOpen] = useState(false);

    // Heatmap Sidebar & Hotspot Selection
    const [selectedHotspot, setSelectedHotspot] = useState(null);
    const [hotspotFilter, setHotspotFilter] = useState('all'); // 'all' | 'critical' | 'high' | 'moderate'
    const [hotspotSearch, setHotspotSearch] = useState('');
    const [densityThreshold, setDensityThreshold] = useState('all'); // 'all' | '0.45' | '0.70' | '0.85'

    // Rainfall Mode State & Doppler Radar Simulation
    const [radarStepIndex, setRadarStepIndex] = useState(2); // 0-5, default 2 is 'LIVE NOW'
    const radarStepIndexRef = useRef(2);
    radarStepIndexRef.current = radarStepIndex;
    const [isRadarPlaying, setIsRadarPlaying] = useState(false);
    const radarTimerRef = useRef(null);

    // Rainfall Sidebar & Station Selection
    const [selectedRainStation, setSelectedRainStation] = useState(RAIN_GAUGE_STATIONS[1]); // Behala Chowrasta AWS
    const [rainStationFilter, setRainStationFilter] = useState('all'); // 'all' | 'torrential' | 'heavy' | 'moderate'
    const [rainStationSearch, setRainStationSearch] = useState('');

    // Water Level & River Surge State
    const [selectedWaterStation, setSelectedWaterStation] = useState(DRAINAGE_AND_WATER_STATIONS[0]); // Palmer's Bridge
    const [waterStationFilter, setWaterStationFilter] = useState('all'); // 'all' | 'pumping_station' | 'lock_gate' | 'river_gauge'
    const [waterStationSearch, setWaterStationSearch] = useState('');
    const [tidalStepIndex, setTidalStepIndex] = useState(2); // Peak Surge LIVE NOW
    const tidalStepIndexRef = useRef(2);
    tidalStepIndexRef.current = tidalStepIndex;
    const [isTidalPlaying, setIsTidalPlaying] = useState(false);
    const tidalTimerRef = useRef(null);

    // Roads Passability Network State
    const [selectedRoad, setSelectedRoad] = useState(ROADS_PASSABILITY_CORRIDORS[0]); // Diamond Harbour Rd
    const [roadFilter, setRoadFilter] = useState('all'); // 'all' | 'submerged' | 'waterlogged' | 'passable'
    const [roadSearch, setRoadSearch] = useState('');

    // Active Sidebar Tab: 'dedicated' | 'flood'
    const [sidebarTab, setSidebarTab] = useState('dedicated');

    // Territory State (Inside KMC Monitored Zone)
    const [isInsideKMC, setIsInsideKMC] = useState(true);

    // Search state
    const [searchQuery, setSearchQuery] = useState('');
    const [isSearchOpen, setIsSearchOpen] = useState(false);

    // Selected Ward Number & Dropdown States (Default: Ward 120 Behala)
    const [selectedWardNumber, setSelectedWardNumber] = useState(120);
    const selectedWardNumberRef = useRef(120);
    selectedWardNumberRef.current = selectedWardNumber;
    const [isWardDropdownOpen, setIsWardDropdownOpen] = useState(false);
    const handleSelectWardRef = useRef(null);

    // Selected Location state (Default: Behala Ward 120)
    const [selectedWard, setSelectedWard] = useState({
        id: '120',
        name: 'Behala (Ward 120)',
        zone: 'Central East (KMC)',
        coords: [88.3100, 22.4900],
        isInsideKMC: true
    });

    const [locationPrediction, setLocationPrediction] = useState(null);
    const [locationLoading, setLocationLoading] = useState(false);

    // Monitored Wards list with Ward Numbers for search autocomplete
    const monitoredWards = [
        { id: 'kmc', ward_number: null, name: '🏛️ Kolkata Municipal Corporation (Full Extent)', zone: 'KMC Jurisdiction', coords: KOLKATA_CENTER, isBoundaryFit: true },
        ...KOLKATA_WARDS_DATA.map(w => ({
            id: String(w.ward_number),
            ward_number: w.ward_number,
            name: `${w.name} (Ward ${w.ward_number})`,
            zone: w.zone,
            coords: w.center,
            risk_color: w.risk_color,
            vulnerability: w.vulnerability
        }))
    ];

    const filteredWards = monitoredWards.filter(w => {
        const q = searchQuery.toLowerCase().trim();
        if (!q) return true;
        const numMatch = q.replace(/^ward\s*/, '').trim();
        return (
            w.name.toLowerCase().includes(q) ||
            w.zone.toLowerCase().includes(q) ||
            String(w.id).includes(q) ||
            (w.ward_number && String(w.ward_number).includes(numMatch)) ||
            (w.ward_number && `ward ${w.ward_number}`.includes(q))
        );
    });

    // Register all thematic layers on MapLibre instance
    const registerAllThematicLayers = useCallback((map) => {
        if (!map) return;

        // 1. All Kolkata Municipal Wards Base Polygon Grid (Official 141-Ward GeoJSON)
        if (!map.getSource('all-wards-source')) {
            map.addSource('all-wards-source', {
                type: 'geojson',
                data: KOLKATA_WARDS_GEOJSON
            });
        }
        if (!map.getLayer('all-wards-fill')) {
            map.addLayer({
                id: 'all-wards-fill',
                type: 'fill',
                source: 'all-wards-source',
                paint: {
                    'fill-color': ['get', 'risk_color'],
                    'fill-opacity': 0.12
                }
            });
        }
        if (!map.getLayer('all-wards-line')) {
            map.addLayer({
                id: 'all-wards-line',
                type: 'line',
                source: 'all-wards-source',
                paint: {
                    'line-color': '#64748b',
                    'line-width': 1.2,
                    'line-dasharray': [3, 2],
                    'line-opacity': 0.6
                }
            });
        }

        // 0.6. Selected Ward Dynamic Highlight & Bold Bordered Area
        if (!map.getSource('selected-ward-source')) {
            map.addSource('selected-ward-source', {
                type: 'geojson',
                data: getSelectedWardGeoJson(selectedWardNumberRef.current)
            });
        }
        if (!map.getLayer('selected-ward-fill')) {
            map.addLayer({
                id: 'selected-ward-fill',
                type: 'fill',
                source: 'selected-ward-source',
                paint: {
                    'fill-color': ['get', 'risk_color'],
                    'fill-opacity': 0.32
                }
            });
        }
        if (!map.getLayer('selected-ward-glow')) {
            map.addLayer({
                id: 'selected-ward-glow',
                type: 'line',
                source: 'selected-ward-source',
                paint: {
                    'line-color': ['get', 'risk_color'],
                    'line-width': 12,
                    'line-opacity': 0.65,
                    'line-blur': 6
                }
            });
        }
        if (!map.getLayer('selected-ward-casing')) {
            map.addLayer({
                id: 'selected-ward-casing',
                type: 'line',
                source: 'selected-ward-source',
                paint: {
                    'line-color': '#ffffff',
                    'line-width': 6.5,
                    'line-opacity': 0.98
                }
            });
        }
        if (!map.getLayer('selected-ward-line')) {
            map.addLayer({
                id: 'selected-ward-line',
                type: 'line',
                source: 'selected-ward-source',
                paint: {
                    'line-color': ['get', 'risk_color'],
                    'line-width': 3.5,
                    'line-opacity': 1.0
                }
            });
        }

        // Click and hover handlers for ward polygons
        map.on('click', 'all-wards-fill', (e) => {
            const feat = e.features[0];
            if (feat && feat.properties && feat.properties.ward_number) {
                const num = parseInt(feat.properties.ward_number, 10);
                if (!isNaN(num) && handleSelectWardRef.current) {
                    handleSelectWardRef.current(num);
                }
            }
        });
        map.on('mouseenter', 'all-wards-fill', () => {
            map.getCanvas().style.cursor = 'pointer';
        });
        map.on('mouseleave', 'all-wards-fill', () => {
            map.getCanvas().style.cursor = '';
        });

        // 1. Hooghly River Vivid Blue Line
        if (!map.getSource('hooghly-river-source')) {
            map.addSource('hooghly-river-source', {
                type: 'geojson',
                data: HOOGHLY_RIVER_GEOJSON
            });
        }
        if (!map.getLayer('hooghly-river-line')) {
            map.addLayer({
                id: 'hooghly-river-line',
                type: 'line',
                source: 'hooghly-river-source',
                paint: {
                    'line-color': '#0284c7',
                    'line-width': 10,
                    'line-opacity': 0.9
                }
            });
        }

        // 2. Dynamic Gaussian KDE Heatmap Layer (Multi-Condition: Flood Risk, Rainfall, Water Level, Vulnerability)
        if (!map.getSource('dynamic-heatmap-source')) {
            map.addSource('dynamic-heatmap-source', {
                type: 'geojson',
                data: getHeatmapDataByCondition(activeHeatmapConditionRef.current)
            });
        }

        if (!map.getLayer('dynamic-heatmap-layer')) {
            map.addLayer({
                id: 'dynamic-heatmap-layer',
                type: 'heatmap',
                source: 'dynamic-heatmap-source',
                maxzoom: 17,
                paint: {
                    // Weight based on telemetry property
                    'heatmap-weight': [
                        'interpolate',
                        ['linear'],
                        ['coalesce', ['get', 'weight'], ['get', 'risk'], 0.5],
                        0, 0,
                        0.5, 0.65,
                        1, 1.2
                    ],
                    // Adjust intensity by zoom
                    'heatmap-intensity': [
                        'interpolate',
                        ['linear'],
                        ['zoom'],
                        9, 1.1,
                        12, 1.9,
                        15, 3.2
                    ],
                    // Smooth Gaussian density gradient: Transparent -> Green -> Yellow -> Orange -> Crimson -> Maroon
                    'heatmap-color': [
                        'interpolate',
                        ['linear'],
                        ['heatmap-density'],
                        0, 'rgba(0, 0, 0, 0)',
                        0.18, 'rgba(34, 197, 94, 0.45)',
                        0.38, 'rgba(234, 179, 8, 0.72)',
                        0.62, 'rgba(249, 115, 22, 0.88)',
                        0.84, 'rgba(239, 68, 68, 0.96)',
                        1.0, 'rgba(153, 27, 27, 1.0)'
                    ],
                    // Kernel radius in pixels
                    'heatmap-radius': [
                        'interpolate',
                        ['linear'],
                        ['zoom'],
                        9, 30,
                        12, 55,
                        15, 90
                    ],
                    'heatmap-opacity': [
                        'interpolate',
                        ['linear'],
                        ['zoom'],
                        9, 0.88,
                        14, 0.82,
                        17, 0.55
                    ]
                }
            });
        }

        // Station Point Marker Casing (Crisp white outer ring matching telemetry reference)
        if (!map.getLayer('heatmap-stations-casing')) {
            map.addLayer({
                id: 'heatmap-stations-casing',
                type: 'circle',
                source: 'dynamic-heatmap-source',
                minzoom: 9.5,
                paint: {
                    'circle-radius': [
                        'interpolate',
                        ['linear'],
                        ['zoom'],
                        10, 5.5,
                        13, 9.5,
                        16, 13
                    ],
                    'circle-color': '#ffffff',
                    'circle-opacity': 0.98
                }
            });
        }

        // Station Point Marker Nodes (Vibrant colored core by intensity)
        if (!map.getLayer('heatmap-stations-circle')) {
            map.addLayer({
                id: 'heatmap-stations-circle',
                type: 'circle',
                source: 'dynamic-heatmap-source',
                minzoom: 9.5,
                paint: {
                    'circle-radius': [
                        'interpolate',
                        ['linear'],
                        ['zoom'],
                        10, 4.0,
                        13, 7.5,
                        16, 10.5
                    ],
                    'circle-color': [
                        'step',
                        ['coalesce', ['get', 'weight'], ['get', 'risk'], 0.5],
                        '#22c55e',
                        0.35, '#eab308',
                        0.65, '#f97316',
                        0.85, '#ef4444'
                    ],
                    'circle-stroke-width': 1.5,
                    'circle-stroke-color': '#ffffff'
                }
            });
        }

        // Interactive Click on Heatmap Sensor Nodes
        map.on('click', 'heatmap-stations-circle', (e) => {
            const feat = e.features[0];
            if (!feat) return;
            const p = feat.properties;
            const coords = feat.geometry.coordinates;

            if (heatmapStationPopupRef.current) heatmapStationPopupRef.current.remove();

            const cond = HEATMAP_CONDITIONS[activeHeatmapConditionRef.current] || HEATMAP_CONDITIONS.flood;
            let metricHtml = '';
            if (activeHeatmapConditionRef.current === 'rainfall') {
                metricHtml = `
                    <div style="font-size: 19px; font-weight: 800; color: #0284c7; margin: 4px 0;">
                        ${p.rainfall_rate || 0} <span style="font-size: 12px; font-weight: 500;">mm/h</span>
                    </div>
                    <div style="font-size: 11px; color: #64748b;">24h Total: <strong>${p.accumulation_24h || '--'} mm</strong> • Trend: <strong>${p.trend || 'Steady'}</strong></div>
                `;
            } else if (activeHeatmapConditionRef.current === 'water_level') {
                metricHtml = `
                    <div style="font-size: 19px; font-weight: 800; color: #0284c7; margin: 4px 0;">
                        ${p.water_level || 0} <span style="font-size: 12px; font-weight: 500;">m (Depth)</span>
                    </div>
                    <div style="font-size: 11px; color: #64748b;">Danger Level: <strong>${p.danger_level || '--'} m</strong> • Status: <strong>${p.status || 'Active'}</strong></div>
                `;
            } else if (activeHeatmapConditionRef.current === 'vulnerability') {
                metricHtml = `
                    <div style="font-size: 19px; font-weight: 800; color: #f97316; margin: 4px 0;">
                        ${p.vulnerability_score || 0} <span style="font-size: 12px; font-weight: 500;">/ 100</span>
                    </div>
                    <div style="font-size: 11px; color: #64748b;">Civic Exposure: <strong>${p.status || 'Monitored Basin'}</strong></div>
                `;
            } else {
                metricHtml = `
                    <div style="font-size: 19px; font-weight: 800; color: #ef4444; margin: 4px 0;">
                        ${Math.round((p.risk || 0.8) * 100)}% <span style="font-size: 12px; font-weight: 500;">Risk Index</span>
                    </div>
                    <div style="font-size: 11px; color: #64748b;">Est. Inundation: <strong>${p.depth_cm || '--'} cm</strong> • Level: <strong>${p.level || 'High'}</strong></div>
                `;
            }

            heatmapStationPopupRef.current = new Popup({ offset: 12, className: 'heatmap-sensor-popup' })
                .setLngLat(coords)
                .setHTML(`
                    <div style="font-family: inherit; padding: 6px 8px; min-width: 190px;">
                        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 4px;">
                            <span style="font-size: 10px; font-weight: 700; text-transform: uppercase; color: #0369a1; background: #e0f2fe; padding: 2px 6px; border-radius: 4px;">
                                ${cond.icon} ${cond.label}
                            </span>
                            <span style="font-size: 10px; color: #94a3b8; font-weight: 600;">${p.ward || ''}</span>
                        </div>
                        <h4 style="margin: 0 0 2px; font-size: 13px; font-weight: 700; color: #0f172a;">${p.name || 'Sensor Station'}</h4>
                        ${metricHtml}
                    </div>
                `)
                .addTo(map);
        });

        map.on('mouseenter', 'heatmap-stations-circle', () => {
            map.getCanvas().style.cursor = 'pointer';
        });
        map.on('mouseleave', 'heatmap-stations-circle', () => {
            map.getCanvas().style.cursor = '';
        });

        // 3. Water Level & River Surge Layer (Linear Canals & Corridors)
        if (!map.getSource('water-level-layer-source')) {
            map.addSource('water-level-layer-source', {
                type: 'geojson',
                data: WATER_LEVEL_LAYER_GEOJSON
            });
        }
        if (!map.getLayer('water-level-lines')) {
            map.addLayer({
                id: 'water-level-lines',
                type: 'line',
                source: 'water-level-layer-source',
                filter: ['==', '$type', 'LineString'],
                paint: {
                    'line-color': ['get', 'color'],
                    'line-width': 6,
                    'line-opacity': 0.95
                }
            });
        }

        // 4. Kolkata Drainage Pumping Stations & River Lock Gates Network
        if (!map.getSource('water-stations-source')) {
            map.addSource('water-stations-source', {
                type: 'geojson',
                data: WATER_STATIONS_GEOJSON
            });
        }
        if (!map.getLayer('water-stations-casing')) {
            map.addLayer({
                id: 'water-stations-casing',
                type: 'circle',
                source: 'water-stations-source',
                minzoom: 9.5,
                paint: {
                    'circle-radius': ['interpolate', ['linear'], ['zoom'], 10, 6, 13, 9.5, 16, 13.5],
                    'circle-color': '#ffffff',
                    'circle-opacity': 0.98
                }
            });
        }
        if (!map.getLayer('water-stations-circle')) {
            map.addLayer({
                id: 'water-stations-circle',
                type: 'circle',
                source: 'water-stations-source',
                minzoom: 9.5,
                paint: {
                    'circle-radius': ['interpolate', ['linear'], ['zoom'], 10, 4.5, 13, 7.5, 16, 11],
                    'circle-color': [
                        'match',
                        ['get', 'alert'],
                        'Red', '#ef4444',
                        'Orange', '#f97316',
                        '#0284c7'
                    ],
                    'circle-stroke-width': 1.5,
                    'circle-stroke-color': '#ffffff'
                }
            });
        }

        // Interactive Click on Drainage & Water Station Nodes
        map.on('click', 'water-stations-circle', (e) => {
            const feat = e.features[0];
            if (!feat) return;
            const p = feat.properties;
            const coords = feat.geometry.coordinates;

            if (heatmapStationPopupRef.current) heatmapStationPopupRef.current.remove();
            heatmapStationPopupRef.current = new Popup({ offset: 12, className: 'heatmap-sensor-popup' })
                .setLngLat(coords)
                .setHTML(`
                    <div style="font-family: inherit; padding: 6px 8px; min-width: 215px;">
                        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 4px;">
                            <span style="font-size: 10px; font-weight: 700; text-transform: uppercase; color: #0284c7; background: #e0f2fe; padding: 2px 6px; border-radius: 4px;">
                                ${p.ward || ''} • ${p.type_label || 'Pumping Station'}
                            </span>
                            <span style="font-size: 10px; color: ${p.alert === 'Red' ? '#dc2626' : '#ea580c'}; font-weight: 700;">
                                ${p.status}
                            </span>
                        </div>
                        <h4 style="margin: 0 0 2px; font-size: 13px; font-weight: 700; color: #0f172a;">${p.name}</h4>
                        <div style="font-size: 20px; font-weight: 800; color: #0284c7; margin: 4px 0;">
                            ${p.water_level_m} <span style="font-size: 12px; font-weight: 500;">m (Water Level)</span>
                        </div>
                        <div style="font-size: 11px; color: #64748b; line-height: 1.5;">
                            Capacity: <strong>${p.capacity_pct}%</strong> • Discharge: <strong>${p.discharge_rate}</strong><br/>
                            Pumps: <strong>${p.pumps_active}</strong> • Trend: <strong>${p.trend}</strong><br/>
                            Outfall: <strong>${p.outfall}</strong>
                        </div>
                    </div>
                `)
                .addTo(map);
        });

        map.on('mouseenter', 'water-stations-circle', () => {
            map.getCanvas().style.cursor = 'pointer';
        });
        map.on('mouseleave', 'water-stations-circle', () => {
            map.getCanvas().style.cursor = '';
        });

        // 5. Roads Passability Network Layer
        if (!map.getSource('roads-layer-source')) {
            map.addSource('roads-layer-source', {
                type: 'geojson',
                data: ROADS_LAYER_GEOJSON
            });
        }
        if (!map.getLayer('roads-casing')) {
            map.addLayer({
                id: 'roads-casing',
                type: 'line',
                source: 'roads-layer-source',
                paint: {
                    'line-color': '#ffffff',
                    'line-width': 8,
                    'line-opacity': 0.9
                }
            });
        }
        if (!map.getLayer('roads-passability-line')) {
            map.addLayer({
                id: 'roads-passability-line',
                type: 'line',
                source: 'roads-layer-source',
                paint: {
                    'line-color': ['get', 'color'],
                    'line-width': 5,
                    'line-opacity': 1.0
                }
            });
        }

        // Interactive Road Click Handler
        map.on('click', 'roads-passability-line', (e) => {
            const feat = e.features[0];
            if (!feat) return;
            const props = feat.properties;
            const { lng, lat } = e.lngLat;

            if (roadPopupRef.current) roadPopupRef.current.remove();

            roadPopupRef.current = new Popup({ offset: 12, className: 'road-passability-popup' })
                .setLngLat([lng, lat])
                .setHTML(`
                    <div style="font-family: inherit; padding: 4px;">
                        <h4 style="margin: 0 0 4px; font-size: 13px; font-weight: 700; color: #0f172a;">${props.name}</h4>
                        <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 6px;">
                            <span style="display: inline-block; width: 8px; height: 8px; border-radius: 50%; background: ${props.color};"></span>
                            <strong style="font-size: 12px; color: ${props.color};">${props.status}</strong>
                            <span style="font-size: 11px; color: #64748b;">(Depth: ${props.water_depth_cm} cm)</span>
                        </div>
                        <p style="margin: 0; font-size: 11px; color: #475569; line-height: 1.4;">${props.advisory}</p>
                    </div>
                `)
                .addTo(map);
        });

        // Pointer cursor over interactive roads
        map.on('mouseenter', 'roads-passability-line', () => {
            map.getCanvas().style.cursor = 'pointer';
        });
        map.on('mouseleave', 'roads-passability-line', () => {
            map.getCanvas().style.cursor = '';
        });
    }, []);

    // Apply Layer Filter Visibilities based on Active Pill Toggle
    const applyLayerVisibilities = useCallback((filter) => {
        if (!mapRef.current) return;
        const map = mapRef.current;

        const setVis = (layerId, isVisible) => {
            if (map.getLayer(layerId)) {
                map.setLayoutProperty(layerId, 'visibility', isVisible ? 'visible' : 'none');
            }
        };

        // Keep all ward grid and active ward border prominent
        setVis('all-wards-fill', true);
        setVis('all-wards-line', true);
        setVis('selected-ward-fill', true);
        setVis('selected-ward-glow', true);
        setVis('selected-ward-casing', true);
        setVis('selected-ward-line', true);

        if (filter === 'all') {
            // Show all layers harmoniously with Gaussian KDE Heatmap
            setVis('hooghly-river-line', true);
            setVis('dynamic-heatmap-layer', true);
            setVis('heatmap-stations-casing', true);
            setVis('heatmap-stations-circle', true);
            setVis('water-level-lines', true);
            setVis('water-stations-casing', true);
            setVis('water-stations-circle', true);
            setVis('roads-casing', true);
            setVis('roads-passability-line', true);
            warningMarkersRef.current.forEach(m => m.getElement().style.display = 'block');
        } else if (filter === 'heatmap') {
            // Isolate Gaussian KDE Heatmap & Sensor Stations
            setVis('hooghly-river-line', true);
            setVis('dynamic-heatmap-layer', true);
            setVis('heatmap-stations-casing', true);
            setVis('heatmap-stations-circle', true);
            setVis('water-level-lines', false);
            setVis('water-stations-casing', false);
            setVis('water-stations-circle', false);
            setVis('roads-casing', false);
            setVis('roads-passability-line', false);
            warningMarkersRef.current.forEach(m => m.getElement().style.display = 'none');
        } else if (filter === 'rainfall') {
            // Isolate Rainfall Heatmap & AWS Stations
            setVis('hooghly-river-line', true);
            setVis('dynamic-heatmap-layer', true);
            setVis('heatmap-stations-casing', true);
            setVis('heatmap-stations-circle', true);
            setVis('water-level-lines', false);
            setVis('water-stations-casing', false);
            setVis('water-stations-circle', false);
            setVis('roads-casing', false);
            setVis('roads-passability-line', false);
            warningMarkersRef.current.forEach(m => m.getElement().style.display = 'none');
        } else if (filter === 'water') {
            // Isolate Water Level & River Surge Layer
            setVis('hooghly-river-line', true);
            setVis('dynamic-heatmap-layer', true);
            setVis('heatmap-stations-casing', false);
            setVis('heatmap-stations-circle', false);
            setVis('water-level-lines', true);
            setVis('water-stations-casing', true);
            setVis('water-stations-circle', true);
            setVis('roads-casing', false);
            setVis('roads-passability-line', false);
            warningMarkersRef.current.forEach(m => m.getElement().style.display = 'block');
        } else if (filter === 'roads') {
            // Isolate Road Passability Network
            setVis('hooghly-river-line', false);
            setVis('dynamic-heatmap-layer', false);
            setVis('heatmap-stations-casing', false);
            setVis('heatmap-stations-circle', false);
            setVis('water-level-lines', false);
            setVis('water-stations-casing', false);
            setVis('water-stations-circle', false);
            setVis('roads-casing', true);
            setVis('roads-passability-line', true);
            warningMarkersRef.current.forEach(m => m.getElement().style.display = 'none');
        }
    }, []);

    // Switch Heatmap Condition & Update Source Dynamically
    const handleSwitchHeatmapCondition = useCallback((conditionKey) => {
        setActiveHeatmapCondition(conditionKey);
        activeHeatmapConditionRef.current = conditionKey;
        setIsHeatmapDropdownOpen(false);

        if (mapRef.current) {
            const source = mapRef.current.getSource('dynamic-heatmap-source');
            if (source) {
                source.setData(getHeatmapDataByCondition(conditionKey));
            }
        }
    }, []);

    // Update radar heatmap data on step change
    const applyRadarStep = useCallback((stepIdx) => {
        if (!mapRef.current) return;
        const source = mapRef.current.getSource('dynamic-heatmap-source');
        if (source) {
            source.setData(getRainfallTimelineData(stepIdx));
        }
    }, []);

    // Timeline Auto-play Loop
    useEffect(() => {
        if (isRadarPlaying && activeLayerFilter === 'rainfall') {
            radarTimerRef.current = setInterval(() => {
                setRadarStepIndex(prev => {
                    const next = (prev + 1) % RADAR_TIMELINE_STEPS.length;
                    applyRadarStep(next);
                    return next;
                });
            }, 2600);
        } else {
            if (radarTimerRef.current) clearInterval(radarTimerRef.current);
        }
        return () => {
            if (radarTimerRef.current) clearInterval(radarTimerRef.current);
        };
    }, [isRadarPlaying, activeLayerFilter, applyRadarStep]);

    const handleSetRadarStep = (idx) => {
        setIsRadarPlaying(false);
        setRadarStepIndex(idx);
        applyRadarStep(idx);
    };

    // Filter rain stations
    const filteredRainStations = RAIN_GAUGE_STATIONS.filter(s => {
        const matchesSearch = s.name.toLowerCase().includes(rainStationSearch.toLowerCase()) ||
                              s.ward.toLowerCase().includes(rainStationSearch.toLowerCase());
        if (!matchesSearch) return false;
        if (rainStationFilter === 'torrential') return s.rainfall_rate >= 85;
        if (rainStationFilter === 'heavy') return s.rainfall_rate >= 65 && s.rainfall_rate < 85;
        if (rainStationFilter === 'moderate') return s.rainfall_rate < 65;
        return true;
    });

    // Select rain station from sidebar
    const handleSelectRainStation = (st) => {
        setSelectedRainStation(st);
        if (!mapRef.current) return;
        mapRef.current.flyTo({
            center: st.coords,
            zoom: 13.8,
            duration: 850,
            essential: true
        });

        if (heatmapStationPopupRef.current) heatmapStationPopupRef.current.remove();
        heatmapStationPopupRef.current = new Popup({ offset: 12, className: 'heatmap-sensor-popup' })
            .setLngLat(st.coords)
            .setHTML(`
                <div style="font-family: inherit; padding: 6px 8px; min-width: 200px;">
                    <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 4px;">
                        <span style="font-size: 10px; font-weight: 700; color: #0369a1; background: #e0f2fe; padding: 2px 6px; border-radius: 4px;">
                            ${st.ward}
                        </span>
                        <span style="font-size: 10px; color: ${st.alert === 'Red' ? '#dc2626' : st.alert === 'Orange' ? '#ea580c' : '#ca8a04'}; font-weight: 700;">
                            ${st.status}
                        </span>
                    </div>
                    <h4 style="margin: 0 0 4px; font-size: 13px; font-weight: 700; color: #0f172a;">${st.name}</h4>
                    <div style="font-size: 20px; font-weight: 800; color: #0284c7; margin: 4px 0;">
                        ${st.rainfall_rate} <span style="font-size: 12px; font-weight: 500;">mm/h</span>
                    </div>
                    <div style="font-size: 11px; color: #64748b; line-height: 1.5;">
                        24h Total: <strong>${st.accumulation_24h} mm</strong> • Temp: <strong>${st.temp_c}°C</strong><br/>
                        Humidity: <strong>${st.humidity}%</strong> • Trend: <strong>${st.trend}</strong>
                    </div>
                </div>
            `)
            .addTo(mapRef.current);
    };

    // Tidal Timeline Auto-play Loop
    useEffect(() => {
        if (isTidalPlaying && activeLayerFilter === 'water') {
            tidalTimerRef.current = setInterval(() => {
                setTidalStepIndex(prev => (prev + 1) % TIDAL_TIMELINE_STEPS.length);
            }, 2800);
        } else {
            if (tidalTimerRef.current) clearInterval(tidalTimerRef.current);
        }
        return () => {
            if (tidalTimerRef.current) clearInterval(tidalTimerRef.current);
        };
    }, [isTidalPlaying, activeLayerFilter]);

    const handleSetTidalStep = (idx) => {
        setIsTidalPlaying(false);
        setTidalStepIndex(idx);
    };

    // Filter water stations
    const filteredWaterStations = DRAINAGE_AND_WATER_STATIONS.filter(s => {
        const matchesSearch = s.name.toLowerCase().includes(waterStationSearch.toLowerCase()) ||
                              s.ward.toLowerCase().includes(waterStationSearch.toLowerCase()) ||
                              s.zone.toLowerCase().includes(waterStationSearch.toLowerCase());
        if (!matchesSearch) return false;
        if (waterStationFilter === 'pumping_station') return s.type === 'pumping_station';
        if (waterStationFilter === 'lock_gate') return s.type === 'lock_gate';
        if (waterStationFilter === 'river_gauge') return s.type === 'river_gauge';
        return true;
    });

    // Select water station from sidebar
    const handleSelectWaterStation = (st) => {
        setSelectedWaterStation(st);
        if (!mapRef.current) return;
        mapRef.current.flyTo({
            center: st.coords,
            zoom: 14.2,
            duration: 850,
            essential: true
        });

        if (heatmapStationPopupRef.current) heatmapStationPopupRef.current.remove();
        heatmapStationPopupRef.current = new Popup({ offset: 12, className: 'heatmap-sensor-popup' })
            .setLngLat(st.coords)
            .setHTML(`
                <div style="font-family: inherit; padding: 6px 8px; min-width: 215px;">
                    <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 4px;">
                        <span style="font-size: 10px; font-weight: 700; text-transform: uppercase; color: #0284c7; background: #e0f2fe; padding: 2px 6px; border-radius: 4px;">
                            ${st.ward || ''} • ${st.type_label || 'Pumping Station'}
                        </span>
                        <span style="font-size: 10px; color: ${st.alert === 'Red' ? '#dc2626' : '#ea580c'}; font-weight: 700;">
                            ${st.status}
                        </span>
                    </div>
                    <h4 style="margin: 0 0 2px; font-size: 13px; font-weight: 700; color: #0f172a;">${st.name}</h4>
                    <div style="font-size: 20px; font-weight: 800; color: #0284c7; margin: 4px 0;">
                        ${st.water_level_m} <span style="font-size: 12px; font-weight: 500;">m (Water Level)</span>
                    </div>
                    <div style="font-size: 11px; color: #64748b; line-height: 1.5;">
                        Capacity: <strong>${st.capacity_pct}%</strong> • Discharge: <strong>${st.discharge_rate}</strong><br/>
                        Pumps: <strong>${st.pumps_active}</strong> • Trend: <strong>${st.trend}</strong><br/>
                        Outfall: <strong>${st.outfall}</strong>
                    </div>
                </div>
            `)
            .addTo(mapRef.current);
    };

    // Filter road corridors
    const filteredRoads = ROADS_PASSABILITY_CORRIDORS.filter(r => {
        const matchesSearch = r.name.toLowerCase().includes(roadSearch.toLowerCase()) ||
                              r.ward.toLowerCase().includes(roadSearch.toLowerCase()) ||
                              r.zone.toLowerCase().includes(roadSearch.toLowerCase());
        if (!matchesSearch) return false;
        if (roadFilter === 'submerged') return r.water_depth_cm >= 30;
        if (roadFilter === 'waterlogged') return r.water_depth_cm >= 15 && r.water_depth_cm < 30;
        if (roadFilter === 'passable') return r.water_depth_cm < 15;
        return true;
    });

    // Select road corridor from sidebar
    const handleSelectRoad = (road) => {
        setSelectedRoad(road);
        if (!mapRef.current) return;
        mapRef.current.flyTo({
            center: road.coords,
            zoom: 13.8,
            duration: 850,
            essential: true
        });

        if (roadPopupRef.current) roadPopupRef.current.remove();
        roadPopupRef.current = new Popup({ offset: 12, className: 'road-passability-popup' })
            .setLngLat(road.coords)
            .setHTML(`
                <div style="font-family: inherit; padding: 4px; min-width: 220px;">
                    <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 4px;">
                        <span style="font-size: 10px; font-weight: 700; color: #64748b; background: #f1f5f9; padding: 2px 6px; border-radius: 4px;">
                            ${road.ward}
                        </span>
                        <strong style="font-size: 11px; color: ${road.color};">${road.status_label}</strong>
                    </div>
                    <h4 style="margin: 0 0 4px; font-size: 13px; font-weight: 700; color: #0f172a;">${road.name}</h4>
                    <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 6px;">
                        <span style="display: inline-block; width: 8px; height: 8px; border-radius: 50%; background: ${road.color};"></span>
                        <span style="font-size: 12px; font-weight: 800; color: #0f172a;">Depth: ${road.water_depth_cm} cm</span>
                        <span style="font-size: 11px; color: #64748b;">• ${road.traffic_speed}</span>
                    </div>
                    <p style="margin: 0 0 6px; font-size: 11px; color: #475569; line-height: 1.4;">${road.advisory}</p>
                    <div style="font-size: 10.5px; background: #f8fafc; border: 1px solid #e2e8f0; padding: 4px 6px; border-radius: 4px; color: #0284c7; font-weight: 600;">
                        ↪ Detour: ${road.detour_route}
                    </div>
                </div>
            `)
            .addTo(mapRef.current);
    };

    // Filter heatmap hotspots
    const currentHeatmapGeoJson = getHeatmapDataByCondition(activeHeatmapCondition);
    const heatmapHotspotsList = (currentHeatmapGeoJson.features || []).map(f => ({
        id: f.properties.id || f.properties.name,
        name: f.properties.name,
        ward: f.properties.ward || 'Kolkata Basin',
        coords: f.geometry.coordinates,
        weight: f.properties.weight || f.properties.risk || 0.5,
        ...f.properties
    }));

    const filteredHotspots = heatmapHotspotsList.filter(h => {
        const matchesSearch = (h.name || '').toLowerCase().includes(hotspotSearch.toLowerCase()) ||
                              (h.ward || '').toLowerCase().includes(hotspotSearch.toLowerCase());
        if (!matchesSearch) return false;
        if (hotspotFilter === 'critical') return h.weight >= 0.85;
        if (hotspotFilter === 'high') return h.weight >= 0.65 && h.weight < 0.85;
        if (hotspotFilter === 'moderate') return h.weight < 0.65;
        return true;
    });

    const handleSelectHotspot = (spot) => {
        setSelectedHotspot(spot);
        if (!mapRef.current) return;
        mapRef.current.flyTo({
            center: spot.coords,
            zoom: 14.5,
            duration: 850,
            essential: true
        });

        if (heatmapStationPopupRef.current) heatmapStationPopupRef.current.remove();
        heatmapStationPopupRef.current = new Popup({ offset: 12, className: 'heatmap-sensor-popup' })
            .setLngLat(spot.coords)
            .setHTML(`
                <div style="font-family: inherit; padding: 6px 8px; min-width: 200px;">
                    <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 4px;">
                        <span style="font-size: 10px; font-weight: 700; color: #ea580c; background: #fff7ed; padding: 2px 6px; border-radius: 4px;">
                            ${spot.ward}
                        </span>
                        <span style="font-size: 10px; color: ${spot.weight > 0.85 ? '#dc2626' : '#ea580c'}; font-weight: 700;">
                            ${Math.round(spot.weight * 100)}% Intensity
                        </span>
                    </div>
                    <h4 style="margin: 0 0 4px; font-size: 13px; font-weight: 700; color: #0f172a;">${spot.name}</h4>
                    <div style="font-size: 11px; color: #64748b; line-height: 1.5;">
                        Elevation: <strong>${spot.elevation || '4.2m ASL'}</strong> • Drainage: <strong>${spot.drainage || 'Monitored'}</strong>
                    </div>
                </div>
            `)
            .addTo(mapRef.current);
    };

    // Synchronize layer from URL query param (?layer=...)
    useEffect(() => {
        const layerParam = searchParams.get('layer');
        if (layerParam && ['all', 'heatmap', 'rainfall', 'water', 'roads'].includes(layerParam)) {
            if (layerParam !== activeLayerFilter) {
                handleLayerPillClick(layerParam, false);
            }
        }
    }, [searchParams]);

    // Handle Layer Pill Button Clicks
    const handleLayerPillClick = (filterKey, updateUrl = true) => {
        setActiveLayerFilter(filterKey);
        if (updateUrl) {
            setSearchParams({ layer: filterKey }, { replace: true });
        }
        setSidebarTab('dedicated');

        if (filterKey === 'rainfall') {
            handleSwitchHeatmapCondition('rainfall');
            setRadarStepIndex(2); // Reset to Live
            applyRadarStep(2);
        } else if (filterKey === 'water') {
            handleSwitchHeatmapCondition('water_level');
            setTidalStepIndex(2); // Peak surge live
        } else if (filterKey === 'heatmap') {
            handleSwitchHeatmapCondition(activeHeatmapConditionRef.current || 'flood');
        } else {
            setIsRadarPlaying(false);
            setIsTidalPlaying(false);
        }
        applyLayerVisibilities(filterKey);
    };

    // Smoothly fly and fit map to full Kolkata Extent
    const handleFitKolkataBounds = useCallback(() => {
        if (!mapRef.current) return;
        mapRef.current.fitBounds(KOLKATA_BOUNDS, {
            padding: { top: 45, bottom: 45, left: 45, right: 45 },
            duration: 900,
            essential: true
        });
    }, []);

    // Location selection handler
    const handleSelectLocation = useCallback(async (lat, lng, wardId, wardName) => {
        setLocationLoading(true);
        const inside = isPointInKolkata(lng, lat);
        setIsInsideKMC(inside);

        const resolvedWardId = wardId || (inside ? '120' : 'peripheral');
        const resolvedName = wardName || (inside
            ? `Kolkata Location (${lat.toFixed(4)}°N, ${lng.toFixed(4)}°E)`
            : `Peripheral Greater Kolkata (${lat.toFixed(4)}°N, ${lng.toFixed(4)}°E)`);

        // Check if resolvedWardId corresponds to a known Ward number in dataset
        const wardNumCandidate = parseInt(resolvedWardId, 10);
        if (!isNaN(wardNumCandidate) && getWardByNumber(wardNumCandidate)) {
            setSelectedWardNumber(wardNumCandidate);
            selectedWardNumberRef.current = wardNumCandidate;
            if (mapRef.current) {
                const source = mapRef.current.getSource('selected-ward-source');
                if (source) {
                    source.setData(getSelectedWardGeoJson(wardNumCandidate));
                }
            }
        }

        setSelectedWard({
            id: String(resolvedWardId),
            name: resolvedName,
            zone: inside ? 'KMC Monitored Zone' : 'Greater Kolkata Peripheral',
            coords: [lng, lat],
            isInsideKMC: inside
        });

        if (mapRef.current) {
            mapRef.current.flyTo({
                center: [lng, lat],
                zoom: 13.2,
                essential: true,
                duration: 800
            });

            // Update user location pin marker
            if (userLocationMarkerRef.current) {
                userLocationMarkerRef.current.setLngLat([lng, lat]);
            } else {
                const el = document.createElement('div');
                el.className = 'custom-map-pin-marker';
                el.innerHTML = `<div class="pin-outer"><div class="pin-inner"></div></div>`;
                userLocationMarkerRef.current = new Marker({ element: el })
                    .setLngLat([lng, lat])
                    .addTo(mapRef.current);
            }
        }

        try {
            const res = await api.predictLocation({
                latitude: lat,
                longitude: lng,
                rainfall_mm: 82.0,
                forecast_rainfall_mm: 92.0,
                avg_humidity_percent: 84.0,
                avg_temperature_c: 28.0,
                is_monsoon: 1
            });

            if (res && res.prediction) {
                setLocationPrediction(res);
            }
        } catch (err) {
            console.warn('Location prediction API fallback:', err);
        } finally {
            setLocationLoading(false);
        }
    }, []);

    // Ward selection handler: Updates selected ward state, outlines bordered area, frames bounds, & triggers telemetry
    const handleSelectWard = useCallback((wardNumber) => {
        const num = parseInt(wardNumber, 10);
        if (isNaN(num)) return;
        const wardInfo = getWardByNumber(num);
        if (!wardInfo) return;

        setSelectedWardNumber(num);
        selectedWardNumberRef.current = num;

        // 1. Update dynamic GeoJSON source for bordered polygon & glow casing
        if (mapRef.current) {
            const source = mapRef.current.getSource('selected-ward-source');
            if (source) {
                source.setData(getSelectedWardGeoJson(num));
            }

            // 2. Smoothly fit camera bounds around this ward's bordered polygon
            const bounds = getWardBounds(num);
            if (bounds) {
                mapRef.current.fitBounds(bounds, {
                    padding: { top: 65, bottom: 65, left: 65, right: 65 },
                    duration: 850,
                    essential: true
                });
            }
        }

        // 3. Update telemetry and location prediction
        handleSelectLocation(wardInfo.center[1], wardInfo.center[0], String(num), `${wardInfo.name} (Ward ${num})`);
    }, [handleSelectLocation]);

    handleSelectWardRef.current = handleSelectWard;

    // 1. Initialize MapLibre Canvas
    useEffect(() => {
        if (mapRef.current) return;

        async function initMap() {
            let initialStyle = FALLBACK_POSITRON_STYLE;
            try {
                const response = await fetch(OPENFREEMAP_POSITRON_URL);
                if (response.ok) {
                    const rawJson = await response.json();
                    initialStyle = filterBasemapClutter(rawJson);
                }
            } catch (err) {
                console.warn('Using fallback Positron style:', err);
            }

            const map = new Map({
                container: mapContainer.current,
                style: initialStyle,
                center: [88.3500, 22.5400],
                zoom: 12.0,
                minZoom: 2,
                maxZoom: 19
            });

            map.on('load', () => {
                registerAllThematicLayers(map);
                applyLayerVisibilities(activeLayerFilter);

                // Auto-fit to full Kolkata Official Boundary on load
                map.fitBounds(KOLKATA_BOUNDS, {
                    padding: { top: 40, bottom: 40, left: 40, right: 40 },
                    duration: 1000
                });

                // Add Warning Triangle Markers
                CRITICAL_WARNING_POINTS.forEach(pt => {
                    const el = document.createElement('div');
                    el.className = 'custom-warning-triangle-marker';
                    el.innerHTML = `<div class="warning-triangle"><span>!</span></div>`;
                    el.title = `${pt.name} — ${pt.description}`;
                    const marker = new Marker({ element: el })
                        .setLngLat(pt.coords)
                        .addTo(map);
                    warningMarkersRef.current.push(marker);
                });

                // Initial pin on Behala
                const initialCoords = [88.3100, 22.4900];
                const pinEl = document.createElement('div');
                pinEl.className = 'custom-map-pin-marker';
                pinEl.innerHTML = `<div class="pin-outer"><div class="pin-inner"></div></div>`;
                userLocationMarkerRef.current = new Marker({ element: pinEl })
                    .setLngLat(initialCoords)
                    .addTo(map);
            });

            map.on('click', (e) => {
                const { lng, lat } = e.lngLat;
                handleSelectLocation(lat, lng);
            });

            mapRef.current = map;
        }

        initMap();

        return () => {
            warningMarkersRef.current.forEach(m => m.remove());
            userLocationMarkerRef.current?.remove();
            roadPopupRef.current?.remove();
            heatmapStationPopupRef.current?.remove();
            mapRef.current?.remove();
            mapRef.current = null;
        };
    }, [registerAllThematicLayers, applyLayerVisibilities, handleSelectLocation, activeLayerFilter]);

    // Basemap Switcher (Map vs Satellite)
    const handleToggleBasemap = (mode) => {
        setMapStyleMode(mode);
        if (!mapRef.current) return;
        const map = mapRef.current;

        if (mode === 'satellite') {
            const satelliteStyle = {
                version: 8,
                sources: {
                    'esri-satellite': {
                        type: 'raster',
                        tiles: [SATELLITE_TILE_URL],
                        tileSize: 256
                    }
                },
                layers: [
                    {
                        id: 'esri-satellite-layer',
                        type: 'raster',
                        source: 'esri-satellite',
                        minzoom: 0,
                        maxzoom: 19
                    }
                ]
            };
            map.setStyle(satelliteStyle);
            map.once('style.load', () => {
                registerAllThematicLayers(map);
                applyLayerVisibilities(activeLayerFilter);
            });
        } else {
            fetch(OPENFREEMAP_POSITRON_URL)
                .then(r => r.json())
                .then(rawJson => {
                    const cleanStyle = filterBasemapClutter(rawJson);
                    map.setStyle(cleanStyle);
                    map.once('style.load', () => {
                        registerAllThematicLayers(map);
                        applyLayerVisibilities(activeLayerFilter);
                    });
                })
                .catch(() => {
                    map.setStyle(FALLBACK_POSITRON_STYLE);
                    map.once('style.load', () => {
                        registerAllThematicLayers(map);
                        applyLayerVisibilities(activeLayerFilter);
                    });
                });
        }
    };

    // Zoom & Locate Controls
    const handleZoomIn = () => mapRef.current?.zoomIn();
    const handleZoomOut = () => mapRef.current?.zoomOut();
    const handleLocateMe = () => {
        handleSelectLocation(22.4900, 88.3100, '120', 'Behala (Ward 120)');
    };

    // Initial prediction on mount
    useEffect(() => {
        handleSelectLocation(22.4900, 88.3100, '120', 'Behala (Ward 120)');
    }, [handleSelectLocation]);

    return (
        <div className="flood-monitor-app-layout">
            {/* Top Navigation & Filter Bar */}
            <header className="top-filter-bar">
                {/* Search Box on Left */}
                <div className="top-search-wrapper">
                    <div className="top-search-input-box">
                        <Search size={16} className="search-icon" />
                        <input
                            type="text"
                            placeholder="Search location..."
                            value={searchQuery}
                            onChange={(e) => {
                                setSearchQuery(e.target.value);
                                setIsSearchOpen(true);
                            }}
                            onFocus={() => setIsSearchOpen(true)}
                        />
                    </div>

                    {/* Autocomplete Dropdown */}
                    {isSearchOpen && (
                        <div className="search-autocomplete-dropdown">
                            {filteredWards.slice(0, 35).map(w => (
                                <div
                                    key={w.id}
                                    className="search-dropdown-item"
                                    onClick={() => {
                                        if (w.isBoundaryFit) {
                                            handleFitKolkataBounds();
                                            handleSelectLocation(w.coords[1], w.coords[0], 'kmc', 'Kolkata Municipal Corporation (KMC)');
                                        } else if (w.ward_number) {
                                            handleSelectWard(w.ward_number);
                                        } else {
                                            handleSelectLocation(w.coords[1], w.coords[0], w.id, w.name);
                                        }
                                        setSearchQuery(w.name.replace(/^[^\w\s]+/, '').trim());
                                        setIsSearchOpen(false);
                                    }}
                                >
                                    <span className="item-pin">📍</span>
                                    <div className="item-text">
                                        <span className="item-name">
                                            {w.name}
                                            {w.ward_number && (
                                                <span className="search-ward-badge">Ward {w.ward_number}</span>
                                            )}
                                        </span>
                                        <span className="item-sub">{w.zone} Zone • Ward {w.id}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Ward Number Quick Selector Dropdown */}
                <div className="top-ward-selector-wrapper">
                    <div 
                        className="top-ward-select-box"
                        onClick={() => setIsWardDropdownOpen(!isWardDropdownOpen)}
                        title="Select Ward Number to frame & highlight boundary"
                    >
                        <span className="ward-select-icon">🏷️</span>
                        <span className="ward-select-label">
                            Ward: <strong>{selectedWardNumber ? `Ward ${selectedWardNumber}` : 'Select'}</strong>
                        </span>
                        <ChevronDown size={14} className={`ward-chevron ${isWardDropdownOpen ? 'open' : ''}`} />
                    </div>

                    {isWardDropdownOpen && (
                        <div className="ward-picker-dropdown">
                            <div className="ward-picker-header">Select Ward to Border & Frame</div>
                            <div className="ward-picker-grid">
                                {KOLKATA_WARDS_DATA.map(w => (
                                    <button
                                        key={w.ward_number}
                                        type="button"
                                        className={`ward-picker-btn ${selectedWardNumber === w.ward_number ? 'active' : ''}`}
                                        onClick={() => {
                                            handleSelectWard(w.ward_number);
                                            setIsWardDropdownOpen(false);
                                        }}
                                    >
                                        <span className="picker-num">Ward {w.ward_number}</span>
                                        <span className="picker-name">{w.name}</span>
                                        <span 
                                            className="ward-badge-pill" 
                                            style={{ backgroundColor: w.risk_color + '22', color: w.risk_color, borderColor: w.risk_color }}
                                        >
                                            {w.vulnerability}
                                        </span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* Heatmap Condition Switcher Dropdown */}
                <div className="top-heatmap-condition-wrapper">
                    <div 
                        className="top-condition-select-box"
                        onClick={() => setIsHeatmapDropdownOpen(!isHeatmapDropdownOpen)}
                        title="Switch Heatmap Condition (Flood Risk, Rainfall Rate, Water Level, Ward Vulnerability)"
                    >
                        <span className="condition-icon">{HEATMAP_CONDITIONS[activeHeatmapCondition]?.icon || '🔥'}</span>
                        <span className="condition-label">
                            Condition: <strong>{HEATMAP_CONDITIONS[activeHeatmapCondition]?.label?.split(' ')[0] || 'Flood'}</strong>
                        </span>
                        <ChevronDown size={14} className={`condition-chevron ${isHeatmapDropdownOpen ? 'open' : ''}`} />
                    </div>

                    {isHeatmapDropdownOpen && (
                        <div className="condition-picker-dropdown">
                            <div className="condition-picker-header">Select Heatmap Condition</div>
                            <div className="condition-picker-list">
                                {Object.values(HEATMAP_CONDITIONS).map(cond => (
                                    <button
                                        key={cond.key}
                                        type="button"
                                        className={`condition-picker-item ${activeHeatmapCondition === cond.key ? 'active' : ''}`}
                                        onClick={() => handleSwitchHeatmapCondition(cond.key)}
                                    >
                                        <span className="cond-item-icon">{cond.icon}</span>
                                        <div className="cond-item-info">
                                            <span className="cond-item-title">{cond.label}</span>
                                            <span className="cond-item-unit">{cond.unit}</span>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* 5 Thematic Layer Toggle Filter Pills */}
                <div className="top-layer-pills-row">
                    <button
                        className={`layer-pill-btn ${activeLayerFilter === 'all' ? 'active' : ''}`}
                        onClick={() => handleLayerPillClick('all')}
                        title="Display all layers (Heatmap, Water Level, Roads)"
                    >
                        <Layers size={15} />
                        <span>All Layers</span>
                    </button>

                    <button
                        className={`layer-pill-btn ${activeLayerFilter === 'heatmap' ? 'active' : ''}`}
                        onClick={() => handleLayerPillClick('heatmap')}
                        title="Isolate smooth Gaussian density heatmap and sensor network"
                    >
                        <Flame size={15} />
                        <span>Heatmap</span>
                    </button>

                    <button
                        className={`layer-pill-btn ${activeLayerFilter === 'rainfall' ? 'active' : ''}`}
                        onClick={() => handleLayerPillClick('rainfall')}
                        title="Isolate real-time rainfall precipitation heatmap"
                    >
                        <CloudRain size={15} />
                        <span>Rainfall</span>
                    </button>

                    <button
                        className={`layer-pill-btn ${activeLayerFilter === 'water' ? 'active' : ''}`}
                        onClick={() => handleLayerPillClick('water')}
                        title="Isolate live water levels and river surge inundation"
                    >
                        <Waves size={15} />
                        <span>Water Level</span>
                    </button>

                    <button
                        className={`layer-pill-btn ${activeLayerFilter === 'roads' ? 'active' : ''}`}
                        onClick={() => handleLayerPillClick('roads')}
                        title="Isolate road network passability and submergence statuses"
                    >
                        <Compass size={15} />
                        <span>Roads</span>
                    </button>
                </div>
            </header>

            {/* Main Content Area: Map Canvas + Right Telemetry Panel */}
            <main className="flood-monitor-main-content">
                {/* Map Viewport Area */}
                <div className="map-canvas-wrapper">
                    <div ref={mapContainer} className="maplibre-fullscreen-canvas" />

                    {/* Active Layer Badge Indicator */}
                    <div className="active-layer-indicator-badge">
                        <span className="indicator-dot" />
                        <span>
                            Active: <strong>
                                {activeLayerFilter === 'all' ? `All Layers (${HEATMAP_CONDITIONS[activeHeatmapCondition]?.label || 'Flood Risk'})` :
                                 activeLayerFilter === 'heatmap' ? `Heatmap: ${HEATMAP_CONDITIONS[activeHeatmapCondition]?.label || 'Flood Risk'}` :
                                 activeLayerFilter === 'rainfall' ? 'Rainfall Precipitation Rate (mm/h)' :
                                 activeLayerFilter === 'water' ? 'Water Levels & River Surge' :
                                 'Road Network Passability'}
                            </strong>
                        </span>

                        {/* Smooth Gaussian Gradient Mini Legend Bar */}
                        {activeLayerFilter !== 'roads' && (
                            <div className="heatmap-gradient-mini-bar" title="Smooth Gaussian Heatmap Gradient (Low to Critical)">
                                <span className="grad-label">Low</span>
                                <div className="grad-track" />
                                <span className="grad-label">Crit</span>
                            </div>
                        )}

                        {selectedWardNumber && (
                            <span className="ward-status-chip" title={`Bordered Area: Ward ${selectedWardNumber}`}>
                                • Ward {selectedWardNumber} Bordered
                            </span>
                        )}
                    </div>

                    {/* Top-Left Custom Zoom, Fit Boundary & Locate Floating Card */}
                    <div className="map-zoom-controls-floating">
                        <button onClick={handleZoomIn} title="Zoom In" aria-label="Zoom In">
                            <Plus size={18} />
                        </button>
                        <div className="control-divider" />
                        <button onClick={handleZoomOut} title="Zoom Out" aria-label="Zoom Out">
                            <Minus size={18} />
                        </button>
                        <div className="control-divider" />
                        <button onClick={handleFitKolkataBounds} title="Fit Full Kolkata Boundary" aria-label="Fit Kolkata Boundary">
                            <Maximize2 size={16} />
                        </button>
                        <div className="control-divider" />
                        <button onClick={handleLocateMe} title="Center on My Location (Behala)" aria-label="My Location">
                            <Navigation size={16} />
                        </button>
                    </div>

                    {/* Bottom-Right Basemap Switcher Pill (Map | Satellite) */}
                    <div className="map-satellite-switcher-pill">
                        <button
                            className={`switcher-tab ${mapStyleMode === 'map' ? 'active' : ''}`}
                            onClick={() => handleToggleBasemap('map')}
                        >
                            Map
                        </button>
                        <button
                            className={`switcher-tab ${mapStyleMode === 'satellite' ? 'active' : ''}`}
                            onClick={() => handleToggleBasemap('satellite')}
                        >
                            Satellite
                        </button>
                    </div>

                    {/* 1. Doppler Radar Simulation Player (Rainfall mode) */}
                    {activeLayerFilter === 'rainfall' && (
                        <div className="radar-timeline-player-card">
                            <div className="radar-player-header">
                                <div className="player-title-col">
                                    <span className="player-tag">Doppler Radar Precipitation Simulation</span>
                                    <h4 className="player-time-heading">
                                        {RADAR_TIMELINE_STEPS[radarStepIndex]?.label} <span className="time-sub">({RADAR_TIMELINE_STEPS[radarStepIndex]?.timestamp})</span>
                                    </h4>
                                </div>
                                <span className="storm-desc-pill">{RADAR_TIMELINE_STEPS[radarStepIndex]?.description}</span>
                            </div>

                            <div className="radar-controls-row">
                                <button
                                    className={`playback-play-btn ${isRadarPlaying ? 'playing' : ''}`}
                                    onClick={() => setIsRadarPlaying(!isRadarPlaying)}
                                    title={isRadarPlaying ? "Pause Radar Simulation" : "Play Radar Simulation"}
                                >
                                    {isRadarPlaying ? <Pause size={18} /> : <Play size={18} fill="currentColor" />}
                                </button>

                                <div className="timeline-steps-track">
                                    {RADAR_TIMELINE_STEPS.map((st, idx) => (
                                        <button
                                            key={st.id}
                                            className={`timeline-step-btn ${radarStepIndex === idx ? 'active' : ''}`}
                                            onClick={() => handleSetRadarStep(idx)}
                                        >
                                            <span className="step-dot" />
                                            <span className="step-label">{st.label}</span>
                                        </button>
                                    ))}
                                </div>

                                <button
                                    className="playback-reset-btn"
                                    onClick={() => handleSetRadarStep(2)}
                                    title="Reset to Live Telemetry"
                                >
                                    <RotateCcw size={15} />
                                    <span>Live</span>
                                </button>
                            </div>

                            {/* Doppler Radar Gradient Legend */}
                            <div className="radar-gradient-legend">
                                <span className="legend-label">Radar (mm/h):</span>
                                <div className="legend-gradient-bar" />
                                <div className="legend-labels-row">
                                    <span>&lt;15 (Light)</span>
                                    <span>35 (Mod)</span>
                                    <span>65 (Heavy)</span>
                                    <span>85 (Torr)</span>
                                    <span>&gt;100 (Cloudburst)</span>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* 2. Hooghly River Tidal Surge & Drainage Lock Gate Player (Water Level mode) */}
                    {activeLayerFilter === 'water' && (
                        <div className="radar-timeline-player-card tidal-player-theme">
                            <div className="radar-player-header">
                                <div className="player-title-col">
                                    <span className="player-tag text-cyan">Hooghly River Tidal Surge & Sluice Gate Simulation</span>
                                    <h4 className="player-time-heading">
                                        {TIDAL_TIMELINE_STEPS[tidalStepIndex]?.label} <span className="time-sub">({TIDAL_TIMELINE_STEPS[tidalStepIndex]?.timestamp})</span>
                                    </h4>
                                </div>
                                <span className="storm-desc-pill tidal-pill">
                                    {TIDAL_TIMELINE_STEPS[tidalStepIndex]?.sluice_mode} • {TIDAL_TIMELINE_STEPS[tidalStepIndex]?.description}
                                </span>
                            </div>

                            <div className="radar-controls-row">
                                <button
                                    className={`playback-play-btn ${isTidalPlaying ? 'playing' : ''}`}
                                    onClick={() => setIsTidalPlaying(!isTidalPlaying)}
                                    title={isTidalPlaying ? "Pause Tidal Simulation" : "Play Tidal Simulation"}
                                >
                                    {isTidalPlaying ? <Pause size={18} /> : <Play size={18} fill="currentColor" />}
                                </button>

                                <div className="timeline-steps-track">
                                    {TIDAL_TIMELINE_STEPS.map((st, idx) => (
                                        <button
                                            key={st.id}
                                            className={`timeline-step-btn ${tidalStepIndex === idx ? 'active' : ''}`}
                                            onClick={() => handleSetTidalStep(idx)}
                                        >
                                            <span className="step-dot" style={{ backgroundColor: st.river_color }} />
                                            <span className="step-label">{st.label}</span>
                                        </button>
                                    ))}
                                </div>

                                <button
                                    className="playback-reset-btn"
                                    onClick={() => handleSetTidalStep(2)}
                                    title="Reset to Live Tidal Stage"
                                >
                                    <RotateCcw size={15} />
                                    <span>Peak Surge</span>
                                </button>
                            </div>

                            <div className="radar-gradient-legend">
                                <span className="legend-label">Tide Level:</span>
                                <div className="legend-gradient-bar tidal-gradient-bar" />
                                <div className="legend-labels-row">
                                    <span>&lt;2.5m (Normal)</span>
                                    <span>3.2m (Moderate)</span>
                                    <span>3.8m (Warning)</span>
                                    <span>4.5m (High)</span>
                                    <span>&gt;4.8m (Critical Surge)</span>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* 3. Arterial Road Passability & Detour Monitor (Roads mode) */}
                    {activeLayerFilter === 'roads' && (
                        <div className="radar-timeline-player-card roads-player-theme">
                            <div className="radar-player-header">
                                <div className="player-title-col">
                                    <span className="player-tag text-amber">Kolkata Arterial Traffic & Flood Submergence Monitor</span>
                                    <h4 className="player-time-heading">
                                        12 Arterials Monitored <span className="time-sub">• 3 Submerged • 4 Waterlogged • 5 Passable</span>
                                    </h4>
                                </div>
                                <span className="storm-desc-pill roads-pill">
                                    ⚠️ Avoid Diamond Harbour Rd & Strand Rd; Divert via AJC Bose Flyover & Kona Expressway
                                </span>
                            </div>

                            <div className="radar-gradient-legend" style={{ marginTop: '8px' }}>
                                <span className="legend-label">Water Depth:</span>
                                <div className="legend-gradient-bar roads-gradient-bar" />
                                <div className="legend-labels-row">
                                    <span>&lt;5cm (Passable)</span>
                                    <span>5–15cm (Caution)</span>
                                    <span>15–30cm (Waterlogged)</span>
                                    <span>&gt;30cm (Submerged / Closed)</span>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* 4. Heatmap Condition & Density Controller (Heatmap mode) */}
                    {activeLayerFilter === 'heatmap' && (
                        <div className="radar-timeline-player-card heatmap-player-theme">
                            <div className="radar-player-header">
                                <div className="player-title-col">
                                    <span className="player-tag text-orange">Gaussian KDE Density & Condition Controller</span>
                                    <h4 className="player-time-heading">
                                        Condition: {HEATMAP_CONDITIONS[activeHeatmapCondition]?.label} <span className="time-sub">({filteredHotspots.length} Monitored Hotspots)</span>
                                    </h4>
                                </div>
                                <div className="heatmap-quick-condition-pills">
                                    {Object.values(HEATMAP_CONDITIONS).map(c => (
                                        <button
                                            key={c.key}
                                            className={`cond-quick-btn ${activeHeatmapCondition === c.key ? 'active' : ''}`}
                                            onClick={() => handleSwitchHeatmapCondition(c.key)}
                                        >
                                            <span>{c.icon}</span>
                                            <span>{c.label.split(' ')[0]}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="radar-gradient-legend" style={{ marginTop: '8px' }}>
                                <span className="legend-label">KDE Density:</span>
                                <div className="legend-gradient-bar heatmap-density-gradient-bar" />
                                <div className="legend-labels-row">
                                    <span>0.1 (Low Risk)</span>
                                    <span>0.35 (Moderate)</span>
                                    <span>0.65 (High Alert)</span>
                                    <span>0.85 (Critical Inundation)</span>
                                    <span>1.0 (Peak Danger)</span>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* 5. City-wide Multi-Hazard Command Bar (All Layers mode) */}
                    {activeLayerFilter === 'all' && (
                        <div className="radar-timeline-player-card all-player-theme">
                            <div className="radar-player-header">
                                <div className="player-title-col">
                                    <span className="player-tag text-blue">City-wide Multi-Hazard Integrated Command</span>
                                    <h4 className="player-time-heading">
                                        Kolkata Municipal Corporation (KMC) Nowcasting Overview
                                    </h4>
                                </div>
                                <div className="all-command-quick-metrics">
                                    <span className="metric-chip">🌧️ Rain: 82.4mm Avg</span>
                                    <span className="metric-chip">🌊 Hooghly: 4.85m Peak</span>
                                    <span className="metric-chip">🚗 Roads: 3 Submerged</span>
                                    <span className="metric-chip">🏛️ Wards: 141 Monitored</span>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Right Telemetry & Forecast Dashboard */}
                <aside className="telemetry-sidebar-aside">
                    {/* Unified Top Sidebar Mode Switcher Tab */}
                    <div className="sidebar-tab-switcher">
                        <button
                            className={`sidebar-tab-btn ${sidebarTab === 'dedicated' ? 'active' : ''}`}
                            onClick={() => setSidebarTab('dedicated')}
                        >
                            {activeLayerFilter === 'rainfall' ? (
                                <>
                                    <CloudRain size={14} />
                                    <span>AWS Rain Gauges</span>
                                </>
                            ) : activeLayerFilter === 'water' ? (
                                <>
                                    <Waves size={14} />
                                    <span>Water Levels & Drainage</span>
                                </>
                            ) : activeLayerFilter === 'roads' ? (
                                <>
                                    <Car size={14} />
                                    <span>Roads & Passability</span>
                                </>
                            ) : activeLayerFilter === 'heatmap' ? (
                                <>
                                    <Flame size={14} />
                                    <span>Heatmap Hotspots</span>
                                </>
                            ) : (
                                <>
                                    <Layers size={14} />
                                    <span>City Command</span>
                                </>
                            )}
                        </button>
                        <button
                            className={`sidebar-tab-btn ${sidebarTab === 'flood' ? 'active' : ''}`}
                            onClick={() => setSidebarTab('flood')}
                        >
                            <span>🌊 Flood Prediction</span>
                        </button>
                    </div>

                    {sidebarTab === 'dedicated' ? (
                        <>
                            {/* A. RAINFALL PANEL */}
                            {activeLayerFilter === 'rainfall' && (
                                <div className="rainfall-sidebar-panel">
                                    {/* 4 Mini KPI Summary Cards */}
                                    <div className="rainfall-mini-kpi-grid">
                                        <div className="mini-kpi-card">
                                            <span className="mini-kpi-lbl">24h City Avg</span>
                                            <span className="mini-kpi-val">82.4 mm</span>
                                        </div>
                                        <div className="mini-kpi-card">
                                            <span className="mini-kpi-lbl">Peak AWS</span>
                                            <span className="mini-kpi-val text-red">118.2 mm/h</span>
                                        </div>
                                        <div className="mini-kpi-card">
                                            <span className="mini-kpi-lbl">Active Gauges</span>
                                            <span className="mini-kpi-val">20 / 20</span>
                                        </div>
                                        <div className="mini-kpi-card">
                                            <span className="mini-kpi-lbl">IMD Alert</span>
                                            <span className="mini-kpi-val text-amber">Orange</span>
                                        </div>
                                    </div>

                                    {/* Search & Filter Bar */}
                                    <div className="station-search-box">
                                        <Search size={14} className="search-icon" />
                                        <input
                                            type="text"
                                            placeholder="Search rain gauge or ward..."
                                            value={rainStationSearch}
                                            onChange={(e) => setRainStationSearch(e.target.value)}
                                        />
                                    </div>

                                    <div className="station-filter-pills">
                                        <button
                                            className={`pill-btn ${rainStationFilter === 'all' ? 'active' : ''}`}
                                            onClick={() => setRainStationFilter('all')}
                                        >
                                            All (20)
                                        </button>
                                        <button
                                            className={`pill-btn text-red ${rainStationFilter === 'torrential' ? 'active' : ''}`}
                                            onClick={() => setRainStationFilter('torrential')}
                                        >
                                            Torrential (&gt;85)
                                        </button>
                                        <button
                                            className={`pill-btn text-orange ${rainStationFilter === 'heavy' ? 'active' : ''}`}
                                            onClick={() => setRainStationFilter('heavy')}
                                        >
                                            Heavy (65-85)
                                        </button>
                                        <button
                                            className={`pill-btn text-green ${rainStationFilter === 'moderate' ? 'active' : ''}`}
                                            onClick={() => setRainStationFilter('moderate')}
                                        >
                                            Moderate (&lt;65)
                                        </button>
                                    </div>

                                    {/* Active Selected Station Hero Card */}
                                    {selectedRainStation && (
                                        <div className="selected-station-hero-card">
                                            <div className="station-hero-header">
                                                <div>
                                                    <span className="station-ward-tag">{selectedRainStation.ward}</span>
                                                    <h4 className="station-name-lg">{selectedRainStation.name}</h4>
                                                </div>
                                                <span className={`status-badge-lg ${(selectedRainStation.alert || 'orange').toLowerCase()}`}>
                                                    {selectedRainStation.status}
                                                </span>
                                            </div>

                                            <div className="station-hero-rate">
                                                <div className="rate-num-col">
                                                    <span className="big-rate-val">{selectedRainStation.rainfall_rate}</span>
                                                    <span className="big-rate-unit">mm/h</span>
                                                </div>
                                                <div className="trend-badge">
                                                    <TrendingUp size={14} />
                                                    <span>{selectedRainStation.trend}</span>
                                                </div>
                                            </div>

                                            <div className="station-metrics-grid">
                                                <div className="metric-box">
                                                    <span className="m-label">24h Accumulation</span>
                                                    <span className="m-val">{selectedRainStation.accumulation_24h} mm</span>
                                                </div>
                                                <div className="metric-box">
                                                    <span className="m-label">Ambient Temp</span>
                                                    <span className="m-val">{selectedRainStation.temp_c} °C</span>
                                                </div>
                                                <div className="metric-box">
                                                    <span className="m-label">Relative Humidity</span>
                                                    <span className="m-val">{selectedRainStation.humidity} %</span>
                                                </div>
                                                <div className="metric-box">
                                                    <span className="m-label">IMD Warning</span>
                                                    <span className="m-val text-red">{selectedRainStation.alert} Level</span>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {/* Stations List */}
                                    <div className="stations-scroll-list">
                                        {filteredRainStations.map(st => (
                                            <div
                                                key={st.id}
                                                className={`station-list-card ${selectedRainStation?.id === st.id ? 'active' : ''}`}
                                                onClick={() => handleSelectRainStation(st)}
                                            >
                                                <div className="station-card-left">
                                                    <div className="pulse-rate-indicator" style={{
                                                        backgroundColor: st.rainfall_rate > 90 ? '#ef4444' : st.rainfall_rate > 70 ? '#f97316' : '#0284c7'
                                                    }} />
                                                    <div className="station-card-info">
                                                        <div className="st-name-row">
                                                            <span className="st-name">{st.name}</span>
                                                            <span className="st-ward">{st.ward}</span>
                                                        </div>
                                                        <div className="st-sub-row">
                                                            <span>24h Total: <strong>{st.accumulation_24h} mm</strong></span>
                                                            <span>•</span>
                                                            <span>{st.trend}</span>
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className="station-card-right">
                                                    <span className="st-rate-val">{st.rainfall_rate}</span>
                                                    <span className="st-rate-unit">mm/h</span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* B. WATER LEVEL & DRAINAGE NETWORK PANEL */}
                            {activeLayerFilter === 'water' && (
                                <div className="rainfall-sidebar-panel">
                                    <div className="rainfall-mini-kpi-grid">
                                        <div className="mini-kpi-card">
                                            <span className="mini-kpi-lbl">River Surge</span>
                                            <span className="mini-kpi-val text-cyan">4.85 m</span>
                                        </div>
                                        <div className="mini-kpi-card">
                                            <span className="mini-kpi-lbl">Pumps Active</span>
                                            <span className="mini-kpi-val text-green">42 / 46</span>
                                        </div>
                                        <div className="mini-kpi-card">
                                            <span className="mini-kpi-lbl">Canal Capacity</span>
                                            <span className="mini-kpi-val text-red">88%</span>
                                        </div>
                                        <div className="mini-kpi-card">
                                            <span className="mini-kpi-lbl">Lock Gates</span>
                                            <span className="mini-kpi-val text-red">14 Closed</span>
                                        </div>
                                    </div>

                                    <div className="station-search-box">
                                        <Search size={14} className="search-icon" />
                                        <input
                                            type="text"
                                            placeholder="Search pumping station or canal..."
                                            value={waterStationSearch}
                                            onChange={(e) => setWaterStationSearch(e.target.value)}
                                        />
                                    </div>

                                    <div className="station-filter-pills">
                                        <button
                                            className={`pill-btn ${waterStationFilter === 'all' ? 'active' : ''}`}
                                            onClick={() => setWaterStationFilter('all')}
                                        >
                                            All (10)
                                        </button>
                                        <button
                                            className={`pill-btn ${waterStationFilter === 'pumping_station' ? 'active' : ''}`}
                                            onClick={() => setWaterStationFilter('pumping_station')}
                                        >
                                            Pumping Stations
                                        </button>
                                        <button
                                            className={`pill-btn ${waterStationFilter === 'lock_gate' ? 'active' : ''}`}
                                            onClick={() => setWaterStationFilter('lock_gate')}
                                        >
                                            Lock Gates
                                        </button>
                                        <button
                                            className={`pill-btn ${waterStationFilter === 'river_gauge' ? 'active' : ''}`}
                                            onClick={() => setWaterStationFilter('river_gauge')}
                                        >
                                            River Gauges
                                        </button>
                                    </div>

                                    {selectedWaterStation && (
                                        <div className="selected-station-hero-card water-hero-theme">
                                            <div className="station-hero-header">
                                                <div>
                                                    <span className="station-ward-tag">{selectedWaterStation.ward} • {selectedWaterStation.type_label}</span>
                                                    <h4 className="station-name-lg">{selectedWaterStation.name}</h4>
                                                </div>
                                                <span className={`status-badge-lg ${(selectedWaterStation.alert || 'orange').toLowerCase()}`}>
                                                    {selectedWaterStation.status}
                                                </span>
                                            </div>

                                            <div className="station-hero-rate">
                                                <div className="rate-num-col">
                                                    <span className="big-rate-val text-cyan">{selectedWaterStation.water_level_m}</span>
                                                    <span className="big-rate-unit">m (Water Level)</span>
                                                </div>
                                                <div className="trend-badge">
                                                    <TrendingUp size={14} />
                                                    <span>{selectedWaterStation.trend}</span>
                                                </div>
                                            </div>

                                            <div className="station-metrics-grid">
                                                <div className="metric-box">
                                                    <span className="m-label">Basin Capacity</span>
                                                    <span className="m-val">{selectedWaterStation.capacity_pct}%</span>
                                                </div>
                                                <div className="metric-box">
                                                    <span className="m-label">Discharge Rate</span>
                                                    <span className="m-val text-cyan">{selectedWaterStation.discharge_rate}</span>
                                                </div>
                                                <div className="metric-box">
                                                    <span className="m-label">Pumps Online</span>
                                                    <span className="m-val">{selectedWaterStation.pumps_active}</span>
                                                </div>
                                                <div className="metric-box">
                                                    <span className="m-label">Outfall Canal</span>
                                                    <span className="m-val">{selectedWaterStation.outfall}</span>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    <div className="stations-scroll-list">
                                        {filteredWaterStations.map(st => (
                                            <div
                                                key={st.id}
                                                className={`station-list-card ${selectedWaterStation?.id === st.id ? 'active' : ''}`}
                                                onClick={() => handleSelectWaterStation(st)}
                                            >
                                                <div className="station-card-left">
                                                    <div className="pulse-rate-indicator" style={{
                                                        backgroundColor: st.alert === 'Red' ? '#ef4444' : st.alert === 'Orange' ? '#f97316' : '#0284c7'
                                                    }} />
                                                    <div className="station-card-info">
                                                        <div className="st-name-row">
                                                            <span className="st-name">{st.name}</span>
                                                            <span className="st-ward">{st.ward}</span>
                                                        </div>
                                                        <div className="st-sub-row">
                                                            <span>Capacity: <strong>{st.capacity_pct}%</strong></span>
                                                            <span>•</span>
                                                            <span>{st.discharge_rate}</span>
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className="station-card-right">
                                                    <span className="st-rate-val text-cyan">{st.water_level_m}</span>
                                                    <span className="st-rate-unit">m</span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* C. ROADS PASSABILITY & DETOUR PANEL */}
                            {activeLayerFilter === 'roads' && (
                                <div className="rainfall-sidebar-panel">
                                    <div className="rainfall-mini-kpi-grid">
                                        <div className="mini-kpi-card">
                                            <span className="mini-kpi-lbl">Submerged</span>
                                            <span className="mini-kpi-val text-red">3 Routes</span>
                                        </div>
                                        <div className="mini-kpi-card">
                                            <span className="mini-kpi-lbl">Avg Depth</span>
                                            <span className="mini-kpi-val text-amber">24.5 cm</span>
                                        </div>
                                        <div className="mini-kpi-card">
                                            <span className="mini-kpi-lbl">Traffic Speed</span>
                                            <span className="mini-kpi-val text-red">8 km/h</span>
                                        </div>
                                        <div className="mini-kpi-card">
                                            <span className="mini-kpi-lbl">Detours</span>
                                            <span className="mini-kpi-val text-blue">5 Advised</span>
                                        </div>
                                    </div>

                                    <div className="station-search-box">
                                        <Search size={14} className="search-icon" />
                                        <input
                                            type="text"
                                            placeholder="Search arterial road or detour..."
                                            value={roadSearch}
                                            onChange={(e) => setRoadSearch(e.target.value)}
                                        />
                                    </div>

                                    <div className="station-filter-pills">
                                        <button
                                            className={`pill-btn ${roadFilter === 'all' ? 'active' : ''}`}
                                            onClick={() => setRoadFilter('all')}
                                        >
                                            All (8)
                                        </button>
                                        <button
                                            className={`pill-btn text-red ${roadFilter === 'submerged' ? 'active' : ''}`}
                                            onClick={() => setRoadFilter('submerged')}
                                        >
                                            Submerged (&gt;30cm)
                                        </button>
                                        <button
                                            className={`pill-btn text-orange ${roadFilter === 'waterlogged' ? 'active' : ''}`}
                                            onClick={() => setRoadFilter('waterlogged')}
                                        >
                                            Waterlogged (15-30cm)
                                        </button>
                                        <button
                                            className={`pill-btn text-green ${roadFilter === 'passable' ? 'active' : ''}`}
                                            onClick={() => setRoadFilter('passable')}
                                        >
                                            Passable (&lt;15cm)
                                        </button>
                                    </div>

                                    {selectedRoad && (
                                        <div className="selected-station-hero-card roads-hero-theme">
                                            <div className="station-hero-header">
                                                <div>
                                                    <span className="station-ward-tag">{selectedRoad.ward} • {selectedRoad.zone}</span>
                                                    <h4 className="station-name-lg">{selectedRoad.name}</h4>
                                                </div>
                                                <span className={`status-badge-lg ${selectedRoad.status === 'Submerged' ? 'red' : selectedRoad.status.includes('Waterlogged') ? 'orange' : 'green'}`}>
                                                    {selectedRoad.status_label}
                                                </span>
                                            </div>

                                            <div className="station-hero-rate">
                                                <div className="rate-num-col">
                                                    <span className="big-rate-val text-red">{selectedRoad.water_depth_cm}</span>
                                                    <span className="big-rate-unit">cm (Water Depth)</span>
                                                </div>
                                                <div className="trend-badge">
                                                    <Car size={14} />
                                                    <span>{selectedRoad.traffic_speed}</span>
                                                </div>
                                            </div>

                                            <div className="station-metrics-grid">
                                                <div className="metric-box">
                                                    <span className="m-label">Transit State</span>
                                                    <span className="m-val text-red">{selectedRoad.transit_state}</span>
                                                </div>
                                                <div className="metric-box">
                                                    <span className="m-label">Clearance ETA</span>
                                                    <span className="m-val">{selectedRoad.clearance_eta}</span>
                                                </div>
                                                <div className="metric-box" style={{ gridColumn: 'span 2' }}>
                                                    <span className="m-label">Recommended Detour</span>
                                                    <span className="m-val text-blue">↪ {selectedRoad.detour_route}</span>
                                                </div>
                                            </div>

                                            <div className="road-advisory-note">
                                                <strong>Police Advisory:</strong> {selectedRoad.advisory}
                                            </div>
                                        </div>
                                    )}

                                    <div className="stations-scroll-list">
                                        {filteredRoads.map(r => (
                                            <div
                                                key={r.id}
                                                className={`station-list-card ${selectedRoad?.id === r.id ? 'active' : ''}`}
                                                onClick={() => handleSelectRoad(r)}
                                            >
                                                <div className="station-card-left">
                                                    <div className="pulse-rate-indicator" style={{
                                                        backgroundColor: r.color
                                                    }} />
                                                    <div className="station-card-info">
                                                        <div className="st-name-row">
                                                            <span className="st-name">{r.name}</span>
                                                            <span className="st-ward">{r.ward}</span>
                                                        </div>
                                                        <div className="st-sub-row">
                                                            <span>Speed: <strong>{r.traffic_speed}</strong></span>
                                                            <span>•</span>
                                                            <span>{r.clearance_eta}</span>
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className="station-card-right">
                                                    <span className="st-rate-val" style={{ color: r.color }}>{r.water_depth_cm}</span>
                                                    <span className="st-rate-unit">cm depth</span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* D. HEATMAP HOTSPOTS PANEL */}
                            {activeLayerFilter === 'heatmap' && (
                                <div className="rainfall-sidebar-panel">
                                    <div className="rainfall-mini-kpi-grid">
                                        <div className="mini-kpi-card">
                                            <span className="mini-kpi-lbl">Peak Risk</span>
                                            <span className="mini-kpi-val text-red">0.94</span>
                                        </div>
                                        <div className="mini-kpi-card">
                                            <span className="mini-kpi-lbl">Nodes</span>
                                            <span className="mini-kpi-val text-orange">{filteredHotspots.length}</span>
                                        </div>
                                        <div className="mini-kpi-card">
                                            <span className="mini-kpi-lbl">High Wards</span>
                                            <span className="mini-kpi-val text-amber">14</span>
                                        </div>
                                        <div className="mini-kpi-card">
                                            <span className="mini-kpi-lbl">Confidence</span>
                                            <span className="mini-kpi-val text-green">94.8%</span>
                                        </div>
                                    </div>

                                    <div className="station-search-box">
                                        <Search size={14} className="search-icon" />
                                        <input
                                            type="text"
                                            placeholder="Search hotspot node or ward..."
                                            value={hotspotSearch}
                                            onChange={(e) => setHotspotSearch(e.target.value)}
                                        />
                                    </div>

                                    <div className="station-filter-pills">
                                        <button
                                            className={`pill-btn ${hotspotFilter === 'all' ? 'active' : ''}`}
                                            onClick={() => setHotspotFilter('all')}
                                        >
                                            All ({heatmapHotspotsList.length})
                                        </button>
                                        <button
                                            className={`pill-btn text-red ${hotspotFilter === 'critical' ? 'active' : ''}`}
                                            onClick={() => setHotspotFilter('critical')}
                                        >
                                            Critical (&gt;85%)
                                        </button>
                                        <button
                                            className={`pill-btn text-orange ${hotspotFilter === 'high' ? 'active' : ''}`}
                                            onClick={() => setHotspotFilter('high')}
                                        >
                                            High (65-85%)
                                        </button>
                                        <button
                                            className={`pill-btn text-green ${hotspotFilter === 'moderate' ? 'active' : ''}`}
                                            onClick={() => setHotspotFilter('moderate')}
                                        >
                                            Moderate (&lt;65%)
                                        </button>
                                    </div>

                                    {selectedHotspot && (
                                        <div className="selected-station-hero-card">
                                            <div className="station-hero-header">
                                                <div>
                                                    <span className="station-ward-tag">{selectedHotspot.ward}</span>
                                                    <h4 className="station-name-lg">{selectedHotspot.name}</h4>
                                                </div>
                                                <span className={`status-badge-lg ${selectedHotspot.weight > 0.85 ? 'red' : 'orange'}`}>
                                                    {Math.round(selectedHotspot.weight * 100)}% Risk
                                                </span>
                                            </div>

                                            <div className="station-metrics-grid">
                                                <div className="metric-box">
                                                    <span className="m-label">Active Condition</span>
                                                    <span className="m-val">{HEATMAP_CONDITIONS[activeHeatmapCondition]?.label}</span>
                                                </div>
                                                <div className="metric-box">
                                                    <span className="m-label">Model KDE Weight</span>
                                                    <span className="m-val text-orange">{(selectedHotspot.weight || 0).toFixed(2)}</span>
                                                </div>
                                                <div className="metric-box">
                                                    <span className="m-label">Terrain Elevation</span>
                                                    <span className="m-val">{selectedHotspot.elevation || '4.2m ASL'}</span>
                                                </div>
                                                <div className="metric-box">
                                                    <span className="m-label">Drainage Capacity</span>
                                                    <span className="m-val">{selectedHotspot.drainage || 'Bottleneck Basin'}</span>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    <div className="stations-scroll-list">
                                        {filteredHotspots.map(h => (
                                            <div
                                                key={h.id}
                                                className={`station-list-card ${selectedHotspot?.id === h.id ? 'active' : ''}`}
                                                onClick={() => handleSelectHotspot(h)}
                                            >
                                                <div className="station-card-left">
                                                    <div className="pulse-rate-indicator" style={{
                                                        backgroundColor: h.weight > 0.85 ? '#ef4444' : h.weight > 0.65 ? '#f97316' : '#22c55e'
                                                    }} />
                                                    <div className="station-card-info">
                                                        <div className="st-name-row">
                                                            <span className="st-name">{h.name}</span>
                                                            <span className="st-ward">{h.ward}</span>
                                                        </div>
                                                        <div className="st-sub-row">
                                                            <span>Density: <strong>{Math.round(h.weight * 100)}%</strong></span>
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className="station-card-right">
                                                    <span className="st-rate-val text-orange">{Math.round(h.weight * 100)}%</span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* E. ALL LAYERS MULTI-HAZARD COMMAND PANEL */}
                            {activeLayerFilter === 'all' && (
                                <div className="rainfall-sidebar-panel">
                                    <div className="multi-hazard-overview-banner">
                                        <div className="banner-title-row">
                                            <ShieldAlert size={18} className="text-red" />
                                            <h4>KMC Multi-Hazard Integrated Command</h4>
                                        </div>
                                        <p>Real-time composite telemetry across rainfall, Hooghly tidal surge, road passability, and civic vulnerability.</p>
                                    </div>

                                    <div className="multi-hazard-domain-grid">
                                        {MULTI_HAZARD_DOMAINS.map(d => (
                                            <div key={d.id} className="multi-hazard-domain-card">
                                                <div className="domain-card-header">
                                                    <div className="domain-title-left">
                                                        <span className="domain-icon">{d.icon}</span>
                                                        <div>
                                                            <h5 className="domain-name">{d.title}</h5>
                                                            <span className="domain-count">{d.active_count}</span>
                                                        </div>
                                                    </div>
                                                    <span className={`domain-alert-badge ${d.severity}`}>
                                                        {d.badge}
                                                    </span>
                                                </div>

                                                <div className="domain-metric-row">
                                                    <span className="domain-metric-val">{d.metric}</span>
                                                    <span className="domain-subtext">{d.subtext}</span>
                                                </div>

                                                <button
                                                    className="domain-inspect-btn"
                                                    onClick={() => handleLayerPillClick(d.id === 'vulnerability' ? 'heatmap' : d.id)}
                                                >
                                                    <span>Inspect Layer</span>
                                                    <ArrowRight size={13} />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </>
                    ) : (
                        <FloodTelemetryPanel
                            locationResult={locationPrediction}
                            activeWardName={selectedWard.name}
                            coordinates={{ lat: selectedWard.coords[1], lng: selectedWard.coords[0] }}
                            loading={locationLoading}
                            isInsideKMC={isInsideKMC}
                        />
                    )}
                </aside>
            </main>

            {/* Bottom Status Footer */}
            <footer className="flood-monitor-footer">
                <div className="footer-left">
                    <span className="footer-brand">PRABAH</span> — Flood Risk Monitor
                    <span className="footer-sep">|</span>
                    <span className="footer-sources">Data Sources: IMD, CWC, Local Authorities</span>
                </div>
                <div className="footer-right">
                    <span>Stay Safe, Stay Informed</span>
                    <span className="footer-shield">🛡️</span>
                </div>
            </footer>
        </div>
    );
}