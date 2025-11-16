import 'dotenv/config'
import Fastify from 'fastify'
import cors from '@fastify/cors'
import rateLimit from '@fastify/rate-limit'
import { config } from './config/index.js'
import { auth } from './lib/auth.js'

// Import modules
import settingsModule from './modules/settings/index.js'
import blogModule from './modules/blog/index.js'
import aiAgentModule from './modules/ai-agent/index.js'
import mediaHostingModule from './modules/media-hosting/index.js'
import schedulingModule from './modules/scheduling/index.js'
import ragModule from './modules/rag/index.js'
import googleCalendarModule from './modules/google-calendar/index.js'
import gmailModule from './modules/gmail/index.js'
import contactModule from './modules/contact/index.js'

const fastify = Fastify({
  logger: {
    level: config.env === 'development' ? 'info' : 'warn'
  }
})

// Enable CORS - MUST be registered BEFORE the auth handler to handle preflight requests
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',')
  : ['http://localhost:5173', 'http://localhost:5174', 'http://localhost:3000']

await fastify.register(cors, {
  origin: config.env === 'production' && process.env.ALLOWED_ORIGINS
    ? allowedOrigins
    : true, // Allow all in development
  credentials: true
})

// Mount Better Auth handler as a Fastify route handler
// This ensures CORS headers are properly applied
fastify.all('/api/auth/*', async (request, reply) => {
  fastify.log.info({ url: request.url, method: request.method }, 'Auth handler processing request');
  
  try {
    // Construct request URL
    const url = new URL(request.url, `http://${request.headers.host}`);
    
    // Convert Fastify headers to standard Headers object
    const headers = new Headers();
    Object.entries(request.headers).forEach(([key, value]) => {
      if (value) headers.append(key, value.toString());
    });
    
    // Create Fetch API-compatible request
    const req = new Request(url.toString(), {
      method: request.method,
      headers,
      body: request.body ? JSON.stringify(request.body) : null,
    });
    
    // Process authentication request
    const response = await auth.handler(req);
    
    // Forward response to client
    reply.status(response.status);
    response.headers.forEach((value: string, key: string) => reply.header(key, value));
    reply.send(response.body ? await response.text() : null);
  } catch (error) {
    fastify.log.error({ error }, 'Authentication Error');
    reply.status(500).send({
      error: 'Internal authentication error',
      code: 'AUTH_FAILURE'
    });
  }
})

// Register rate limiting
await fastify.register(rateLimit, {
  max: 100, // Maximum 100 requests
  timeWindow: '1 minute', // Per minute per IP
  errorResponseBuilder: function (request, context) {
    return {
      statusCode: 429,
      error: 'Too Many Requests',
      message: `Rate limit exceeded. You can make ${context.max} requests per ${context.after}. Please try again later.`,
      retryAfter: context.ttl
    }
  }
})

// Health check endpoint
fastify.get('/', async (request, reply) => {
  return {
    name: 'Qinhang Piano Teacher Platform',
    version: '1.0.0',
    status: 'healthy',
    modules: {
      blog: config.modules.blog,
      aiAgent: config.modules.aiAgent,
      mediaHosting: config.modules.mediaHosting,
      scheduling: config.modules.scheduling,
      rag: config.modules.rag
    }
  }
})

// Load modules conditionally based on configuration
const loadModules = async () => {
  // Always register Gmail and Contact modules (they handle missing config gracefully)
  await fastify.register(gmailModule)
  await fastify.register(contactModule)

  // Register Calendar module if Google credentials are configured
  if (config.google?.credentials) {
    await fastify.register(googleCalendarModule)
  } else {
    fastify.log.warn('Google Calendar credentials not configured - Calendar features disabled')
  }
  // Always register settings module
  await fastify.register(settingsModule)

  if (config.modules.blog) {
    await fastify.register(blogModule)
  }

  if (config.modules.aiAgent) {
    if (!config.ai?.apiKey) {
      fastify.log.warn('AI Agent module enabled but no AI_API_KEY configured')
    }
    await fastify.register(aiAgentModule)
  }

  if (config.modules.mediaHosting) {
    await fastify.register(mediaHostingModule)
  }

  if (config.modules.scheduling) {
    await fastify.register(schedulingModule)
  }

  if (config.modules.rag) {
    if (!config.vectorDb?.url) {
      fastify.log.warn('RAG module enabled but no VECTOR_DB_URL configured')
    }
    await fastify.register(ragModule)
  }
}

// Run the server
const start = async () => {
  try {
    // Load configured modules
    await loadModules()

    await fastify.listen({ port: config.port, host: config.host })
    fastify.log.info(`Server listening on http://${config.host}:${config.port}`)
  } catch (err) {
    fastify.log.error(err)
    process.exit(1)
  }
}

start()
