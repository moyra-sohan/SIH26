import 'dotenv/config';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import prisma from './lib/prisma.js';
import authRoutes from './routes/auth.js';
import mlRoutes from './routes/ml.js';

const fastify = Fastify({
  logger: {
    transport: {
      target: 'pino-pretty',
      options: {
        colorize: true,
        translateTime: 'HH:MM:ss Z',
        ignore: 'pid,hostname',
      },
    },
  },
});

// Enable CORS for frontend Vite client
await fastify.register(cors, {
  origin: true, // Allow frontend during development
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
});

// Register JWT Plugin
await fastify.register(jwt, {
  secret: process.env.JWT_SECRET || 'sih_fallback_secret_flood_key_2026',
});

// Root & Health Check route
fastify.get('/', async () => {
  return {
    name: 'Urban Flood Nowcasting Auth API',
    status: 'online',
    version: '1.0.0',
  };
});

fastify.get('/api/health', async (request, reply) => {
  try {
    // Quick probe to Neon DB
    await prisma.$queryRaw`SELECT 1`;
    return {
      status: 'healthy',
      database: 'connected',
      neon: true,
      timestamp: new Date().toISOString(),
    };
  } catch (err) {
    fastify.log.error(err);
    return reply.code(503).send({
      status: 'unhealthy',
      database: 'disconnected',
      error: err.message,
    });
  }
});

// Register Auth Routes under /api/auth
await fastify.register(authRoutes, { prefix: '/api/auth' });

// Register ML Routes under /api/ml
await fastify.register(mlRoutes, { prefix: '/api/ml' });

// Graceful shutdown
const gracefulShutdown = async (signal) => {
  fastify.log.info(`Received ${signal}. Shutting down gracefully...`);
  await fastify.close();
  await prisma.$disconnect();
  process.exit(0);
};

process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

// Start server
const start = async () => {
  const PORT = parseInt(process.env.PORT, 10) || 5000;
  const HOST = '0.0.0.0';

  try {
    await fastify.listen({ port: PORT, host: HOST });
    fastify.log.info(`🚀 Fastify Server running at http://localhost:${PORT}`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();
