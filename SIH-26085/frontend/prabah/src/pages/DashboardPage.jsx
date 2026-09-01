import { useState, useEffect } from 'react';
import CurrentWeatherCard from '../components/dashboard/CurrentWeatherCard.jsx';
import FloodRiskCard from '../components/dashboard/FloodRiskCard.jsx';
import StatsRow from '../components/dashboard/StatsRow.jsx';
import WeatherForecast from '../components/dashboard/WeatherForecast.jsx';
import RainfallTrendChart from '../components/dashboard/RainfallTrendChart.jsx';
import LandEnvironmentCard from '../components/dashboard/LandEnvironmentCard.jsx';
import RecentAlerts from '../components/dashboard/RecentAlerts.jsx';
import AdvisoryCard from '../components/dashboard/AdvisoryCard.jsx';
import LiveMLPredictorModal from '../components/dashboard/LiveMLPredictorModal.jsx';
import api from '../services/api';
import '../styles/dashboard.css';

function DashboardPage() {
  const [prediction, setPrediction] = useState(null);
  const [activeWard, setActiveWard] = useState(null);
  const [isSimulatorOpen, setIsSimulatorOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch initial ML prediction for baseline Kolkata ward on mount
  useEffect(() => {
    async function fetchInitialNowcast() {
      try {
        const wardsData = await api.getWards();
        const initialWard = wardsData?.wards?.[0] || null;
        setActiveWard(initialWard);

        const res = await api.predictFloodRisk({
          ward_id: initialWard?.id || 'behala-ward-120',
          rainfall_mm: 82.0,
          is_monsoon: 1,
        });
        setPrediction(res);
      } catch (err) {
        console.warn('Could not fetch live prediction from ML backend on mount:', err);
      } finally {
        setIsLoading(false);
      }
    }
    fetchInitialNowcast();
  }, []);

  const handleApplyPrediction = (newPrediction, newWard) => {
    setPrediction(newPrediction);
    if (newWard) setActiveWard(newWard);
  };

  return (
    <div className="dashboard-body">
      {/* Weather + Flood Risk */}
      <div className="weather-flood-row">
        <CurrentWeatherCard prediction={prediction} activeWard={activeWard} />
        <FloodRiskCard
          prediction={prediction}
          onOpenSimulator={() => setIsSimulatorOpen(true)}
        />
      </div>

      {/* Stats */}
      <StatsRow prediction={prediction} />

      {/* Middle Row: Forecast + Chart + Land */}
      <div className="middle-row">
        <WeatherForecast />
        <RainfallTrendChart />
        <LandEnvironmentCard activeWard={activeWard} />
      </div>

      {/* Bottom Row: Alerts + Advisory */}
      <div className="bottom-row">
        <RecentAlerts prediction={prediction} />
        <AdvisoryCard prediction={prediction} />
      </div>

      {/* Interactive Live ML Predictor / Simulator Modal */}
      <LiveMLPredictorModal
        isOpen={isSimulatorOpen}
        onClose={() => setIsSimulatorOpen(false)}
        onApplyPrediction={handleApplyPrediction}
        currentWard={activeWard?.id}
      />
    </div>
  );
}

export default DashboardPage;
