import { useState } from 'react';
import { CloudRain, CloudDrizzle, Cloud, Sun, CloudSun, Droplets } from 'lucide-react';
import { forecastData } from '../../data/weatherData';

const weatherIcons = {
  'cloud-rain': CloudRain,
  'cloud-drizzle': CloudDrizzle,
  'cloud': Cloud,
  'sun': Sun,
  'cloud-sun': CloudSun,
};

const tabKeys = [
  { key: 'today', label: 'Today' },
  { key: 'tomorrow', label: 'Tomorrow' },
  { key: '3days', label: '3 Days' },
];

function WeatherForecast() {
  const [activeTab, setActiveTab] = useState('today');

  const currentForecast = forecastData[activeTab] || [];

  const handleViewFullForecast = () => {
    const payload = {
      action: 'view_full_forecast',
      forecastPeriod: activeTab,
      data: currentForecast,
      timestamp: new Date().toISOString(),
    };
    console.log('Sending to backend:', JSON.stringify(payload, null, 2));
    alert(`Full forecast data for "${activeTab}" logged to console.`);
  };

  return (
    <div className="dashboard-card" id="weather-forecast-card">
      <div className="card-header">
        <h3>Weather Forecast</h3>
        <button className="card-header-link" onClick={handleViewFullForecast} id="view-full-forecast-btn">
          View full forecast →
        </button>
      </div>

      <div className="forecast-tabs">
        {tabKeys.map((tab) => (
          <button
            key={tab.key}
            className={`forecast-tab ${activeTab === tab.key ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.key)}
            id={`forecast-tab-${tab.key}`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="forecast-list">
        {currentForecast.map((item) => {
          const IconComp = weatherIcons[item.icon] || Cloud;
          return (
            <div className="forecast-item" key={item.time}>
              <span className="forecast-time">{item.time}</span>
              <div className="forecast-icon">
                <IconComp size={24} />
              </div>
              <div className="forecast-temp">
                {item.temp}<sup>°C</sup>
              </div>
              <span className="forecast-condition">{item.condition}</span>
              <span className="forecast-humidity">
                <Droplets size={12} />
                {item.humidity}%
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default WeatherForecast;
