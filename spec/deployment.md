# Nexus — Production Deployment & Robustness Guide

> This document covers everything required to go from zero to a live, production-grade deployment. Every edge case, every failure mode, every recovery path.

---

## Pre-Deployment Requirements

### Accounts to Create (Do This First)
| Service | URL | Tier Needed | Notes |
|---------|-----|-------------|-------|
| Vercel | vercel.com | Free (Hobby) | Connect GitHub repo |
| Neon | neon.tech | Free | Create project `nexus-prod` |
| Upstash | upstash.com | Free | Create Redis DB + QStash topic |
| Tavily | app.tavily.com | Free | 1,000 credits/month |
| Anthropic | console.anthropic.com | Pay-as-you-go | Add $10 credit |
| LangSmith | smith.langchain.com | Free Developer | For trace observability |
| MoneyDevKit | docs.moneydevkit.com | — | Run `npx @moneydevkit/create` |
| GitHub | github.com | Free | Repo for CI/CD |

---

## Service Setup (Step by Step)

### 1. Neon PostgreSQL

```bash
# Install Neon CLI
npm install -g neonctl
neonctl auth

# Create project
neonctl projects create --name nexus-prod --region-id aws-us-east-2

# Get connection string
neonctl connection-string --project-id <id>
# → postgresql://user:pass@ep-xxx.us-east-2.aws.neon.tech/nexus?sslmode=require
```

**Connection pooling setup (critical for serverless):**
Neon provides two connection strings:
- Direct: `postgresql://...@ep-xxx.../nexus` — use for migrations and scripts
- Pooled: `postgresql://...@ep-xxx-pooler.../nexus` — use for application (Prisma)

Set `DATABASE_URL` to the **pooled** URL. Set `DATABASE_DIRECT_URL` to the direct URL (Prisma uses this for migrations).

```prisma
// schema.prisma
datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")          // pooled
  directUrl = env("DATABASE_DIRECT_URL")   // direct (migrations only)
}
```

**Run initial migration:**
```bash
npx prisma migrate deploy
npx prisma db seed  # seed demo agents + sample data
```

---

### 2. Upstash Redis

```bash
# Create database via Upstash dashboard
# Region: us-east-1 (same as Vercel default)
# Eviction: allkeys-lru (so cache evicts old entries, never blocks writes)

# Get credentials
UPSTASH_REDIS_REST_URL=https://xxx.upstash.io
UPSTASH_REDIS_REST_TOKEN=xxx
```

**Create QStash topics:**
- `nexus-escrow-timeout` — processes expired escrow refunds
- `nexus-agent-health` — periodic agent endpoint health checks

**Key naming convention (all Redis keys):**
```
search:cache:{sha256(query+tier)}         → search result JSON
l402:token:{sha256(preimage)}             → validated token metadata
ratelimit:ip:{hashedIp}                   → sliding window counter
ratelimit:agent:{lightningAddress}        → per-agent rate limit
payment:event:channel                     → pub/sub channel name
research:task:{taskId}:status            → task status for reconnect
research:task:{taskId}:partial           → partial results for reconnect
agent:health:{agentId}                   → last health check result
```

---

### 3. MoneyDevKit (Lightning)

```bash
# Scaffold MDK project
npx @moneydevkit/create nexus-lightning

# This creates:
# - MDK node config
# - Agent wallet (can send/receive)
# - L402 middleware helpers

# Get your MDK credentials
MDK_SECRET_KEY=xxx
MDK_NODE_URL=https://node.moneydevkit.com
MDK_WALLET_ADDRESS=xxx
```

**Invoice configuration:**
```typescript
// config/lightning.ts
export const LIGHTNING_CONFIG = {
  invoiceExpirySeconds: 300,    // 5 minutes to pay
  minPaymentSats: 1,
  maxPaymentSats: 10_000,
  // Per-tier amounts
  tierPricing: {
    FLASH: 1,
    BASIC: 2,
    DEEP: 5,
    RESEARCH: 25,
    EXTRACT: 1,
    AGENT_REGISTER: 100,        // stake to list
    TASK_PLATFORM_FEE_PCT: 10,  // 10% of agent's price
  },
} as const
```

---

### 4. Vercel Deployment

