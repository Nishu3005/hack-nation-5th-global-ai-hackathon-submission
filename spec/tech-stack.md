# Nexus — Tech Stack (Decision-Grade Reference)

> Every choice here has a reason. This document explains not just WHAT we use, but WHY — and what we explicitly rejected and why.

---

## Stack Philosophy

Three non-negotiable constraints shaped every decision:

1. **Agent-native**: The primary consumer of Nexus is a machine, not a human. APIs must be machine-readable, responses must be structured, auth must be programmatic. Anything designed only for browsers gets deprioritized.

2. **Sponsor-aligned by default**: Vercel → use their edge infrastructure deeply. Tavily → use all four endpoints as the intelligence backbone, not a wrapper. Spiral → Lightning is not a payment method, it is the reason the product exists. Every technical choice must reinforce these.

3. **Zero ops during the hackathon**: We cannot manage infrastructure during a 24-hour sprint. Every external dependency must be serverless, auto-scaling, and zero-config. If it requires a running server we manage, it's off the list.

---

## Layer 1: Foundation

### Next.js 15 (App Router)
**Why:** The only full-stack TypeScript framework with native Vercel support at the edge. App Router gives us React Server Components (RSC) for zero-JS server renders, native streaming via `Suspense`, and route handlers that deploy as edge or serverless functions with one config line.

**Why NOT Remix/Astro/Express:** Remix has no native Vercel edge support. Astro is frontend-only. Express requires a managed server (violates zero-ops constraint). Next.js is Vercel's own framework — we get first-class support, faster cold starts, and edge-native streaming.

**How it connects to Vercel:** Route handlers in `app/api/v1/*` deploy as Vercel Edge Functions or Serverless Functions based on the `export const runtime` declaration. No config file needed. ISR on registry pages via `revalidate`.

---

### TypeScript 5.x (strict mode)
**Why:** End-to-end type safety. tRPC carries types from DB schema → service layer → API → client without a single type assertion. In a 24-hour sprint, type errors at compile time save hours of runtime debugging.

**Config:** `strict: true`, `noUncheckedIndexedAccess: true`, `exactOptionalPropertyTypes: true`. We are not relaxing these under time pressure — they prevent entire categories of bugs.

---

### pnpm + Turborepo
**Why:** Monorepo with `apps/web` and `apps/agent`. pnpm's symlinked node_modules are 3× faster to install than npm. Turborepo caches build artifacts so repeated builds of unchanged packages are instant.

**Why NOT npm workspaces/yarn:** npm workspaces have no build caching. Yarn berry's PnP mode breaks several packages. pnpm + Turborepo is the production-grade standard for Next.js monorepos.

---

## Layer 2: Lightning / Bitcoin (The Core)

### MoneyDevKit (MDK) — `@moneydevkit/core`, `@moneydevkit/react`
**Why:** MDK is the only SDK that ships L402 protocol + agent wallet + Next.js integration in one package. It handles the full L402 handshake: invoice generation, macaroon issuance, preimage validation. Without it, we'd implement L402 from scratch — a 2-day job.

**What it does for us:**
- `createInvoice(sats, metadata)` → bolt11 string + macaroon string
- `validateL402Token(preimage, macaroon)` → boolean
- Agent wallet: can pay invoices programmatically (for the demo agent)
- React hooks: `useLightningPayment()` for the browser playground

**How it connects to Spiral:** MDK was built by people aligned with Lightning ecosystem values. Using it is a direct vote for open Lightning tooling over proprietary payment SDKs.

---

### Alby SDK — `alby-js-sdk`, `@getalby/lightning-tools`
**Why:** Alby is the fallback payment provider if MDK's node has issues. Also provides WebLN browser standard support so judges can pay from a browser Lightning wallet during the playground demo.

**Specific use:** `webln.sendPayment(invoice)` in the Playground UI — if a judge has an Alby browser extension, they can pay the invoice with one click and see the whole flow without needing a terminal.

---

### `bolt11`
**Why:** Pure JS library for decoding Lightning invoices. Used to extract `amount`, `expiry`, `paymentHash` from bolt11 strings for display in the UI and for validation logic. No external API call, zero latency.

---

### `webln`
**Why:** Browser WebLN standard (like MetaMask but for Lightning). Lets browser-based agents and human judges pay invoices directly from a compatible wallet extension. One line: `window.webln.sendPayment(invoice)`.

---

## Layer 3: AI / ML / Agents (The Intelligence)

