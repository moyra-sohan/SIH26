/**
 * Urban Flood Nowcasting API Client
 * Connects Frontend with Node.js/Fastify Backend (:5000) and Python FastAPI ML Backend (:8000)
 *
 * SECURITY: The WEATHER_API_KEY is NEVER present here.
 * Weather calls go: Frontend → Node.js Backend → Python ML → OpenWeatherMap
 */

const BACKEND_API_BASE = 'http://localhost:5000/api/ml';
const DIRECT_ML_API_BASE = 'http://localhost:8000/api';

// Weather refresh interval — matches WEATHER_REFRESH_INTERVAL_MINUTES in backend/.env
export const WEATHER_REFRESH_INTERVAL_MS = 10 * 60 * 1000; // 10 minutes default

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
    // For weather endpoints, don't fallback to direct ML (key isn't there on frontend)
    if (endpointPath.startsWith('/weather')) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.message || errData.error || `Weather API error ${res.status}`);
    }
  } catch (err) {
    if (endpointPath.startsWith('/weather')) {
      // Re-throw weather errors — never fall back to direct ML for weather
      throw err;
    }
    console.warn(`Backend proxy (${BACKEND_API_BASE}) unreachable, attempting direct ML service...`, err);
  }

  // Fallback to direct Python FastAPI microservice (non-weather endpoints only)
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

  /**
   * Get real-time weather for a specific ward.
   * Calls: Frontend → Node.js /api/ml/weather/:ward_id → Python → OpenWeatherMap
   * API key is NEVER in the frontend.
   *
   * @param {string} wardId - Ward slug (e.g., "behala-ward-120")
   * @returns {Promise<Object>} Weather data: temperature, humidity, rainfall, etc.
   * @throws {Error} With user-friendly message on any failure
   */
  async getWeather(wardId) {
    return fetchWithFallback(`/weather/${encodeURIComponent(wardId)}`);
  },

  /**
   * Full pipeline: Ward → Real-Time Weather → ML Model → Flood Prediction
   * Returns combined weather + prediction in a single call.
   *
   * @param {string} wardId - Ward slug (e.g., "behala-ward-120")
   * @returns {Promise<Object>} { weather, prediction, model_info, timestamp }
   * @throws {Error} With user-friendly message on any failure
   */
  async getWeatherPrediction(wardId) {
    return fetchWithFallback(`/weather-predict/${encodeURIComponent(wardId)}`);
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

