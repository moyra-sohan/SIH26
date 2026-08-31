import {
  CloudRain,
  AlertTriangle,
  Waves,
  Settings,
  MapPin,
} from 'lucide-react';
import { useFloodData } from '../../context/FloodDataContext';

function StatCard({ icon: Icon, label, value, unit, status, statusExtra, color, bgColor, borderColor, id }) {
  return (
    <div className="stat-card" id={`stat-card-${id}`}>
      <div
        className="stat-icon"
        style={{
          background: bgColor,
          border: `1px solid ${borderColor}`,
        }}
      >
        {Icon && <Icon size={22} style={{ color }} />}
      </div>
      <div className="stat-info">
        <div className="stat-label">{label}</div>
        <div className="stat-value">
          {value}
          {unit && <span className="stat-unit">{unit}</span>}
        </div>
        <div className="stat-status" style={{ color }}>
          {status}
          {statusExtra && (
            <>
              {' / '}
              <span style={{ fontWeight: 600 }}>{statusExtra}</span>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function StatsRow() {
  const { stats, selectedWard } = useFloodData();

  const rainfallVal = selectedWard
    ? selectedWard.historical_rainfall_mm
    : stats?.rainfall_24h || 330.4;

  const riskLevel = selectedWard
    ? selectedWard.predicted_risk
    : stats?.flood_risk_level || 'Major';

  const riskScore = selectedWard
    ? selectedWard.risk_score
    : stats?.flood_risk_score || 0.82;

  const drainLoad = selectedWard
    ? selectedWard.drain_load_utilization_percent
    : stats?.avg_drain_utilization_percent || 90.5;

  const incidents = selectedWard
    ? selectedWard.reported_waterlogging_incidents
    : stats?.total_affected_roads || 32;

  const isDrainOverloaded = drainLoad > 90;

  const getRiskDetails = (risk) => {
    switch (risk) {
      case 'Major':
        return { color: '#DC2626', bg: '#FEF2F2', border: '#FECACA' };
      case 'Moderate':
        return { color: '#EA580C', bg: '#FFF7ED', border: '#FFEDD5' };
      case 'Minor':
        return { color: '#CA8A04', bg: '#FEFCE8', border: '#FEF08A' };
      default:
        return { color: '#16A34A', bg: '#F0FDF4', border: '#BBF7D0' };
    }
  };

  const riskTheme = getRiskDetails(riskLevel);

  return (
    <div className="stats-row">
      {/* 1. Rainfall */}
      <StatCard
        id="rainfall"
        icon={CloudRain}
        label="Rainfall (August 2026)"
        value={rainfallVal}
        unit=" mm"
        status={rainfallVal > 320 ? 'Heavy Monsoon' : 'Moderate'}
        color="#2563EB"
        bgColor="#EFF6FF"
        borderColor="#BFDBFE"
      />

      {/* 2. Flood Risk Level */}
      <StatCard
        id="flood-risk"
        icon={AlertTriangle}
        label="ML Flood Risk Index"
        value={riskScore}
        unit=""
        status={`${riskLevel} Risk`}
        statusExtra={selectedWard ? `Ward ${selectedWard.ward_id}` : 'City Avg'}
        color={riskTheme.color}
        bgColor={riskTheme.bg}
        borderColor={riskTheme.border}
      />

      {/* 3. Hooghly Water Level */}
      <StatCard
        id="water-level"
        icon={Waves}
        label="Water Level (Hooghly)"
        value={selectedWard?.water_body_proximity?.includes('Hooghly') ? '4.5' : '4.2'}
        unit=" m"
        status="High Tide Warning"
        color="#D97706"
        bgColor="#FFFBEB"
        borderColor="#FDE68A"
      />

      {/* 4. Drainage Capacity */}
      <StatCard
        id="drainage"
        icon={Settings}
        label="Drain Load Saturation"
        value={drainLoad}
        unit="%"
        status={isDrainOverloaded ? 'Overloaded' : 'Operational'}
        color={isDrainOverloaded ? '#DC2626' : '#16A34A'}
        bgColor={isDrainOverloaded ? '#FEF2F2' : '#F0FDF4'}
        borderColor={isDrainOverloaded ? '#FECACA' : '#BBF7D0'}
      />

      {/* 5. Affected Roads */}
      <StatCard
        id="roads"
        icon={MapPin}
        label="Road Incidents"
        value={incidents}
        unit=" spots"
        status={incidents > 2 ? 'Significant Impact' : 'Minor Disruptions'}
        color="#7C3AED"
        bgColor="#F5F3FF"
        borderColor="#DDD6FE"
      />
    </div>
  );
}

export default StatsRow;
