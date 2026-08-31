import { CloudRain, Thermometer, Droplets, Wind, Gauge, Eye, MapPin } from 'lucide-react';
import { useFloodData } from '../../context/FloodDataContext';

function CurrentWeatherCard() {
  const { selectedWard } = useFloodData();

  const temp = selectedWard?.avg_temperature_c || 29.4;
  const humidity = selectedWard?.avg_humidity_percent || 86;
  const heatIndex = selectedWard?.heat_index_c || 37.4;
  const condition = selectedWard?.forecast_rainfall_mm > 280 ? 'Heavy Monsoon Rain' : 'Moderate Rain';
  const locationLabel = selectedWard ? `${selectedWard.ward_name} (${selectedWard.zone})` : 'Kolkata, West Bengal';

  const weatherDetails = [
    { icon: <Thermometer size={16} />, label: 'Heat Index', value: `${heatIndex}°C` },
    { icon: <Droplets size={16} />, label: 'Humidity', value: `${humidity}%` },
    { icon: <Wind size={16} />, label: 'Monsoon Wind', value: '18 km/h SW' },
    { icon: <Gauge size={16} />, label: 'Atm. Pressure', value: '1004 hPa' },
    { icon: <Eye size={16} />, label: 'Visibility', value: '4.5 km' },
  ];

  return (
    <div className="current-weather-card" id="current-weather-card">
      <div className="weather-left">
        <div className="weather-main">
          <div className="flex items-center gap-1.5 text-xs text-blue-100 font-medium">
            <MapPin size={13} />
            <span>{locationLabel}</span>
          </div>
          <div className="weather-icon-temp">
            <CloudRain size={48} className="weather-icon" />
            <div>
              <div className="weather-temp">
                {temp}<sup>°C</sup>
              </div>
              <div className="weather-condition">{condition}</div>
            </div>
          </div>
        </div>

        <div className="weather-details">
          {weatherDetails.map((detail) => (
            <div className="weather-detail-row" key={detail.label}>
              {detail.icon}
              <span className="detail-label">{detail.label}</span>
              <span className="detail-value">{detail.value}</span>
            </div>
          ))}
        </div>
      </div>

      {/* City illustration */}
      <div className="weather-illustration">
        <svg viewBox="0 0 200 140" fill="none" xmlns="http://www.w3.org/2000/svg">
          {/* River */}
          <path d="M0 110 Q50 100 100 110 Q150 120 200 110 V140 H0 Z" fill="#93C5FD" opacity="0.6" />

          {/* Bridge */}
          <path d="M20 100 Q100 75 180 100" stroke="#64748B" strokeWidth="2.5" fill="none" />
          <line x1="60" y1="100" x2="60" y2="82" stroke="#64748B" strokeWidth="1.5" />
          <line x1="100" y1="100" x2="100" y2="76" stroke="#64748B" strokeWidth="1.5" />
          <line x1="140" y1="100" x2="140" y2="82" stroke="#64748B" strokeWidth="1.5" />

          {/* Buildings */}
          <rect x="10" y="40" width="25" height="60" rx="2" fill="#94A3B8" />
          <rect x="40" y="25" width="20" height="75" rx="2" fill="#64748B" />
          <rect x="65" y="50" width="22" height="50" rx="2" fill="#94A3B8" />

          <rect x="120" y="30" width="28" height="70" rx="2" fill="#64748B" />
          <rect x="152" y="45" width="22" height="55" rx="2" fill="#94A3B8" />
          <rect x="178" y="55" width="18" height="45" rx="2" fill="#64748B" />

          {/* Rain */}
          <line x1="30" y1="5" x2="28" y2="18" stroke="#93C5FD" strokeWidth="1" opacity="0.6" />
          <line x1="60" y1="3" x2="58" y2="16" stroke="#93C5FD" strokeWidth="1" opacity="0.6" />
          <line x1="90" y1="8" x2="88" y2="21" stroke="#93C5FD" strokeWidth="1" opacity="0.6" />
          <line x1="130" y1="2" x2="128" y2="15" stroke="#93C5FD" strokeWidth="1" opacity="0.6" />
          <line x1="160" y1="6" x2="158" y2="19" stroke="#93C5FD" strokeWidth="1" opacity="0.6" />

          {/* Cloud */}
          <ellipse cx="100" cy="12" rx="25" ry="10" fill="#CBD5E1" opacity="0.5" />
          <ellipse cx="85" cy="14" rx="18" ry="8" fill="#CBD5E1" opacity="0.4" />

          {/* Trees */}
          <circle cx="95" cy="90" r="8" fill="#86EFAC" opacity="0.5" />
          <rect x="94" y="96" width="2" height="6" fill="#4ADE80" opacity="0.4" />
        </svg>
      </div>
    </div>
  );
}

export default CurrentWeatherCard;
