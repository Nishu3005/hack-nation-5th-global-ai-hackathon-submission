# Nexus — Technical Architecture

---

## System Overview

```
┌──────────────────────────────────────────────────────────────────────┐
│                         NEXUS PLATFORM                               │
│                                                                      │
│   ┌──────────────────────────────────────────────────────────────┐  │
│   │                  Next.js 15 App (Vercel Edge)                │  │
│   │                                                              │  │
│   │  ┌──────────────┐  ┌──────────────┐  ┌───────────────────┐ │  │
│   │  │  App Router  │  │  tRPC Layer  │  │  Socket.io Gateway│ │  │
│   │  │  (UI + SSR)  │  │  (Type-safe) │  │  (Real-time SSE)  │ │  │
│   │  └──────┬───────┘  └──────┬───────┘  └─────────┬─────────┘ │  │
│   │         │                 │                     │           │  │
│   │  ┌──────▼─────────────────▼─────────────────────▼────────┐ │  │
│   │  │                   Service Layer                        │ │  │
│   │  │                                                        │ │  │
│   │  │  ┌────────────┐  ┌───────────────┐  ┌──────────────┐ │ │  │
│   │  │  │ SearchSvc  │  │  ResearchSvc  │  │  PaymentSvc  │ │ │  │
│   │  │  │ (Tavily)   │  │  (LangGraph)  │  │  (MDK/L402)  │ │ │  │
│   │  │  └────────────┘  └───────────────┘  └──────────────┘ │ │  │
│   │  │                                                        │ │  │
│   │  │  ┌────────────┐  ┌───────────────┐  ┌──────────────┐ │ │  │
│   │  │  │  AgentSvc  │  │ ReputationSvc │  │ SynthesisSvc │ │ │  │
│   │  │  │ (Registry) │  │  (Oracle)     │  │  (Claude)    │ │ │  │
│   │  │  └────────────┘  └───────────────┘  └──────────────┘ │ │  │
│   │  └──────────────────────────────────────────────────────-─┘ │  │
│   └──────────────────────────────────────────────────────────────┘  │
│                                                                      │
│   ┌────────────┐  ┌──────────────┐  ┌────────────┐  ┌──────────┐  │
│   │  Neon DB   │  │ Upstash Redis│  │   Tavily   │  │   MDK    │  │
│   │ (Postgres) │  │ (Cache/PubSub│  │  Search API│  │ Lightning│  │
│   └────────────┘  └──────────────┘  └────────────┘  └──────────┘  │
└──────────────────────────────────────────────────────────────────────┘

External Agents (LangChain + LangGraph):
┌─────────────────────────────────────┐
│  Demo Agent (Python / TypeScript)   │
│                                     │
│  LangGraph Workflow:                │
│  [Task] → [Plan] → [Search/Pay] →  │
│  [Synthesize] → [Return Answer]     │
└─────────────────────────────────────┘
```

---

## Service Decomposition

### 1. SearchService
Wraps Tavily's `/search`, `/extract`, and `/research` endpoints with:
- Pricing per tier
- Result caching (Redis, TTL 5min for search, 30min for research)
- Source credibility scoring
- L402 token validation before execution

**Tiers:**
| Tier | Tavily Endpoint | Depth | Cost | Cache TTL |
|------|----------------|-------|------|-----------|
| `flash` | `/search` | `ultra-fast` | 1 sat | 5 min |
| `basic` | `/search` | `basic` | 2 sats | 10 min |
| `deep` | `/search` | `advanced` | 5 sats | 30 min |
| `research` | `/research` | full | 25 sats | 2 hours |
| `extract` | `/extract` | — | 1 sat | 1 hour |

### 2. ResearchService
Multi-step research pipeline powered by LangGraph.

