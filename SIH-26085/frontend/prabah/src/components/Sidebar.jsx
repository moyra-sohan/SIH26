import { useNavigate, useLocation } from 'react-router-dom';
import { LayoutDashboard, Map, Phone, LogOut } from 'lucide-react';
import PrabahLogo from './PrabahLogo.jsx';
import { useAuth } from '../context/AuthContext.jsx';

function Sidebar({ isOpen, onClose }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { logout } = useAuth();

  const navItems = [
    { icon: <LayoutDashboard size={20} />, label: 'Dashboard', path: '/dashboard' },
    { icon: <Map size={20} />, label: 'Map', path: '/map' },
    { icon: <Phone size={20} />, label: 'Emergency Support', path: '/emergency' },
  ];

  const handleNavigate = (path) => {
    navigate(path);
    onClose();
  };

  const handleLogout = async () => {
    onClose();
    await logout();
  };

  return (
    <>
      {/* Overlay for mobile */}
      <div
        className={`sidebar-overlay ${isOpen ? 'visible' : ''}`}
        onClick={onClose}
        role="presentation"
      />

      <aside className={`sidebar ${isOpen ? 'open' : ''}`}>
        {/* Brand */}
        <div className="sidebar-brand">
          <div className="sidebar-brand-icon">
            <PrabahLogo size={28} />
          </div>
          <div className="sidebar-brand-text">
            <h2>PRABAH</h2>
            <p>Nowcasting System</p>
          </div>
        </div>

        {/* Navigation */}
        <nav className="sidebar-nav">
          {navItems.map((item) => (
            <button
              key={item.label}
              className={`sidebar-nav-item ${location.pathname === item.path ? 'active' : ''}`}
              onClick={() => handleNavigate(item.path)}
              id={`nav-${item.label.toLowerCase().replace(/\s+/g, '-')}`}
            >
              {item.icon}
              {item.label}
            </button>
          ))}

          <button
            className="sidebar-nav-item logout"
            onClick={handleLogout}
            id="nav-logout"
          >
            <LogOut size={20} />
            Logout
          </button>
        </nav>
      </aside>
    </>
  );
}

export default Sidebar;
