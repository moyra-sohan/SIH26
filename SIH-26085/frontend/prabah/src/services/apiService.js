/**
 * Kolkata Flood Risk & Nowcasting API Service
 * Connects frontend to the Python ML Model API (Flask / Fastify backend)
 */

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000';

// Fallback mock dataset for all 18 Kolkata Wards in case the backend is temporarily unreachable
const FALLBACK_WARDS = [
  {
    ward_id: 1,
    ward_name: 'Behala',
    zone: 'South West',
    latitude: 22.4989,
    longitude: 88.3145,
    area_sqkm: 6.5,
    distance_from_center_km: 8.72,
    predicted_risk: 'Major',
    risk_score: 0.88,
    probabilities: { Major: 0.6911, Moderate: 0.2871, Minor: 0.0218, 'No Risk': 0 },
    historical_rainfall_mm: 355.6,
    forecast_rainfall_mm: 282.2,
    elevation_m: 3.0,
    drain_load_utilization_percent: 97.3,
    drainage_index: 4.0,
    road_density_index: 6.0,
    storm_drain_coverage_percent: 42.0,
    impervious_surface_percent: 87.0,
    green_cover_percent: 11.5,
    water_body_proximity: 'Yes (Hooghly-adjacent)',
    reported_waterlogging_incidents: 3,
    avg_humidity_percent: 86.0,
    avg_temperature_c: 29.4,
  },
  {
    ward_id: 2,
    ward_name: 'Tollygunge',
    zone: 'South',
    latitude: 22.5039,
    longitude: 88.3423,
    area_sqkm: 5.0,
    distance_from_center_km: 7.37,
    predicted_risk: 'Moderate',
    risk_score: 0.62,
    probabilities: { Major: 0.12, Moderate: 0.78, Minor: 0.10, 'No Risk': 0 },
    historical_rainfall_mm: 332.9,
    forecast_rainfall_mm: 275.0,
    elevation_m: 5.0,
    drain_load_utilization_percent: 89.3,
    drainage_index: 5.0,
    road_density_index: 7.0,
    storm_drain_coverage_percent: 55.0,
    impervious_surface_percent: 82.0,
    green_cover_percent: 14.0,
    water_body_proximity: 'Yes (Tolly Nullah)',
    reported_waterlogging_incidents: 2,
    avg_humidity_percent: 85.0,
    avg_temperature_c: 29.5,
  },
  {
    ward_id: 3,
    ward_name: 'Jadavpur',
    zone: 'South',
    latitude: 22.4994,
    longitude: 88.3714,
    area_sqkm: 5.5,
    distance_from_center_km: 8.1,
    predicted_risk: 'Minor',
    risk_score: 0.35,
    probabilities: { Major: 0.05, Moderate: 0.30, Minor: 0.65, 'No Risk': 0 },
    historical_rainfall_mm: 338.1,
    forecast_rainfall_mm: 260.0,
    elevation_m: 6.0,
    drain_load_utilization_percent: 90.2,
    drainage_index: 6.0,
    road_density_index: 7.0,
    storm_drain_coverage_percent: 60.0,
    impervious_surface_percent: 78.0,
    green_cover_percent: 16.0,
    water_body_proximity: 'Moderate',
    reported_waterlogging_incidents: 2,
    avg_humidity_percent: 84.0,
    avg_temperature_c: 29.6,
  },
  {
    ward_id: 4,
    ward_name: 'Kasba',
    zone: 'South East',
    latitude: 22.517,
    longitude: 88.3833,
    area_sqkm: 6.0,
    distance_from_center_km: 6.5,
    predicted_risk: 'Major',
    risk_score: 0.91,
    probabilities: { Major: 0.82, Moderate: 0.16, Minor: 0.02, 'No Risk': 0 },
    historical_rainfall_mm: 349.6,
    forecast_rainfall_mm: 290.0,
    elevation_m: 3.0,
    drain_load_utilization_percent: 98.2,
    drainage_index: 4.0,
    road_density_index: 8.0,
    storm_drain_coverage_percent: 48.0,
    impervious_surface_percent: 89.0,
    green_cover_percent: 9.0,
    water_body_proximity: 'Yes',
    reported_waterlogging_incidents: 4,
    avg_humidity_percent: 87.0,
    avg_temperature_c: 29.3,
  },
  {
    ward_id: 5,
    ward_name: 'Topsia',
    zone: 'East',
    latitude: 22.539,
    longitude: 88.39,
    area_sqkm: 4.5,
    distance_from_center_km: 4.8,
    predicted_risk: 'Major',
    risk_score: 0.94,
    probabilities: { Major: 0.88, Moderate: 0.10, Minor: 0.02, 'No Risk': 0 },
    historical_rainfall_mm: 327.5,
    forecast_rainfall_mm: 285.0,
    elevation_m: 2.0,
    drain_load_utilization_percent: 94.3,
    drainage_index: 3.0,
    road_density_index: 6.0,
    storm_drain_coverage_percent: 40.0,
    impervious_surface_percent: 91.0,
    green_cover_percent: 7.0,
    water_body_proximity: 'Yes (Wetlands adjacent)',
    reported_waterlogging_incidents: 4,
    avg_humidity_percent: 88.0,
    avg_temperature_c: 29.2,
  },
  {
    ward_id: 6,
    ward_name: 'Beliaghata',
    zone: 'East',
    latitude: 22.558,
    longitude: 88.395,
    area_sqkm: 4.0,
    distance_from_center_km: 3.9,
    predicted_risk: 'Moderate',
    risk_score: 0.65,
    probabilities: { Major: 0.20, Moderate: 0.70, Minor: 0.10, 'No Risk': 0 },
    historical_rainfall_mm: 316.6,
    forecast_rainfall_mm: 270.0,
    elevation_m: 3.0,
    drain_load_utilization_percent: 90.4,
    drainage_index: 5.0,
    road_density_index: 7.0,
    storm_drain_coverage_percent: 52.0,
    impervious_surface_percent: 84.0,
    green_cover_percent: 11.0,
    water_body_proximity: 'Circular Canal adjacent',
    reported_waterlogging_incidents: 2,
    avg_humidity_percent: 85.0,
    avg_temperature_c: 29.4,
  },
  {
    ward_id: 7,
    ward_name: 'Park Circus',
    zone: 'Central',
    latitude: 22.547,
    longitude: 88.369,
    area_sqkm: 2.5,
    distance_from_center_km: 3.2,
    predicted_risk: 'Moderate',
    risk_score: 0.58,
    probabilities: { Major: 0.15, Moderate: 0.72, Minor: 0.13, 'No Risk': 0 },
    historical_rainfall_mm: 312.3,
    forecast_rainfall_mm: 265.0,
    elevation_m: 5.0,
    drain_load_utilization_percent: 87.6,
    drainage_index: 6.0,
    road_density_index: 9.0,
    storm_drain_coverage_percent: 65.0,
    impervious_surface_percent: 93.0,
    green_cover_percent: 5.0,
    water_body_proximity: 'Low',
    reported_waterlogging_incidents: 2,
    avg_humidity_percent: 84.0,
    avg_temperature_c: 29.7,
  },
  {
    ward_id: 8,
    ward_name: 'BBD Bagh (Esplanade)',
    zone: 'Central',
    latitude: 22.5697,
    longitude: 88.351,
    area_sqkm: 2.0,
    distance_from_center_km: 0.8,
    predicted_risk: 'Moderate',
    risk_score: 0.61,
    probabilities: { Major: 0.18, Moderate: 0.71, Minor: 0.11, 'No Risk': 0 },
    historical_rainfall_mm: 326.9,
    forecast_rainfall_mm: 278.0,
    elevation_m: 4.0,
    drain_load_utilization_percent: 90.2,
    drainage_index: 6.0,
    road_density_index: 9.5,
    storm_drain_coverage_percent: 70.0,
    impervious_surface_percent: 95.0,
    green_cover_percent: 4.0,
    water_body_proximity: 'Yes (Hooghly-adjacent)',
    reported_waterlogging_incidents: 2,
    avg_humidity_percent: 86.0,
    avg_temperature_c: 29.8,
  },
  {
    ward_id: 9,
    ward_name: 'Tallah',
    zone: 'North',
    latitude: 22.61,
    longitude: 88.375,
    area_sqkm: 3.5,
    distance_from_center_km: 5.4,
    predicted_risk: 'Moderate',
    risk_score: 0.66,
    probabilities: { Major: 0.22, Moderate: 0.68, Minor: 0.10, 'No Risk': 0 },
    historical_rainfall_mm: 332.8,
    forecast_rainfall_mm: 280.0,
    elevation_m: 4.0,
    drain_load_utilization_percent: 93.3,
    drainage_index: 5.0,
    road_density_index: 7.5,
    storm_drain_coverage_percent: 58.0,
    impervious_surface_percent: 86.0,
    green_cover_percent: 9.5,
    water_body_proximity: 'Circular Canal adjacent',
    reported_waterlogging_incidents: 2,
    avg_humidity_percent: 85.0,
    avg_temperature_c: 29.5,
  },
  {
    ward_id: 10,
    ward_name: 'Shyambazar',
    zone: 'North',
    latitude: 22.5975,
    longitude: 88.3717,
    area_sqkm: 3.0,
    distance_from_center_km: 4.2,
    predicted_risk: 'Minor',
    risk_score: 0.38,
    probabilities: { Major: 0.08, Moderate: 0.35, Minor: 0.57, 'No Risk': 0 },
    historical_rainfall_mm: 312.2,
    forecast_rainfall_mm: 260.0,
    elevation_m: 6.0,
    drain_load_utilization_percent: 87.6,
    drainage_index: 6.0,
    road_density_index: 8.5,
    storm_drain_coverage_percent: 62.0,
    impervious_surface_percent: 90.0,
    green_cover_percent: 7.0,
    water_body_proximity: 'Moderate',
    reported_waterlogging_incidents: 1,
    avg_humidity_percent: 84.0,
    avg_temperature_c: 29.6,
  },
  {
    ward_id: 11,
    ward_name: 'Dum Dum',
    zone: 'North',
    latitude: 22.642,
    longitude: 88.4197,
    area_sqkm: 8.0,
    distance_from_center_km: 9.8,
    predicted_risk: 'Minor',
    risk_score: 0.32,
    probabilities: { Major: 0.04, Moderate: 0.28, Minor: 0.68, 'No Risk': 0 },
    historical_rainfall_mm: 318.3,
    forecast_rainfall_mm: 265.0,
    elevation_m: 7.0,
    drain_load_utilization_percent: 86.7,
    drainage_index: 6.0,
    road_density_index: 6.5,
    storm_drain_coverage_percent: 54.0,
    impervious_surface_percent: 76.0,
    green_cover_percent: 18.0,
    water_body_proximity: 'Low',
    reported_waterlogging_incidents: 1,
    avg_humidity_percent: 83.0,
    avg_temperature_c: 29.5,
  },
  {
    ward_id: 12,
    ward_name: 'Salt Lake (Sector V)',
    zone: 'East',
    latitude: 22.585,
    longitude: 88.42,
    area_sqkm: 15.0,
    distance_from_center_km: 6.8,
    predicted_risk: 'Minor',
    risk_score: 0.36,
    probabilities: { Major: 0.06, Moderate: 0.32, Minor: 0.62, 'No Risk': 0 },
    historical_rainfall_mm: 348.6,
    forecast_rainfall_mm: 295.0,
    elevation_m: 5.0,
    drain_load_utilization_percent: 88.1,
    drainage_index: 7.0,
    road_density_index: 8.0,
    storm_drain_coverage_percent: 78.0,
    impervious_surface_percent: 80.0,
    green_cover_percent: 16.0,
    water_body_proximity: 'Yes (Wetlands adjacent)',
    reported_waterlogging_incidents: 1,
    avg_humidity_percent: 86.0,
    avg_temperature_c: 29.4,
  },
  {
    ward_id: 13,
    ward_name: 'Rajarhat New Town',
    zone: 'East',
    latitude: 22.62,
    longitude: 88.47,
    area_sqkm: 20.0,
    distance_from_center_km: 12.5,
    predicted_risk: 'Minor',
    risk_score: 0.28,
    probabilities: { Major: 0.02, Moderate: 0.22, Minor: 0.76, 'No Risk': 0 },
    historical_rainfall_mm: 291.7,
    forecast_rainfall_mm: 250.0,
    elevation_m: 6.0,
    drain_load_utilization_percent: 79.9,
    drainage_index: 8.0,
    road_density_index: 7.0,
    storm_drain_coverage_percent: 85.0,
    impervious_surface_percent: 68.0,
    green_cover_percent: 24.0,
    water_body_proximity: 'Planned canals',
    reported_waterlogging_incidents: 1,
    avg_humidity_percent: 82.0,
    avg_temperature_c: 29.5,
  },
  {
    ward_id: 14,
    ward_name: 'Garden Reach',
    zone: 'South West',
    latitude: 22.533,
    longitude: 88.307,
    area_sqkm: 7.0,
    distance_from_center_km: 6.2,
    predicted_risk: 'Major',
    risk_score: 0.93,
    probabilities: { Major: 0.86, Moderate: 0.12, Minor: 0.02, 'No Risk': 0 },
    historical_rainfall_mm: 346.5,
    forecast_rainfall_mm: 288.0,
    elevation_m: 2.0,
    drain_load_utilization_percent: 97.7,
    drainage_index: 3.5,
    road_density_index: 6.0,
    storm_drain_coverage_percent: 41.0,
    impervious_surface_percent: 88.0,
    green_cover_percent: 8.0,
    water_body_proximity: 'Yes (Hooghly-adjacent)',
    reported_waterlogging_incidents: 4,
    avg_humidity_percent: 87.0,
    avg_temperature_c: 29.3,
  },
  {
    ward_id: 15,
    ward_name: 'Alipore',
    zone: 'South',
    latitude: 22.535,
    longitude: 88.33,
    area_sqkm: 8.5,
    distance_from_center_km: 4.5,
    predicted_risk: 'Minor',
    risk_score: 0.22,
    probabilities: { Major: 0.01, Moderate: 0.18, Minor: 0.81, 'No Risk': 0 },
    historical_rainfall_mm: 324.4,
    forecast_rainfall_mm: 270.0,
    elevation_m: 8.0,
    drain_load_utilization_percent: 85.8,
    drainage_index: 7.5,
    road_density_index: 6.5,
    storm_drain_coverage_percent: 75.0,
    impervious_surface_percent: 65.0,
    green_cover_percent: 28.0,
    water_body_proximity: 'Low',
    reported_waterlogging_incidents: 0,
    avg_humidity_percent: 83.0,
    avg_temperature_c: 29.6,
  },
  {
    ward_id: 16,
    ward_name: 'Ballygunge',
    zone: 'South Central',
    latitude: 22.528,
    longitude: 88.366,
    area_sqkm: 4.5,
    distance_from_center_km: 5.1,
    predicted_risk: 'Minor',
    risk_score: 0.31,
    probabilities: { Major: 0.03, Moderate: 0.27, Minor: 0.70, 'No Risk': 0 },
    historical_rainfall_mm: 343.7,
    forecast_rainfall_mm: 280.0,
    elevation_m: 6.0,
    drain_load_utilization_percent: 89.2,
    drainage_index: 6.5,
    road_density_index: 8.0,
    storm_drain_coverage_percent: 68.0,
    impervious_surface_percent: 85.0,
    green_cover_percent: 12.0,
    water_body_proximity: 'Moderate',
    reported_waterlogging_incidents: 1,
    avg_humidity_percent: 84.0,
    avg_temperature_c: 29.7,
  },
  {
    ward_id: 17,
    ward_name: 'Maniktala',
    zone: 'North Central',
    latitude: 22.585,
    longitude: 88.38,
    area_sqkm: 3.0,
    distance_from_center_km: 3.5,
    predicted_risk: 'Moderate',
    risk_score: 0.63,
    probabilities: { Major: 0.17, Moderate: 0.73, Minor: 0.10, 'No Risk': 0 },
    historical_rainfall_mm: 330.9,
    forecast_rainfall_mm: 275.0,
    elevation_m: 5.0,
    drain_load_utilization_percent: 90.9,
    drainage_index: 5.5,
    road_density_index: 8.0,
    storm_drain_coverage_percent: 60.0,
    impervious_surface_percent: 92.0,
    green_cover_percent: 6.0,
    water_body_proximity: 'Circular Canal adjacent',
    reported_waterlogging_incidents: 2,
    avg_humidity_percent: 85.0,
    avg_temperature_c: 29.6,
  },
  {
    ward_id: 18,
    ward_name: 'Entally',
    zone: 'Central East',
    latitude: 22.562,
    longitude: 88.37,
    area_sqkm: 2.5,
    distance_from_center_km: 2.1,
    predicted_risk: 'Major',
    risk_score: 0.89,
    probabilities: { Major: 0.79, Moderate: 0.18, Minor: 0.03, 'No Risk': 0 },
    historical_rainfall_mm: 322.1,
    forecast_rainfall_mm: 272.0,
    elevation_m: 4.0,
    drain_load_utilization_percent: 91.3,
    drainage_index: 4.5,
    road_density_index: 8.5,
    storm_drain_coverage_percent: 50.0,
    impervious_surface_percent: 94.0,
    green_cover_percent: 4.5,
    water_body_proximity: 'Moderate',
    reported_waterlogging_incidents: 3,
    avg_humidity_percent: 86.0,
    avg_temperature_c: 29.7,
  },
];

