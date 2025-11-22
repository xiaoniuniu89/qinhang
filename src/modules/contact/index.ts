import type { FastifyPluginAsync } from 'fastify'
import fp from 'fastify-plugin'
import { config } from '../../config/index.js'
import { sendEmail, generateContactFormEmail } from '../gmail/index.js'

const contactPlugin: FastifyPluginAsync = async (fastify, opts) => {
  fastify.log.info('Contact module loaded')

  // Contact form submission endpoint
  fastify.post<{
    Body: {
      name: string
      email: string
      message: string
      phone?: string
    }
  }>('/contact', {
    config: {
      rateLimit: {
        max: 2,
        timeWindow: '1 minute'
      }
    }
  }, async (request, reply) => {
    const { name, email, message, phone } = request.body

    // Validate required fields
    if (!name || !email || !message) {
      return reply.status(400).send({
        error: 'Missing required fields',
        details: 'Name, email, and message are required'
      })
    }

    // Validate field lengths to prevent abuse
    if (name.length > 100 || email.length > 100 || message.length > 2000) {
      fastify.log.warn({
        ip: request.ip,
        nameLength: name.length,
        emailLength: email.length,
        messageLength: message.length
      }, 'Rejected oversized contact form - potential abuse attempt')
      return reply.status(400).send({
        error: 'Input too long',
        details: 'Name and email must be under 100 characters, message under 2,000 characters'
      })
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      fastify.log.warn({
        ip: request.ip,
        email
      }, 'Invalid email format in contact form')
      return reply.status(400).send({
        error: 'Invalid email address'
      })
    }

    // Check if Gmail is configured
    if (!config.gmail?.email || !config.gmail?.password) {
      fastify.log.warn('Contact form submitted but Gmail not configured')
      return reply.status(503).send({
        error: 'Email service not configured',
        details: 'Please contact us directly at cczcy333@gmail.com'
      })
    }

    try {
      // Generate and send email
      const emailOptions = generateContactFormEmail({
        name,
        email,
        message,
        ...(phone && { phone })
      })

      await sendEmail(emailOptions)

      fastify.log.info({
        from: email,
        name,
        hasPhone: !!phone
      }, 'Contact form submitted successfully')

      return {
        success: true,
        message: 'Your message has been sent successfully. We will get back to you soon!'
      }
    } catch (error: any) {
      fastify.log.error({ err: error, email, name }, 'Failed to send contact form email')

      return reply.status(500).send({
        error: 'Failed to send message',
        details: 'Please try again or contact us directly at cczcy333@gmail.com',
        fallbackEmail: 'cczcy333@gmail.com'
      })
    }
  })

  // Health check for contact form
  fastify.get('/contact/status', async (request, reply) => {
    return {
      available: !!(config.gmail?.email && config.gmail?.password),
      fallbackEmail: 'cczcy333@gmail.com'
    }
  })
}

export default fp(contactPlugin, {
  name: 'contact-module',
  decorators: {
    fastify: []
  }
})
