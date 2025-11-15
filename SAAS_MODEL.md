# SaaS/Managed Hosting Model

A better approach: Deploy and manage Qinhang instances for customers, offering it as a service rather than a one-time purchase.

## Business Model Overview

**You provide:**
- Hosted backend instance (API) for each customer
- Optional frontend template they can customize
- Infrastructure management, updates, backups
- Technical support and maintenance

**Customer gets:**
- Their own backend API at `https://customer-name.qinhang.app`
- Access to admin dashboard
- Option to use provided frontend or build their own
- No technical setup required

**Revenue:**
- Monthly/yearly subscription ($29-199/month)
- Predictable recurring revenue
- Much easier to support than self-hosted
- No piracy concerns

## Architecture

### Multi-Tenant vs. Isolated Instances

#### Option 1: Multi-Tenant (Cost Efficient)
```
Single Server/Container
├── Shared application code
├── Customer A's database (isolated schema)
├── Customer B's database (isolated schema)
└── Customer C's database (isolated schema)
```

**Pros:**
- Very cost-efficient (one server, many customers)
- Easy to update (deploy once)
- Lower hosting costs = higher margins

**Cons:**
- Noisy neighbor problems
- Security concerns (one exploit affects all)
- Limited customization per customer

#### Option 2: Isolated Instances (Recommended)
```
Customer A: api-customer-a.qinhang.app → Container A
Customer B: api-customer-b.qinhang.app → Container B
Customer C: api-customer-c.qinhang.app → Container C
```

**Pros:**
- Complete isolation (security + performance)
- Per-customer customization (modules, settings)
- Easier to debug issues
- Can offer different pricing for resource tiers

**Cons:**
- Higher hosting costs (more containers)
- More complex deployment

### Hybrid Approach (Best of Both)
```
Tier 1 ($29/mo): Multi-tenant, shared resources
Tier 2 ($99/mo): Dedicated container, shared DB server
Tier 3 ($299/mo): Fully isolated (container + dedicated DB)
```

## Technical Implementation

### Stack Recommendation

**Infrastructure:**
- Railway.app or Fly.io (easy container deployment)
- Or Docker + Kubernetes (more complex, more control)
- Or DigitalOcean App Platform (managed, simple)

**Database:**
- PostgreSQL (better for multi-tenant than SQLite)
- One database per customer (isolation)
- Automated backups

**Storage:**
- S3-compatible (Cloudflare R2, Backblaze B2)
- Cheaper than AWS S3
- Per-customer folders/buckets

**Deployment:**
- Docker containers
- Automated deployment pipeline
- One command to spin up new customer

### Project Structure for Multi-Tenant

```typescript
// src/config/index.ts
export const config: AppConfig = {
  // ... existing config ...

  // Multi-tenant additions
  tenant: {
    id: process.env.TENANT_ID || 'default',
    name: process.env.TENANT_NAME || 'Default',
    subdomain: process.env.TENANT_SUBDOMAIN || 'app'
  },

  database: {
    type: 'postgres',
    url: process.env.DATABASE_URL,
    schema: process.env.TENANT_ID || 'public' // Isolated schema per customer
  }
}
```

### Tenant Middleware

```typescript
// src/middleware/tenant.ts
import type { FastifyRequest, FastifyReply } from 'fastify'
import fp from 'fastify-plugin'

declare module 'fastify' {
  interface FastifyRequest {
    tenant: {
      id: string
      name: string
      config: TenantConfig
    }
  }
}

const tenantPlugin: FastifyPluginAsync = async (fastify, opts) => {
  // Identify tenant from subdomain or API key
  fastify.decorateRequest('tenant', null)

  fastify.addHook('onRequest', async (request, reply) => {
    const host = request.headers.host || ''
    const subdomain = host.split('.')[0]

    // Load tenant config from database
    const tenant = await getTenantBySubdomain(subdomain)

    if (!tenant) {
      reply.code(404).send({ error: 'Tenant not found' })
      return
    }

    request.tenant = tenant
  })
}

export default fp(tenantPlugin, {
  name: 'tenant-middleware'
})
```

