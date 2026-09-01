import { useState, useEffect } from 'react';
import useInView from '../hooks/useInView.js';
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

  // Viewport scroll reveal hooks
  const [weatherFloodRef, weatherFloodInView] = useInView({ threshold: 0.1, triggerOnce: false });
  const [statsRef, statsInView] = useInView({ threshold: 0.1, triggerOnce: false });
  const [middleRef, middleInView] = useInView({ threshold: 0.1, triggerOnce: false });
  const [bottomRef, bottomInView] = useInView({ threshold: 0.1, triggerOnce: false });

  // Fetch initial ML prediction for baseline Kolkata ward on mount
  useEffect(() => {
    async function fetchInitialNowcast() {
      try {
        const wardsData = await api.getWards();
        const initialWard = wardsData?.wards?.[0] || { id: 'behala-ward-120', name: 'Behala (Ward 120)', zone: 'South West' };
        setActiveWard(initialWard);

        const res = await api.predictFloodRisk({
          ward_id: initialWard?.id || 'behala-ward-120',
          rainfall_mm: 82.0,
          is_monsoon: 1,
        });
        setPrediction(res);
      } catch (err) {
        console.warn('Backend loading notice, applying default Kolkata nowcast baseline:', err);
        setPrediction({
          risk_level: 'High',
          risk_color: '#f97316',
          flood_probability: 0.78,
          status_text: 'High chance of waterlogging in low-lying areas during peak precipitation.',
          estimated_waterlogging_depth_cm: 28.5,
          estimated_duration_hours: 4.5,
          rainfall_mm: 82.0,
          key_risk_drivers: ['High impervious surface (82%)', 'Low elevation relative to mean', 'Surcharge on local pumping station'],
          advisories: ['Activate secondary diesel stormwater pumps', 'Reroute bus lines from low-lying thoroughfares']
        });
        setActiveWard({ id: 'behala-ward-120', name: 'Behala (Ward 120)', zone: 'South West' });
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
      <div
        ref={weatherFloodRef}
        className={`weather-flood-row card-stagger ${weatherFloodInView ? 'in-view' : ''}`}
      >
        <CurrentWeatherCard prediction={prediction} activeWard={activeWard} />
        <FloodRiskCard
          prediction={prediction}
          onOpenSimulator={() => setIsSimulatorOpen(true)}
        />
      </div>

      {/* Stats */}
      <div
        ref={statsRef}
        className={`dashboard-section ${statsInView ? 'in-view' : ''}`}
      >
        <StatsRow prediction={prediction} />
      </div>

      {/* Middle Row: Forecast + Chart + Land */}
      <div
        ref={middleRef}
        className={`middle-row card-stagger ${middleInView ? 'in-view' : ''}`}
      >
        <WeatherForecast />
        <RainfallTrendChart />
        <LandEnvironmentCard activeWard={activeWard} />
      </div>

      {/* Bottom Row: Alerts + Advisory */}
      <div
        ref={bottomRef}
        className={`bottom-row card-stagger ${bottomInView ? 'in-view' : ''}`}
      >
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