**Workflow graph:**
```
[START]
   │
   ▼
[QueryAnalyzer]  ── classifies intent, extracts sub-questions
   │
   ▼
[ParallelSearcher]  ── spawns N concurrent Tavily searches (p-limit=3)
   │
   ▼
[ResultAggregator]  ── dedupes, ranks by relevance score
   │
   ▼
[GapDetector]  ── LLM evaluates if answer is complete; loops if not
   │     │
   │   (loop: re-search with refined queries, max 3 iterations)
   │
   ▼
[Synthesizer]  ── Claude generates cited, structured answer
   │
   ▼
[OutputFormatter]  ── adds confidence score, source list, cost breakdown
   │
   ▼
[END]
```

Each node emits SSE events so the client streams research progress in real time.

### 3. PaymentService
Core Lightning + L402 integration.

**Flow:**
```
Agent Request (no auth)
       │
       ▼
L402 Middleware
       │
       ▼
[Generate Invoice]  ── MDK creates bolt11 invoice for tier price
       │
       ▼
HTTP 402 + WWW-Authenticate: L402 <invoice>,<macaroon>
       │
       ▼ (agent pays invoice via their Lightning wallet)
       │
Agent Retries with Authorization: L402 <preimage>:<macaroon>
       │
       ▼
[Validate Preimage]  ── MDK verifies payment proof
       │
       ▼
[Issue Access Token]  ── JWT with tier, expiry, query hash
       │
       ▼
[Execute Service]  ── proceed with search/research/etc.
       │
       ▼
[Emit Payment Event]  ── Upstash pub/sub → WebSocket → Dashboard
```

**Token caching:** Validated L402 tokens are cached in Redis (keyed by preimage) so agents can reuse a single payment for identical queries within TTL.

### 4. AgentService (Registry)
Agents register as service providers. Staking mechanism ensures skin in the game.

**Agent record:**
```typescript
{
  id: nanoid(),
  name: string,
  endpoint: string,
  capabilities: Capability[],
  priceSats: number,
  stakeAmountSats: number,
  reputationScore: number,    // 0-100
  completedTasks: number,
  failedTasks: number,
  lightningAddress: string,
  createdAt: Date,
  lastSeenAt: Date,
}
```

**Registration requires staking** — the agent must pay a registration fee via Lightning to list. This fee funds the escrow pool.

### 5. ReputationService
Calculates and caches trust scores.

```
ReputationScore = (
  completionRate * 0.4 +
  averageResponseTime * 0.2 +
  disputeRate * 0.3 +
  stakingScore * 0.1
) * 100
```

Higher reputation → unlocks:
- Priority routing in marketplace
- Higher price ceiling
- Reduced escrow requirements

### 6. SynthesisService
Wraps Claude API for result synthesis. Uses prompt caching for identical query prefixes.

- Input: search results array + original query
- Output: structured response with `answer`, `citations`, `confidence`, `suggestedFollowups`
- Streaming via Vercel AI SDK's `streamText`

---

## Complete Technology Stack

### Core Framework
| Package | Version | Purpose |
|---------|---------|---------|
| `next` | 15.x | Full-stack framework, App Router |
| `react` | 19.x | UI library |
| `typescript` | 5.x | Type safety |
| `@vercel/analytics` | latest | Usage analytics |
| `@vercel/speed-insights` | latest | Performance monitoring |

### Lightning / Bitcoin
| Package | Purpose |
|---------|---------|
| `@moneydevkit/core` | L402 protocol, invoice generation, wallet |
| `@moneydevkit/react` | React hooks for Lightning |
| `alby-js-sdk` | Alby wallet integration (fallback) |
| `bolt11` | Lightning invoice encoding/decoding |
| `@getalby/lightning-tools` | Lightning utilities |
| `webln` | WebLN browser standard |

### AI / ML / Agents
| Package | Purpose |
|---------|---------|
| `langchain` | Core agent orchestration, tools, chains |
| `@langchain/core` | Core LangChain abstractions |
| `@langchain/anthropic` | Claude via LangChain |
| `@langchain/openai` | GPT-4o fallback via LangChain |
| `@langchain/community` | Community tools (web browsing, etc.) |
| `@langchain/langgraph` | Stateful multi-step agent workflows |
| `langsmith` | LangChain observability and tracing |
| `@tavily/core` | Tavily search + research SDK |
| `ai` | Vercel AI SDK (streaming, useChat, useCompletion) |
| `@anthropic-ai/sdk` | Direct Claude API (synthesis, safety) |
| `@openai/openai` | OpenAI fallback |