### Database Schema per Tenant

```typescript
// src/shared/database/tenant.ts
import { Pool } from 'pg'

export async function initializeTenantDatabase(tenantId: string) {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL })

  // Create isolated schema for this tenant
  await pool.query(`CREATE SCHEMA IF NOT EXISTS "${tenantId}"`)

  // Set search path for this connection
  await pool.query(`SET search_path TO "${tenantId}"`)

  // Run migrations for this tenant
  await runMigrations(pool, tenantId)

  return pool
}
```

## Customer Onboarding Flow

### 1. Customer Signs Up
```
1. Customer visits qinhang.app
2. Fills out signup form:
   - Email
   - Desired subdomain (e.g., "janepianolessons")
   - Plan selection
3. Payment processed (Stripe)
4. Webhook triggers provisioning
```

### 2. Automatic Provisioning

**Provisioning script:**
```typescript
// scripts/provision-customer.ts
import { exec } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)

interface ProvisionRequest {
  customerId: string
  email: string
  subdomain: string
  plan: 'starter' | 'professional' | 'premium'
}

async function provisionCustomer(req: ProvisionRequest) {
  console.log(`Provisioning customer: ${req.subdomain}`)

  // 1. Create database schema
  await createDatabaseSchema(req.customerId)

  // 2. Deploy container
  if (req.plan === 'premium') {
    // Dedicated container
    await deployDedicatedInstance(req)
  } else {
    // Add to multi-tenant pool
    await addToMultiTenant(req)
  }

  // 3. Configure subdomain
  await configureDNS(req.subdomain)

  // 4. Create admin user
  await createAdminUser(req.email, req.customerId)

  // 5. Send welcome email with credentials
  await sendWelcomeEmail(req.email, req.subdomain)

  console.log(`✓ Customer provisioned: https://${req.subdomain}.qinhang.app`)
}

async function deployDedicatedInstance(req: ProvisionRequest) {
  // Example using Railway.app CLI
  const env = {
    TENANT_ID: req.customerId,
    TENANT_SUBDOMAIN: req.subdomain,
    DATABASE_URL: `${process.env.DATABASE_URL}`,
    MODULES_ENABLED: getModulesForPlan(req.plan)
  }

  // Deploy to Railway
  await execAsync(`railway up -d`, {
    env: { ...process.env, ...env }
  })

  // Or Docker Compose
  /*
  await execAsync(`
    docker-compose -f docker-compose.customer.yml \
    -p ${req.subdomain} \
    up -d
  `, { env: { ...process.env, ...env } })
  */
}
```

### 3. Customer Receives

**Welcome email:**
```
Subject: Welcome to Qinhang!

Hi [Name],

Your piano teaching platform is ready!

🔗 API Endpoint: https://janepianolessons.qinhang.app
🎨 Admin Dashboard: https://janepianolessons.qinhang.app/admin
📧 Login: your-email@example.com
🔑 Temporary Password: [generated]

What's Next?

1. Log into your admin dashboard
2. Customize your settings
3. (Optional) Download our frontend template
4. Or build your own using our API

📚 Documentation: https://docs.qinhang.app
💬 Support: help@qinhang.app

Happy teaching!
- The Qinhang Team
```

## Frontend Options

### Option 1: Provide Template Frontend

**Separate frontend repository:**
```
qinhang-frontend/
├── src/
│   ├── components/
│   ├── pages/
│   ├── hooks/
│   └── config/
│       └── api.ts  # Configure API endpoint
└── README.md
```

**api.ts:**
```typescript
export const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000'

