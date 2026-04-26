# Nexus — 24-Hour Execution Workflow

> "Ship working code at every milestone. A running demo beats a perfect plan."

---

## Architectural Decisions Locked Before Sprint Starts

These are resolved — do NOT re-debate during the sprint:

| Decision | Choice | Reason |
|----------|--------|--------|
| Real-time | SSE (not Socket.io) | Socket.io needs persistent TCP; incompatible with Vercel Edge/Serverless |
| Database | Neon Postgres (pooled URL) | Edge-compatible HTTP driver; serverless-native |
| Cache | Upstash Redis (HTTP REST) | Only Redis that works at Vercel Edge |
| Lightning | MDK primary, Alby fallback | MDK has L402 built-in; Alby provides WebLN for browser demo |
| Framework | Next.js 15 App Router | Native Vercel edge + streaming + RSC |
| Python agent | Lexe wallet (or MDK agent wallet) | Always-on cloud wallet; no local node needed |
| Monorepo | pnpm + Turborepo | Shared types between web + agent; fast installs |

---

## Guiding Rules for the Sprint

1. **Green before clean** — get it working first, refactor second
2. **Demo-first** — every 2 hours, the app must be demonstrable end-to-end
3. **Pay early** — get real Lightning money moving within the first 3 hours; don't skip it
4. **Feature freeze at H+20** — last 4 hours are polish, bug fixes, and demo rehearsal only
5. **Commit every 30 minutes** — if the app breaks, roll back to last commit
6. **Phase overtime rule** — if a phase runs 30+ minutes over, cut scope to the minimum viable version and move on. The demo must exist before it can be perfect.

---

## Pre-Sprint Checklist (Do Before Clock Starts)

- [ ] Apply for Spiral's BTC funding (form linked in problem-statement.md)
- [ ] Get Tavily API key (app.tavily.com — free tier, 1,000 credits/month)
- [ ] Get Anthropic API key (console.anthropic.com)
- [ ] Set up Neon database (neon.tech — free tier)
- [ ] Set up Upstash Redis (upstash.com — free tier)
- [ ] Create Vercel project and link repo
- [ ] Run `npx @moneydevkit/create` to get MDK wallet set up
- [ ] Node.js 20+, Python 3.11+, pnpm installed
- [ ] VS Code / Cursor with relevant extensions

---

## Sprint Timeline

---

### PHASE 0 — Scaffold (H+0:00 → H+0:45)

**Goal:** Running Next.js app with correct folder structure and all packages installed.

#### Tasks
- [ ] `npx create-next-app@latest nexus --typescript --tailwind --app`
- [ ] Install all packages from architecture.md (web app)
- [ ] Set up Prisma schema + initial migration
- [ ] Set up Neon DB connection
- [ ] Set up Upstash Redis client
- [ ] Configure environment variables (.env.local)
- [ ] Set up tRPC root router (empty)
- [ ] Set up shadcn/ui: `npx shadcn@latest init` + install components
- [ ] Set up ESLint + Prettier
- [ ] Deploy empty app to Vercel (confirm deployment pipeline works)
- [ ] Create `apps/agent/` directory, set up Python venv, install requirements

**Definition of Done:**
- `pnpm dev` runs without errors
- Vercel deployment is live at a public URL
- `prisma db push` succeeds against Neon
- Redis ping returns PONG

---

### PHASE 1 — Payment Core (H+0:45 → H+3:00)

**Goal:** L402 + Lightning payment flow working. Real sats moving.

This is the most important phase. Nothing else ships until money moves.

#### Tasks
- [ ] `server/services/payment.service.ts` — MDK integration
  - `createInvoice(amountSats, metadata)` → returns `{ invoice, macaroon }`
  - `validatePreimage(preimage, macaroon)` → returns `boolean`
  - `getPaymentStatus(invoiceId)` → `PENDING | PAID | EXPIRED`
- [ ] `server/middleware/l402.middleware.ts` — request interceptor
  - Parse `Authorization: L402 <preimage>:<macaroon>` header
  - If missing/invalid → generate invoice → return 402 with `WWW-Authenticate`
  - If valid → attach decoded token to request context → call next()
  - Cache validated tokens in Redis (by preimage hash)
