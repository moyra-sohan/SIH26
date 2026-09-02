import 'dotenv/config';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import cookie from '@fastify/cookie';
import session from '@fastify/session';
import prisma from './lib/prisma.js';
import authRoutes from './routes/auth.js';
import mlRoutes from './routes/ml.js';

const isProduction = process.env.NODE_ENV === 'production';
const cookieSecret = process.env.COOKIE_SECRET || 'sih_flood_cookie_secret_key_minimum_32_characters_long_2026!';
const sessionSecret = process.env.SESSION_SECRET || 'sih_flood_session_secret_key_minimum_32_characters_long_2026!';

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

// Enable CORS for frontend Vite client with credentials
await fastify.register(cors, {
  origin: true, // Allow frontend during development (reflects request origin for credentials support)
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
});

// Register Cookie Plugin
await fastify.register(cookie, {
  secret: cookieSecret,
  parseOptions: {},
});

// Register Session Plugin
await fastify.register(session, {
  secret: sessionSecret,
  cookieName: 'sessionId',
  cookie: {
    path: '/',
    httpOnly: true,
    secure: isProduction,
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  },
  saveUninitialized: false,
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
