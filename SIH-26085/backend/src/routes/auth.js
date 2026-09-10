import bcrypt from 'bcryptjs';
import prisma from '../lib/prisma.js';

const isProduction = process.env.NODE_ENV === 'production';

// Standard cookie options for auth token
const authCookieOptions = {
  path: '/',
  httpOnly: true,
  secure: isProduction,
  sameSite: 'lax',
  maxAge: 7 * 24 * 60 * 60, // 7 days in seconds
  signed: true,
};

export default async function authRoutes(fastify, options) {
  // Helper to extract authenticated user from session, cookie, or bearer header
  const getAuthenticatedUser = async (request) => {
    // 1. Check session
    if (request.session && request.session.user) {
      return request.session.user;
    }

    // 2. Check signed cookie 'token'
    let token = null;
    if (request.cookies && request.cookies.token) {
      const unsignResult = request.unsignCookie(request.cookies.token);
      if (unsignResult.valid) {
        token = unsignResult.value;
      }
    }

    // 3. Fallback to Authorization Header
    if (!token && request.headers.authorization) {
      const parts = request.headers.authorization.split(' ');
      if (parts.length === 2 && parts[0].toLowerCase() === 'bearer') {
        token = parts[1];
      }
    }

    if (token) {
      try {
        const decoded = fastify.jwt.verify(token);
        return decoded;
      } catch (err) {
        // Token invalid or expired
        return null;
      }
    }

    return null;
  };

  // Register Route: POST /api/auth/register
  fastify.post('/register', async (request, reply) => {
    try {
      const {
        name,
        username,
        email,
        password,
        houseNo,
        street,
        area,
        city,
        district,
        state,
        pinCode,
        country = 'India',
      } = request.body || {};

      // Basic validation
      const displayName = (name || username || '').trim();
      const normalizedEmail = (email || '').toLowerCase().trim();

      if (!displayName) {
        return reply.code(400).send({
          success: false,
          message: 'Name is required',
        });
      }

      if (!normalizedEmail) {
        return reply.code(400).send({
          success: false,
          message: 'Email address is required',
        });
      }

      if (!password) {
        return reply.code(400).send({
          success: false,
          message: 'Password is required',
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

      // Address field validations (only houseNo is nullable/optional)
      const trimmedStreet = (street || '').trim();
      const trimmedArea = (area || '').trim();
      const trimmedCity = (city || '').trim();
      const trimmedDistrict = (district || '').trim();
      const trimmedState = (state || '').trim();
      const trimmedPinCode = (pinCode || '').trim();
      const trimmedCountry = (country || 'India').trim();

      if (!trimmedStreet) {
        return reply.code(400).send({
          success: false,
          message: 'Street/Road is required',
        });
      }

      if (!trimmedArea) {
        return reply.code(400).send({
          success: false,
          message: 'Area/Locality is required',
        });
      }

      if (!trimmedCity) {
        return reply.code(400).send({
          success: false,
          message: 'City is required',
        });
      }

      if (!trimmedDistrict) {
        return reply.code(400).send({
          success: false,
          message: 'District is required',
        });
      }

      if (!trimmedState) {
        return reply.code(400).send({
          success: false,
          message: 'State is required',
        });
      }

      if (!trimmedPinCode) {
        return reply.code(400).send({
          success: false,
          message: 'PIN Code is required',
        });
      }

      const chosenUsername = (username || displayName.toLowerCase().replace(/\s+/g, '_') + '_' + Math.floor(1000 + Math.random() * 9000)).trim();

      // Check if user already exists
      const existingUser = await prisma.user.findFirst({
        where: {
          OR: [
            { email: normalizedEmail },
            { username: chosenUsername },
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
          name: displayName,
          username: chosenUsername,
          email: normalizedEmail,
          password: hashedPassword,
          houseNo: houseNo && houseNo.trim() ? houseNo.trim() : null,
          street: trimmedStreet,
          area: trimmedArea,
          city: trimmedCity,
          district: trimmedDistrict,
          state: trimmedState,
          pinCode: trimmedPinCode,
          country: trimmedCountry,
        },
        select: {
          id: true,
          name: true,
          username: true,
          email: true,
          houseNo: true,
          street: true,
          area: true,
          city: true,
          district: true,
          state: true,
          pinCode: true,
          country: true,
          createdAt: true,
        },
      });

      // Generate JWT
      const tokenPayload = {
        id: newUser.id,
        name: newUser.name,
        username: newUser.username,
        email: newUser.email,
      };

      const token = fastify.jwt.sign(tokenPayload, { expiresIn: '7d' });

      // Save user to session
      if (request.session) {
        request.session.user = tokenPayload;
      }

      // Set secure HTTP-only cookie
      reply.setCookie('token', token, authCookieOptions);

      return reply.code(201).send({
        success: true,
        message: 'Account created successfully',
        token,
        user: newUser,
        sessionActive: true,
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
          message: 'Email/Username and password are required',
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
      const tokenPayload = {
        id: user.id,
        name: user.name || user.username,
        username: user.username,
        email: user.email,
      };

      const token = fastify.jwt.sign(tokenPayload, { expiresIn: '7d' });

      // Save user to session
      if (request.session) {
        request.session.user = tokenPayload;
      }

      // Set secure HTTP-only cookie
      reply.setCookie('token', token, authCookieOptions);

      const userResponse = {
        id: user.id,
        name: user.name,
        username: user.username,
        email: user.email,
        houseNo: user.houseNo,
        street: user.street,
        area: user.area,
        city: user.city,
        district: user.district,
        state: user.state,
        pinCode: user.pinCode,
        country: user.country,
        createdAt: user.createdAt,
      };

      return reply.code(200).send({
        success: true,
        message: 'Login successful',
        token,
        user: userResponse,
        sessionActive: true,
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

  // Get Session Route: GET /api/auth/session
  fastify.get('/session', async (request, reply) => {
    try {
      const authUser = await getAuthenticatedUser(request);

      if (!authUser || !authUser.id) {
        return reply.code(200).send({
          authenticated: false,
          user: null,
        });
      }

      const user = await prisma.user.findUnique({
        where: { id: authUser.id },
        select: {
          id: true,
          name: true,
          username: true,
          email: true,
          houseNo: true,
          street: true,
          area: true,
          city: true,
          district: true,
          state: true,
          pinCode: true,
          country: true,
        },
      });

      if (!user) {
        return reply.code(200).send({
          authenticated: false,
          user: null,
        });
      }

      return reply.code(200).send({
        authenticated: true,
        sessionId: request.session ? request.session.sessionId : undefined,
        user,
      });
    } catch (error) {
      fastify.log.error(error);
      return reply.code(500).send({
        authenticated: false,
        message: 'Error verifying session',
      });
    }
  });

  // Me Route: GET /api/auth/me (Protected via session, cookie, or Bearer header)
  fastify.get('/me', async (request, reply) => {
    try {
      const authUser = await getAuthenticatedUser(request);

      if (!authUser || !authUser.id) {
        return reply.code(401).send({
          success: false,
          message: 'Unauthorized or invalid session/token',
        });
      }

      const user = await prisma.user.findUnique({
        where: { id: authUser.id },
        select: {
          id: true,
          name: true,
          username: true,
          email: true,
          houseNo: true,
          street: true,
          area: true,
          city: true,
          district: true,
          state: true,
          pinCode: true,
          country: true,
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
      fastify.log.error(error);
      return reply.code(401).send({
        success: false,
        message: 'Unauthorized or invalid session/token',
      });
    }
  });

  // Logout Route: POST /api/auth/logout
  fastify.post('/logout', async (request, reply) => {
    try {
      // Clear session if present
      if (request.session) {
        await request.session.destroy();
      }

      // Clear token cookie
      reply.clearCookie('token', {
        path: '/',
        httpOnly: true,
        secure: isProduction,
        sameSite: 'lax',
      });

      // Clear session cookie
      reply.clearCookie('sessionId', {
        path: '/',
        httpOnly: true,
        secure: isProduction,
        sameSite: 'lax',
      });

      return reply.send({
        success: true,
        message: 'Logged out successfully',
      });
    } catch (error) {
      fastify.log.error(error);
      return reply.code(500).send({
        success: false,
        message: 'Error during logout',
      });
    }
  });
}

