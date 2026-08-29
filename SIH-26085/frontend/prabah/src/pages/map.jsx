import { useEffect, useRef } from "react";
import { Map, NavigationControl, FullscreenControl, ScaleControl, GeolocateControl, Marker, Popup, setWorkerUrl } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';
import "../styles/map.css";

setWorkerUrl(workerUrl);

export default function MapPage() {
    const mapContainer = useRef(null);
    const mapRef = useRef(null);

    useEffect(() => {
        if (mapRef.current) return;

        mapRef.current = new Map({
            container: mapContainer.current,
            // Using standard OpenStreetMap raster tiles to ensure they load
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

            // Kolkata city center
            center: [88.3639, 22.5726],
            zoom: 12,
            pitch: 0,
            bearing: 0,
            maxZoom: 18,
            minZoom: 8,
        });

        // Navigation controls
        mapRef.current.addControl(
            new NavigationControl({ showCompass: true }),
            "top-right"
        );

        // Fullscreen
        mapRef.current.addControl(
            new FullscreenControl(),
            "top-right"
        );

        // Scale bar
        mapRef.current.addControl(
            new ScaleControl({ maxWidth: 150 }),
            "bottom-left"
        );

        // Geolocate control
        mapRef.current.addControl(
            new GeolocateControl({
                positionOptions: { enableHighAccuracy: true },
                trackUserLocation: false,
            }),
            "top-right"
        );

        // Add a marker at Kolkata center
        new Marker({ color: '#2563EB' })
            .setLngLat([88.3639, 22.5726])
            .setPopup(
                new Popup({ offset: 25 }).setHTML(
                    `<div style="font-family: Inter, sans-serif; padding: 4px 0;">
                        <strong style="font-size: 14px;">Kolkata</strong>
                        <p style="margin: 4px 0 0; font-size: 12px; color: #64748B;">City of Joy — Monitoring Zone</p>
                    </div>`
                )
            )
            .addTo(mapRef.current);

        // Add notable Kolkata flood-prone area markers
        const floodZones = [
            { name: "Salt Lake", coords: [88.4100, 22.5800], risk: "medium" },
            { name: "Behala", coords: [88.3100, 22.4900], risk: "high" },
            { name: "Jadavpur", coords: [88.3700, 22.4950], risk: "medium" },
            { name: "Howrah Bridge", coords: [88.3464, 22.5851], risk: "critical" },
            { name: "New Town", coords: [88.4550, 22.5900], risk: "low" },
            { name: "Tollygunge", coords: [88.3500, 22.4990], risk: "high" },
            { name: "Dum Dum", coords: [88.4300, 22.6200], risk: "medium" },
            { name: "The Neotia", coords: [88.1987,22.2596], risk: "high" }
        ];

        const riskColors = {
            low: "#22c55e",
            medium: "#eab308",
            high: "#f97316",
            critical: "#ef4444",
        };

        floodZones.forEach((zone) => {
            const el = document.createElement("div");
            el.className = "flood-marker";
            el.style.width = "14px";
            el.style.height = "14px";
            el.style.borderRadius = "50%";
            el.style.backgroundColor = riskColors[zone.risk];
            el.style.border = "2px solid white";
            el.style.boxShadow = `0 0 8px ${riskColors[zone.risk]}80`;
            el.style.cursor = "pointer";

            new Marker({ element: el })
                .setLngLat(zone.coords)
                .setPopup(
                    new Popup({ offset: 12 }).setHTML(
                        `<div style="font-family: Inter, sans-serif; padding: 4px 0;">
                            <strong style="font-size: 13px;">${zone.name}</strong>
                            <p style="margin: 4px 0 0; font-size: 12px; color: ${riskColors[zone.risk]}; font-weight: 600; text-transform: capitalize;">
                                ● ${zone.risk} Risk
                            </p>
                        </div>`
                    )
                )
                .addTo(mapRef.current);
        });

        return () => {
            mapRef.current?.remove();
            mapRef.current = null;
        };
    }, []);

    return (
        <div className="map-page">
            <div
                ref={mapContainer}
                className="map-container"
            />

            {/* Map title overlay */}
            <div className="map-info">
                <h2>🌊 Kolkata Flood Watch</h2>
                <p>Urban flood monitoring &amp; prediction — real-time risk zones</p>
            </div>

            {/* Risk legend */}
            <div className="risk-legend">
                <h4>Flood Risk</h4>

                <div>
                    <span className="risk low" />
                    Low
                </div>

                <div>
                    <span className="risk medium" />
                    Medium
                </div>

                <div>
                    <span className="risk high" />
                    High
                </div>

                <div>
                    <span className="risk critical" />
                    Critical
                </div>
            </div>
        </div>
    );
}