/**
 * Fetch all wards with their real-time ML risk predictions
 */
export async function fetchWards(month = '2026-08') {
  try {
    const res = await fetch(`${API_BASE_URL}/api/wards?month=${month}`);
    if (res.ok) {
      const data = await res.json();
      if (data.status === 'success' && data.wards && data.wards.length > 0) {
        return data.wards;
      }
    }
  } catch (err) {
    console.warn('API error fetching wards, using fallback data:', err);
  }
  return FALLBACK_WARDS;
}

/**
 * Fetch single ward details and 12-month historical rainfall trend
 */
export async function fetchWardDetail(wardId, month = '2026-08') {
  try {
    const res = await fetch(`${API_BASE_URL}/api/ward/${wardId}?month=${month}`);
    if (res.ok) {
      const data = await res.json();
      if (data.status === 'success') {
        return data;
      }
    }
  } catch (err) {
    console.warn(`API error fetching ward ${wardId}:`, err);
  }
  const ward = FALLBACK_WARDS.find((w) => w.ward_id === parseInt(wardId, 10)) || FALLBACK_WARDS[0];
  return {
    status: 'success',
    ward_id: ward.ward_id,
    ward_name: ward.ward_name,
    zone: ward.zone,
    latitude: ward.latitude,
    longitude: ward.longitude,
    predicted_risk: ward.predicted_risk,
    risk_score: ward.risk_score,
    probabilities: ward.probabilities,
    features: ward,
    history_12m: generateFallback12mHistory(ward),
  };
}

