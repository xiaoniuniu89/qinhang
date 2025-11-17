export interface AppConfig {
  port: number
  host: string
  env: 'development' | 'production' | 'test'

  // Module toggles - enable/disable features
  modules: {
    blog: boolean
    aiAgent: boolean
    mediaHosting: boolean
    scheduling: boolean
    rag: boolean
  }

  // Database configuration
  database: {
    type: 'postgres' | 'sqlite'
    url?: string
    filename?: string
  }

  // File storage configuration
  storage: {
    type: 'local' | 's3'
    localPath?: string
    s3Bucket?: string
    s3Region?: string
    maxFileSize?: number // in MB
  }

  // AI configuration (for AI agent and RAG)
  ai?: {
    provider: 'openai' | 'anthropic'
    apiKey?: string
    model?: string
  }

  // RAG vector database
  vectorDb?: {
    type: 'chromadb' | 'pinecone' | 'qdrant'
    url?: string
    apiKey?: string
  }

  // Google Calendar API configuration
  google?: {
    credentials?: any // Google service account credentials JSON
    calendarId?: string // Google Calendar ID to check for availability
  }

  // Gmail SMTP configuration
  gmail?: {
    email: string // Gmail address (e.g., cczcy333@gmail.com)
    password: string // Gmail app password (not regular password!)
    teacherEmail?: string // Email address to send contact forms and bookings to
    emailFrom?: string // From name/address for emails
  }
}
