import 'dotenv/config'
import Fastify from 'fastify'
import cors from '@fastify/cors'
import { config } from './config/index.js'

// Import modules
import blogModule from './modules/blog/index.js'
import aiAgentModule from './modules/ai-agent/index.js'
import mediaHostingModule from './modules/media-hosting/index.js'
import schedulingModule from './modules/scheduling/index.js'
import ragModule from './modules/rag/index.js'

const fastify = Fastify({
  logger: {
    level: config.env === 'development' ? 'info' : 'warn'
  }
})

// Enable CORS
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',')
  : ['http://localhost:5173', 'http://localhost:3000']

await fastify.register(cors, {
  origin: config.env === 'production' && process.env.ALLOWED_ORIGINS
    ? allowedOrigins
    : true, // Allow all in development
  credentials: true
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