/**
 * Fetch city-wide or ward-specific KPIs & Statistics
 */
export async function fetchStats(wardId = null) {
  try {
    const query = wardId ? `?ward_id=${wardId}` : '';
    const res = await fetch(`${API_BASE_URL}/api/stats${query}`);
    if (res.ok) {
      const data = await res.json();
      if (data.status === 'success') {
        return data;
      }
    }
  } catch (err) {
    console.warn('API error fetching stats:', err);
  }

  if (wardId) {
    const ward = FALLBACK_WARDS.find((w) => w.ward_id === parseInt(wardId, 10)) || FALLBACK_WARDS[0];
    return {
      status: 'success',
      scope: `${ward.ward_name} (Ward ${ward.ward_id})`,
      rainfall_24h: ward.historical_rainfall_mm,
      flood_risk_level: ward.predicted_risk,
      flood_risk_score: ward.risk_score,
      water_level_m: 4.2,
      drain_utilization_percent: ward.drain_load_utilization_percent,
      affected_roads: ward.reported_waterlogging_incidents,
      elevation_m: ward.elevation_m,
      drainage_status: ward.drain_load_utilization_percent > 90 ? 'Overloaded' : 'Operational',
    };
  }

  const majorCount = FALLBACK_WARDS.filter((w) => w.predicted_risk === 'Major').length;
  const modCount = FALLBACK_WARDS.filter((w) => w.predicted_risk === 'Moderate').length;
  const minorCount = FALLBACK_WARDS.filter((w) => w.predicted_risk === 'Minor').length;
  const safeCount = FALLBACK_WARDS.filter((w) => w.predicted_risk === 'No Risk').length;
  const avgRain = Math.round(FALLBACK_WARDS.reduce((acc, w) => acc + w.historical_rainfall_mm, 0) / FALLBACK_WARDS.length);
  const avgDrain = Math.round(FALLBACK_WARDS.reduce((acc, w) => acc + w.drain_load_utilization_percent, 0) / FALLBACK_WARDS.length);
  const totalRoads = FALLBACK_WARDS.reduce((acc, w) => acc + w.reported_waterlogging_incidents, 0);

  return {
    status: 'success',
    scope: 'Kolkata City Overview',
    total_wards: FALLBACK_WARDS.length,
    major_risk_wards: majorCount,
    moderate_risk_wards: modCount,
    minor_risk_wards: minorCount,
    safe_wards: safeCount,
    avg_rainfall_mm: avgRain,
    avg_drain_utilization_percent: avgDrain,
    total_affected_roads: totalRoads,
    hooghly_water_level_m: 4.2,
    city_overall_risk: majorCount >= 4 ? 'Major' : 'Moderate',
    rainfall_24h: avgRain,
    flood_risk_level: majorCount >= 4 ? 'Major' : 'Moderate',
    flood_risk_score: 0.82,
  };
}

