import type { FastifyPluginAsync } from 'fastify'
import fp from 'fastify-plugin'
import OpenAI from 'openai'
import { config } from '../../config/index.js'
import { loadKnowledgeBase, searchKnowledge, getKnowledgeByTopic, extractRelevantSection } from './knowledge-retrieval.js'

// In-memory chat history storage (use Redis or database in production)
const chatHistories = new Map<string, OpenAI.Chat.ChatCompletionMessageParam[]>()
const MAX_HISTORY_LENGTH = 20

// Enhanced tools with knowledge base search
const tools: OpenAI.Chat.ChatCompletionTool[] = [
  {
    type: 'function',
    function: {
      name: 'search_knowledge',
      description: 'Search the knowledge base for information about piano lessons. Use this to answer questions about pricing, schedule, exams (ABRSM, RIAM), teacher background, service areas, lesson types, and FAQs. Returns relevant information from the knowledge base.',
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'The search query or question to look up in the knowledge base. Be specific about what information is needed.'
          },
          topics: {
            type: 'array',
            items: {
              type: 'string',
              enum: ['teacher', 'pricing', 'areas', 'exams', 'lessons', 'schedule', 'faq']
            },
            description: 'Specific topics to search. Leave empty to search all topics. Available topics: teacher (background, qualifications), pricing (costs, packages), areas (locations served), exams (ABRSM, RIAM, school exams), lessons (types, formats), schedule (availability), faq (common questions)'
          }
        },
        required: ['query']
      }
    }
  }
]

// System prompt with enhanced instructions
const SYSTEM_PROMPT = `You are Coda, a helpful AI assistant for CC Piano, a piano teaching service in Ireland run by Chenyang Zhao (CC).

Your role is to help potential and current students by answering questions about piano lessons, pricing, service areas, exam preparation, teacher qualifications, scheduling, and general questions about learning piano.

CRITICAL GUIDELINES:

1. **Tone & Style:**
   - Be conversational, warm, and natural - like a helpful friend who knows the business well
   - Answer questions directly and confidently when you have the information
   - Only mention "CC" by name when it's natural to do so (e.g., "CC teaches in...", "CC has been teaching...")
   - AVOID mechanical phrases like "CC offers...", "The service provides...", "For details, please reach out to CC"
   - Instead, use natural language: "Yes, that's possible!", "Absolutely!", "Great question!", "Four is quite young, but..."

2. **Information Handling:**
   - ALWAYS use the search_knowledge tool to find accurate information before answering
   - ONLY share information from the knowledge base - NEVER make up details
   - If you don't have specific information, be honest and conversational: "I'm not sure about that specific detail - it would be best to reach out to CC directly" (then provide contact info)

3. **Response Length:**
   - Keep responses concise: 3-4 sentences for simple questions, max 8-10 for complex ones
   - Get to the point quickly while remaining friendly

4. **Important Restrictions:**
   - Do NOT suggest or recommend lessons at Eden School of Music (CC teaches there, but it's not offered for private students)
   - Use the knowledge base for ALL specific details (ages, pricing, locations, lesson formats, etc.)

5. **Contact Information:**
   - When directing users to contact CC: Phone/WhatsApp 085 726 7963, Email cczcy333@gmail.com, or website contact form at ccpiano.ie/contact

6. **What to Avoid:**
   - Don't list out information robotically
   - Don't say "CC offers X, Y, Z" when you can say "Yes, that's available!"
   - Don't over-reference CC - you're helping on their behalf
   - Don't fabricate information or make assumptions
   - Don't suggest Eden School of Music as a lesson option

Remember: You're a knowledgeable, friendly assistant helping people learn about piano lessons. Always search the knowledge base first, then respond naturally and genuinely!`

// Tool execution handler
function executeToolCall(toolName: string, args: any): string {
  if (toolName === 'search_knowledge') {
    const { query, topics } = args

    // If specific topics are provided, get those directly
    if (topics && topics.length > 0) {
      let results: string[] = []

      for (const topic of topics) {
        const doc = getKnowledgeByTopic(topic)
        if (doc) {
          const section = extractRelevantSection(doc.content, query, 1500)
          results.push(`## Information from ${topic}:\n\n${section}`)
        }
      }

      if (results.length > 0) {
        return results.join('\n\n---\n\n')
      }
    }

    // Otherwise, search across all knowledge
    const results = searchKnowledge(query)

    if (results.length === 0) {
      return 'No specific information found in the knowledge base for this query. You may want to suggest the user contact us directly through the website contact form for more details.'
    }

    // Return top 2 most relevant documents
    const topResults = results.slice(0, 2)
    const formattedResults = topResults.map(doc => {
      const section = extractRelevantSection(doc.content, query, 1500)
      return `## ${doc.topic}:\n\n${section}`
    })

    return formattedResults.join('\n\n---\n\n')
  }

  return 'Tool not found'
}

