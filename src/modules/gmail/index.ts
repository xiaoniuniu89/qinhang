import type { FastifyPluginAsync } from 'fastify'
import fp from 'fastify-plugin'
import nodemailer from 'nodemailer'
import { config } from '../../config/index.js'

let transporter: any = null

// Initialize Nodemailer transporter
function initializeGmail() {
  if (!config.gmail?.email || !config.gmail?.password) {
    throw new Error('Gmail credentials not configured')
  }

  transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: config.gmail.email,
      pass: config.gmail.password
    }
  })

  return transporter
}

// Email template types
export interface EmailOptions {
  to: string
  subject: string
  text?: string
  html?: string
  from?: string
}

// Send an email via Nodemailer
export async function sendEmail(options: EmailOptions): Promise<void> {
  if (!transporter) {
    initializeGmail()
  }

  const { to, subject, text, html, from } = options

  const fromAddress = from || config.gmail?.emailFrom || `CC Piano <${config.gmail?.email}>`

  try {
    await transporter.sendMail({
      from: fromAddress,
      to,
      subject,
      text,
      html
    })
  } catch (error: any) {
    throw new Error(`Failed to send email: ${error.message}`)
  }
}

// Template for contact form submission
export function generateContactFormEmail(data: {
  name: string
  email: string
  message: string
  phone?: string
}): EmailOptions {
  const teacherEmail = config.gmail?.teacherEmail || 'cczcy333@gmail.com'

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background-color: #2c5282; color: white; padding: 20px; border-radius: 5px 5px 0 0; }
        .content { background-color: #f7fafc; padding: 20px; border-radius: 0 0 5px 5px; }
        .field { margin-bottom: 15px; }
        .label { font-weight: bold; color: #2c5282; }
        .value { margin-top: 5px; padding: 10px; background-color: white; border-left: 3px solid #2c5282; }
        .footer { margin-top: 20px; padding-top: 20px; border-top: 1px solid #e2e8f0; font-size: 12px; color: #718096; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h2 style="margin: 0;">New Contact Form Submission</h2>
          <p style="margin: 5px 0 0 0;">CC Piano - ccpiano.ie</p>
        </div>
        <div class="content">
          <div class="field">
            <div class="label">Name:</div>
            <div class="value">${data.name}</div>
          </div>
          <div class="field">
            <div class="label">Email:</div>
            <div class="value"><a href="mailto:${data.email}">${data.email}</a></div>
          </div>
          ${data.phone ? `
          <div class="field">
            <div class="label">Phone:</div>
            <div class="value"><a href="tel:${data.phone}">${data.phone}</a></div>
          </div>
          ` : ''}
          <div class="field">
            <div class="label">Message:</div>
            <div class="value">${data.message.replace(/\n/g, '<br>')}</div>
          </div>
          <div class="footer">
            <p>This message was sent via the contact form on ccpiano.ie</p>
            <p>Submitted at: ${new Date().toLocaleString('en-IE', { timeZone: 'Europe/Dublin' })}</p>
          </div>
        </div>
      </div>
    </body>
    </html>
  `

  return {
    to: teacherEmail,
    subject: `New Contact Form: ${data.name}`,
    html,
    text: `New contact form submission from ${data.name} (${data.email}):\n\n${data.message}`
  }
}

// Template for booking inquiry from AI agent
export function generateBookingInquiryEmail(data: {
  name?: string
  email?: string
  phone?: string
  location?: string
  requestedTimes: string[]
  lessonType?: string
  studentAge?: string
  conversationSummary?: string
  conversationThread?: Array<{ role: string; content: string }>
}): EmailOptions {
  const teacherEmail = config.gmail?.teacherEmail || 'cczcy333@gmail.com'

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background-color: #2c5282; color: white; padding: 20px; border-radius: 5px 5px 0 0; }
        .content { background-color: #f7fafc; padding: 20px; border-radius: 0 0 5px 5px; }
        .field { margin-bottom: 15px; }
        .label { font-weight: bold; color: #2c5282; }
        .value { margin-top: 5px; padding: 10px; background-color: white; border-left: 3px solid #2c5282; }
        .highlight { background-color: #fef3c7; padding: 15px; border-left: 4px solid #f59e0b; margin: 15px 0; }
        .footer { margin-top: 20px; padding-top: 20px; border-top: 1px solid #e2e8f0; font-size: 12px; color: #718096; }
        ul { margin: 5px 0; padding-left: 20px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h2 style="margin: 0;">🎹 New Lesson Booking Inquiry</h2>
          <p style="margin: 5px 0 0 0;">Via Coda AI Assistant</p>
        </div>
        <div class="content">
          <div class="highlight">
            <strong>Action Required:</strong> A potential student is interested in booking lessons. Please review and respond.
          </div>

          ${data.name ? `
          <div class="field">
            <div class="label">Student/Contact Name:</div>
            <div class="value">${data.name}</div>
          </div>
          ` : ''}

          ${data.email ? `
          <div class="field">
            <div class="label">Email:</div>
            <div class="value"><a href="mailto:${data.email}">${data.email}</a></div>
          </div>
          ` : ''}

          ${data.phone ? `
          <div class="field">
            <div class="label">Phone/WhatsApp:</div>
            <div class="value"><a href="tel:${data.phone}">${data.phone}</a> | <a href="https://wa.me/${data.phone.replace(/\D/g, '')}" target="_blank">Open in WhatsApp</a></div>
          </div>
          ` : ''}

          ${data.location ? `
          <div class="field">
            <div class="label">Location:</div>
            <div class="value">${data.location}</div>
          </div>
          ` : ''}

          ${data.requestedTimes && data.requestedTimes.length > 0 ? `
          <div class="field">
            <div class="label">Requested Times:</div>
            <div class="value">
              <ul>
                ${data.requestedTimes.map(time => `<li>${time}</li>`).join('')}
              </ul>
            </div>
          </div>
          ` : `
          <div class="field">
            <div class="label">Requested Times:</div>
            <div class="value">Not specified (customer is flexible)</div>
          </div>
          `}

          ${data.lessonType ? `
          <div class="field">
            <div class="label">Lesson Type:</div>
            <div class="value">${data.lessonType}</div>
          </div>
          ` : ''}

          ${data.studentAge ? `
          <div class="field">
            <div class="label">Student Age:</div>
            <div class="value">${data.studentAge}</div>
          </div>
          ` : ''}

          ${data.conversationSummary ? `
          <div class="field">
            <div class="label">Conversation Summary:</div>
            <div class="value">${data.conversationSummary.replace(/\n/g, '<br>')}</div>
          </div>
          ` : ''}

          ${data.conversationThread && data.conversationThread.length > 0 ? `
          <div class="field">
            <div class="label">Full Conversation:</div>
            <div class="value">
              ${data.conversationThread.map(msg => {
                if (msg.role === 'user') {
                  return `<div style="margin-bottom: 15px; padding: 10px; background-color: #e6f3ff; border-left: 3px solid #0066cc;">
                    <strong style="color: #0066cc;">Customer:</strong><br>
                    ${msg.content.replace(/\n/g, '<br>')}
                  </div>`;
                } else if (msg.role === 'assistant') {
                  return `<div style="margin-bottom: 15px; padding: 10px; background-color: #f0f0f0; border-left: 3px solid #666;">
                    <strong style="color: #666;">Coda (AI):</strong><br>
                    ${msg.content.replace(/\n/g, '<br>')}
                  </div>`;
                }
                return '';
              }).join('')}
            </div>
          </div>
          ` : ''}

          <div class="footer">
            <p>This inquiry was processed by Coda, the AI assistant on ccpiano.ie</p>
            <p>Received at: ${new Date().toLocaleString('en-IE', { timeZone: 'Europe/Dublin' })}</p>
          </div>
        </div>
      </div>
    </body>
    </html>
  `

  const contactInfo = data.name || data.email || data.phone || 'New Contact'

  let text = `New Lesson Booking Inquiry

${data.name ? `Student/Contact: ${data.name}` : ''}
${data.email ? `Email: ${data.email}` : ''}
${data.phone ? `Phone: ${data.phone}` : ''}
${data.location ? `Location: ${data.location}` : ''}

Requested Times:
${data.requestedTimes.length > 0 ? data.requestedTimes.map(time => `- ${time}`).join('\n') : '- Not specified'}

${data.lessonType ? `Lesson Type: ${data.lessonType}` : ''}
${data.studentAge ? `Student Age: ${data.studentAge}` : ''}

${data.conversationSummary ? `\nConversation Summary:\n${data.conversationSummary}` : ''}`

  // Add full conversation thread if available
  if (data.conversationThread && data.conversationThread.length > 0) {
    text += '\n\n' + '='.repeat(50) + '\nFull Conversation:\n' + '='.repeat(50) + '\n\n'
    text += data.conversationThread.map(msg => {
      if (msg.role === 'user') {
        return `[Customer]: ${msg.content}`
      } else if (msg.role === 'assistant') {
        return `[Coda AI]: ${msg.content}`
      }
      return ''
    }).filter(m => m).join('\n\n')
  }

  text += `\n\n---
Received at: ${new Date().toLocaleString('en-IE', { timeZone: 'Europe/Dublin' })}
Note: Review feasibility based on your existing schedule and travel time between locations.
  `

  return {
    to: teacherEmail,
    subject: `🎹 Lesson Inquiry: ${contactInfo}`,
    html,
    text
  }
}

const gmailPlugin: FastifyPluginAsync = async (fastify, opts) => {
  fastify.log.info('Gmail module loaded')

  // Initialize Gmail client if credentials are available
  if (config.gmail?.email && config.gmail?.password) {
    try {
      initializeGmail()
      fastify.log.info('Gmail SMTP client initialized')
    } catch (error: any) {
      fastify.log.error({ err: error }, 'Failed to initialize Gmail SMTP client')
    }
  } else {
    fastify.log.warn('Gmail credentials not configured (GMAIL_EMAIL and GMAIL_PASSWORD required)')
  }

  // Test endpoint to send an email
  fastify.post<{
    Body: EmailOptions
  }>('/gmail/send', {
    config: {
      rateLimit: {
        max: 2,
        timeWindow: '1 minute'
      }
    }
  }, async (request, reply) => {
    if (!config.gmail?.email || !config.gmail?.password) {
      return reply.status(503).send({ error: 'Gmail not configured' })
    }

    try {
      await sendEmail(request.body)
      return { success: true, message: 'Email sent successfully' }
    } catch (error: any) {
      fastify.log.error({ err: error }, 'Failed to send email')
      return reply.status(500).send({
        error: 'Failed to send email',
        details: error.message
      })
    }
  })
}

export default fp(gmailPlugin, {
  name: 'gmail-module',
  decorators: {
    fastify: []
  }
})

// Export functions for use by other modules
export { initializeGmail }
