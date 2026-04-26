export const dynamic = "force-dynamic"
import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { enforceL402, corsHeaders } from "@/server/middleware/l402"
import { extractContent } from "@/server/services/search.service"
import { hashQuery } from "@/lib/crypto"
import { logger } from "@/lib/logger"

const ExtractBody = z.object({
  urls: z.array(z.string().url()).min(1).max(5),
  agentId: z.string().optional(),
})

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders() })
}

export async function POST(req: NextRequest) {
  let body: z.infer<typeof ExtractBody>
  try {
    body = ExtractBody.parse(await req.json())
  } catch (err) {
    return NextResponse.json({ error: "Invalid request", details: err }, { status: 400, headers: corsHeaders() })
  }

  const { urls, agentId } = body
  const query = urls.join(",")

  const l402 = await enforceL402(req, query, "EXTRACT", agentId)
  if (!l402.authorized) {
    return new NextResponse(l402.response.body, {
      status: 402,
      headers: { ...Object.fromEntries(l402.response.headers.entries()), ...corsHeaders() },
    })
  }

  try {
    const results = await extractContent(urls)
    logger.info({ urlCount: urls.length }, "Extract complete")

    return NextResponse.json(
      {
        success: true,
        data: { results },
        meta: { timestamp: new Date().toISOString() },
      },
      { headers: corsHeaders() }
    )
  } catch (err) {
    logger.error({ err }, "Extract failed")
    return NextResponse.json({ error: "Extract failed", code: "EXTRACT_ERROR" }, { status: 500, headers: corsHeaders() })
  }
}
