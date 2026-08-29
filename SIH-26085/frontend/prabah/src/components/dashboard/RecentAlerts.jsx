import { AlertTriangle, Info } from 'lucide-react';
import { alertsData } from '../../data/alertsData';

const iconMap = {
  AlertTriangle,
  Info,
};

function RecentAlerts() {
  return (
    <div className="dashboard-card" id="recent-alerts-card">
      <div className="card-header">
        <h3>Recent Alerts</h3>
      </div>

      <div className="alert-list">
        {alertsData.map((alert) => {
          const IconComp = iconMap[alert.iconName] || Info;
          return (
            <div className="alert-item" key={alert.id}>
              <div className={`alert-icon ${alert.severity}`}>
                <IconComp size={16} />
              </div>
              <span className="alert-message">{alert.message}</span>
              <span className="alert-time">{alert.time}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default RecentAlerts;