const aiAgentPlugin: FastifyPluginAsync = async (fastify, opts) => {
  fastify.log.info('AI Agent module loaded')

  // Initialize OpenAI client
  if (!config.ai?.apiKey) {
    fastify.log.error('AI_API_KEY not configured. AI Agent will not function properly.')
    return
  }

  // Load knowledge base
  try {
    loadKnowledgeBase()
    fastify.log.info('Knowledge base loaded successfully')
  } catch (error) {
    fastify.log.error({ err: error }, 'Failed to load knowledge base')
  }

  const openai = new OpenAI({
    apiKey: config.ai.apiKey
  })

  // AI chat endpoint
  fastify.post<{
    Body: {
      message: string
      sessionId?: string
    }
  }>('/ai/chat', async (request, reply) => {
    const { message, sessionId = 'default' } = request.body

    if (!message) {
      return reply.status(400).send({ error: 'Message is required' })
    }

    try {
      // Get or initialize chat history for this session
      let history = chatHistories.get(sessionId) || []

      // Add user message to history
      history.push({
        role: 'user',
        content: message
      })

      // Prepare messages with system prompt
      const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
        {
          role: 'system',
          content: SYSTEM_PROMPT
        },
        ...history
      ]

      // Call OpenAI with tools
      let response = await openai.chat.completions.create({
        model: config.ai?.model || 'gpt-4o-mini',
        messages,
        tools,
        tool_choice: 'auto'
      })

      let assistantMessage = response.choices[0]?.message
      if (!assistantMessage) {
        throw new Error('No response from OpenAI')
      }

      // Handle tool calls if present (with max iterations to prevent loops)
      let iterations = 0
      const maxIterations = 5

      while (assistantMessage.tool_calls && assistantMessage.tool_calls.length > 0 && iterations < maxIterations) {
        iterations++

        // Add assistant's tool call message to history
        history.push(assistantMessage)

        // Execute each tool call
        for (const toolCall of assistantMessage.tool_calls) {
          if (toolCall.type !== 'function') continue
          const toolResult = executeToolCall(
            toolCall.function.name,
            JSON.parse(toolCall.function.arguments)
          )

          // Add tool result to history
          history.push({
            role: 'tool',
            tool_call_id: toolCall.id,
            content: toolResult
          })
        }

        // Get next response from the model
        const messagesWithTools: OpenAI.Chat.ChatCompletionMessageParam[] = [
          {
            role: 'system',
            content: SYSTEM_PROMPT
          },
          ...history
        ]

        response = await openai.chat.completions.create({
          model: config.ai?.model || 'gpt-4o-mini',
          messages: messagesWithTools,
          tools,
          tool_choice: 'auto'
        })

        assistantMessage = response.choices[0]?.message
        if (!assistantMessage) {
          throw new Error('No response from OpenAI')
        }
      }

      // Add final assistant response to history
      history.push({
        role: 'assistant',
        content: assistantMessage.content || ''
      })

      // Trim history to max length (keep most recent messages)
      if (history.length > MAX_HISTORY_LENGTH) {
        history = history.slice(-MAX_HISTORY_LENGTH)
      }

      // Save updated history
      chatHistories.set(sessionId, history)

      return {
        message: assistantMessage.content,
        sessionId
      }
    } catch (error: any) {
      fastify.log.error(error)
      return reply.status(500).send({
        error: 'Failed to process chat message',
        details: error.message
      })
    }
  })

  // AI chat streaming endpoint
  fastify.post<{
    Body: {
      message: string
      sessionId?: string
    }
  }>('/ai/chat/stream', async (request, reply) => {
    const { message, sessionId = 'default' } = request.body

    fastify.log.info({ message, sessionId }, 'Received streaming chat request')

    if (!message) {
      return reply.status(400).send({ error: 'Message is required' })
    }

    try {
      // Set headers for Server-Sent Events
      reply.raw.setHeader('Content-Type', 'text/event-stream')
      reply.raw.setHeader('Cache-Control', 'no-cache')
      reply.raw.setHeader('Connection', 'keep-alive')
      reply.raw.setHeader('Access-Control-Allow-Origin', '*')
      reply.raw.setHeader('Access-Control-Allow-Credentials', 'true')

      // Get or initialize chat history for this session
      let history = chatHistories.get(sessionId) || []

      // Add user message to history
      history.push({
        role: 'user',
        content: message
      })

      // Prepare messages with system prompt
      const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
        {
          role: 'system',
          content: SYSTEM_PROMPT
        },
        ...history
      ]

      fastify.log.info('Calling OpenAI API for tool calls check')

      // Call OpenAI with tools (non-streaming first to handle tool calls)
      let response = await openai.chat.completions.create({
        model: config.ai?.model || 'gpt-4o-mini',
        messages,
        tools,
        tool_choice: 'auto'
      })

      let assistantMessage = response.choices[0]?.message
      if (!assistantMessage) {
        throw new Error('No response from OpenAI')
      }

      // Handle tool calls if present
      let iterations = 0
      const maxIterations = 5

      while (assistantMessage.tool_calls && assistantMessage.tool_calls.length > 0 && iterations < maxIterations) {
        iterations++
        fastify.log.info({ iteration: iterations, toolCalls: assistantMessage.tool_calls.length }, 'Processing tool calls')

        // Add assistant's tool call message to history
        history.push(assistantMessage)

        // Execute each tool call
        for (const toolCall of assistantMessage.tool_calls) {
          if (toolCall.type !== 'function') continue
          
          fastify.log.info({ toolName: toolCall.function.name }, 'Executing tool call')
          
          const toolResult = executeToolCall(
            toolCall.function.name,
            JSON.parse(toolCall.function.arguments)
          )

          // Add tool result to history
          history.push({
            role: 'tool',
            tool_call_id: toolCall.id,
            content: toolResult
          })
        }

        // Get next response from the model (check if more tool calls needed)
        const messagesWithTools: OpenAI.Chat.ChatCompletionMessageParam[] = [
          {
            role: 'system',
            content: SYSTEM_PROMPT
          },
          ...history
        ]

        response = await openai.chat.completions.create({
          model: config.ai?.model || 'gpt-4o-mini',
          messages: messagesWithTools,
          tools,
          tool_choice: 'auto'
        })

        assistantMessage = response.choices[0]?.message
        if (!assistantMessage) {
          throw new Error('No response from OpenAI')
        }
      }

      // If the last response has content (no more tool calls), we need to make a streaming call
      // Don't just send the existing content - that won't actually stream
      fastify.log.info('Making streaming call to OpenAI for final response')
      
      const streamMessages: OpenAI.Chat.ChatCompletionMessageParam[] = [
        {
          role: 'system',
          content: SYSTEM_PROMPT
        },
        ...history
      ]

      const stream = await openai.chat.completions.create({
        model: config.ai?.model || 'gpt-4o-mini',
        messages: streamMessages,
        stream: true
      })

      let fullContent = ''

      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content || ''
        if (content) {
          fullContent += content
          // Send SSE event
          reply.raw.write(`data: ${JSON.stringify({ content })}\n\n`)
        }
      }

      // Add final assistant response to history
      history.push({
        role: 'assistant',
        content: fullContent
      })

      // Trim history to max length
      if (history.length > MAX_HISTORY_LENGTH) {
        history = history.slice(-MAX_HISTORY_LENGTH)
      }

      // Save updated history
      chatHistories.set(sessionId, history)

      fastify.log.info('Streaming complete')

      // Send final event
      reply.raw.write(`data: ${JSON.stringify({ done: true, sessionId })}\n\n`)
      reply.raw.end()
    } catch (error: any) {
      fastify.log.error({ 
        error: error.message, 
        stack: error.stack,
        sessionId,
        message 
      }, 'Error in streaming chat endpoint')
      
      try {
        reply.raw.write(`data: ${JSON.stringify({ error: 'Failed to process chat message', details: error.message })}\n\n`)
        reply.raw.end()
      } catch (writeError) {
        fastify.log.error({ error: writeError }, 'Failed to write error response')
      }
    }
  })

  // Clear chat history endpoint
  fastify.delete<{
    Params: {
      sessionId: string
    }
  }>('/ai/chat/:sessionId', async (request, reply) => {
    const { sessionId } = request.params
    chatHistories.delete(sessionId)
    return { success: true }
  })
}

export default fp(aiAgentPlugin, {
  name: 'ai-agent-module',
  decorators: {
    fastify: []
  }
})