// Customer changes this to their backend:
// VITE_API_URL=https://janepianolessons.qinhang.app
```

**Features:**
- Pre-built blog, scheduling, media library pages
- Admin panel for content management
- Customizable branding (colors, logo, fonts)
- Deploys to Vercel/Netlify in one click

**Distribution:**
- GitHub template repository
- One-click deploy to Vercel button
- Step-by-step customization guide

### Option 2: Customer Builds Their Own

**Provide comprehensive API docs:**
```
API Documentation at: https://docs.qinhang.app

Endpoints:

Blog:
  GET    /blog           - List posts
  GET    /blog/:id       - Get post
  POST   /blog           - Create post (auth required)
  PUT    /blog/:id       - Update post (auth required)
  DELETE /blog/:id       - Delete post (auth required)

Scheduling:
  GET    /schedule/availability  - Get available slots
  POST   /schedule/book          - Book a class
  GET    /schedule/bookings      - List bookings (auth)

Media:
  GET    /media          - List files
  POST   /media/upload   - Upload file (auth)
  GET    /media/:id      - Download file

AI Chat:
  POST   /ai/chat        - Send message to AI assistant

Authentication:
  POST   /auth/login     - Login
  POST   /auth/logout    - Logout
  GET    /auth/me        - Current user
```

**SDK/Client Libraries:**
```typescript
// @qinhang/client package
import { QinhangClient } from '@qinhang/client'

const client = new QinhangClient({
  apiUrl: 'https://janepianolessons.qinhang.app',
  apiKey: 'sk_...'
})

// Use the API
const posts = await client.blog.list()
const availability = await client.scheduling.getAvailability()
```

## Pricing Strategy

### Subscription Tiers

**Starter - $29/month**
- Blog module
- Media hosting (10GB)
- Scheduling (up to 50 bookings/month)
- Shared infrastructure
- Email support
- API access

**Professional - $99/month**
- Everything in Starter
- AI Agent module
- RAG search
- Media hosting (100GB)
- Unlimited bookings
- Dedicated container
- Priority support
- Remove "Powered by Qinhang" branding

**Premium - $299/month**
- Everything in Professional
- Fully isolated infrastructure
- Media hosting (500GB)
- Custom domain support
- White-label admin dashboard
- Slack support
- Custom module development (1 per year)

**Enterprise - Custom pricing**
- On-premise deployment option
- SLA guarantees
- Dedicated support engineer
- Custom integrations
- Training sessions

### Additional Revenue

1. **Overage Charges**
   - Extra storage: $0.10/GB
   - Extra API calls: $0.001/request over limit
   - Extra AI messages: $0.05/message

2. **Add-ons**
   - Email notifications: $9/month
   - SMS reminders: $19/month
   - Payment processing: $29/month
   - Analytics dashboard: $19/month

3. **Services**
   - Frontend customization: $500-2000
   - Custom module development: $1000-5000
   - Migration from other platforms: $500
   - Training/onboarding: $200/session

## Deployment Infrastructure

### Using Railway.app (Recommended for Starting)

**Why Railway:**
- Dead simple deployments
- PostgreSQL included
- Automatic HTTPS
- Generous free tier
- Scale as you grow

**Setup:**
```bash
# Install Railway CLI
npm i -g @railway/cli

# Login
railway login

# Create new project for customer
railway init

# Add PostgreSQL
railway add postgresql

# Deploy
railway up

# Set custom domain
railway domain add janepianolessons.qinhang.app
```

**Per-customer cost:** ~$5-20/month depending on usage

### Using Docker + DigitalOcean

**docker-compose.yml:**
```yaml
version: '3.8'

services:
  app:
    build: .
    environment:
      - TENANT_ID=${TENANT_ID}
      - DATABASE_URL=postgresql://postgres:password@db:5432/${TENANT_ID}
    ports:
      - "3000:3000"
    depends_on:
      - db

  db:
    image: postgres:15
    environment:
      - POSTGRES_PASSWORD=password
    volumes:
      - postgres_data:/var/lib/postgresql/data

