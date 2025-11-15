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

Your role is to help potential and current students by answering questions about:
- Piano lessons and teaching approach
- Pricing and packages
- Service areas (Westmeath, Offaly, North Kildare)
- Exam preparation (ABRSM, RIAM, Junior Cert, Leaving Cert)
- Teacher qualifications and background
- Scheduling and availability
- Common questions about learning piano

IMPORTANT GUIDELINES:
1. Use the search_knowledge tool to find accurate, detailed information from the knowledge base
2. Be friendly, professional, warm, and encouraging
3. Provide specific details when available (prices, locations, exam boards, contact information)
4. If information isn't in the knowledge base, politely indicate that and offer to help the user contact CC directly
5. For booking lessons, specific scheduling, or bespoke arrangements, provide CC's contact details:
   - Phone: 0857267963
   - Email: cczcy333@gmail.com
   - WhatsApp: 0857267963
   - Website contact form: ccpiano.ie/contact
6. Be enthusiastic about music education while remaining professional
7. When discussing lesson durations, remember young children and beginners typically do best with 30-minute lessons
8. For college entrance requirements, emphasize that Grade 8 (RIAM or ABRSM) plus theory is typically required

Remember: You have access to comprehensive information about the piano teaching service. Use the search_knowledge tool frequently to provide accurate, detailed answers.`

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
