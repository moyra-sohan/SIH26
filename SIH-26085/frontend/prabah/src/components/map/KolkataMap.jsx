import { useEffect, useRef } from "react";
import { Map, NavigationControl, FullscreenControl, ScaleControl, GeolocateControl, Marker, Popup, setWorkerUrl } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';

setWorkerUrl(workerUrl);

export default function KolkataMap() {
  const mapContainer = useRef(null);
  const map = useRef(null);

  useEffect(() => {
    if (map.current) return;

    map.current = new Map({
      container: mapContainer.current,

      // Using standard OpenStreetMap raster tiles to guarantee they load without API keys or CORS issues
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

      center: [88.3639, 22.5726], // Kolkata
      zoom: 11.5,

      pitch: 0,
      bearing: 0,
    });

    map.current.addControl(
      new NavigationControl({ showCompass: true }),
      "top-right"
    );

    map.current.addControl(
      new FullscreenControl(),
      "top-right"
    );

    map.current.addControl(
      new ScaleControl({ maxWidth: 150 }),
      "bottom-left"
    );

    map.current.addControl(
      new GeolocateControl({
        positionOptions: { enableHighAccuracy: true },
        trackUserLocation: false,
      }),
      "top-right"
    );

    // Kolkata marker
    new Marker({ color: "#e63946" })
      .setLngLat([88.3639, 22.5726])
      .setPopup(
        new Popup({ offset: 25 }).setHTML(`
          <div style="font-family: sans-serif; padding: 4px;">
            <strong style="font-size: 14px;">Kolkata</strong>
            <br/>
            <span style="font-size: 12px; color: #555;">Urban Flood Monitoring Zone</span>
          </div>
        `)
      )
      .addTo(map.current);

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
      el.style.width = "14px";
      el.style.height = "14px";
      el.style.borderRadius = "50%";
      el.style.backgroundColor = riskColors[zone.risk];
      el.style.border = "2px solid white";
      el.style.boxShadow = `0 0 8px ${riskColors[zone.risk]}80`;
      el.style.cursor = "pointer";
      
      // Inline hover effect
      el.addEventListener('mouseenter', () => { el.style.transform = 'scale(1.5)'; el.style.transition = 'transform 0.2s'; });
      el.addEventListener('mouseleave', () => { el.style.transform = 'scale(1)'; });

      new Marker({ element: el })
        .setLngLat(zone.coords)
        .setPopup(
          new Popup({ offset: 12 }).setHTML(
            `<div style="font-family: sans-serif; padding: 4px;">
              <strong style="font-size: 13px;">${zone.name}</strong>
              <p style="margin: 4px 0 0; font-size: 12px; color: ${riskColors[zone.risk]}; font-weight: bold; text-transform: capitalize;">
                ● ${zone.risk} Risk
              </p>
            </div>`
          )
        )
        .addTo(map.current);
    });

    return () => {
      map.current?.remove();
      map.current = null;
    };
  }, []);

  return (
    <div
      ref={mapContainer}
      style={{
        width: "100%",
        height: "100%",
        minHeight: "500px",
        borderRadius: "12px",
        overflow: "hidden",
      }}
    />
  );
}