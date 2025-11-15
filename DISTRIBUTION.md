# Distribution & Monetization Strategy

This document outlines how Qinhang can be packaged, sold, and distributed as a commercial self-hosted product.

## Distribution Model

### Option 1: Source Code Distribution (Recommended for MVP)

**How it works:**
- Customer purchases a license key
- Receives a download link to a packaged release (zip/tar.gz)
- Extracts and runs the application on their own server
- License key activates the software

**Pros:**
- Simple to implement
- Transparent to customers (they can audit the code)
- Easy to customize for technical users
- No obfuscation needed

**Cons:**
- Code is visible (can be copied/redistributed)
- Requires license validation system

### Option 2: Compiled/Bundled Distribution

**How it works:**
- Use tools like `pkg` or `nexe` to compile Node.js app into binary
- Or use `webpack`/`esbuild` to bundle and minify code
- Distribute as standalone executable
- Still requires license activation

**Pros:**
- Harder to reverse engineer
- Single executable (easier for non-technical users)
- Can bundle Node.js runtime

**Cons:**
- Harder to debug for customers
- Platform-specific builds (Windows/Mac/Linux)
- Larger file sizes

## License Activation System

### Architecture

```
Customer Purchase Flow:
1. Customer purchases on website → Payment processor (Stripe/Gumroad/LemonSqueezy)
2. Payment confirmed → Generate unique license key
3. Send download link + license key to customer
4. Customer downloads, installs, enters license key
5. App validates key against license server
6. Activated ✓
```

### License Key Validation

**Three Approaches:**

#### 1. Online Validation (Recommended)
```typescript
// On startup, validate license key with your server
async function validateLicense(key: string): Promise<boolean> {
  const response = await fetch('https://api.yourdomain.com/validate', {
    method: 'POST',
    body: JSON.stringify({
      key,
      appVersion: '1.0.0',
      domain: process.env.DOMAIN // customer's domain
    })
  })
  return response.ok
}
```

**Pros:** Can revoke licenses, track usage, enforce single-domain usage
**Cons:** Requires internet connection, you need a license server

#### 2. Offline Validation (JWT-based)
```typescript
// License key is a signed JWT token with metadata
import jwt from 'jsonwebtoken'

interface LicensePayload {
  email: string
  purchaseDate: string
  modules: string[] // which modules they purchased
  expiresAt?: string // for subscription model
}

function validateOfflineLicense(key: string): boolean {
  try {
    const payload = jwt.verify(key, PUBLIC_KEY) as LicensePayload
    // Check expiration, validate modules, etc.
    return true
  } catch {
    return false
  }
}
```

**Pros:** Works offline, no license server needed
**Cons:** Can't revoke licenses, keys can be shared

#### 3. Hybrid Approach (Best of both)
- Use JWT for offline validation
- Periodically check online for revocation list
- Grace period if offline (30 days)

### Implementation Strategy

**File structure:**
```
src/
├── license/
│   ├── validator.ts      # License validation logic
│   ├── middleware.ts     # Fastify middleware to check license
│   └── types.ts          # License types
```

**Basic implementation:**
```typescript
// src/license/validator.ts
import jwt from 'jsonwebtoken'
import { readFileSync, writeFileSync } from 'fs'

const LICENSE_FILE = './license.key'
const PUBLIC_KEY = `-----BEGIN PUBLIC KEY-----
... your public key ...
-----END PUBLIC KEY-----`

export async function checkLicense(): Promise<boolean> {
  try {
    const licenseKey = readFileSync(LICENSE_FILE, 'utf-8').trim()

    // Validate JWT
    const payload = jwt.verify(licenseKey, PUBLIC_KEY)

    // Optional: Check with license server
    const isValid = await validateOnline(licenseKey)

    return isValid
  } catch (error) {
    console.error('License validation failed:', error.message)
    return false
  }
}

// On first run, prompt for license key
export function activateLicense(key: string): void {
  writeFileSync(LICENSE_FILE, key, 'utf-8')
}
```

**Integration in main app:**
```typescript
// src/index.ts
import { checkLicense } from './license/validator.js'

const start = async () => {
  // Check license on startup
  const isLicensed = await checkLicense()

  if (!isLicensed) {
    console.error('Invalid or missing license. Please activate your license.')
    console.log('Run: npm run activate -- YOUR_LICENSE_KEY')
    process.exit(1)
  }

  // Continue with normal startup...
  await loadModules()
  await fastify.listen({ port: config.port })
}
```

