/**
 * Kolkata City Boundary & Registry
 * Sourced directly from official 141-Ward GeoJSON (wards_kolkata.geojson).
 */
import { KOLKATA_WARDS_GEOJSON } from './kolkataWardsBoundaries.js';

export const KMC_OFFICIAL_GEOJSON = KOLKATA_WARDS_GEOJSON;

export const KOLKATA_BOUNDS = [
  [88.242143, 22.450323], // Southwest [lng, lat]
  [88.458955, 22.632577]  // Northeast [lng, lat]
];

export const KOLKATA_CENTER = [88.35055, 22.54145];

export const CITY_BOUNDARIES_REGISTRY = {
  kolkata: {
    cityId: 'kolkata',
    cityName: 'Kolkata Municipal Corporation (KMC)',
    center: KOLKATA_CENTER,
    initialBounds: KOLKATA_BOUNDS,
    boundaryColor: '#2563eb',
    glowColor: '#3b82f6',
    geoJson: KOLKATA_WARDS_GEOJSON
  }
};

export function getCityBoundary(cityId = 'kolkata') {
  return CITY_BOUNDARIES_REGISTRY[cityId.toLowerCase()] || CITY_BOUNDARIES_REGISTRY.kolkata;
}

/**
 * Test if [lng, lat] is inside the Kolkata Municipal Corporation geographic territory.
 */
export function isPointInKolkata(lng, lat) {
  return lng >= 88.23 && lng <= 88.47 && lat >= 22.44 && lat <= 22.65;
}
