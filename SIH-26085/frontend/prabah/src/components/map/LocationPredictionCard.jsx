import React, { useState } from 'react';
import { ResponsiveContainer, AreaChart, Area, BarChart, Bar, ReferenceLine, XAxis, YAxis, Tooltip, Cell } from 'recharts';

export default function LocationPredictionCard({
  locationResult,
  matchedRoad,
  matchedDrain,
  matchedLandscape,
  matchedForecast,
  loading,
  onClose
}) {
  // Chart view mode switcher (Dropdown selection)
  const [chartMode, setChartMode] = useState('road-mm'); // 'road-mm' | 'forecast-cm'

  // Accordion state for interactive collapsible sections
  const [isChartCollapsed, setIsChartCollapsed] = useState(false);
  const [collapsedSections, setCollapsedSections] = useState({
    zone: true,
    drainage: false,
    road: false,
    landscape: true
  });

  const toggleSection = (sectionKey) => {
    setCollapsedSections((prev) => ({
      ...prev,
      [sectionKey]: !prev[sectionKey]
    }));
  };

  if (!locationResult && !loading) return null;

  const pred = locationResult?.prediction;
  const nearest = locationResult?.nearest_ward;
  const loc = locationResult?.queried_location;

  const probPercent = pred ? Math.min(100, Math.max(0, Math.round(pred.flood_probability * 100))) : 78;
  const riskColor = pred?.risk_color || 
    (pred?.risk_level === 'Critical' ? '#ef4444' :
     pred?.risk_level === 'High' ? '#f97316' :
     pred?.risk_level === 'Moderate' ? '#eab308' : '#22c55e');
  const riskLevel = pred?.risk_level || 'High';

  // Calculate Radial Gauge Arc dimensions (r = 24, Circumference = 2 * PI * 24 ≈ 150.8)
  const radius = 24;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (probPercent / 100) * circumference;

  // Base depth calculations
  const baseWaterDepthCm = pred?.estimated_waterlogging_depth_cm || matchedRoad?.water_depth_cm || 28.0;
  const currentRoadDepthMm = Math.round(baseWaterDepthCm * 10); // e.g. 37.5cm -> 375mm

  // 1. Nowcast 0–3hr Water Depth Progression Trend Data (in cm)
  const trendDataCm = [
    { time: 'T+0h', depth: Number((baseWaterDepthCm * 0.70).toFixed(1)) },
    { time: 'T+1h', depth: Number((baseWaterDepthCm * 1.30).toFixed(1)) },
    { time: 'T+2h', depth: Number((baseWaterDepthCm * 1.50).toFixed(1)) },
    { time: 'T+3h', depth: Number((baseWaterDepthCm * 0.85).toFixed(1)) },
  ];
  const peakDepthCm = Math.max(...trendDataCm.map(d => d.depth));

  // 2. ROAD WATER LEVEL IN MILLIMETERS (mm Scale)
  const roadTrendDataMm = [
    {
      time: 'T+0h',
      waterLevelMm: Math.round(baseWaterDepthCm * 7.0),
      label: 'Initial Splash',
      status: Math.round(baseWaterDepthCm * 7.0) > 400 ? 'Severe' : Math.round(baseWaterDepthCm * 7.0) > 200 ? 'Caution' : 'Passable'
    },
    {
      time: 'T+1h',
      waterLevelMm: Math.round(baseWaterDepthCm * 13.0),
      label: 'Surge Build',
      status: Math.round(baseWaterDepthCm * 13.0) > 400 ? 'Critical' : Math.round(baseWaterDepthCm * 13.0) > 250 ? 'Severe' : 'Caution'
    },
    {
      time: 'T+2h',
      waterLevelMm: Math.round(baseWaterDepthCm * 15.0),
      label: 'Peak Inundation',
      status: Math.round(baseWaterDepthCm * 15.0) > 450 ? 'Submerged' : Math.round(baseWaterDepthCm * 15.0) > 250 ? 'Severe' : 'Caution'
    },
    {
      time: 'T+3h',
      waterLevelMm: Math.round(baseWaterDepthCm * 8.5),
      label: 'Recession',
      status: Math.round(baseWaterDepthCm * 8.5) > 350 ? 'Severe' : Math.round(baseWaterDepthCm * 8.5) > 150 ? 'Caution' : 'Passable'
    }
  ];
  const peakRoadDepthMm = Math.max(...roadTrendDataMm.map(d => d.waterLevelMm));

  const roadWaterSeverityColor = currentRoadDepthMm >= 450 ? '#ef4444' :
    currentRoadDepthMm >= 250 ? '#f97316' :
    currentRoadDepthMm >= 120 ? '#eab308' : '#22c55e';

  // Drainage calculations
  const drainLoad = matchedDrain?.drain_load_utilization_percent !== undefined ? matchedDrain.drain_load_utilization_percent : 74;
  const drainLoadColor = drainLoad > 75 ? '#ef4444' : drainLoad >= 50 ? '#eab308' : '#22c55e';
  const totalPumps = matchedDrain?.total_pumps || 8;
  const activePumps = matchedDrain?.active_pumps || 7;
  const siltLevel = (matchedDrain?.silt_accumulation_level || 'Moderate').toLowerCase();

  return (
    <div className="location-prediction-card glass-panel">
      {/* 1. Header with Location Name & Coordinates */}
      <div className="location-card-header">
        <div className="location-title">
          <span className="loc-pin">📍</span>
          <div>
            <h4>{nearest?.ward_name || 'Selected Location'}</h4>
            <p className="loc-coords">
              {loc ? `${loc.latitude.toFixed(4)}°N, ${loc.longitude.toFixed(4)}°E` : ''}
              {nearest?.zone ? ` • ${nearest.zone} Zone` : ''}
            </p>
          </div>
        </div>
        <button className="card-close-btn" onClick={onClose} title="Close Panel">
          ✕
        </button>
      </div>

      {loading ? (
        <div className="card-loading-body">
          <span className="spinner-icon">🔄</span>
          <p>Running ML Nowcast inference on local spatial features...</p>
        </div>
      ) : (
        <div className="location-card-body">
          {/* 2. Main Risk Highlight with Animated Radial Gauge */}
          <div className="risk-metric-banner" style={{ borderColor: `${riskColor}50` }}>
            <div className="risk-gauge-block">
              <div className="risk-badge-col">
                <span className="risk-badge-large" style={{ backgroundColor: riskColor }}>
                  {riskLevel} Flood Risk
                </span>
                <p className="status-quote">"{pred?.status_text || 'Active spatial nowcast'}"</p>
              </div>

              {/* Radial Donut Gauge */}
              <div
                className="radial-gauge-container"
                title={`Risk Score: ${probPercent}% (Thresholds: Low <30%, Moderate 30-50%, High 50-75%, Critical >75%)`}
              >
                <svg className="radial-gauge-svg" width="68" height="68" viewBox="0 0 68 68">
                  <circle
                    cx="34"
                    cy="34"
                    r={radius}
                    className="radial-track"
                    strokeWidth="6"
                  />
                  <circle
                    cx="34"
                    cy="34"
                    r={radius}
                    className="radial-arc"
                    strokeWidth="6"
                    stroke={riskColor}
                    strokeDasharray={circumference}
                    strokeDashoffset={strokeDashoffset}
                    strokeLinecap="round"
                  />
                </svg>
                <div className="radial-gauge-text">
                  <span className="radial-num" style={{ color: riskColor }}>{probPercent}</span>
                  <span className="radial-pct">%</span>
                </div>
              </div>
            </div>
          </div>

          {/* 3. UNIFIED NOWCAST VISUAL CHART WITH INTERACTIVE DROPDOWN SELECTOR */}
          <div className="feature-detail-section unified-chart-section">
            <div className="feature-section-header">
              <div className="header-left">
                <span
                  className="feature-status-dot"
                  style={{ backgroundColor: chartMode === 'road-mm' ? roadWaterSeverityColor : '#3b82f6' }}
                />
                {/* Interactive Chart Mode Dropdown */}
                <div className="chart-mode-dropdown-wrapper">
                  <select
                    className="chart-mode-select"
                    value={chartMode}
                    onChange={(e) => setChartMode(e.target.value)}
                    title="Switch visual chart view"
                  >
                    <option value="road-mm">🛣️ Road Water Level (mm scale)</option>
                    <option value="forecast-cm">📈 3-Hour Depth Curve (cm scale)</option>
                  </select>
                </div>
              </div>

              <div className="header-right clickable" onClick={() => setIsChartCollapsed(!isChartCollapsed)}>
                {chartMode === 'road-mm' ? (
                  <span
                    className="road-mm-badge"
                    style={{
                      backgroundColor: `${roadWaterSeverityColor}25`,
                      color: roadWaterSeverityColor,
                      borderColor: roadWaterSeverityColor
                    }}
                  >
                    {currentRoadDepthMm} mm
                  </span>
                ) : (
                  <span className="depth-peak-pill" style={{ color: riskColor }}>
                    Peak: {peakDepthCm} cm
                  </span>
                )}
                <span className={`accordion-chevron ${isChartCollapsed ? 'collapsed' : ''}`}>▼</span>
              </div>
            </div>

            {!isChartCollapsed && (
              <div className="unified-chart-body">
                {/* A. ROAD WATER LEVEL PROFILE (mm scale) */}
                {chartMode === 'road-mm' && (
                  <div className="road-mm-view-container">
                    {/* Physical Ground Clearance Status Row */}
                    <div className="road-clearance-status-row">
                      <div className="clearance-item">
                        <span className="clearance-lbl">Current Level:</span>
                        <strong className="clearance-val" style={{ color: roadWaterSeverityColor }}>{currentRoadDepthMm} mm</strong>
                      </div>
                      <div className="clearance-item">
                        <span className="clearance-lbl">3H Peak Level:</span>
                        <strong className="clearance-val" style={{ color: peakRoadDepthMm > 400 ? '#ef4444' : '#f97316' }}>{peakRoadDepthMm} mm</strong>
                      </div>
                      <div className="clearance-item">
                        <span className="clearance-lbl">Exhaust Hazard:</span>
                        <strong className="clearance-val threshold-val">250 mm</strong>
                      </div>
                    </div>

                    {/* Recharts Bar Chart in mm scale */}
                    <div className="road-mm-barchart-container">
                      <ResponsiveContainer width="100%" height={92}>
                        <BarChart data={roadTrendDataMm} margin={{ top: 8, right: 10, left: -22, bottom: 0 }}>
                          <XAxis dataKey="time" stroke="#64748b" tick={{ fontSize: 9, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                          <YAxis
                            stroke="#64748b"
                            tick={{ fontSize: 8, fill: '#94a3b8' }}
                            axisLine={false}
                            tickLine={false}
                            unit=" mm"
                            domain={[0, Math.max(600, peakRoadDepthMm + 80)]}
                          />
                          <ReferenceLine y={150} stroke="#22c55e" strokeDasharray="3 2" strokeWidth={1} />
                          <ReferenceLine y={250} stroke="#eab308" strokeDasharray="3 2" strokeWidth={1.2} />
                          <ReferenceLine y={450} stroke="#ef4444" strokeDasharray="3 2" strokeWidth={1.5} />
                          
                          <Tooltip
                            content={({ active, payload }) => {
                              if (active && payload && payload.length) {
                                const data = payload[0].payload;
                                return (
                                  <div className="road-mm-tooltip">
                                    <div className="tooltip-hdr">
                                      <span>{data.time} ({data.label})</span>
                                    </div>
                                    <div className="tooltip-val-row">
                                      <span>Water Level:</span>
                                      <strong style={{ color: data.waterLevelMm >= 450 ? '#ef4444' : data.waterLevelMm >= 250 ? '#f97316' : '#22c55e' }}>
                                        {data.waterLevelMm} mm ({(data.waterLevelMm / 10).toFixed(1)} cm)
                                      </strong>
                                    </div>
                                    <div className="tooltip-status-tag" style={{
                                      backgroundColor: data.waterLevelMm >= 450 ? '#ef4444' : data.waterLevelMm >= 250 ? '#f97316' : data.waterLevelMm >= 150 ? '#eab308' : '#22c55e'
                                    }}>
                                      {data.waterLevelMm >= 450 ? '🚫 Road Submerged (Closed)' : data.waterLevelMm >= 250 ? '⚠️ Exhaust Hazard (High Risk)' : data.waterLevelMm >= 150 ? '⚡ Curb Overflow (Caution)' : '✅ Clear Passable'}
                                    </div>
                                  </div>
                                );
                              }
                              return null;
                            }}
                          />
                          <Bar dataKey="waterLevelMm" radius={[4, 4, 0, 0]}>
                            {roadTrendDataMm.map((entry, index) => {
                              const barColor = entry.waterLevelMm >= 450 ? '#ef4444' :
                                entry.waterLevelMm >= 250 ? '#f97316' :
                                entry.waterLevelMm >= 150 ? '#eab308' : '#22c55e';
                              return <Cell key={`cell-${index}`} fill={barColor} />;
                            })}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>

                    {/* Threshold Reference Indicator in mm */}
                    <div className="road-mm-threshold-legend">
                      <div className="th-item"><span className="th-dot" style={{ background: '#22c55e' }} /> 0–150 mm (Safe)</div>
                      <div className="th-item"><span className="th-dot" style={{ background: '#eab308' }} /> 150–250 mm (Curb)</div>
                      <div className="th-item"><span className="th-dot" style={{ background: '#f97316' }} /> 250–450 mm (Exhaust)</div>
                      <div className="th-item"><span className="th-dot" style={{ background: '#ef4444' }} /> &gt;450 mm (Closure)</div>
                    </div>
                  </div>
                )}

                {/* B. 3-HOUR WATER DEPTH NOWCAST CURVE (cm scale) */}
                {chartMode === 'forecast-cm' && (
                  <div className="forecast-cm-view-container">
                    <div className="forecast-chart-container">
                      <ResponsiveContainer width="100%" height={85}>
                        <AreaChart data={trendDataCm} margin={{ top: 8, right: 8, left: -26, bottom: 0 }}>
                          <defs>
                            <linearGradient id="depthGradientUnified" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor={riskColor} stopOpacity={0.45} />
                              <stop offset="95%" stopColor={riskColor} stopOpacity={0.02} />
                            </linearGradient>
                          </defs>
                          <XAxis dataKey="time" stroke="#64748b" tick={{ fontSize: 9, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                          <YAxis stroke="#64748b" tick={{ fontSize: 8, fill: '#64748b' }} axisLine={false} tickLine={false} domain={[0, 'dataMax + 10']} />
                          <Tooltip
                            content={({ active, payload }) => {
                              if (active && payload && payload.length) {
                                return (
                                  <div className="chart-custom-tooltip">
                                    <span className="tooltip-time">{payload[0].payload.time}</span>
                                    <strong className="tooltip-depth" style={{ color: riskColor }}>
                                      {payload[0].value} cm ({Math.round(payload[0].value * 10)} mm)
                                    </strong>
                                  </div>
                                );
                              }
                              return null;
                            }}
                          />
                          <Area
                            type="monotone"
                            dataKey="depth"
                            stroke={riskColor}
                            strokeWidth={2.5}
                            fillOpacity={1}
                            fill="url(#depthGradientUnified)"
                            dot={{ r: 3, fill: riskColor, strokeWidth: 1, stroke: '#ffffff' }}
                            activeDot={{ r: 4.5, fill: '#ffffff', stroke: riskColor, strokeWidth: 2 }}
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* 4. Quick Metrics 2x2 Grid */}
          <div className="loc-metrics-grid">
            <div className="loc-metric-item">
              <span className="metric-lbl">Est. Road Depth</span>
              <strong className="metric-num" style={{ color: roadWaterSeverityColor }}>
                {currentRoadDepthMm} mm ({baseWaterDepthCm} cm)
              </strong>
            </div>

            <div className="loc-metric-item">
              <span className="metric-lbl">Drain Duration</span>
              <strong className="metric-num">
                {pred?.estimated_duration_hours || 4.2} hrs
              </strong>
            </div>

            <div className="loc-metric-item">
              <span className="metric-lbl">Elevation</span>
              <strong className="metric-num">
                {nearest?.elevation_m || 5.2} m
              </strong>
            </div>

            <div className="loc-metric-item">
              <span className="metric-lbl">Rainfall Surge</span>
              <strong className="metric-num" style={{ color: '#38bdf8' }}>
                {matchedForecast?.forecast_rainfall_mm || 82} mm
              </strong>
            </div>
          </div>

          {/* 5. Interactive Collapsible Feature Accordions */}
          <div className="location-features-accordions">
            {/* a) Drainage & Pumping Hub */}
            <div className="feature-detail-section drainage-section">
              <div
                className="feature-section-header clickable"
                onClick={() => toggleSection('drainage')}
              >
                <div className="header-left">
                  <span className="feature-status-dot" style={{ backgroundColor: '#06b6d4' }} />
                  <span className="feature-icon">🚰</span>
                  <h5>Drainage &amp; Pumping Hub</h5>
                </div>
                <span className={`accordion-chevron ${collapsedSections.drainage ? 'collapsed' : ''}`}>▼</span>
              </div>

              {!collapsedSections.drainage && (
                <div className="feature-section-content">
                  <div className="detail-row">
                    <span>Drainage Facility:</span>
                    <strong>{matchedDrain?.name || "Palmer's Bridge / Local Sluice"}</strong>
                  </div>

                  {/* Drain Load Utilization Progress Bar */}
                  <div className="progress-feature-block">
                    <div className="detail-row">
                      <span>Drain Load Utilization:</span>
                      <strong style={{ color: drainLoadColor }}>{drainLoad}%</strong>
                    </div>
                    <div
                      className="drain-progress-track"
                      title={`Load: ${drainLoad}% (<50% Normal, 50-75% Warning, >75% Surcharge)`}
                    >
                      <div
                        className="drain-progress-fill"
                        style={{
                          width: `${Math.min(100, Math.max(0, drainLoad))}%`,
                          backgroundColor: drainLoadColor
                        }}
                      />
                    </div>
                  </div>

                  {/* Pumping Capacity with 8-Segment Dot Indicator */}
                  <div className="pump-segments-block">
                    <div className="detail-row">
                      <span>Pumping Capacity:</span>
                      <strong>{matchedDrain?.pump_capacity_cusecs || 950} cusecs ({activePumps}/{totalPumps} Active)</strong>
                    </div>
                    <div className="pump-dots-row">
                      {Array.from({ length: totalPumps }).map((_, idx) => {
                        const isActive = idx < activePumps;
                        return (
                          <span
                            key={idx}
                            className={`pump-dot ${isActive ? 'active-dot' : 'inactive-dot'}`}
                            title={isActive ? `Pump ${idx + 1}: Operational` : `Pump ${idx + 1}: Standby / Inactive`}
                          />
                        );
                      })}
                    </div>
                  </div>

                  {/* Silt Accumulation 3-Step Level Meter */}
                  <div className="silt-meter-block">
                    <div className="detail-row">
                      <span>Silt Accumulation:</span>
                      <strong style={{ textTransform: 'capitalize' }}>{matchedDrain?.silt_accumulation_level || 'Moderate'}</strong>
                    </div>
                    <div className="silt-level-steps">
                      <div className={`silt-step ${siltLevel === 'low' ? 'active-low' : ''}`}>
                        Low
                      </div>
                      <div className={`silt-step ${siltLevel === 'moderate' ? 'active-moderate' : ''}`}>
                        Moderate
                      </div>
                      <div className={`silt-step ${siltLevel === 'high' || siltLevel === 'very high' ? 'active-high' : ''}`}>
                        High
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* b) Road Network & Passability */}
            <div className="feature-detail-section road-section">
              <div
                className="feature-section-header clickable"
                onClick={() => toggleSection('road')}
              >
                <div className="header-left">
                  <span className="feature-status-dot" style={{ backgroundColor: roadWaterSeverityColor }} />
                  <span className="feature-icon">🛣️</span>
                  <h5>Road Network &amp; Passability</h5>
                </div>
                <span className={`accordion-chevron ${collapsedSections.road ? 'collapsed' : ''}`}>▼</span>
              </div>

              {!collapsedSections.road && (
                <div className="feature-section-content">
                  <div className="detail-row">
                    <span>Primary Corridor:</span>
                    <strong>{matchedRoad?.name || 'Local Arterial Thoroughfare'}</strong>
                  </div>
                  <div className="detail-row">
                    <span>Waterlogging Status:</span>
                    <span className="road-status-tag" style={{ backgroundColor: roadWaterSeverityColor }}>
                      {matchedRoad?.waterlogging_status || 'Passable with Caution'}
                    </span>
                  </div>
                  <div className="detail-row">
                    <span>Water Depth on Surface:</span>
                    <strong style={{ color: roadWaterSeverityColor }}>{currentRoadDepthMm} mm ({baseWaterDepthCm} cm)</strong>
                  </div>
                  {matchedRoad?.traffic_advisory && (
                    <p className="road-advisory-text">
                      <strong>Advisory:</strong> {matchedRoad.traffic_advisory}
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* c) Zone Area Profile */}
            <div className="feature-detail-section zone-section">
              <div
                className="feature-section-header clickable"
                onClick={() => toggleSection('zone')}
              >
                <div className="header-left">
                  <span className="feature-status-dot" style={{ backgroundColor: '#8b5cf6' }} />
                  <span className="feature-icon">🗺️</span>
                  <h5>Zone Area Profile</h5>
                </div>
                <span className={`accordion-chevron ${collapsedSections.zone ? 'collapsed' : ''}`}>▼</span>
              </div>
              {!collapsedSections.zone && (
                <div className="feature-section-content">
                  <div className="detail-row">
                    <span>Zone Classification:</span>
                    <strong>{nearest?.zone || 'Kolkata Core'}</strong>
                  </div>
                  <div className="detail-row">
                    <span>Administrative Body:</span>
                    <strong>{matchedLandscape?.administrative_body || 'KMC'}</strong>
                  </div>
                  <div className="detail-row">
                    <span>Ward Identifier:</span>
                    <strong>Ward {nearest?.matched_ward_id || nearest?.ward_id || 120}</strong>
                  </div>
                </div>
              )}
            </div>

            {/* d) Landscape & Surface Characteristics */}
            <div className="feature-detail-section landscape-section">
              <div
                className="feature-section-header clickable"
                onClick={() => toggleSection('landscape')}
              >
                <div className="header-left">
                  <span className="feature-status-dot" style={{ backgroundColor: '#10b981' }} />
                  <span className="feature-icon">🌳</span>
                  <h5>Landscape &amp; Surface Characteristics</h5>
                </div>
                <span className={`accordion-chevron ${collapsedSections.landscape ? 'collapsed' : ''}`}>▼</span>
              </div>

              {!collapsedSections.landscape && (
                <div className="feature-section-content">
                  <div className="detail-row">
                    <span>Landscape Type:</span>
                    <strong>{matchedLandscape?.landscape_type || 'Dense low-lying residential'}</strong>
                  </div>
                  <div className="detail-row">
                    <span>Land Use:</span>
                    <strong>{matchedLandscape?.land_use_category || 'Mixed Residential'}</strong>
                  </div>
                  <div className="detail-row">
                    <span>Impervious Surface:</span>
                    <strong>{matchedLandscape?.impervious_surface_percent || 82}%</strong>
                  </div>
                  <div className="detail-row">
                    <span>Green Cover Baseline:</span>
                    <strong style={{ color: '#10b981' }}>{matchedLandscape?.green_cover_baseline_percent || 12}%</strong>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* 6. Key Drivers */}
          {pred?.key_risk_drivers && pred.key_risk_drivers.length > 0 && (
            <div className="drivers-section">
              <h5>⚡ Primary Risk Drivers</h5>
              <ul className="drivers-list">
                {pred.key_risk_drivers.map((d, i) => (
                  <li key={i}>{d}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