## Packaging & Distribution

### 1. Build Process

**package.json scripts:**
```json
{
  "scripts": {
    "build": "tsc",
    "package": "npm run build && npm run package:create",
    "package:create": "node scripts/package.js"
  }
}
```

**scripts/package.js:**
```javascript
// Create distributable package
const fs = require('fs')
const archiver = require('archiver')

// 1. Build TypeScript
// 2. Copy necessary files (package.json, .env.example, README)
// 3. Remove dev dependencies from package.json
// 4. Create archive

const version = require('../package.json').version
const output = fs.createWriteStream(`releases/qinhang-v${version}.zip`)
const archive = archiver('zip', { zlib: { level: 9 } })

archive.pipe(output)
archive.directory('dist/', 'dist')
archive.file('package.json')
archive.file('.env.example')
archive.file('README.md')
archive.file('INSTALLATION.md')
archive.finalize()
```

### 2. What Customer Receives

```
qinhang-v1.0.0.zip
├── dist/                  # Compiled JavaScript
├── package.json           # Production dependencies only
├── .env.example           # Configuration template
├── README.md              # Getting started guide
├── INSTALLATION.md        # Setup instructions
└── LICENSE.txt            # Terms of use
```

### 3. Customer Installation Process

**INSTALLATION.md:**
```markdown
# Installation Guide

## Prerequisites
- Node.js 18+ installed
- Basic terminal/command line knowledge

## Steps

1. Extract the zip file
2. Navigate to the folder: `cd qinhang-v1.0.0`
3. Install dependencies: `npm install --production`
4. Copy .env.example to .env: `cp .env.example .env`
5. Edit .env with your settings
6. Activate your license: `npm run activate YOUR_LICENSE_KEY`
7. Start the server: `npm start`

## Next Steps
- Visit http://localhost:3000 to verify it's running
- Configure your modules in .env
- Set up a reverse proxy (nginx) for production
- Configure SSL certificates
```

## Module Extensibility

### How Customers Can Add Custom Modules

**1. Plugin Directory Structure:**
```
src/
├── modules/          # Built-in modules
└── plugins/          # Customer custom modules (gitignored)
```

**2. Auto-load plugins from directory:**
```typescript
// src/index.ts
import { readdirSync, statSync } from 'fs'
import { join } from 'path'

const loadCustomPlugins = async () => {
  const pluginsDir = './src/plugins'

  if (!existsSync(pluginsDir)) {
    return
  }

  const plugins = readdirSync(pluginsDir)
    .filter(file => statSync(join(pluginsDir, file)).isDirectory())

  for (const plugin of plugins) {
    try {
      const pluginModule = await import(`./plugins/${plugin}/index.js`)
      await fastify.register(pluginModule.default)
      fastify.log.info(`Custom plugin loaded: ${plugin}`)
    } catch (error) {
      fastify.log.error(`Failed to load plugin ${plugin}:`, error)
    }
  }
}
```

**3. Plugin Template (provide to customers):**

**plugins/my-custom-module/index.ts:**
```typescript
import type { FastifyPluginAsync } from 'fastify'
import fp from 'fastify-plugin'

const myCustomPlugin: FastifyPluginAsync = async (fastify, opts) => {
  fastify.log.info('My Custom Module loaded')

  fastify.get('/custom/endpoint', async (request, reply) => {
    return { message: 'Custom functionality' }
  })
}

export default fp(myCustomPlugin, {
  name: 'my-custom-module'
})
```

**4. Documentation for Custom Modules:**

Create `CUSTOM_MODULES.md`:
```markdown
# Creating Custom Modules

Qinhang supports custom modules/plugins that extend the base functionality.

## Creating a Plugin

1. Create a new folder in `src/plugins/your-module-name/`
2. Create an `index.ts` file following the template
3. Write your custom routes and logic
4. Restart the server - your plugin will auto-load

## Template

See `docs/plugin-template/` for a full example.

## Best Practices

- Follow the same structure as built-in modules
- Use TypeScript for type safety
- Add error handling
- Document your custom routes
```

## Pricing & Tiers

### Suggested Model

**Single License Options:**

1. **Basic License - $299**
   - All core modules (blog, scheduling, media hosting)
   - 1 domain/installation
   - 6 months of updates
   - Email support

