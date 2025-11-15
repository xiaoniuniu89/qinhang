import type { FastifyPluginAsync } from 'fastify'
import fp from 'fastify-plugin'

const aiAgentPlugin: FastifyPluginAsync = async (fastify, opts) => {
  fastify.log.info('AI Agent module loaded')

  // AI chat endpoint
  fastify.post('/ai/chat', async (request, reply) => {
    return { message: 'AI chat endpoint - to be implemented' }
  })

  // Future: conversation history, context management, etc.
}

export default fp(aiAgentPlugin, {
  name: 'ai-agent-module',
  decorators: {
    fastify: []
  }
})
