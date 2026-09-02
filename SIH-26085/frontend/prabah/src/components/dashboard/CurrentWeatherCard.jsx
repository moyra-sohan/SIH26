import { CloudRain, Thermometer, Droplets, Wind, Gauge, Cloud, WifiOff, Loader2 } from 'lucide-react';

/**
 * CurrentWeatherCard — Displays real-time weather fetched from OpenWeatherMap.
 *
 * Props:
 *   weatherData  — Live weather object from api.getWeather() / api.getWeatherPrediction()
 *                  null while loading or if API call failed.
 *   weatherError — Error message string if weather fetch failed, null otherwise.
 *   isLoading    — Boolean, true while the initial fetch is in progress.
 *   activeWard   — Ward object (for ward name display)
 *   prediction   — ML prediction object (passed through but unused here)
 */
function CurrentWeatherCard({ weatherData, weatherError, isLoading, activeWard }) {
  // ---------------------------------------------------------------
  // Loading state
  // ---------------------------------------------------------------
  if (isLoading && !weatherData) {
    return (
      <div className="current-weather-card" id="current-weather-card">
        <div className="weather-left" style={{ justifyContent: 'center', alignItems: 'center' }}>
          <Loader2 size={28} style={{ animation: 'spin 1s linear infinite', color: '#60a5fa' }} />
          <p style={{ marginTop: '12px', color: '#94a3b8', fontSize: '0.88rem' }}>
            Fetching real-time weather…
          </p>
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------
  // Error / unavailable state — never show fake values
  // ---------------------------------------------------------------
  if (!weatherData) {
    return (
      <div className="current-weather-card" id="current-weather-card">
        <div className="weather-left">
          <div className="weather-main">
            <span className="weather-main-label">Current Weather</span>
            {activeWard && (
              <span style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '2px' }}>
                {activeWard.name}
              </span>
            )}
          </div>
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '10px',
              padding: '20px 0',
              color: '#94a3b8',
            }}
          >
            <WifiOff size={32} style={{ color: '#f87171' }} />
            <p style={{ fontSize: '0.85rem', textAlign: 'center', margin: 0 }}>
              <strong style={{ color: '#fca5a5' }}>Weather data unavailable</strong>
              <br />
              {weatherError || 'Could not connect to weather service.'}
            </p>
            <p style={{ fontSize: '0.72rem', color: '#64748b', textAlign: 'center', margin: 0 }}>
              Add your <code>WEATHER_API_KEY</code> to <code>backend/.env</code>
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------
  // Normal state — show REAL weather values only
  // ---------------------------------------------------------------
  const {
    temperature,
    feels_like,
    humidity,
    pressure,
    wind_speed_kmh,
    wind_direction,
    cloud_cover,
    rainfall_1h_mm,
    weather_main,
    weather_description,
    observed_at_ist,
  } = weatherData;

  // Compass direction from wind degrees
  const windDir = typeof wind_direction === 'number'
    ? ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'][Math.round(wind_direction / 45) % 8]
    : null;

  const windText = `${wind_speed_kmh} km/h${windDir ? ' ' + windDir : ''}`;

  // Format observed timestamp (HH:MM)
  const timeText = observed_at_ist
    ? new Date(observed_at_ist).toLocaleTimeString('en-IN', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      })
    : null;

  const weatherDetails = [
    { icon: <Thermometer size={16} />, label: 'Feels like', value: `${feels_like}°C` },
    { icon: <Droplets size={16} />, label: 'Humidity', value: `${humidity}%` },
    { icon: <Wind size={16} />, label: 'Wind', value: windText },
    { icon: <Gauge size={16} />, label: 'Pressure', value: `${pressure} hPa` },
    { icon: <Cloud size={16} />, label: 'Cloud Cover', value: `${cloud_cover}%` },
    { icon: <CloudRain size={16} />, label: 'Rain (1h)', value: `${rainfall_1h_mm} mm` },
  ];

  return (
    <div className="current-weather-card" id="current-weather-card">
      <div className="weather-left">
        <div className="weather-main">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', width: '100%' }}>
            <span className="weather-main-label">Current Weather</span>
            {/* Real-time source badge */}
            <span
              style={{
                fontSize: '0.65rem',
                background: 'rgba(34,197,94,0.15)',
                color: '#4ade80',
                border: '1px solid rgba(34,197,94,0.3)',
                borderRadius: '10px',
                padding: '2px 8px',
                fontWeight: 600,
                letterSpacing: '0.03em',
              }}
            >
              🟢 LIVE
            </span>
          </div>
          {activeWard && (
            <span style={{ fontSize: '0.76rem', color: '#64748b', marginTop: '2px' }}>
              📍 {activeWard.name}
            </span>
          )}
          <div className="weather-icon-temp">
            <CloudRain size={48} className="weather-icon" />
            <div>
              <div className="weather-temp">
                {temperature}<sup>°C</sup>
              </div>
              <div className="weather-condition">
                {weather_description
                  ? weather_description.charAt(0).toUpperCase() + weather_description.slice(1)
                  : weather_main}
              </div>
              {timeText && (
                <div style={{ fontSize: '0.7rem', color: '#64748b', marginTop: '2px' }}>
                  Observed at {timeText} IST
                </div>
              )}
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

          {/* Rain — opacity based on actual rainfall */}
          {rainfall_1h_mm > 0 && <>
            <line x1="30" y1="5" x2="28" y2="18" stroke="#93C5FD" strokeWidth="1" opacity="0.6" />
            <line x1="60" y1="3" x2="58" y2="16" stroke="#93C5FD" strokeWidth="1" opacity="0.6" />
            <line x1="90" y1="8" x2="88" y2="21" stroke="#93C5FD" strokeWidth="1" opacity="0.6" />
            <line x1="130" y1="2" x2="128" y2="15" stroke="#93C5FD" strokeWidth="1" opacity="0.6" />
            <line x1="160" y1="6" x2="158" y2="19" stroke="#93C5FD" strokeWidth="1" opacity="0.6" />
          </>}

          {/* Cloud */}
          <ellipse cx="100" cy="12" rx="25" ry="10" fill="#CBD5E1" opacity={cloud_cover > 50 ? 0.8 : 0.3} />
          <ellipse cx="85" cy="14" rx="18" ry="8" fill="#CBD5E1" opacity={cloud_cover > 50 ? 0.7 : 0.2} />

          {/* Trees */}
          <circle cx="95" cy="90" r="8" fill="#86EFAC" opacity="0.5" />
          <rect x="94" y="96" width="2" height="6" fill="#4ADE80" opacity="0.4" />
        </svg>
      </div>
    </div>
  );
}

export default CurrentWeatherCard;