/**
 * Fetch Rainfall Trend for Charts (Hourly or Monthly)
 */
export async function fetchRainfallTrend(wardId = null, period = '24h') {
  try {
    const params = new URLSearchParams();
    if (wardId) params.append('ward_id', wardId);
    if (period) params.append('period', period);

    const res = await fetch(`${API_BASE_URL}/api/rainfall-trend?${params.toString()}`);
    if (res.ok) {
      const data = await res.json();
      if (data.status === 'success' && data.trend) {
        return data.trend;
      }
    }
  } catch (err) {
    console.warn('API error fetching rainfall trend:', err);
  }

  // Fallback 12-month trend
  return [
    { time: 'Sep 25', rainfall: 285, forecast: 280, drainLoad: 85 },
    { time: 'Oct 25', rainfall: 160, forecast: 150, drainLoad: 55 },
    { time: 'Nov 25', rainfall: 35, forecast: 40, drainLoad: 25 },
    { time: 'Dec 25', rainfall: 15, forecast: 20, drainLoad: 18 },
    { time: 'Jan 26', rainfall: 12, forecast: 15, drainLoad: 16 },
    { time: 'Feb 26', rainfall: 22, forecast: 25, drainLoad: 20 },
    { time: 'Mar 26', rainfall: 35, forecast: 40, drainLoad: 30 },
    { time: 'Apr 26', rainfall: 80, forecast: 85, drainLoad: 45 },
    { time: 'May 26', rainfall: 135, forecast: 140, drainLoad: 60 },
    { time: 'Jun 26', rainfall: 290, forecast: 280, drainLoad: 88 },
    { time: 'Jul 26', rainfall: 360, forecast: 350, drainLoad: 95 },
    { time: 'Aug 26', rainfall: 335, forecast: 320, drainLoad: 92 },
  ];
}

