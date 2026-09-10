import { AlertTriangle, Info, ShieldAlert } from 'lucide-react';
import { alertsData } from '../../data/alertsData';

const iconMap = {
  AlertTriangle,
  Info,
  ShieldAlert,
};

function RecentAlerts({ prediction }) {
  const dynamicAlerts = prediction?.advisories && prediction.advisories.length > 0
    ? prediction.advisories.map((adv, idx) => ({
        id: idx + 1,
        severity: prediction.risk_level === 'Critical' ? 'high' : (prediction.risk_level === 'High' ? 'warning' : 'info'),
        message: adv,
        time: `${(idx + 1) * 10} mins ago`,
        iconName: prediction.risk_level === 'Critical' ? 'AlertTriangle' : 'Info',
      }))
    : alertsData;

  return (
    <div className="dashboard-card" id="recent-alerts-card">
      <div className="card-header">
        <h3>Recent AI Alerts & Warnings</h3>
      </div>

      <div className="alert-list">
        {dynamicAlerts.map((alert) => {
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
