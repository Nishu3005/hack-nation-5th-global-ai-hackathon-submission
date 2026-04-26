export const dynamic = "force-dynamic"
import { NextRequest, NextResponse } from "next/server"
import { redis } from "@/lib/redis"
import { db } from "@/lib/db"
import { corsHeaders } from "@/server/middleware/l402"
import { PaymentStatus } from "@/app/generated/prisma/index"

export const maxDuration = 60

// Dashboard SSE: streams real-time payment events and system stats
export async function GET(req: NextRequest) {
  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        try {
          controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`))
        } catch {}
      }

      // Send initial state snapshot
      const [stats, recentPayments, agentCount] = await Promise.all([
        db.payment.aggregate({ where: { status: PaymentStatus.PAID }, _sum: { amountSats: true }, _count: true }),
        db.payment.findMany({
          where: { status: PaymentStatus.PAID },
          orderBy: { settledAt: "desc" },
          take: 10,
          select: { amountSats: true, tier: true, settledAt: true, queryHash: true },
        }),
        db.agent.count({ where: { isActive: true } }),
      ])

      send("snapshot", {
        totalSats: stats._sum.amountSats ?? 0,
        totalPayments: stats._count,
        activeAgents: agentCount,
        recentPayments,
      })

      // Poll for new payments every 2 seconds (Upstash Redis doesn't support blocking subscribe)
      let lastPaymentId: string | null = null
      let heartbeatCount = 0
      let alive = true

      req.signal?.addEventListener("abort", () => { alive = false })

      while (alive) {
        await new Promise((r) => setTimeout(r, 2000))
        if (!alive) break

        heartbeatCount++
        if (heartbeatCount % 10 === 0) {
          send("heartbeat", { ts: Date.now() })
        }

        // Poll for new paid payments
        const newPayments: Array<{ id: string; amountSats: number; tier: string; settledAt: Date | null; queryHash: string }> = await db.payment.findMany({
          where: {
            status: PaymentStatus.PAID,
            ...(lastPaymentId ? { id: { gt: lastPaymentId } } : {}),
          },
          orderBy: { createdAt: "asc" },
          take: 5,
        })

        for (const p of newPayments) {
          send("payment", {
            id: p.id,
            amountSats: p.amountSats,
            tier: p.tier,
            settledAt: p.settledAt,
            queryHash: p.queryHash,
          })
          lastPaymentId = p.id
        }

        // Check for research stream events (per-streamId lists)
        // These are published by the research pipeline
        const streamKeys = await redis.keys("nexus:stream:*")
        for (const key of streamKeys.slice(0, 5)) {
          const events = await redis.lrange(key, 0, -1)
          for (const ev of events) {
            try {
              const parsed = JSON.parse(ev as string)
              if (parsed.event && parsed.event !== "heartbeat") {
                send("research_event", parsed)
              }
            } catch {}
          }
        }
      }

      controller.close()
    },
  })

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      ...corsHeaders(),
    },
  })
}