### API Layer
| Package | Purpose |
|---------|---------|
| `@trpc/server` | Type-safe RPC server |
| `@trpc/client` | Type-safe RPC client |
| `@trpc/next` | Next.js integration |
| `@trpc/react-query` | React Query adapter |
| `zod` | Schema validation (all inputs/outputs) |
| `superjson` | Serialization (dates, bigints) |

### Database & Cache
| Package | Purpose |
|---------|---------|
| `prisma` | ORM + migration management |
| `@prisma/client` | Generated Prisma client |
| `@neondatabase/serverless` | Neon Postgres (Vercel-native, serverless) |
| `@upstash/redis` | Serverless Redis (caching, pub/sub) |
| `@upstash/ratelimit` | Token bucket rate limiting |
| `@upstash/qstash` | Background job queue |

### Real-time
| Package | Purpose |
|---------|---------|
| `socket.io` | WebSocket server |
| `socket.io-client` | WebSocket client |
| `eventsource-parser` | Server-Sent Events stream parsing |

### Frontend UI
| Package | Purpose |
|---------|---------|
| `tailwindcss` | Utility-first CSS |
| `@shadcn/ui` | Accessible component library |
| `framer-motion` | Animations (payment waterfall, graph) |
| `recharts` | Charts (sat flow over time) |
| `@tremor/react` | Dashboard metric cards |
| `lucide-react` | Icon set |
| `@radix-ui/react-*` | Headless UI primitives |
| `cmdk` | Command palette (agent search) |
| `sonner` | Toast notifications |
| `vaul` | Drawer component |
| `next-themes` | Dark mode |
| `class-variance-authority` | Component variant management |
| `clsx` | Class merging |
| `tailwind-merge` | Tailwind class deduplication |
| `@xyflow/react` | Node graph (agent relationship visualization) |

### State Management
| Package | Purpose |
|---------|---------|
| `zustand` | Global client state |
| `@tanstack/react-query` | Server state + data fetching |
| `jotai` | Atomic state for real-time payment stream |
| `immer` | Immutable state updates |

### Utility
| Package | Purpose |
|---------|---------|
| `nanoid` | Unique ID generation |
| `date-fns` | Date formatting |
| `p-limit` | Concurrency control (parallel Tavily calls) |
| `p-retry` | Exponential backoff retry |
| `bottleneck` | Rate limiter for outbound API calls |
| `lru-cache` | In-memory LRU cache |
| `ms` | Human-readable time strings |
| `winston` | Structured logging |
| `pino` | High-performance logger |
| `pino-pretty` | Dev log formatting |

### Observability
| Package | Purpose |
|---------|---------|
| `@opentelemetry/api` | OpenTelemetry instrumentation |
| `@opentelemetry/sdk-node` | OTel Node SDK |
| `langsmith` | LangChain trace observability |

### Auth (Human Dashboard)
| Package | Purpose |
|---------|---------|
| `next-auth` | Auth.js v5 for human operators |
| `@auth/prisma-adapter` | Prisma DB adapter |

### Testing
| Package | Purpose |
|---------|---------|
| `vitest` | Unit + integration tests |
| `@testing-library/react` | Component testing |
| `@testing-library/user-event` | User interaction simulation |
| `playwright` | End-to-end tests |
| `msw` | API mock service worker |

### Dev Tooling
| Package | Purpose |
|---------|---------|
| `eslint` | Linting |
| `prettier` | Code formatting |
| `husky` | Git hooks |
| `lint-staged` | Pre-commit lint |
| `@commitlint/cli` | Commit message standards |
| `tsx` | TypeScript script runner |
| `dotenv-cli` | Env var management |