**`vercel.json` — complete production config:**
```json
{
  "framework": "nextjs",
  "buildCommand": "pnpm build",
  "devCommand": "pnpm dev",
  "installCommand": "pnpm install",
  "functions": {
    "app/api/v1/search/route.ts": {
      "runtime": "edge",
      "maxDuration": 10
    },
    "app/api/v1/extract/route.ts": {
      "runtime": "edge",
      "maxDuration": 10
    },
    "app/api/v1/research/route.ts": {
      "runtime": "nodejs",
      "maxDuration": 60
    },
    "app/api/v1/synthesize/route.ts": {
      "runtime": "nodejs",
      "maxDuration": 30
    },
    "app/api/v1/agents/route.ts": {
      "runtime": "nodejs",
      "maxDuration": 15
    },
    "app/api/socket/route.ts": {
      "runtime": "nodejs",
      "maxDuration": 60
    },
    "app/api/trpc/[trpc]/route.ts": {
      "runtime": "nodejs",
      "maxDuration": 15
    }
  },
  "headers": [
    {
      "source": "/api/v1/(.*)",
      "headers": [
        { "key": "Access-Control-Allow-Origin", "value": "*" },
        { "key": "Access-Control-Allow-Methods", "value": "GET, POST, OPTIONS" },
        { "key": "Access-Control-Allow-Headers", "value": "Content-Type, Authorization" },
        { "key": "X-Content-Type-Options", "value": "nosniff" },
        { "key": "X-Frame-Options", "value": "DENY" }
      ]
    }
  ],
  "rewrites": [
    {
      "source": "/api/health",
      "destination": "/api/v1/health"
    }
  ]
}
```

**Deploy command:**
```bash
vercel --prod
# → https://nexus.vercel.app
```

---

## Complete Environment Variables Reference

```bash
# ─────────────────────────────────────────────
# TAVILY (Intelligence Layer)
# ─────────────────────────────────────────────
TAVILY_API_KEY=tvly-xxx

# ─────────────────────────────────────────────
# ANTHROPIC (Synthesis + Analysis)
# ─────────────────────────────────────────────
ANTHROPIC_API_KEY=sk-ant-xxx

# ─────────────────────────────────────────────
# LIGHTNING / MDK (Payment Layer)
# ─────────────────────────────────────────────
MDK_SECRET_KEY=xxx
MDK_NODE_URL=https://node.moneydevkit.com
MDK_AGENT_WALLET_SECRET=xxx    # demo agent wallet

# ─────────────────────────────────────────────
# DATABASE (Neon PostgreSQL)
# ─────────────────────────────────────────────
DATABASE_URL=postgresql://user:pass@ep-xxx-pooler.us-east-2.aws.neon.tech/nexus?sslmode=require
DATABASE_DIRECT_URL=postgresql://user:pass@ep-xxx.us-east-2.aws.neon.tech/nexus?sslmode=require

# ─────────────────────────────────────────────
# CACHE / QUEUE (Upstash)
# ─────────────────────────────────────────────
UPSTASH_REDIS_REST_URL=https://xxx.upstash.io
UPSTASH_REDIS_REST_TOKEN=xxx
QSTASH_TOKEN=xxx
QSTASH_CURRENT_SIGNING_KEY=xxx   # for verifying QStash webhook signatures
QSTASH_NEXT_SIGNING_KEY=xxx

# ─────────────────────────────────────────────
# OBSERVABILITY (LangSmith)
# ─────────────────────────────────────────────
LANGCHAIN_API_KEY=ls__xxx
LANGCHAIN_TRACING_V2=true
LANGCHAIN_PROJECT=nexus-hackathon
LANGCHAIN_ENDPOINT=https://api.smith.langchain.com

# ─────────────────────────────────────────────
# AUTH (Human Dashboard — Next-Auth)
# ─────────────────────────────────────────────
NEXTAUTH_SECRET=xxx             # openssl rand -base64 32
NEXTAUTH_URL=https://nexus.vercel.app

# ─────────────────────────────────────────────
# OPENAI FALLBACK (emergency only)
# ─────────────────────────────────────────────
OPENAI_API_KEY=sk-xxx

# ─────────────────────────────────────────────
# APP CONFIG
# ─────────────────────────────────────────────
NEXT_PUBLIC_APP_URL=https://nexus.vercel.app
NEXT_PUBLIC_ENABLE_AGENT_REGISTRY=true
NEXT_PUBLIC_ENABLE_ESCROW=true
NODE_ENV=production

# ─────────────────────────────────────────────
# PYTHON AGENT (apps/agent/.env)
# ─────────────────────────────────────────────
NEXUS_BASE_URL=https://nexus.vercel.app
ANTHROPIC_API_KEY=sk-ant-xxx
TAVILY_API_KEY=tvly-xxx
MDK_AGENT_WALLET_SECRET=xxx
LANGCHAIN_API_KEY=ls__xxx
LANGCHAIN_TRACING_V2=true
```

