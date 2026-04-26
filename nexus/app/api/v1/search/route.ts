export const dynamic = "force-dynamic"
import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { enforceL402, corsHeaders } from "@/server/middleware/l402"
import { searchWithCache } from "@/server/services/search.service"
import { hashQuery } from "@/lib/crypto"
import { logger } from "@/lib/logger"
import { Ratelimit } from "@upstash/ratelimit"
import { redis } from "@/lib/redis"

const ratelimit = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(30, "1 m"),
      analytics: true,
      prefix: "nexus:rl:search",
    })
  : null

const SearchBody = z.object({
  query: z.string().min(1).max(500),
  tier: z.enum(["FLASH", "BASIC", "DEEP"]).default("FLASH"),
  agentId: z.string().optional(),
})

const BYPASS_L402 = process.env.BYPASS_L402 === "true"

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders() })
}

export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0] ?? "unknown"
    if (ratelimit) {
      const { success } = await ratelimit.limit(ip)
      if (!success) {
        return NextResponse.json({ error: "Rate limit exceeded", code: "RATE_LIMIT" }, { status: 429, headers: corsHeaders() })
      }
    }

    let body: z.infer<typeof SearchBody>
    try {
      body = SearchBody.parse(await req.json())
    } catch (err) {
      return NextResponse.json({ error: "Invalid request", details: err }, { status: 400, headers: corsHeaders() })
    }

    const { query, tier, agentId } = body

    // L402 enforcement — skipped in dev when BYPASS_L402=true
    if (!BYPASS_L402) {
      const l402 = await enforceL402(req, query, tier, agentId)
      if (!l402.authorized) {
        return new NextResponse(l402.response.body, {
          status: 402,
          headers: { ...Object.fromEntries(l402.response.headers.entries()), ...corsHeaders() },
        })
      }
    }

    const queryHash = hashQuery(query, tier)
    const result = await searchWithCache(queryHash, query, tier)
    logger.info({ queryHash, tier, fromCache: result.fromCache }, "Search served")

    return NextResponse.json(
      {
        success: true,
        data: {
          query: result.query,
          tier: result.tier,
          results: result.results,
          answer: result.answer,
          fromCache: result.fromCache,
          took: result.took,
        },
        meta: { queryHash, timestamp: new Date().toISOString() },
      },
      { headers: corsHeaders() }
    )
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    logger.error({ err }, "Search route crashed")
    return NextResponse.json({ error: message, code: "INTERNAL_ERROR" }, { status: 500, headers: corsHeaders() })
  }
}
