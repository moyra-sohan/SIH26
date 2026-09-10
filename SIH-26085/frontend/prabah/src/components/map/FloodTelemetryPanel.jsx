import React, { useState } from 'react';
import { Star, MapPin, Waves, AlertTriangle, ShieldCheck } from 'lucide-react';

export default function FloodTelemetryPanel({
  locationResult,
  matchedForecast,
  activeWardName = "Behala (Ward 120)",
  coordinates = { lat: 22.4900, lng: 88.3100 },
  loading = false,
  onClose
}) {
  const [isBookmarked, setIsBookmarked] = useState(false);

  const pred = locationResult?.prediction;
  const probPercent = pred?.flood_probability !== undefined
    ? Math.round(pred.flood_probability * 100)
    : 92;

  const riskLevel = pred?.risk_level || 'CRITICAL';
  const statusText = pred?.status_text || 'High Risk – Rising*';
  const riskColor = pred?.risk_color || '#DC2626';

  // Live water level calculation (in meters)
  const baseWaterDepthM = pred?.estimated_waterlogging_depth_cm
    ? Number((pred.estimated_waterlogging_depth_cm / 10).toFixed(2))
    : 3.75;

  const liveLevel = baseWaterDepthM;
  const peak3h = Number((baseWaterDepthM * 1.50).toFixed(2));
  const hazardLimit = 5.00;

  // 5-step Water Level Forecast (Now, +1H, +2H, +3H, +6H) in meters
  const forecastBars = [
    { label: 'Now', value: liveLevel, color: liveLevel >= 5.0 ? '#DC2626' : liveLevel >= 3.0 ? '#F97316' : '#10B981' },
    { label: '+1H', value: Number((baseWaterDepthM * 1.30).toFixed(2)), color: (baseWaterDepthM * 1.30) >= 5.0 ? '#DC2626' : '#EA580C' },
    { label: '+2H', value: peak3h, color: '#DC2626' }, // Peak surge in red
    { label: '+3H', value: Number((baseWaterDepthM * 1.31).toFixed(2)), color: '#F59E0B' },
    { label: '+6H', value: Number((baseWaterDepthM * 0.85).toFixed(2)), color: '#10B981' },
  ];

  const maxValY = 8.0; // Y-axis max 8m

  return (
    <div className="flood-telemetry-panel">
      {/* 1. Header with Location Name & Bookmark */}
      <div className="telemetry-header-card">
        <div className="telemetry-location-info">
          <div className="location-name-row">
            <MapPin size={18} className="telemetry-pin-icon" />
            <h3>{activeWardName}</h3>
          </div>
          <p className="telemetry-coords">
            {coordinates.lat.toFixed(4)}°N, {coordinates.lng.toFixed(4)}°E
          </p>
        </div>
        <button
          className={`telemetry-star-btn ${isBookmarked ? 'bookmarked' : ''}`}
          onClick={() => setIsBookmarked(!isBookmarked)}
          title={isBookmarked ? "Remove Bookmark" : "Bookmark Ward"}
          aria-label="Bookmark location"
        >
          <Star size={18} fill={isBookmarked ? "#F59E0B" : "none"} color={isBookmarked ? "#F59E0B" : "#64748B"} />
        </button>
      </div>

      {/* 2. Critical Risk Banner Card (Solid Vivid Red Gradient) */}
      <div className="telemetry-risk-card" style={{ background: 'linear-gradient(135deg, #DC2626 0%, #B91C1C 100%)' }}>
        <div className="risk-card-left">
          <div className="risk-tag-title">{riskLevel.toUpperCase()} FLOOD RISK</div>
          <div className="risk-tag-sub">{statusText}</div>
        </div>
        <div className="risk-score-circle-wrapper">
          <div className="risk-score-circle">
            <span className="risk-score-num">{probPercent}%</span>
            <span className="risk-score-label">RISK SCORE</span>
          </div>
        </div>
      </div>

      {/* 3. Live Water Level Card */}
      <div className="telemetry-section-card">
        <div className="section-card-title">
          <Waves size={16} className="section-title-icon water-blue" />
          <span>Live Water Level</span>
        </div>
        <div className="water-level-grid">
          <div className="water-stat-box">
            <span className="water-stat-label">LIVE LEVEL</span>
            <span className="water-stat-val text-blue">{liveLevel.toFixed(2)} m</span>
          </div>
          <div className="water-stat-box">
            <span className="water-stat-label">3H PEAK</span>
            <span className="water-stat-val text-red">{peak3h.toFixed(2)} m</span>
          </div>
          <div className="water-stat-box">
            <span className="water-stat-label">HAZARD LIMIT</span>
            <span className="water-stat-val text-amber">{hazardLimit.toFixed(2)} m</span>
          </div>
        </div>
      </div>

      {/* 4. Water Level Forecast Bar Chart */}
      <div className="telemetry-section-card">
        <div className="section-card-title">
          <Waves size={16} className="section-title-icon water-blue" />
          <span>Water Level Forecast</span>
        </div>

        {/* Custom High-Fidelity SVG Bar Chart */}
        <div className="forecast-chart-container">
          {/* Y-Axis scale marks */}
          <div className="chart-y-axis">
            <span>8 m</span>
            <span>6 m</span>
            <span>4 m</span>
            <span>2 m</span>
            <span>0 m</span>
          </div>

          {/* Chart Plot Area */}
          <div className="chart-plot-area">
            {/* Grid lines */}
            <div className="chart-grid-line" style={{ bottom: '100%' }} />
            <div className="chart-grid-line" style={{ bottom: '75%' }} />
            <div className="chart-grid-line" style={{ bottom: '50%' }} />
            <div className="chart-grid-line" style={{ bottom: '25%' }} />
            <div className="chart-grid-line" style={{ bottom: '0%' }} />

            {/* Bars */}
            <div className="chart-bars-row">
              {forecastBars.map((bar, idx) => {
                const heightPercent = Math.min(100, Math.max(8, (bar.value / maxValY) * 100));
                return (
                  <div key={idx} className="forecast-bar-col">
                    <span className="bar-top-value">{bar.value.toFixed(2)}</span>
                    <div
                      className="forecast-bar-fill"
                      style={{
                        height: `${heightPercent}%`,
                        backgroundColor: bar.color,
                      }}
                    />
                    <span className="bar-x-label">{bar.label}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* 5. Risk Guidelines Table Card */}
      <div className="telemetry-section-card">
        <div className="section-card-title">
          <ShieldCheck size={16} className="section-title-icon text-slate" />
          <span>Risk Guidelines</span>
        </div>
        <div className="guidelines-list">
          <div className="guideline-row">
            <div className="guideline-left">
              <span className="guide-dot dot-red" />
              <span className="guide-category">Very High (&gt;5.0 m)</span>
            </div>
            <span className="guide-action">Evacuate Immediately</span>
          </div>

          <div className="guideline-row">
            <div className="guideline-left">
              <span className="guide-dot dot-orange" />
              <span className="guide-category">High (3.0 – 5.0 m)</span>
            </div>
            <span className="guide-action">Be Prepared</span>
          </div>

          <div className="guideline-row">
            <div className="guideline-left">
              <span className="guide-dot dot-amber" />
              <span className="guide-category">Moderate (1.5 – 3.0 m)</span>
            </div>
            <span className="guide-action">Stay Alert</span>
          </div>

          <div className="guideline-row">
            <div className="guideline-left">
              <span className="guide-dot dot-green" />
              <span className="guide-category">Low (&lt;1.5 m)</span>
            </div>
            <span className="guide-action">No Immediate Risk</span>
          </div>
        </div>
      </div>
    </div>
  );
}
