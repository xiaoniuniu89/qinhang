# Qinhang Backend - Claude Instructions

## Quick Reference

**Technology**: Fastify 5.6 + TypeScript 5.9 + Node.js 18.x
**Purpose**: Modular, self-hosted backend platform for piano teachers
**Architecture**: Plugin-based modules that can be enabled/disabled
**Port**: 3000 (default)

## Project Structure

```
qinhang/
├── src/
│   ├── config/              # Application configuration
│   │   └── env.ts          # Environment variable parsing
│   ├── core/               # Core application logic
│   ├── modules/            # Feature modules (Fastify plugins)
│   │   ├── ai-agent/       # ✅ OpenAI chat assistant
│   │   ├── blog/           # Blog post management
│   │   ├── contact/        # Contact form handling
│   │   ├── file-hosting/   # File upload/download
│   │   ├── gmail/          # Gmail API integration
│   │   ├── google-calendar/ # Google Calendar integration
│   │   ├── media-hosting/  # Media file management
│   │   ├── rag/            # Retrieval Augmented Generation
│   │   ├── scheduling/     # Class booking system
│   │   └── session/        # Session management
│   ├── plugins/            # Shared Fastify plugins
│   ├── shared/             # Shared utilities and types
│   ├── utils/              # Utility functions
│   └── index.ts           # Application entry point
├── data/                   # SQLite database (if used)
├── knowledge/              # Knowledge base for RAG
├── dist/                   # Compiled TypeScript output
└── Configuration files (see below)
```

## Technology Stack Details

### Core Dependencies
- **Fastify 5.6.2** - High-performance web framework
- **TypeScript 5.9.3** - Type safety
- **dotenv 17.2.3** - Environment variable management

### Fastify Plugins
- **@fastify/cors 11.1.0** - CORS support
- **@fastify/rate-limit 10.3.0** - Rate limiting
- **fastify-plugin 5.1.0** - Plugin utilities

### Integrations
- **googleapis 166.0.0** - Google Calendar, Gmail APIs
- **openai 6.9.0** - AI chat assistant
- **nodemailer 7.0.10** - Email sending

### Development Tools
- **tsx 4.20.6** - TypeScript execution and watch mode
- **@types/node** - Node.js type definitions
- **@types/nodemailer** - Nodemailer type definitions

## Key Configuration Files

### package.json
```json
{
  "scripts": {
    "dev": "tsx watch src/index.ts",      // Development with hot reload
    "build": "tsc",                        // Compile TypeScript
    "start": "node dist/index.js",         // Production server
    "heroku-postbuild": "npm run build"    // Heroku deployment
  },
  "engines": {
    "node": "18.x"                         // Required Node version
  }
}
```

### tsconfig.json
TypeScript configuration:
- Target: ES2020
- Module: ES2020
- Output: `dist/`
- Strict mode enabled

### .env.example
Complete environment variable template with:
- Module toggles
- Google OAuth credentials
- OpenAI API keys
- Email configuration
- Database settings

### Procfile
Heroku deployment configuration:
```
web: node dist/index.js
```

## Module System Architecture

### How Modules Work

Each module is a **Fastify plugin** that can be:
1. Enabled/disabled via environment variables
2. Registered conditionally in `src/index.ts`
3. Independently developed and tested

### Module Structure Pattern

```
src/modules/[module-name]/
├── index.ts           # Plugin registration
├── routes.ts          # Route handlers
├── service.ts         # Business logic
└── types.ts           # TypeScript interfaces
```

### Module Registration (src/index.ts)

```typescript
// Check if module is enabled
if (process.env.MODULE_AI_AGENT === 'true') {
  await app.register(aiAgentModule)
}
```

## Implemented Modules

### 1. AI Agent Module (ai-agent/)

**Status**: ✅ Fully Implemented (with MCP-UI Integration)
**Environment Variables**:
- `MODULE_AI_AGENT=true` - Enable module
- `AI_API_KEY=sk-...` - OpenAI API key

