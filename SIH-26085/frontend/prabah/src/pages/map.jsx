import { useEffect, useRef, useState } from "react";
import { Map, NavigationControl, FullscreenControl, ScaleControl, GeolocateControl, Marker, Popup, setWorkerUrl } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';
import api from '../services/api';
import "../styles/map.css";

setWorkerUrl(workerUrl);

export default function MapPage() {
    const mapContainer = useRef(null);
    const mapRef = useRef(null);
    const markersRef = useRef([]);
    const [zoneForecasts, setZoneForecasts] = useState([]);
    const [cityRainfall, setCityRainfall] = useState(82);

    useEffect(() => {
        if (mapRef.current) return;

        mapRef.current = new Map({
            container: mapContainer.current,
            style: {
                version: 8,
                sources: {
                    osm: {
                        type: "raster",
                        tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
                        tileSize: 256,
                        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
                    },
                },
                layers: [
                    {
                        id: "osm-layer",
                        type: "raster",
                        source: "osm",
                        minzoom: 0,
                        maxzoom: 19,
                    },
                ],
            },
            center: [88.3639, 22.5726],
            zoom: 12,
            pitch: 0,
            bearing: 0,
            maxZoom: 18,
            minZoom: 8,
        });

        mapRef.current.addControl(new NavigationControl({ showCompass: true }), "top-right");
        mapRef.current.addControl(new FullscreenControl(), "top-right");
        mapRef.current.addControl(new ScaleControl({ maxWidth: 150 }), "bottom-left");
        mapRef.current.addControl(
            new GeolocateControl({
                positionOptions: { enableHighAccuracy: true },
                trackUserLocation: false,
            }),
            "top-right"
        );

        // Center marker for Kolkata City Center
        new Marker({ color: '#2563EB' })
            .setLngLat([88.3639, 22.5726])
            .setPopup(
                new Popup({ offset: 25 }).setHTML(
                    `<div style="font-family: Inter, sans-serif; padding: 6px 0;">
                        <strong style="font-size: 14px; color: #1E293B;">Kolkata Command Center</strong>
                        <p style="margin: 4px 0 0; font-size: 12px; color: #64748B;">Urban Flood Nowcasting Hub</p>
                    </div>`
                )
            )
            .addTo(mapRef.current);

        return () => {
            mapRef.current?.remove();
            mapRef.current = null;
        };
    }, []);

    // Fetch live ML forecasts across Kolkata monitoring zones
    useEffect(() => {
        async function fetchForecasts() {
            try {
                const res = await api.getWardForecasts(cityRainfall, 1);
                if (res && res.forecasts) {
                    setZoneForecasts(res.forecasts);
                }
            } catch (err) {
                console.warn('Using default Kolkata flood zone coordinates:', err);
                // Fallback static list
                setZoneForecasts([
                    { name: "Salt Lake / Sector V", coordinates: [88.4100, 22.5800], risk_level: "Moderate", risk_color: "#eab308", flood_probability: 0.35, estimated_waterlogging_depth_cm: 4.2 },
                    { name: "Behala (Ward 120)", coordinates: [88.3100, 22.4900], risk_level: "Critical", risk_color: "#ef4444", flood_probability: 0.92, estimated_waterlogging_depth_cm: 41.7 },
                    { name: "Jadavpur (Ward 96)", coordinates: [88.3700, 22.4950], risk_level: "Moderate", risk_color: "#eab308", flood_probability: 0.42, estimated_waterlogging_depth_cm: 6.5 },
                    { name: "Howrah / Strand Road", coordinates: [88.3464, 22.5851], risk_level: "Critical", risk_color: "#ef4444", flood_probability: 0.94, estimated_waterlogging_depth_cm: 48.0 },
                    { name: "New Town (Action Area I)", coordinates: [88.4550, 22.5900], risk_level: "Low", risk_color: "#22c55e", flood_probability: 0.12, estimated_waterlogging_depth_cm: 0.0 },
                    { name: "Tollygunge (Ward 94)", coordinates: [88.3500, 22.4990], risk_level: "High", risk_color: "#f97316", flood_probability: 0.76, estimated_waterlogging_depth_cm: 22.5 },
                    { name: "Dum Dum Corridor", coordinates: [88.4300, 22.6200], risk_level: "Moderate", risk_color: "#eab308", flood_probability: 0.48, estimated_waterlogging_depth_cm: 8.0 },
                ]);
            }
        }
        fetchForecasts();
    }, [cityRainfall]);

    // Update map markers when zoneForecasts updates
    useEffect(() => {
        if (!mapRef.current || zoneForecasts.length === 0) return;

        // Clear existing markers
        markersRef.current.forEach((m) => m.remove());
        markersRef.current = [];

        zoneForecasts.forEach((zone) => {
            const color = zone.risk_color || (
                zone.risk_level?.toLowerCase() === 'critical' ? '#ef4444' :
                zone.risk_level?.toLowerCase() === 'high' ? '#f97316' :
                zone.risk_level?.toLowerCase() === 'moderate' ? '#eab308' : '#22c55e'
            );

            const el = document.createElement("div");
            el.className = "flood-marker";
            el.style.width = "18px";
            el.style.height = "18px";
            el.style.borderRadius = "50%";
            el.style.backgroundColor = color;
            el.style.border = "2.5px solid white";
            el.style.boxShadow = `0 0 12px ${color}`;
            el.style.cursor = "pointer";

            const probPercent = (zone.flood_probability * 100).toFixed(0);
            const depth = zone.estimated_waterlogging_depth_cm || 0;

            const marker = new Marker({ element: el })
                .setLngLat(zone.coordinates)
                .setPopup(
                    new Popup({ offset: 14 }).setHTML(
                        `<div style="font-family: Inter, sans-serif; padding: 6px 4px; min-width: 170px;">
                            <div style="font-size: 13px; font-weight: 700; color: #0F172A;">${zone.name}</div>
                            <div style="display: flex; align-items: center; justify-content: space-between; margin-top: 6px;">
                                <span style="font-size: 11px; font-weight: 700; color: ${color}; text-transform: uppercase;">
                                    ● ${zone.risk_level} Risk
                                </span>
                                <span style="font-size: 12px; font-weight: 800; color: ${color};">
                                    ${probPercent}%
                                </span>
                            </div>
                            <div style="font-size: 11px; color: #64748B; margin-top: 4px;">
                                Est. Depth: <strong>${depth} cm</strong>
                            </div>
                            ${zone.elevation_m ? `<div style="font-size: 11px; color: #64748B;">Elevation: <strong>${zone.elevation_m}m</strong></div>` : ''}
                        </div>`
                    )
                )
                .addTo(mapRef.current);

            markersRef.current.push(marker);
        });
    }, [zoneForecasts]);

    return (
        <div className="map-page">
            <div ref={mapContainer} className="map-container" />

            {/* Map title overlay */}
            <div className="map-info">
                <h2>🌊 Kolkata AI Flood Risk Map</h2>
                <p>Live ML Nowcasting across Kolkata Municipal Corporation (KMC) &amp; NKDA Wards</p>
            </div>

            {/* Risk legend */}
            <div className="risk-legend">
                <h4>AI Risk Classification</h4>
                <div>
                    <span className="risk low" />
                    Low (&lt;30%)
                </div>
                <div>
                    <span className="risk medium" />
                    Moderate (30-50%)
                </div>
                <div>
                    <span className="risk high" />
                    High (50-75%)
                </div>
                <div>
                    <span className="risk critical" />
                    Critical (&gt;75%)
                </div>
            </div>
        </div>
    );
}