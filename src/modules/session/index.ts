import type { FastifyPluginAsync } from 'fastify'
import fp from 'fastify-plugin'
import { randomUUID } from 'crypto'

// Session token structure
export interface SessionToken {
  token: string
  createdAt: Date
  expiresAt: Date
  messagesRemaining: number
  ip: string
}

// In-memory session storage (use Redis in production)
const sessions = new Map<string, SessionToken>()

// Track token creation per IP for rate limiting
const tokenCreationByIp = new Map<string, { count: number; resetAt: Date }>()

const MAX_MESSAGES_PER_TOKEN = 25
const TOKEN_EXPIRY_HOURS = 24
const MAX_TOKENS_PER_IP_PER_DAY = 3

// Clean up expired sessions every hour
setInterval(() => {
  const now = new Date()
  for (const [token, session] of sessions.entries()) {
    if (session.expiresAt < now) {
      sessions.delete(token)
    }
  }

  // Clean up expired IP limits
  for (const [ip, data] of tokenCreationByIp.entries()) {
    if (data.resetAt < now) {
      tokenCreationByIp.delete(ip)
    }
  }
}, 60 * 60 * 1000) // Every hour

const sessionPlugin: FastifyPluginAsync = async (fastify, opts) => {
  fastify.log.info('Session management module loaded')

  // Create a new session token
  fastify.post('/session/create', {
    config: {
      rateLimit: {
        max: 5,
        timeWindow: '1 minute'
      }
    }
  }, async (request, reply) => {
    const ip = request.ip

    // Check IP-based daily token limit
    const ipData = tokenCreationByIp.get(ip)
    const now = new Date()

    if (ipData) {
      if (ipData.resetAt > now && ipData.count >= MAX_TOKENS_PER_IP_PER_DAY) {
        const hoursLeft = Math.ceil((ipData.resetAt.getTime() - now.getTime()) / (1000 * 60 * 60))
        fastify.log.warn({ ip, count: ipData.count }, 'IP reached daily token limit')
        return reply.status(429).send({
          error: 'Daily token limit reached',
          message: `You've created the maximum number of sessions for today. Please try again in ${hoursLeft} hour${hoursLeft > 1 ? 's' : ''}.`,
          retryAfter: ipData.resetAt.toISOString()
        })
      }

      // Reset if 24 hours have passed
      if (ipData.resetAt < now) {
        tokenCreationByIp.delete(ip)
      }
    }

    // Create new session token
    const token = randomUUID()
    const createdAt = new Date()
    const expiresAt = new Date(createdAt.getTime() + TOKEN_EXPIRY_HOURS * 60 * 60 * 1000)

    const session: SessionToken = {
      token,
      createdAt,
      expiresAt,
      messagesRemaining: MAX_MESSAGES_PER_TOKEN,
      ip
    }

    sessions.set(token, session)

    // Update IP tracking
    if (ipData && ipData.resetAt > now) {
      ipData.count++
    } else {
      const resetAt = new Date(now.getTime() + 24 * 60 * 60 * 1000)
      tokenCreationByIp.set(ip, { count: 1, resetAt })
    }

    fastify.log.info({ ip, token }, 'New session token created')

    return {
      token,
      expiresAt: expiresAt.toISOString(),
      messagesRemaining: MAX_MESSAGES_PER_TOKEN,
      maxMessages: MAX_MESSAGES_PER_TOKEN
    }
  })

  // Validate a session token
  fastify.get<{
    Headers: {
      'x-session-token'?: string
    }
  }>('/session/validate', async (request, reply) => {
    const token = request.headers['x-session-token']

    if (!token) {
      return reply.status(401).send({
        error: 'No session token provided',
        valid: false
      })
    }

    const session = sessions.get(token)

    if (!session) {
      return reply.status(404).send({
        error: 'Session not found',
        valid: false
      })
    }

    const now = new Date()
    if (session.expiresAt < now) {
      sessions.delete(token)
      return reply.status(401).send({
        error: 'Session expired',
        valid: false,
        expired: true
      })
    }

    return {
      valid: true,
      messagesRemaining: session.messagesRemaining,
      expiresAt: session.expiresAt.toISOString()
    }
  })

  // Session info endpoint
  fastify.get('/session/info', async (request, reply) => {
    return {
      maxMessages: MAX_MESSAGES_PER_TOKEN,
      expiryHours: TOKEN_EXPIRY_HOURS,
      maxTokensPerIpPerDay: MAX_TOKENS_PER_IP_PER_DAY
    }
  })
}

export default fp(sessionPlugin, {
  name: 'session-module',
  decorators: {
    fastify: []
  }
})

// Export utility functions for use in other modules
export function validateSessionToken(token: string): SessionToken | null {
  const session = sessions.get(token)
  if (!session) return null

  const now = new Date()
  if (session.expiresAt < now) {
    sessions.delete(token)
    return null
  }

  return session
}

export function decrementSessionMessages(token: string): boolean {
  const session = sessions.get(token)
  if (!session) return false

  if (session.messagesRemaining <= 0) return false

  session.messagesRemaining--
  return true
}