- [ ] `server/cache/redis.ts` — Upstash Redis client singleton
- [ ] `app/api/v1/search/route.ts` — stub endpoint (no Tavily yet)
  - Wrap with L402 middleware
  - Return dummy `{ results: [], cost: 0 }` if payment passes
  - This lets us test payment flow before search is ready
- [ ] `scripts/test-payment.ts` — manual test script
  - Hits `/api/v1/search` with no auth → logs 402 + invoice
  - Pays invoice (manual step or MDK wallet)
  - Retries with preimage → logs 200

**Test:** Run `npx tsx scripts/test-payment.ts` — see a real Lightning payment complete.

**Definition of Done:**
- `POST /api/v1/search` returns 402 with a real bolt11 invoice when called without auth
- Paying that invoice and retrying returns 200
- Payment is logged in Neon DB
- The whole flow completes in under 5 seconds

---

### PHASE 2 — Search & Research (H+3:00 → H+7:00)

**Goal:** All 4 search tiers working. LangGraph research pipeline streaming.

#### 2A — Search Service (H+3:00 → H+4:30)
- [ ] `server/services/search.service.ts`
  - `search(query, tier, options)` — calls Tavily with correct depth
  - Redis caching by `sha256(query + tier)` with tier-appropriate TTL
  - Returns normalized `Result[]` with source, title, content, score
- [ ] `app/api/v1/search/route.ts` — complete implementation
  - L402 middleware (Phase 1)
  - Zod input validation
  - Call SearchService
  - Log payment + query to DB
  - Return results with cost metadata
- [ ] `app/api/v1/extract/route.ts` — Tavily extract endpoint
- [ ] Write unit tests for SearchService (mock Tavily client)

#### 2B — LangGraph Research Pipeline (H+4:30 → H+7:00)
- [ ] `server/workflows/nodes/analyzeQuery.ts` — Claude: extract sub-questions from query
- [ ] `server/workflows/nodes/parallelSearch.ts` — p-limit(3) concurrent Tavily calls
- [ ] `server/workflows/nodes/aggregateResults.ts` — dedupe by URL, rank by score
- [ ] `server/workflows/nodes/detectGaps.ts` — Claude: "Is this enough to answer fully?"
- [ ] `server/workflows/nodes/synthesize.ts` — Claude: generate cited answer
- [ ] `server/workflows/nodes/formatOutput.ts` — structured output + metadata
- [ ] `server/workflows/research.graph.ts` — assemble LangGraph state machine
- [ ] `server/workflows/utils/streamEmitter.ts` — emit SSE events per node completion
- [ ] `app/api/v1/research/route.ts` — SSE streaming endpoint
  - L402 middleware (25 sats)
  - Start LangGraph workflow
  - Stream `data: { type: 'progress', step: 'analyzeQuery', ... }` events
  - Final event: `data: { type: 'complete', result: { answer, citations, confidence } }`
- [ ] `server/services/synthesis.service.ts` — standalone Claude synthesis
- [ ] `app/api/v1/synthesize/route.ts`

**Definition of Done:**
- `curl -X POST /api/v1/search -d '{"query":"bitcoin lightning","tier":"basic"}'` (with valid L402) returns real Tavily results
- `curl -X POST /api/v1/research -d '{"query":"what is the current state of AI agents"}'` streams progress events and returns a cited answer
- LangSmith dashboard shows the LangGraph trace

---

### PHASE 3 — Real-Time Dashboard (H+7:00 → H+12:00)

**Goal:** Live visual of the system working. The judge opens a browser and sees it thinking.

#### 3A — WebSocket Gateway (H+7:00 → H+8:30)
- [ ] `lib/socket/server.ts` — Socket.io server, Upstash pub/sub subscriber
  - Subscribe to Upstash channel `nexus:events`
  - Re-emit to connected clients
- [ ] `lib/socket/client.ts` — typed client + event definitions
- [ ] `app/api/socket/route.ts` — Socket.io upgrade handler
- [ ] Payment service: after `validatePreimage`, publish to Upstash `nexus:events`
- [ ] Research workflow: each node publishes progress event

#### 3B — Dashboard UI (H+8:30 → H+12:00)
- [ ] `app/dashboard/page.tsx` — layout + data fetch
- [ ] `components/dashboard/MetricsRow.tsx`
  - Cards: Total Sats Received | Active Agents | Searches Today | Avg Research Time