### Python Agent Service (separate)
| Package | Purpose |
|---------|---------|
| `langchain` | Core orchestration |
| `langgraph` | Stateful workflows |
| `langchain-anthropic` | Claude via LangChain |
| `tavily-python` | Tavily SDK |
| `fastapi` | REST API |
| `uvicorn` | ASGI server |
| `httpx` | Async HTTP client (calls Nexus API) |
| `bolt11` | Invoice parsing |
| `pydantic` | Data validation |
| `pydantic-settings` | Config management |
| `structlog` | Structured logging |
| `tenacity` | Retry logic |
| `redis` | Redis pub/sub subscription |
| `pytest` | Testing |
| `pytest-asyncio` | Async test support |

---

## Real-time Architecture: SSE over Socket.io

**Decision: Server-Sent Events (SSE), not Socket.io**

Socket.io requires persistent TCP connections which are incompatible with Vercel Edge and Serverless functions (stateless, no persistent connections). Rather than introduce a separate Fly.io server, we use **native SSE** which:
- Works perfectly on Vercel Serverless streaming responses
- Is supported by every modern browser and HTTP client
- Is simpler to implement than WebSocket for our use case (server→client push only)
- Requires no additional infrastructure

**Pattern:**
```
Client connects: GET /api/v1/stream
→ Server returns Content-Type: text/event-stream
→ Vercel Serverless function stays alive streaming events
→ Events published via Upstash pub/sub → picked up → written to SSE stream

Payment event flow:
  [Edge Function /api/v1/search]
      → payment confirmed
      → publish to Upstash channel "nexus:events"
      ↓
  [Serverless /api/v1/stream]
      → subscribed to Upstash channel
      → writes "data: {...}\n\n" to SSE stream
      ↓
  [Browser dashboard]
      → EventSource('/api/v1/stream')
      → receives event, updates UI
```

**Client-side reconnect:**
```typescript
const es = new EventSource('/api/v1/stream')
es.addEventListener('payment:received', (e) => updateWaterfall(JSON.parse(e.data)))
es.onerror = () => setTimeout(() => reconnect(), 1000) // auto-reconnect
```

No Socket.io dependency anywhere. Simpler, more reliable, Vercel-native.

---

## Database Schema (Prisma — Production-Grade with Indexes)

