import type { FastifyPluginAsync } from 'fastify'
import fp from 'fastify-plugin'

const mediaHostingPlugin: FastifyPluginAsync = async (fastify, opts) => {
  fastify.log.info('Media Hosting module loaded')

  // List media files
  fastify.get('/media', async (request, reply) => {
    return { message: 'Media listing endpoint - to be implemented' }
  })

  // Upload media (PDFs, videos, audio files)
  fastify.post('/media/upload', async (request, reply) => {
    return { message: 'Media upload endpoint - to be implemented' }
  })

  // Download/stream media
  fastify.get('/media/:id', async (request, reply) => {
    return { message: 'Media download endpoint - to be implemented' }
  })

  // Future: categorization, tagging, permissions
}

export default fp(mediaHostingPlugin, {
  name: 'media-hosting-module',
  decorators: {
    fastify: []
  }
})