---

## Health Check Endpoints

**`GET /api/v1/health`** — public, no auth required

```typescript
// Returns 200 if all systems green, 503 if any critical service is down
{
  "status": "healthy" | "degraded" | "down",
  "timestamp": "2025-04-26T12:00:00Z",
  "version": "1.0.0",
  "services": {
    "database": { "status": "ok", "latencyMs": 12 },
    "redis":    { "status": "ok", "latencyMs": 8 },
    "tavily":   { "status": "ok", "latencyMs": 230 },
    "anthropic":{ "status": "ok", "latencyMs": 180 },
    "lightning":{ "status": "ok", "latencyMs": 95 }
  },
  "circuitBreakers": {
    "tavily":   { "state": "closed" },  // closed = healthy
    "anthropic":{ "state": "closed" }
  }
}
```

**`GET /api/v1/health/lightning`** — Lightning-specific health

```typescript
{
  "nodeConnected": true,
  "walletBalanceSats": 1000,
  "pendingInvoices": 2,
  "lastPaymentReceivedAt": "2025-04-26T11:59:30Z"
}
```

---

## CI/CD Pipeline

### `.github/workflows/ci.yml`
```yaml
name: CI

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v3
        with: { version: 9 }
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: pnpm }
      - run: pnpm install --frozen-lockfile

      - name: Type check
        run: pnpm typecheck

      - name: Lint
        run: pnpm lint

      - name: Unit tests
        run: pnpm test:unit
        env:
          DATABASE_URL: ${{ secrets.TEST_DATABASE_URL }}
          UPSTASH_REDIS_REST_URL: ${{ secrets.UPSTASH_REDIS_REST_URL }}
          UPSTASH_REDIS_REST_TOKEN: ${{ secrets.UPSTASH_REDIS_REST_TOKEN }}

      - name: Build
        run: pnpm build

  deploy-preview:
    needs: validate
    runs-on: ubuntu-latest
    if: github.event_name == 'pull_request'
    steps:
      - uses: actions/checkout@v4
      - uses: amondnet/vercel-action@v25
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: ${{ secrets.VERCEL_ORG_ID }}
          vercel-project-id: ${{ secrets.VERCEL_PROJECT_ID }}

  deploy-production:
    needs: validate
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    steps:
      - uses: actions/checkout@v4
      - uses: amondnet/vercel-action@v25
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: ${{ secrets.VERCEL_ORG_ID }}
          vercel-project-id: ${{ secrets.VERCEL_PROJECT_ID }}
          vercel-args: '--prod'
```

---

## Edge Cases in Production — Complete Register

### Payment Edge Cases

| Edge Case | Detection | Recovery |
|-----------|-----------|---------|
| Invoice expires before agent pays | `invoiceExpirySeconds` check on retry | Return 402 with fresh invoice + `Retry-After` header; original invoice invalidated |
| Agent pays but server misses preimage | Idempotency key on invoice creation | QStash retry for preimage lookup up to 3 times; timeout → refund |
| Agent pays same invoice twice | Preimage uniqueness in DB (`@unique`) | Second payment silently rejected (preimage already validated); agent gets 200 from cache |
| Agent underpays | MDK validates exact amount | Return 402 with correct invoice; log underpayment event |
| MDK node goes offline | Circuit breaker opens after 3 failures | Alby fallback activates automatically; if both down → 503 with `X-Retry-After: 30` |
| Agent retries with expired L402 token | Token expiry check in Redis | Return 401 (not 402) with `error: token_expired`; agent fetches new invoice |
| Macaroon tampering | HMAC validation by MDK | Return 401 with `error: invalid_token`; no new invoice issued |
| Duplicate invoice IDs (race condition) | DB unique constraint on `invoiceId` | Catch unique violation, return existing invoice |
| Concurrent payments for identical queries | Redis distributed lock on `queryHash` | First payment executes; second waits for lock release and returns cached result |