```prisma
model Payment {
  id            String        @id @default(cuid())
  invoiceId     String        @unique                // MDK invoice ID
  preimage      String?       @unique                // set when payment confirmed
  amountSats    Int
  tier          Tier
  queryHash     String                               // sha256(query+tier), NOT raw query
  status        PaymentStatus @default(PENDING)
  agentId       String?
  createdAt     DateTime      @default(now())
  settledAt     DateTime?
  expiresAt     DateTime                             // invoice expiry time
  metadata      Json?                               // Tavily request metadata
  agent         Agent?        @relation(fields: [agentId], references: [id])

  @@index([status, createdAt])                      // dashboard: recent payments by status
  @@index([agentId, createdAt])                     // agent payment history
  @@index([queryHash])                              // cache invalidation
  @@index([expiresAt])                              // cleanup expired invoices
}

model Agent {
  id               String    @id @default(cuid())
  name             String    @unique
  endpoint         String    @unique                // SSRF-validated on write
  lightningAddress String
  capabilities     String[]
  description      String    @default("")
  priceSats        Int
  stakeAmountSats  Int       @default(0)
  reputationScore  Float     @default(50)           // 0-100, computed on write
  completedTasks   Int       @default(0)
  failedTasks      Int       @default(0)
  disputedTasks    Int       @default(0)
  isVerified       Boolean   @default(false)
  isActive         Boolean   @default(true)
  lastHealthCheck  DateTime?
  createdAt        DateTime  @default(now())
  lastSeenAt       DateTime  @updatedAt
  payments         Payment[]
  tasks            Task[]    @relation("hiree")
  hiredTasks       Task[]    @relation("hirer")

  @@index([reputationScore])                        // discovery: sort by reputation
  @@index([isActive, reputationScore])              // active agents, sorted
  @@index([createdAt])                              // newest agents
}

model Task {
  id            String     @id @default(cuid())
  hireeAgentId  String                              // the agent doing the work
  hirerAgentId  String?                             // the agent that hired (null = human)
  type          TaskType
  status        TaskStatus @default(PENDING)
  inputHash     String                              // sha256 of task description
  outputHash    String?                             // sha256 of delivered output
  priceSats     Int                                // agent's listed price
  platformFeeSats Int      @default(0)             // 10% of priceSats
  escrowSats    Int                                // total held in escrow
  deadline      DateTime
  completedAt   DateTime?
  createdAt     DateTime   @default(now())
  hiree         Agent      @relation("hiree", fields: [hireeAgentId], references: [id])
  hirer         Agent?     @relation("hirer", fields: [hirerAgentId], references: [id])

  @@index([hireeAgentId, status])                  // agent: my active tasks
  @@index([status, deadline])                       // expired escrow cleanup
  @@index([createdAt])
}

model SearchCache {
  id          String   @id @default(cuid())
  queryHash   String   @unique                      // sha256(query + tier)
  tier        Tier
  results     Json                                  // full Tavily response
  expiresAt   DateTime
  createdAt   DateTime @default(now())
  hitCount    Int      @default(0)

  @@index([expiresAt])                             // TTL cleanup job
  @@index([hitCount])                              // identify hot queries
}

model InvoiceIdempotency {
  id           String   @id @default(cuid())
  requestHash  String   @unique                    // sha256(endpoint + body + ip)
  invoiceId    String
  amountSats   Int
  createdAt    DateTime @default(now())
  expiresAt    DateTime                            // same as bolt11 expiry

  @@index([expiresAt])                            // cleanup expired keys
}

enum Tier          { FLASH BASIC DEEP RESEARCH EXTRACT }
enum PaymentStatus { PENDING PAID EXPIRED FAILED REFUNDED }
enum TaskStatus    { PENDING ESCROW REVIEW COMPLETED DISPUTED REFUNDED }
enum TaskType      { SEARCH RESEARCH SYNTHESIS CODE_REVIEW DATA_ANALYSIS CUSTOM }
```

---

## API Contract

### Public Endpoints (L402 Gated)

```
POST /api/v1/search
  Headers: Authorization: L402 <preimage>:<macaroon>  (or absent → 402)
  Body: { query: string, tier: Tier, options?: SearchOptions }
  Response 402: { invoice: string, macaroon: string, amountSats: number }
  Response 200: { results: Result[], cost: number, cached: boolean, requestId: string }

POST /api/v1/research
  [same L402 pattern]
  Body: { query: string, maxIterations?: number, streaming?: boolean }
  Response: SearchResult + citations + confidence + suggestedFollowups
  Streaming: SSE with events: { type: 'progress' | 'result' | 'complete', data: any }

POST /api/v1/synthesize
  [same L402 pattern]
  Body: { query: string, results: Result[], format?: 'markdown' | 'json' }
  Response: { answer: string, citations: Citation[], confidence: number }

POST /api/v1/extract
  [same L402 pattern]
  Body: { urls: string[], options?: ExtractOptions }
  Response: { extracts: Extract[], cost: number }
```

### Agent Registry Endpoints

```
POST /api/v1/agents/register
  [L402 gated — registration requires stake payment]
  Body: { name, endpoint, capabilities, priceSats, lightningAddress }
  Response: { agentId, verificationToken }

GET /api/v1/agents
  Public
  Query: ?capability=search&minReputation=60&maxPriceSats=100
  Response: { agents: Agent[], total: number }

GET /api/v1/agents/:id
  Public
  Response: { agent: Agent, recentTasks: Task[], performanceMetrics: Metrics }

POST /api/v1/agents/:id/task
  [L402 gated — task price = agent's listed price + platform fee 10%]
  Body: { task: string, context?: any, deadline?: string }
  Response: { taskId, estimatedCompletion, escrowInvoice }
```

### Internal / WebSocket

```
WS /api/socket
  Events emitted by server:
    'payment:received'  { amountSats, tier, agentId, timestamp }
    'research:progress' { taskId, step, message, percentComplete }
    'agent:registered'  { agentId, name, capabilities }
    'task:completed'    { taskId, agentId, outputHash }
```

