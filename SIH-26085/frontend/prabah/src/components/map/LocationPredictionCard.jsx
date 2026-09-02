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

  // Refined risk color palette — more professional and accessible
  const getRiskColor = (level) => {
    switch (level) {
      case 'Critical': return '#dc2626';
      case 'High': return '#ea580c';
      case 'Moderate': return '#d97706';
      default: return '#059669';
    }
  };
  const getRiskBg = (level) => {
    switch (level) {
      case 'Critical': return 'linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)';
      case 'High': return 'linear-gradient(135deg, #ea580c 0%, #c2410c 100%)';
      case 'Moderate': return 'linear-gradient(135deg, #d97706 0%, #b45309 100%)';
      default: return 'linear-gradient(135deg, #059669 0%, #047857 100%)';
    }
  };

  const riskColor = pred?.risk_color || getRiskColor(pred?.risk_level);
  const riskLevel = pred?.risk_level || 'High';

  // Calculate Radial Gauge Arc dimensions (r = 24, Circumference = 2 * PI * 24 ≈ 150.8)
  const radius = 24;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (probPercent / 100) * circumference;

  // Base depth calculations
  const baseWaterDepthCm = pred?.estimated_waterlogging_depth_cm || matchedRoad?.water_depth_cm || 28.0;
  const currentRoadDepthMm = Math.round(baseWaterDepthCm * 10);

  // 1. Nowcast 0–3hr Water Depth Progression Trend Data (in cm)
  const trendDataCm = [
    { time: 'Now', depth: Number((baseWaterDepthCm * 0.70).toFixed(1)) },
    { time: '+1h', depth: Number((baseWaterDepthCm * 1.30).toFixed(1)) },
    { time: '+2h', depth: Number((baseWaterDepthCm * 1.50).toFixed(1)) },
    { time: '+3h', depth: Number((baseWaterDepthCm * 0.85).toFixed(1)) },
  ];
  const peakDepthCm = Math.max(...trendDataCm.map(d => d.depth));

  // 2. ROAD WATER LEVEL IN MILLIMETERS (mm Scale) – refined status labels
  const roadTrendDataMm = [
    {
      time: 'Now',
      waterLevelMm: Math.round(baseWaterDepthCm * 7.0),
      label: 'Current',
      status: Math.round(baseWaterDepthCm * 7.0) > 400 ? 'Severe' : Math.round(baseWaterDepthCm * 7.0) > 200 ? 'Caution' : 'Passable'
    },
    {
      time: '+1h',
      waterLevelMm: Math.round(baseWaterDepthCm * 13.0),
      label: 'Rising',
      status: Math.round(baseWaterDepthCm * 13.0) > 400 ? 'Critical' : Math.round(baseWaterDepthCm * 13.0) > 250 ? 'Severe' : 'Caution'
    },
    {
      time: '+2h',
      waterLevelMm: Math.round(baseWaterDepthCm * 15.0),
      label: 'Peak',
      status: Math.round(baseWaterDepthCm * 15.0) > 450 ? 'Submerged' : Math.round(baseWaterDepthCm * 15.0) > 250 ? 'Severe' : 'Caution'
    },
    {
      time: '+3h',
      waterLevelMm: Math.round(baseWaterDepthCm * 8.5),
      label: 'Receding',
      status: Math.round(baseWaterDepthCm * 8.5) > 350 ? 'Severe' : Math.round(baseWaterDepthCm * 8.5) > 150 ? 'Caution' : 'Passable'
    }
  ];
  const peakRoadDepthMm = Math.max(...roadTrendDataMm.map(d => d.waterLevelMm));

  // Refined severity color mapping for chart bars
  const getBarColor = (mm) => {
    if (mm >= 450) return '#dc2626';
    if (mm >= 250) return '#ea580c';
    if (mm >= 150) return '#d97706';
    return '#059669';
  };

  const roadWaterSeverityColor = getBarColor(currentRoadDepthMm);

  // Drainage calculations
  const drainLoad = matchedDrain?.drain_load_utilization_percent !== undefined ? matchedDrain.drain_load_utilization_percent : 74;
  const drainLoadColor = drainLoad > 75 ? '#dc2626' : drainLoad >= 50 ? '#d97706' : '#059669';
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
          <div className="risk-metric-banner" style={{ borderColor: `${riskColor}30` }}>
            <div className="risk-gauge-block">
              <div className="risk-badge-col">
                <span className="risk-badge-large" style={{ background: getRiskBg(riskLevel) }}>
                  {riskLevel} Flood Risk
                </span>
                <p className="status-quote">"{pred?.status_text || 'Active spatial nowcast'}"</p>
              </div>

              {/* Radial Donut Gauge */}
              <div
                className="radial-gauge-container"
                title={`Risk Score: ${probPercent}% (Low <30%, Moderate 30-50%, High 50-75%, Critical >75%)`}
              >
                <svg className="radial-gauge-svg" width="68" height="68" viewBox="0 0 68 68">
                  <circle
                    cx="34"
                    cy="34"
                    r={radius}
                    className="radial-track"
                    strokeWidth="5"
                  />
                  <circle
                    cx="34"
                    cy="34"
                    r={radius}
                    className="radial-arc"
                    strokeWidth="5"
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
                  style={{ backgroundColor: chartMode === 'road-mm' ? roadWaterSeverityColor : '#2563eb' }}
                />
                {/* Interactive Chart Mode Dropdown */}
                <div className="chart-mode-dropdown-wrapper">
                  <select
                    className="chart-mode-select"
                    value={chartMode}
                    onChange={(e) => setChartMode(e.target.value)}
                    title="Switch visual chart view"
                  >
                    <option value="road-mm">🛣️ Road Water Level (mm)</option>
                    <option value="forecast-cm">📈 3-Hour Depth Curve (cm)</option>
                  </select>
                </div>
              </div>

              <div className="header-right clickable" onClick={() => setIsChartCollapsed(!isChartCollapsed)}>
                {chartMode === 'road-mm' ? (
                  <span
                    className="road-mm-badge"
                    style={{
                      backgroundColor: `${roadWaterSeverityColor}18`,
                      color: roadWaterSeverityColor,
                      borderColor: `${roadWaterSeverityColor}50`
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
                        <strong className="clearance-val" style={{ color: getBarColor(peakRoadDepthMm) }}>{peakRoadDepthMm} mm</strong>
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
                          <XAxis dataKey="time" stroke="#475569" tick={{ fontSize: 10, fill: '#94a3b8', fontWeight: 600 }} axisLine={false} tickLine={false} />
                          <YAxis
                            stroke="#475569"
                            tick={{ fontSize: 9, fill: '#64748b' }}
                            axisLine={false}
                            tickLine={false}
                            unit=" mm"
                            domain={[0, Math.max(600, peakRoadDepthMm + 80)]}
                          />
                          <ReferenceLine y={150} stroke="#059669" strokeDasharray="4 3" strokeWidth={1} strokeOpacity={0.5} />
                          <ReferenceLine y={250} stroke="#d97706" strokeDasharray="4 3" strokeWidth={1} strokeOpacity={0.5} />
                          <ReferenceLine y={450} stroke="#dc2626" strokeDasharray="4 3" strokeWidth={1} strokeOpacity={0.5} />
                          
                          <Tooltip
                            content={({ active, payload }) => {
                              if (active && payload && payload.length) {
                                const data = payload[0].payload;
                                const color = getBarColor(data.waterLevelMm);
                                return (
                                  <div className="road-mm-tooltip">
                                    <div className="tooltip-hdr">
                                      <span>{data.time} — {data.label}</span>
                                    </div>
                                    <div className="tooltip-val-row">
                                      <span>Water Level:</span>
                                      <strong style={{ color }}>
                                        {data.waterLevelMm} mm ({(data.waterLevelMm / 10).toFixed(1)} cm)
                                      </strong>
                                    </div>
                                    <div className="tooltip-status-tag" style={{ backgroundColor: color }}>
                                      {data.waterLevelMm >= 450 ? '🚫 Submerged' : data.waterLevelMm >= 250 ? '⚠️ High Risk' : data.waterLevelMm >= 150 ? '⚡ Caution' : '✅ Passable'}
                                    </div>
                                  </div>
                                );
                              }
                              return null;
                            }}
                          />
                          <Bar dataKey="waterLevelMm" radius={[5, 5, 0, 0]} barSize={28}>
                            {roadTrendDataMm.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={getBarColor(entry.waterLevelMm)} fillOpacity={0.85} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>

                    {/* Threshold Reference Legend */}
                    <div className="road-mm-threshold-legend">
                      <div className="th-item"><span className="th-dot" style={{ background: '#059669' }} /> 0–150 mm (Safe)</div>
                      <div className="th-item"><span className="th-dot" style={{ background: '#d97706' }} /> 150–250 mm (Curb)</div>
                      <div className="th-item"><span className="th-dot" style={{ background: '#ea580c' }} /> 250–450 mm (Exhaust)</div>
                      <div className="th-item"><span className="th-dot" style={{ background: '#dc2626' }} /> &gt;450 mm (Closure)</div>
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
                              <stop offset="5%" stopColor="#2563eb" stopOpacity={0.35} />
                              <stop offset="95%" stopColor="#2563eb" stopOpacity={0.02} />
                            </linearGradient>
                          </defs>
                          <XAxis dataKey="time" stroke="#475569" tick={{ fontSize: 10, fill: '#94a3b8', fontWeight: 600 }} axisLine={false} tickLine={false} />
                          <YAxis stroke="#475569" tick={{ fontSize: 9, fill: '#64748b' }} axisLine={false} tickLine={false} domain={[0, 'dataMax + 10']} />
                          <Tooltip
                            content={({ active, payload }) => {
                              if (active && payload && payload.length) {
                                return (
                                  <div className="chart-custom-tooltip">
                                    <span className="tooltip-time">{payload[0].payload.time}</span>
                                    <strong className="tooltip-depth" style={{ color: '#2563eb' }}>
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
                            stroke="#2563eb"
                            strokeWidth={2.5}
                            fillOpacity={1}
                            fill="url(#depthGradientUnified)"
                            dot={{ r: 3, fill: '#2563eb', strokeWidth: 2, stroke: '#ffffff' }}
                            activeDot={{ r: 5, fill: '#ffffff', stroke: '#2563eb', strokeWidth: 2.5 }}
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
              <strong className="metric-num" style={{ color: '#2563eb' }}>
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
                  <span className="feature-status-dot" style={{ backgroundColor: '#0891b2' }} />
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
                            title={isActive ? `Pump ${idx + 1}: Operational` : `Pump ${idx + 1}: Standby`}
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
                  <span className="feature-status-dot" style={{ backgroundColor: '#7c3aed' }} />
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
                  <span className="feature-status-dot" style={{ backgroundColor: '#059669' }} />
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
                    <strong style={{ color: '#059669' }}>{matchedLandscape?.green_cover_baseline_percent || 12}%</strong>
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
