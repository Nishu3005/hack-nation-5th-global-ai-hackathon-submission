export const dynamic = "force-dynamic"
import { NextRequest, NextResponse } from "next/server"
import { getAgent } from "@/server/services/agent.service"
import { corsHeaders } from "@/server/middleware/l402"

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders() })
}

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params

  const agent = await getAgent(id)
  if (!agent) {
    return NextResponse.json({ error: "Agent not found" }, { status: 404, headers: corsHeaders() })
  }

  return NextResponse.json({ success: true, data: agent }, { headers: corsHeaders() })
}
