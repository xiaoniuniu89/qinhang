import type { FastifyPluginAsync } from 'fastify'
import fp from 'fastify-plugin'

const blogPlugin: FastifyPluginAsync = async (fastify, opts) => {
  fastify.log.info('Blog module loaded')

  // Blog routes
  fastify.get('/blog', async (request, reply) => {
    return { message: 'Blog posts endpoint - to be implemented' }
  })

  fastify.get('/blog/:id', async (request, reply) => {
    return { message: 'Single blog post endpoint - to be implemented' }
  })

  // Future: POST, PUT, DELETE routes for blog management
}

export default fp(blogPlugin, {
  name: 'blog-module',
  decorators: {
    fastify: []
  }
})
