import { useEffect, useRef, useState } from "react";
import {
  Map,
  NavigationControl,
  FullscreenControl,
  ScaleControl,
  GeolocateControl,
  Marker,
  Popup,
  setWorkerUrl,
} from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import workerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url";
import { useFloodData } from "../../context/FloodDataContext";

setWorkerUrl(workerUrl);

const riskColors = {
  Major: "#EF4444",
  Moderate: "#F97316",
  Minor: "#EAB308",
  "No Risk": "#22C55E",
};

export default function KolkataMap({ onSelectWard, activeRiskFilter = "ALL" }) {
  const mapContainer = useRef(null);
  const map = useRef(null);
  const markersRef = useRef([]);
  const { wards, selectedWardId, setSelectedWardId } = useFloodData();

  // Initialize Map
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
            attribution:
              '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
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
      center: [88.3639, 22.545], // Centered on Kolkata metropolitan area
      zoom: 11.5,
      pitch: 0,
      bearing: 0,
    });

    map.current.addControl(new NavigationControl({ showCompass: true }), "top-right");
    map.current.addControl(new FullscreenControl(), "top-right");
    map.current.addControl(new ScaleControl({ maxWidth: 150 }), "bottom-left");
    map.current.addControl(
      new GeolocateControl({
        positionOptions: { enableHighAccuracy: true },
        trackUserLocation: false,
      }),
      "top-right"
    );

    return () => {
      map.current?.remove();
      map.current = null;
    };
  }, []);

  // Update Markers based on Wards and Active Filter
  useEffect(() => {
    if (!map.current || !wards || wards.length === 0) return;

    // Remove existing markers
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    const filtered =
      activeRiskFilter === "ALL"
        ? wards
        : wards.filter((w) => w.predicted_risk === activeRiskFilter);

    filtered.forEach((ward) => {
      const risk = ward.predicted_risk || "Minor";
      const color = riskColors[risk] || "#3B82F6";
      const isMajor = risk === "Major";
      const isSelected = selectedWardId === ward.ward_id;

      // Custom pulsing HTML marker element
      const el = document.createElement("div");
      el.className = `map-ward-pin ${isMajor ? "pulse-pin" : ""} ${
        isSelected ? "selected-pin" : ""
      }`;
      el.style.width = isMajor ? "22px" : "18px";
      el.style.height = isMajor ? "22px" : "18px";
      el.style.borderRadius = "50%";
      el.style.backgroundColor = color;
      el.style.border = "2.5px solid white";
      el.style.boxShadow = `0 0 ${isMajor ? "16px" : "8px"} ${color}cc`;
      el.style.cursor = "pointer";
      el.style.transition = "transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1)";

      // Inner dot
      const inner = document.createElement("div");
      inner.style.width = "6px";
      inner.style.height = "6px";
      inner.style.borderRadius = "50%";
      inner.style.backgroundColor = "white";
      inner.style.margin = "auto";
      inner.style.position = "relative";
      inner.style.top = isMajor ? "5.5px" : "3.5px";
      el.appendChild(inner);

      // Hover scale
      el.addEventListener("mouseenter", () => {
        el.style.transform = "scale(1.35)";
      });
      el.addEventListener("mouseleave", () => {
        el.style.transform = "scale(1.0)";
      });

      // Build Rich HTML Popup
      const probEntries = ward.probabilities
        ? Object.entries(ward.probabilities)
            .map(([cls, p]) => `<span>${cls}: <strong>${Math.round(p * 100)}%</strong></span>`)
            .join(" • ")
        : "";

      const popupHTML = `
        <div class="map-popup-card">
          <div class="map-popup-header">
            <div>
              <div class="map-popup-zone">${ward.zone} Zone • Ward ${ward.ward_id}</div>
              <h4 class="map-popup-title">${ward.ward_name}</h4>
            </div>
            <span class="map-popup-risk" style="background: ${color}20; color: ${color}; border: 1px solid ${color}50;">
              ${risk} Risk
            </span>
          </div>

          <div class="map-popup-grid">
            <div class="map-popup-stat">
              <span class="lbl">Rainfall</span>
              <span class="val">${ward.historical_rainfall_mm} mm</span>
            </div>
            <div class="map-popup-stat">
              <span class="lbl">Elevation</span>
              <span class="val">${ward.elevation_m} m</span>
            </div>
            <div class="map-popup-stat">
              <span class="lbl">Drain Load</span>
              <span class="val" style="color: ${ward.drain_load_utilization_percent > 90 ? "#EF4444" : "#0F172A"}">
                ${ward.drain_load_utilization_percent}%
              </span>
            </div>
            <div class="map-popup-stat">
              <span class="lbl">Incidents</span>
              <span class="val">${ward.reported_waterlogging_incidents} spots</span>
            </div>
          </div>

          ${
            probEntries
              ? `<div class="map-popup-probs">${probEntries}</div>`
              : ""
          }

          <div class="map-popup-footer">
            <button class="map-popup-btn" onclick="window.__selectWardMap(${ward.ward_id})">
              Inspect Ward Analytics →
            </button>
          </div>
        </div>
      `;

      const popup = new Popup({ offset: 16, maxWidth: "280px" }).setHTML(popupHTML);

      const marker = new Marker({ element: el })
        .setLngLat([ward.longitude, ward.latitude])
        .setPopup(popup)
        .addTo(map.current);

      markersRef.current.push(marker);
    });
  }, [wards, activeRiskFilter, selectedWardId]);

  // Expose global callback for popup button
  useEffect(() => {
    window.__selectWardMap = (wardId) => {
      setSelectedWardId(wardId);
      if (onSelectWard) onSelectWard(wardId);
    };
    return () => {
      delete window.__selectWardMap;
    };
  }, [setSelectedWardId, onSelectWard]);

  // Fly to selected ward if changed
  useEffect(() => {
    if (!map.current || !selectedWardId) return;
    const target = wards.find((w) => w.ward_id === selectedWardId);
    if (target) {
      map.current.flyTo({
        center: [target.longitude, target.latitude],
        zoom: 13.5,
        speed: 1.2,
        curve: 1.4,
      });
    }
  }, [selectedWardId, wards]);

  return (
    <div
      ref={mapContainer}
      style={{
        width: "100%",
        height: "100%",
        minHeight: "560px",
        borderRadius: "14px",
        overflow: "hidden",
      }}
    />
  );
}