### LangChain — `langchain`, `@langchain/core`, `@langchain/anthropic`, `@langchain/community`
**Why:** LangChain is the de-facto standard for composable AI pipelines. It gives us:
- Tool abstractions (wrapping Tavily as a LangChain Tool)
- Prompt template management
- Output parsers (structured JSON from LLM responses)
- Memory modules (conversation context for multi-turn research)
- Document loaders for processing Tavily's raw content

**Why NOT raw Anthropic SDK only:** The raw SDK is fine for single calls. But the Research pipeline requires 6+ LLM calls with state passing between them, conditional routing, and tool invocations. LangChain's composability makes this maintainable in a sprint.

**How it connects to Tavily:** `TavilySearchResults` is a first-class LangChain community tool. We extend it to add L402 payment tracking and our tier pricing.

---

### LangGraph — `@langchain/langgraph`
**Why:** LangGraph is the state machine layer on top of LangChain. It gives us:
- Typed state channels (ResearchState flows through the graph)
- Conditional edges (loop back if answer is incomplete)
- Node-level checkpointing (resume interrupted research)
- Parallel node execution (concurrent Tavily searches)
- Built-in cycle detection (prevents infinite research loops)

**Why NOT a simple chain or loop:** A simple `while` loop has no state inspection, no checkpointing, no parallel execution, and no built-in cycle detection. LangGraph makes the research pipeline observable (we can stream state to the dashboard) and robust.

**How it connects to the dashboard:** Each node in the graph emits an event via Upstash pub/sub when it completes. The dashboard subscribes and shows a live stepper of the research process. Judges see the AI thinking in real time.

---

### Tavily — `@tavily/core`
**Why Tavily is the intelligence backbone, not just a data source:**

Tavily is purpose-built for AI agents. It doesn't return a list of URLs — it returns processed, ranked, AI-filtered content optimized for LLM consumption. This is a fundamental difference from Google Search API or SerpAPI.

**All four endpoints we use:**

| Endpoint | Used For | Why |
|----------|----------|-----|
| `/search` | Flash/Basic/Deep tiers | Real-time web intelligence, 4 depth levels |
| `/extract` | Content extraction tier | Deep-dive into specific URLs from search results |
| `/research` | Full research tier | Multi-step autonomous research by Tavily itself |
| (crawl via extract) | Agent registry verification | Crawl agent endpoints to verify they exist |

**Advanced Tavily features we use:**
- `include_answer: "advanced"` — get an LLM-generated answer, not just URLs. Used as the seed for our synthesis step.
- `include_raw_content: "markdown"` — full page content in markdown. Used as synthesis input for Claude.
- `topic: "finance" | "news" | "general"` — topic routing based on query intent classification
- `auto_parameters: true` — let Tavily choose optimal search depth for query type
- `time_range: "day" | "week"` — freshness control for news-sensitive queries
- `include_domains / exclude_domains` — quality filtering (exclude social media for research queries)
- `chunks_per_source: 3` — maximum content density for advanced searches

**Why NOT SerpAPI / Bing Search API:** They return URLs and snippets. We'd have to scrape, parse, filter, and rank ourselves — a week of work. Tavily does all of that and is built for exactly our use case.

**Sponsor alignment:** Tavily is a sponsor. Our architecture makes Tavily irreplaceable — it is not a swappable search provider. The intelligence quality of Nexus is directly a function of Tavily's quality. Judges from Tavily will see this immediately.

---

### Vercel AI SDK — `ai`
**Why:** Native streaming for Next.js. `streamText()` and `createStreamableUI()` let us stream Claude's synthesis response token-by-token to the client without managing SSE headers manually. Integrates with App Router's response streaming natively.

**Specific use:** `POST /api/v1/synthesize` streams the Claude response as it generates. The client sees the answer being written in real time — far more impressive in a demo than a spinner followed by a wall of text.

---

### Anthropic SDK — `@anthropic-ai/sdk`
**Why:** Direct SDK for cases where we need fine-grained control over Claude:
- Prompt caching (`cache_control: { type: "ephemeral" }`) on system prompts — cuts cost by 90% on repeated synthesis calls
- Extended thinking for gap detection (`thinking: { type: "enabled", budget_tokens: 2048 }`)
- Direct tool use in synthesis step

**Model routing:**
- Gap detection (fast, binary yes/no) → `claude-haiku-4-5` (cheapest, fastest)
- Query analysis → `claude-sonnet-4-6` (balanced)
- Synthesis (quality critical, judge-facing) → `claude-sonnet-4-6`

