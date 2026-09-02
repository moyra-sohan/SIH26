import { useEffect, useRef, useState, useCallback } from "react";
import { Map, NavigationControl, FullscreenControl, ScaleControl, Marker, setWorkerUrl } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';
import api from '../services/api';
import { useAuth } from '../context/AuthContext.jsx';
import FilterBox from '../components/map/FilterBox.jsx';
import LocationPredictionCard from '../components/map/LocationPredictionCard.jsx';
import { getCityBoundary } from '../data/cityBoundaries.js';
import "../styles/map.css";

setWorkerUrl(workerUrl);

// OpenFreeMap Positron Style URL (clean, light, global vector basemap)
const OPENFREEMAP_POSITRON_URL = 'https://tiles.openfreemap.org/styles/positron';

// Fallback clean Positron style if network is slow/offline
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
        { id: "background", type: "background", paint: { "background-color": "#f8f9fa" } },
        { id: "water", type: "fill", source: "openmaptiles", "source-layer": "water", paint: { "fill-color": "#dbeafe" } },
        { id: "waterway", type: "line", source: "openmaptiles", "source-layer": "waterway", paint: { "line-color": "#93c5fd" } },
        { id: "highway_minor", type: "line", source: "openmaptiles", "source-layer": "transportation", paint: { "line-color": "#e2e8f0", "line-width": 1.2 } },
        { id: "highway_major", type: "line", source: "openmaptiles", "source-layer": "transportation", paint: { "line-color": "#cbd5e1", "line-width": 2.5 } }
    ]
};

// Helper: Filter out generic POI pins and small place labels from basemap
function filterBasemapClutter(rawStyle) {
    if (!rawStyle || !rawStyle.layers) return rawStyle;

    const filteredLayers = rawStyle.layers.filter((layer) => {
        const id = layer.id || '';
        if (
            id.startsWith('poi') ||
            id.startsWith('label_village') ||
            id.startsWith('label_other') ||
            id.startsWith('label_country') ||
            id.startsWith('label_state') ||
            id.startsWith('aeroway') ||
            id === 'airport' ||
            id.startsWith('road_shield')
        ) {
            return false;
        }
        return true;
    });

    return {
        ...rawStyle,
        layers: filteredLayers
    };
}