---

### Research Pipeline Edge Cases

| Edge Case | Detection | Recovery |
|-----------|-----------|---------|
| LangGraph exceeds max iterations | `iterations >= maxIterations` check in `detectGaps` node | Terminate gracefully; return best partial result with `{ complete: false, confidence: 0.6 }` |
| Tavily returns 0 results | `results.length === 0` in `parallelSearch` node | Broaden query (remove quotes, use synonyms via Claude); retry once; if still 0 → skip sub-question |
| Claude synthesis timeout (> 25s) | `AbortController` with 25s timeout | Return raw aggregated results without synthesis; flag `{ synthesized: false }` in response |
| SSE connection drops mid-research | Client sends `taskId` on reconnect to `/api/v1/research/status/:taskId` | Return current status from Redis (`research:task:{taskId}:status`) + partial results |
| Vercel function timeout (60s serverless) | Research > 55s triggers early termination | Flush current partial results via SSE; close stream gracefully with `{ type: 'timeout', partial: true }` |
| Circular loop in LangGraph | Hash of current query set matches previous iteration | Detect cycle, break immediately, return results gathered so far |
| Tavily research topic mismatch | Low relevance scores across all results | Auto-switch topic: `finance` if query contains financial terms, `news` if time-sensitive |
| LangSmith tracer unavailable | Network call to smith.langchain.com fails | Log warning; pipeline continues without tracing (LangSmith is observability, not critical path) |

---

### Agent Registry Edge Cases

| Edge Case | Detection | Recovery |
|-----------|-----------|---------|
| Agent endpoint offline at registration | Probe during registration (httpx GET with 5s timeout) | Reject registration with `error: endpoint_unreachable` |
| Agent endpoint returns non-200 on health check | QStash health check job | Mark agent `status: INACTIVE` after 3 consecutive failures; notify via webhook |
| Agent fails to deliver task | Task `completedAt` > deadline | QStash timeout job triggers escrow refund; agent reputation decremented |
| SSRF via agent endpoint URL | Validate URL on registration: no private IPs, no localhost, no file:// | Reject with `error: invalid_endpoint` |
| Agent registers same endpoint twice | `@unique` constraint on `endpoint` in DB | Return existing agent record; idempotent |
| Agent disputes task result | Client submits dispute via `/api/v1/tasks/:id/dispute` | Move task to `DISPUTED` status; escrow frozen; emit `task:disputed` event to human operator dashboard |
| Circular agent hiring (A→B→A) | Task chain depth limit (max 5 hops) | Detect cycle via task ancestry chain; reject with `error: circular_dependency` |
| Spam agent registrations | Rate limit: 3 registrations per Lightning address per hour | Return 429 with `Retry-After` |

---

### Database Edge Cases

| Edge Case | Detection | Recovery |
|-----------|-----------|---------|
| Neon connection pool exhausted | Prisma throws `P2024` (timeout) | Retry with exponential backoff (3 attempts); if still failing → 503 response |
| Migration fails in production | `prisma migrate deploy` non-zero exit | GitHub Actions blocks deploy; rollback via `prisma migrate rollback`; previous schema stays live |
| DB write succeeds but response fails | Payment confirmed in MDK but `Payment.create` throws | QStash idempotency retry; insert is idempotent on `invoiceId` (unique constraint) |
| SearchCache entry corrupted | Zod `.safeParse()` on cache read | Delete corrupted entry; re-fetch from Tavily |
| Concurrent reputation score update | Two tasks complete simultaneously for same agent | Postgres row-level lock in transaction: `UPDATE agents WHERE id = ? RETURNING *` |
| Neon auto-pause during demo | Free tier pauses after 5min inactivity | Keep-alive: ping DB every 4 minutes via QStash recurring job |

---

### Rate Limiting Edge Cases