**Routes**:
```
POST /ai/chat
  Body: { message: string, sessionId?: string }
  Response: {
    message: string,
    sessionId: string,
    messagesRemaining: number,
    uiResources?: UIResource[] // Interactive UI components
  }

DELETE /ai/chat/:sessionId
  Response: { message: string }
```

**Features**:
- OpenAI GPT-4o-mini integration
- Chat memory (20 messages per session)
- Function calling / Tools support
- **NEW: MCP-UI Interactive Components** - Returns clickable buttons instead of just text
- Built-in tools:
  - `search_knowledge` - Search knowledge base
  - `check_calendar_availability` - Check real-time availability
  - `send_booking_inquiry` - Email booking inquiries to teacher
  - **`show_contact_buttons`** - Display Email & WhatsApp buttons
  - **`show_email_form`** - Display interactive contact form
  - **`show_pricing_table`** - Display pricing with "Book Now" buttons
- Session-based conversation history (in-memory)

**System Prompt**:
Configured as helpful piano teacher assistant for CC Piano (Westmeath, Ireland).

**Example Usage**:
```bash
curl -X POST http://localhost:3000/ai/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "What are your lesson prices?", "sessionId": "user-123"}'
```

### 2. Contact Module (contact/)

**Status**: ✅ Implemented
**Purpose**: Handle contact form submissions

**Routes**:
```
POST /contact
  Body: { name: string, email: string, message: string }
```

### 3. Gmail Module (gmail/)

**Status**: ✅ Implemented
**Purpose**: Send emails via Gmail API

**Environment Variables**:
- `GMAIL_USER` - Gmail account
- `GMAIL_APP_PASSWORD` - App-specific password
- `GOOGLE_CLIENT_ID` - OAuth client ID
- `GOOGLE_CLIENT_SECRET` - OAuth client secret

**Integration**: Works with contact module to send notifications

### 4. Google Calendar Module (google-calendar/)

**Status**: ✅ Implemented
**Purpose**: Sync lesson bookings with Google Calendar

**Environment Variables**:
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `GOOGLE_CALENDAR_ID` - Calendar to use

### 5. Session Module (session/)

**Status**: ✅ Implemented
**Purpose**: Manage AI chat sessions and conversation history

**Storage**: In-memory (resets on server restart)

### 6. Blog Module (blog/)

**Status**: ⚠️ Partially Implemented
**Purpose**: Create and manage blog posts

### 7. File Hosting Module (file-hosting/)

**Status**: 🔨 In Development
**Purpose**: Upload and download files

### 8. Media Hosting Module (media-hosting/)

**Status**: 🔨 In Development
**Purpose**: Host music sheets (PDFs), video lessons, audio files

### 9. Scheduling Module (scheduling/)

**Status**: 🔨 In Development
**Purpose**: Class booking and calendar management

### 10. RAG Module (rag/)

**Status**: 🔨 In Development
**Purpose**: Retrieval Augmented Generation for intelligent search
**Dependencies**: Vector database (ChromaDB, Pinecone, or Qdrant)

## Core Application (src/index.ts)

### Server Configuration

```typescript
import Fastify from 'fastify'

const app = Fastify({
  logger: true,              // Fastify built-in logging
  trustProxy: true,          // For Heroku/production
  requestIdHeader: 'x-request-id'
})

// CORS configuration
await app.register(cors, {
  origin: ['https://ccpiano.ie', 'http://localhost:5173']
})

// Rate limiting
await app.register(rateLimit, {
  max: 100,                  // Max 100 requests
  timeWindow: '15 minutes'   // Per 15 minutes
})
```

### Health Check Route

```
GET /
Response: {
  message: "Qinhang API",
  modules: ["ai-agent", "contact", "gmail", ...]
}
```

## Environment Configuration

### Required Variables

