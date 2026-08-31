import { AlertTriangle, Sparkles, TrendingUp } from 'lucide-react';
import { useFloodData } from '../../context/FloodDataContext';

function FloodRiskCard({ onOpenSimulator }) {
  const { selectedWard, stats } = useFloodData();

  const currentRisk = selectedWard ? selectedWard.predicted_risk : stats?.flood_risk_level || 'Major';
  const riskScore = selectedWard ? selectedWard.risk_score : stats?.flood_risk_score || 0.82;
  const probabilities = selectedWard?.probabilities || {
    Major: 0.69,
    Moderate: 0.28,
    Minor: 0.03,
    'No Risk': 0,
  };

  const getRiskColor = (risk) => {
    switch (risk) {
      case 'Major':
        return '#DC2626';
      case 'Moderate':
        return '#EA580C';
      case 'Minor':
        return '#CA8A04';
      default:
        return '#16A34A';
    }
  };

  const getRiskDescription = (risk) => {
    switch (risk) {
      case 'Major':
        return 'Critical waterlogging risk. Pumping units active & vulnerable roads flooded.';
      case 'Moderate':
        return 'Moderate water accumulation on roads. Watch low-lying zones.';
      case 'Minor':
        return 'Minor localized puddling expected. Drainage functioning normally.';
      default:
        return 'Normal conditions. No significant flood hazard detected.';
    }
  };

  const color = getRiskColor(currentRisk);

  return (
    <div className="flood-risk-card" id="flood-risk-card" style={{ borderColor: `${color}40` }}>
      <div className="flood-risk-header">
        <div className="flex items-center gap-2">
          <AlertTriangle size={18} style={{ color }} />
          <span className="font-semibold text-slate-800">
            ML Flood Risk Status
          </span>
        </div>
        <span
          className="risk-badge-pill"
          style={{ background: `${color}15`, color, borderColor: `${color}30` }}
        >
          {selectedWard ? `Ward ${selectedWard.ward_id}` : 'City Overview'}
        </span>
      </div>

      <div className="flood-risk-level" style={{ color }}>
        {currentRisk} Risk
      </div>

      <p className="flood-risk-desc">{getRiskDescription(currentRisk)}</p>

      {/* Model Confidence Breakdown */}
      <div className="risk-prob-breakdown">
        <div className="risk-prob-header">
          <span>Model Confidence</span>
          <span className="font-semibold">Risk Score: {riskScore} / 1.0</span>
        </div>
        <div className="risk-bars-container">
          {Object.entries(probabilities).map(([cls, prob]) => {
            const pct = Math.round(prob * 100);
            if (pct === 0 && cls === 'No Risk') return null;
            return (
              <div className="risk-bar-item" key={cls} title={`${cls}: ${pct}%`}>
                <span className="risk-bar-label">{cls[0]}</span>
                <div className="risk-bar-track">
                  <div
                    className="risk-bar-fill"
                    style={{
                      width: `${pct}%`,
                      backgroundColor: getRiskColor(cls),
                    }}
                  />
                </div>
                <span className="risk-bar-pct">{pct}%</span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="flood-risk-actions">
        <button
          className="flood-risk-link"
          onClick={onOpenSimulator}
          id="flood-risk-details-btn"
        >
          <Sparkles size={14} />
          <span>Run AI Simulation →</span>
        </button>
      </div>
    </div>
  );
}

export default FloodRiskCard;
