import CurrentWeatherCard from '../components/dashboard/CurrentWeatherCard.jsx';
import FloodRiskCard from '../components/dashboard/FloodRiskCard.jsx';
import StatsRow from '../components/dashboard/StatsRow.jsx';
import WeatherForecast from '../components/dashboard/WeatherForecast.jsx';
import RainfallTrendChart from '../components/dashboard/RainfallTrendChart.jsx';
import LandEnvironmentCard from '../components/dashboard/LandEnvironmentCard.jsx';
import RecentAlerts from '../components/dashboard/RecentAlerts.jsx';
import AdvisoryCard from '../components/dashboard/AdvisoryCard.jsx';
import '../styles/dashboard.css';

function DashboardPage() {
  return (
    <div className="dashboard-body">
      {/* Weather + Flood Risk */}
      <div className="weather-flood-row">
        <CurrentWeatherCard />
        <FloodRiskCard />
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
    </div>
  );
}

export default DashboardPage;
