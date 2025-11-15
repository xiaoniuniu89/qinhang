import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Knowledge base storage
interface KnowledgeDocument {
  filename: string
  topic: string
  content: string
  keywords: string[]
}

let knowledgeBase: KnowledgeDocument[] = []

// Map of topics to knowledge files and their keywords
const knowledgeMap = {
  'teacher.md': {
    topic: 'teacher',
    keywords: ['teacher', 'chenyang', 'zhao', 'cc', 'experience', 'qualifications', 'education', 'background', 'beijing', 'china', 'teaching style', 'about', 'who']
  },
  'pricing.md': {
    topic: 'pricing',
    keywords: ['price', 'cost', 'fee', 'payment', 'how much', 'expensive', 'cheap', 'rate', 'package', 'discount', 'family', 'bulk', 'trial']
  },
  'areas.md': {
    topic: 'areas',
    keywords: ['area', 'location', 'where', 'kinnegad', 'mullingar', 'killucan', 'westmeath', 'offaly', 'tullamore', 'edenderry', 'kildare', 'maynooth', 'celbridge', 'lucan', 'service area', 'cover']
  },
  'exams.md': {
    topic: 'exams',
    keywords: ['exam', 'abrsm', 'riam', 'grade', 'test', 'junior cert', 'leaving cert', 'certificate', 'school', 'examination', 'board', 'qualification']
  },
  'lessons.md': {
    topic: 'lessons',
    keywords: ['lesson', 'class', 'teaching', 'beginner', 'intermediate', 'advanced', 'age', 'children', 'adult', 'family', 'group', 'accompaniment', 'type', 'format', 'duration', 'long']
  },
  'schedule.md': {
    topic: 'schedule',
    keywords: ['schedule', 'availability', 'available', 'when', 'time', 'day', 'weekday', 'weekend', 'saturday', 'sunday', 'booking', 'appointment', 'free']
  },
  'faq.md': {
    topic: 'faq',
    keywords: ['question', 'faq', 'help', 'how', 'what', 'why', 'practice', 'piano', 'start', 'getting started']
  }
}

/**
 * Load all knowledge base files into memory
 */
export function loadKnowledgeBase(): void {
  const knowledgeDir = path.join(__dirname, '../../../knowledge')

  knowledgeBase = []

  for (const [filename, metadata] of Object.entries(knowledgeMap)) {
    const filePath = path.join(knowledgeDir, filename)

    try {
      if (fs.existsSync(filePath)) {
        const content = fs.readFileSync(filePath, 'utf-8')

        knowledgeBase.push({
          filename,
          topic: metadata.topic,
          content,
          keywords: metadata.keywords
        })
      }
    } catch (error) {
      console.error(`Failed to load knowledge file ${filename}:`, error)
    }
  }

  console.log(`Knowledge base loaded: ${knowledgeBase.length} documents`)
}

/**
 * Search knowledge base for relevant documents
 */
export function searchKnowledge(query: string): KnowledgeDocument[] {
  const queryLower = query.toLowerCase()
  const queryWords = queryLower.split(/\s+/)

  // Score each document based on keyword matches
  const scored = knowledgeBase.map(doc => {
    let score = 0

    // Check if any keywords match query words
    for (const keyword of doc.keywords) {
      for (const word of queryWords) {
        if (keyword.includes(word) || word.includes(keyword)) {
          score += 2
        }
      }

      // Check if keyword is in the full query
      if (queryLower.includes(keyword)) {
        score += 1
      }
    }

    // Check if query words appear in the content
    for (const word of queryWords) {
      if (word.length > 3 && doc.content.toLowerCase().includes(word)) {
        score += 0.5
      }
    }

    return { doc, score }
  })

  // Return documents with score > 0, sorted by score
  return scored
    .filter(item => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .map(item => item.doc)
}

/**
 * Get a specific knowledge document by topic
 */
export function getKnowledgeByTopic(topic: string): KnowledgeDocument | undefined {
  return knowledgeBase.find(doc => doc.topic === topic)
}

/**
 * Get all available topics
 */
export function getAllTopics(): string[] {
  return knowledgeBase.map(doc => doc.topic)
}

/**
 * Extract a relevant section from a document based on query
 */
export function extractRelevantSection(content: string, query: string, maxLength: number = 2000): string {
  const queryLower = query.toLowerCase()
  const lines = content.split('\n')

  // Find the most relevant section
  let bestSection = ''
  let bestScore = 0

  // Try to find a section that contains query terms
  for (let i = 0; i < lines.length; i++) {
    const section = lines.slice(i, Math.min(i + 30, lines.length)).join('\n')

    if (section.length > maxLength) continue

    // Score this section
    let score = 0
    const sectionLower = section.toLowerCase()

    for (const word of queryLower.split(/\s+/)) {
      if (word.length > 3 && sectionLower.includes(word)) {
        score += 1
      }
    }

    if (score > bestScore) {
      bestScore = score
      bestSection = section
    }
  }

  // If we found a good section, return it
  if (bestScore > 0 && bestSection) {
    return bestSection
  }

  // Otherwise return the beginning of the document
  return content.substring(0, maxLength)
}
