import { AlertTriangle } from 'lucide-react';

function FloodRiskCard() {
  const handleViewDetails = () => {
    const payload = {
      action: 'view_flood_details',
      riskLevel: 'high',
      riskIndex: 0.78,
      timestamp: new Date().toISOString(),
    };
    console.log('Sending to backend:', JSON.stringify(payload, null, 2));
    alert('Flood Risk Details: High risk of waterlogging detected in low-lying areas. Stay safe!');
  };

  return (
    <div className="flood-risk-card" id="flood-risk-card">
      <div className="flood-risk-header">
        <AlertTriangle size={18} />
        <span>Flood Risk Status</span>
      </div>
      <div className="flood-risk-level">High Risk</div>
      <p className="flood-risk-desc">
        High chance of waterlogging in low-lying areas.
      </p>
      <button className="flood-risk-link" onClick={handleViewDetails} id="flood-risk-details-btn">
        View details →
      </button>
    </div>
  );
}

export default FloodRiskCard;