- [ ] `components/dashboard/PaymentWaterfall.tsx`
  - Framer Motion: each payment animates in as a card
  - Shows: amount (sats), tier, timestamp, agent ID (truncated)
  - Glowing bitcoin-orange on payment arrival
- [ ] `components/dashboard/SatFlowChart.tsx`
  - Recharts AreaChart: sats received per 5-minute bucket
  - Auto-updates via Socket.io
- [ ] `components/dashboard/AgentGraph.tsx`
  - @xyflow/react: nodes = agents, edges = payment flows between them
  - Animates when new payments occur
- [ ] `components/dashboard/ResearchProgress.tsx`
  - Stepper: shows LangGraph nodes as they complete
  - Live during active research tasks
- [ ] `components/dashboard/LivePaymentTicker.tsx`
  - Scrolling ticker on landing page: "Agent paid 2 sats for basic search 3s ago..."
- [ ] `stores/usePaymentStream.ts` — Zustand store for payment events
- [ ] `hooks/useSocket.ts` — typed socket event subscription

**Definition of Done:**
- Dashboard live at `/dashboard`
- Payments appear in waterfall within 2 seconds of completion
- Charts update in real time
- AgentGraph renders (even with seeded dummy data if needed)

---

### PHASE 4 — Agent Registry + Demo Agent (H+12:00 → H+17:00)

**Goal:** Agents can register and be hired. Demo agent completes full autonomous task.

#### 4A — Agent Registry (H+12:00 → H+14:00)
- [ ] `server/services/agent.service.ts`
  - `registerAgent(data)` — validate endpoint, require stake payment via L402
  - `listAgents(filters)` — capability + reputation + price filtering
  - `getAgent(id)` — full profile + metrics
  - `hireAgent(id, task)` — create escrow invoice
- [ ] `server/services/reputation.service.ts` — score calculation from DB
- [ ] `app/api/v1/agents/route.ts` — GET + POST handlers
- [ ] `app/api/v1/agents/[id]/route.ts`
- [ ] `app/api/v1/agents/[id]/task/route.ts`
- [ ] `app/dashboard/agents/page.tsx` — registry browser UI
- [ ] Seed script: `scripts/seed-db.ts` — create 5 demo agents with varied reputations

#### 4B — Python Demo Agent (H+14:00 → H+17:00)
- [ ] `apps/agent/nexus_agent/client/l402.py`
  - `class L402Client` — wraps httpx, auto-handles 402 responses
  - On 402: parse invoice from `WWW-Authenticate` header, pay via Lexe SDK, retry
- [ ] `apps/agent/nexus_agent/client/nexus.py`
  - `search(query, tier)` → handles L402, returns results
  - `research(query)` → handles L402, streams progress, returns cited answer
- [ ] `apps/agent/nexus_agent/workflows/tools/nexus_search.py` — LangChain Tool
- [ ] `apps/agent/nexus_agent/workflows/tools/nexus_research.py` — LangChain Tool
- [ ] `apps/agent/nexus_agent/workflows/research_agent.py` — LangGraph workflow
  ```python
  # Workflow: receive task → plan → search (pays automatically) → verify → report
  graph = StateGraph(ResearchState)
  graph.add_node("plan", plan_node)
  graph.add_node("search", search_node)      # calls Nexus, pays in sats
  graph.add_node("verify", verify_node)
  graph.add_node("report", report_node)
  ```
- [ ] `apps/agent/nexus_agent/main.py` — CLI entry point
  ```
  python -m nexus_agent "What are the latest developments in Lightning Network?"
  ```
  Output: real-time logs showing L402 payment, research steps, cited answer

**Definition of Done:**
- `python -m nexus_agent "research task"` runs end-to-end without manual intervention
- Agent pays for search automatically (no human clicks)
- Output is a cited, multi-source research report
- Payments from agent appear in dashboard in real time

---

### PHASE 5 — Playground + Polish (H+17:00 → H+20:00)

**Goal:** Judges can try it themselves in the browser.

- [ ] `app/playground/page.tsx` — interactive demo
  - Query input + tier selector
  - "Run" button triggers search/research
  - Shows L402 invoice (QR code) if no wallet connected
  - Shows WebLN payment button if browser wallet available
  - Streams results in real time
