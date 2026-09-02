import { useEffect, useRef, useState, useCallback } from "react";
import { Map, Marker, Popup, setWorkerUrl } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';
import api from '../services/api';
import FloodTelemetryPanel from '../components/map/FloodTelemetryPanel.jsx';
import {
    FLOOD_HEATMAP_GEOJSON,
    RAINFALL_LAYER_GEOJSON,
    WATER_LEVEL_LAYER_GEOJSON,
    ROADS_LAYER_GEOJSON,
    CRITICAL_WARNING_POINTS,
    HOOGHLY_RIVER_GEOJSON
} from '../data/floodHeatmapData.js';
import { Search, Layers, CloudRain, Waves, Compass, Plus, Minus, Navigation } from 'lucide-react';
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

export default function MapPage() {
    const mapContainer = useRef(null);
    const mapRef = useRef(null);
    const userLocationMarkerRef = useRef(null);
    const warningMarkersRef = useRef([]);
    const roadPopupRef = useRef(null);

    // Map & Style States
    const [mapStyleMode, setMapStyleMode] = useState('map'); // 'map' | 'satellite'

    // Layer Filter Pills: 'all' | 'rainfall' | 'water' | 'roads'
    const [activeLayerFilter, setActiveLayerFilter] = useState('all');

    // Search state
    const [searchQuery, setSearchQuery] = useState('');
    const [isSearchOpen, setIsSearchOpen] = useState(false);

    // Selected Location state (Default: Behala Ward 120)
    const [selectedWard, setSelectedWard] = useState({
        id: '120',
        name: 'Behala (Ward 120)',
        zone: 'Central East',
        coords: [88.3100, 22.4900]
    });

    const [locationPrediction, setLocationPrediction] = useState(null);
    const [locationLoading, setLocationLoading] = useState(false);

    // Monitored Wards list for search autocomplete
    const monitoredWards = [
        { id: '120', name: 'Behala (Ward 120)', zone: 'Central East', coords: [88.3100, 22.4900] },
        { id: '63', name: 'Park Street / Chowringhee', zone: 'Central', coords: [88.3580, 22.5535] },
        { id: '45', name: 'Howrah Strand / BBD Bagh', zone: 'North Central', coords: [88.3490, 22.5730] },
        { id: '96', name: 'Jadavpur Central', zone: 'South', coords: [88.3685, 22.4980] },
        { id: '94', name: 'Tollygunge (Ward 94)', zone: 'South', coords: [88.3530, 22.5020] },
        { id: '1', name: 'Dum Dum / Cossipore', zone: 'North', coords: [88.3693, 22.6294] },
        { id: '10', name: 'Shyambazar / Hatibagan', zone: 'North', coords: [88.3694, 22.5993] },
        { id: '31', name: 'Kankurgachi / Phoolbagan', zone: 'East', coords: [88.3900, 22.5750] },
        { id: '107', name: 'EM Bypass / Ruby Corridor', zone: 'South East', coords: [88.4010, 22.5120] },
        { id: '133', name: 'Garden Reach / Metiabruz', zone: 'South West', coords: [88.2900, 22.5300] }
    ];

    const filteredWards = monitoredWards.filter(w =>
        w.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        w.zone.toLowerCase().includes(searchQuery.toLowerCase()) ||
        String(w.id).includes(searchQuery)
    );

    // Register all thematic layers on MapLibre instance
    const registerAllThematicLayers = useCallback((map) => {
        if (!map) return;

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

        // 2. Chromatic Flood Risk Heatmap Polygons
        if (!map.getSource('flood-heatmap-source')) {
            map.addSource('flood-heatmap-source', {
                type: 'geojson',
                data: FLOOD_HEATMAP_GEOJSON
            });
        }
        if (!map.getLayer('flood-heatmap-fill')) {
            map.addLayer({
                id: 'flood-heatmap-fill',
                type: 'fill',
                source: 'flood-heatmap-source',
                paint: {
                    'fill-color': ['get', 'color'],
                    'fill-opacity': ['get', 'fillOpacity'],
                }
            });
        }
        if (!map.getLayer('flood-heatmap-outline')) {
            map.addLayer({
                id: 'flood-heatmap-outline',
                type: 'line',
                source: 'flood-heatmap-source',
                paint: {
                    'line-color': ['get', 'color'],
                    'line-width': 1.5,
                    'line-opacity': 0.9
                }
            });
        }

        // 3. Real-Time Rainfall Isohyets Layer
        if (!map.getSource('rainfall-layer-source')) {
            map.addSource('rainfall-layer-source', {
                type: 'geojson',
                data: RAINFALL_LAYER_GEOJSON
            });
        }
        if (!map.getLayer('rainfall-layer-fill')) {
            map.addLayer({
                id: 'rainfall-layer-fill',
                type: 'fill',
                source: 'rainfall-layer-source',
                paint: {
                    'fill-color': ['get', 'color'],
                    'fill-opacity': ['get', 'fillOpacity']
                }
            });
        }
        if (!map.getLayer('rainfall-layer-outline')) {
            map.addLayer({
                id: 'rainfall-layer-outline',
                type: 'line',
                source: 'rainfall-layer-source',
                paint: {
                    'line-color': ['get', 'color'],
                    'line-width': 2.5,
                    'line-dasharray': [4, 2]
                }
            });
        }

        // 4. Water Level & River Surge Layer
        if (!map.getSource('water-level-layer-source')) {
            map.addSource('water-level-layer-source', {
                type: 'geojson',
                data: WATER_LEVEL_LAYER_GEOJSON
            });
        }
        if (!map.getLayer('water-level-fill')) {
            map.addLayer({
                id: 'water-level-fill',
                type: 'fill',
                source: 'water-level-layer-source',
                filter: ['==', '$type', 'Polygon'],
                paint: {
                    'fill-color': ['get', 'color'],
                    'fill-opacity': 0.70
                }
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

        if (filter === 'all') {
            // Show all layers harmoniously
            setVis('hooghly-river-line', true);
            setVis('flood-heatmap-fill', true);
            setVis('flood-heatmap-outline', true);
            setVis('rainfall-layer-fill', true);
            setVis('rainfall-layer-outline', true);
            setVis('water-level-fill', true);
            setVis('water-level-lines', true);
            setVis('roads-casing', true);
            setVis('roads-passability-line', true);
            warningMarkersRef.current.forEach(m => m.getElement().style.display = 'block');
        } else if (filter === 'rainfall') {
            // Isolate Rainfall Isohyet Contours
            setVis('hooghly-river-line', true);
            setVis('flood-heatmap-fill', false);
            setVis('flood-heatmap-outline', false);
            setVis('rainfall-layer-fill', true);
            setVis('rainfall-layer-outline', true);
            setVis('water-level-fill', false);
            setVis('water-level-lines', false);
            setVis('roads-casing', false);
            setVis('roads-passability-line', false);
            warningMarkersRef.current.forEach(m => m.getElement().style.display = 'none');
        } else if (filter === 'water') {
            // Isolate Water Level & River Surge Layer
            setVis('hooghly-river-line', true);
            setVis('flood-heatmap-fill', false);
            setVis('flood-heatmap-outline', false);
            setVis('rainfall-layer-fill', false);
            setVis('rainfall-layer-outline', false);
            setVis('water-level-fill', true);
            setVis('water-level-lines', true);
            setVis('roads-casing', false);
            setVis('roads-passability-line', false);
            warningMarkersRef.current.forEach(m => m.getElement().style.display = 'block');
        } else if (filter === 'roads') {
            // Isolate Road Passability Network
            setVis('hooghly-river-line', false);
            setVis('flood-heatmap-fill', false);
            setVis('flood-heatmap-outline', false);
            setVis('rainfall-layer-fill', false);
            setVis('rainfall-layer-outline', false);
            setVis('water-level-fill', false);
            setVis('water-level-lines', false);
            setVis('roads-casing', true);
            setVis('roads-passability-line', true);
            warningMarkersRef.current.forEach(m => m.getElement().style.display = 'none');
        }
    }, []);

    // Handle Layer Pill Button Clicks
    const handleLayerPillClick = (filterKey) => {
        setActiveLayerFilter(filterKey);
        applyLayerVisibilities(filterKey);
    };

    // Location selection handler
    const handleSelectLocation = useCallback(async (lat, lng, wardId, wardName) => {
        setLocationLoading(true);
        const resolvedWardId = wardId || '120';
        const resolvedName = wardName || `Location (${lat.toFixed(4)}°N, ${lng.toFixed(4)}°E)`;

        setSelectedWard({
            id: String(resolvedWardId),
            name: resolvedName,
            zone: 'Central East',
            coords: [lng, lat]
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
                            {filteredWards.map(w => (
                                <div
                                    key={w.id}
                                    className="search-dropdown-item"
                                    onClick={() => {
                                        handleSelectLocation(w.coords[1], w.coords[0], w.id, w.name);
                                        setSearchQuery(w.name);
                                        setIsSearchOpen(false);
                                    }}
                                >
                                    <span className="item-pin">📍</span>
                                    <div className="item-text">
                                        <span className="item-name">{w.name}</span>
                                        <span className="item-sub">{w.zone} Zone • Ward {w.id}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* 4 Thematic Layer Toggle Filter Pills */}
                <div className="top-layer-pills-row">
                    <button
                        className={`layer-pill-btn ${activeLayerFilter === 'all' ? 'active' : ''}`}
                        onClick={() => handleLayerPillClick('all')}
                        title="Display all layers (Rainfall, Water Level, Roads, Heatmaps)"
                    >
                        <Layers size={15} />
                        <span>All Layers</span>
                    </button>

                    <button
                        className={`layer-pill-btn ${activeLayerFilter === 'rainfall' ? 'active' : ''}`}
                        onClick={() => handleLayerPillClick('rainfall')}
                        title="Isolate real-time rainfall precipitation contours"
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
                            Active Layer: <strong>
                                {activeLayerFilter === 'all' ? 'All Thematic Layers' :
                                 activeLayerFilter === 'rainfall' ? 'Rainfall Isohyets (mm)' :
                                 activeLayerFilter === 'water' ? 'Water Levels & Inundation' :
                                 'Road Network Passability'}
                            </strong>
                        </span>
                    </div>

                    {/* Top-Left Custom Zoom & Locate Floating Card */}
                    <div className="map-zoom-controls-floating">
                        <button onClick={handleZoomIn} title="Zoom In" aria-label="Zoom In">
                            <Plus size={18} />
                        </button>
                        <div className="control-divider" />
                        <button onClick={handleZoomOut} title="Zoom Out" aria-label="Zoom Out">
                            <Minus size={18} />
                        </button>
                        <div className="control-divider" />
                        <button onClick={handleLocateMe} title="Center on My Location" aria-label="My Location">
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
                </div>

                {/* Right Telemetry & Forecast Dashboard */}
                <aside className="telemetry-sidebar-aside">
                    <FloodTelemetryPanel
                        locationResult={locationPrediction}
                        activeWardName={selectedWard.name}
                        coordinates={{ lat: selectedWard.coords[1], lng: selectedWard.coords[0] }}
                        loading={locationLoading}
                    />
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