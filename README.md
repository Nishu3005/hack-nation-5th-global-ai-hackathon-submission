# Nexus — Bitcoin Lightning Intelligence Marketplace

> Team HN-0454 · Hack-Nation 5th Global AI Hackathon · Challenge: Earn in the Agent Economy

**AI agents pay per query with Bitcoin micropayments. No accounts. No API keys. $0.001 per search.**

---

## What is Nexus?

Nexus is a Bitcoin Lightning-powered intelligence marketplace where AI agents pay for real-time web intelligence using the **L402 protocol** — an HTTP extension that lets machines pay Lightning invoices instead of using OAuth tokens or API keys.

**Three problems Nexus solves:**

- **Micropayment impossibility** — Stripe minimum: $0.30. Our Flash search: $0.001. Only possible on Lightning.
- **Identity impossibility** — Agents can't sign up for accounts. L402 replaces auth with cryptographic payment proof.
- **Trust impossibility** — Agent reputation derived from Lightning payment history. Mathematically unfakeable.

---

## How it works

```text
Agent → POST /api/v1/search
       ← HTTP 402 + bolt11 invoice (1 sat = ~$0.001)
Agent → pays Lightning invoice via Alby SDK
Agent → retries with Authorization: L402 <macaroon>:<preimage>
       ← JSON results from Tavily + 3-layer cache
```

---

## Intelligence Tiers

| Tier | Price | Time | What |
| --- | --- | --- | --- |
| Flash | ⚡ 1 sat | 800ms | Ultra-fast Tavily search |
| Basic | ⚡ 2 sats | 1.5s | NLP-ranked results |
| Deep | ⚡ 5 sats | 3s | Advanced chunked results |
| Research | ⚡ 25 sats | 30s | LangGraph multi-step pipeline |
| Extract | ⚡ 1 sat | 2s | Full-page content extraction |

---

## Tech Stack

| Layer | Tech |
| --- | --- |
| Frontend & API | Next.js 16, TypeScript, Tailwind CSS |
| AI / Research | Tavily, LangGraph, Claude (Anthropic) |
| Payments | Alby SDK, L402 protocol, bolt11 |
| Database | Supabase PostgreSQL, Prisma v7 |
| Cache | Upstash Redis (3-layer: LRU → Redis → DB) |
| Observability | LangSmith traces, Pino logging |
| Deploy | Vercel |
| Demo Agent | Python 3, autonomous L402 payment loop |

---

## Repository Structure

```text
hack-nation-5th-global-ai-hackathon-submission/
├── nexus/                        # Next.js app (deploy this to Vercel)
│   ├── app/
│   │   ├── api/v1/               # L402-gated API routes
│   │   │   ├── search/           # Flash / Basic / Deep search
│   │   │   ├── research/         # LangGraph SSE pipeline
│   │   │   ├── extract/          # Full-page content extraction
│   │   │   ├── agents/           # Agent registry
│   │   │   ├── stream/           # Dashboard real-time events
│   │   │   └── health/           # Health check
│   │   ├── dashboard/            # Live payment waterfall UI
│   │   ├── playground/           # Interactive L402 demo
│   │   └── page.tsx              # Landing page
│   ├── server/
│   │   ├── middleware/l402.ts    # L402 enforcement
│   │   ├── services/
│   │   │   ├── payment.service.ts
│   │   │   ├── search.service.ts
│   │   │   └── agent.service.ts
│   │   └── workflows/
│   │       └── research.graph.ts # LangGraph multi-step research
│   └── prisma/schema.prisma      # DB schema
├── demo-agent/
│   ├── demo_agent.py             # Autonomous Python agent
│   └── requirements.txt          # Python dependencies
├── spec/                         # Architecture & API docs
├── DEPLOYMENT.md                 # Step-by-step deploy guide
└── LOCAL_DEV.md                  # Local development guide
```

> **`nexus/`** is a Node.js/pnpm project — uses `package.json`, no `requirements.txt` needed.
> **`demo-agent/`** is Python — it has its own `requirements.txt`.