- [ ] `components/playground/PaymentModal.tsx`
  - Display bolt11 invoice as QR code
  - Status: Waiting → Paid → Searching → Complete
- [ ] `components/playground/ResultsPanel.tsx`
  - Source cards with favicon, title, URL, content snippet
  - Confidence score badge
  - Citation list
- [ ] Landing page (`app/page.tsx`)
  - Hero: "The Intelligence Layer for AI Agents"
  - Live ticker (LivePaymentTicker.tsx)
  - API docs preview
  - CTA: "Try the Playground" + "Read the Docs"
- [ ] `public/og-image.png` — Open Graph image for sharing
- [ ] `docs/api-reference.md` — public API docs for judges to verify calls

**Definition of Done:**
- A judge can open the site, go to Playground, run a search, see payment + results — all in browser
- Landing page looks professional enough to screenshot for pitch deck
- OG image renders correctly when shared

---

### PHASE 6 — Demo Rehearsal + Buffer (H+20:00 → H+24:00)

**Goal:** Know the demo cold. Fix any last bugs. Deploy cleanly.

- [ ] Feature freeze (no new features)
- [ ] Run full demo script 3 times end-to-end
- [ ] Fix any bugs found during rehearsal
- [ ] Confirm Vercel deployment is stable
- [ ] Confirm mainnet Lightning payments work (not just testnet)
- [ ] Prepare pitch talking points (see Demo Script below)
- [ ] Write README.md (what it is, how to run, API docs link)
- [ ] Screenshot dashboard for backup slides (in case live demo fails)

---

## Phase Contingency Plans (If Things Go Wrong)

| Phase | If Overrun | Cut To |
|-------|-----------|--------|
| Phase 0 (scaffold) | > 1h | Skip Turborepo monorepo; single app folder; add monorepo later |
| Phase 1 (payments) | > 3.5h | Use a hardcoded preimage for testing; get Tavily working; fix L402 next |
| Phase 2A (search) | > 5h | Skip extract endpoint; just get /search working |
| Phase 2B (research) | > 7.5h | Ship a stub research endpoint that runs only 1 Tavily call; LangGraph full version later |
| Phase 3 (dashboard) | > 12.5h | Ship payment table (static tRPC query) instead of real-time waterfall; cut AgentGraph |
| Phase 4A (registry) | > 14.5h | Ship GET /agents with seeded agents only; skip registration endpoint |
| Phase 4B (Python agent) | > 17.5h | Use TypeScript script instead; simpler but same demo outcome |
| Phase 5 (playground) | > 20h | Landing page only; skip playground; judges use cURL or pre-run terminal for demo |

**The absolute minimum demo that still wins:**
- L402 payment working on /search → 200 OK
- LangGraph research streaming (even 1 iteration)
- Dashboard showing payments arriving (even from seeded data)
- Python agent running end-to-end in terminal

Everything else is bonus.

---

## Judge Q&A Preparation

**"Why not use stablecoins? USDC is cheaper and more stable."**
> "USDC is controlled by Circle — they've frozen accounts before. Every payment is public on-chain. And the minimum cost on Base is still ~$0.01 in gas. Our flash search costs $0.001. That's a 10× gap, and it widens as the volume increases. More importantly: an agent running in Germany cannot get a USDC wallet without a human setting one up. Lightning requires no identity and no human setup."

**"How do agents actually pay if they can't have a bank account?"**
> "That's exactly what MDK solves. An agent wallet is just a cryptographic key pair. The wallet signs payment proofs — no bank account, no KYC, no human. The agent holds sats and spends them programmatically. We fund the demo agent wallet before the hackathon."

**"What stops someone from calling your API without paying?"**
> "The L402 macaroon is bound to the specific query hash via HMAC. A payment for query A produces a macaroon that is cryptographically invalid for query B. There is no way to reuse a payment. The preimage proves payment occurred at the Lightning network level — it's not our assertion, it's math."

**"What's the revenue model?"**
> "Every search query: 1–25 sats. Platform fee: 10% of every agent-to-agent transaction. As agents proliferate, both streams grow. At 1M agent API calls/day: $1,000–$25,000/day in Lightning micropayments with zero payment processing cost."

**"What happens if Tavily goes down?"**
> "Circuit breaker opens after 50% error rate. Returns cached results with `stale: true` flag. Agents get a result and a `Retry-After` header. The system never crashes — it degrades gracefully."

