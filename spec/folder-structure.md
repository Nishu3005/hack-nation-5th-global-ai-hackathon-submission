# Nexus — Folder Structure

Full annotated file tree for the monorepo.

---

```
nexus/
│
├── .github/
│   └── workflows/
│       └── ci.yml                    # lint, typecheck, test on push
│
├── apps/
│   ├── web/                          # Next.js 15 main application (deployed on Vercel)
│   │   │
│   │   ├── app/                      # App Router
│   │   │   ├── layout.tsx            # Root layout: ThemeProvider, QueryProvider, SocketProvider
│   │   │   ├── page.tsx              # Landing page (hero + live payment ticker)
│   │   │   ├── globals.css           # Tailwind base styles
│   │   │   │
│   │   │   ├── dashboard/            # Human operator dashboard
│   │   │   │   ├── layout.tsx        # Dashboard shell with sidebar
│   │   │   │   ├── page.tsx          # Overview: stats cards, payment waterfall, agent graph
│   │   │   │   ├── payments/
│   │   │   │   │   └── page.tsx      # Full payment history table
│   │   │   │   ├── agents/
│   │   │   │   │   ├── page.tsx      # Agent registry browser
│   │   │   │   │   └── [id]/
│   │   │   │   │       └── page.tsx  # Individual agent profile + reputation timeline
│   │   │   │   └── research/
│   │   │   │       └── page.tsx      # Live research task monitor
│   │   │   │
│   │   │   ├── playground/           # Interactive demo (for pitch/judges)
│   │   │   │   └── page.tsx          # Run a search/research with live payment flow
│   │   │   │
│   │   │   └── api/
│   │   │       ├── trpc/
│   │   │       │   └── [trpc]/
│   │   │       │       └── route.ts  # tRPC HTTP handler
│   │   │       │
│   │   │       ├── socket/
│   │   │       │   └── route.ts      # Socket.io upgrade handler
│   │   │       │
│   │   │       └── v1/               # Public API (L402-gated)
│   │   │           ├── search/
│   │   │           │   └── route.ts  # POST /api/v1/search
│   │   │           ├── research/
│   │   │           │   └── route.ts  # POST /api/v1/research (streaming SSE)
│   │   │           ├── synthesize/
│   │   │           │   └── route.ts  # POST /api/v1/synthesize
│   │   │           ├── extract/
│   │   │           │   └── route.ts  # POST /api/v1/extract
│   │   │           └── agents/
│   │   │               ├── route.ts          # GET (list), POST (register)
│   │   │               └── [id]/
│   │   │                   ├── route.ts      # GET agent profile
│   │   │                   └── task/
│   │   │                       └── route.ts  # POST hire agent
│   │   │
│   │   ├── components/
│   │   │   ├── ui/                   # shadcn/ui generated components
│   │   │   │   ├── button.tsx
│   │   │   │   ├── card.tsx
│   │   │   │   ├── badge.tsx
│   │   │   │   ├── dialog.tsx
│   │   │   │   ├── input.tsx
│   │   │   │   ├── table.tsx
│   │   │   │   ├── tabs.tsx
│   │   │   │   └── ...
│   │   │   │
│   │   │   ├── dashboard/
│   │   │   │   ├── PaymentWaterfall.tsx   # Real-time sat payment stream (Framer Motion)
│   │   │   │   ├── AgentGraph.tsx         # @xyflow/react node graph of agent relationships
│   │   │   │   ├── SatFlowChart.tsx       # Recharts: sats per hour over time
│   │   │   │   ├── MetricsRow.tsx         # Tremor metric cards
│   │   │   │   ├── ResearchProgress.tsx   # LangGraph step progress indicator
│   │   │   │   └── LivePaymentTicker.tsx  # Horizontal scrolling payment feed (landing)
│   │   │   │
│   │   │   ├── playground/
│   │   │   │   ├── QueryInput.tsx         # Query box with tier selector
│   │   │   │   ├── PaymentModal.tsx       # L402 invoice display + status
│   │   │   │   ├── ResultsPanel.tsx       # Cited results with source cards
│   │   │   │   └── ResearchStream.tsx     # SSE streaming display
│   │   │   │
│   │   │   └── layout/
│   │   │       ├── Sidebar.tsx
│   │   │       ├── TopNav.tsx
│   │   │       └── ThemeToggle.tsx
│   │   │
│   │   ├── lib/
│   │   │   ├── trpc/
│   │   │   │   ├── client.ts          # tRPC client (with React Query)
│   │   │   │   ├── server.ts          # tRPC context + server client
│   │   │   │   └── router/
│   │   │   │       ├── index.ts       # Root router (merges all sub-routers)
│   │   │   │       ├── payments.ts    # Payment history queries
│   │   │   │       ├── agents.ts      # Agent registry queries/mutations
│   │   │   │       └── analytics.ts   # Dashboard stats
│   │   │   │
│   │   │   ├── socket/
│   │   │   │   ├── server.ts          # Socket.io server instance
│   │   │   │   └── client.ts          # Socket.io client + event types
│   │   │   │
│   │   │   └── providers/
│   │   │       ├── QueryProvider.tsx  # React Query + tRPC provider
│   │   │       ├── SocketProvider.tsx # Socket.io context
│   │   │       └── ThemeProvider.tsx  # next-themes
│   │   │
│   │   ├── server/
│   │   │   ├── services/
│   │   │   │   ├── search.service.ts       # Tavily wrapper + caching
│   │   │   │   ├── research.service.ts     # LangGraph orchestration
│   │   │   │   ├── synthesis.service.ts    # Claude synthesis
│   │   │   │   ├── payment.service.ts      # MDK/L402 invoice + validation
│   │   │   │   ├── agent.service.ts        # Agent registry CRUD
│   │   │   │   └── reputation.service.ts   # Score calculation
│   │   │   │
│   │   │   ├── middleware/
│   │   │   │   ├── l402.middleware.ts      # L402 enforcement for API routes
│   │   │   │   ├── ratelimit.middleware.ts # Upstash rate limiting
│   │   │   │   └── validate.middleware.ts  # Zod validation wrapper
│   │   │   │
│   │   │   ├── workflows/
│   │   │   │   ├── research.graph.ts       # LangGraph research state machine
│   │   │   │   ├── nodes/
│   │   │   │   │   ├── analyzeQuery.ts
│   │   │   │   │   ├── parallelSearch.ts
│   │   │   │   │   ├── aggregateResults.ts
│   │   │   │   │   ├── detectGaps.ts
│   │   │   │   │   ├── synthesize.ts
│   │   │   │   │   └── formatOutput.ts
│   │   │   │   └── utils/
│   │   │   │       ├── searchTools.ts      # LangChain tools wrapping Tavily
│   │   │   │       └── streamEmitter.ts    # SSE + Upstash pub/sub emitter
│   │   │   │
│   │   │   ├── db/
│   │   │   │   ├── client.ts               # Prisma + Neon client singleton
│   │   │   │   └── queries/
│   │   │   │       ├── payments.ts
│   │   │   │       ├── agents.ts
│   │   │   │       └── cache.ts
│   │   │   │
│   │   │   ├── cache/
│   │   │   │   ├── redis.ts                # Upstash Redis client
│   │   │   │   ├── lru.ts                  # In-memory LRU (lru-cache)
│   │   │   │   └── keys.ts                 # Cache key factories
│   │   │   │
│   │   │   └── logger/
│   │   │       └── index.ts                # Pino logger instance
│   │   │
│   │   ├── stores/
│   │   │   ├── usePaymentStream.ts    # Zustand: real-time payment events
│   │   │   ├── useAgentRegistry.ts    # Zustand: agent list
│   │   │   └── useResearchTask.ts     # Jotai atoms: research progress
│   │   │
│   │   ├── hooks/
│   │   │   ├── useL402.ts             # L402 payment flow hook (fetch → 402 → pay → retry)
│   │   │   ├── useSocket.ts           # Typed Socket.io event hooks
│   │   │   ├── useResearchStream.ts   # SSE subscription for research progress
│   │   │   └── useSatFormatter.ts     # Format sats ↔ USD display
│   │   │
│   │   ├── types/
│   │   │   ├── api.ts                 # All request/response types (shared with client)
│   │   │   ├── lightning.ts           # Lightning/L402 types
│   │   │   ├── research.ts            # LangGraph state types
│   │   │   └── agent.ts               # Agent registry types
│   │   │
│   │   ├── config/
│   │   │   ├── pricing.ts             # Sat prices per tier (single source of truth)
│   │   │   ├── research.ts            # LangGraph config (max iterations, timeout)
│   │   │   └── features.ts            # Feature flags
│   │   │
│   │   ├── prisma/
│   │   │   ├── schema.prisma
│   │   │   └── migrations/
│   │   │
│   │   ├── __tests__/
│   │   │   ├── unit/
│   │   │   │   ├── search.service.test.ts
│   │   │   │   ├── payment.service.test.ts
│   │   │   │   ├── reputation.service.test.ts
│   │   │   │   └── research.graph.test.ts
│   │   │   ├── integration/
│   │   │   │   ├── l402.test.ts           # Full payment flow
│   │   │   │   └── research.test.ts       # LangGraph end-to-end
│   │   │   └── e2e/
│   │   │       └── playground.spec.ts     # Playwright: full UI + payment demo
│   │   │
│   │   ├── public/
│   │   │   ├── nexus-logo.svg
│   │   │   └── og-image.png               # Open Graph for sharing
│   │   │
│   │   ├── .env.local                     # Local secrets (gitignored)
│   │   ├── .env.example                   # Template for env vars
│   │   ├── next.config.ts
│   │   ├── tailwind.config.ts
│   │   ├── tsconfig.json
│   │   ├── vitest.config.ts
│   │   └── package.json
│   │
│   └── agent/                        # Reference demo agent (Python)
│       │
│       ├── nexus_agent/
│       │   ├── __init__.py
│       │   ├── main.py               # Entry point: receives task, runs workflow
│       │   │
│       │   ├── client/
│       │   │   ├── nexus.py          # Nexus API client (handles L402 automatically)
│       │   │   └── l402.py           # L402 handshake logic
│       │   │
│       │   ├── wallet/
│       │   │   ├── lightning.py      # Lexe/MDK wallet integration
│       │   │   └── invoice.py        # bolt11 invoice parsing
│       │   │
│       │   ├── workflows/
│       │   │   ├── research_agent.py # LangGraph: autonomous research workflow
│       │   │   ├── nodes/
│       │   │   │   ├── plan.py       # Decompose task into sub-queries
│       │   │   │   ├── search.py     # Call Nexus search (pays automatically)
│       │   │   │   ├── verify.py     # Verify answer completeness
│       │   │   │   └── report.py     # Format final cited report
│       │   │   └── tools/
│       │   │       ├── nexus_search.py     # LangChain tool: Nexus search
│       │   │       ├── nexus_research.py   # LangChain tool: Nexus deep research
│       │   │       └── nexus_synthesize.py # LangChain tool: Nexus synthesis
│       │   │
│       │   ├── config.py             # Pydantic settings
│       │   └── logger.py             # structlog setup
│       │
│       ├── tests/
│       │   ├── test_l402.py
│       │   ├── test_workflow.py
│       │   └── conftest.py
│       │
│       ├── requirements.txt
│       ├── pyproject.toml
│       └── README.md
│
├── packages/                          # Shared code (if using Turborepo)
│   └── shared/
│       ├── src/
│       │   ├── types/                 # Types shared between web + agent
│       │   │   ├── api.ts
│       │   │   └── lightning.ts
│       │   └── constants/
│       │       └── pricing.ts
│       ├── tsconfig.json
│       └── package.json
│
├── docs/
│   ├── api-reference.md              # Public API docs (for judges to verify)
│   ├── l402-flow.md                  # L402 flow diagram
│   └── demo-script.md                # Step-by-step pitch demo
│
├── scripts/
│   ├── seed-db.ts                    # Seed demo data (agents, fake payments)
│   ├── test-payment.ts               # Manual L402 flow test script
│   └── benchmark-search.ts           # Latency benchmarking
│
├── vercel.json                        # Deployment config (edge vs serverless routing)
├── turbo.json                         # Turborepo pipeline config
├── pnpm-workspace.yaml               # Monorepo workspace
├── package.json                       # Root: scripts, workspaces
├── .eslintrc.json
├── .prettierrc
├── .gitignore
└── README.md                          # Project overview + quick start
```

