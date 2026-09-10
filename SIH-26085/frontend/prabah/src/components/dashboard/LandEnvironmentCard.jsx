import { Building2, Mountain, Layers, TreePine, Square } from 'lucide-react';
import { landEnvironmentData } from '../../data/weatherData';

const iconMap = {
  Building2,
  Mountain,
  Layers,
  TreePine,
  Square,
};

function LandEnvironmentCard({ activeWard }) {
  const dynamicData = activeWard
    ? [
        { label: 'Land Type', value: activeWard.landscape_type || 'Urban', iconName: 'Building2' },
        { label: 'Elevation', value: `${activeWard.elevation_m || 9} m MSL (${activeWard.elevation_category || 'Low'})`, iconName: 'Mountain' },
        { label: 'Drainage Type', value: activeWard.drainage_system_type ? 'Pump-Assisted' : 'Alluvial', iconName: 'Layers' },
        { label: 'Green Cover', value: `${activeWard.green_cover_baseline_percent || 18}%`, iconName: 'TreePine' },
        { label: 'Impervious Surface', value: `${activeWard.impervious_surface_percent || 62}%`, iconName: 'Square' },
      ]
    : landEnvironmentData;

  return (
    <div className="dashboard-card" id="land-environment-card">
      <div className="card-header">
        <h3>Land & Environment</h3>
      </div>

      <div className="land-env-list">
        {dynamicData.map((item) => {
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