| Edge Case | Detection | Recovery |
|-----------|-----------|---------|
| Upstash Redis down (rate limiter unavailable) | HTTP call to Upstash fails | **Fail open** (allow request) with warning log; log metric for monitoring |
| IP spoofing to bypass rate limits | Multiple IPs from same Lightning address | Rate limit ALSO by L402 macaroon identity (extracted from `lightningAddress`) |
| Burst traffic from legitimate agent | Rate limit window hit during valid batch operation | Sliding window + burst allowance: 100/min but allow burst of 20 within 5s |
| Rate limit counter persists incorrectly after Redis restart | Key TTL not set | All rate limit keys use `EX` TTL (window size × 2); self-healing |

---

### Network / API Edge Cases

| Edge Case | Detection | Recovery |
|-----------|-----------|---------|
| Tavily API down | Circuit breaker opens | Return cached results (if any) with `{ cached: true, stale: true }`; no new billing |
| Tavily rate limit (429) | `p-retry` catches 429 status | Parse `Retry-After` header; backoff exactly that long; max 2 retries |
| Anthropic API down | Circuit breaker + timeout | Return raw Tavily results without synthesis; flag `{ synthesized: false }` |
| Anthropic rate limit | 429 from Anthropic API | Switch to `claude-haiku-4-5` (higher rate limits) temporarily |
| Tavily search timeout (> 8s) | `AbortController` with 8s timeout | Return results from completed parallel searches; skip timed-out ones |
| Vercel Edge Function timeout (10s) | Vercel enforces hard cutoff | `flash` and `extract` endpoints are designed to complete in < 3s with proper caching |
| CORS preflight failure | Browser `OPTIONS` request | `vercel.json` CORS headers cover `*` for API routes; agents are not browsers but browsers use the playground |

---

### Security Edge Cases

| Edge Case | Detection | Recovery |
|-----------|-----------|---------|
| Prompt injection via query | Input contains `\n\nSystem:` or similar patterns | Pre-process query with allowlist characters; Claude system prompt explicitly instructs ignoring injected instructions |
| Large payload DoS | Request body > 1MB | Next.js `bodySizeLimit: '1mb'` in route config |
| API documentation scraping | High volume of OPTIONS/GET requests to API routes | Rate limit pre-payment requests too (50/min/IP) |
| SSRF via `/api/v1/extract` URLs | User submits private IP in `urls` array | Validate URL: block `localhost`, `127.*`, `10.*`, `192.168.*`, `169.254.*` |
| Path traversal in research queries | Malformed Unicode or path characters | Zod `z.string().max(500).regex(/^[a-zA-Z0-9 \?\.\,\!\'\"\-\_]+$/)` |
| JWT secret rotation | NEXTAUTH_SECRET changed | All dashboard sessions invalidated (acceptable — re-login required) |
| Stale L402 token replay | Token expiry in macaroon | Tokens are time-limited (24h max). Redis TTL matches token expiry. |

---

## Monitoring Setup

### Vercel Dashboard
- Automatically tracks: function invocations, errors, cold starts, latency
- Set alerts on: error rate > 1%, P95 latency > 5s, function timeouts

### LangSmith
- Review: research pipeline trace lengths, token costs, node failure rates
- Alert threshold: research completion rate < 80%

### Upstash Console
- Monitor: Redis memory usage, request rate, pub/sub message lag
- Alert: memory > 80% of limit

### Custom Metrics (logged via pino, visible in Vercel logs)
```typescript
logger.info({
  event: 'payment.completed',
  amountSats: 2,
  tier: 'BASIC',
  latencyMs: 840,
  cached: false,
})

logger.info({
  event: 'research.completed',
  taskId: 'xxx',
  iterations: 2,
  costSats: 10,
  confidence: 0.87,
  totalMs: 18400,
})
```

---

## Rollback Procedures

### Vercel Deployment Rollback
```bash
# List recent deployments
vercel ls

# Rollback to previous deployment
vercel rollback <deployment-url>
# Takes effect immediately — no downtime
```

### Database Migration Rollback
```bash
# Check migration status
npx prisma migrate status

# Rollback last migration (requires shadow DB on Neon)
npx prisma migrate rollback
```

### Feature Flag Emergency Disable
```typescript
// Set in Vercel Environment Variables (takes effect on next request)
NEXT_PUBLIC_ENABLE_AGENT_REGISTRY=false
NEXT_PUBLIC_ENABLE_ESCROW=false
```

