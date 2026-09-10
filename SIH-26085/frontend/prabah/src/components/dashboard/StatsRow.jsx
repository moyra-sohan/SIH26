import {
  CloudRain,
  AlertTriangle,
  Waves,
  Settings,
  MapPin,
} from 'lucide-react';

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

function StatsRow({ prediction }) {
  const rainfall = prediction?.inputs_summary?.rainfall_mm || 82;
  const floodProb = prediction?.flood_probability !== undefined
    ? prediction.flood_probability.toFixed(2)
    : '0.78';
  const riskLevel = prediction?.risk_level || 'High';
  const riskColor = prediction?.risk_color || '#DC2626';
  const waterDepth = prediction?.estimated_waterlogging_depth_cm !== undefined
    ? (prediction.estimated_waterlogging_depth_cm / 10).toFixed(1)
    : '4.2';
  const drainLoad = prediction?.inputs_summary?.drainage_load_percent || 85;

  const dynamicStats = [
    {
      id: 1,
      label: 'Rainfall (24h)',
      value: `${rainfall}`,
      unit: 'mm',
      status: '↑ Live Measurement',
      color: '#2563EB',
      bgColor: '#EFF6FF',
      borderColor: '#BFDBFE',
      iconName: 'CloudRain',
    },
    {
      id: 2,
      label: 'Flood Risk Index',
      value: `${floodProb}`,
      unit: '',
      status: riskLevel,
      statusExtra: prediction?.risk_level === 'Critical' ? 'Surging' : 'Nowcasting',
      color: riskColor,
      bgColor: `${riskColor}10`,
      borderColor: `${riskColor}30`,
      iconName: 'AlertTriangle',
    },
    {
      id: 3,
      label: 'Water Depth (Est)',
      value: `${waterDepth}`,
      unit: 'm',
      status: parseFloat(waterDepth) > 3.0 ? 'Above Normal' : 'Normal Range',
      color: '#F59E0B',
      bgColor: '#FFFBEB',
      borderColor: '#FDE68A',
      iconName: 'Waves',
    },
    {
      id: 4,
      label: 'Drainage Load',
      value: `${drainLoad}%`,
      unit: '',
      status: drainLoad > 80 ? 'Heavy Load' : 'Operational',
      color: drainLoad > 80 ? '#EA580C' : '#16A34A',
      bgColor: drainLoad > 80 ? '#FFF7ED' : '#F0FDF4',
      borderColor: drainLoad > 80 ? '#FFEDD5' : '#BBF7D0',
      iconName: 'Settings',
    },
    {
      id: 5,
      label: 'Affected Corridors',
      value: prediction?.risk_level === 'Critical' ? '18' : (prediction?.risk_level === 'High' ? '12' : '3'),
      unit: '',
      status: prediction?.risk_level === 'Critical' ? 'Severe Impact' : 'Moderate Impact',
      color: '#7C3AED',
      bgColor: '#F5F3FF',
      borderColor: '#DDD6FE',
      iconName: 'MapPin',
    },
  ];

  return (
    <div className="stats-row">
      {dynamicStats.map((stat) => (
        <StatCard key={stat.id} stat={stat} />
      ))}
    </div>
  );
}

export default StatsRow;
