/**
 * UI Resource Tools for AI Agent
 *
 * These tools allow the AI to return interactive UI components
 * instead of just text responses.
 */

import type OpenAI from 'openai'
import { createUIResourceFactory } from '../../shared/ui-resources/factory.js'

const factory = createUIResourceFactory()

/**
 * Tool definitions for UI resources
 */
export const uiTools: OpenAI.Chat.ChatCompletionTool[] = [
  {
    type: 'function',
    function: {
      name: 'show_contact_buttons',
      description: 'Show interactive contact buttons (Contact Page and WhatsApp) to the user. Use this when the user asks how to contact or get in touch, but NOT after collecting booking details.',
      parameters: {
        type: 'object',
        properties: {
          context: {
            type: 'string',
            description: 'The context for showing contact buttons (e.g., "general-inquiry")'
          },
          locale: {
            type: 'string',
            enum: ['en', 'zh'],
            description: 'Language preference (en for English, zh for Chinese)'
          }
        }
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'show_booking_action_buttons',
      description: 'CRITICAL: Show "Send Email to CC" and "WhatsApp CC" buttons AFTER collecting booking details. REQUIRED fields: name OR email OR phone (at least one contact), location, requestedTimes (array). WhatsApp button will auto-generate message from these details. Example: {name: "John", email: "john@email.com", location: "Lucan", requestedTimes: ["Tuesday 3pm"]}',
      parameters: {
        type: 'object',
        properties: {
          bookingDetails: {
            type: 'object',
            description: 'The booking details that will be included in WhatsApp message and email',
            properties: {
              name: { type: 'string', description: 'Customer name (optional but recommended)' },
              email: { type: 'string', description: 'Customer email (required if no phone)' },
              phone: { type: 'string', description: 'Customer phone (required if no email)' },
              location: { type: 'string', description: 'REQUIRED: Customer location (e.g., "Lucan", "Clondalkin")' },
              requestedTimes: {
                type: 'array',
                items: { type: 'string' },
                description: 'REQUIRED: Array of requested times (e.g., ["Tuesday 3pm", "Wednesday 10am"])'
              },
              lessonType: { type: 'string', description: 'Optional: Type of lessons (e.g., "30-minute individual")' },
              studentAge: { type: 'string', description: 'Optional: Student age' }
            },
            required: ['location', 'requestedTimes']
          },
          locale: {
            type: 'string',
            enum: ['en', 'zh'],
            description: 'Language preference'
          }
        },
        required: ['bookingDetails']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'show_email_form',
      description: 'Show an interactive email contact form to the user. Use this when the user explicitly wants to send an email or when they click the email button from contact buttons.',
      parameters: {
        type: 'object',
        properties: {
          locale: {
            type: 'string',
            enum: ['en', 'zh'],
            description: 'Language preference (en for English, zh for Chinese)'
          }
        }
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'show_pricing_table',
      description: 'Show an interactive pricing table with booking buttons. Use this when the user asks about lesson prices, costs, or rates. The table includes individual and group lesson pricing with "Book Now" buttons.',
      parameters: {
        type: 'object',
        properties: {
          locale: {
            type: 'string',
            enum: ['en', 'zh'],
            description: 'Language preference (en for English, zh for Chinese)'
          }
        }
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'initiate_booking',
      description: 'Internal tool called when user clicks a "Book Now" button. This should trigger showing contact buttons so the user can choose how to proceed with booking.',
      parameters: {
        type: 'object',
        properties: {
          lessonType: {
            type: 'string',
            description: 'Type of lesson being booked (e.g., "individual", "group")'
          },
          locale: {
            type: 'string',
            enum: ['en', 'zh'],
            description: 'Language preference'
          }
        },
        required: ['lessonType']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'send_contact_email',
      description: 'Internal tool called when user submits the email contact form. Sends the email via the backend email system.',
      parameters: {
        type: 'object',
        properties: {
          name: {
            type: 'string',
            description: 'Sender name'
          },
          email: {
            type: 'string',
            description: 'Sender email address'
          },
          message: {
            type: 'string',
            description: 'Email message content'
          },
          recipient: {
            type: 'string',
            description: 'Recipient email address'
          },
          businessName: {
            type: 'string',
            description: 'Business name (e.g., "CC Piano")'
          }
        },
        required: ['name', 'email', 'message']
      }
    }
  }
]

/**
 * Helper function to generate WhatsApp message summary from conversation history
 * Extracts key booking details: name, location, time preferences, student info
 */
function generateWhatsAppSummary(conversationHistory: Array<{ role: string; content: string }>, locale: string = 'en', bookingDetails?: any): string {
  // If we have structured booking details, use those
  if (bookingDetails) {
    const parts: string[] = []

    if (locale === 'zh') {
      parts.push('你好！')
      if (bookingDetails.name) parts.push(`我叫${bookingDetails.name}。`)
      if (bookingDetails.location) parts.push(`我在${bookingDetails.location}。`)
      if (bookingDetails.requestedTimes && bookingDetails.requestedTimes.length > 0) {
        parts.push(`我想预订${bookingDetails.requestedTimes.join('或')}的钢琴课程。`)
      } else {
        parts.push('我想咨询钢琴课程。')
      }
      if (bookingDetails.studentAge) parts.push(`学生年龄：${bookingDetails.studentAge}岁。`)
    } else {
      parts.push('Hi!')
      if (bookingDetails.name) parts.push(`I'm ${bookingDetails.name}`)
      if (bookingDetails.location) parts.push(`from ${bookingDetails.location}.`)
      else if (bookingDetails.name) parts.push('.')

      if (bookingDetails.requestedTimes && bookingDetails.requestedTimes.length > 0) {
        parts.push(`I'm looking to book piano lessons at ${bookingDetails.requestedTimes.join(' or ')}.`)
      } else {
        parts.push('I\'m interested in piano lessons.')
      }
      if (bookingDetails.studentAge) parts.push(`Student age: ${bookingDetails.studentAge}.`)
      if (bookingDetails.lessonType) parts.push(`Looking for ${bookingDetails.lessonType}.`)
    }

    return parts.join(' ')
  }

  // Fallback: extract from conversation
  const allMessages = conversationHistory.map(msg => msg.content.toLowerCase()).join(' ')

  // Try to extract name
  const nameMatch = allMessages.match(/(?:my name is|i'm|i am|called)\s+([a-zA-Z]+)/i)
  const name = nameMatch ? nameMatch[1] : null

  // Try to extract location
  const locationMatch = allMessages.match(/(?:in|from|area|location)\s+([a-zA-Z\s]+?)(?:\.|,|$|\s+for|\s+looking)/i)
  const location = locationMatch && locationMatch[1] ? locationMatch[1].trim() : null

  // Try to extract time preferences from user messages
  const userMessages = conversationHistory.filter(msg => msg.role === 'user')
  const timeKeywords = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday', 'morning', 'afternoon', 'evening', 'am', 'pm']
  const timeMessages = userMessages.filter(msg =>
    timeKeywords.some(keyword => msg.content.toLowerCase().includes(keyword))
  )

  const intro = locale === 'zh' ? '你好！' : 'Hi!'
  const parts: string[] = [intro]

  if (name) parts.push(locale === 'zh' ? `我叫${name}。` : `I'm ${name}.`)
  if (location) parts.push(locale === 'zh' ? `我在${location}。` : `I'm from ${location}.`)

  if (timeMessages.length > 0) {
    const timeSummary = timeMessages.slice(-2).map(m => m.content).join(', ')
    parts.push(locale === 'zh' ? `我想预订钢琴课程：${timeSummary}` : `I'm looking to book piano lessons at ${timeSummary}.`)
  } else {
    parts.push(locale === 'zh' ? '我想咨询钢琴课程。' : 'I\'d like to enquire about piano lessons.')
  }

  return parts.join(' ').substring(0, 250)
}

/**
 * Execute UI tool calls and return UI resources
 */
export async function executeUITool(
  toolName: string,
  args: any,
  sendEmailFn?: (options: any) => Promise<void>,
  conversationHistory?: Array<{ role: string; content: string }>
): Promise<{ text: string; uiResource?: any }> {
  const locale = args.locale || 'en'

  if (toolName === 'show_contact_buttons') {
    const hasConversation = conversationHistory && conversationHistory.length > 0
    const conversationSummary = hasConversation
      ? generateWhatsAppSummary(conversationHistory, locale)
      : undefined

    const options: any = {
      locale,
      context: args.context
    }

    if (hasConversation && conversationSummary) {
      options.conversationSummary = conversationSummary
      options.hasConversation = hasConversation
    }

    const uiResource = factory.createContactButtons(options)

    return {
      text: locale === 'zh'
        ? '这里有一些快速联系方式：'
        : 'Here are some quick ways to get in touch:',
      uiResource
    }
  }

  if (toolName === 'show_booking_action_buttons') {
    const { bookingDetails } = args

    // Log what we received for debugging
    console.log('show_booking_action_buttons called with:', JSON.stringify(bookingDetails, null, 2))

    // Ensure bookingDetails has the required fields
    if (!bookingDetails || (!bookingDetails.name && !bookingDetails.email && !bookingDetails.phone)) {
      console.error('ERROR: show_booking_action_buttons called without proper contact info:', bookingDetails)
      return {
        text: 'ERROR: Cannot show booking buttons without contact information. Please collect name/email/phone first.',
        uiResource: undefined
      }
    }

    const uiResource = factory.createBookingActionButtons({
      locale,
      customData: { bookingDetails }
    })

    return {
      text: locale === 'zh'
        ? '很好！请选择您想如何发送预订请求：'
        : 'Perfect! How would you like to send your booking request?',
      uiResource
    }
  }

  if (toolName === 'show_email_form') {
    const uiResource = factory.createEmailForm({ locale })

    return {
      text: locale === 'zh'
        ? '请填写下面的表格，我会把您的信息发送给 CC：'
        : 'Please fill out the form below and I\'ll send your details to CC:',
      uiResource
    }
  }

  if (toolName === 'show_pricing_table') {
    const uiResource = factory.createPricingTable({ locale })

    return {
      text: locale === 'zh'
        ? '这是我们的课程价格：'
        : 'Here\'s our lesson pricing:',
      uiResource
    }
  }

  if (toolName === 'initiate_booking') {
    const { lessonType } = args
    const hasConversation = conversationHistory && conversationHistory.length > 0
    const conversationSummary = hasConversation
      ? generateWhatsAppSummary(conversationHistory, locale)
      : undefined

    const options: any = {
      locale,
      context: `booking-${lessonType}`
    }

    if (hasConversation && conversationSummary) {
      options.conversationSummary = conversationSummary
      options.hasConversation = hasConversation
    }

    const uiResource = factory.createContactButtons(options)

    const lessonName = lessonType === 'individual'
      ? (locale === 'zh' ? '一对一课程' : 'individual lessons')
      : (locale === 'zh' ? '小组课程' : 'group lessons')

    return {
      text: locale === 'zh'
        ? `太好了！您想预订${lessonName}。请选择您的联系方式：`
        : `Great! You're interested in ${lessonName}. How would you like to get in touch?`,
      uiResource
    }
  }

  if (toolName === 'send_contact_email') {
    const { name, email, message, recipient, businessName } = args

    if (!sendEmailFn) {
      throw new Error('Email function not provided to UI tool executor')
    }

    try {
      await sendEmailFn({
        to: recipient || 'cczcy333@gmail.com',
        subject: `Contact Form: Message from ${name}`,
        text: `
Name: ${name}
Email: ${email}

Message:
${message}

---
Sent via ${businessName || 'CC Piano'} contact form
        `.trim(),
        html: `
<h2>New Contact Form Message</h2>
<p><strong>From:</strong> ${name} (${email})</p>
<h3>Message:</h3>
<p>${message.replace(/\n/g, '<br>')}</p>
<hr>
<p><small>Sent via ${businessName || 'CC Piano'} contact form</small></p>
        `.trim()
      })

      return {
        text: locale === 'zh'
          ? '您的邮件已成功发送！CC 会尽快回复您。'
          : 'Your email has been sent successfully! CC will get back to you soon.'
      }
    } catch (error: any) {
      return {
        text: locale === 'zh'
          ? `发送邮件时出错：${error.message}`
          : `Failed to send email: ${error.message}`
      }
    }
  }

  throw new Error(`Unknown UI tool: ${toolName}`)
}
