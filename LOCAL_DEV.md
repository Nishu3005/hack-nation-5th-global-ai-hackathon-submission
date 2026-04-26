# Running Nexus Locally

Everything you need to get it running on your machine.

---

## Prerequisites

Install these if you don't have them:

- **Node.js 20+** — <https://nodejs.org> (check: `node -v`)
- **pnpm** — `npm install -g pnpm`
- **Python 3.10+** — <https://python.org> (only needed for the demo agent)

---

## 1 — Install dependencies

```bash
cd nexus
pnpm install
```

---

## 2 — Set up env file

```bash
# Run from inside the nexus/ folder
cp .env.example .env
```

Then open `.env` and fill in your keys. Minimum keys needed to run locally:

```bash
TAVILY_API_KEY=tvly-xxx
ANTHROPIC_API_KEY=sk-ant-xxx
ALBY_ACCESS_TOKEN=xxx
# Supabase — transaction pooler (port 6543, add ?pgbouncer=true)
DATABASE_URL=postgresql://postgres.[ref]:[pass]@aws-0-[region].pooler.supabase.com:6543/postgres?pgbouncer=true
# Supabase — direct connection (port 5432, for migrations)
DIRECT_URL=postgresql://postgres:[pass]@db.[ref].supabase.co:5432/postgres
UPSTASH_REDIS_REST_URL=https://xxx.upstash.io
UPSTASH_REDIS_REST_TOKEN=xxx
NEXT_PUBLIC_APP_URL=http://localhost:3000
NODE_ENV=development
```

---

## 3 — Set up the database (once)

```bash
cd nexus
npx prisma migrate dev
```

If it asks for a migration name, type `init` and press Enter.

To view your database tables visually:

```bash
npx prisma studio
# Opens at http://localhost:5555
```

---

## 4 — Start the dev server

```bash
cd nexus
pnpm dev
```

App runs at **<http://localhost:3000>**. Pages to check:

- <http://localhost:3000> — landing page
- <http://localhost:3000/playground> — test L402 payments interactively
- <http://localhost:3000/dashboard> — live payment dashboard
- <http://localhost:3000/api/v1/health> — check all services are connected

---

## 5 — Run the Python demo agent (optional)

In a separate terminal:

```bash
cd demo-agent
pip install -r requirements.txt
cp .env.example .env
# Edit .env — add your keys and set NEXUS_API_URL=http://localhost:3000
```

Then run it:

```bash
# Basic search
python demo_agent.py "What is the Lightning Network?"

# Deep research
python demo_agent.py --tier RESEARCH "How do AI agents pay for services?"

# Extract content from a URL
python demo_agent.py --tier EXTRACT --urls "https://lightning.network"
```

The agent will automatically:

1. Hit your local server
2. Get back a 402 with a Lightning invoice
3. Pay the invoice via Alby
4. Retry and get the actual results

---

## Common issues

### `pnpm: command not found`

```bash
npm install -g pnpm
```

### Prisma can't connect to database

- Make sure `DATABASE_URL` is the **pooler** URL (port 6543) with `?pgbouncer=true`
- Make sure `DIRECT_URL` is the **direct** URL (port 5432) — no pooler suffix
- If your Supabase project is paused (free tier pauses after 1 week), go to <https://supabase.com> → your project → click **Restore**

### `Module not found` errors after install

```bash
cd nexus
rm -rf node_modules
pnpm install
```

### Prisma client not generated

```bash
cd nexus
npx prisma generate
```

### Port 3000 already in use

```bash
pnpm dev -- -p 3001
# Then update NEXT_PUBLIC_APP_URL=http://localhost:3001 in .env
```

---

## Useful commands

```bash
# Start dev server
pnpm dev

# Type-check without running
npx tsc --noEmit

# Format code
npx prettier --write .

# Open Prisma Studio (DB GUI)
npx prisma studio

# Re-generate Prisma client (after schema changes)
npx prisma generate

# Run a migration after schema change
npx prisma migrate dev --name describe_what_changed
```
