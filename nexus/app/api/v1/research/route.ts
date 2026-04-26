export const dynamic = "force-dynamic"
import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { enforceL402, corsHeaders } from "@/server/middleware/l402"
import { runResearch } from "@/server/workflows/research.graph"
import { hashQuery } from "@/lib/crypto"
import { redis, CACHE_KEYS } from "@/lib/redis"
import { logger } from "@/lib/logger"
import { nanoid } from "nanoid"

export const maxDuration = 60

const ResearchBody = z.object({
  query: z.string().min(1).max(500),
  agentId: z.string().optional(),
})

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders() })
}

export async function POST(req: NextRequest) {
  let body: z.infer<typeof ResearchBody>
  try {
    body = ResearchBody.parse(await req.json())
  } catch (err) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400, headers: corsHeaders() })
  }

  const { query, agentId } = body

  const l402 = await enforceL402(req, query, "RESEARCH", agentId)
  if (!l402.authorized) {
    return new NextResponse(l402.response.body, {
      status: 402,
      headers: { ...Object.fromEntries(l402.response.headers.entries()), ...corsHeaders() },
    })
  }

  const streamId = nanoid()
  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`))
      }

      send("start", { streamId, query, timestamp: new Date().toISOString() })

      // Subscribe to Redis pub/sub for node progress events
      // We run research and capture events via polling since Upstash Redis doesn't support blocking subscribe
      const pollInterval = 500
      let lastEventId = 0

      const pollEvents = async () => {
        const events = await redis?.lrange(`nexus:stream:${streamId}`, lastEventId, -1)
        for (const ev of events) {
          try {
            const parsed = JSON.parse(ev as string)
            send(parsed.event, parsed.data)
            lastEventId++
          } catch {}
        }
      }

      // Write events to a per-stream list instead of pub/sub
      // Run research in parallel
      const researchPromise = runResearch(query, streamId)

      // Poll for events while research runs
      let done = false
      researchPromise.then(() => { done = true }).catch(() => { done = true })

      while (!done) {
        await new Promise((r) => setTimeout(r, pollInterval))
        await pollEvents()
      }

      try {
        const result = await researchPromise
        send("result", {
          synthesis: result.synthesis,
          citations: result.citations,
          confidence: result.confidence,
          sourceCount: result.sources.length,
        })
        send("done", { streamId, timestamp: new Date().toISOString() })
      } catch (err) {
        logger.error({ err, streamId }, "Research failed")
        send("error", { message: "Research pipeline failed", streamId })
      }

      // Cleanup
      await redis?.del(`nexus:stream:${streamId}`)
      controller.close()
    },
  })

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "X-Stream-Id": streamId,
      ...corsHeaders(),
    },
  })
}
