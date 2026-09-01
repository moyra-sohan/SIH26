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
  const [chartMode, setChartMode] = useState('eq-spectrum'); // 'eq-spectrum' | 'road-mm' | 'forecast-cm'
  const [hoveredEqChannel, setHoveredEqChannel] = useState(null);

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
      label: 'Initial Surge',
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

  // Equalizer 12-segment definition thresholds (in mm)
  const eqSegmentsConfig = [
    { id: 12, minMm: 470, color: '#ef4444', glow: 'rgba(239, 68, 68, 0.9)' },
    { id: 11, minMm: 420, color: '#ef4444', glow: 'rgba(239, 68, 68, 0.8)' },
    { id: 10, minMm: 370, color: '#f97316', glow: 'rgba(249, 115, 22, 0.85)' },
    { id: 9, minMm: 320, color: '#f97316', glow: 'rgba(249, 115, 22, 0.8)' },
    { id: 8, minMm: 280, color: '#f97316', glow: 'rgba(249, 115, 22, 0.75)' },
    { id: 7, minMm: 240, color: '#f59e0b', glow: 'rgba(245, 158, 11, 0.85)' },
    { id: 6, minMm: 200, color: '#f59e0b', glow: 'rgba(245, 158, 11, 0.75)' },
    { id: 5, minMm: 160, color: '#eab308', glow: 'rgba(234, 179, 8, 0.75)' },
    { id: 4, minMm: 120, color: '#10b981', glow: 'rgba(16, 185, 129, 0.8)' },
    { id: 3, minMm: 80, color: '#10b981', glow: 'rgba(16, 185, 129, 0.75)' },
    { id: 2, minMm: 40, color: '#10b981', glow: 'rgba(16, 185, 129, 0.7)' },
    { id: 1, minMm: 0, color: '#10b981', glow: 'rgba(16, 185, 129, 0.65)' }
  ];

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

          {/* 3. DYNAMIC MUSIC EQUALIZER & AUDIO WAVEFORM VISUALIZER SECTION */}
          <div className="feature-detail-section unified-chart-section eq-chart-theme">
            <div className="feature-section-header">
              <div className="header-left">
                <span
                  className="feature-status-dot eq-live-pulse-dot"
                  style={{ backgroundColor: chartMode === 'forecast-cm' ? '#38bdf8' : roadWaterSeverityColor }}
                />
                {/* Interactive Visualizer Mode Switcher */}
                <div className="chart-mode-dropdown-wrapper">
                  <select
                    className="chart-mode-select eq-select"
                    value={chartMode}
                    onChange={(e) => setChartMode(e.target.value)}
                    title="Switch visual chart view"
                  >
                    <option value="eq-spectrum">🎛️ Equalizer Spectrum (Live VU Meter)</option>
                    <option value="road-mm">📊 Neon Multi-Bar Scale (mm)</option>
                    <option value="forecast-cm">🌊 Oscilloscope Soundwave (Audio Curve)</option>
                  </select>
                </div>
              </div>

              <div className="header-right clickable" onClick={() => setIsChartCollapsed(!isChartCollapsed)}>
                {chartMode === 'forecast-cm' ? (
                  <span className="depth-peak-pill eq-neon-pill" style={{ color: '#38bdf8' }}>
                    Peak: {peakDepthCm} cm
                  </span>
                ) : (
                  <span
                    className="road-mm-badge eq-neon-pill"
                    style={{
                      backgroundColor: `${roadWaterSeverityColor}20`,
                      color: roadWaterSeverityColor,
                      borderColor: roadWaterSeverityColor
                    }}
                  >
                    {currentRoadDepthMm} mm
                  </span>
                )}
                <span className={`accordion-chevron ${isChartCollapsed ? 'collapsed' : ''}`}>▼</span>
              </div>
            </div>

            {!isChartCollapsed && (
              <div className="unified-chart-body">
                {/* Studio Live Telemetry Row */}
                <div className="road-clearance-status-row eq-telemetry-row">
                  <div className="clearance-item">
                    <span className="clearance-lbl">Live Level:</span>
                    <strong className="clearance-val eq-live-val" style={{ color: roadWaterSeverityColor }}>
                      {currentRoadDepthMm} mm
                    </strong>
                  </div>
                  <div className="clearance-item">
                    <span className="clearance-lbl">3H Peak Level:</span>
                    <strong className="clearance-val" style={{ color: peakRoadDepthMm >= 450 ? '#ef4444' : '#f97316' }}>
                      {peakRoadDepthMm} mm
                    </strong>
                  </div>
                  <div className="clearance-item">
                    <span className="clearance-lbl">Hazard Limit:</span>
                    <strong className="clearance-val threshold-val">250 mm</strong>
                  </div>
                </div>

                {/* VIEW 1: DYNAMIC MUSIC EQUALIZER SPECTRUM (LIVE VU METER BARS) */}
                {chartMode === 'eq-spectrum' && (
                  <div className="eq-visualizer-main-container">
                    {/* Equalizer Chassis with VU Scale and LED Columns */}
                    <div className="eq-chassis-stage">
                      {/* Left VU Meter Scale Labels */}
                      <div className="eq-vu-scale-labels">
                        <div className="vu-tick-item tick-critical" title="Road Submerged (Closure)">
                          <span className="vu-led-dot red-dot" />
                          <span className="vu-txt">450+</span>
                        </div>
                        <div className="vu-tick-item tick-hazard" title="Exhaust Hazard Threshold">
                          <span className="vu-led-dot amber-dot" />
                          <span className="vu-txt">250</span>
                        </div>
                        <div className="vu-tick-item tick-curb" title="Curb Level Overflow">
                          <span className="vu-led-dot yellow-dot" />
                          <span className="vu-txt">150</span>
                        </div>
                        <div className="vu-tick-item tick-safe" title="Base / Safe Clearance">
                          <span className="vu-led-dot green-dot" />
                          <span className="vu-txt">0 mm</span>
                        </div>
                      </div>

                      {/* 4-Channel Equalizer Stack Columns */}
                      <div className="eq-channels-grid">
                        {roadTrendDataMm.map((channel, colIdx) => {
                          const channelDepthMm = channel.waterLevelMm;
                          const activeSegmentsCount = eqSegmentsConfig.filter(s => channelDepthMm >= s.minMm).length;
                          const isHovered = hoveredEqChannel === colIdx;

                          return (
                            <div
                              key={channel.time}
                              className={`eq-channel-column ${isHovered ? 'channel-hovered' : ''}`}
                              onMouseEnter={() => setHoveredEqChannel(colIdx)}
                              onMouseLeave={() => setHoveredEqChannel(null)}
                              style={{ animationDelay: `${colIdx * 0.12}s` }}
                            >
                              {/* Digital Value Readout Top Cap */}
                              <div className="eq-col-top-readout">
                                <span
                                  className="eq-top-mm-tag"
                                  style={{
                                    color: channelDepthMm >= 450 ? '#ef4444' : channelDepthMm >= 250 ? '#f97316' : channelDepthMm >= 150 ? '#eab308' : '#10b981'
                                  }}
                                >
                                  {channelDepthMm}
                                </span>
                              </div>

                              {/* Floating Peak Hold Cap LED */}
                              <div
                                className="eq-peak-hold-cap"
                                style={{
                                  backgroundColor: channelDepthMm >= 450 ? '#ef4444' : channelDepthMm >= 250 ? '#f97316' : channelDepthMm >= 150 ? '#f59e0b' : '#10b981',
                                  boxShadow: `0 0 10px ${channelDepthMm >= 450 ? '#ef4444' : channelDepthMm >= 250 ? '#f97316' : '#10b981'}`
                                }}
                              />

                              {/* 12 LED Segment Blocks */}
                              <div className="eq-led-stack">
                                {eqSegmentsConfig.map((seg) => {
                                  const isLit = channelDepthMm >= seg.minMm;
                                  return (
                                    <div
                                      key={seg.id}
                                      className={`eq-led-segment ${isLit ? 'led-lit' : 'led-dark'}`}
                                      style={{
                                        backgroundColor: isLit ? seg.color : 'rgba(255, 255, 255, 0.04)',
                                        boxShadow: isLit ? `0 0 8px ${seg.glow}, 0 0 1px #fff` : 'none',
                                        borderColor: isLit ? `${seg.color}90` : 'rgba(255, 255, 255, 0.06)'
                                      }}
                                    />
                                  );
                                })}
                              </div>

                              {/* Channel Bottom Time Label */}
                              <div className="eq-channel-footer">
                                <strong className="eq-channel-time">{channel.time}</strong>
                                <span className="eq-channel-sub">{channel.label.split(' ')[0]}</span>
                              </div>

                              {/* Hover Floating Equalizer Tooltip */}
                              {isHovered && (
                                <div className="eq-channel-popover">
                                  <div className="popover-time-row">
                                    <span>{channel.time} • {channel.label}</span>
                                    <strong style={{ color: channelDepthMm >= 450 ? '#ef4444' : channelDepthMm >= 250 ? '#f97316' : '#10b981' }}>
                                      {channelDepthMm} mm
                                    </strong>
                                  </div>
                                  <div className="popover-status-badge" style={{
                                    backgroundColor: channelDepthMm >= 450 ? '#ef4444' : channelDepthMm >= 250 ? '#f97316' : channelDepthMm >= 150 ? '#eab308' : '#10b981'
                                  }}>
                                    {channelDepthMm >= 450 ? '🚫 Road Submerged' : channelDepthMm >= 250 ? '⚠️ Exhaust Hazard' : channelDepthMm >= 150 ? '⚡ Curb Overflow' : '✅ Clear Passable'}
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Equalizer Frequency Scanline Atmosphere */}
                    <div className="eq-ambient-soundwave-indicator">
                      <span className="eq-wave-bar bar-1" />
                      <span className="eq-wave-bar bar-2" />
                      <span className="eq-wave-bar bar-3" />
                      <span className="eq-wave-bar bar-4" />
                      <span className="eq-wave-bar bar-5" />
                      <span className="eq-wave-bar bar-6" />
                      <span className="eq-wave-text">Studio VU Equalizer • Real-time Inundation Spectrum</span>
                    </div>

                    {/* Threshold Reference Indicator in mm */}
                    <div className="road-mm-threshold-legend eq-legend">
                      <div className="th-item"><span className="th-dot" style={{ background: '#10b981', boxShadow: '0 0 6px #10b981' }} /> 0–150 mm (Safe)</div>
                      <div className="th-item"><span className="th-dot" style={{ background: '#eab308', boxShadow: '0 0 6px #eab308' }} /> 150–250 mm (Curb)</div>
                      <div className="th-item"><span className="th-dot" style={{ background: '#f97316', boxShadow: '0 0 6px #f97316' }} /> 250–450 mm (Exhaust)</div>
                      <div className="th-item"><span className="th-dot" style={{ background: '#ef4444', boxShadow: '0 0 6px #ef4444' }} /> &gt;450 mm (Closure)</div>
                    </div>
                  </div>
                )}

                {/* VIEW 2: NEON MULTI-BAR SCALE (mm) WITH HIGH CONTRAST */}
                {chartMode === 'road-mm' && (
                  <div className="road-mm-view-container">
                    <div className="road-mm-barchart-container eq-barchart-wrap">
                      <ResponsiveContainer width="100%" height={105}>
                        <BarChart data={roadTrendDataMm} margin={{ top: 12, right: 12, left: -20, bottom: 0 }}>
                          <defs>
                            <linearGradient id="neonGreenBar" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor="#34d399" stopOpacity={0.95} />
                              <stop offset="100%" stopColor="#059669" stopOpacity={0.65} />
                            </linearGradient>
                            <linearGradient id="neonYellowBar" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor="#fde047" stopOpacity={0.95} />
                              <stop offset="100%" stopColor="#d97706" stopOpacity={0.65} />
                            </linearGradient>
                            <linearGradient id="neonOrangeBar" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor="#fb923c" stopOpacity={0.95} />
                              <stop offset="100%" stopColor="#ea580c" stopOpacity={0.65} />
                            </linearGradient>
                            <linearGradient id="neonRedBar" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor="#f87171" stopOpacity={0.95} />
                              <stop offset="100%" stopColor="#dc2626" stopOpacity={0.65} />
                            </linearGradient>
                          </defs>
                          <XAxis
                            dataKey="time"
                            stroke="#cbd5e1"
                            tick={{ fontSize: 11, fill: '#f8fafc', fontWeight: 700 }}
                            axisLine={{ stroke: 'rgba(255, 255, 255, 0.2)' }}
                            tickLine={false}
                          />
                          <YAxis
                            stroke="#cbd5e1"
                            tick={{ fontSize: 9, fill: '#cbd5e1', fontWeight: 600 }}
                            axisLine={{ stroke: 'rgba(255, 255, 255, 0.15)' }}
                            tickLine={false}
                            unit="mm"
                            domain={[0, Math.max(600, peakRoadDepthMm + 60)]}
                          />
                          <ReferenceLine y={150} stroke="#10b981" strokeDasharray="4 2" strokeWidth={1.2} />
                          <ReferenceLine y={250} stroke="#f59e0b" strokeDasharray="4 2" strokeWidth={1.5} />
                          <ReferenceLine y={450} stroke="#ef4444" strokeDasharray="4 2" strokeWidth={1.8} />
                          
                          <Tooltip
                            content={({ active, payload }) => {
                              if (active && payload && payload.length) {
                                const data = payload[0].payload;
                                return (
                                  <div className="road-mm-tooltip eq-neon-tooltip">
                                    <div className="tooltip-hdr">
                                      <span>{data.time} ({data.label})</span>
                                    </div>
                                    <div className="tooltip-val-row">
                                      <span>Water Level:</span>
                                      <strong style={{ color: data.waterLevelMm >= 450 ? '#ef4444' : data.waterLevelMm >= 250 ? '#f97316' : '#10b981' }}>
                                        {data.waterLevelMm} mm ({(data.waterLevelMm / 10).toFixed(1)} cm)
                                      </strong>
                                    </div>
                                    <div className="tooltip-status-tag" style={{
                                      backgroundColor: data.waterLevelMm >= 450 ? '#ef4444' : data.waterLevelMm >= 250 ? '#f97316' : data.waterLevelMm >= 150 ? '#f59e0b' : '#10b981'
                                    }}>
                                      {data.waterLevelMm >= 450 ? '🚫 Road Submerged (Closed)' : data.waterLevelMm >= 250 ? '⚠️ Exhaust Hazard (High Risk)' : data.waterLevelMm >= 150 ? '⚡ Curb Overflow (Caution)' : '✅ Clear Passable'}
                                    </div>
                                  </div>
                                );
                              }
                              return null;
                            }}
                          />
                          <Bar dataKey="waterLevelMm" radius={[6, 6, 0, 0]}>
                            {roadTrendDataMm.map((entry, index) => {
                              const gradId = entry.waterLevelMm >= 450 ? 'url(#neonRedBar)' :
                                entry.waterLevelMm >= 250 ? 'url(#neonOrangeBar)' :
                                entry.waterLevelMm >= 150 ? 'url(#neonYellowBar)' : 'url(#neonGreenBar)';
                              return <Cell key={`cell-${index}`} fill={gradId} />;
                            })}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>

                    <div className="road-mm-threshold-legend eq-legend">
                      <div className="th-item"><span className="th-dot" style={{ background: '#10b981', boxShadow: '0 0 6px #10b981' }} /> 0–150 mm (Safe)</div>
                      <div className="th-item"><span className="th-dot" style={{ background: '#eab308', boxShadow: '0 0 6px #eab308' }} /> 150–250 mm (Curb)</div>
                      <div className="th-item"><span className="th-dot" style={{ background: '#f97316', boxShadow: '0 0 6px #f97316' }} /> 250–450 mm (Exhaust)</div>
                      <div className="th-item"><span className="th-dot" style={{ background: '#ef4444', boxShadow: '0 0 6px #ef4444' }} /> &gt;450 mm (Closure)</div>
                    </div>
                  </div>
                )}

                {/* VIEW 3: OSCILLOSCOPE SOUNDWAVE CURVE (cm scale) */}
                {chartMode === 'forecast-cm' && (
                  <div className="forecast-cm-view-container eq-oscilloscope-wrap">
                    <div className="forecast-chart-container">
                      <ResponsiveContainer width="100%" height={95}>
                        <AreaChart data={trendDataCm} margin={{ top: 10, right: 10, left: -24, bottom: 0 }}>
                          <defs>
                            <linearGradient id="eqOscilloscopeGradient" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#38bdf8" stopOpacity={0.65} />
                              <stop offset="50%" stopColor="#818cf8" stopOpacity={0.35} />
                              <stop offset="95%" stopColor="#06b6d4" stopOpacity={0.02} />
                            </linearGradient>
                          </defs>
                          <XAxis
                            dataKey="time"
                            stroke="#cbd5e1"
                            tick={{ fontSize: 10, fill: '#f8fafc', fontWeight: 700 }}
                            axisLine={{ stroke: 'rgba(255, 255, 255, 0.2)' }}
                            tickLine={false}
                          />
                          <YAxis
                            stroke="#cbd5e1"
                            tick={{ fontSize: 9, fill: '#cbd5e1', fontWeight: 600 }}
                            axisLine={{ stroke: 'rgba(255, 255, 255, 0.15)' }}
                            tickLine={false}
                            domain={[0, 'dataMax + 10']}
                            unit="cm"
                          />
                          <Tooltip
                            content={({ active, payload }) => {
                              if (active && payload && payload.length) {
                                return (
                                  <div className="chart-custom-tooltip eq-neon-tooltip">
                                    <span className="tooltip-time">{payload[0].payload.time}</span>
                                    <strong className="tooltip-depth" style={{ color: '#38bdf8' }}>
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
                            stroke="#38bdf8"
                            strokeWidth={3}
                            fillOpacity={1}
                            fill="url(#eqOscilloscopeGradient)"
                            dot={{ r: 3.5, fill: '#38bdf8', strokeWidth: 1.5, stroke: '#ffffff' }}
                            activeDot={{ r: 5.5, fill: '#ffffff', stroke: '#38bdf8', strokeWidth: 2.5 }}
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>

                    <div className="eq-ambient-soundwave-indicator">
                      <span className="eq-wave-bar bar-1" />
                      <span className="eq-wave-bar bar-3" />
                      <span className="eq-wave-bar bar-5" />
                      <span className="eq-wave-text">Harmonic Depth Curve • Peak Surge: {peakDepthCm} cm</span>
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
