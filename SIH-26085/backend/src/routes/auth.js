import bcrypt from 'bcryptjs';
import prisma from '../lib/prisma.js';

export default async function authRoutes(fastify, options) {
  // Register Route: POST /api/auth/register
  fastify.post('/register', async (request, reply) => {
    try {
      const { username, email, password } = request.body || {};

      // Basic validation
      if (!username || !email || !password) {
        return reply.code(400).send({
          success: false,
          message: 'Username, email, and password are required',
        });
      }

      const trimmedUsername = username.trim();
      const normalizedEmail = email.toLowerCase().trim();

      if (trimmedUsername.length < 3) {
        return reply.code(400).send({
          success: false,
          message: 'Username must be at least 3 characters long',
        });
      }

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(normalizedEmail)) {
        return reply.code(400).send({
          success: false,
          message: 'Please provide a valid email address',
        });
      }

      if (password.length < 6) {
        return reply.code(400).send({
          success: false,
          message: 'Password must be at least 6 characters long',
        });
      }

      // Check if user already exists
      const existingUser = await prisma.user.findFirst({
        where: {
          OR: [
            { email: normalizedEmail },
            { username: trimmedUsername },
          ],
        },
      });

      if (existingUser) {
        if (existingUser.email === normalizedEmail) {
          return reply.code(409).send({
            success: false,
            message: 'Email is already registered. Please sign in instead.',
          });
        }
        return reply.code(409).send({
          success: false,
          message: 'Username is already taken. Please choose another one.',
        });
      }

      // Hash password
      const saltRounds = 10;
      const hashedPassword = await bcrypt.hash(password, saltRounds);

      // Create new user in Neon DB
      const newUser = await prisma.user.create({
        data: {
          username: trimmedUsername,
          email: normalizedEmail,
          password: hashedPassword,
        },
        select: {
          id: true,
          username: true,
          email: true,
          createdAt: true,
        },
      });

      // Generate JWT
      const token = fastify.jwt.sign(
        {
          id: newUser.id,
          username: newUser.username,
          email: newUser.email,
        },
        { expiresIn: '7d' }
      );

      return reply.code(201).send({
        success: true,
        message: 'Account created successfully',
        token,
        user: newUser,
      });
    } catch (error) {
      fastify.log.error(error);
      return reply.code(500).send({
        success: false,
        message: 'Internal server error while creating user',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined,
      });
    }
  });

  // Login Route: POST /api/auth/login
  fastify.post('/login', async (request, reply) => {
    try {
      const { email, username, password } = request.body || {};
      const identifier = (email || username || '').trim();

      if (!identifier || !password) {
        return reply.code(400).send({
          success: false,
          message: 'Username/email and password are required',
        });
      }

      // Find user by email or username
      const user = await prisma.user.findFirst({
        where: {
          OR: [
            { email: identifier.toLowerCase() },
            { username: identifier },
          ],
        },
      });

      if (!user) {
        return reply.code(401).send({
          success: false,
          message: 'Invalid credentials. User not found.',
        });
      }

      // Verify password
      const isPasswordValid = await bcrypt.compare(password, user.password);
      if (!isPasswordValid) {
        return reply.code(401).send({
          success: false,
          message: 'Invalid credentials. Incorrect password.',
        });
      }

      // Generate JWT
      const token = fastify.jwt.sign(
        {
          id: user.id,
          username: user.username,
          email: user.email,
        },
        { expiresIn: '7d' }
      );

      return reply.code(200).send({
        success: true,
        message: 'Login successful',
        token,
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          createdAt: user.createdAt,
        },
      });
    } catch (error) {
      fastify.log.error(error);
      return reply.code(500).send({
        success: false,
        message: 'Internal server error during login',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined,
      });
    }
  });

  // Me Route: GET /api/auth/me (Protected)
  fastify.get('/me', async (request, reply) => {
    try {
      await request.jwtVerify();
      const userId = request.user.id;

      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          username: true,
          email: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      if (!user) {
        return reply.code(404).send({
          success: false,
          message: 'User not found',
        });
      }

      return reply.send({
        success: true,
        user,
      });
    } catch (error) {
      return reply.code(401).send({
        success: false,
        message: 'Unauthorized or invalid token',
      });
    }
  });

  // Logout Route: POST /api/auth/logout
  fastify.post('/logout', async (request, reply) => {
    return reply.send({
      success: true,
      message: 'Logged out successfully',
    });
  });
}
