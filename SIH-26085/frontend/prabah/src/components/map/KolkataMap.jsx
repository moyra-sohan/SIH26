import { useEffect, useRef } from "react";
import { Map, NavigationControl, FullscreenControl, ScaleControl, GeolocateControl, Marker, Popup, setWorkerUrl } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';
import { KMC_OFFICIAL_GEOJSON } from "../../data/cityBoundaries";

setWorkerUrl(workerUrl);

export default function KolkataMap() {
  const mapContainer = useRef(null);
  const map = useRef(null);

  useEffect(() => {
    if (map.current) return;

    map.current = new Map({
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
      center: [88.39308, 22.56754],
      zoom: 12,
      pitch: 0,
      bearing: 0,
    });

    // Fit bounds to show full boundary on initial load
    map.current.on('load', () => {
      // Fit to the boundary extent
      map.current.fitBounds(
        [[88.30759, 22.47735], [88.47857, 22.65774]],
        { padding: 30, duration: 800 }
      );

      if (!map.current.getSource('kolkata-boundary')) {
        map.current.addSource('kolkata-boundary', {
          type: 'geojson',
          data: KMC_OFFICIAL_GEOJSON
        });

        // Soft glowing fill inside boundary
        map.current.addLayer({
          id: 'kolkata-boundary-fill',
          type: 'fill',
          source: 'kolkata-boundary',
          paint: {
            'fill-color': '#3b82f6',
            'fill-opacity': 0.06
          }
        });

        // Solid smooth boundary outline
        map.current.addLayer({
          id: 'kolkata-boundary-line',
          type: 'line',
          source: 'kolkata-boundary',
          paint: {
            'line-color': '#2563eb',
            'line-width': 2.5,
            'line-opacity': 0.8
          }
        });

        // Outer glow effect for the boundary
        map.current.addLayer({
          id: 'kolkata-boundary-glow',
          type: 'line',
          source: 'kolkata-boundary',
          paint: {
            'line-color': '#60a5fa',
            'line-width': 6,
            'line-opacity': 0.15,
            'line-blur': 4
          }
        });
      }
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

    // Kolkata center marker with refined popup
    new Marker({ color: "#2563eb" })
      .setLngLat([88.3639, 22.5726])
      .setPopup(
        new Popup({ offset: 25, className: 'kolkata-popup' }).setHTML(`
          <div style="font-family: 'Inter', sans-serif; padding: 8px 4px;">
            <strong style="font-size: 15px; color: #1e293b;">Kolkata</strong>
            <br/>
            <span style="font-size: 12px; color: #64748b;">Urban Flood Monitoring Zone</span>
          </div>
        `)
      )
      .addTo(map.current);

    // Flood-prone area markers with refined color palette
    const floodZones = [
      { name: "Salt Lake", coords: [88.4100, 22.5800], risk: "moderate", icon: "💧" },
      { name: "Behala", coords: [88.3100, 22.4900], risk: "high", icon: "⚠️" },
      { name: "Jadavpur", coords: [88.3700, 22.4950], risk: "moderate", icon: "💧" },
      { name: "Howrah Bridge", coords: [88.3464, 22.5851], risk: "critical", icon: "🚨" },
      { name: "New Town", coords: [88.4550, 22.5900], risk: "low", icon: "✅" },
      { name: "Tollygunge", coords: [88.3500, 22.4990], risk: "high", icon: "⚠️" },
      { name: "Dum Dum", coords: [88.4300, 22.6200], risk: "moderate", icon: "💧" },
    ];

    // Refined risk colors — professional, accessible palette
    const riskColors = {
      low: "#10b981",      // emerald-500
      moderate: "#f59e0b",  // amber-500
      high: "#f97316",      // orange-500
      critical: "#dc2626",  // red-600
    };

    floodZones.forEach((zone) => {
      const el = document.createElement("div");
      el.style.width = "16px";
      el.style.height = "16px";
      el.style.borderRadius = "50%";
      el.style.backgroundColor = riskColors[zone.risk];
      el.style.border = "2.5px solid white";
      el.style.boxShadow = `0 0 0 1px ${riskColors[zone.risk]}40, 0 2px 8px ${riskColors[zone.risk]}50`;
      el.style.cursor = "pointer";
      el.style.transition = "transform 0.2s ease, box-shadow 0.2s ease";
      
      el.addEventListener('mouseenter', () => {
        el.style.transform = 'scale(1.4)';
        el.style.boxShadow = `0 0 0 2px ${riskColors[zone.risk]}60, 0 4px 16px ${riskColors[zone.risk]}60`;
      });
      el.addEventListener('mouseleave', () => {
        el.style.transform = 'scale(1)';
        el.style.boxShadow = `0 0 0 1px ${riskColors[zone.risk]}40, 0 2px 8px ${riskColors[zone.risk]}50`;
      });

      new Marker({ element: el })
        .setLngLat(zone.coords)
        .setPopup(
          new Popup({ offset: 14, className: 'zone-popup' }).setHTML(
            `<div style="font-family: 'Inter', sans-serif; padding: 6px 4px;">
              <div style="display: flex; align-items: center; gap: 6px;">
                <span style="font-size: 14px;">${zone.icon}</span>
                <strong style="font-size: 13px; color: #1e293b;">${zone.name}</strong>
              </div>
              <div style="margin: 6px 0 0; display: inline-flex; align-items: center; gap: 5px; font-size: 11px; font-weight: 700; color: ${riskColors[zone.risk]}; background: ${riskColors[zone.risk]}12; padding: 3px 8px; border-radius: 10px; text-transform: capitalize;">
                <span style="width: 6px; height: 6px; border-radius: 50%; background: ${riskColors[zone.risk]}; display: inline-block;"></span>
                ${zone.risk} Risk
              </div>
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