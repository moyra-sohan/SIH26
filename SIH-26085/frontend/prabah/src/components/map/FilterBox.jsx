import React, { useState } from 'react';

export default function FilterBox({ layerToggles, setLayerToggles }) {
  const [isOpen, setIsOpen] = useState(false);

  const toggleLayer = (layerKey) => {
    setLayerToggles((prev) => ({
      ...prev,
      [layerKey]: !prev[layerKey]
    }));
  };

  return (
    <div className={`map-layers-control ${isOpen ? 'open' : ''}`}>
      <button 
        className="layers-toggle-btn" 
        onClick={() => setIsOpen(!isOpen)}
        title="Thematic Overlay Layers"
      >
        <span className="icon">🗺️</span>
        <span className="layers-btn-label">Layers</span>
      </button>

      {isOpen && (
        <div className="layers-menu glass-panel">
          <div className="layers-header">
            <h4>Thematic Overlays</h4>
            <button className="close-btn" onClick={() => setIsOpen(false)}>✕</button>
          </div>
          
          <div className="layers-list">
            <label className="layer-checkbox-item">
              <input 
                type="checkbox" 
                checked={layerToggles.showDrainage} 
                onChange={() => toggleLayer('showDrainage')}
              />
              <span className="layer-color-indicator border-drainage" />
              <span className="layer-icon">🚰</span>
              <span className="layer-text">Drainage Network</span>
            </label>

            <label className="layer-checkbox-item">
              <input 
                type="checkbox" 
                checked={layerToggles.showRoads} 
                onChange={() => toggleLayer('showRoads')}
              />
              <span className="layer-color-indicator border-roads" />
              <span className="layer-icon">🛣️</span>
              <span className="layer-text">Roads by Status</span>
            </label>

            <label className="layer-checkbox-item">
              <input 
                type="checkbox" 
                checked={layerToggles.showLandscape} 
                onChange={() => toggleLayer('showLandscape')}
              />
              <span className="layer-color-indicator border-landscape" />
              <span className="layer-icon">🌳</span>
              <span className="layer-text">Landscape Zones</span>
            </label>

            <label className="layer-checkbox-item">
              <input 
                type="checkbox" 
                checked={layerToggles.showWater} 
                onChange={() => toggleLayer('showWater')}
              />
              <span className="layer-color-indicator border-water" />
              <span className="layer-icon">🌊</span>
              <span className="layer-text">Water Zones &amp; Canals</span>
            </label>
          </div>
        </div>
      )}
    </div>
  );
}