```env
# Server
PORT=3000
NODE_ENV=production

# Google OAuth (for Gmail + Calendar)
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-secret
GOOGLE_REDIRECT_URI=http://localhost:3000/oauth/callback

# Gmail
GMAIL_USER=your-email@gmail.com
GMAIL_APP_PASSWORD=your-16-char-app-password

# OpenAI (for AI Agent)
AI_API_KEY=sk-...

# Module Toggles
MODULE_AI_AGENT=true
MODULE_BLOG=false
MODULE_CONTACT=true
MODULE_GMAIL=true
MODULE_GOOGLE_CALENDAR=true
```

### Optional Variables

```env
# Database (future)
DB_TYPE=sqlite
DB_FILENAME=./data/qinhang.db

# Or PostgreSQL
DB_TYPE=postgres
DATABASE_URL=postgresql://user:password@localhost:5432/qinhang

# Storage (future)
STORAGE_TYPE=local
STORAGE_PATH=./uploads

# Or S3-compatible
STORAGE_TYPE=s3
S3_BUCKET=your-bucket-name
S3_REGION=us-east-1
```

## MCP-UI Integration (Interactive Chat Components)

### Overview

The AI agent can return **interactive UI components** instead of just text responses. This creates a much better user experience:

**Before (Text Only)**:
```
User: "How can I contact you?"
AI: "You can email us at ccpiano@example.com or WhatsApp at +353 85 726 7963"
```

**After (Interactive Buttons)**:
```
User: "How can I contact you?"
AI: "Here are some quick ways to get in touch:"
[📝 Visit Contact Page Button] [💬 Message on WhatsApp Button]
```
(WhatsApp button includes conversation summary if chat history exists)

### UI Resources Architecture

**Backend** (`qinhang/src/shared/ui-resources/`):
- `business-config.ts` - Multi-tenant configuration system
- `factory.ts` - UI resource factory for creating interactive components

**AI Tools** (`qinhang/src/modules/ai-agent/ui-tools.ts`):
- `show_contact_buttons` - Contact Page & WhatsApp buttons (WhatsApp auto-includes conversation summary)
- `show_pricing_table` - Pricing with "Book Now" buttons
- `initiate_booking` - Triggered when user clicks "Book Now"
- `show_email_form` - Interactive contact form (rarely used)
- `send_contact_email` - Handles form submission

**Main Booking Flow**:
- AI shows contact buttons when user asks how to contact
- AI can mention: "You can email CC at cczcy333@gmail.com, or give me your details and I'll send CC a message"
- When user provides details, AI uses `send_booking_inquiry` tool (from main tools) to email CC

### Creating New UI Resources

**1. Add a new UI template in `factory.ts`:**

```typescript
createMyCustomUI(options: UIResourceOptions = {}) {
  const { locale = 'en' } = options
  const { contact, theme } = this.config

  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <style>
        /* Your styles here - use theme.primaryColor */
      </style>
    </head>
    <body>
      <button onclick="handleAction()">Click Me</button>

      <script>
        function handleAction() {
          window.parent.postMessage({
            type: 'tool',
            payload: {
              toolName: 'my_custom_action',
              params: { ... }
            }
          }, '*');
        }
      </script>
    </body>
    </html>
  `

  return createUIResource({
    uri: `ui://my-custom/${Date.now()}`,
    content: { type: 'rawHtml', htmlString: htmlContent },
    encoding: 'text',
    metadata: {
      title: 'My Custom UI',
      description: 'Description for this UI'
    }
  })
}
```

**2. Add corresponding tool in `ui-tools.ts`:**

```typescript
export const uiTools: OpenAI.Chat.ChatCompletionTool[] = [
  // ... existing tools
  {
    type: 'function',
    function: {
      name: 'show_my_custom_ui',
      description: 'When to show this UI...',
      parameters: {
        type: 'object',
        properties: {
          locale: { type: 'string', enum: ['en', 'zh'] }
        }
      }
    }
  }
]

