/**
 * UI Resource Factory
 *
 * This module provides a factory for creating modular, reusable UI resources
 * that can be sent from the backend to be rendered in the chat widget.
 *
 * Designed for multi-tenant support - can be configured for any teacher/school.
 */

import { createUIResource } from '@mcp-ui/server'
import { getBusinessConfig } from '../business-config.js'
import type { BusinessConfig } from '../business-config.js'
import { generateShadcnStyles } from './shadcn-variables.js'

export type UIResourceType = 'contact-buttons' | 'email-form' | 'pricing-table' | 'whatsapp-link'

export interface UIResourceOptions {
  locale?: 'en' | 'zh'
  context?: string
  customData?: Record<string, any>
  conversationSummary?: string  // Summary of chat for smart WhatsApp/Email messages
  hasConversation?: boolean     // Whether there's chat history
}

/**
 * UI Resource Factory
 * Creates UI resources based on business configuration
 */
export class UIResourceFactory {
  private config: BusinessConfig

  constructor(config?: BusinessConfig) {
    this.config = config || getBusinessConfig()
  }

  /**
   * Create a contact buttons UI with Email and WhatsApp options
   * 
   * Server-side HTML generation - no frontend endpoints needed
   */
  createContactButtons(options: UIResourceOptions = {}) {
    const { locale = 'en', conversationSummary, hasConversation = false } = options
    const { contact, theme } = this.config

    const translations = {
      en: {
        title: 'Get in Touch',
        contactPage: 'Visit Contact Page',
        whatsapp: 'Message on WhatsApp'
      },
      zh: {
        title: '联系方式',
        contactPage: '访问联系页面',
        whatsapp: '通过 WhatsApp 联系'
      }
    }

    const t = translations[locale]
    
    // Use conversation summary if available, otherwise use default message
    let whatsappMessageText: string
    if (conversationSummary && hasConversation) {
      whatsappMessageText = conversationSummary
    } else {
      whatsappMessageText = locale === 'zh'
        ? contact.whatsapp.defaultMessage.zh || contact.whatsapp.defaultMessage.en
        : contact.whatsapp.defaultMessage.en
    }

    const shadcnStyles = generateShadcnStyles(true, false)
    const whatsappUrl = `https://wa.me/${contact.whatsapp.number}?text=${encodeURIComponent(whatsappMessageText)}`

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1">
          <style>
            ${shadcnStyles}
            * {
              box-sizing: border-box;
            }
            html, body {
              margin: 0;
              padding: 0;
              background: transparent;
              font-family: system-ui, -apple-system, sans-serif;
              overflow-x: hidden;
              width: 100%;
            }
            body {
              padding: 8px;
            }
            .container {
              display: flex;
              flex-direction: column;
              gap: 12px;
              width: 100%;
              max-width: 100%;
            }
            .title {
              font-size: 14px;
              font-weight: 600;
              margin: 0 0 4px 0;
              color: #1a1a1a;
            }
            .btn {
              width: 100%;
              max-width: 100%;
              padding: 10px 16px;
              border: none;
              border-radius: 8px;
              font-size: 14px;
              font-weight: 500;
              cursor: pointer;
              display: flex;
              align-items: center;
              justify-content: center;
              gap: 8px;
              transition: all 0.2s;
              text-decoration: none;
              color: white;
              white-space: nowrap;
              overflow: hidden;
              text-overflow: ellipsis;
            }
            .btn-primary {
              background: #2c5282;
              color: white;
            }
            .btn-primary:hover {
              background: #1e3a5f;
            }
            .btn-whatsapp {
              background: #25D366;
              color: white;
            }
            .btn-whatsapp:hover {
              background: #20ba5a;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <h3 class="title">${t.title}</h3>
            <button class="btn btn-primary" onclick="window.parent.postMessage({type:'tool',payload:{toolName:'navigate_to_contact',params:{}}}, '*')">
              📝 ${t.contactPage}
            </button>
            <button class="btn btn-whatsapp" onclick="handleWhatsAppClick()">
              💬 ${t.whatsapp}
            </button>
          </div>
          <script>
            function handleWhatsAppClick() {
              window.parent.postMessage({
                type: 'link',
                payload: {
                  url: ${JSON.stringify(whatsappUrl)},
                  openInNewTab: true
                }
              }, '*');
            }
            
            function notifySize() {
              const height = document.body.scrollHeight;
              window.parent.postMessage({type:'ui-size-change',payload:{height}}, '*');
            }
            notifySize();
            window.addEventListener('resize', notifySize);
          </script>
        </body>
      </html>
    `

    return createUIResource({
      uri: `ui://contact/buttons/${Date.now()}`,
      content: {
        type: 'rawHtml',
        htmlString: html
      },
      encoding: 'text',
      metadata: {
        title: t.title,
        description: 'Quick contact options for getting in touch'
      }
    })
  }

  /**
   * Create booking action buttons (Send Email to CC + WhatsApp CC)
   * Used AFTER collecting booking details to let user choose how to send request
   */
  createBookingActionButtons(options: UIResourceOptions = {}) {
    const { locale = 'en', customData } = options
    const { contact, theme } = this.config

    const bookingDetails = customData?.bookingDetails || {}

    const translations = {
      en: {
        title: 'Choose how to send',
        emailBtn: 'Send Email to CC',
        whatsappBtn: 'WhatsApp CC'
      },
      zh: {
        title: '选择发送方式',
        emailBtn: '发送邮件给 CC',
        whatsappBtn: '通过 WhatsApp 联系 CC'
      }
    }

    const t = translations[locale]

    // Generate WhatsApp message from booking details
    const parts: string[] = []
    if (locale === 'zh') {
      parts.push('你好！')
      if (bookingDetails.name) parts.push(`我叫${bookingDetails.name}。`)
      if (bookingDetails.location) parts.push(`我在${bookingDetails.location}。`)
      if (bookingDetails.requestedTimes?.length) {
        parts.push(`我想预订${bookingDetails.requestedTimes.join('或')}的钢琴课程。`)
      }
    } else {
      parts.push('Hello!')
      if (bookingDetails.name) parts.push(`My name is ${bookingDetails.name}.`)
      if (bookingDetails.location) parts.push(`I'm located in ${bookingDetails.location}.`)
      if (bookingDetails.requestedTimes?.length) {
        parts.push(`I'm looking to book piano lessons at ${bookingDetails.requestedTimes.join(' or ')}.`)
      }
    }
    if (bookingDetails.phone) parts.push(`📱 ${bookingDetails.phone}`)
    if (bookingDetails.email) parts.push(`📧 ${bookingDetails.email}`)

    const whatsappMessage = parts.join(' ')
    const whatsappUrl = `https://wa.me/${contact.whatsapp.number}?text=${encodeURIComponent(whatsappMessage)}`

    const shadcnStyles = generateShadcnStyles(true, false)

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1">
          <style>
            ${shadcnStyles}
            * {
              box-sizing: border-box;
            }
            html, body {
              margin: 0;
              padding: 0;
              background: transparent;
              font-family: system-ui, -apple-system, sans-serif;
              overflow-x: hidden;
              width: 100%;
            }
            body {
              padding: 8px;
            }
            .container {
              display: flex;
              flex-direction: column;
              gap: 12px;
              width: 100%;
              max-width: 100%;
            }
            .title {
              font-size: 14px;
              font-weight: 600;
              margin: 0 0 4px 0;
              color: #1a1a1a;
            }
            .btn {
              width: 100%;
              max-width: 100%;
              padding: 10px 16px;
              border: none;
              border-radius: 8px;
              font-size: 14px;
              font-weight: 500;
              cursor: pointer;
              display: flex;
              align-items: center;
              justify-content: center;
              gap: 8px;
              transition: all 0.2s;
              text-decoration: none;
              color: white;
              white-space: nowrap;
              overflow: hidden;
              text-overflow: ellipsis;
            }
            .btn:disabled {
              opacity: 0.5;
              cursor: not-allowed;
            }
            .btn-primary {
              background: #2c5282;
              color: white;
            }
            .btn-primary:hover:not(:disabled) {
              background: #1e3a5f;
            }
            .btn-whatsapp {
              background: #25D366;
              color: white;
            }
            .btn-whatsapp:hover:not(:disabled) {
              background: #20ba5a;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <h3 class="title">${t.title}</h3>
            <button 
              class="btn btn-primary" 
              id="emailBtn"
              onclick="handleEmailClick()"
            >
              📧 ${t.emailBtn}
            </button>
            <button 
              class="btn btn-whatsapp" 
              id="whatsappBtn"
              onclick="handleWhatsAppClick()"
            >
              💬 ${t.whatsappBtn}
            </button>
          </div>
          <script>
            let clicked = false;
            
            function handleEmailClick() {
              if (clicked) return;
              clicked = true;
              document.getElementById('emailBtn').disabled = true;
              document.getElementById('whatsappBtn').disabled = true;
              
              window.parent.postMessage({
                type: 'tool',
                payload: {
                  toolName: 'send_booking_inquiry',
                  params: {
                    bookingDetails: ${JSON.stringify(bookingDetails)},
                    method: 'email',
                    locale: '${locale}'
                  }
                }
              }, '*');
            }
            
            function handleWhatsAppClick() {
              if (clicked) return;
              clicked = true;
              document.getElementById('emailBtn').disabled = true;
              document.getElementById('whatsappBtn').disabled = true;
              
              window.parent.postMessage({
                type: 'link',
                payload: {
                  url: ${JSON.stringify(whatsappUrl)},
                  openInNewTab: true
                }
              }, '*');
            }
            
            function notifySize() {
              const height = document.body.scrollHeight;
              window.parent.postMessage({type:'ui-size-change',payload:{height}}, '*');
            }
            notifySize();
            window.addEventListener('resize', notifySize);
          </script>
        </body>
      </html>
    `

    return createUIResource({
      uri: `ui://booking/actions/${Date.now()}`,
      content: {
        type: 'rawHtml',
        htmlString: html
      },
      encoding: 'text',
      metadata: {
        title: t.title,
        description: 'Booking action buttons'
      }
    })
  }

  /**
   * Create an email contact form
   */
  createEmailForm(options: UIResourceOptions = {}) {
    const { locale = 'en' } = options
    const { contact, info, theme } = this.config

    const translations = {
      en: {
        title: 'Send us an email',
        namePlaceholder: 'Your name',
        emailPlaceholder: 'Your email address',
        messagePlaceholder: 'Your message...',
        sendButton: 'Send Email',
        sending: 'Sending...',
        success: 'Email sent successfully!',
        error: 'Failed to send email. Please try again.'
      },
      zh: {
        title: '发送邮件',
        namePlaceholder: '您的姓名',
        emailPlaceholder: '您的邮箱地址',
        messagePlaceholder: '您的留言...',
        sendButton: '发送邮件',
        sending: '发送中...',
        success: '邮件发送成功！',
        error: '发送失败，请重试。'
      }
    }

    const t = translations[locale]

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            padding: 16px;
            background: #f9f9f9;
          }
          .form-container {
            background: white;
            padding: 20px;
            border-radius: 12px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
          }
          h3 {
            margin-bottom: 16px;
            color: #333;
            font-size: 18px;
          }
          .form-group {
            margin-bottom: 12px;
          }
          label {
            display: block;
            margin-bottom: 6px;
            font-size: 13px;
            font-weight: 500;
            color: #555;
          }
          input, textarea {
            width: 100%;
            padding: 10px 12px;
            border: 1px solid #ddd;
            border-radius: 6px;
            font-size: 14px;
            font-family: inherit;
            transition: border-color 0.2s;
          }
          input:focus, textarea:focus {
            outline: none;
            border-color: ${theme.primaryColor};
          }
          textarea {
            resize: vertical;
            min-height: 100px;
          }
          .submit-btn {
            width: 100%;
            padding: 12px;
            background: ${theme.primaryColor};
            color: white;
            border: none;
            border-radius: 6px;
            font-size: 15px;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.2s;
          }
          .submit-btn:hover:not(:disabled) {
            background: ${theme.secondaryColor || theme.primaryColor};
            opacity: 0.9;
            transform: translateY(-1px);
          }
          .submit-btn:disabled {
            opacity: 0.6;
            cursor: not-allowed;
          }
          .status-message {
            margin-top: 12px;
            padding: 10px;
            border-radius: 6px;
            font-size: 13px;
            text-align: center;
          }
          .status-success {
            background: #d4edda;
            color: #155724;
          }
          .status-error {
            background: #f8d7da;
            color: #721c24;
          }
        </style>
      </head>
      <body>
        <div class="form-container">
          <h3>${t.title}</h3>
          <form id="emailForm">
            <div class="form-group">
              <input
                type="text"
                id="name"
                placeholder="${t.namePlaceholder}"
                required
              >
            </div>

            <div class="form-group">
              <input
                type="email"
                id="email"
                placeholder="${t.emailPlaceholder}"
                required
              >
            </div>

            <div class="form-group">
              <textarea
                id="message"
                placeholder="${t.messagePlaceholder}"
                required
              ></textarea>
            </div>

            <button type="submit" class="submit-btn" id="submitBtn">
              ${t.sendButton}
            </button>

            <div id="statusMessage" style="display: none;"></div>
          </form>
        </div>

        <script>
          const form = document.getElementById('emailForm');
          const submitBtn = document.getElementById('submitBtn');
          const statusMessage = document.getElementById('statusMessage');

          form.addEventListener('submit', async (e) => {
            e.preventDefault();

            const formData = {
              name: document.getElementById('name').value,
              email: document.getElementById('email').value,
              message: document.getElementById('message').value,
              recipient: '${contact.email}',
              businessName: '${info.name}'
            };

            // Disable form
            submitBtn.disabled = true;
            submitBtn.textContent = '${t.sending}';

            try {
              // Send to backend
              window.parent.postMessage({
                type: 'tool',
                payload: {
                  toolName: 'send_contact_email',
                  params: formData
                }
              }, '*');

              // Show success message
              statusMessage.className = 'status-message status-success';
              statusMessage.textContent = '${t.success}';
              statusMessage.style.display = 'block';

              // Reset form
              form.reset();

              // Send notification
              window.parent.postMessage({
                type: 'notify',
                payload: {
                  level: 'success',
                  message: '${t.success}'
                }
              }, '*');
            } catch (error) {
              statusMessage.className = 'status-message status-error';
              statusMessage.textContent = '${t.error}';
              statusMessage.style.display = 'block';
            } finally {
              submitBtn.disabled = false;
              submitBtn.textContent = '${t.sendButton}';
            }
          });

          // Notify parent of size
          window.addEventListener('load', () => {
            const height = document.body.scrollHeight;
            window.parent.postMessage({
              type: 'ui-size-change',
              payload: { height }
            }, '*');
          });

          // Update size when form changes
          const resizeObserver = new ResizeObserver(() => {
            window.parent.postMessage({
              type: 'ui-size-change',
              payload: { height: document.body.scrollHeight }
            }, '*');
          });
          resizeObserver.observe(document.body);
        </script>
      </body>
      </html>
    `

    return createUIResource({
      uri: `ui://contact/email-form/${Date.now()}`,
      content: {
        type: 'rawHtml',
        htmlString: htmlContent
      },
      encoding: 'text',
      metadata: {
        title: t.title,
        description: 'Contact form for sending email inquiries',
        'mcpui.dev/ui-preferred-frame-size': ['auto', 'auto']
      }
    })
  }

  /**
   * Create a pricing table with booking buttons
   */
  createPricingTable(options: UIResourceOptions = {}) {
    const { locale = 'en' } = options
    const { pricing, theme, info } = this.config

    const translations = {
      en: {
        title: 'Lesson Pricing',
        individual: 'Individual Lessons',
        group: 'Group Lessons',
        perLesson: 'per lesson',
        bookNow: 'Book Now',
        students: 'students'
      },
      zh: {
        title: '课程价格',
        individual: '一对一课程',
        group: '小组课程',
        perLesson: '每节课',
        bookNow: '立即预订',
        students: '名学生'
      }
    }

    const t = translations[locale]
    const currencySymbol = pricing.currency === 'EUR' ? '€' : pricing.currency === 'USD' ? '$' : pricing.currency

    const groupSection = pricing.group ? `
      <div class="pricing-card">
        <h4>${t.group}</h4>
        <div class="price">${currencySymbol}${pricing.group.price}</div>
        <p class="duration">${pricing.group.description[locale] || pricing.group.description.en}</p>
        <button class="book-btn" onclick="bookLesson('group')">
          ${t.bookNow}
        </button>
      </div>
    ` : ''

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            padding: 16px;
            background: transparent;
          }
          .pricing-container {
            display: grid;
            gap: 16px;
            max-width: 600px;
          }
          h3 {
            font-size: 18px;
            margin-bottom: 12px;
            color: #333;
          }
          .pricing-card {
            background: white;
            border: 2px solid #e0e0e0;
            border-radius: 12px;
            padding: 20px;
            transition: all 0.2s;
          }
          .pricing-card:hover {
            border-color: ${theme.primaryColor};
            box-shadow: 0 4px 12px rgba(0,0,0,0.1);
          }
          h4 {
            font-size: 16px;
            color: #555;
            margin-bottom: 12px;
          }
          .price {
            font-size: 32px;
            font-weight: bold;
            color: ${theme.primaryColor};
            margin-bottom: 8px;
          }
          .duration {
            color: #666;
            margin-bottom: 16px;
            font-size: 14px;
          }
          .book-btn {
            width: 100%;
            padding: 12px;
            background: ${theme.primaryColor};
            color: white;
            border: none;
            border-radius: 8px;
            font-size: 15px;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.2s;
          }
          .book-btn:hover {
            background: ${theme.secondaryColor || theme.primaryColor};
            opacity: 0.9;
            transform: translateY(-2px);
          }
          .book-btn:active {
            transform: translateY(0);
          }
        </style>
      </head>
      <body>
        <div class="pricing-container">
          <h3>${t.title}</h3>

          <div class="pricing-card">
            <h4>${t.individual}</h4>
            <div class="price">${currencySymbol}${pricing.individual.price}</div>
            <p class="duration">${pricing.individual.description[locale] || pricing.individual.description.en}</p>
            <button class="book-btn" onclick="bookLesson('individual')">
              ${t.bookNow}
            </button>
          </div>

          ${groupSection}
        </div>

        <script>
          function bookLesson(type) {
            window.parent.postMessage({
              type: 'tool',
              payload: {
                toolName: 'initiate_booking',
                params: {
                  lessonType: type,
                  locale: '${locale}'
                }
              }
            }, '*');

            // Also show contact buttons as next step
            window.parent.postMessage({
              type: 'tool',
              payload: {
                toolName: 'show_contact_buttons',
                params: {
                  context: 'booking-' + type,
                  locale: '${locale}'
                }
              }
            }, '*');
          }

          // Notify parent of size
          window.addEventListener('load', () => {
            const height = document.body.scrollHeight;
            window.parent.postMessage({
              type: 'ui-size-change',
              payload: { height }
            }, '*');
          });
        </script>
      </body>
      </html>
    `

    return createUIResource({
      uri: `ui://pricing/table/${Date.now()}`,
      content: {
        type: 'rawHtml',
        htmlString: htmlContent
      },
      encoding: 'text',
      metadata: {
        title: t.title,
        description: 'Lesson pricing and booking options',
        'mcpui.dev/ui-preferred-frame-size': ['auto', 'auto']
      }
    })
  }
}

/**
 * Helper function to create a UI resource factory with the current config
 */
export function createUIResourceFactory(config?: BusinessConfig): UIResourceFactory {
  return new UIResourceFactory(config)
}