**Why NOT OpenAI only:** Claude Sonnet has demonstrably better citation quality and structured output adherence for research synthesis. We use OpenAI (`gpt-4o-mini`) only as emergency fallback.

---

### LangSmith
**Why:** Observability for all LangChain/LangGraph traces. Every research run produces a full trace: which node ran, what prompt was sent, what was returned, how long it took, token costs. During the demo, we can open LangSmith and show judges the internal reasoning of the research pipeline.

**This is a demo superpower.** Judges who are technically sophisticated will want to see under the hood. LangSmith makes that effortless.

---

## Layer 4: API Layer

### tRPC — `@trpc/server`, `@trpc/client`, `@trpc/next`, `@trpc/react-query`
**Why:** End-to-end type-safe API without writing schemas twice. The tRPC router defines the types; the client infers them. No OpenAPI codegen, no fetch wrappers, no type assertions. In a sprint where the schema changes often, this saves significant time.

**What tRPC handles:** Dashboard data (payments history, agent registry, analytics). NOT the public L402 API (that's standard REST — agents can't use tRPC).

**Why NOT GraphQL:** GraphQL has overhead (schema, resolvers, codegen tooling). tRPC is TypeScript-native with zero schema boilerplate. For a hackathon with a 24-hour clock, tRPC is strictly better.

---

### Zod
**Why:** Runtime schema validation that generates TypeScript types. Every API input is validated with Zod before it touches a service. Every LLM output is parsed with Zod to ensure it matches the expected structure. If Claude returns malformed JSON, Zod catches it and we return a clean error rather than crashing.

**Key patterns:**
- `z.input()` / `z.output()` for API contract types
- `.safeParse()` for LLM output validation (never `.parse()` — LLMs produce unpredictable output)
- Shared schemas between server and client via the `packages/shared` workspace

---

### superjson
**Why:** tRPC's default serializer. Handles `Date`, `BigInt`, `Map`, `Set` over JSON — things standard `JSON.stringify` breaks. Critical because our payment amounts are satoshis (could exceed `Number.MAX_SAFE_INTEGER` for large values; use BigInt).

---

## Layer 5: Database & Cache

### Prisma + Neon PostgreSQL
**Why Prisma:** Type-safe ORM with migration management. The generated `PrismaClient` types match the schema exactly. Refactoring a model field immediately surfaces all broken queries at compile time.

**Why Neon:** Serverless PostgreSQL built for Vercel. Key properties:
- `@neondatabase/serverless` driver uses HTTP/WebSocket instead of TCP — works in Vercel Edge Functions (TCP is blocked at the edge)
- Auto-pauses when inactive (free tier friendly during hackathon)
- Connection pooling built-in (no PgBouncer to manage)
- Same region as Vercel Edge (us-east-1) → minimal latency

**Why NOT PlanetScale/Supabase:** PlanetScale doesn't support foreign keys (breaks our relational schema). Supabase is good but Neon has better Vercel Edge compatibility and the Vercel integration is one-click.

---

### Upstash Redis — `@upstash/redis`, `@upstash/ratelimit`, `@upstash/qstash`
**Why Upstash:** Serverless Redis via HTTP — works in Edge Functions (no persistent TCP connection). Three packages from one provider:

| Package | Use | Detail |
|---------|-----|--------|
| `@upstash/redis` | Cache + Pub/Sub | Search result cache, L402 token cache, payment event pub/sub |
| `@upstash/ratelimit` | Rate limiting | Sliding window: 100 req/min/IP, 10 concurrent research jobs |
| `@upstash/qstash` | Job queue | Escrow timeout jobs, agent health checks, long-running research |

**Why NOT Redis Cloud / ElastiCache:** Both require persistent TCP connections — incompatible with Vercel Edge Functions. Upstash's HTTP REST API is the only production-viable Redis for edge deployments.

**Pub/Sub pattern:** Payment events and research progress are published to Upstash channels. The Socket.io gateway subscribes and re-emits to connected browser clients. This decouples the payment confirmation (which happens in an Edge Function) from the WebSocket gateway (which runs in a Serverless Function).

---

### `lru-cache`
**Why:** In-process memory cache for ultra-hot queries. A L1 cache before Redis prevents even the ~20ms Upstash HTTP round-trip. For flash searches on popular topics, the in-process hit rate is high.

**Config:** Max 500 entries, TTL 60 seconds. Evicted on function cold start (which is fine — Redis is L2).

