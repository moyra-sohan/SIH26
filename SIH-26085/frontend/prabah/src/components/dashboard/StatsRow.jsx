import {
  CloudRain,
  AlertTriangle,
  Waves,
  Settings,
  MapPin,
} from 'lucide-react';
import { statsData } from '../../data/weatherData';

const iconMap = {
  CloudRain,
  AlertTriangle,
  Waves,
  Settings,
  MapPin,
};

function StatCard({ stat }) {
  const IconComponent = iconMap[stat.iconName];

  return (
    <div className="stat-card" id={`stat-card-${stat.id}`}>
      <div
        className="stat-icon"
        style={{
          background: stat.bgColor,
          border: `1px solid ${stat.borderColor}`,
        }}
      >
        {IconComponent && <IconComponent size={22} style={{ color: stat.color }} />}
      </div>
      <div className="stat-info">
        <div className="stat-label">{stat.label}</div>
        <div className="stat-value">
          {stat.value}
          {stat.unit && <span className="stat-unit">{stat.unit}</span>}
        </div>
        <div className="stat-status" style={{ color: stat.color }}>
          {stat.status}
          {stat.statusExtra && (
            <>
              {' / '}
              <span style={{ fontWeight: 600 }}>↑ {stat.statusExtra}</span>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function StatsRow() {
  return (
    <div className="stats-row">
      {statsData.map((stat) => (
        <StatCard key={stat.id} stat={stat} />
      ))}
    </div>
  );
}

export default StatsRow;
