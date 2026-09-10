import { useState, useEffect, useCallback, useRef } from 'react';
import CurrentWeatherCard from '../components/dashboard/CurrentWeatherCard.jsx';
import FloodRiskCard from '../components/dashboard/FloodRiskCard.jsx';
import StatsRow from '../components/dashboard/StatsRow.jsx';
import WeatherForecast from '../components/dashboard/WeatherForecast.jsx';
import RainfallTrendChart from '../components/dashboard/RainfallTrendChart.jsx';
import LandEnvironmentCard from '../components/dashboard/LandEnvironmentCard.jsx';
import RecentAlerts from '../components/dashboard/RecentAlerts.jsx';
import AdvisoryCard from '../components/dashboard/AdvisoryCard.jsx';
import LiveMLPredictorModal from '../components/dashboard/LiveMLPredictorModal.jsx';
import useInView from '../hooks/useInView.js';
import api, { WEATHER_REFRESH_INTERVAL_MS } from '../services/api';
import '../styles/dashboard.css';

// Weather refresh interval (matches backend WEATHER_REFRESH_INTERVAL_MINUTES)
const REFRESH_INTERVAL_MS = WEATHER_REFRESH_INTERVAL_MS; // 10 minutes

function DashboardPage() {
  const [prediction, setPrediction]       = useState(null);
  const [weatherData, setWeatherData]     = useState(null);
  const [activeWard, setActiveWard]       = useState(null);
  const [isSimulatorOpen, setIsSimulatorOpen] = useState(false);
  const [isLoading, setIsLoading]         = useState(true);
  const [weatherError, setWeatherError]   = useState(null);
  const [lastUpdated, setLastUpdated]     = useState(null);

  const [middleRef, middleInView] = useInView({ threshold: 0.1, triggerOnce: true });
  const [bottomRef, bottomInView] = useInView({ threshold: 0.1, triggerOnce: true });

  // Keep a ref so the interval callback always has the current ward
  const activeWardRef = useRef(null);

  /**
   * Fetch real-time weather + ML prediction for a ward.
   * Uses the single /weather-predict endpoint for efficiency.
   * Falls back to ML-only prediction if weather is unavailable.
   */
  const fetchWeatherAndPrediction = useCallback(async (wardId) => {
    if (!wardId) return;

    try {
      // Primary: combined weather + prediction in one call
      const res = await api.getWeatherPrediction(wardId);

      if (res?.success) {
        // Extract weather and prediction from combined response
        setWeatherData(res.weather || null);
        setWeatherError(null);

        // Map the response to the shape expected by existing components
        const predictionForComponents = {
          success: true,
          flood_probability:  res.prediction?.flood_probability,
          safe_probability:   res.prediction?.safe_probability,
          risk_level:         res.prediction?.risk_level,
          risk_color:         res.prediction?.risk_color,
          status_text:        res.prediction?.status_text,
          estimated_waterlogging_depth_cm: res.prediction?.estimated_waterlogging_depth_cm,
          estimated_duration_hours:        res.prediction?.estimated_duration_hours,
          advisories:         res.prediction?.advisories,
          key_risk_drivers:   res.prediction?.key_risk_drivers,
          inputs_summary: {
            rainfall_mm:            res.weather?.rainfall_24h_estimate_mm,
            humidity_percent:       res.weather?.humidity,
            temperature_c:          res.weather?.temperature,
            elevation_m:            res.elevation_m,
            drainage_load_percent:  80,  // ward baseline
          },
        };
        setPrediction(predictionForComponents);
        setLastUpdated(new Date());
      }
    } catch (err) {
      console.warn('Real-time weather+prediction failed, trying ML-only fallback:', err.message);
      setWeatherData(null);
      setWeatherError(err.message || 'Weather data unavailable');

      // Fallback: run ML prediction without real weather (uses ward defaults)
      try {
        const mlRes = await api.predictFloodRisk({
          ward_id: wardId,
          rainfall_mm: 82.0,
          is_monsoon: 1,
        });
        setPrediction(mlRes);
        setLastUpdated(new Date());
      } catch (mlErr) {
        console.error('ML fallback also failed:', mlErr);
      }
    }
  }, []);

  // Initial load: get wards catalog, then fetch weather for default ward
  useEffect(() => {
    async function init() {
      try {
        const wardsData = await api.getWards();
        const initialWard = wardsData?.wards?.[0] || { id: 'behala-ward-120', name: 'Behala (Ward 120)', zone: 'South West' };
        setActiveWard(initialWard);
        activeWardRef.current = initialWard;

        if (initialWard) {
          await fetchWeatherAndPrediction(initialWard.id);
        }
      } catch (err) {
        console.error('Dashboard initialization failed:', err);
      } finally {
        setIsLoading(false);
      }
    }
    init();
  }, [fetchWeatherAndPrediction]);

  // Auto-refresh timer: re-fetch weather every REFRESH_INTERVAL_MS
  useEffect(() => {
    const intervalId = setInterval(() => {
      const ward = activeWardRef.current;
      if (ward?.id) {
        console.log(`[Auto-refresh] Refreshing weather for ${ward.name} ...`);
        fetchWeatherAndPrediction(ward.id);
      }
    }, REFRESH_INTERVAL_MS);

    return () => clearInterval(intervalId);
  }, [fetchWeatherAndPrediction]);

  // When ward changes, fetch new weather+prediction immediately
  const handleWardChange = useCallback(async (ward) => {
    setActiveWard(ward);
    activeWardRef.current = ward;
    if (ward?.id) {
      setIsLoading(true);
      await fetchWeatherAndPrediction(ward.id);
      setIsLoading(false);
    }
  }, [fetchWeatherAndPrediction]);

  const handleApplyPrediction = (newPrediction, newWard) => {
    setPrediction(newPrediction);
    if (newWard) {
      setActiveWard(newWard);
      activeWardRef.current = newWard;
    }
  };

  // Format "Last updated" timestamp
  const lastUpdatedText = lastUpdated
    ? `Last updated: ${lastUpdated.toLocaleTimeString('en-IN', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      })}`
    : null;

  return (
    <div className="dashboard-body">
      {/* Weather API error banner — non-blocking, never shows fake data */}
      {weatherError && (
        <div
          id="weather-error-banner"
          style={{
            background: 'rgba(239,68,68,0.1)',
            border: '1px solid rgba(239,68,68,0.3)',
            borderRadius: '8px',
            padding: '10px 16px',
            marginBottom: '12px',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            fontSize: '0.82rem',
            color: '#fca5a5',
          }}
        >
          <span>⚠️</span>
          <span>
            <strong>Weather data unavailable:</strong> {weatherError}.
            {' '}ML prediction is using ward baseline values instead of live weather.
          </span>
        </div>
      )}

      {/* Last updated timestamp */}
      {lastUpdatedText && (
        <div
          id="weather-last-updated"
          style={{
            fontSize: '0.75rem',
            color: 'rgba(148,163,184,0.7)',
            marginBottom: '8px',
            textAlign: 'right',
            paddingRight: '4px',
          }}
        >
          🔄 {lastUpdatedText} · Auto-refreshes every 10 min
        </div>
      )}

      {/* Weather + Flood Risk */}
      <div className="weather-flood-row">
        <CurrentWeatherCard
          prediction={prediction}
          activeWard={activeWard}
          weatherData={weatherData}
          weatherError={weatherError}
          isLoading={isLoading}
        />
        <FloodRiskCard
          prediction={prediction}
          onOpenSimulator={() => setIsSimulatorOpen(true)}
        />
      </div>

      {/* Stats */}
      <StatsRow prediction={prediction} weatherData={weatherData} />

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
        onWardChange={handleWardChange}
      />
    </div>
  );
}

export default DashboardPage;
