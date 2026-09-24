/**
 * Kolkata Municipal Wards Boundary Registry & GeoJSON
 * Provides spatial polygons, bounds, and metadata for all 141 official Kolkata wards
 * loaded directly from standardized wards_kolkata.geojson.
 */
import rawWardsGeoJson from './wards_kolkata.geojson?raw';

export const KOLKATA_WARDS_GEOJSON = JSON.parse(rawWardsGeoJson);

export const KOLKATA_WARDS_DATA = KOLKATA_WARDS_GEOJSON.features.map(f => ({
  id: String(f.properties.ward_number),
  ward_number: f.properties.ward_number,
  slug: `ward-${f.properties.ward_number}`,
  name: f.properties.name,
  full_name: f.properties.full_name,
  zone: f.properties.zone,
  vulnerability: f.properties.vulnerability,
  risk_color: f.properties.risk_color,
  center: f.properties.center,
  bounds: f.properties.bounds
}));

/**
 * Get Ward information by numeric or string ward number
 */
export function getWardByNumber(wardNumber) {
  const num = parseInt(wardNumber, 10);
  if (isNaN(num)) return null;
  return KOLKATA_WARDS_DATA.find(w => w.ward_number === num) || null;
}

/**
 * Calculate/retrieve camera bounds [[minLng, minLat], [maxLng, maxLat]] for a ward polygon
 */
export function getWardBounds(wardNumber) {
  const ward = getWardByNumber(wardNumber);
  if (!ward || !ward.bounds) return null;
  return ward.bounds;
}

/**
 * Return GeoJSON FeatureCollection containing only the selected ward polygon
 */
export function getSelectedWardGeoJson(wardNumber) {
  const num = parseInt(wardNumber, 10);
  if (isNaN(num)) return { type: "FeatureCollection", features: [] };
  const feat = KOLKATA_WARDS_GEOJSON.features.find(f => f.properties.ward_number === num);
  if (!feat) {
    return { type: "FeatureCollection", features: [] };
  }

  return {
    type: "FeatureCollection",
    features: [feat]
  };
}