---

## Production Checklist — Pre-Demo

```
Infrastructure
 [ ] Vercel deployment live at public URL
 [ ] Health check /api/v1/health returns { status: "healthy" }
 [ ] All 5 services reporting ok in health check
 [ ] Neon DB connected (test: prisma db pull succeeds)
 [ ] Upstash Redis connected (test: ping returns PONG)
 [ ] LangSmith tracing active (test: run one research query, verify trace appears)

Lightning
 [ ] MDK node connected and funded with small amount of mainnet sats
 [ ] Test invoice creation: create a 2-sat invoice manually
 [ ] Test payment: pay that invoice from a different wallet, verify it appears in DB
 [ ] Alby fallback configured and tested

API Endpoints
 [ ] POST /api/v1/search returns 402 without auth
 [ ] POST /api/v1/search returns 200 with valid L402 token
 [ ] POST /api/v1/research streams SSE events correctly
 [ ] POST /api/v1/synthesize returns cited answer
 [ ] GET /api/v1/agents returns agent list
 [ ] POST /api/v1/agents/register creates agent with stake payment

Dashboard
 [ ] /dashboard loads without errors
 [ ] Payment waterfall animates on payment arrival (test manually)
 [ ] SatFlowChart renders and updates
 [ ] AgentGraph renders with seeded agents
 [ ] Socket.io connection established (check browser console)

Demo Agent (Python)
 [ ] python -m nexus_agent "test query" completes end-to-end
 [ ] Agent wallet has sats (funded from MDK node)
 [ ] LangSmith shows trace from agent run
 [ ] Dashboard shows payments from agent run

Performance
 [ ] Flash search (cached) < 100ms (verify in Vercel function logs)
 [ ] Flash search (uncached) < 800ms
 [ ] Lightning invoice created in < 200ms
 [ ] Dashboard WebSocket lag < 2s
```

---

## Incident Response During Demo

### "Payment isn't working"
1. Check `/api/v1/health/lightning` — is the Lightning node connected?
2. If MDK node down → switch to Alby fallback manually: set `LIGHTNING_PROVIDER=alby` in Vercel env
3. If both down → switch demo to testnet mode (pre-paid tokens, no live payments)
4. Last resort: show pre-recorded 30-second demo video of the payment flow

### "Research is timing out"
1. Check LangSmith — which node is stuck?
2. Likely Tavily or Anthropic rate limit — wait 30 seconds, retry
3. Reduce `maxIterations` to 1 via feature flag: `RESEARCH_MAX_ITERATIONS=1`
4. Fall back to basic search tier for demo

### "Dashboard not showing real-time updates"
1. Check Socket.io connection in browser console
2. If WebSocket blocked → Socket.io auto-falls back to long polling (this is automatic)
3. If Upstash pub/sub down → payments still work, dashboard just doesn't update live; show payment table instead

### "Vercel deployment crashed"
1. Run `vercel rollback` immediately (30-second fix)
2. Use last known good deployment URL from `vercel ls`

### "Database is unreachable"
1. Check Neon dashboard — auto-pause? Click "Resume"
2. The keep-alive QStash job should prevent this, but if it fails, manually resume
3. Neon resumes in < 5 seconds

---

## Security Hardening Checklist

```
 [ ] All secrets in Vercel env vars (never in code or .env committed)
 [ ] .env.local in .gitignore
 [ ] pnpm-lock.yaml committed (reproducible installs)
 [ ] Prisma parameterized queries (no raw SQL with interpolation)
 [ ] Zod validation on every API endpoint input
 [ ] CORS headers restricted to necessary origins for /api/trpc (not wildcard)
 [ ] Rate limiting on all /api/v1/* routes, including pre-payment requests
 [ ] Request body size limit: 1MB
 [ ] L402 tokens are time-bounded (24h max)
 [ ] L402 tokens are query-bound (hash in macaroon)
 [ ] Private IP SSRF protection on extract endpoint
 [ ] Agent endpoint URL validation (no localhost, no private IPs)
 [ ] No raw queries stored (only SHA-256 hashes of queries in DB)
 [ ] HTTP security headers set in vercel.json (X-Frame-Options, X-Content-Type-Options)
```
