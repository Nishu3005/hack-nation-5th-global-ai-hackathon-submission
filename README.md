# Nexus — Bitcoin Lightning Intelligence Marketplace

> Team HN-0454 · Hack-Nation 5th Global AI Hackathon · Challenge: Earn in the Agent Economy

**AI agents pay per query with Bitcoin micropayments. No accounts. No API keys. $0.001 per search.**

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/Nishu3005/hack-nation-5th-global-ai-hackathon-submission&root=nexus)

---

## What is Nexus?

Nexus is a Bitcoin Lightning-powered intelligence marketplace where AI agents pay for real-time web intelligence using the L402 protocol — an HTTP extension that lets machines pay Lightning invoices instead of using OAuth tokens or API keys.

**Three structural problems Nexus solves:**
- **Micropayment impossibility** — Stripe min: $0.30. Our Flash search: $0.001. Only possible on Lightning.
- **Identity impossibility** — Agents can't sign up for accounts. L402 replaces auth with cryptographic payment proof.
- **Trust impossibility** — Agent reputation derived from Lightning payment history. Mathematically unfakeable.

---

## Live Demo

- **App**: https://nexus-agent-economy.vercel.app
- **Playground**: https://nexus-agent-economy.vercel.app/playground
- **Dashboard**: https://nexus-agent-economy.vercel.app/dashboard
- **Health**: https://nexus-agent-economy.vercel.app/api/v1/health

---

## Architecture

```
Agent → POST /api/v1/search
       ← HTTP 402 + bolt11 invoice (1 sat = $0.001)
Agent → pays Lightning invoice via Alby SDK
Agent → retries with Authorization: L402 <macaroon>:<preimage>
       ← JSON result from Tavily + 3-layer cache
```

**Intelligence Tiers:**
| Tier | Price | Time | What |
|------|-------|------|------|
| Flash | ⚡ 1 sat | 800ms | Ultra-fast Tavily search |
| Basic | ⚡ 2 sats | 1.5s | NLP-ranked results |
| Deep | ⚡ 5 sats | 3s | Advanced chunked results |
| Research | ⚡ 25 sats | 30s | LangGraph multi-step pipeline |
| Extract | ⚡ 1 sat | 2s | Full-page content extraction |

---

## Tech Stack

**Payment Layer**: Alby SDK + L402 protocol + bolt11  
**Intelligence**: Tavily (search + extract + research) + LangGraph + Claude (synthesis)  
**Database**: Neon PostgreSQL + Prisma v7 + `@prisma/adapter-neon`  
**Cache**: Upstash Redis (LRU → Redis → DB, 3-layer)  
**Infrastructure**: Next.js 16 + Vercel + TypeScript + pnpm  
**Observability**: LangSmith traces, Pino logging  
**Demo Agent**: Python + autonomous L402 payment  

---

## Quick Start

### Prerequisites
```bash
# Services needed:
# - Neon PostgreSQL (free tier): neon.tech
# - Upstash Redis (free tier): upstash.com  
# - Alby account + access token: getalby.com
# - Tavily API key: tavily.com
# - Anthropic API key: console.anthropic.com
```

### Local Development
```bash
cd nexus
cp ../nexus/.env.example .env
# Fill in your API keys

pnpm install
npx prisma migrate dev
pnpm dev
```

### Deploy to Vercel
1. Import repo at vercel.com/new
2. Set root directory to `nexus`
3. Add all environment variables from `.env.example`
4. Deploy

### Run Demo Agent
```bash
cd demo-agent
pip install -r requirements.txt
cp .env.example .env  # add your keys

python demo_agent.py "What is the Lightning Network?"
python demo_agent.py --tier RESEARCH "How do AI agents pay for services?"
python demo_agent.py --tier EXTRACT --urls "https://lightning.network"
```

---

## API Reference

### Search (L402-gated)
```bash
# Step 1: Get invoice
curl -X POST https://nexus-agent-economy.vercel.app/api/v1/search \
  -H "Content-Type: application/json" \
  -d '{"query": "Bitcoin Lightning Network", "tier": "FLASH"}'
# → 402 with bolt11 invoice

# Step 2: Pay invoice, get preimage
# Step 3: Retry with proof
curl -X POST https://nexus-agent-economy.vercel.app/api/v1/search \
  -H "Content-Type: application/json" \
  -H "Authorization: L402 <macaroon>:<preimage>" \
  -d '{"query": "Bitcoin Lightning Network", "tier": "FLASH"}'
# → 200 with results
```

### Research (SSE streaming)
```bash
curl -X POST https://nexus-agent-economy.vercel.app/api/v1/research \
  -H "Authorization: L402 <macaroon>:<preimage>" \
  -d '{"query": "State of Lightning adoption 2025"}'
# → SSE stream: node_start, search_start, node_complete, result, done
```

### Agent Registry
```bash
# Register an agent
curl -X POST https://nexus-agent-economy.vercel.app/api/v1/agents \
  -d '{"name": "CodeReviewer", "capabilities": ["code-review"], "endpoint": "https://my-agent.com", ...}'

# List agents
curl https://nexus-agent-economy.vercel.app/api/v1/agents?capability=code-review
```

---

## Repository Structure

```
hack-nation-5th-global-ai-hackathon-submission/
├── nexus/                    # Next.js 16 app (deploy this)
│   ├── app/
│   │   ├── api/v1/          # L402-gated API routes
│   │   │   ├── search/      # Flash/Basic/Deep search
│   │   │   ├── research/    # LangGraph SSE pipeline
│   │   │   ├── extract/     # Content extraction
│   │   │   ├── stream/      # Dashboard real-time events
│   │   │   ├── agents/      # Agent registry
│   │   │   └── health/      # Health check
│   │   ├── dashboard/       # Live payment waterfall UI
│   │   └── playground/      # Interactive L402 demo
│   ├── server/
│   │   ├── middleware/l402.ts        # L402 enforcement
│   │   ├── services/
│   │   │   ├── payment.service.ts   # Alby Lightning integration
│   │   │   ├── search.service.ts    # Tavily + 3-layer cache
│   │   │   └── agent.service.ts     # Registry + reputation
│   │   └── workflows/
│   │       └── research.graph.ts    # LangGraph pipeline
│   └── prisma/schema.prisma         # DB schema
├── demo-agent/
│   └── demo_agent.py        # Autonomous Python agent
└── spec/                    # Full architecture documentation
```

---

## License

MIT — Built at Hack-Nation 5th Global AI Hackathon in 24 hours.  
Team HN-0454 · Challenge: Earn in the Agent Economy (Spiral/Bitcoin)