**"Is this open source?"**
> "Yes. MIT license. The whole point is open infrastructure — consistent with Spiral's philosophy. Nexus is infrastructure agents build on, not a platform that captures them."

---

## Demo Script (What You Say to Judges)

### Setup (before judges arrive)
1. Dashboard open on one screen
2. Terminal ready to run `python -m nexus_agent`
3. Playground open in browser
4. LangSmith trace dashboard open

### The Pitch (5-7 minutes)

**[Slide 1 — The Problem]**
> "AI agents can browse the web and call APIs. But they can't pay for anything. Stripe's minimum fee is 30 cents. A useful API call is worth a fraction of a cent. The math doesn't work. So agents operate without premium data — or humans build account systems just so their bots can authenticate."

**[Slide 2 — The Solution]**
> "Nexus is a real-time AI intelligence exchange where agents pay per query using the Lightning Network. No accounts. No API keys. No humans in the loop. An agent you've never seen before can call our API and get research results in under 3 seconds — and pay 2 thousandths of a dollar for it."

**[Live Demo — Search]**
> [Open terminal]
> `curl -X POST https://nexus.vercel.app/api/v1/search -d '{"query":"bitcoin lightning network","tier":"basic"}'`
> [Show 402 response with bolt11 invoice]
> "This is the L402 handshake. The agent gets an invoice, pays it automatically..."
> [Pay + retry]
> [Show 200 response with Tavily results]
> "Done. 800 milliseconds. $0.002."
> [Show dashboard — payment appears in waterfall]

**[Live Demo — Research Agent]**
> "But the real power is the research agent."
> `python -m nexus_agent "What is the current state of AI agent payment systems?"`
> [Show terminal: planning → paying → searching → verifying → reporting]
> [Show dashboard: research progress stepper, payments streaming in]
> [Show final output: cited multi-source report]
> "The agent just autonomously researched a topic, paid for 4 search calls with real bitcoin, and returned a cited report. No human touched the payment loop."

**[Slide 3 — Why Lightning]**
> "We could have built this with Stripe — $0.30 minimum per call. At 2 cents per query, the math breaks at scale. We could have used stablecoins — but they're controlled by private companies that can freeze your funds. Lightning is open infrastructure. No company controls it. No minimums. No geographic restrictions. This is the only payment rail where this product actually works."

**[Slide 4 — The Platform]**
> "We built 4 endpoints: search, deep research, synthesis, and content extraction — all gated by L402. We built an agent registry where agents stake bitcoin to list services and earn reputation. And a real-time dashboard that shows the economy running."
> [Show AgentGraph, SatFlowChart]

**[Wrap]**
> "Nexus is the Bloomberg Terminal for AI agents. The information layer that agents pay for, built on the only payment rail that makes micropayments possible. Built with Tavily for real-time intelligence, LangChain and LangGraph for autonomous reasoning, and deployed on Vercel — in 24 hours."

---

## Risk Register

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| MDK integration is hard | Medium | High | Start Phase 1 immediately; Alby is fallback |
| LangGraph research too slow for demo | Medium | Medium | Pre-warm a research task; cache result for demo |
| Neon DB connection flaky on Vercel | Low | High | Test edge/serverless routes early in Phase 0 |
| Tavily rate limits hit | Low | Medium | 1,000 free credits, cache aggressively |
| Socket.io doesn't work on Vercel serverless | Medium | Medium | Use Upstash pub/sub → polling fallback if needed |
| Python agent L402 payment fails | Medium | High | Have pre-paid cached results as fallback demo |
| mainnet Lightning not funded | High | High | Apply for Spiral BTC before sprint; have backup testnet |
| Demo laptop has no internet | Low | High | Pre-record 60-second demo video as backup |

---

## Milestone Summary

| Time | Milestone | What You Can Show |
|------|-----------|-------------------|
| H+0:45 | Scaffold | Running app on Vercel |
| H+3:00 | **Money moves** | Real Lightning payment via L402 |
| H+7:00 | Intelligence | Search + streaming research working |
| H+12:00 | Dashboard | Live payments visible in browser |
| H+17:00 | Agents | Registry + autonomous demo agent |
| H+20:00 | Playground | Judges can try it in browser |
| H+24:00 | Demo ready | 3x rehearsed, deployed, documented |
