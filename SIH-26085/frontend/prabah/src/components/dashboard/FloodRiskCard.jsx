import { AlertTriangle, Sparkles } from 'lucide-react';

function FloodRiskCard({ prediction, onOpenSimulator }) {
  const riskLevel = prediction?.risk_level || 'High';
  const riskColor = prediction?.risk_color || '#DC2626';
  const probability = prediction?.flood_probability !== undefined
    ? (prediction.flood_probability * 100).toFixed(0)
    : '78';
  const desc = prediction?.status_text || 'High chance of waterlogging in low-lying areas.';

  return (
    <div
      className="flood-risk-card"
      id="flood-risk-card"
      style={{
        background: `linear-gradient(135deg, ${riskColor}12 0%, ${riskColor}08 100%)`,
        borderColor: `${riskColor}40`,
      }}
    >
      <div className="flood-risk-header">
        <AlertTriangle size={18} style={{ color: riskColor }} />
        <span style={{ color: riskColor }}>AI Flood Risk Status</span>
        <span
          style={{
            marginLeft: 'auto',
            fontSize: '0.75rem',
            fontWeight: 700,
            color: riskColor,
            background: `${riskColor}20`,
            padding: '2px 8px',
            borderRadius: '12px',
          }}
        >
          {probability}% Probability
        </span>
      </div>

      <div className="flood-risk-level" style={{ color: riskColor }}>
        {riskLevel} Risk
      </div>

      <p className="flood-risk-desc">
        {desc}
      </p>

      <div style={{ marginTop: 'auto', display: 'flex', gap: '8px', alignItems: 'center' }}>
        <button
          className="flood-risk-link"
          onClick={onOpenSimulator}
          id="flood-risk-details-btn"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            background: riskColor,
            color: '#FFFFFF',
            border: 'none',
            padding: '8px 14px',
            borderRadius: '8px',
            fontWeight: 600,
            fontSize: '0.82rem',
            cursor: 'pointer',
            boxShadow: `0 2px 8px ${riskColor}40`,
          }}
        >
          <Sparkles size={14} />
          <span>Simulate & Nowcast AI →</span>
        </button>
      </div>
    </div>
  );
}

export default FloodRiskCard;