---

## Layer 6: Real-time

### Socket.io — `socket.io`, `socket.io-client`
**Why:** Bidirectional event system with automatic reconnection, room support, and fallback to long polling when WebSockets are blocked. Judges on corporate wifi who have WebSocket blocked still get real-time updates.

**Why NOT raw WebSocket / Pusher:** Raw WebSocket has no reconnection or event namespacing. Pusher is proprietary and adds cost. Socket.io is battle-tested and the React hooks are simple.

**Vercel constraint:** Socket.io persistent connections don't work on Vercel Edge/Serverless (stateless). Solution: Socket.io server runs on a Fly.io micro-instance (always-on, free tier). Alternatively, the Socket.io upgrade runs from a Vercel Serverless Function that stays alive for the duration of the WebSocket connection.

---

### `eventsource-parser`
**Why:** Parsing SSE streams from the research endpoint. When `POST /api/v1/research?stream=true` is called, the server sends `data: {...}\n\n` events. `eventsource-parser` handles the stream parsing in both browser and Node environments.

---

## Layer 7: Frontend

### Tailwind CSS + shadcn/ui
**Why Tailwind:** Utility-first CSS composes perfectly with React Server Components. No CSS-in-JS runtime overhead. PurgeCSS ensures the production bundle has only the classes used.

**Why shadcn/ui:** Not a component library — it's copy-paste components that live in YOUR codebase. Full customization, no dependency version conflicts, no black-box behavior. Built on Radix UI primitives for accessibility. The command palette (cmdk), drawer (vaul), and toast (sonner) are all shadcn-pattern packages.

---

### Framer Motion
**Why:** The payment waterfall animation is a key demo moment. Each sat payment that arrives animates into the waterfall in real time. Framer Motion's `AnimatePresence` + `layout` makes this trivial: just add items to an array and they animate in smoothly. No manual GSAP timelines.

**Specific animations:**
- Payment card fly-in from top (stagger 50ms)
- Reputation score gauge fill animation
- LangGraph step completion (checkmark pop-in)
- Sat counter increment with spring physics

---

### Recharts + @tremor/react
**Why Recharts:** D3-based, React-native chart library. `AreaChart` for sat flow over time, `BarChart` for search tier distribution. SSR-compatible (unlike Chart.js which requires `window`).

**Why Tremor:** Pre-built dashboard component system (MetricCard, AreaChart, DonutChart with proper dark mode and responsive layout). Cuts dashboard UI time by 60%.

---

### @xyflow/react
**Why:** The agent relationship graph (who hired whom, payment flows between agents) is best expressed as a node-edge graph. React Flow (xyflow) is the standard for this. Nodes = agents, edges = payment flows, edge labels = sat amounts. This is the most visually impressive component in the dashboard.

---

### Zustand + Jotai + @tanstack/react-query
**Why three state solutions:**

| Tool | Used For | Why |
|------|----------|-----|
| `@tanstack/react-query` | Server state (tRPC queries, refetching) | Automatic caching, background refetch, optimistic updates |
| `zustand` | Global UI state (payment stream, socket events) | Simple, no boilerplate, works with immer for immutable updates |
| `jotai` | Atomic real-time state (individual payment events) | Granular atom subscriptions prevent full re-renders on each payment |

**Why not Redux:** Redux requires 5× the boilerplate for 1× the functionality. For a hackathon, Zustand is the correct choice.

---

## Layer 8: Observability

### OpenTelemetry — `@opentelemetry/api`, `@opentelemetry/sdk-node`
**Why:** Industry standard distributed tracing. Every API request gets a `traceId` that flows through: Edge Function → Service Layer → Tavily call → Redis → DB. When something breaks in the demo, we can trace exactly where.

**Minimal config:** Auto-instrumentation for HTTP, Prisma, and Redis. Traces exported to Vercel's built-in OTel endpoint (no third-party needed).

---

### LangSmith
**Why:** LangChain/LangGraph specific tracing. `LANGCHAIN_TRACING_V2=true` enables automatic trace capture. Every research workflow run produces a full trace with:
- Node execution times
- Token usage per node
- Prompt + completion pairs
- Error traces

**Demo use:** Open `smith.langchain.com` during the pitch to show judges the AI's internal reasoning chain for a live research query.

---

### Vercel Analytics + Speed Insights
**Why:** Zero-config, no sampling, edge-native analytics. `@vercel/analytics` tracks page views and custom events (payment completed, search executed). `@vercel/speed-insights` tracks Core Web Vitals. Both are free on Vercel and require two lines of code to enable.

