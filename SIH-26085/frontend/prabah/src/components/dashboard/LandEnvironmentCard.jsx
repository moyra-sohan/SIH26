import { Building2, Mountain, Layers, TreePine, Square } from 'lucide-react';
import { landEnvironmentData } from '../../data/weatherData';

const iconMap = {
  Building2,
  Mountain,
  Layers,
  TreePine,
  Square,
};

function LandEnvironmentCard() {
  return (
    <div className="dashboard-card" id="land-environment-card">
      <div className="card-header">
        <h3>Land & Environment</h3>
      </div>

      <div className="land-env-list">
        {landEnvironmentData.map((item) => {
          const IconComp = iconMap[item.iconName];
          return (
            <div className="land-env-item" key={item.label}>
              <div className="land-env-left">
                {IconComp && <IconComp size={16} />}
                <span>{item.label}</span>
              </div>
              <span className="land-env-value">{item.value}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default LandEnvironmentCard;
