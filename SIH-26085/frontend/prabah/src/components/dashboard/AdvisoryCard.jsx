import { ShieldCheck, Umbrella, CheckCircle2 } from 'lucide-react';
import { useFloodData } from '../../context/FloodDataContext';

function AdvisoryCard() {
  const { advisories, selectedWard } = useFloodData();

  const currentAdvisories = advisories && advisories.length > 0
    ? advisories
    : [
        'Avoid low-lying routes in Behala, Kasba, Topsia & Garden Reach during high tide.',
        'High tide in Hooghly river may slow lock-gate drainage discharge.',
        'Park vehicles in elevated zones and keep emergency contact numbers handy.',
        'Municipal pumping units deployed across Behala, Kasba, Topsia, and Garden Reach.',
      ];

  return (
    <div className="advisory-card" id="advisory-card">
      <div className="advisory-content">
        <div className="advisory-header">
          <div className="advisory-header-icon">
            <ShieldCheck size={20} />
          </div>
          <div>
            <h3>Nowcasting Public Advisory</h3>
            <p className="text-xs text-green-700 opacity-90">
              {selectedWard ? `Safety recommendations for ${selectedWard.ward_name}` : 'City-wide flood safety guidelines'}
            </p>
          </div>
        </div>

        <ul className="advisory-list">
          {currentAdvisories.map((item, index) => (
            <li key={index} className="flex items-start gap-2">
              <CheckCircle2 size={15} className="advisory-check flex-shrink-0 mt-0.5" />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="advisory-illustration">
        <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
          {/* Umbrella */}
          <path d="M50 15 C25 15 10 35 10 50 L50 50 L90 50 C90 35 75 15 50 15Z" fill="#16A34A" opacity="0.3" />
          <line x1="50" y1="15" x2="50" y2="80" stroke="#16A34A" strokeWidth="2.5" opacity="0.5" />
          <path d="M50 80 Q46 85 42 82" stroke="#16A34A" strokeWidth="2" fill="none" opacity="0.5" />

          {/* Rain drops */}
          <line x1="25" y1="55" x2="23" y2="65" stroke="#93C5FD" strokeWidth="1.5" opacity="0.4" />
          <line x1="75" y1="55" x2="73" y2="65" stroke="#93C5FD" strokeWidth="1.5" opacity="0.4" />
          <line x1="15" y1="60" x2="13" y2="70" stroke="#93C5FD" strokeWidth="1.5" opacity="0.4" />
          <line x1="85" y1="58" x2="83" y2="68" stroke="#93C5FD" strokeWidth="1.5" opacity="0.4" />

          {/* Ground */}
          <path d="M20 90 Q50 85 80 90" stroke="#16A34A" strokeWidth="1.5" fill="none" opacity="0.3" />
        </svg>
      </div>
    </div>
  );
}

export default AdvisoryCard;