2. **Professional License - $599**
   - Everything in Basic
   - AI Agent module
   - RAG module
   - 1 year of updates
   - Priority email support
   - Custom module development guide

3. **Agency License - $1,499**
   - Everything in Professional
   - Deploy for unlimited clients
   - Lifetime updates
   - Priority support + Slack access
   - Remove "Powered by Qinhang" branding

### Revenue Streams

1. **Initial Purchase** - One-time license fee
2. **Updates & Support** - Annual renewal for updates ($99-199/year)
3. **Custom Development** - Build custom modules for customers
4. **Hosting Service** - Offer managed hosting as alternative
5. **Training/Consulting** - Setup and customization services

## License Server (Simple Implementation)

**Tech Stack:**
- Cloudflare Workers (serverless, cheap)
- KV storage for license keys
- Stripe webhooks for automatic activation

**API Endpoints:**
```
POST /activate
  - Validates purchase
  - Returns license key (JWT)

POST /validate
  - Checks if license key is valid
  - Returns modules enabled

POST /deactivate
  - Allows customer to move installation
```

**Example Worker:**
```typescript
// cloudflare-worker/index.ts
export default {
  async fetch(request: Request, env: Env) {
    const { pathname } = new URL(request.url)

    if (pathname === '/validate' && request.method === 'POST') {
      const { key, domain } = await request.json()

      // Check KV store
      const licenseData = await env.LICENSES.get(key)
      if (!licenseData) {
        return new Response('Invalid license', { status: 403 })
      }

      const license = JSON.parse(licenseData)

      // Check domain restrictions
      if (license.domain && license.domain !== domain) {
        return new Response('License not valid for this domain', { status: 403 })
      }

      return new Response(JSON.stringify({
        valid: true,
        modules: license.modules,
        expiresAt: license.expiresAt
      }))
    }
  }
}
```

## Preventing Piracy

### Strategies

1. **Domain Locking**
   - License key tied to specific domain
   - Allow 2-3 domain changes per year (for migrations)

2. **Phone Home**
   - Periodic check-ins with license server
   - Track active installations
   - Disable if too many simultaneous uses

3. **Obfuscation (Optional)**
   - Minify/uglify the built JavaScript
   - Not foolproof but adds friction

4. **Value-Based Approach**
   - Focus on providing value (updates, support, docs)
   - Make purchasing easier than pirating
   - Build community and trust

5. **License Violations**
   - Monitor for public installations
   - Friendly reach-out first
   - DMCA for blatant violations

### Reality Check

- Some piracy is inevitable
- Focus on making honest customers happy
- Price fairly - not too high to tempt piracy
- Offer great support and updates
- Build long-term customer relationships

## Next Steps

### Phase 1: MVP (Current)
- [x] Build core application
- [ ] Add license validation
- [ ] Create packaging script
- [ ] Write customer documentation

### Phase 2: Launch Prep
- [ ] Set up license server (Cloudflare Worker)
- [ ] Create landing page with pricing
- [ ] Set up payment processing (Stripe)
- [ ] Create demo video
- [ ] Beta test with 5-10 customers

### Phase 3: Post-Launch
- [ ] Customer support system
- [ ] Community forum/Discord
- [ ] Video tutorials
- [ ] Integration guides (DigitalOcean, Vercel, Railway, etc.)
- [ ] Affiliate program

## Tools & Services Needed

1. **Payment Processing**
   - Stripe (direct) or
   - Gumroad (simpler, takes larger cut) or
   - LemonSqueezy (handles VAT/taxes globally)

2. **License Server**
   - Cloudflare Workers (free tier works)
   - Or use existing SaaS: Keygen.sh, License Spring

3. **Distribution**
   - GitHub Releases (private repo) or
   - S3 + signed URLs or
   - Customer portal on your website

4. **Support**
   - Email (help@qinhang.com)
   - Discord community
   - Documentation site (GitBook, Docusaurus)

5. **Analytics**
   - PostHog (self-hosted analytics)
   - Optional telemetry (with opt-out)

## Conclusion

The recommended approach for Qinhang:

1. **Start Simple**: Source code distribution with JWT license keys
2. **Validate Online**: Use Cloudflare Workers for license validation
3. **Price Fairly**: $299-599 for single-use license
4. **Support Well**: Great docs + responsive support = happy customers
5. **Build Community**: Discord/forum for customers to help each other
6. **Iterate**: Add features based on customer feedback

This balances simplicity, security, and customer satisfaction while building a sustainable business.
