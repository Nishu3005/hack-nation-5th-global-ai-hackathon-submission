export const dynamic = "force-dynamic"
import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { redis } from "@/lib/redis"
import { corsHeaders } from "@/server/middleware/l402"

export async function GET() {
  const start = Date.now()
  const checks: Record<string, { status: string; latencyMs?: number }> = {}

  // DB check
  const dbStart = Date.now()
  try {
    await db.$queryRaw`SELECT 1`
    checks.database = { status: "ok", latencyMs: Date.now() - dbStart }
  } catch {
    checks.database = { status: "error" }
  }

  // Redis check
  const redisStart = Date.now()
  try {
    await redis.ping()
    checks.redis = { status: "ok", latencyMs: Date.now() - redisStart }
  } catch {
    checks.redis = { status: "error" }
  }

  // Alby check
  const albyStart = Date.now()
  try {
    const res = await fetch(`${process.env.LIGHTNING_NODE_URL ?? "https://api.getalby.com"}/invoices`, {
      method: "GET",
      headers: { Authorization: `Bearer ${process.env.ALBY_ACCESS_TOKEN}` },
    })
    checks.lightning = { status: res.ok ? "ok" : "degraded", latencyMs: Date.now() - albyStart }
  } catch {
    checks.lightning = { status: "error" }
  }

  const allOk = Object.values(checks).every((c) => c.status === "ok")

  return NextResponse.json(
    {
      status: allOk ? "healthy" : "degraded",
      version: "1.0.0",
      uptime: process.uptime(),
      checks,
      took: Date.now() - start,
    },
    {
      status: allOk ? 200 : 503,
      headers: corsHeaders(),
    }
  )
}
