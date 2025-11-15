import type { FastifyPluginAsync } from 'fastify'
import fp from 'fastify-plugin'

const schedulingPlugin: FastifyPluginAsync = async (fastify, opts) => {
  fastify.log.info('Scheduling module loaded')

  // Get available time slots
  fastify.get('/schedule/availability', async (request, reply) => {
    return { message: 'Availability endpoint - to be implemented' }
  })

  // Book a class
  fastify.post('/schedule/book', async (request, reply) => {
    return { message: 'Booking endpoint - to be implemented' }
  })

  // Get bookings (for teacher)
  fastify.get('/schedule/bookings', async (request, reply) => {
    return { message: 'Bookings list endpoint - to be implemented' }
  })

  // Future: calendar integration, reminders, cancellations
}

export default fp(schedulingPlugin, {
  name: 'scheduling-module',
  decorators: {
    fastify: []
  }
})
