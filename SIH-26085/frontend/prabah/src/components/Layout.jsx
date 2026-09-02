import { useState, useRef, useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { MapPin, User, ChevronDown, Menu, Mail, LogOut, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import Sidebar from './Sidebar.jsx';
import NotificationCenter from './NotificationCenter.jsx';
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
  '/emergency': {
    title: 'Emergency Support',
    subtitle: '24/7 Hotlines & Safety Information for Disaster Response.',
  },
};

function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const profileRef = useRef(null);
  const location = useLocation();
  const { user, logout } = useAuth();

  const toggleSidebar = () => setSidebarOpen((prev) => !prev);
  const closeSidebar = () => setSidebarOpen(false);

  const meta = PAGE_META[location.pathname] || {
    title: 'PRABAH',
    subtitle: 'Nowcasting System',
  };

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (profileRef.current && !profileRef.current.contains(event.target)) {
        setProfileOpen(false);
      }
    };
    if (profileOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [profileOpen]);

  const userLocationString = [user?.city, user?.state].filter(Boolean).join(', ') || 'Kolkata, West Bengal';

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
              <span>{userLocationString}</span>
            </div>
            <div className="status-indicator">
              <span>Updated just now</span>
              <div className="status-dot" />
            </div>

            {/* Notification Center */}
            <NotificationCenter />

            {/* Profile trigger & Dropdown */}
            <div className="profile-dropdown-container" ref={profileRef} style={{ position: 'relative' }}>
              <button
                className="user-profile-btn"
                id="user-profile-btn"
                onClick={() => setProfileOpen((prev) => !prev)}
                aria-expanded={profileOpen}
              >
                <div className="user-avatar">
                  <User size={16} />
                </div>
                <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--dark-text)', maxWidth: '120px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {user?.name || user?.username || 'User Profile'}
                </span>
                <ChevronDown size={14} style={{ transform: profileOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
              </button>

              {profileOpen && (
                <div className="profile-popover" style={{
                  position: 'absolute',
                  top: 'calc(100% + 8px)',
                  right: 0,
                  width: '320px',
                  background: '#ffffff',
                  borderRadius: '16px',
                  boxShadow: '0 12px 36px rgba(0, 0, 0, 0.15)',
                  border: '1px solid #E2E8F0',
                  padding: '20px',
                  zIndex: 200,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div style={{
                        width: '40px',
                        height: '40px',
                        borderRadius: '50%',
                        background: 'linear-gradient(135deg, var(--primary) 0%, var(--primary-hover) 100%)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#fff',
                        fontWeight: 700,
                        fontSize: '1rem',
                      }}>
                        {(user?.name || user?.username || 'U')[0].toUpperCase()}
                      </div>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: '0.95rem', color: '#0F172A' }}>
                          {user?.name || user?.username || 'User'}
                        </div>
                        <div style={{ fontSize: '0.78rem', color: '#64748B', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <Mail size={12} />
                          {user?.email || 'N/A'}
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => setProfileOpen(false)}
                      style={{ background: 'none', border: 'none', color: '#94A3B8', cursor: 'pointer' }}
                    >
                      <X size={18} />
                    </button>
                  </div>

                  <div style={{ borderTop: '1px solid #F1F5F9', paddingTop: '12px', marginBottom: '14px' }}>
                    <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--primary)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '5px' }}>
                      <MapPin size={13} /> Registered Address
                    </div>
                    <div style={{ fontSize: '0.82rem', color: '#334155', lineHeight: '1.5', background: '#F8FAFC', padding: '10px 12px', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
                      <div><strong>House/Flat:</strong> {user?.houseNo || '—'}</div>
                      <div><strong>Street:</strong> {user?.street || '—'}</div>
                      <div><strong>Area:</strong> {user?.area || '—'}</div>
                      <div><strong>City / Dist:</strong> {[user?.city, user?.district].filter(Boolean).join(', ') || '—'}</div>
                      <div><strong>State & PIN:</strong> {[user?.state, user?.pinCode].filter(Boolean).join(' - ') || '—'}</div>
                      <div><strong>Country:</strong> {user?.country || 'India'}</div>
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      setProfileOpen(false);
                      logout();
                    }}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      background: '#FEE2E2',
                      color: '#DC2626',
                      border: 'none',
                      borderRadius: '8px',
                      fontWeight: 600,
                      fontSize: '0.84rem',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px',
                      cursor: 'pointer',
                    }}
                  >
                    <LogOut size={16} /> Sign Out
                  </button>
                </div>
              )}
            </div>
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