// In executeUITool function:
if (toolName === 'show_my_custom_ui') {
  const uiResource = factory.createMyCustomUI({ locale })
  return {
    text: 'Here is my custom UI:',
    uiResource
  }
}
```

**3. Update AI system prompt** to guide when to use the new tool.

### Multi-Tenant Configuration

The system is designed to support multiple teachers/schools via `business-config.ts`:

```typescript
// Current: Single config loaded from environment variables
export const defaultBusinessConfig: BusinessConfig = {
  contact: {
    email: process.env.BUSINESS_EMAIL || 'ccpiano@example.com',
    whatsapp: { number: process.env.WHATSAPP_NUMBER || '353857267963' }
  },
  pricing: {
    individual: { price: Number(process.env.PRICE_INDIVIDUAL) || 40 }
  },
  theme: {
    primaryColor: process.env.THEME_PRIMARY_COLOR || '#4CAF50'
  }
}

// Future: Load from database based on tenant ID
export function getBusinessConfig(tenantId?: string): BusinessConfig {
  // Could query database here
  return defaultBusinessConfig
}
```

**Environment Variables for Configuration**:
```env
# Business Info
BUSINESS_NAME=CC Piano
BUSINESS_EMAIL=ccpiano@example.com
WHATSAPP_NUMBER=353857267963

# Pricing
PRICE_INDIVIDUAL=40
PRICE_GROUP=25
PRICING_CURRENCY=EUR

# Theme
THEME_PRIMARY_COLOR=#4CAF50
THEME_SECONDARY_COLOR=#45a049
BRAND_NAME=CODA
```

## Development Workflow

### Local Development

```bash
# Install dependencies
npm install

# Create environment file
cp .env.example .env
# Edit .env with your credentials

# Start development server
npm run dev

# Server runs at http://localhost:3000 with hot reload
```

### Building for Production

```bash
npm run build
# Compiles TypeScript to dist/

npm start
# Runs compiled JavaScript
```

### Testing Endpoints

```bash
# Health check
curl http://localhost:3000/

# AI chat
curl -X POST http://localhost:3000/ai/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "Hello", "sessionId": "test-123"}'

# Contact form
curl -X POST http://localhost:3000/contact \
  -H "Content-Type: application/json" \
  -d '{"name": "Test", "email": "test@example.com", "message": "Hello"}'
```

## Adding a New Module

### Step-by-step Guide

**1. Create module directory:**
```bash
mkdir -p src/modules/my-module
```

**2. Create module files:**

**src/modules/my-module/index.ts:**
```typescript
import fp from 'fastify-plugin'
import { FastifyInstance } from 'fastify'
import { myModuleRoutes } from './routes'

async function myModulePlugin(app: FastifyInstance) {
  // Register routes
  app.register(myModuleRoutes, { prefix: '/my-module' })
}

export default fp(myModulePlugin, {
  name: 'my-module'
})
```

**src/modules/my-module/routes.ts:**
```typescript
import { FastifyInstance } from 'fastify'

export async function myModuleRoutes(app: FastifyInstance) {
  app.get('/', async (request, reply) => {
    return { message: 'My Module' }
  })

  app.post('/', async (request, reply) => {
    // Handle POST request
  })
}
```

**3. Register in src/index.ts:**
```typescript
import myModulePlugin from './modules/my-module'

if (process.env.MODULE_MY_MODULE === 'true') {
  await app.register(myModulePlugin)
}
```

**4. Add to .env.example:**
```env
MODULE_MY_MODULE=true
```

## Google API Integration

### Gmail Setup

See root-level `GMAIL_SETUP.md` for detailed OAuth configuration.

**Key Steps**:
1. Enable Gmail API in Google Cloud Console
2. Create OAuth 2.0 credentials
3. Configure redirect URIs
4. Generate app password
5. Add credentials to `.env`

### Google Calendar Setup

See root-level `GOOGLE_SETUP_GUIDE.md` for detailed instructions.

**Key Steps**:
1. Enable Google Calendar API
2. Use same OAuth credentials as Gmail
3. Add `GOOGLE_CALENDAR_ID` to `.env`

## Deployment

### Heroku

See root-level `DEPLOYMENT_HEROKU.md` for complete guide.

```bash
# Install Heroku CLI
heroku login

