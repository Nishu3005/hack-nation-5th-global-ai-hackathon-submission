export const dynamic = "force-dynamic"
import { NextRequest, NextResponse } from "next/server"
import { createTask, CreateTaskSchema } from "@/server/services/agent.service"
import { corsHeaders } from "@/server/middleware/l402"
import { logger } from "@/lib/logger"

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders() })
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400, headers: corsHeaders() })
  }

  const parsed = CreateTaskSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed", details: parsed.error.issues }, { status: 400, headers: corsHeaders() })
  }

  try {
    const task = await createTask(id, parsed.data)
    logger.info({ taskId: task.id, hireeId: id }, "Task created")
    return NextResponse.json({ success: true, data: task }, { status: 201, headers: corsHeaders() })
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Task creation failed"
    return NextResponse.json({ error: msg }, { status: 400, headers: corsHeaders() })
  }
}
