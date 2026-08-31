import { useState } from 'react';
import { Sparkles, MapPin, Filter, Layers, RefreshCw, AlertTriangle, ShieldCheck } from 'lucide-react';
import CurrentWeatherCard from '../components/dashboard/CurrentWeatherCard.jsx';
import FloodRiskCard from '../components/dashboard/FloodRiskCard.jsx';
import StatsRow from '../components/dashboard/StatsRow.jsx';
import WeatherForecast from '../components/dashboard/WeatherForecast.jsx';
import RainfallTrendChart from '../components/dashboard/RainfallTrendChart.jsx';
import LandEnvironmentCard from '../components/dashboard/LandEnvironmentCard.jsx';
import RecentAlerts from '../components/dashboard/RecentAlerts.jsx';
import AdvisoryCard from '../components/dashboard/AdvisoryCard.jsx';
import SimulationModal from '../components/dashboard/SimulationModal.jsx';
import { useFloodData } from '../context/FloodDataContext.jsx';
import '../styles/dashboard.css';

function DashboardPage() {
  const { wards, selectedWardId, setSelectedWardId, selectedWard, refreshData, loading } = useFloodData();
  const [isSimModalOpen, setIsSimModalOpen] = useState(false);
  const [activeFilter, setActiveFilter] = useState('ALL'); // 'ALL', 'Major', 'Moderate', 'Minor'

  const majorCount = wards.filter((w) => w.predicted_risk === 'Major').length;
  const modCount = wards.filter((w) => w.predicted_risk === 'Moderate').length;
  const minorCount = wards.filter((w) => w.predicted_risk === 'Minor').length;

  const filteredWards = activeFilter === 'ALL'
    ? wards
    : wards.filter((w) => w.predicted_risk === activeFilter);

  return (
    <div className="dashboard-body">
      {/* Dynamic Ward & ML Filter Bar */}
      <div className="ward-filter-toolbar">
        <div className="ward-filter-left">
          <div className="ward-select-wrapper">
            <MapPin size={16} className="ward-icon" />
            <select
              value={selectedWardId || ''}
              onChange={(e) => setSelectedWardId(e.target.value ? parseInt(e.target.value, 10) : null)}
              className="ward-dropdown"
              id="ward-selector"
            >
              <option value="">🌟 All Kolkata (City Overview - 18 Wards)</option>
              {filteredWards.map((w) => (
                <option key={w.ward_id} value={w.ward_id}>
                  Ward {w.ward_id} • {w.ward_name} ({w.zone}) — [{w.predicted_risk} Risk]
                </option>
              ))}
            </select>
          </div>

          {/* Quick Risk Category Filter Pills */}
          <div className="risk-filter-pills">
            <button
              className={`filter-pill ${activeFilter === 'ALL' ? 'active' : ''}`}
              onClick={() => setActiveFilter('ALL')}
            >
              All ({wards.length})
            </button>
            <button
              className={`filter-pill major ${activeFilter === 'Major' ? 'active' : ''}`}
              onClick={() => setActiveFilter('Major')}
            >
              <span className="dot" /> Major Risk ({majorCount})
            </button>
            <button
              className={`filter-pill moderate ${activeFilter === 'Moderate' ? 'active' : ''}`}
              onClick={() => setActiveFilter('Moderate')}
            >
              <span className="dot" /> Moderate ({modCount})
            </button>
            <button
              className={`filter-pill minor ${activeFilter === 'Minor' ? 'active' : ''}`}
              onClick={() => setActiveFilter('Minor')}
            >
              <span className="dot" /> Minor ({minorCount})
            </button>
          </div>
        </div>

        <div className="ward-filter-right">
          <button
            className="sim-trigger-btn"
            onClick={() => setIsSimModalOpen(true)}
            id="open-sim-modal-btn"
          >
            <Sparkles size={16} />
            <span>AI Risk Simulator</span>
          </button>

          <button
            className="refresh-data-btn"
            onClick={refreshData}
            title="Refresh Model Predictions"
            aria-label="Refresh data"
          >
            <RefreshCw size={15} className={loading ? 'spin' : ''} />
          </button>
        </div>
      </div>

      {/* Weather + Flood Risk */}
      <div className="weather-flood-row">
        <CurrentWeatherCard />
        <FloodRiskCard onOpenSimulator={() => setIsSimModalOpen(true)} />
      </div>

      {/* Stats */}
      <StatsRow />

      {/* Middle Row: Forecast + Chart + Land */}
      <div className="middle-row">
        <WeatherForecast />
        <RainfallTrendChart />
        <LandEnvironmentCard />
      </div>

      {/* Bottom Row: Alerts + Advisory */}
      <div className="bottom-row">
        <RecentAlerts />
        <AdvisoryCard />
      </div>

      {/* AI Flood Risk Simulator Modal */}
      <SimulationModal
        isOpen={isSimModalOpen}
        onClose={() => setIsSimModalOpen(false)}
      />
    </div>
  );
}

export default DashboardPage;
