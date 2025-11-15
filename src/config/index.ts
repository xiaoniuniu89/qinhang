import type { AppConfig } from '../shared/types/config.js'

// Helper to parse boolean from env
const parseBool = (value: string | undefined, defaultValue: boolean): boolean => {
  if (!value) return defaultValue
  return value.toLowerCase() === 'true' || value === '1'
}

const aiConfig = process.env.AI_API_KEY ? {
  provider: (process.env.AI_PROVIDER as 'openai' | 'anthropic') || 'openai',
  ...(process.env.AI_API_KEY && { apiKey: process.env.AI_API_KEY }),
  ...(process.env.AI_MODEL && { model: process.env.AI_MODEL })
} as const : undefined

const vectorDbConfig = process.env.VECTOR_DB_URL ? {
  type: (process.env.VECTOR_DB_TYPE as 'chromadb' | 'pinecone' | 'qdrant') || 'chromadb',
  ...(process.env.VECTOR_DB_URL && { url: process.env.VECTOR_DB_URL }),
  ...(process.env.VECTOR_DB_API_KEY && { apiKey: process.env.VECTOR_DB_API_KEY })
} as const : undefined

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
    ...(process.env.DATABASE_URL && { url: process.env.DATABASE_URL }),
    ...(process.env.DB_FILENAME && { filename: process.env.DB_FILENAME })
  },

  // Storage - default to local filesystem
  storage: {
    type: (process.env.STORAGE_TYPE as 'local' | 's3') || 'local',
    ...(process.env.STORAGE_PATH && { localPath: process.env.STORAGE_PATH }),
    ...(process.env.S3_BUCKET && { s3Bucket: process.env.S3_BUCKET }),
    ...(process.env.S3_REGION && { s3Region: process.env.S3_REGION }),
    ...(process.env.MAX_FILE_SIZE && { maxFileSize: Number(process.env.MAX_FILE_SIZE) })
  },

  // AI configuration (optional)
  ...(aiConfig && { ai: aiConfig }),

  // Vector DB configuration (optional)
  ...(vectorDbConfig && { vectorDb: vectorDbConfig })
}
