import fp from 'fastify-plugin';
import type { FastifyPluginAsync } from 'fastify';
import { db } from '../../db/index';
import { users } from '../../db/schema';
import bcrypt from 'bcrypt';
import { eq } from 'drizzle-orm';

const SALT_ROUNDS = 10;

// Request type definitions
interface LoginRequest {
  Body: {
    email: string;
    password: string;
  };
}

interface RegisterRequest {
  Body: {
    email: string;
    password: string;
    fullName: string;
  };
}

const authModule: FastifyPluginAsync = async (fastify) => {
  // Login endpoint
  fastify.post<LoginRequest>(
    '/auth/login',
    {
      schema: {
        body: {
          type: 'object',
          required: ['email', 'password'],
          properties: {
            email: { type: 'string', format: 'email' },
            password: { type: 'string', minLength: 6 },
          },
        },
      },
    },
    async (request, reply) => {
      const { email, password } = request.body;

      // Find user by email
      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.email, email))
        .limit(1);

      if (!user) {
        return reply.code(401).send({
          error: 'Invalid credentials',
        });
      }

      // Verify password
      const isValid = await bcrypt.compare(password, user.passwordHash);

      if (!isValid) {
        return reply.code(401).send({
          error: 'Invalid credentials',
        });
      }

      // Generate JWT token
      const token = fastify.jwt.sign(
        {
          id: user.id,
          email: user.email,
          role: user.role,
        },
        {
          expiresIn: '7d',
        }
      );

      // Return user data (without password hash) and token
      return reply.send({
        token,
        user: {
          id: user.id,
          email: user.email,
          fullName: user.fullName,
          role: user.role,
        },
      });
    }
  );

  // Register endpoint (admin only in future, but open for now)
  fastify.post<RegisterRequest>(
    '/auth/register',
    {
      schema: {
        body: {
          type: 'object',
          required: ['email', 'password', 'fullName'],
          properties: {
            email: { type: 'string', format: 'email' },
            password: { type: 'string', minLength: 6 },
            fullName: { type: 'string', minLength: 1 },
          },
        },
      },
    },
    async (request, reply) => {
      const { email, password, fullName } = request.body;

      // Check if user already exists
      const [existingUser] = await db
        .select()
        .from(users)
        .where(eq(users.email, email))
        .limit(1);

      if (existingUser) {
        return reply.code(409).send({
          error: 'User with this email already exists',
        });
      }

      // Hash password
      const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

      // Create user (default role is student, but since it's admin-only for now, we'll set it to admin)
      const [newUser] = await db
        .insert(users)
        .values({
          email,
          passwordHash,
          fullName,
          role: 'admin', // For now, all registered users are admins
        })
        .returning();

      // Generate JWT token
      const token = fastify.jwt.sign(
        {
          id: newUser.id,
          email: newUser.email,
          role: newUser.role,
        },
        {
          expiresIn: '7d',
        }
      );

      // Return user data and token
      return reply.send({
        token,
        user: {
          id: newUser.id,
          email: newUser.email,
          fullName: newUser.fullName,
          role: newUser.role,
        },
      });
    }
  );

  // Get current user (requires authentication)
  fastify.get(
    '/auth/me',
    {
      onRequest: [fastify.authenticate],
    },
    async (request, reply) => {
      const userId = request.user.id;

      const [user] = await db
        .select({
          id: users.id,
          email: users.email,
          fullName: users.fullName,
          role: users.role,
        })
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);

      if (!user) {
        return reply.code(404).send({
          error: 'User not found',
        });
      }

      return reply.send({ user });
    }
  );

  // Refresh token endpoint
  fastify.post(
    '/auth/refresh',
    {
      onRequest: [fastify.authenticate],
    },
    async (request, reply) => {
      // Generate new token
      const token = fastify.jwt.sign(
        {
          id: request.user.id,
          email: request.user.email,
          role: request.user.role,
        },
        {
          expiresIn: '7d',
        }
      );

      return reply.send({ token });
    }
  );
};

export default fp(authModule, {
  name: 'auth',
});
