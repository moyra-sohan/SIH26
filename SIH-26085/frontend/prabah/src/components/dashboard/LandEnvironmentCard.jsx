import { Building2, Mountain, Layers, TreePine, Square, Droplets, Waves, Gauge } from 'lucide-react';
import { useFloodData } from '../../context/FloodDataContext';

function LandEnvironmentCard() {
  const { selectedWard } = useFloodData();

  const elevation = selectedWard ? `${selectedWard.elevation_m} m above sea level` : '3.8 m city average';
  const impervious = selectedWard ? `${selectedWard.impervious_surface_percent}%` : '84% (High Urban)';
  const greenCover = selectedWard ? `${selectedWard.green_cover_percent}%` : '12% city average';
  const waterProximity = selectedWard ? selectedWard.water_body_proximity || 'Hooghly Basin' : 'Hooghly & Canal Basin';
  const drainageIdx = selectedWard ? `${selectedWard.drainage_index} / 10` : '5.2 / 10 (Moderate)';
  const silt = selectedWard ? selectedWard.silt_accumulation_level || 'Moderate' : 'Moderate to High';

  const items = [
    { label: 'Elevation', value: elevation, icon: Mountain, color: '#3B82F6' },
    { label: 'Impervious Surface', value: impervious, icon: Square, color: '#EF4444' },
    { label: 'Green Cover', value: greenCover, icon: TreePine, color: '#10B981' },
    { label: 'Drainage Network Index', value: drainageIdx, icon: Gauge, color: '#F59E0B' },
    { label: 'Water Body Proximity', value: waterProximity, icon: Waves, color: '#06B6D4' },
    { label: 'Silt Accumulation', value: silt, icon: Layers, color: '#8B5CF6' },
  ];

  return (
    <div className="dashboard-card" id="land-environment-card">
      <div className="card-header">
        <div>
          <h3>Land & Topography</h3>
          <p className="card-subtitle text-xs text-slate-500">
            {selectedWard ? `${selectedWard.ward_name} ML Topography Profile` : 'Kolkata Urban Landscape Profile'}
          </p>
        </div>
      </div>

      <div className="land-env-list">
        {items.map((item) => {
          const IconComp = item.icon;
          return (
            <div className="land-env-item" key={item.label}>
              <div className="land-env-left">
                <div
                  className="land-env-icon-wrapper"
                  style={{ color: item.color, background: `${item.color}15` }}
                >
                  <IconComp size={16} />
                </div>
                <span>{item.label}</span>
              </div>
              <span className="land-env-value font-medium">{item.value}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default LandEnvironmentCard;
