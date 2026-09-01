import { useState, useEffect } from 'react';
import {
  X,
  Cpu,
  Activity,
  AlertTriangle,
  CheckCircle2,
  Sliders,
  ChevronRight,
  MapPin,
  Waves
} from 'lucide-react';
import api from '../../services/api';

function LiveMLPredictorModal({ isOpen, onClose, onApplyPrediction, currentWard }) {
  const [wards, setWards] = useState([]);
  const [selectedWardId, setSelectedWardId] = useState('behala-ward-120');
  const [rainfall, setRainfall] = useState(85);
  const [forecastRain, setForecastRain] = useState(95);
  const [humidity, setHumidity] = useState(84);
  const [drainLoad, setDrainLoad] = useState(85);
  const [isMonsoon, setIsMonsoon] = useState(1);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  // Load wards catalog on mount
  useEffect(() => {
    async function loadWards() {
      try {
        const data = await api.getWards();
        if (data && data.wards) {
          setWards(data.wards);
          if (currentWard) {
            const found = data.wards.find(
              (w) => w.id === currentWard || w.ward_id === currentWard || w.name.includes(currentWard)
            );
            if (found) setSelectedWardId(found.id);
          }
        }
      } catch (err) {
        console.error('Failed to load wards catalog:', err);
      }
    }
    loadWards();
  }, [currentWard]);

  // Trigger real-time ML prediction
  const handleRunPrediction = async () => {
    setLoading(true);
    setError(null);
    try {
      const payload = {
        ward_id: selectedWardId,
        rainfall_mm: parseFloat(rainfall),
        forecast_rainfall_mm: parseFloat(forecastRain),
        avg_humidity_percent: parseFloat(humidity),
        drain_load_utilization_percent: parseFloat(drainLoad),
        is_monsoon: isMonsoon,
      };

      const res = await api.predictFloodRisk(payload);
      setResult(res);
    } catch (err) {
      console.error('ML Prediction error:', err);
      setError('Could not connect to ML Backend. Please ensure python uvicorn service is active.');
    } finally {
      setLoading(false);
    }
  };

  // Run initial prediction when opening modal or selecting ward
  useEffect(() => {
    if (isOpen) {
      handleRunPrediction();
    }
  }, [isOpen, selectedWardId]);

  if (!isOpen) return null;

  const activeWardObj = wards.find((w) => w.id === selectedWardId) || wards[0];

  return (
    <div className="ml-modal-overlay" onClick={onClose}>
      <div className="ml-modal-container" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="ml-modal-header">
          <div className="ml-header-title">
            <div className="ml-badge-icon">
              <Cpu size={20} className="cpu-icon" />
            </div>
            <div>
              <h2>AI Flood Risk Nowcasting Engine</h2>
              <p>Powered by Kolkata Random Forest ML Pipeline (60 Urban & Meteorological Features)</p>
            </div>
          </div>
          <button className="ml-close-btn" onClick={onClose} aria-label="Close modal">
            <X size={20} />
          </button>
        </div>

        <div className="ml-modal-body">
          {/* Controls Column */}
          <div className="ml-controls-col">
            <div className="control-section-header">
              <Sliders size={16} />
              <span>Simulation Parameters</span>
            </div>

            {/* Ward Selector */}
            <div className="control-group">
              <label htmlFor="ward-select">Target Monitoring Ward / Zone</label>
              <select
                id="ward-select"
                value={selectedWardId}
                onChange={(e) => setSelectedWardId(e.target.value)}
                className="ml-select"
              >
                {wards.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name} — {w.zone} Zone (Elev: {w.elevation_m}m)
                  </option>
                ))}
              </select>
            </div>

            {/* Ward baseline badge */}
            {activeWardObj && (
              <div className="ward-quick-stats">
                <div className="quick-stat">
                  <MapPin size={13} />
                  <span>Admin: {activeWardObj.administrative_body}</span>
                </div>
                <div className="quick-stat">
                  <Waves size={13} />
                  <span>Drainage: {activeWardObj.drainage_index_1to10}/10</span>
                </div>
                <div className="quick-stat">
                  <span>River Proximity: {activeWardObj.near_hooghly_river}</span>
                </div>
              </div>
            )}

            {/* Rainfall 24h Slider */}
            <div className="control-group">
              <div className="slider-label-row">
                <span>Recorded Rainfall (24h)</span>
                <span className="slider-val">{rainfall} mm</span>
              </div>
              <input
                type="range"
                min="0"
                max="200"
                step="5"
                value={rainfall}
                onChange={(e) => {
                  setRainfall(e.target.value);
                  setForecastRain(Math.round(e.target.value * 1.1));
                }}
                className="ml-slider"
              />
              <div className="slider-ticks">
                <span>0mm (Dry)</span>
                <span>65mm (Normal)</span>
                <span>200mm (Severe)</span>
              </div>
            </div>

            {/* Forecast Rainfall Slider */}
            <div className="control-group">
              <div className="slider-label-row">
                <span>Next 24h Forecast Rainfall</span>
                <span className="slider-val">{forecastRain} mm</span>
              </div>
              <input
                type="range"
                min="0"
                max="250"
                step="5"
                value={forecastRain}
                onChange={(e) => setForecastRain(e.target.value)}
                className="ml-slider"
              />
            </div>

            {/* Humidity & Drainage Grid */}
            <div className="control-grid-2">
              <div className="control-group">
                <div className="slider-label-row">
                  <span>Humidity</span>
                  <span className="slider-val">{humidity}%</span>
                </div>
                <input
                  type="range"
                  min="40"
                  max="100"
                  step="2"
                  value={humidity}
                  onChange={(e) => setHumidity(e.target.value)}
                  className="ml-slider"
                />
              </div>

              <div className="control-group">
                <div className="slider-label-row">
                  <span>Drainage Load</span>
                  <span className="slider-val">{drainLoad}%</span>
                </div>
                <input
                  type="range"
                  min="20"
                  max="100"
                  step="5"
                  value={drainLoad}
                  onChange={(e) => setDrainLoad(e.target.value)}
                  className="ml-slider"
                />
              </div>
            </div>

            {/* Monsoon Toggle */}
            <div className="monsoon-toggle-row">
              <span>Monsoon Season Window:</span>
              <button
                type="button"
                className={`monsoon-btn ${isMonsoon === 1 ? 'active' : ''}`}
                onClick={() => setIsMonsoon(isMonsoon === 1 ? 0 : 1)}
              >
                {isMonsoon === 1 ? '🌧️ Monsoon Active' : '☀️ Non-Monsoon'}
              </button>
            </div>

            {/* Run Button */}
            <button
              className="run-inference-btn"
              onClick={handleRunPrediction}
              disabled={loading}
            >
              {loading ? (
                <div className="btn-spinner" />
              ) : (
                <>
                  <Cpu size={18} />
                  <span>Run Live AI Inference</span>
                </>
              )}
            </button>
          </div>

          {/* Results Column */}
          <div className="ml-results-col">
            <div className="control-section-header">
              <Activity size={16} />
              <span>Model Prediction Output</span>
            </div>

            {error && (
              <div className="ml-error-card">
                <AlertTriangle size={18} />
                <span>{error}</span>
              </div>
            )}

            {result && (
              <div className="ml-result-card">
                {/* Risk Level Banner */}
                <div
                  className="result-risk-banner"
                  style={{
                    backgroundColor: `${result.risk_color}18`,
                    borderColor: result.risk_color,
                  }}
                >
                  <div className="risk-banner-left">
                    <div
                      className="risk-indicator-dot"
                      style={{ backgroundColor: result.risk_color }}
                    />
                    <div>
                      <div className="risk-category-tag" style={{ color: result.risk_color }}>
                        {result.risk_level} Risk
                      </div>
                      <div className="risk-status-text">{result.status_text}</div>
                    </div>
                  </div>

                  <div className="risk-prob-gauge">
                    <div className="prob-value" style={{ color: result.risk_color }}>
                      {(result.flood_probability * 100).toFixed(1)}%
                    </div>
                    <div className="prob-label">Flood Probability</div>
                  </div>
                </div>

                {/* Progress meter */}
                <div className="prob-meter-bar">
                  <div
                    className="prob-meter-fill"
                    style={{
                      width: `${Math.min(100, result.flood_probability * 100)}%`,
                      backgroundColor: result.risk_color,
                    }}
                  />
                </div>

                {/* Quantitative Impact Estimates */}
                <div className="impact-grid">
                  <div className="impact-box">
                    <div className="impact-title">Est. Water Depth</div>
                    <div className="impact-num">{result.estimated_waterlogging_depth_cm} cm</div>
                  </div>
                  <div className="impact-box">
                    <div className="impact-title">Clearance Duration</div>
                    <div className="impact-num">{result.estimated_duration_hours} hrs</div>
                  </div>
                  <div className="impact-box">
                    <div className="impact-title">Model Confidence</div>
                    <div className="impact-num">
                      {Math.max(result.flood_probability, result.safe_probability) >= 0.85
                        ? 'High (95%)'
                        : 'Moderate (82%)'}
                    </div>
                  </div>
                </div>

                {/* Key Drivers */}
                <div className="key-drivers-section">
                  <h4>Key Risk Drivers (SHAP / Feature Attribution):</h4>
                  <div className="driver-chips">
                    {result.key_risk_drivers &&
                      result.key_risk_drivers.map((driver, idx) => (
                        <span key={idx} className="driver-chip">
                          ● {driver}
                        </span>
                      ))}
                  </div>
                </div>

                {/* Safety Advisories */}
                <div className="ml-advisories-section">
                  <h4>Municipal Safety Directives:</h4>
                  <ul>
                    {result.advisories &&
                      result.advisories.map((adv, i) => (
                        <li key={i}>
                          <ChevronRight size={14} className="adv-bullet" />
                          <span>{adv}</span>
                        </li>
                      ))}
                  </ul>
                </div>

                {/* Apply to Dashboard Button */}
                <button
                  className="apply-prediction-btn"
                  onClick={() => {
                    if (onApplyPrediction) {
                      onApplyPrediction(result, activeWardObj);
                    }
                    onClose();
                  }}
                >
                  <CheckCircle2 size={16} />
                  <span>Apply Simulation to Live Dashboard</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default LiveMLPredictorModal;
