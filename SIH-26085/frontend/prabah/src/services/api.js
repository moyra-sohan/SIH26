/**
 * Urban Flood Nowcasting API Client
 * Connects Frontend with Node.js/Fastify Backend (:5000) and Python FastAPI ML Backend (:8000)
 */

const BACKEND_API_BASE = 'http://localhost:5000/api/ml';
const DIRECT_ML_API_BASE = 'http://localhost:8000/api';

async function fetchWithFallback(endpointPath, options = {}) {
  // Try backend proxy first
  try {
    const backendUrl = `${BACKEND_API_BASE}${endpointPath}`;
    const res = await fetch(backendUrl, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {}),
      },
    });
    if (res.ok) {
      return await res.json();
    }
  } catch (err) {
    console.warn(`Backend proxy (${BACKEND_API_BASE}) unreachable, attempting direct ML service...`, err);
  }

  // Fallback to direct Python FastAPI microservice
  try {
    const directUrl = `${DIRECT_ML_API_BASE}${endpointPath}`;
    const res = await fetch(directUrl, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {}),
      },
    });
    if (!res.ok) {
      throw new Error(`ML Service responded with ${res.status}`);
    }
    return await res.json();
  } catch (err) {
    console.error('All API endpoints failed:', err);
    throw err;
  }
}

export const api = {
  // Health check
  async checkHealth() {
    return fetchWithFallback('/health');
  },

  // Get Kolkata Wards Catalog
  async getWards() {
    return fetchWithFallback('/wards');
  },

  // Predict Flood Risk using the trained Random Forest ML Pipeline
  async predictFloodRisk(params) {
    return fetchWithFallback('/predict', {
      method: 'POST',
      body: JSON.stringify(params),
    });
  },

  // Get forecasts across all Kolkata monitoring zones
  async getWardForecasts(rainfall = 82, isMonsoon = 1) {
    const query = new URLSearchParams({ rainfall, is_monsoon: isMonsoon }).toString();
    return fetchWithFallback(`/forecasts?${query}`);
  },

  // Get all 60 feature column names and metadata
  async getFeatures() {
    return fetchWithFallback('/features');
  },

  // Get all 9 Database tables & metadata schemas
  async getDbTables() {
    return fetchWithFallback('/db/tables');
  },

  // Query specific Database Table
  async queryDbTable(tableName, params = {}) {
    const query = new URLSearchParams(params).toString();
    return fetchWithFallback(`/db/table/${tableName}?${query}`);
  },

  // Full Database Dump
  async getAllDbData() {
    return fetchWithFallback('/db/all');
  },

  // Get Road Network and Status
  async getRoads(params = {}) {
    const query = new URLSearchParams(params).toString();
    return fetchWithFallback(`/db/roads?${query}`);
  },

  // Get Drainage Network and Status
  async getDrainage(params = {}) {
    const query = new URLSearchParams(params).toString();
    return fetchWithFallback(`/db/drains?${query}`);
  },

  // Get Ward-Wise Zones
  async getZones() {
    return fetchWithFallback('/db/zones');
  },

  // Get 3-Hour Nowcasting Timeline Progression
  async get3hSituation(timeStep = '') {
    const query = timeStep ? `?time_step=${timeStep}` : '';
    return fetchWithFallback(`/db/3h-situation${query}`);
  },

  // Predict Flood Risk on Location / GPS Coordinates
  async predictLocation(params) {
    return fetchWithFallback('/db/predict-location', {
      method: 'POST',
      body: JSON.stringify(params),
    });
  },
};

export default api;

