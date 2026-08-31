import bcrypt from 'bcryptjs';
import prisma from '../lib/prisma.js';

export default async function authRoutes(fastify, options) {
  // Register new user
  fastify.post('/register', async (request, reply) => {
    const { username, email, password } = request.body || {};

    if (!username || !email || !password) {
      return reply.code(400).send({
        success: false,
        message: 'Username, email and password are required',
      });
    }

    try {
      // Check existing user
      const existingUser = await prisma.user.findFirst({
        where: {
          OR: [{ email }, { username }],
        },
      });

      if (existingUser) {
        return reply.code(409).send({
          success: false,
          message: 'User with this email or username already exists',
        });
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(password, 10);

      // Create user
      const newUser = await prisma.user.create({
        data: {
          username,
          email,
          password: hashedPassword,
        },
        select: {
          id: true,
          username: true,
          email: true,
          createdAt: true,
        },
      });

      // Sign JWT
      const token = fastify.jwt.sign({
        id: newUser.id,
        username: newUser.username,
        email: newUser.email,
      });

      // Set session
      request.session.user = newUser;

      return reply.code(201).send({
        success: true,
        message: 'Account created successfully',
        token,
        user: newUser,
        sessionActive: true,
      });
    } catch (err) {
      fastify.log.error(err);
      return reply.code(500).send({
        success: false,
        message: 'Registration failed due to internal error',
      });
    }
  });

  // Login user
  fastify.post('/login', async (request, reply) => {
    const { email, username, password } = request.body || {};
    const identifier = email || username;

    if (!identifier || !password) {
      return reply.code(400).send({
        success: false,
        message: 'Username/email and password are required',
      });
    }

    try {
      const user = await prisma.user.findFirst({
        where: {
          OR: [{ email: identifier }, { username: identifier }],
        },
      });

      if (!user) {
        return reply.code(401).send({
          success: false,
          message: 'Invalid credentials',
        });
      }

      const isMatch = await bcrypt.compare(password, user.password);
      if (!isMatch) {
        return reply.code(401).send({
          success: false,
          message: 'Invalid credentials',
        });
      }

      const sanitizedUser = {
        id: user.id,
        username: user.username,
        email: user.email,
        createdAt: user.createdAt,
      };

      const token = fastify.jwt.sign({
        id: user.id,
        username: user.username,
        email: user.email,
      });

      request.session.user = sanitizedUser;

      return {
        success: true,
        message: 'Login successful',
        token,
        user: sanitizedUser,
        sessionActive: true,
      };
    } catch (err) {
      fastify.log.error(err);
      return reply.code(500).send({
        success: false,
        message: 'Login failed due to internal server error',
      });
    }
  });

  // Check Current Session User
  fastify.get('/me', async (request, reply) => {
    try {
      if (request.session && request.session.user) {
        return {
          success: true,
          user: request.session.user,
          authenticatedBy: 'session',
        };
      }

      const authHeader = request.headers.authorization;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.substring(7);
        const decoded = fastify.jwt.verify(token);
        const user = await prisma.user.findUnique({
          where: { id: decoded.id },
          select: { id: true, username: true, email: true, createdAt: true },
        });

        if (user) {
          return {
            success: true,
            user,
            authenticatedBy: 'jwt',
          };
        }
      }

      return reply.code(401).send({
        success: false,
        message: 'Unauthorized - No valid session or token',
      });
    } catch (err) {
      return reply.code(401).send({
        success: false,
        message: 'Session expired or invalid',
      });
    }
  });

  // Logout user
  fastify.post('/logout', async (request, reply) => {
    try {
      request.session.destroy();
      reply.clearCookie('sessionId');
      return {
        success: true,
        message: 'Logged out successfully',
      };
    } catch (err) {
      fastify.log.error(err);
      return reply.code(500).send({
        success: false,
        message: 'Logout error',
      });
    }
  });
}
