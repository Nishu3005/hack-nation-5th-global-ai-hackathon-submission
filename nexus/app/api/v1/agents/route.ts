export const dynamic = "force-dynamic"
import { NextRequest, NextResponse } from "next/server"
import { listAgents, registerAgent, RegisterAgentSchema } from "@/server/services/agent.service"
import { corsHeaders } from "@/server/middleware/l402"
import { logger } from "@/lib/logger"

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders() })
}

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const capability = searchParams.get("capability") ?? undefined

  try {
    const agents = await listAgents(capability)
    return NextResponse.json({ success: true, data: agents }, { headers: corsHeaders() })
  } catch (err) {
    logger.error({ err }, "List agents failed")
    return NextResponse.json({ error: "Failed to list agents" }, { status: 500, headers: corsHeaders() })
  }
}

export async function POST(req: NextRequest) {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400, headers: corsHeaders() })
  }

  const parsed = RegisterAgentSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed", details: parsed.error.issues }, { status: 400, headers: corsHeaders() })
  }

  try {
    const agent = await registerAgent(parsed.data)
    logger.info({ agentId: agent.id, name: agent.name }, "Agent registered")
    return NextResponse.json(
      {
        success: true,
        data: agent,
        meta: {
          stakeRequired: agent.stakeAmountSats,
          message: "Agent registered. Stake 100 sats to activate full reputation scoring.",
        },
      },
      { status: 201, headers: corsHeaders() }
    )
  } catch (err) {
    logger.error({ err }, "Agent registration failed")
    return NextResponse.json({ error: "Registration failed" }, { status: 500, headers: corsHeaders() })
  }
}