/**
 * Fetch dynamic alerts generated from ML flood risk model
 */
export async function fetchAlerts() {
  try {
    const res = await fetch(`${API_BASE_URL}/api/alerts`);
    if (res.ok) {
      const data = await res.json();
      if (data.status === 'success') {
        return data;
      }
    }
  } catch (err) {
    console.warn('API error fetching alerts:', err);
  }

  return {
    status: 'success',
    alerts: [
      {
        id: 1,
        severity: 'high',
        message: 'CRITICAL: Major flood risk predicted in Behala, Kasba, Topsia & Garden Reach.',
        time: 'Just now',
        iconName: 'AlertTriangle',
      },
      {
        id: 2,
        severity: 'warning',
        message: 'Drainage Alert: Capacity utilization >95% across 4 Southern low-elevation zones.',
        time: '12 mins ago',
        iconName: 'AlertTriangle',
      },
      {
        id: 3,
        severity: 'info',
        message: 'Heavy monsoon rainfall forecasted (280-350mm). Pumping stations on high alert.',
        time: '25 mins ago',
        iconName: 'Info',
      },
    ],
    advisories: [
      'Avoid low-lying routes in Behala, Kasba, Topsia & Garden Reach during high tide.',
      'High tide in Hooghly river may slow lock-gate drainage discharge.',
      'Park vehicles in elevated zones and keep emergency contact numbers handy.',
      'Municipal pumping units deployed across Behala, Kasba, Topsia, and Garden Reach.',
    ],
  };
}

