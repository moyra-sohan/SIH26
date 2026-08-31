import { AlertTriangle, Info, ShieldAlert } from 'lucide-react';
import { useFloodData } from '../../context/FloodDataContext';

const iconMap = {
  AlertTriangle,
  Info,
  ShieldAlert,
};

function RecentAlerts() {
  const { alerts } = useFloodData();

  const currentAlerts = alerts && alerts.length > 0
    ? alerts
    : [
        {
          id: 1,
          severity: 'high',
          message: 'CRITICAL: Major flood risk predicted in Behala, Kasba, Topsia & Garden Reach.',
          time: 'Just now',
          iconName: 'AlertTriangle',
        },
        {
          id: 2,
          severity: 'warning',
          message: 'Drainage Alert: Capacity utilization >95% across southern low-lying zones.',
          time: '12 mins ago',
          iconName: 'AlertTriangle',
        },
        {
          id: 3,
          severity: 'info',
          message: 'Heavy monsoon rainfall forecasted (280-350mm). Pumping stations active.',
          time: '25 mins ago',
          iconName: 'Info',
        },
      ];

  return (
    <div className="dashboard-card" id="recent-alerts-card">
      <div className="card-header">
        <div>
          <h3>Live ML Risk Alerts</h3>
          <p className="card-subtitle text-xs text-slate-500">
            Real-time notifications triggered by nowcasting prediction thresholds
          </p>
        </div>
      </div>

      <div className="alert-list">
        {currentAlerts.map((alert) => {
          const IconComp = iconMap[alert.iconName] || AlertTriangle;
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