# Create app
heroku create your-app-name

# Set environment variables
heroku config:set NODE_ENV=production
heroku config:set AI_API_KEY=sk-...
heroku config:set MODULE_AI_AGENT=true
# ... etc

# Deploy
git push heroku main
```

**Important**:
- `Procfile` already configured
- `heroku-postbuild` script runs `npm run build`
- Set all required environment variables in Heroku dashboard

### Fly.io

`fly.toml` already configured.

```bash
# Install Fly CLI
fly auth login

# Deploy
fly deploy
```

### Generic Node.js Hosting

Requirements:
- Node.js 18.x
- Environment variables configured
- Run `npm run build` before starting
- Start with `npm start`

## Best Practices

### When Adding New Features

1. **Module-based**: Create new modules for distinct features
2. **Environment toggles**: Make features opt-in via env vars
3. **TypeScript**: Use strict types for all functions
4. **Error handling**: Use Fastify's error handling
5. **Logging**: Use Fastify's built-in logger
6. **Rate limiting**: Apply to public endpoints
7. **CORS**: Update allowed origins if needed

### Code Style

- **Imports**: ES modules (`import`/`export`)
- **Async**: Always use `async/await`
- **Types**: Export interfaces in `types.ts`
- **Plugins**: Use `fastify-plugin` wrapper
- **Routes**: Separate route handlers from business logic

### Security Considerations

- **API Keys**: Never commit to git, use `.env`
- **CORS**: Restrict origins to known domains
- **Rate Limiting**: Protect against abuse
- **Input Validation**: Validate all request bodies
- **Authentication**: Add auth middleware for protected routes (future)

## Common Issues

**Issue**: Module not loading
- Check `MODULE_[NAME]=true` in `.env`
- Check module registration in `src/index.ts`
- Check for TypeScript errors in module

**Issue**: Google API errors
- Verify credentials in `.env`
- Check OAuth redirect URI matches console
- See `GMAIL_SETUP.md` and `GOOGLE_SETUP_GUIDE.md`

**Issue**: Port already in use
- Change `PORT` in `.env`
- Kill process using port 3000: `lsof -ti:3000 | xargs kill`

**Issue**: Build fails
- Check TypeScript errors: `npm run build`
- Verify all types are properly imported
- Check `tsconfig.json` configuration

## API Documentation

### Current Endpoints

```
GET  /                           # Health check + module list
POST /ai/chat                    # AI chat (if MODULE_AI_AGENT=true)
DELETE /ai/chat/:sessionId       # Clear session (if MODULE_AI_AGENT=true)
POST /contact                    # Contact form (if MODULE_CONTACT=true)
```

### Response Formats

**Success:**
```json
{
  "message": "Success message",
  "data": { ... }
}
```

**Error:**
```json
{
  "statusCode": 400,
  "error": "Bad Request",
  "message": "Detailed error message"
}
```

## Reference Documentation

- **Fastify**: https://fastify.dev/
- **TypeScript**: https://www.typescriptlang.org/
- **Google APIs**: https://developers.google.com/
- **OpenAI**: https://platform.openai.com/docs
- **Nodemailer**: https://nodemailer.com/

## Additional Documentation

- **Root level**: `../DEPLOYMENT.md`, `../INTEGRATION.md`
- **This project**: `README.md`, `DISTRIBUTION.md`, `SAAS_MODEL.md`
- **Environment**: `.env.example` (complete variable list)

## Business Model

This backend is designed as a **licensable, self-hosted platform** for individual piano teachers. Each teacher can:
- Enable only the modules they need
- Self-host on their preferred platform
- Customize for their specific business needs
- Pay a one-time or subscription license fee

See `SAAS_MODEL.md` for detailed business model information.