/**
 * Run Custom What-If ML Prediction
 */
export async function predictCustom(customFeatures) {
  try {
    const res = await fetch(`${API_BASE_URL}/predict`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(customFeatures),
    });
    if (res.ok) {
      return await res.json();
    }
  } catch (err) {
    console.error('Prediction API error:', err);
  }
  // Local fallback approximation if offline
  const rain = Number(customFeatures.Historical_Rainfall_mm) || 300;
  const drain = Number(customFeatures.Drain_Load_Utilization_Percent) || 85;
  const elev = Number(customFeatures.Elevation_m) || 4;

  let risk = 'Minor';
  if (rain > 320 && drain > 90 && elev <= 4) risk = 'Major';
  else if (rain > 250 || drain > 80) risk = 'Moderate';

  return {
    status: 'success',
    predicted_risk: risk,
    risk_score: risk === 'Major' ? 0.89 : risk === 'Moderate' ? 0.62 : 0.32,
    probabilities: {
      Major: risk === 'Major' ? 0.75 : 0.1,
      Moderate: risk === 'Moderate' ? 0.7 : 0.25,
      Minor: risk === 'Minor' ? 0.65 : 0.15,
      'No Risk': 0.0,
    },
  };
}

function generateFallback12mHistory(ward) {
  const months = ['2025-09', '2025-10', '2025-11', '2025-12', '2026-01', '2026-02', '2026-03', '2026-04', '2026-05', '2026-06', '2026-07', '2026-08'];
  const baseRain = ward.historical_rainfall_mm || 320;
  const mults = [0.85, 0.5, 0.12, 0.05, 0.04, 0.07, 0.11, 0.28, 0.45, 0.92, 1.1, 1.0];

  return months.map((m, i) => ({
    month: m,
    rainfall_mm: Math.round(baseRain * mults[i] * 10) / 10,
    forecast_rainfall_mm: Math.round(baseRain * mults[i] * 0.95 * 10) / 10,
    drain_load_utilization: Math.min(99, Math.round((ward.drain_load_utilization_percent || 85) * (0.3 + 0.7 * mults[i]))),
    waterlogging_events: mults[i] > 0.8 ? Math.max(1, ward.reported_waterlogging_incidents || 2) : 0,
    humidity: Math.round(65 + 22 * mults[i]),
    temp: 29.5,
  }));
}
