import type { AppConfig } from '../shared/types/config.js'

// Helper to parse boolean from env
const parseBool = (value: string | undefined, defaultValue: boolean): boolean => {
  if (!value) return defaultValue
  return value.toLowerCase() === 'true' || value === '1'
}

export const config: AppConfig = {
  // Server
  port: Number(process.env.PORT) || 3000,
  host: process.env.HOST || '0.0.0.0',
  env: (process.env.NODE_ENV as AppConfig['env']) || 'development',

  // Module toggles - all enabled by default for development
  modules: {
    blog: parseBool(process.env.MODULE_BLOG, true),
    aiAgent: parseBool(process.env.MODULE_AI_AGENT, true),
    mediaHosting: parseBool(process.env.MODULE_MEDIA_HOSTING, true),
    scheduling: parseBool(process.env.MODULE_SCHEDULING, true),
    rag: parseBool(process.env.MODULE_RAG, true)
  },

  // Database - default to SQLite for easier self-hosting
  database: {
    type: (process.env.DB_TYPE as 'postgres' | 'sqlite') || 'sqlite',
    url: process.env.DATABASE_URL,
    filename: process.env.DB_FILENAME || './data/qinhang.db'
  },

  // Storage - default to local filesystem
  storage: {
    type: (process.env.STORAGE_TYPE as 'local' | 's3') || 'local',
    localPath: process.env.STORAGE_PATH || './uploads',
    s3Bucket: process.env.S3_BUCKET,
    s3Region: process.env.S3_REGION || 'us-east-1',
    maxFileSize: Number(process.env.MAX_FILE_SIZE) || 100 // 100MB default
  },

  // AI configuration (optional)
  ai: process.env.AI_API_KEY ? {
    provider: (process.env.AI_PROVIDER as 'openai' | 'anthropic') || 'openai',
    apiKey: process.env.AI_API_KEY,
    model: process.env.AI_MODEL || 'gpt-4'
  } : undefined,

  // Vector DB configuration (optional)
  vectorDb: process.env.VECTOR_DB_URL ? {
    type: (process.env.VECTOR_DB_TYPE as 'chromadb' | 'pinecone' | 'qdrant') || 'chromadb',
    url: process.env.VECTOR_DB_URL,
    apiKey: process.env.VECTOR_DB_API_KEY
  } : undefined
}