---

## Quick Start

### Deploy to Vercel (recommended)

See **[DEPLOYMENT.md](DEPLOYMENT.md)** for the full step-by-step guide.

Click the button — Vercel will prompt you to fill in all required env vars before deploying:

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2FNishu3005%2Fhack-nation-5th-global-ai-hackathon-submission&root=nexus&env=TAVILY_API_KEY,ANTHROPIC_API_KEY,ALBY_ACCESS_TOKEN,DATABASE_URL,DIRECT_URL,UPSTASH_REDIS_REST_URL,UPSTASH_REDIS_REST_TOKEN&envDescription=API%20keys%20for%20Nexus%20%E2%80%94%20see%20nexus%2F.env.example%20for%20instructions&envLink=https%3A%2F%2Fgithub.com%2FNishu3005%2Fhack-nation-5th-global-ai-hackathon-submission%2Fblob%2Fmain%2Fnexus%2F.env.example&project-name=nexus-lightning&repository-name=nexus-lightning)

What happens automatically on deploy:

1. Vercel installs deps (`pnpm install` → triggers `prisma generate`)
2. Runs `prisma migrate deploy` — creates all DB tables in Supabase
3. Runs `next build`
4. Your app is live

> After deploy, go to **Vercel project → Settings → Environment Variables** and set
> `NEXT_PUBLIC_APP_URL` to your deployment URL (e.g. `https://nexus-xxx.vercel.app`).

### Run locally

See **[LOCAL_DEV.md](LOCAL_DEV.md)** for the full guide.

Short version:

```bash
cd nexus
pnpm install
cp .env.example .env   # then fill in your keys
npx prisma migrate dev
pnpm dev
# → http://localhost:3000
```

### Run the Python demo agent

```bash
cd demo-agent
pip install -r requirements.txt
cp .env.example .env   # add your keys, set NEXUS_API_URL
python demo_agent.py "What is the Lightning Network?"
python demo_agent.py --tier RESEARCH "How do AI agents pay for services?"
python demo_agent.py --tier EXTRACT --urls "https://lightning.network"
```

---

## API Reference

### Search (L402-gated)

```bash
# Step 1: get invoice
curl -X POST https://YOUR-APP.vercel.app/api/v1/search \
  -H "Content-Type: application/json" \
  -d '{"query": "Bitcoin Lightning Network", "tier": "FLASH"}'
# → 402 with bolt11 invoice

# Step 2: pay the invoice, get the preimage

# Step 3: retry with proof
curl -X POST https://YOUR-APP.vercel.app/api/v1/search \
  -H "Content-Type: application/json" \
  -H "Authorization: L402 <macaroon>:<preimage>" \
  -d '{"query": "Bitcoin Lightning Network", "tier": "FLASH"}'
# → 200 with results
```

### Health check

```bash
curl https://YOUR-APP.vercel.app/api/v1/health
# → { "status": "healthy", "services": { ... } }
```

---

## Environment Variables

All required vars are documented in `nexus/.env.example`.

| Variable | Where to get it |
| --- | --- |
| `TAVILY_API_KEY` | <https://app.tavily.com> |
| `ANTHROPIC_API_KEY` | <https://console.anthropic.com> |
| `ALBY_ACCESS_TOKEN` | <https://getalby.com> → Settings → API Keys |
| `DATABASE_URL` | Supabase → Project Settings → Database → Transaction pooler URL |
| `DIRECT_URL` | Supabase → Project Settings → Database → Direct connection URL |
| `UPSTASH_REDIS_REST_URL` | Upstash dashboard → Redis DB → REST API |
| `UPSTASH_REDIS_REST_TOKEN` | Upstash dashboard → Redis DB → REST API |

---

## License

MIT — Built at Hack-Nation 5th Global AI Hackathon in 24 hours.
Team HN-0454 · Challenge: Earn in the Agent Economy (Spiral/Bitcoin)
