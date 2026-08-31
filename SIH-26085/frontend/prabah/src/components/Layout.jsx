import { useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { MapPin, User, ChevronDown, Menu } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import Sidebar from './Sidebar.jsx';
import '../styles/layout.css';

// Page metadata for header titles
const PAGE_META = {
  '/dashboard': {
    title: 'Dashboard',
    subtitle: 'Real-time overview of weather, flood risk and environment.',
  },
  '/map': {
    title: 'Flood Risk Map',
    subtitle: 'Interactive 2D map of Kolkata — urban flood monitoring & prediction.',
  },
};

function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();
  const { user } = useAuth();

  const toggleSidebar = () => setSidebarOpen((prev) => !prev);
  const closeSidebar = () => setSidebarOpen(false);

  const meta = PAGE_META[location.pathname] || {
    title: 'Urban Flood',
    subtitle: 'Nowcasting System',
  };

  const handleProfileClick = () => {
    const payload = {
      action: 'profile_click',
      timestamp: new Date().toISOString(),
    };
    console.log('Sending to backend:', JSON.stringify(payload, null, 2));
  };

  return (
    <div className="app-layout">
      <Sidebar isOpen={sidebarOpen} onClose={closeSidebar} />

      <div className="main-content">
        {/* Shared Header */}
        <header className="layout-header">
          <div className="layout-header-left">
            <button
              className="hamburger-btn"
              onClick={toggleSidebar}
              aria-label="Toggle menu"
              id="hamburger-btn"
            >
              <Menu size={22} />
            </button>
            <div>
              <div className="layout-page-title">{meta.title}</div>
              <div className="layout-page-subtitle">{meta.subtitle}</div>
            </div>
          </div>

          <div className="layout-header-right">
            <div className="location-badge">
              <MapPin size={15} />
              <span>Kolkata, West Bengal</span>
            </div>
            <div className="status-indicator">
              <span>Updated just now</span>
              <div className="status-dot" />
            </div>
            <button
              className="user-profile-btn"
              id="user-profile-btn"
              onClick={handleProfileClick}
            >
              <div className="user-avatar">
                <User size={16} />
              </div>
              <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--dark-text)', maxWidth: '100px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {user?.username || 'Account'}
              </span>
              <ChevronDown size={14} />
            </button>
          </div>
        </header>

        {/* Page content — child routes render here */}
        <div className="page-content">
          <Outlet />
        </div>
      </div>
    </div>
  );
}

export default Layout;
