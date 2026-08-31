import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  MapPin,
  Filter,
  AlertTriangle,
  Layers,
  ArrowRight,
  TrendingUp,
  Droplets,
  Mountain,
  Gauge,
  Sparkles,
  RefreshCw,
} from 'lucide-react';
import KolkataMap from '../components/map/KolkataMap.jsx';
import { useFloodData } from '../context/FloodDataContext.jsx';
import '../styles/map.css';

export default function MapPage() {
  const navigate = useNavigate();
  const { wards, selectedWardId, setSelectedWardId, selectedWard, refreshData, loading } = useFloodData();
  const [activeFilter, setActiveFilter] = useState('ALL');

  const majorWards = wards.filter((w) => w.predicted_risk === 'Major');
  const moderateWards = wards.filter((w) => w.predicted_risk === 'Moderate');
  const minorWards = wards.filter((w) => w.predicted_risk === 'Minor');

  const handleFocusWard = (wardId) => {
    setSelectedWardId(wardId);
  };

  const getRiskColor = (risk) => {
    if (risk === 'Major') return '#EF4444';
    if (risk === 'Moderate') return '#F97316';
    if (risk === 'Minor') return '#EAB308';
    return '#22C55E';
  };

  return (
    <div className="map-page-wrapper">
      {/* Map Control Header */}
      <div className="map-top-bar">
        <div className="map-search-group">
          <MapPin size={16} className="text-blue-600" />
          <select
            value={selectedWardId || ''}
            onChange={(e) => setSelectedWardId(e.target.value ? parseInt(e.target.value, 10) : null)}
            className="map-ward-select"
            id="map-ward-dropdown"
          >
            <option value="">🗺️ Focus All Kolkata (18 Monitoring Zones)</option>
            {wards.map((w) => (
              <option key={w.ward_id} value={w.ward_id}>
                Ward {w.ward_id} • {w.ward_name} ({w.zone}) — [{w.predicted_risk} Risk]
              </option>
            ))}
          </select>
        </div>

        {/* Filter Pills */}
        <div className="map-filter-pills">
          <button
            className={`map-pill ${activeFilter === 'ALL' ? 'active' : ''}`}
            onClick={() => setActiveFilter('ALL')}
          >
            All Zones ({wards.length})
          </button>
          <button
            className={`map-pill major ${activeFilter === 'Major' ? 'active' : ''}`}
            onClick={() => setActiveFilter('Major')}
          >
            <span className="dot" /> Major ({majorWards.length})
          </button>
          <button
            className={`map-pill moderate ${activeFilter === 'Moderate' ? 'active' : ''}`}
            onClick={() => setActiveFilter('Moderate')}
          >
            <span className="dot" /> Moderate ({moderateWards.length})
          </button>
          <button
            className={`map-pill minor ${activeFilter === 'Minor' ? 'active' : ''}`}
            onClick={() => setActiveFilter('Minor')}
          >
            <span className="dot" /> Minor ({minorWards.length})
          </button>
        </div>

        <button
          className="map-refresh-btn"
          onClick={refreshData}
          title="Refresh Data & Model Predictions"
          aria-label="Refresh data"
        >
          <RefreshCw size={15} className={loading ? 'spin' : ''} />
        </button>
      </div>

      {/* Main Map Content Area */}
      <div className="map-layout-grid">
        {/* Map View */}
        <div className="map-viewport-container">
          <KolkataMap
            activeRiskFilter={activeFilter}
            onSelectWard={handleFocusWard}
          />

          {/* Floating Risk Legend */}
          <div className="risk-legend">
            <h4>ML Flood Risk</h4>
            <div>
              <span className="risk critical" /> Major Risk ({majorWards.length})
            </div>
            <div>
              <span className="risk high" /> Moderate ({moderateWards.length})
            </div>
            <div>
              <span className="risk medium" /> Minor Risk ({minorWards.length})
            </div>
            <div>
              <span className="risk low" /> Safe / Low
            </div>
          </div>

          {/* Floating Analytics Badges */}
          <div className="map-floating-stats">
            <div className="map-stat-chip">
              <span className="label">Critical Hotspots:</span>
              <strong className="text-red-600">{majorWards.map((w) => w.ward_name).slice(0, 3).join(', ')}</strong>
            </div>
            <div className="map-stat-chip">
              <span className="label">Active Model:</span>
              <span className="font-semibold text-blue-600">Random Forest (200 Trees)</span>
            </div>
          </div>
        </div>

        {/* Side Panel: Selected Ward or Overview Drawer */}
        <div className="map-side-panel">
          {selectedWard ? (
            <div className="ward-detail-card">
              <div className="ward-detail-header">
                <div>
                  <span className="ward-zone-tag">{selectedWard.zone} Zone • Ward {selectedWard.ward_id}</span>
                  <h2>{selectedWard.ward_name}</h2>
                </div>
                <div
                  className="ward-risk-pill"
                  style={{
                    background: `${getRiskColor(selectedWard.predicted_risk)}18`,
                    color: getRiskColor(selectedWard.predicted_risk),
                    borderColor: `${getRiskColor(selectedWard.predicted_risk)}40`,
                  }}
                >
                  <AlertTriangle size={15} />
                  <span>{selectedWard.predicted_risk} Risk</span>
                </div>
              </div>

              {/* Confidence Meter */}
              <div className="detail-prob-box">
                <div className="flex justify-between text-xs mb-1 font-semibold text-slate-700">
                  <span>ML Risk Score</span>
                  <span>{selectedWard.risk_score} / 1.0</span>
                </div>
                <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${Math.round(selectedWard.risk_score * 100)}%`,
                      backgroundColor: getRiskColor(selectedWard.predicted_risk),
                    }}
                  />
                </div>
              </div>

              {/* Feature Grid */}
              <div className="ward-feature-grid">
                <div className="feature-item">
                  <Droplets size={16} className="text-blue-500" />
                  <div>
                    <span className="label">Rainfall (Aug 2026)</span>
                    <span className="value">{selectedWard.historical_rainfall_mm} mm</span>
                  </div>
                </div>

                <div className="feature-item">
                  <Mountain size={16} className="text-emerald-500" />
                  <div>
                    <span className="label">Elevation</span>
                    <span className="value">{selectedWard.elevation_m} m AMSL</span>
                  </div>
                </div>

                <div className="feature-item">
                  <Gauge size={16} className="text-rose-500" />
                  <div>
                    <span className="label">Drain Load Saturation</span>
                    <span
                      className="value font-bold"
                      style={{ color: selectedWard.drain_load_utilization_percent > 90 ? '#EF4444' : '#0F172A' }}
                    >
                      {selectedWard.drain_load_utilization_percent}%
                    </span>
                  </div>
                </div>

                <div className="feature-item">
                  <AlertTriangle size={16} className="text-amber-500" />
                  <div>
                    <span className="label">Reported Incidents</span>
                    <span className="value">{selectedWard.reported_waterlogging_incidents} spots</span>
                  </div>
                </div>
              </div>

              {/* Topographic specs */}
              <div className="ward-topo-specs">
                <h4>Topography & Urban Context</h4>
                <div className="topo-row">
                  <span>Impervious Surface:</span>
                  <strong>{selectedWard.impervious_surface_percent}%</strong>
                </div>
                <div className="topo-row">
                  <span>Seasonal Green Cover:</span>
                  <strong>{selectedWard.green_cover_percent}%</strong>
                </div>
                <div className="topo-row">
                  <span>Water Body Proximity:</span>
                  <strong>{selectedWard.water_body_proximity || 'Canal Drainage Basin'}</strong>
                </div>
                <div className="topo-row">
                  <span>Storm Drain Coverage:</span>
                  <strong>{selectedWard.storm_drain_coverage_percent}%</strong>
                </div>
              </div>

              <button
                className="view-in-dashboard-btn"
                onClick={() => navigate('/dashboard')}
                id="view-in-dashboard-btn"
              >
                <span>View Full Analytics in Dashboard</span>
                <ArrowRight size={16} />
              </button>
            </div>
          ) : (
            <div className="overview-summary-panel">
              <div className="overview-header">
                <h3>Kolkata Nowcasting Overview</h3>
                <p>18 Ward Representative Zones Monitored</p>
              </div>

              <div className="overview-risk-cards">
                <div
                  className="risk-summary-card major cursor-pointer"
                  onClick={() => setActiveFilter('Major')}
                >
                  <div className="count">{majorWards.length}</div>
                  <div className="info">
                    <strong>Major Risk Zones</strong>
                    <span>Behala, Kasba, Topsia, Garden Reach, Entally</span>
                  </div>
                </div>

                <div
                  className="risk-summary-card moderate cursor-pointer"
                  onClick={() => setActiveFilter('Moderate')}
                >
                  <div className="count">{moderateWards.length}</div>
                  <div className="info">
                    <strong>Moderate Risk Zones</strong>
                    <span>Tollygunge, Beliaghata, Park Circus, BBD Bagh...</span>
                  </div>
                </div>

                <div
                  className="risk-summary-card minor cursor-pointer"
                  onClick={() => setActiveFilter('Minor')}
                >
                  <div className="count">{minorWards.length}</div>
                  <div className="info">
                    <strong>Minor Risk Zones</strong>
                    <span>Salt Lake, New Town, Jadavpur, Alipore...</span>
                  </div>
                </div>
              </div>

              <div className="overview-instruction">
                <Sparkles size={18} className="text-blue-500" />
                <p>
                  Click any marker on the map or select a ward from the dropdown to inspect real-time ML risk predictions and topographic vulnerability indicators.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}