---

## LangGraph Research Workflow (Detailed)

```typescript
// State definition
interface ResearchState {
  query: string
  subQuestions: string[]
  searchResults: Result[][]
  gaps: string[]
  iterations: number
  finalAnswer: string | null
  citations: Citation[]
  confidence: number
  costSats: number
}

// Graph nodes
const graph = new StateGraph<ResearchState>({
  channels: researchStateSchema,
})
  .addNode('analyzeQuery', analyzeQueryNode)       // Claude: extract sub-questions
  .addNode('parallelSearch', parallelSearchNode)   // Tavily: N concurrent searches
  .addNode('aggregateResults', aggregateNode)      // Rank + dedupe results
  .addNode('detectGaps', detectGapsNode)           // Claude: is the answer complete?
  .addNode('synthesize', synthesizeNode)           // Claude: generate final answer
  .addNode('formatOutput', formatOutputNode)       // Structure + add metadata

  .addEdge(START, 'analyzeQuery')
  .addEdge('analyzeQuery', 'parallelSearch')
  .addEdge('parallelSearch', 'aggregateResults')
  .addEdge('aggregateResults', 'detectGaps')
  .addConditionalEdges('detectGaps', shouldContinueResearch, {
    continue: 'parallelSearch',  // loop back with refined queries
    done: 'synthesize',
  })
  .addEdge('synthesize', 'formatOutput')
  .addEdge('formatOutput', END)
  .compile()
```

Each node emits an SSE event via Upstash pub/sub → picked up by Socket.io gateway → pushed to dashboard.

---

## Caching Strategy

```
L1: In-Memory LRU (lru-cache)
  - Hot query results
  - TTL: 60 seconds
  - Max: 500 entries

L2: Upstash Redis
  - Search results by query hash + tier
  - TTL: tier-dependent (5min flash → 2hr research)
  - L402 token validation cache (TTL: token expiry)
  - Rate limit counters (sliding window)

L3: Neon DB
  - Full result history (permanent)
  - Agent registry
  - Reputation scores
  - Payment records
```

---

## Security Model

1. **L402 Macaroons** — time-bound, query-bound tokens. A preimage for query A cannot be replayed for query B (query hash baked into macaroon).
2. **Input validation** — Zod schemas on every endpoint. SQL injection impossible via Prisma parameterized queries.
3. **Rate limiting** — Upstash sliding window: 100 req/min per IP, 10 concurrent research tasks global.
4. **Output sanitization** — Claude's built-in safety layer + explicit system prompt for search synthesis.
5. **Agent endpoint verification** — registered agent endpoints are probed before listing; periodic health checks.
6. **Escrow timeouts** — unclaimed task esrows auto-refund after 1 hour via QStash scheduled job.

---

## Deployment Architecture (Vercel)

```
vercel.json
├── Edge Functions: /api/v1/search, /api/v1/extract  (latency-critical)
├── Serverless Functions: /api/v1/research, /api/v1/agents/*  (heavy compute)
├── Static: all UI pages
└── Environment:
    TAVILY_API_KEY
    ANTHROPIC_API_KEY
    MDK_SECRET_KEY
    DATABASE_URL (Neon)
    UPSTASH_REDIS_URL
    UPSTASH_REDIS_TOKEN
    LANGCHAIN_API_KEY (LangSmith)
    NEXTAUTH_SECRET
```

---

## Performance Targets

| Operation | Target P95 | Notes |
|-----------|-----------|-------|
| Flash search (cached) | < 100ms | Redis hit |
| Flash search (uncached) | < 800ms | Tavily ultra-fast |
| Basic search | < 1.5s | Tavily basic |
| Deep search | < 3s | Tavily advanced |
| Research (streaming) | < 30s total | LangGraph multi-step |
| L402 invoice creation | < 200ms | MDK |
| Payment validation | < 300ms | MDK preimage check |
| Dashboard real-time lag | < 2s | Upstash → Socket.io |
