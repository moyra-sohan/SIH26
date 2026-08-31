import { useState, useMemo } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import {
  CloudRain,
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
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import '../styles/auth.css';

function AuthPage() {
  const navigate = useNavigate();
  const { login, register, isAuthenticated } = useAuth();
  const [activeTab, setActiveTab] = useState('signin');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
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

  // Generate rain drops
  const raindrops = useMemo(() => {
    return Array.from({ length: 60 }, (_, i) => ({
      id: i,
      left: `${Math.random() * 100}%`,
      height: `${Math.random() * 25 + 10}px`,
      duration: `${Math.random() * 1.5 + 0.8}s`,
      delay: `${Math.random() * 3}s`,
    }));
  }, []);

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
        setSuccessMsg('Login successful! Redirecting...');
      } else {
        await register({
          name: formData.name.trim(),
          email: formData.email.trim(),
          password: formData.password,
          houseNo: formData.houseNo.trim() || null,
          street: formData.street.trim(),
          area: formData.area.trim(),
          city: formData.city.trim(),
          district: formData.district.trim(),
          state: formData.state.trim(),
          pinCode: formData.pinCode.trim(),
          country: formData.country.trim() || 'India',
        });
        setSuccessMsg('Account created successfully! Redirecting...');
      }

      setTimeout(() => {
        navigate('/dashboard', { replace: true });
      }, 500);
    } catch (err) {
      setErrorMsg(err.message || 'Unable to connect to the authentication service.');
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
      {/* Background */}
      <div className="auth-background">
        <div className="auth-bg-gradient" />

        {/* City skyline SVG */}
        <svg className="auth-bg-skyline" viewBox="0 0 1440 400" preserveAspectRatio="xMidYMax slice" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect x="0" y="320" width="1440" height="80" fill="rgba(180, 210, 230, 0.25)" />
          <path d="M0 300 Q200 260 400 300" stroke="rgba(150, 170, 190, 0.35)" strokeWidth="3" fill="none" />
          <line x1="100" y1="300" x2="100" y2="275" stroke="rgba(150, 170, 190, 0.3)" strokeWidth="2" />
          <line x1="200" y1="300" x2="200" y2="262" stroke="rgba(150, 170, 190, 0.3)" strokeWidth="2" />
          <line x1="300" y1="300" x2="300" y2="265" stroke="rgba(150, 170, 190, 0.3)" strokeWidth="2" />

          <rect x="50" y="180" width="50" height="140" rx="3" fill="rgba(150, 170, 190, 0.3)" />
          <rect x="110" y="140" width="40" height="180" rx="3" fill="rgba(140, 160, 180, 0.35)" />
          <rect x="160" y="200" width="45" height="120" rx="3" fill="rgba(150, 170, 190, 0.25)" />
          <rect x="215" y="160" width="35" height="160" rx="3" fill="rgba(160, 180, 200, 0.3)" />

          <rect x="500" y="120" width="55" height="200" rx="3" fill="rgba(140, 160, 180, 0.3)" />
          <rect x="565" y="160" width="40" height="160" rx="3" fill="rgba(150, 170, 190, 0.35)" />
          <rect x="615" y="100" width="60" height="220" rx="3" fill="rgba(140, 160, 180, 0.25)" />
          <rect x="685" y="150" width="45" height="170" rx="3" fill="rgba(160, 180, 200, 0.3)" />
          <rect x="740" y="190" width="35" height="130" rx="3" fill="rgba(150, 170, 190, 0.28)" />

          <rect x="1050" y="130" width="50" height="190" rx="3" fill="rgba(140, 160, 180, 0.35)" />
          <rect x="1110" y="170" width="40" height="150" rx="3" fill="rgba(150, 170, 190, 0.3)" />
          <rect x="1160" y="110" width="55" height="210" rx="3" fill="rgba(140, 160, 180, 0.25)" />
          <rect x="1225" y="160" width="45" height="160" rx="3" fill="rgba(160, 180, 200, 0.3)" />
          <rect x="1280" y="200" width="50" height="120" rx="3" fill="rgba(150, 170, 190, 0.28)" />
          <rect x="1340" y="140" width="40" height="180" rx="3" fill="rgba(140, 160, 180, 0.32)" />

          <circle cx="430" cy="290" r="18" fill="rgba(100, 160, 120, 0.25)" />
          <rect x="428" y="306" width="4" height="14" fill="rgba(100, 140, 100, 0.2)" />
          <circle cx="470" cy="285" r="15" fill="rgba(100, 160, 120, 0.2)" />
          <circle cx="900" cy="288" r="20" fill="rgba(100, 160, 120, 0.25)" />
          <rect x="898" y="306" width="4" height="14" fill="rgba(100, 140, 100, 0.2)" />
          <circle cx="950" cy="292" r="14" fill="rgba(100, 160, 120, 0.2)" />

          <line x1="0" y1="320" x2="1440" y2="320" stroke="rgba(150, 170, 190, 0.2)" strokeWidth="1" />
        </svg>

        {/* Rain drops */}
        <div className="rain-container">
          {raindrops.map((drop) => (
            <div
              key={drop.id}
              className="raindrop"
              style={{
                left: drop.left,
                height: drop.height,
                animationDuration: drop.duration,
                animationDelay: drop.delay,
              }}
            />
          ))}
        </div>
      </div>

      {/* Branding */}
      <div className="auth-branding">
        <div className="auth-branding-icon">
          <CloudRain size={44} strokeWidth={1.8} />
        </div>
        <h1>Urban Flood</h1>
        <p>Nowcasting System</p>
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

        {/* Form */}
        <form className="auth-form" onSubmit={handleSubmit}>
          {errorMsg && (
            <div className="auth-alert auth-alert-error" role="alert">
              <AlertCircle size={16} />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="auth-alert auth-alert-success" role="status">
              <CheckCircle size={16} />
              <span>{successMsg}</span>
            </div>
          )}

          {activeTab === 'signup' ? (
            <>
              {/* Account Credentials */}
              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="name">Full Name <span className="req-asterisk">*</span></label>
                  <div className="input-wrapper">
                    <User size={18} className="input-icon" />
                    <input
                      type="text"
                      id="name"
                      name="name"
                      placeholder="e.g. Alex Johnson"
                      value={formData.name}
                      onChange={handleInputChange}
                      autoComplete="name"
                      required
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label htmlFor="email">Email <span className="req-asterisk">*</span></label>
                  <div className="input-wrapper">
                    <Mail size={18} className="input-icon" />
                    <input
                      type="email"
                      id="email"
                      name="email"
                      placeholder="e.g. alex.johnson@example.com"
                      value={formData.email}
                      onChange={handleInputChange}
                      autoComplete="email"
                      required
                    />
                  </div>
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="password">Password <span className="req-asterisk">*</span></label>
                  <div className="input-wrapper">
                    <Lock size={18} className="input-icon" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      id="password"
                      name="password"
                      placeholder="Enter password (min 6 chars)"
                      value={formData.password}
                      onChange={handleInputChange}
                      autoComplete="new-password"
                      required
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

                <div className="form-group">
                  <label htmlFor="confirmPassword">
                    Re-enter Password <span className="req-asterisk">*</span>
                    {passwordsMatch && (
                      <span className="password-match-badge match">
                        <Check size={12} /> Matched
                      </span>
                    )}
                    {passwordsMismatch && (
                      <span className="password-match-badge mismatch">
                        Mismatch
                      </span>
                    )}
                  </label>
                  <div className={`input-wrapper ${passwordsMismatch ? 'input-error' : ''} ${passwordsMatch ? 'input-success' : ''}`}>
                    <Lock size={18} className="input-icon" />
                    <input
                      type={showConfirmPassword ? 'text' : 'password'}
                      id="confirmPassword"
                      name="confirmPassword"
                      placeholder="Re-enter your password"
                      value={formData.confirmPassword}
                      onChange={handleInputChange}
                      autoComplete="new-password"
                      required
                    />
                    <button
                      type="button"
                      className="toggle-password"
                      onClick={() => setShowConfirmPassword((prev) => !prev)}
                      aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                      id="toggle-confirm-password-btn"
                    >
                      {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>
              </div>

              {/* Location & Address Section */}
              <div className="auth-section-divider">
                <MapPin size={15} />
                <span>Address & Location Details</span>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="houseNo">
                    House/Flat No. <span className="optional-tag">(Optional)</span>
                  </label>
                  <div className="input-wrapper">
                    <Home size={18} className="input-icon" />
                    <input
                      type="text"
                      id="houseNo"
                      name="houseNo"
                      placeholder="e.g. Flat 4B, Bldg 2 (optional)"
                      value={formData.houseNo}
                      onChange={handleInputChange}
                      autoComplete="address-line1"
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label htmlFor="street">Street/Road <span className="req-asterisk">*</span></label>
                  <div className="input-wrapper">
                    <Navigation size={18} className="input-icon" />
                    <input
                      type="text"
                      id="street"
                      name="street"
                      placeholder="e.g. Main Avenue / MG Road"
                      value={formData.street}
                      onChange={handleInputChange}
                      autoComplete="address-line2"
                      required
                    />
                  </div>
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="area">Area/Locality <span className="req-asterisk">*</span></label>
                  <div className="input-wrapper">
                    <MapPin size={18} className="input-icon" />
                    <input
                      type="text"
                      id="area"
                      name="area"
                      placeholder="e.g. Sector 5 / Downtown"
                      value={formData.area}
                      onChange={handleInputChange}
                      required
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label htmlFor="city">City <span className="req-asterisk">*</span></label>
                  <div className="input-wrapper">
                    <Building size={18} className="input-icon" />
                    <input
                      type="text"
                      id="city"
                      name="city"
                      placeholder="e.g. Kolkata"
                      value={formData.city}
                      onChange={handleInputChange}
                      autoComplete="address-level2"
                      required
                    />
                  </div>
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="district">District <span className="req-asterisk">*</span></label>
                  <div className="input-wrapper">
                    <Building size={18} className="input-icon" />
                    <input
                      type="text"
                      id="district"
                      name="district"
                      placeholder="e.g. Kolkata"
                      value={formData.district}
                      onChange={handleInputChange}
                      required
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label htmlFor="state">State <span className="req-asterisk">*</span></label>
                  <div className="input-wrapper">
                    <Building size={18} className="input-icon" />
                    <input
                      type="text"
                      id="state"
                      name="state"
                      placeholder="e.g. West Bengal"
                      value={formData.state}
                      onChange={handleInputChange}
                      autoComplete="address-level1"
                      required
                    />
                  </div>
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="pinCode">PIN Code <span className="req-asterisk">*</span></label>
                  <div className="input-wrapper">
                    <MapPin size={18} className="input-icon" />
                    <input
                      type="text"
                      id="pinCode"
                      name="pinCode"
                      placeholder="e.g. 700091"
                      value={formData.pinCode}
                      onChange={handleInputChange}
                      autoComplete="postal-code"
                      required
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label htmlFor="country">Country <span className="req-asterisk">*</span></label>
                  <div className="input-wrapper">
                    <Globe size={18} className="input-icon" />
                    <input
                      type="text"
                      id="country"
                      name="country"
                      placeholder="e.g. India"
                      value={formData.country}
                      onChange={handleInputChange}
                      autoComplete="country-name"
                      required
                    />
                  </div>
                </div>
              </div>
            </>
          ) : (
            <>
              {/* Sign In Fields */}
              <div className="form-group">
                <label htmlFor="email">Email or Username</label>
                <div className="input-wrapper">
                  <Mail size={18} className="input-icon" />
                  <input
                    type="text"
                    id="email"
                    name="email"
                    placeholder="Enter your email or username"
                    value={formData.email}
                    onChange={handleInputChange}
                    autoComplete="username"
                    required
                  />
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="password">Password</label>
                <div className="input-wrapper">
                  <Lock size={18} className="input-icon" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    id="password"
                    name="password"
                    placeholder="Enter your password"
                    value={formData.password}
                    onChange={handleInputChange}
                    autoComplete="current-password"
                    required
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

              <div className="forgot-password">
                <a href="#" onClick={(e) => e.preventDefault()} id="forgot-password-link">
                  Forgot password?
                </a>
              </div>
            </>
          )}

          <button
            type="submit"
            className="auth-submit-btn"
            id="auth-submit-btn"
            disabled={loading}
          >
            {loading ? (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', justifyContent: 'center' }}>
                <Loader2 size={18} className="spin" style={{ animation: 'spin 1s linear infinite' }} />
                {activeTab === 'signin' ? 'Signing In...' : 'Creating Account...'}
              </span>
            ) : (
              activeTab === 'signin' ? 'Sign In' : 'Sign Up'
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
