# Qinhang - Piano Teacher Platform

A modular, self-hosted backend platform for piano teachers to manage their teaching business. Built with Fastify and TypeScript.

## Architecture Overview

Qinhang is designed as a **modular, self-hosted application** that can be licensed and deployed by individual piano teachers. Each module can be enabled or disabled based on the teacher's needs.

### Modules

- **Blog** - Create and manage blog posts and articles
- **AI Agent** - AI-powered chat assistant for students
- **Media Hosting** - Host and share music sheets (PDFs), video lessons, and audio files
- **Scheduling** - Class booking and calendar management
- **RAG** - Retrieval Augmented Generation for intelligent content search

### Technology Stack

- **Runtime**: Node.js with TypeScript
- **Framework**: Fastify (high-performance web framework)
- **Database**: SQLite (default) or PostgreSQL
- **Storage**: Local filesystem (default) or S3-compatible storage
- **AI Integration**: OpenAI or Anthropic (optional)
- **Vector Database**: ChromaDB, Pinecone, or Qdrant (optional, for RAG)

## Project Structure

```
qinhang/
├── src/
│   ├── config/              # Application configuration
│   ├── modules/             # Feature modules (plugins)
│   │   ├── blog/
│   │   ├── ai-agent/
│   │   ├── media-hosting/
│   │   ├── scheduling/
│   │   └── rag/
│   ├── shared/              # Shared utilities and types
│   │   ├── database/
│   │   ├── storage/
│   │   ├── types/
│   │   └── utils/
│   └── index.ts            # Application entry point
├── .env.example            # Environment configuration template
└── package.json
```

## Getting Started

### Installation

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```

3. Copy the environment template:
   ```bash
   cp .env.example .env
   ```

4. Edit `.env` to configure your modules and settings

### Development

Run the development server with hot reload:
```bash
npm run dev
```

### Production

Build and run the production server:
```bash
npm run build
npm start
```

## Configuration

All configuration is done via environment variables (see `.env.example`).

### Module Toggles

Enable or disable modules by setting these to `true` or `false`:

```env
MODULE_BLOG=true
MODULE_AI_AGENT=true
MODULE_MEDIA_HOSTING=true
MODULE_SCHEDULING=true
MODULE_RAG=true
```

### Database

**SQLite** (default, easier for self-hosting):
```env
DB_TYPE=sqlite
DB_FILENAME=./data/qinhang.db
```

**PostgreSQL** (for production):
```env
DB_TYPE=postgres
DATABASE_URL=postgresql://user:password@localhost:5432/qinhang
```

### Storage

**Local filesystem** (default):
```env
STORAGE_TYPE=local
STORAGE_PATH=./uploads
```

**S3-compatible** (for cloud storage):
```env
STORAGE_TYPE=s3
S3_BUCKET=your-bucket-name
S3_REGION=us-east-1
```

## Module Details

### Blog Module
Routes:
- `GET /blog` - List all blog posts
- `GET /blog/:id` - Get single blog post
- (Future: POST, PUT, DELETE for management)

### AI Agent Module

**Status**: ✅ Implemented

Routes:
- `POST /ai/chat` - Chat with AI assistant
  - Request body: `{ message: string, sessionId?: string }`
  - Response: `{ message: string, sessionId: string }`
- `DELETE /ai/chat/:sessionId` - Clear chat history for a session

Features:
- ✅ OpenAI GPT-4o-mini integration
- ✅ Chat memory with 20 message limit per session
- ✅ Function calling / Tools support
- ✅ Built-in tool: `get_lesson_info` (pricing, availability, general info)
- ✅ Session-based conversation history (in-memory)

Requires: `AI_API_KEY` environment variable

Example request:
```bash
curl -X POST http://localhost:3000/ai/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "What are your lesson prices?", "sessionId": "user-123"}'
```

### Media Hosting Module
Routes:
- `GET /media` - List media files
- `POST /media/upload` - Upload media
- `GET /media/:id` - Download/stream media

### Scheduling Module
Routes:
- `GET /schedule/availability` - Get available time slots
- `POST /schedule/book` - Book a class
- `GET /schedule/bookings` - List bookings

### RAG Module
Routes:
- `POST /rag/search` - Semantic search
- `POST /rag/index` - Index new content

Requires: `VECTOR_DB_URL` environment variable

## API Documentation

Visit `http://localhost:3000/` to see the health check endpoint with enabled modules.

## Future Features

- Database migrations and ORM integration
- Authentication and authorization
- Admin dashboard
- Email notifications
- Payment processing
- Multi-language support
- Integration guides for common hosting providers

## License

Proprietary - Licensed for self-hosting by individual customers
