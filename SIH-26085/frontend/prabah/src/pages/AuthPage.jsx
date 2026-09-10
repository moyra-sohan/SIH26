import { useState, useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import {
  User,
  Mail,
  Lock,
  Eye,
  EyeOff,
  Activity,
  BrainCircuit,
  Bell,
  AlertCircle,
  CheckCircle,
  Loader2,
  Home,
  MapPin,
  Building,
  Navigation,
  Globe,
  Check,
  Sun,
  Cloud,
  Wind,
} from 'lucide-react';
import PrabahLogo from '../components/PrabahLogo.jsx';
import LiveWeatherAnimation from '../components/LiveWeatherAnimation.jsx';
import CloudSkyBackground from '../components/CloudSkyBackground.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import '../styles/auth.css';

function AuthPage() {
  const { login, register, isAuthenticated } = useAuth();
  const [activeTab, setActiveTab] = useState('signin');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [weatherData, setWeatherData] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    houseNo: '',
    street: '',
    area: '',
    city: '',
    district: '',
    state: '',
    pinCode: '',
    country: 'India',
  });
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [loading, setLoading] = useState(false);

  // Fetch live weather data for Kolkata for atmospheric background & badge
  useEffect(() => {
    const fetchWeather = async () => {
      try {
        const latitude = 22.5726; // Kolkata coordinates
        const longitude = 88.3639;
        const response = await fetch(
          `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=weather_code,temperature,relative_humidity,wind_speed&timezone=auto`
        );
        if (response.ok) {
          const data = await response.json();
          const current = data.current;
          setWeatherData({
            temperature: current.temperature,
            humidity: current.relative_humidity,
            windSpeed: current.wind_speed,
            weatherCode: current.weather_code,
          });
        }
      } catch (error) {
        console.warn('Weather fetch notice:', error);
      }
    };

    fetchWeather();
    const interval = setInterval(fetchWeather, 600000);
    return () => clearInterval(interval);
  }, []);

  const features = [
    {
      icon: <Activity size={20} />,
      title: 'Real-time Monitoring',
      description: 'Live weather & flood updates',
    },
    {
      icon: <BrainCircuit size={20} />,
      title: 'Smart Prediction',
      description: 'AI-powered nowcasting',
    },
    {
      icon: <Bell size={20} />,
      title: 'Early Alerts',
      description: 'Timely notifications',
    },
  ];

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errorMsg) setErrorMsg('');
  };

  const passwordsMatch = formData.password && formData.confirmPassword && formData.password === formData.confirmPassword;
  const passwordsMismatch = formData.confirmPassword && formData.password !== formData.confirmPassword;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    const isSignIn = activeTab === 'signin';

    if (isSignIn) {
      const identifier = formData.email.trim();
      if (!identifier) {
        setErrorMsg('Please enter your email or username');
        return;
      }
      if (!formData.password) {
        setErrorMsg('Please enter your password');
        return;
      }
    } else {
      if (!formData.name.trim() || formData.name.trim().length < 2) {
        setErrorMsg('Please enter your full name (minimum 2 characters)');
        return;
      }
      if (!formData.email.trim()) {
        setErrorMsg('Please enter a valid email address');
        return;
      }
      if (formData.password.length < 6) {
        setErrorMsg('Password must be at least 6 characters long');
        return;
      }
      if (formData.password !== formData.confirmPassword) {
        setErrorMsg('Passwords do not match. Please ensure both password fields match.');
        return;
      }
      if (!formData.street.trim()) {
        setErrorMsg('Please enter your street / road name');
        return;
      }
      if (!formData.area.trim()) {
        setErrorMsg('Please enter your area / locality');
        return;
      }
      if (!formData.city.trim()) {
        setErrorMsg('Please enter your city');
        return;
      }
      if (!formData.district.trim()) {
        setErrorMsg('Please enter your district');
        return;
      }
      if (!formData.state.trim()) {
        setErrorMsg('Please enter your state');
        return;
      }
      if (!formData.pinCode.trim()) {
        setErrorMsg('Please enter your PIN code');
        return;
      }
    }

    setLoading(true);

    try {
      if (isSignIn) {
        await login(formData.email, formData.password);
      } else {
        const registrationPayload = {
          name: formData.name.trim(),
          username: formData.email.split('@')[0],
          email: formData.email.trim(),
          password: formData.password,
          houseNo: formData.houseNo.trim(),
          street: formData.street.trim(),
          area: formData.area.trim(),
          city: formData.city.trim(),
          district: formData.district.trim(),
          state: formData.state.trim(),
          pinCode: formData.pinCode.trim(),
          country: formData.country.trim() || 'India',
        };

        await register(registrationPayload);
        setSuccessMsg('Registration successful! Redirecting...');
      }
    } catch (err) {
      setErrorMsg(err.message || 'An error occurred during authentication.');
    } finally {
      setLoading(false);
    }
  };

  const handleTabSwitch = (tab) => {
    setActiveTab(tab);
    setErrorMsg('');
    setSuccessMsg('');
  };

  return (
    <div className="auth-page">
      {/* Cloud Sky Background with 3D effect */}
      <CloudSkyBackground weatherCode={weatherData?.weatherCode || 0} />

      {/* Live Weather Animation - Rain & Thunderstorm */}
      <LiveWeatherAnimation isActive={true} />

      {/* Weather info overlay in top-right */}
      {weatherData && (
        <div className="weather-info-overlay">
          <div className="weather-item">
            <Sun size={16} />
            <span>{Math.round(weatherData.temperature)}°C</span>
          </div>
          <div className="weather-item">
            <Cloud size={16} />
            <span>{weatherData.humidity}%</span>
          </div>
          <div className="weather-item">
            <Wind size={16} />
            <span>{Math.round(weatherData.windSpeed)} km/h</span>
          </div>
        </div>
      )}

      {/* Branding */}
      <div className="auth-branding">
        <div className="auth-branding-icon">
          <PrabahLogo size={52} />
        </div>
        <h1>PRABAH</h1>
        <p>Urban Flood Nowcasting System</p>
      </div>

      {/* Auth Card */}
      <div className={`auth-card ${activeTab === 'signup' ? 'auth-card-wide' : ''}`}>
        {/* Tabs */}
        <div className="auth-tabs">
          <button
            className={`auth-tab ${activeTab === 'signin' ? 'active' : ''}`}
            onClick={() => handleTabSwitch('signin')}
            type="button"
            id="signin-tab"
          >
            Sign In
          </button>
          <button
            className={`auth-tab ${activeTab === 'signup' ? 'active' : ''}`}
            onClick={() => handleTabSwitch('signup')}
            type="button"
            id="signup-tab"
          >
            Sign Up
          </button>
        </div>

        {/* Error / Success Notifications */}
        {errorMsg && (
          <div className="auth-msg auth-error" id="auth-error-msg">
            <AlertCircle size={18} />
            <span>{errorMsg}</span>
          </div>
        )}
        {successMsg && (
          <div className="auth-msg auth-success" id="auth-success-msg">
            <CheckCircle size={18} />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Form */}
        <form className="auth-form" onSubmit={handleSubmit}>
          {/* Sign Up Fields */}
          {activeTab === 'signup' && (
            <div className="form-group">
              <label htmlFor="name">Full Name *</label>
              <div className="input-wrapper">
                <User size={18} className="input-icon" />
                <input
                  type="text"
                  id="name"
                  name="name"
                  placeholder="Enter your full name"
                  value={formData.name}
                  onChange={handleInputChange}
                  autoComplete="name"
                />
              </div>
            </div>
          )}

          {/* Email / Username */}
          <div className="form-group">
            <label htmlFor="email">
              {activeTab === 'signin' ? 'Email or Username *' : 'Email Address *'}
            </label>
            <div className="input-wrapper">
              <Mail size={18} className="input-icon" />
              <input
                type={activeTab === 'signin' ? 'text' : 'email'}
                id="email"
                name="email"
                placeholder={activeTab === 'signin' ? 'user@example.com or username' : 'name@example.com'}
                value={formData.email}
                onChange={handleInputChange}
                autoComplete="email"
              />
            </div>
          </div>

          {/* Password */}
          <div className="form-group">
            <label htmlFor="password">Password *</label>
            <div className="input-wrapper">
              <Lock size={18} className="input-icon" />
              <input
                type={showPassword ? 'text' : 'password'}
                id="password"
                name="password"
                placeholder={activeTab === 'signin' ? '••••••••' : 'Min. 6 characters'}
                value={formData.password}
                onChange={handleInputChange}
                autoComplete={activeTab === 'signin' ? 'current-password' : 'new-password'}
              />
              <button
                type="button"
                className="toggle-password"
                onClick={() => setShowPassword((prev) => !prev)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                id="toggle-password-btn"
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          {/* Confirm Password (Sign Up only) */}
          {activeTab === 'signup' && (
            <div className="form-group">
              <label htmlFor="confirmPassword">Confirm Password *</label>
              <div className="input-wrapper">
                <Lock size={18} className="input-icon" />
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  id="confirmPassword"
                  name="confirmPassword"
                  placeholder="Repeat your password"
                  value={formData.confirmPassword}
                  onChange={handleInputChange}
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  className="toggle-password"
                  onClick={() => setShowConfirmPassword((prev) => !prev)}
                  aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                >
                  {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              {passwordsMatch && (
                <div className="password-match-status match">
                  <Check size={14} /> Passwords match
                </div>
              )}
              {passwordsMismatch && (
                <div className="password-match-status mismatch">
                  <AlertCircle size={14} /> Passwords do not match
                </div>
              )}
            </div>
          )}

          {/* Complete Address Details for Sign Up */}
          {activeTab === 'signup' && (
            <>
              <div className="address-section-header">
                <MapPin size={16} />
                <span>Residential / Alert Address</span>
              </div>

              <div className="form-row-2">
                <div className="form-group">
                  <label htmlFor="houseNo">House / Flat / Bldg No.</label>
                  <div className="input-wrapper">
                    <Home size={16} className="input-icon" />
                    <input
                      type="text"
                      id="houseNo"
                      name="houseNo"
                      placeholder="e.g. Flat 4B, Tower 2"
                      value={formData.houseNo}
                      onChange={handleInputChange}
                    />
                  </div>
                </div>
                <div className="form-group">
                  <label htmlFor="street">Street / Road Name *</label>
                  <div className="input-wrapper">
                    <Navigation size={16} className="input-icon" />
                    <input
                      type="text"
                      id="street"
                      name="street"
                      placeholder="e.g. Diamond Harbour Rd"
                      value={formData.street}
                      onChange={handleInputChange}
                    />
                  </div>
                </div>
              </div>

              <div className="form-row-2">
                <div className="form-group">
                  <label htmlFor="area">Area / Locality / Ward *</label>
                  <div className="input-wrapper">
                    <MapPin size={16} className="input-icon" />
                    <input
                      type="text"
                      id="area"
                      name="area"
                      placeholder="e.g. Behala / Ward 120"
                      value={formData.area}
                      onChange={handleInputChange}
                    />
                  </div>
                </div>
                <div className="form-group">
                  <label htmlFor="city">City / Municipal Corp *</label>
                  <div className="input-wrapper">
                    <Building size={16} className="input-icon" />
                    <input
                      type="text"
                      id="city"
                      name="city"
                      placeholder="e.g. Kolkata"
                      value={formData.city}
                      onChange={handleInputChange}
                    />
                  </div>
                </div>
              </div>

              <div className="form-row-3">
                <div className="form-group">
                  <label htmlFor="district">District *</label>
                  <div className="input-wrapper">
                    <Building size={16} className="input-icon" />
                    <input
                      type="text"
                      id="district"
                      name="district"
                      placeholder="Kolkata / South 24 Parganas"
                      value={formData.district}
                      onChange={handleInputChange}
                    />
                  </div>
                </div>
                <div className="form-group">
                  <label htmlFor="state">State *</label>
                  <div className="input-wrapper">
                    <Building size={16} className="input-icon" />
                    <input
                      type="text"
                      id="state"
                      name="state"
                      placeholder="West Bengal"
                      value={formData.state}
                      onChange={handleInputChange}
                    />
                  </div>
                </div>
                <div className="form-group">
                  <label htmlFor="pinCode">PIN Code *</label>
                  <div className="input-wrapper">
                    <MapPin size={16} className="input-icon" />
                    <input
                      type="text"
                      id="pinCode"
                      name="pinCode"
                      placeholder="700034"
                      value={formData.pinCode}
                      onChange={handleInputChange}
                    />
                  </div>
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="country">Country</label>
                <div className="input-wrapper">
                  <Globe size={16} className="input-icon" />
                  <input
                    type="text"
                    id="country"
                    name="country"
                    placeholder="India"
                    value={formData.country}
                    onChange={handleInputChange}
                  />
                </div>
              </div>
            </>
          )}

          {activeTab === 'signin' && (
            <div className="forgot-password">
              <a href="#" onClick={(e) => e.preventDefault()} id="forgot-password-link">
                Forgot password?
              </a>
            </div>
          )}

          <button
            type="submit"
            className="auth-submit-btn"
            id="auth-submit-btn"
            disabled={loading}
          >
            {loading ? (
              <>
                <Loader2 size={18} className="animate-spin" />
                <span>{activeTab === 'signin' ? 'Signing In...' : 'Registering Account...'}</span>
              </>
            ) : (
              <span>{activeTab === 'signin' ? 'Sign In to Dashboard' : 'Complete Registration'}</span>
            )}
          </button>

          <div className="auth-divider">
            <span>or</span>
          </div>

          <div className="auth-switch">
            {activeTab === 'signin' ? (
              <>
                Don't have an account?
                <button type="button" onClick={() => handleTabSwitch('signup')} id="switch-to-signup">
                  Sign Up
                </button>
              </>
            ) : (
              <>
                Already have an account?
                <button type="button" onClick={() => handleTabSwitch('signin')} id="switch-to-signin">
                  Sign In
                </button>
              </>
            )}
          </div>
        </form>
      </div>

      {/* Features */}
      <div className="auth-features">
        {features.map((feature) => (
          <div className="auth-feature-item" key={feature.title}>
            <div className="auth-feature-icon">{feature.icon}</div>
            <div className="auth-feature-text">
              <h3>{feature.title}</h3>
              <p>{feature.description}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default AuthPage;
