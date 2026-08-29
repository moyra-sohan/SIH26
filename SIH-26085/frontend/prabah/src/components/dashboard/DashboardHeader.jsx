import { MapPin, User, ChevronDown, Menu } from 'lucide-react';

function DashboardHeader({ onMenuToggle }) {
  return (
    <>
      {/* Mobile header */}
      <div className="mobile-header">
        <button
          className="hamburger-btn"
          onClick={onMenuToggle}
          aria-label="Toggle menu"
          id="hamburger-btn"
        >
          <Menu size={24} />
        </button>
        <div className="mobile-brand">
          <div className="mobile-brand-icon">
            <span style={{ fontSize: '14px' }}>🌊</span>
          </div>
          <span>Urban Flood</span>
        </div>
        <div className="user-avatar">
          <User size={16} />
        </div>
      </div>

      {/* Desktop header */}
      <header className="dashboard-header">
        <div className="dashboard-header-left">
          <h1>Dashboard</h1>
          <p>Real-time overview of weather, flood risk and environment at your current location.</p>
        </div>

        <div className="dashboard-header-right">
          <div className="location-badge">
            <MapPin size={16} />
            <span>Kolkata, West Bengal</span>
          </div>

          <div className="status-indicator">
            <span>Updated just now</span>
            <div className="status-dot" />
          </div>

          <button
            className="user-profile-btn"
            id="user-profile-btn"
            onClick={() => {
              const payload = {
                action: 'profile_click',
                timestamp: new Date().toISOString(),
              };
              console.log('Sending to backend:', JSON.stringify(payload, null, 2));
            }}
          >
            <div className="user-avatar">
              <User size={16} />
            </div>
            <ChevronDown size={14} />
          </button>
        </div>
      </header>
    </>
  );
}

export default DashboardHeader;
