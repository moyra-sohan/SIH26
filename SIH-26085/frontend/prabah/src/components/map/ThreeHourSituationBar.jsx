import React, { useState, useEffect } from 'react';

export default function ThreeHourSituationBar({
  currentStep,
  setCurrentStep,
  timelineData,
  onStepChange
}) {
  const [isPlaying, setIsPlaying] = useState(false);

  const steps = [
    { key: 't_plus_0h', label: 'T+0h', title: 'Current Baseline', time: '00:00' },
    { key: 't_plus_1h', label: 'T+1h', title: 'Peak Inundation', time: '+1 hr' },
    { key: 't_plus_2h', label: 'T+2h', title: 'Tidal Surcharge', time: '+2 hrs' },
    { key: 't_plus_3h', label: 'T+3h', title: 'Pump Receding', time: '+3 hrs' }
  ];

  // Auto-play interval
  useEffect(() => {
    let timer = null;
    if (isPlaying) {
      timer = setInterval(() => {
        setCurrentStep((prev) => {
          const currentIndex = steps.findIndex((s) => s.key === prev);
          const nextIndex = (currentIndex + 1) % steps.length;
          const nextStep = steps[nextIndex].key;
          if (onStepChange) onStepChange(nextStep);
          return nextStep;
        });
      }, 3500);
    }
    return () => clearInterval(timer);
  }, [isPlaying, steps, onStepChange, setCurrentStep]);

  const handleSelectStep = (stepKey) => {
    setCurrentStep(stepKey);
    if (onStepChange) onStepChange(stepKey);
  };

  const stepData = timelineData?.[currentStep] || {};

  const getAlertBadgeClass = (level) => {
    if (!level) return 'alert-yellow';
    if (level.includes('Red')) return 'alert-red';
    if (level.includes('Orange')) return 'alert-orange';
    return 'alert-yellow';
  };

  return (
    <div className="three-hour-situation-panel glass-panel">
      <div className="three-hour-header">
        <div className="three-hour-title">
          <span className="live-pulse-dot" />
          <span className="title-icon">⏱️</span>
          <div>
            <h4>3-Hour AI Nowcast Simulation (3H Situation)</h4>
            <p className="scenario-desc">{stepData.description || 'Dynamic real-time urban flood progression'}</p>
          </div>
        </div>

        <div className="three-hour-controls">
          <button
            className={`play-btn ${isPlaying ? 'playing' : ''}`}
            onClick={() => setIsPlaying(!isPlaying)}
            title={isPlaying ? 'Pause simulation' : 'Play 3H progression'}
          >
            {isPlaying ? '⏸ Pause' : '▶ Play Simulation'}
          </button>
          <span className={`alert-badge ${getAlertBadgeClass(stepData.emergency_alert_level)}`}>
            {stepData.emergency_alert_level || 'Active Nowcast'}
          </span>
        </div>
      </div>

      {/* Timeline Steps Selector */}
      <div className="timeline-steps-track">
        {steps.map((s, idx) => {
          const isActive = currentStep === s.key;
          return (
            <button
              key={s.key}
              className={`timeline-step-node ${isActive ? 'active' : ''}`}
              onClick={() => handleSelectStep(s.key)}
            >
              <div className="node-marker">
                <span className="node-num">{idx + 1}</span>
              </div>
              <div className="node-content">
                <span className="node-label">{s.label}</span>
                <span className="node-title">{s.title}</span>
              </div>
            </button>
          );
        })}
      </div>

      {/* Live Metrics Row for the selected 3H Step */}
      <div className="three-hour-metrics-grid">
        <div className="metric-chip">
          <span className="metric-icon">🌧️</span>
          <div className="metric-data">
            <span className="metric-val">{stepData.citywide_rainfall_rate_mm_hr || 28.5} mm/h</span>
            <span className="metric-sub">Rainfall Surge Rate</span>
          </div>
        </div>

        <div className="metric-chip">
          <span className="metric-icon">📏</span>
          <div className="metric-data">
            <span className="metric-val">{stepData.avg_waterlogging_depth_cm || 14.2} cm</span>
            <span className="metric-sub">Avg Flood Depth</span>
          </div>
        </div>

        <div className="metric-chip">
          <span className="metric-icon">🛣️</span>
          <div className="metric-data">
            <span className="metric-val">{stepData.total_submerged_road_km || 12.8} km</span>
            <span className="metric-sub">Submerged Corridors</span>
          </div>
        </div>

        <div className="metric-chip">
          <span className="metric-icon">🚨</span>
          <div className="metric-data">
            <span className="metric-val">{stepData.critical_wards_count || 2} Wards</span>
            <span className="metric-sub">Critical Zones</span>
          </div>
        </div>

        <div className="metric-chip">
          <span className="metric-icon">⚙️</span>
          <div className="metric-data">
            <span className="metric-val">{stepData.pump_utilization_avg_percent || 68}%</span>
            <span className="metric-sub">Avg Pump Load</span>
          </div>
        </div>
      </div>
    </div>
  );
}
