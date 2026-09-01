import 'dotenv/config';

const ML_SERVICE_URL = process.env.ML_SERVICE_URL || 'http://127.0.0.1:8000';

export default async function mlRoutes(fastify, options) {
  // ML Health Check
  fastify.get('/health', async (request, reply) => {
    try {
      const response = await fetch(`${ML_SERVICE_URL}/health`);
      if (!response.ok) {
        return reply.code(response.status).send({
          status: 'degraded',
          error: 'ML service responded with error status'
        });
      }
      const data = await response.json();
      return {
        status: 'connected',
        ml_service: data,
      };
    } catch (err) {
      fastify.log.error(`ML Health check failed: ${err.message}`);
      return reply.code(503).send({
        status: 'disconnected',
        error: 'Unable to reach Python ML Backend service at ' + ML_SERVICE_URL,
        hint: 'Ensure uvicorn app:app is running on port 8000'
      });
    }
  });

  // Get Kolkata Wards Catalog
  fastify.get('/wards', async (request, reply) => {
    try {
      const response = await fetch(`${ML_SERVICE_URL}/api/wards`);
      const data = await response.json();
      return data;
    } catch (err) {
      fastify.log.error(`ML get wards failed: ${err.message}`);
      return reply.code(500).send({ error: 'Failed to fetch wards metadata', details: err.message });
    }
  });

  // Get 60 Features Metadata
  fastify.get('/features', async (request, reply) => {
    try {
      const response = await fetch(`${ML_SERVICE_URL}/api/features`);
      const data = await response.json();
      return data;
    } catch (err) {
      fastify.log.error(`ML get features failed: ${err.message}`);
      return reply.code(500).send({ error: 'Failed to fetch features metadata', details: err.message });
    }
  });

  // Run Real-Time Flood Nowcasting Prediction
  fastify.post('/predict', async (request, reply) => {
    try {
      const response = await fetch(`${ML_SERVICE_URL}/api/predict`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request.body || {}),
      });

      const data = await response.json();
      if (!response.ok) {
        return reply.code(response.status).send(data);
      }
      return data;
    } catch (err) {
      fastify.log.error(`ML prediction failed: ${err.message}`);
      return reply.code(500).send({
        error: 'Failed to execute machine learning prediction',
        details: err.message,
      });
    }
  });

  // Get Ward Forecasts Across All Kolkata Zones
  fastify.get('/forecasts', async (request, reply) => {
    try {
      const { rainfall, is_monsoon } = request.query;
      const queryParams = new URLSearchParams();
      if (rainfall) queryParams.set('current_rainfall', rainfall);
      if (is_monsoon !== undefined) queryParams.set('is_monsoon', is_monsoon);

      const url = `${ML_SERVICE_URL}/api/ward-forecasts?${queryParams.toString()}`;
      const response = await fetch(url);
      const data = await response.json();
      return data;
    } catch (err) {
      fastify.log.error(`ML forecasts failed: ${err.message}`);
      return reply.code(500).send({ error: 'Failed to fetch ward forecasts', details: err.message });
    }
  });

  // Batch Prediction
  fastify.post('/batch-predict', async (request, reply) => {
    try {
      const response = await fetch(`${ML_SERVICE_URL}/api/batch-predict`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request.body || {}),
      });

      const data = await response.json();
      return data;
    } catch (err) {
      fastify.log.error(`ML batch predict failed: ${err.message}`);
      return reply.code(500).send({ error: 'Failed to execute batch prediction', details: err.message });
    }
  });
}
