import { useState } from 'react';
import { Sparkles, X, Activity, Sliders, AlertTriangle, CheckCircle, RefreshCw } from 'lucide-react';
import { useFloodData } from '../../context/FloodDataContext';

export default function SimulationModal({ isOpen, onClose }) {
  const { wards, selectedWard, runSimulation, isSimulating } = useFloodData();

  const [formData, setFormData] = useState({
    Ward_ID: selectedWard?.ward_id || 1,
    Historical_Rainfall_mm: selectedWard?.historical_rainfall_mm || 350,
    Estimated_Rainy_Days: 20,
    Rainfall_Category: 'Wet',
    Elevation_m: selectedWard?.elevation_m || 3,
    Groundwater_Table_Depth_m: 0.8,
    Water_Body_Proximity: selectedWard?.water_body_proximity || 'Yes (Hooghly-adjacent)',
    Impervious_Surface_Percent: selectedWard?.impervious_surface_percent || 85,
    Water_Surface_Percent: 3,
    Seasonal_Green_Cover_Percent: selectedWard?.green_cover_percent || 10,
    Road_Density_Index_1to10: selectedWard?.road_density_index || 7,
    Drainage_Index_1to10: selectedWard?.drainage_index || 4,
    Storm_Drain_Coverage_Percent: selectedWard?.storm_drain_coverage_percent || 45,
    Drain_Load_Utilization_Percent: selectedWard?.drain_load_utilization_percent || 95,
    Silt_Accumulation_Level: selectedWard?.silt_accumulation_level || 'Moderate',
    Reported_Road_Waterlogging_Incidents: selectedWard?.reported_waterlogging_incidents || 3,
    Avg_Humidity_Percent: 86,
    Heat_Index_C: 37,
    Avg_Temperature_C: 29.5,
    Estimated_Max_Temperature_C: 32.5,
    Estimated_Min_Temperature_C: 26.5,
    Forecast_Rainfall_mm: 280,
    Forecast_Rainfall_Category: 'Wet',
    Month: '2026-08',
  });

  const [simResult, setSimResult] = useState(null);

  if (!isOpen) return null;

  const handleChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleWardSelect = (wardId) => {
    const found = wards.find((w) => w.ward_id === parseInt(wardId, 10));
    if (found) {
      setFormData((prev) => ({
        ...prev,
        Ward_ID: found.ward_id,
        Historical_Rainfall_mm: found.historical_rainfall_mm,
        Elevation_m: found.elevation_m,
        Drain_Load_Utilization_Percent: found.drain_load_utilization_percent,
        Impervious_Surface_Percent: found.impervious_surface_percent,
        Seasonal_Green_Cover_Percent: found.green_cover_percent,
        Water_Body_Proximity: found.water_body_proximity,
        Reported_Road_Waterlogging_Incidents: found.reported_waterlogging_incidents,
        Drainage_Index_1to10: found.drainage_index,
        Road_Density_Index_1to10: found.road_density_index,
      }));
    }
  };

  const handleRunPrediction = async (e) => {
    e.preventDefault();
    const res = await runSimulation(formData);
    setSimResult(res);
  };

  const getRiskColor = (risk) => {
    if (risk === 'Major') return '#DC2626';
    if (risk === 'Moderate') return '#EA580C';
    if (risk === 'Minor') return '#CA8A04';
    return '#16A34A';
  };

  return (
    <div className="sim-modal-backdrop" onClick={onClose}>
      <div className="sim-modal-content" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="sim-modal-header">
          <div className="sim-header-title">
            <div className="sim-badge-icon">
              <Sparkles size={20} />
            </div>
            <div>
              <h3>AI Flood Risk Simulation Engine</h3>
              <p>Test real-time predictions using your trained Random Forest Data Model</p>
            </div>
          </div>
          <button className="sim-close-btn" onClick={onClose} aria-label="Close">
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleRunPrediction} className="sim-modal-body">
          <div className="sim-grid">
            {/* Left Column: Form Controls */}
            <div className="sim-form-col">
              <div className="sim-section-title">
                <Sliders size={16} />
                <span>Simulation Parameters</span>
              </div>

              {/* Ward Select */}
              <div className="sim-input-group">
                <label>Select Kolkata Ward Preset</label>
                <select
                  value={formData.Ward_ID}
                  onChange={(e) => handleWardSelect(e.target.value)}
                  className="sim-select"
                >
                  {wards.map((w) => (
                    <option key={w.ward_id} value={w.ward_id}>
                      Ward {w.ward_id} - {w.ward_name} ({w.zone})
                    </option>
                  ))}
                </select>
              </div>

              {/* Rainfall Slider */}
              <div className="sim-input-group">
                <div className="sim-label-row">
                  <label>Historical Rainfall</label>
                  <span className="sim-val-badge">{formData.Historical_Rainfall_mm} mm</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="500"
                  step="5"
                  value={formData.Historical_Rainfall_mm}
                  onChange={(e) => handleChange('Historical_Rainfall_mm', parseFloat(e.target.value))}
                  className="sim-slider"
                />
              </div>

              {/* Drain Load Slider */}
              <div className="sim-input-group">
                <div className="sim-label-row">
                  <label>Drain Load Utilization</label>
                  <span className="sim-val-badge">{formData.Drain_Load_Utilization_Percent}%</span>
                </div>
                <input
                  type="range"
                  min="20"
                  max="100"
                  step="1"
                  value={formData.Drain_Load_Utilization_Percent}
                  onChange={(e) => handleChange('Drain_Load_Utilization_Percent', parseFloat(e.target.value))}
                  className="sim-slider"
                />
              </div>

              {/* Elevation Slider */}
              <div className="sim-input-group">
                <div className="sim-label-row">
                  <label>Elevation (above sea level)</label>
                  <span className="sim-val-badge">{formData.Elevation_m} meters</span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="15"
                  step="0.5"
                  value={formData.Elevation_m}
                  onChange={(e) => handleChange('Elevation_m', parseFloat(e.target.value))}
                  className="sim-slider"
                />
              </div>

              {/* Road Incidents Slider */}
              <div className="sim-input-group">
                <div className="sim-label-row">
                  <label>Reported Waterlogging Incidents</label>
                  <span className="sim-val-badge">{formData.Reported_Road_Waterlogging_Incidents}</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="10"
                  step="1"
                  value={formData.Reported_Road_Waterlogging_Incidents}
                  onChange={(e) => handleChange('Reported_Road_Waterlogging_Incidents', parseInt(e.target.value, 10))}
                  className="sim-slider"
                />
              </div>

              {/* Categorical Dropdowns */}
              <div className="sim-row-2">
                <div className="sim-input-group">
                  <label>Silt Accumulation</label>
                  <select
                    value={formData.Silt_Accumulation_Level}
                    onChange={(e) => handleChange('Silt_Accumulation_Level', e.target.value)}
                    className="sim-select"
                  >
                    <option value="Low">Low</option>
                    <option value="Moderate">Moderate</option>
                    <option value="High">High</option>
                  </select>
                </div>

                <div className="sim-input-group">
                  <label>Rainfall Forecast</label>
                  <select
                    value={formData.Forecast_Rainfall_Category}
                    onChange={(e) => handleChange('Forecast_Rainfall_Category', e.target.value)}
                    className="sim-select"
                  >
                    <option value="Wet">Wet</option>
                    <option value="Moderate">Moderate</option>
                    <option value="Dry">Dry</option>
                  </select>
                </div>
              </div>

              <button
                type="submit"
                className="sim-run-btn"
                disabled={isSimulating}
              >
                {isSimulating ? (
                  <>
                    <RefreshCw size={16} className="spin" />
                    <span>Evaluating Model...</span>
                  </>
                ) : (
                  <>
                    <Activity size={16} />
                    <span>Run ML Model Prediction</span>
                  </>
                )}
              </button>
            </div>

            {/* Right Column: Live Prediction Results */}
            <div className="sim-result-col">
              <div className="sim-section-title">
                <Activity size={16} />
                <span>Live Model Output</span>
              </div>

              {simResult ? (
                <div className="sim-result-card">
                  <div
                    className="sim-risk-badge"
                    style={{
                      background: `${getRiskColor(simResult.predicted_risk)}15`,
                      color: getRiskColor(simResult.predicted_risk),
                      borderColor: `${getRiskColor(simResult.predicted_risk)}40`,
                    }}
                  >
                    <AlertTriangle size={24} />
                    <div>
                      <div className="sim-risk-label">Predicted Risk Level</div>
                      <div className="sim-risk-title">{simResult.predicted_risk} Risk</div>
                    </div>
                  </div>

                  <div className="sim-prob-section">
                    <h4>Confidence Probability Distribution</h4>
                    {simResult.probabilities &&
                      Object.entries(simResult.probabilities).map(([cls, prob]) => {
                        const pct = Math.round(prob * 100);
                        const isMain = cls === simResult.predicted_risk;
                        return (
                          <div className="sim-prob-row" key={cls}>
                            <div className="sim-prob-info">
                              <span className={isMain ? 'font-bold' : ''}>{cls}</span>
                              <span>{pct}%</span>
                            </div>
                            <div className="sim-prob-bar-bg">
                              <div
                                className="sim-prob-bar-fill"
                                style={{
                                  width: `${pct}%`,
                                  backgroundColor: getRiskColor(cls),
                                }}
                              />
                            </div>
                          </div>
                        );
                      })}
                  </div>

                  <div className="sim-insights">
                    <CheckCircle size={16} color="#16A34A" />
                    <span>
                      Model weights identify{' '}
                      <strong>
                        {formData.Historical_Rainfall_mm > 300
                          ? 'extreme rainfall volume'
                          : 'drain load saturation'}
                      </strong>{' '}
                      and elevation ({formData.Elevation_m}m) as primary risk drivers.
                    </span>
                  </div>
                </div>
              ) : (
                <div className="sim-placeholder">
                  <Sparkles size={36} className="text-muted" />
                  <h4>Ready for Simulation</h4>
                  <p>
                    Adjust rainfall, drainage, or elevation sliders on the left and click{' '}
                    <strong>Run ML Model Prediction</strong> to compute instant classification.
                  </p>
                </div>
              )}
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
