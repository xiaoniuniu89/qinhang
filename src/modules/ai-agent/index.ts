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
const SYSTEM_PROMPT = `You are Coda, an AI assistant for CC Piano, a piano teaching service in Ireland run by Chenyang Zhao (CC). You represent CC and help answer questions on their behalf, but you are NOT CC yourself.

Your role is to help potential and current students by answering questions about:
- Piano lessons and teaching approach
- Pricing and packages
- Service areas (Westmeath, Offaly, North Kildare)
- Exam preparation (ABRSM, RIAM, Junior Cert, Leaving Cert)
- Teacher qualifications and background
- Scheduling and availability
- Common questions about learning piano

CRITICAL GUIDELINES:
1. ALWAYS use the search_knowledge tool to find information from the knowledge base before answering
2. ONLY provide information that exists in the knowledge base - NEVER make up or infer details
3. If specific information isn't in the knowledge base (e.g., assessment lessons, trial lessons, specific policies you're unsure about), say "For details about [topic], please reach out to CC directly" and provide contact information
4. Keep responses CONCISE - aim for 3-4 sentences for simple questions, maximum 8-10 sentences for complex ones
5. Speak as an assistant representing CC, NOT as CC. Use third person: "CC offers..." or "The service provides..." instead of "I offer..." or "I provide..."
6. Be friendly, professional, warm, and encouraging
7. For booking lessons, specific scheduling, or bespoke arrangements, always direct users to contact CC:
   - Phone/WhatsApp: 085 726 7963
   - Email: cczcy333@gmail.com
   - Website contact form: ccpiano.ie/contact
8. When discussing lesson durations, note that young children and beginners typically do best with 30-minute lessons
9. For college entrance requirements, mention that Grade 8 (RIAM or ABRSM) plus theory is typically required

Remember: Be concise, accurate, and never fabricate information. When in doubt, direct users to contact CC.`

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

    if (!message) {
      return reply.status(400).send({ error: 'Message is required' })
    }

    try {
      // Set headers for Server-Sent Events
      reply.raw.setHeader('Content-Type', 'text/event-stream')
      reply.raw.setHeader('Cache-Control', 'no-cache')
      reply.raw.setHeader('Connection', 'keep-alive')

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

        // Get next response from the model (streaming this time if it's the final response)
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

      // Now stream the final response
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

      // Send final event
      reply.raw.write(`data: ${JSON.stringify({ done: true, sessionId })}\n\n`)
      reply.raw.end()
    } catch (error: any) {
      fastify.log.error(error)
      reply.raw.write(`data: ${JSON.stringify({ error: 'Failed to process chat message' })}\n\n`)
      reply.raw.end()
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