volumes:
  postgres_data:
```

**Deployment script:**
```bash
#!/bin/bash
# deploy-customer.sh

TENANT_ID=$1
SUBDOMAIN=$2

# Create droplet
doctl compute droplet create \
  ${SUBDOMAIN}-qinhang \
  --image docker-20-04 \
  --size s-1vcpu-2gb \
  --region nyc1

# Get IP
IP=$(doctl compute droplet get ${SUBDOMAIN}-qinhang --format PublicIPv4 --no-header)

# Configure DNS
doctl compute domain records create qinhang.app \
  --record-type A \
  --record-name ${SUBDOMAIN} \
  --record-data ${IP}

# Deploy app
ssh root@${IP} << EOF
  git clone [your-repo]
  cd qinhang
  TENANT_ID=${TENANT_ID} docker-compose up -d
EOF
```

### Using Kubernetes (For Scale)

**When you have 50+ customers:**
- Kubernetes cluster (GKE, EKS, or DigitalOcean Kubernetes)
- Helm charts for easy deployment
- Horizontal auto-scaling
- Centralized logging (Datadog, CloudWatch)

**One command to provision:**
```bash
helm install customer-${TENANT_ID} ./qinhang-chart \
  --set tenant.id=${TENANT_ID} \
  --set tenant.subdomain=${SUBDOMAIN} \
  --set database.url=${DB_URL}
```

## Admin Dashboard

### Super Admin (Your View)

**Dashboard at admin.qinhang.app:**
- List all customers
- View usage metrics per customer
- Provision new customers
- Pause/unpause customers (for non-payment)
- View logs and errors
- Trigger updates/deployments

**Tech Stack:**
- Next.js + Tailwind
- tRPC for backend communication
- Postgres for customer database
- Recharts for analytics

### Customer Admin (Their View)

**Dashboard at {subdomain}.qinhang.app/admin:**
- Configure modules (enable/disable features)
- Manage content (blog posts, media files)
- View bookings and schedule
- Settings (branding, AI behavior, etc.)
- Analytics (visitors, bookings, popular content)
- API key management

## Customer Support

### Documentation Site

**docs.qinhang.app:**
- Getting Started guide
- API reference
- Frontend customization guide
- Video tutorials
- Common troubleshooting

**Tech:** Docusaurus or GitBook

### Support Channels

**Tier-based:**
- Starter: Email support (24-48h response)
- Professional: Email + Live chat (12h response)
- Premium: Email + Chat + Slack (4h response)
- Enterprise: Dedicated support engineer

### Self-Service

- Knowledge base
- Community forum (Discourse)
- Discord for community help
- Status page (status.qinhang.app)

## Monitoring & Maintenance

### Per-Customer Monitoring

**Setup alerts:**
```typescript
// Monitor each customer instance
const alerts = {
  highErrorRate: (tenantId) => {
    // Alert if >5% error rate
  },
  highLatency: (tenantId) => {
    // Alert if p95 > 1000ms
  },
  downtime: (tenantId) => {
    // Alert if unreachable for >5 min
  }
}
```

**Tools:**
- Uptime monitoring: UptimeRobot, Checkly
- Error tracking: Sentry (multi-tenant aware)
- Logs: Logtail, Papertrail
- Metrics: Prometheus + Grafana

### Automated Backups

```bash
# Daily backup script
for TENANT_ID in $(get_all_tenants); do
  pg_dump -h $DB_HOST -U postgres -n $TENANT_ID > backups/$TENANT_ID-$(date +%Y%m%d).sql
  aws s3 cp backups/$TENANT_ID-$(date +%Y%m%d).sql s3://qinhang-backups/