---

## Key File Responsibilities (Critical Path)

| File | Purpose | Build Order |
|------|---------|-------------|
| `server/middleware/l402.middleware.ts` | The core — everything gates on this | Phase 1 |
| `server/services/payment.service.ts` | MDK integration, invoice creation | Phase 1 |
| `app/api/v1/search/route.ts` | First working endpoint | Phase 1 |
| `server/services/search.service.ts` | Tavily wrapper + Redis cache | Phase 1 |
| `server/workflows/research.graph.ts` | LangGraph state machine | Phase 2 |
| `app/api/v1/research/route.ts` | Streaming SSE endpoint | Phase 2 |
| `server/services/agent.service.ts` | Agent registry | Phase 3 |
| `lib/socket/server.ts` | Real-time event gateway | Phase 3 |
| `components/dashboard/PaymentWaterfall.tsx` | The "wow" visual for judges | Phase 3 |
| `apps/agent/nexus_agent/main.py` | Demo agent that runs during pitch | Phase 4 |

---

## Environment Variables Reference

```bash
# Tavily
TAVILY_API_KEY=tvly-xxx

# Anthropic
ANTHROPIC_API_KEY=sk-ant-xxx

# Lightning (MDK)
MDK_SECRET_KEY=xxx
MDK_NODE_URL=xxx

# Database
DATABASE_URL=postgresql://xxx@xxx.neon.tech/nexus

# Redis
UPSTASH_REDIS_REST_URL=https://xxx.upstash.io
UPSTASH_REDIS_REST_TOKEN=xxx

# LangSmith (observability)
LANGCHAIN_API_KEY=ls__xxx
LANGCHAIN_TRACING_V2=true
LANGCHAIN_PROJECT=nexus-hackathon

# Auth (human dashboard)
NEXTAUTH_SECRET=xxx
NEXTAUTH_URL=https://nexus.vercel.app

# QStash (background jobs)
QSTASH_TOKEN=xxx
QSTASH_URL=xxx

# Feature flags
NEXT_PUBLIC_ENABLE_AGENT_REGISTRY=true
NEXT_PUBLIC_ENABLE_ESCROW=false  # Phase 4 only
```
