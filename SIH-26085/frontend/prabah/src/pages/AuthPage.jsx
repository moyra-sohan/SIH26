import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { CloudRain, User, Mail, Lock, Eye, EyeOff, Activity, BrainCircuit, Bell, AlertCircle, CheckCircle, Loader2 } from 'lucide-react';
import '../styles/auth.css';

function AuthPage() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('signin');
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
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

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errorMsg) setErrorMsg('');
  };

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
      if (!formData.username.trim() || formData.username.trim().length < 3) {
        setErrorMsg('Username must be at least 3 characters');
        return;
      }
      if (!formData.email.trim()) {
        setErrorMsg('Please enter a valid email address');
        return;
      }
      if (formData.password.length < 6) {
        setErrorMsg('Password must be at least 6 characters');
        return;
      }
    }

    setLoading(true);

    try {
      const endpoint = isSignIn ? '/api/auth/login' : '/api/auth/register';
      const payload = isSignIn
        ? {
            email: formData.email.trim(),
            username: formData.email.trim(),
            password: formData.password,
          }
        : {
            username: formData.username.trim(),
            email: formData.email.trim(),
            password: formData.password,
          };

      const response = await fetch(`http://localhost:5000${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || 'Authentication failed. Please check your credentials.');
      }

      // Store JWT token and user info
      if (data.token) {
        localStorage.setItem('auth_token', data.token);
      }
      if (data.user) {
        localStorage.setItem('auth_user', JSON.stringify(data.user));
      }

      setSuccessMsg(isSignIn ? 'Login successful! Redirecting...' : 'Account created successfully! Redirecting...');

      setTimeout(() => {
        navigate('/dashboard');
      }, 700);
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
    setFormData({ username: '', email: '', password: '' });
  };

  return (
    <div className="auth-page">
      {/* Background */}
      <div className="auth-background">
        <div className="auth-bg-gradient" />

        {/* City skyline SVG */}
        <svg className="auth-bg-skyline" viewBox="0 0 1440 400" preserveAspectRatio="xMidYMax slice" fill="none" xmlns="http://www.w3.org/2000/svg">
          {/* Water / reflection */}
          <rect x="0" y="320" width="1440" height="80" fill="rgba(180, 210, 230, 0.25)" />

          {/* Bridge */}
          <path d="M0 300 Q200 260 400 300" stroke="rgba(150, 170, 190, 0.35)" strokeWidth="3" fill="none" />
          <line x1="100" y1="300" x2="100" y2="275" stroke="rgba(150, 170, 190, 0.3)" strokeWidth="2" />
          <line x1="200" y1="300" x2="200" y2="262" stroke="rgba(150, 170, 190, 0.3)" strokeWidth="2" />
          <line x1="300" y1="300" x2="300" y2="265" stroke="rgba(150, 170, 190, 0.3)" strokeWidth="2" />

          {/* Buildings - left cluster */}
          <rect x="50" y="180" width="50" height="140" rx="3" fill="rgba(150, 170, 190, 0.3)" />
          <rect x="110" y="140" width="40" height="180" rx="3" fill="rgba(140, 160, 180, 0.35)" />
          <rect x="160" y="200" width="45" height="120" rx="3" fill="rgba(150, 170, 190, 0.25)" />
          <rect x="215" y="160" width="35" height="160" rx="3" fill="rgba(160, 180, 200, 0.3)" />

          {/* Buildings - center */}
          <rect x="500" y="120" width="55" height="200" rx="3" fill="rgba(140, 160, 180, 0.3)" />
          <rect x="565" y="160" width="40" height="160" rx="3" fill="rgba(150, 170, 190, 0.35)" />
          <rect x="615" y="100" width="60" height="220" rx="3" fill="rgba(140, 160, 180, 0.25)" />
          <rect x="685" y="150" width="45" height="170" rx="3" fill="rgba(160, 180, 200, 0.3)" />
          <rect x="740" y="190" width="35" height="130" rx="3" fill="rgba(150, 170, 190, 0.28)" />

          {/* Buildings - right cluster */}
          <rect x="1050" y="130" width="50" height="190" rx="3" fill="rgba(140, 160, 180, 0.35)" />
          <rect x="1110" y="170" width="40" height="150" rx="3" fill="rgba(150, 170, 190, 0.3)" />
          <rect x="1160" y="110" width="55" height="210" rx="3" fill="rgba(140, 160, 180, 0.25)" />
          <rect x="1225" y="160" width="45" height="160" rx="3" fill="rgba(160, 180, 200, 0.3)" />
          <rect x="1280" y="200" width="50" height="120" rx="3" fill="rgba(150, 170, 190, 0.28)" />
          <rect x="1340" y="140" width="40" height="180" rx="3" fill="rgba(140, 160, 180, 0.32)" />

          {/* Trees */}
          <circle cx="430" cy="290" r="18" fill="rgba(100, 160, 120, 0.25)" />
          <rect x="428" y="306" width="4" height="14" fill="rgba(100, 140, 100, 0.2)" />
          <circle cx="470" cy="285" r="15" fill="rgba(100, 160, 120, 0.2)" />
          <circle cx="900" cy="288" r="20" fill="rgba(100, 160, 120, 0.25)" />
          <rect x="898" y="306" width="4" height="14" fill="rgba(100, 140, 100, 0.2)" />
          <circle cx="950" cy="292" r="14" fill="rgba(100, 160, 120, 0.2)" />

          {/* Ground line */}
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
      <div className="auth-card">
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

          {activeTab === 'signup' && (
            <div className="form-group">
              <label htmlFor="username">User Name</label>
              <div className="input-wrapper">
                <User size={18} className="input-icon" />
                <input
                  type="text"
                  id="username"
                  name="username"
                  placeholder="Enter your user name"
                  value={formData.username}
                  onChange={handleInputChange}
                  autoComplete="username"
                  required
                />
              </div>
            </div>
          )}

          <div className="form-group">
            <label htmlFor="email">{activeTab === 'signin' ? 'Email or Username' : 'Email'}</label>
            <div className="input-wrapper">
              <Mail size={18} className="input-icon" />
              <input
                type={activeTab === 'signin' ? 'text' : 'email'}
                id="email"
                name="email"
                placeholder={activeTab === 'signin' ? 'Enter your email or username' : 'Enter your email'}
                value={formData.email}
                onChange={handleInputChange}
                autoComplete={activeTab === 'signin' ? 'username' : 'email'}
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
                autoComplete={activeTab === 'signin' ? 'current-password' : 'new-password'}
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