export default function MapPage() {
    const { user } = useAuth();
    const mapContainer = useRef(null);
    const mapRef = useRef(null);

    // Active City Boundary Configuration
    const [activeCity] = useState('kolkata');

    // Dedicated marker for user's registered address location
    const userLocationMarkerRef = useRef(null);

    // Database / Knowledge states
    const [roadsData, setRoadsData] = useState([]);
    const [drainsData, setDrainsData] = useState([]);
    const [landscapeData, setLandscapeData] = useState([]);
    const [allForecasts, setAllForecasts] = useState([]);

    // Filter states
    const [cityRainfall] = useState(82.0);

    // 4 Thematic Layer Checkboxes (Drainage, Roads, Landscape, Water)
    const [layerToggles, setLayerToggles] = useState({
        showDrainage: true,
        showRoads: true,
        showLandscape: true,
        showWater: true,
    });

    // Single active selected registered user location
    const [selectedWardId, setSelectedWardId] = useState('120');
    const [locationPrediction, setLocationPrediction] = useState(null);
    const [locationLoading, setLocationLoading] = useState(false);
    const [matchedRoad, setMatchedRoad] = useState(null);
    const [matchedDrain, setMatchedDrain] = useState(null);
    const [matchedLandscape, setMatchedLandscape] = useState(null);
    const [matchedForecast, setMatchedForecast] = useState(null);

    // Resolve Registered User Location Coordinates and Address
    const getRegisteredLocationInfo = useCallback(() => {
        // Parse user address from auth profile or default to registered ward 120 (Behala)
        const userArea = user?.area || user?.address || (typeof user?.address === 'object' ? user.address.area || user.address.street : '') || 'Behala';
        const userStreet = typeof user?.address === 'object' ? `${user.address.houseNo || ''} ${user.address.street || ''}`.trim() : '';

        // Match with known Kolkata coordinates or fallback to central Behala
        const areaLower = String(userArea).toLowerCase();
        let targetCoords = [88.3100, 22.4900]; // Default Behala Ward 120
        let targetWard = 120;
        let targetName = userStreet ? `${userStreet}, ${userArea}` : `${userArea} (Registered Address)`;

        if (areaLower.includes('dum dum') || areaLower.includes('airport')) {
            targetCoords = [88.3693, 22.6294]; targetWard = 1; targetName = 'Dum Dum / Cossipore Corridor';
        } else if (areaLower.includes('park street') || areaLower.includes('central')) {
            targetCoords = [88.3580, 22.5535]; targetWard = 63; targetName = 'Park Street / Chowringhee Core';
        } else if (areaLower.includes('jadavpur')) {
            targetCoords = [88.3685, 22.4980]; targetWard = 96; targetName = 'Jadavpur Central';
        } else if (areaLower.includes('tollygunge')) {
            targetCoords = [88.3530, 22.5020]; targetWard = 94; targetName = 'Tollygunge Ward 94';
        } else if (areaLower.includes('alipore') || areaLower.includes('chetla')) {
            targetCoords = [88.3360, 22.5320]; targetWard = 74; targetName = 'Alipore / Chetla';
        } else if (areaLower.includes('shyambazar') || areaLower.includes('hatibagan')) {
            targetCoords = [88.3694, 22.5993]; targetWard = 10; targetName = 'Shyambazar / Hatibagan';
        } else if (areaLower.includes('howrah') || areaLower.includes('strand') || areaLower.includes('bbd')) {
            targetCoords = [88.3490, 22.5730]; targetWard = 45; targetName = 'BBD Bagh / Strand Road';
        } else if (areaLower.includes('ruby') || areaLower.includes('bypass') || areaLower.includes('em bypass')) {
            targetCoords = [88.4010, 22.5120]; targetWard = 107; targetName = 'EM Bypass / Ruby Corridor';
        }

        return { coords: targetCoords, wardId: targetWard, displayName: targetName, rawArea: userArea };
    }, [user]);

    // Register Official DOTTED RED Kolkata Boundary & 4 Thematic Overlay Layers
    const registerThematicLayers = useCallback((map) => {
        if (!map) return;

        const cityConfig = getCityBoundary(activeCity);

        // 1. OFFICIAL KOLKATA (KMC) DOTTED RED BOUNDARY
        if (!map.getSource('city-boundary-source')) {
            map.addSource('city-boundary-source', {
                type: 'geojson',
                data: cityConfig.geoJson
            });
        }

        // DOTTED RED OUTLINE LAYER
        if (!map.getLayer('city-boundary-line')) {
            map.addLayer({
                id: 'city-boundary-line',
                type: 'line',
                source: 'city-boundary-source',
                paint: {
                    'line-color': '#2563eb',
                    'line-width': 2.5,
                    'line-opacity': 0.8
                }
            });
        }

        // Soft subtle red basin fill
        if (!map.getLayer('city-boundary-fill')) {
            map.addLayer({
                id: 'city-boundary-fill',
                type: 'fill',
                source: 'city-boundary-source',
                paint: {
                    'fill-color': '#3b82f6',
                    'fill-opacity': 0.04
                }
            });
        }

        // Outer glow effect for the boundary
        if (!map.getLayer('city-boundary-glow')) {
            map.addLayer({
                id: 'city-boundary-glow',
                type: 'line',
                source: 'city-boundary-source',
                paint: {
                    'line-color': '#60a5fa',
                    'line-width': 6,
                    'line-opacity': 0.12,
                    'line-blur': 4
                }
            });
        }

        // 2. DRAINAGE NETWORK LAYER (Teal #06b6d4)
        if (!map.getSource('thematic-drainage-source')) {
            map.addSource('thematic-drainage-source', {
                type: 'geojson',
                data: { type: 'FeatureCollection', features: [] }
            });
        }
        if (!map.getLayer('thematic-drainage-lines')) {
            map.addLayer({
                id: 'thematic-drainage-lines',
                type: 'line',
                source: 'thematic-drainage-source',
                filter: ['==', '$type', 'LineString'],
                paint: {
                    'line-color': '#06b6d4',
                    'line-width': 3,
                    'line-dasharray': [3, 2]
                }
            });
        }
        if (!map.getLayer('thematic-drainage-points')) {
            map.addLayer({
                id: 'thematic-drainage-points',
                type: 'circle',
                source: 'thematic-drainage-source',
                filter: ['==', '$type', 'Point'],
                paint: {
                    'circle-radius': 7,
                    'circle-color': '#06b6d4',
                    'circle-stroke-width': 2,
                    'circle-stroke-color': '#ffffff'
                }
            });
        }

        // 3. ROADS BY PASSABILITY STATUS LAYER
        if (!map.getSource('thematic-roads-source')) {
            map.addSource('thematic-roads-source', {
                type: 'geojson',
                data: { type: 'FeatureCollection', features: [] }
            });
        }
        if (!map.getLayer('thematic-roads-casing')) {
            map.addLayer({
                id: 'thematic-roads-casing',
                type: 'line',
                source: 'thematic-roads-source',
                paint: {
                    'line-color': '#ffffff',
                    'line-width': 7,
                    'line-opacity': 0.85
                }
            });
        }
        if (!map.getLayer('thematic-roads-line')) {
            map.addLayer({
                id: 'thematic-roads-line',
                type: 'line',
                source: 'thematic-roads-source',
                paint: {
                    'line-color': [
                        'match',
                        ['get', 'status'],
                        'Clear / Passable', '#059669',
                        'Minor Waterlogging', '#d97706',
                        'Severe Waterlogging', '#ea580c',
                        'Submerged', '#dc2626',
                        '#d97706'
                    ],
                    'line-width': 4
                }
            });
        }

        // 4. WATER ZONES & CANALS LAYER (Distinct Blue #3b82f6)
        if (!map.getSource('thematic-water-source')) {
            map.addSource('thematic-water-source', {
                type: 'geojson',
                data: { type: 'FeatureCollection', features: [] }
            });
        }
        if (!map.getLayer('thematic-water-lines')) {
            map.addLayer({
                id: 'thematic-water-lines',
                type: 'line',
                source: 'thematic-water-source',
                paint: {
                    'line-color': '#3b82f6',
                    'line-width': 3
                }
            });
        }
    }, [activeCity]);

    // 1. Initialize MapLibre on full world map (unrestricted pan and zoom)
    useEffect(() => {
        if (mapRef.current) return;

        async function initMap() {
            let positronStyle = FALLBACK_POSITRON_STYLE;
            try {
                const response = await fetch(OPENFREEMAP_POSITRON_URL);
                if (response.ok) {
                    const rawJson = await response.json();
                    positronStyle = filterBasemapClutter(rawJson);
                }
            } catch (err) {
                console.warn('Using fallback clean Positron style:', err);
            }

            const cityConfig = getCityBoundary(activeCity);

            // Full global map support: minZoom: 1, maxZoom: 19, free pan
            const map = new Map({
                container: mapContainer.current,
                style: positronStyle,
                center: cityConfig.center || [88.3639, 22.5726],
                zoom: 12.5,
                minZoom: 1,
                maxZoom: 19
            });

            map.addControl(new NavigationControl({ showCompass: true, visualizePitch: true }), "top-right");
            map.addControl(new FullscreenControl(), "top-right");
            map.addControl(new ScaleControl({ maxWidth: 150 }), "bottom-left");

            // Initial view fits to Kolkata boundary
            map.fitBounds(cityConfig.initialBounds, { padding: 40, duration: 0 });

            // Click listener: Select clicked location
            map.on('click', (e) => {
                const { lng, lat } = e.lngLat;
                handleSelectLocation(lat, lng);
            });

            map.on('load', () => {
                registerThematicLayers(map);
            });

            mapRef.current = map;
        }

        initMap();

        return () => {
            mapRef.current?.remove();
            mapRef.current = null;
        };
    }, [registerThematicLayers, activeCity]);

    // 2. Fetch all database models on load
    useEffect(() => {
        async function fetchAllMapData() {
            try {
                const dump = await api.getAllDbData();
                if (dump) {
                    if (dump.roads_network) setRoadsData(dump.roads_network);
                    if (dump.drainage_network) setDrainsData(dump.drainage_network);
                    if (dump.tables?.ward_landscape) setLandscapeData(dump.tables.ward_landscape);
                }

                const forecastRes = await api.getWardForecasts(cityRainfall, 1);
                if (forecastRes && forecastRes.forecasts) {
                    setAllForecasts(forecastRes.forecasts);
                }
            } catch (err) {
                console.warn('Database fetch fallback to default models:', err);
            }
        }
        fetchAllMapData();
    }, [cityRainfall]);

    // 3. Populate thematic drainage & roads from real database records
    useEffect(() => {
        if (!mapRef.current) return;
        const map = mapRef.current;
        registerThematicLayers(map);

        // a) Drainage lines & pumping hubs
        const drainSource = map.getSource('thematic-drainage-source');
        if (drainSource && drainsData.length > 0) {
            const drainFeatures = [];
            drainsData.forEach((d) => {
                if (d.coordinates) {
                    drainFeatures.push({
                        type: 'Feature',
                        properties: { id: d.drain_id, name: d.name },
                        geometry: { type: 'Point', coordinates: d.coordinates }
                    });
                }
            });
            drainSource.setData({ type: 'FeatureCollection', features: drainFeatures });
        }

        // b) Real Roads
        const roadSource = map.getSource('thematic-roads-source');
        if (roadSource && roadsData.length > 0) {
            const roadFeatures = roadsData.map((r) => ({
                type: 'Feature',
                properties: {
                    road_id: r.road_id,
                    name: r.name,
                    status: r.waterlogging_status
                },
                geometry: {
                    type: 'LineString',
                    coordinates: r.coordinates
                }
            }));
            roadSource.setData({ type: 'FeatureCollection', features: roadFeatures });
        }
    }, [drainsData, roadsData, registerThematicLayers]);

    // 4. Select and Display Registered User Address Location
    const handleSelectLocation = useCallback(async (latitude, longitude, wardOverride = null, customLabel = null) => {
        if (!mapRef.current) return;
        const map = mapRef.current;

        // Reset previous registered user marker
        if (userLocationMarkerRef.current) {
            userLocationMarkerRef.current.remove();
            userLocationMarkerRef.current = null;
        }

        // Render prominent custom Registered User Location marker
        const pinEl = document.createElement('div');
        pinEl.className = 'registered-user-location-marker';
        pinEl.innerHTML = `
            <div class="user-home-pin-pill">
                <span class="user-home-icon">🏠</span>
                <span class="user-home-label">${customLabel || 'Registered Address'}</span>
            </div>
            <div class="user-pin-pulse"></div>
        `;

        userLocationMarkerRef.current = new Marker({ element: pinEl, anchor: 'bottom' })
            .setLngLat([longitude, latitude])
            .addTo(map);

        // Smoothly fly to user's registered position
        map.flyTo({
            center: [longitude, latitude],
            zoom: 13.5,
            duration: 800
        });

        setLocationLoading(true);
        try {
            const res = await api.predictLocation({
                latitude,
                longitude,
                rainfall_mm: cityRainfall,
                avg_humidity_percent: 85.0,
                avg_temperature_c: 28.5,
                is_monsoon: 1,
            });

            setLocationPrediction(res);

            const matchedWardId = wardOverride || res?.nearest_ward?.matched_ward_id || 120;
            const matchedZone = res?.nearest_ward?.zone || 'Central East';
            setSelectedWardId(String(matchedWardId));

            const road = roadsData.find(r => r.ward_id === matchedWardId || r.zone?.toLowerCase() === matchedZone.toLowerCase()) || roadsData[0];
            const drain = drainsData.find(d => d.zone?.toLowerCase() === matchedZone.toLowerCase()) || drainsData[0];
            const landscape = landscapeData.find(l => l.ward_id === matchedWardId) || landscapeData[0];
            const forecast = allForecasts.find(f => f.ward_id === matchedWardId) || allForecasts[0];

            setMatchedRoad(road);
            setMatchedDrain(drain);
            setMatchedLandscape(landscape);
            setMatchedForecast(forecast);

        } catch (err) {
            console.error('Location prediction failed:', err);
        } finally {
            setLocationLoading(false);
        }
    }, [cityRainfall, roadsData, drainsData, landscapeData, allForecasts]);

    // Initial load: Focus directly on the logged-in user's database registered address
    useEffect(() => {
        if (!locationPrediction && mapRef.current) {
            const reg = getRegisteredLocationInfo();
            handleSelectLocation(reg.coords[1], reg.coords[0], reg.wardId, reg.displayName);
        }
    }, [user, locationPrediction, handleSelectLocation, getRegisteredLocationInfo]);

    // Layer Visibilities
    useEffect(() => {
        if (!mapRef.current) return;
        const map = mapRef.current;

        const setVisibility = (layerId, isVisible) => {
            if (map.getLayer(layerId)) {
                map.setLayoutProperty(layerId, 'visibility', isVisible ? 'visible' : 'none');
            }
        };

        setVisibility('thematic-drainage-lines', layerToggles.showDrainage);
        setVisibility('thematic-drainage-points', layerToggles.showDrainage);
        setVisibility('thematic-roads-casing', layerToggles.showRoads);
        setVisibility('thematic-roads-line', layerToggles.showRoads);
        setVisibility('thematic-water-lines', layerToggles.showWater);
    }, [layerToggles]);

    // Ward Dropdown Change Handler
    const handleWardDropdownChange = (e) => {
        const wardId = parseInt(e.target.value, 10);
        setSelectedWardId(String(wardId));
        const matched = allForecasts.find(w => w.ward_id === wardId);
        if (matched && matched.coordinates) {
            handleSelectLocation(matched.coordinates[1], matched.coordinates[0], wardId, `Ward ${wardId}`);
        }
    };

    // Locate Me Button: Returns to User's Registered Location
    const handleLocateUser = () => {
        const reg = getRegisteredLocationInfo();
        handleSelectLocation(reg.coords[1], reg.coords[0], reg.wardId, reg.displayName);
    };

    const registeredInfo = getRegisteredLocationInfo();

    return (
        <div className="map-page-wrapper">
            {/* Map Canvas Container (Full World Map) */}
            <div ref={mapContainer} className="map-fullscreen-container" />

            {/* Top-Left Search & Registered Address Focus Bar */}
            <div className="map-search-anchor">
                <div className="map-search-box glass-panel">
                    <span className="search-pin-icon">🏠</span>
                    <select
                        value={selectedWardId}
                        onChange={handleWardDropdownChange}
                        title="Jump to location or registered address"
                    >
                        <option value="120">🏠 My Registered Address ({registeredInfo.rawArea})</option>
                        <option value="1">Ward 1 - Dum Dum / Cossipore</option>
                        <option value="10">Ward 10 - Shyambazar / Hatibagan</option>
                        <option value="31">Ward 31 - Kankurgachi / Phoolbagan</option>
                        <option value="45">Ward 45 - BBD Bagh / Burrabazar</option>
                        <option value="63">Ward 63 - Park Street / Chowringhee</option>
                        <option value="74">Ward 74 - Alipore / Chetla</option>
                        <option value="83">Ward 83 - Kalighat / Rashbehari</option>
                        <option value="94">Ward 94 - Tollygunge</option>
                        <option value="96">Ward 96 - Jadavpur Central</option>
                        <option value="107">Ward 107 - EM Bypass / Ruby</option>
                        <option value="120">Ward 120 - Behala Central</option>
                        <option value="133">Ward 133 - Garden Reach / Metiabruz</option>
                    </select>
                    <button className="locate-me-btn" onClick={handleLocateUser} title="Jump to my registered address">
                        <span>🎯</span> My Location
                    </button>
                </div>
            </div>

            {/* Top-Right Thematic Layers Toggle */}
            <div className="map-filter-box-anchor">
                <FilterBox
                    layerToggles={layerToggles}
                    setLayerToggles={setLayerToggles}
                />
            </div>

            {/* Registered User Location Detail Panel */}
            <LocationPredictionCard
                locationResult={locationPrediction}
                matchedRoad={matchedRoad}
                matchedDrain={matchedDrain}
                matchedLandscape={matchedLandscape}
                matchedForecast={matchedForecast}
                loading={locationLoading}
                onClose={() => {
                    setLocationPrediction(null);
                }}
            />

            {/* Legend Overlay with Dotted Red KMC Boundary */}
            <div className="map-legends-container glass-panel">
                <div className="legend-column">
                    <h5>🏛️ Municipal Limits</h5>
                    <div className="legend-item">
                    <span className="legend-line-dotted-red" />
                        <span>KMC Boundary</span>
                    </div>
                </div>

                <div className="legend-divider" />

                <div className="legend-column">
                    <h5>🏠 User Focus</h5>
                    <div className="legend-item">
                        <span className="legend-symbol">🏠</span>
                        <span>Registered User Address</span>
                    </div>
                </div>

                <div className="legend-divider" />

                <div className="legend-column">
                    <h5>🛣️ Road Passability</h5>
                    <div className="legend-item"><span className="legend-dot" style={{ background: '#059669' }} /> Clear / Passable</div>
                    <div className="legend-item"><span className="legend-dot" style={{ background: '#d97706' }} /> Minor Waterlogging</div>
                    <div className="legend-item"><span className="legend-dot" style={{ background: '#dc2626' }} /> Severe / Closed</div>
                </div>
            </div>
        </div>
    );
}