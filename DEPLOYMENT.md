# Nexus — Deployment Guide (Step by Step)

This is the no-confusion version. Follow each step in order.

---

## Step 1 — Get your API keys (do this first, ~15 min)

| What | Where | What you get |
| --- | --- | --- |
| Supabase (Postgres DB) | <https://supabase.com> | `DATABASE_URL` + `DIRECT_URL` |
| Upstash (Redis cache) | <https://upstash.com> | `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` |
| Tavily (web search) | <https://app.tavily.com> | `TAVILY_API_KEY` |
| Anthropic (Claude AI) | <https://console.anthropic.com> | `ANTHROPIC_API_KEY` |
| Alby (Lightning payments) | <https://getalby.com> | `ALBY_ACCESS_TOKEN` |
| LangSmith (optional traces) | <https://smith.langchain.com> | `LANGCHAIN_API_KEY` |

---

## Step 2 — Set up Supabase (Postgres)

1. Go to <https://supabase.com> → **New project** → name it `nexus`
2. Wait ~1 min for the project to spin up
3. Go to **Project Settings → Database → Connection string**
4. You'll see several connection strings — you need two:

**Transaction pooler** (port 6543) → this is your `DATABASE_URL`

```text
postgresql://postgres.[project-ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres
```

Add `?pgbouncer=true` at the end so it works with Prisma in serverless:

```text
postgresql://postgres.[project-ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres?pgbouncer=true
```

**Direct connection** (port 5432) → this is your `DIRECT_URL`

```text
postgresql://postgres:[password]@db.[project-ref].supabase.co:5432/postgres
```

> Why two URLs? The **pooler** handles concurrent serverless requests efficiently.
> The **direct** connection is used only by Prisma for running migrations.

---

## Step 3 — Set up Upstash (Redis)

1. Go to <https://upstash.com> → **Create Database**
2. Pick type **Redis**, region **us-east-1**
3. Copy `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` from the dashboard

---

## Step 4 — Create your `.env` file

Inside the `nexus/` folder:

```bash
cp .env.example .env
```

Then open `.env` and fill in your values:

```bash
# nexus/.env

TAVILY_API_KEY=tvly-YOUR_KEY
ANTHROPIC_API_KEY=sk-ant-YOUR_KEY
ALBY_ACCESS_TOKEN=YOUR_ALBY_TOKEN

# Supabase — transaction pooler (port 6543, add ?pgbouncer=true)
DATABASE_URL=postgresql://postgres.[ref]:[pass]@aws-0-[region].pooler.supabase.com:6543/postgres?pgbouncer=true

# Supabase — direct connection (port 5432, for migrations)
DIRECT_URL=postgresql://postgres:[pass]@db.[ref].supabase.co:5432/postgres

UPSTASH_REDIS_REST_URL=https://xxx.upstash.io
UPSTASH_REDIS_REST_TOKEN=xxx

NEXT_PUBLIC_APP_URL=http://localhost:3000
NODE_ENV=development
```

> **Never commit this file.** It's already in `.gitignore`.

---

## Step 5 — Deploy to Vercel

Use the deploy button — it prompts for every required env var before deploying:

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2FNishu3005%2Fhack-nation-5th-global-ai-hackathon-submission&root=nexus&env=TAVILY_API_KEY,ANTHROPIC_API_KEY,ALBY_ACCESS_TOKEN,DATABASE_URL,DIRECT_URL,UPSTASH_REDIS_REST_URL,UPSTASH_REDIS_REST_TOKEN&envDescription=API%20keys%20for%20Nexus%20%E2%80%94%20see%20nexus%2F.env.example%20for%20instructions&envLink=https%3A%2F%2Fgithub.com%2FNishu3005%2Fhack-nation-5th-global-ai-hackathon-submission%2Fblob%2Fmain%2Fnexus%2F.env.example&project-name=nexus-lightning&repository-name=nexus-lightning)

Fill in the form using the values from Steps 1–3. Vercel then automatically:

1. Installs deps → `prisma generate` runs via `postinstall`
2. Runs `prisma migrate deploy` → creates all DB tables in Supabase
3. Runs `next build`
4. Deploys your app

**No manual migration step needed.**

### If you prefer manual import (no button)

1. Go to <https://vercel.com/new> → import your repo
2. Set **Root Directory** to `nexus`
3. Add these env vars (see `nexus/.env.example` for where to get each value):

```text
TAVILY_API_KEY
ANTHROPIC_API_KEY
ALBY_ACCESS_TOKEN
DATABASE_URL           ← Supabase transaction pooler, port 6543, add ?pgbouncer=true
DIRECT_URL             ← Supabase direct connection, port 5432
UPSTASH_REDIS_REST_URL
UPSTASH_REDIS_REST_TOKEN
```

1. Click Deploy

---

## Step 6 — Set NEXT_PUBLIC_APP_URL (after first deploy)

Once Vercel gives you your deployment URL (e.g. `https://nexus-xxx.vercel.app`):

1. Vercel project → **Settings → Environment Variables**
2. Add: `NEXT_PUBLIC_APP_URL` = `https://nexus-xxx.vercel.app`
3. Redeploy: **Deployments → three dots → Redeploy**

This makes the playground and dashboard use the correct absolute URL.

---

## Step 7 — Verify it's working

```bash
curl https://YOUR-APP.vercel.app/api/v1/health
```

You should see:

```json
{ "status": "healthy", "services": { ... } }
```

Then open:

- `/playground` — interactive L402 payment demo
- `/dashboard` — live payment waterfall

---

## Updating env vars after deploy

1. Vercel dashboard → your project → **Settings → Environment Variables**
2. Update the value → **Save**
3. Redeploy: Deployments → three dots → **Redeploy**

---

## Troubleshooting

| Problem | Fix |
| --- | --- |
| `page not found` on Vercel | Make sure **Root Directory** is set to `nexus` in Vercel project settings |
| Prisma can't connect | Check `DIRECT_URL` is the port-5432 direct URL (not the pooler) |
| `prepared statement already exists` | Make sure `DATABASE_URL` has `?pgbouncer=true` at the end |
| Build fails — `Cannot find module prisma` | The `postinstall` script runs `prisma generate` — make sure `prisma` is in devDependencies |
| Supabase paused | Free tier pauses after 1 week of inactivity — go to Supabase dashboard and click **Restore** |
| Redis errors | Check `UPSTASH_REDIS_REST_URL` starts with `https://` |
| Anthropic errors | Add billing credit at <https://console.anthropic.com> (add $5) |
