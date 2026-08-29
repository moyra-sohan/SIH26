import { useNavigate, useLocation } from 'react-router-dom';
import { Droplets, LayoutDashboard, Map, BarChart3, Settings, LogOut } from 'lucide-react';

function Sidebar({ isOpen, onClose }) {
  const navigate = useNavigate();
  const location = useLocation();

  const navItems = [
    { icon: <LayoutDashboard size={20} />, label: 'Dashboard', path: '/dashboard' },
    { icon: <Map size={20} />, label: 'Map', path: '/map' },
  ];

  const handleNavigate = (path) => {
    navigate(path);
    onClose();
  };

  const handleLogout = () => {
    const payload = {
      action: 'logout',
      timestamp: new Date().toISOString(),
    };
    console.log('Sending to backend:', JSON.stringify(payload, null, 2));
    navigate('/');
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
            <Droplets size={22} />
          </div>
          <div className="sidebar-brand-text">
            <h2>Urban Flood</h2>
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
              id={`nav-${item.label.toLowerCase()}`}
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