done
```

### Update Strategy

**Zero-downtime updates:**
1. Deploy new version to staging
2. Test with beta customers
3. Rolling update to production
4. Automated rollback if errors detected

## Marketing & Sales

### Landing Page

**qinhang.app:**
- Hero: "The Complete Platform for Piano Teachers"
- Features showcase
- Pricing comparison table
- Customer testimonials
- Live demo
- FAQ
- Start free trial button

### Free Trial Strategy

**14-day free trial:**
- No credit card required
- Full access to all features
- Sample data pre-loaded
- Onboarding checklist
- Email drip campaign with tips

**Conversion tactics:**
- Day 3: "Here's how to customize your site"
- Day 7: "You're halfway there! Need help?"
- Day 12: "Last chance - 20% off first 3 months"

### Customer Acquisition

**Channels:**
1. SEO (blog about piano teaching)
2. Facebook/Instagram ads (target piano teachers)
3. YouTube tutorials
4. Piano teacher forums/Facebook groups
5. Partnerships with music schools
6. Affiliate program (20% recurring commission)

## Financial Projections

### Costs (Monthly)

**At 10 customers:**
- Hosting (Railway): $100
- Database: $50
- Storage (R2): $20
- Stripe fees (3%): ~$30
- Domain/email: $20
**Total: ~$220/month**

**At 100 customers:**
- Hosting: $800
- Database: $300
- Storage: $150
- Stripe fees: ~$300
- Support tools: $100
**Total: ~$1,650/month**

### Revenue (Monthly)

**At 10 customers (50% Starter, 30% Pro, 20% Premium):**
- 5 × $29 = $145
- 3 × $99 = $297
- 2 × $299 = $598
**Total: $1,040/month**

**At 100 customers:**
- 50 × $29 = $1,450
- 30 × $99 = $2,970
- 20 × $299 = $5,980
**Total: $10,400/month**

**Net profit at 100 customers:** ~$8,750/month ($105k/year)

### Break-even Analysis

**Fixed costs:** ~$500/month (domain, tools, email)
**Variable cost per customer:** ~$15/month

**Break-even:** ~20 customers

## Advantages Over Self-Hosted License

✅ **Recurring Revenue** - Predictable income vs. one-time purchases
✅ **Higher LTV** - Customer worth $1,000+ over 3 years vs. $300 once
✅ **Easier Support** - You control the environment, easier to debug
✅ **Automatic Updates** - Push updates instantly, no customer action needed
✅ **No Piracy** - Can't steal a hosted service
✅ **Better Retention** - Switching costs are higher
✅ **Upsell Opportunities** - Easy to upgrade tiers or add modules
✅ **Data Insights** - Understand how customers use the product

## Getting Started

### Phase 1: MVP (4-6 weeks)
- [ ] Add tenant middleware
- [ ] Create provisioning script
- [ ] Build super admin dashboard
- [ ] Build customer admin dashboard
- [ ] Set up Railway deployment
- [ ] Create frontend template
- [ ] Write API documentation

### Phase 2: Launch Prep (2-3 weeks)
- [ ] Create landing page
- [ ] Set up Stripe subscriptions
- [ ] Automated onboarding flow
- [ ] Email sequences
- [ ] Knowledge base
- [ ] Beta test with 5 customers

### Phase 3: Launch (Week 10)
- [ ] Public launch
- [ ] Social media campaign
- [ ] Reach out to piano teacher communities
- [ ] Content marketing (SEO blog)
- [ ] Goal: 20 customers in first month

### Phase 4: Scale (Months 3-12)
- [ ] Iterate based on feedback
- [ ] Add requested features
- [ ] Optimize costs
- [ ] Hire support person at 50+ customers
- [ ] Goal: 100 customers by month 12

## Conclusion

The SaaS/managed hosting model is significantly better than self-hosted licenses:

- **$105k/year potential** at just 100 customers
- **Much easier** for customers (no technical setup)
- **Better support** (you control the environment)
- **No piracy concerns**
- **Recurring revenue** (predictable, scalable)

This approach builds a real, sustainable business rather than a one-time product sale.