---

## Layer 9: Robustness Patterns

### p-retry — exponential backoff
**Applied to:** All external API calls (Tavily, Anthropic, MDK)

```typescript
const result = await pRetry(
  () => tavilyClient.search(query, options),
  {
    retries: 3,
    factor: 2,
    minTimeout: 500,
    maxTimeout: 5000,
    onFailedAttempt: (err) => logger.warn({ err }, 'Tavily retry'),
  }
)
```

---

### Circuit Breaker (opossum)
**Applied to:** Tavily, Anthropic

```typescript
const breaker = new CircuitBreaker(tavilySearch, {
  timeout: 8000,           // 8s timeout per call
  errorThresholdPercentage: 50,  // open after 50% failures
  resetTimeout: 30000,     // try again after 30s
  fallback: () => cachedResults || emptyResults,
})
```

If Tavily is down during the demo, the circuit breaker opens, returns cached results, and Nexus continues to function.

---

### p-limit — concurrency control
**Applied to:** Parallel Tavily searches in the LangGraph research pipeline

```typescript
const limit = pLimit(3) // max 3 concurrent Tavily calls
const results = await Promise.all(
  subQuestions.map(q => limit(() => tavilySearch(q)))
)
```

Prevents Tavily rate limit hits from parallel research.

---

### bottleneck — outbound rate limiting
**Applied to:** Anthropic API calls (to stay within rate limits)

```typescript
const limiter = new Bottleneck({ minTime: 100 }) // max 10 req/s
const synthesis = await limiter.schedule(() => claude.complete(prompt))
```

---

## Layer 10: Testing

### Vitest
**Why:** Vite-native test runner. TypeScript-first with no config. 10× faster than Jest for TypeScript projects because it uses the same transform pipeline as the build. Drop-in Jest API compatibility.

**Test scope:** Unit tests for all service classes, payment flow logic, reputation calculation, LangGraph node functions.

---

### MSW (Mock Service Worker)
**Why:** Intercepts fetch calls at the network level — both in browser (via service worker) and in Node (via `@mswjs/interceptors`). Used to mock Tavily and Anthropic responses in tests without hitting real APIs. Test the full service layer with realistic responses.

---

### Playwright
**Why:** E2E test the full playground flow: open browser, submit query, see 402, simulate payment, see results. The payment simulation mocks the L402 handshake so tests don't require a real Lightning node.

---

## Alternatives Decision Log

| Component | We Chose | We Rejected | Why Rejected |
|-----------|---------|-------------|--------------|
| Framework | Next.js 15 | Remix, Astro | No native Vercel edge; Astro is frontend-only |
| ORM | Prisma | Drizzle, TypeORM | Drizzle has less mature migrations; TypeORM is too heavy |
| Database | Neon | Supabase, PlanetScale | Neon best Vercel edge compatibility; PlanetScale no FK |
| Cache | Upstash | Redis Cloud, ElastiCache | Both require TCP — blocked at Vercel edge |
| Lightning | MDK + Alby | Spark, Lexe only | MDK has L402 built in; Spark is newer/less stable |
| AI Agents | LangChain/LangGraph | CrewAI, AutoGen | LangSmith observability; better Tavily integration |
| State | Zustand + Jotai | Redux, Recoil | Redux too verbose for sprint; Recoil deprecated |
| Charts | Recharts + Tremor | Chart.js, D3 | Chart.js no SSR; D3 too low-level |
| Graph viz | @xyflow/react | D3-force, Cytoscape | React Flow is React-native and well-maintained |
| Real-time | Socket.io | Pusher, Ably | Pusher is proprietary/paid; Socket.io is OSS |
| Search | Tavily (all 4 endpoints) | SerpAPI, Bing, Exa | Tavily is AI-optimized + sponsor alignment |
| Testing | Vitest | Jest | 10× faster TS support; no config |

---

## Version Pinning Strategy

**Production versions pinned in `package.json`:**
```json
{
  "next": "15.3.0",
  "@langchain/langgraph": "0.2.x",
  "@tavily/core": "0.5.x",
  "@anthropic-ai/sdk": "0.40.x",
  "@moneydevkit/core": "1.x"
}
```

- Patch versions float (`~1.2.3` → accepts `1.2.x`)
- Minor versions locked for AI packages (breaking API changes are common)
- Major versions always locked
- `pnpm-lock.yaml` committed — exact reproducibility across all environments
