import { db } from "@/lib/db"
import { redis, CACHE_KEYS } from "@/lib/redis"
import { AGENT_REGISTRATION_SATS, PLATFORM_FEE_PCT } from "@/config/pricing"
import { TaskStatus, TaskType } from "@/app/generated/prisma/index"
import { z } from "zod"

export const RegisterAgentSchema = z.object({
  name: z.string().min(2).max(100),
  description: z.string().min(10).max(1000),
  capabilities: z.array(z.string()).min(1).max(10),
  endpoint: z.string().url(),
  lightningAddress: z.string().optional(),
  pubkey: z.string().optional(),
})

export const CreateTaskSchema = z.object({
  type: z.nativeEnum(TaskType),
  description: z.string().min(10).max(2000),
  bountyAmountSats: z.number().int().min(1).max(1_000_000),
  hirerId: z.string().optional(),
})

export async function registerAgent(data: z.infer<typeof RegisterAgentSchema>) {
  const agent = await db.agent.create({
    data: {
      ...data,
      stakeAmountSats: AGENT_REGISTRATION_SATS,
    },
  })
  await redis.del(CACHE_KEYS.agentList)
  return agent
}

export async function listAgents(capability?: string) {
  const cacheKey = `${CACHE_KEYS.agentList}:${capability ?? "all"}`
  const cached = await redis.get(cacheKey)
  if (cached) return cached

  const agents = await db.agent.findMany({
    where: {
      isActive: true,
      ...(capability ? { capabilities: { has: capability } } : {}),
    },
    orderBy: { reputationScore: "desc" },
    take: 50,
  })

  await redis.setex(cacheKey, 30, agents)
  return agents
}

export async function getAgent(id: string) {
  return db.agent.findUnique({
    where: { id },
    include: {
      tasksAsHiree: { orderBy: { createdAt: "desc" }, take: 10 },
      _count: { select: { tasksAsHiree: true } },
    },
  })
}

export async function createTask(hireeId: string, data: z.infer<typeof CreateTaskSchema>) {
  const agent = await db.agent.findUnique({ where: { id: hireeId } })
  if (!agent) throw new Error("Agent not found")

  const bounty = data.bountyAmountSats as number
  const platformFee = Math.ceil(bounty * (PLATFORM_FEE_PCT / 100))

  return db.task.create({
    data: {
      type: data.type,
      description: data.description,
      bountyAmountSats: bounty - platformFee,
      stakeAmountSats: platformFee,
      hireeId,
      hirerId: data.hirerId,
    },
  })
}

export async function completeTask(taskId: string, result: string) {
  const task = await db.task.update({
    where: { id: taskId },
    data: { status: TaskStatus.COMPLETED, result, completedAt: new Date() },
    include: { hiree: true },
  })

  // Update reputation
  await updateReputation(task.hireeId)
  return task
}

export async function updateReputation(agentId: string) {
  const [tasks, avgResponse] = await Promise.all([
    db.task.findMany({ where: { hireeId: agentId, status: { in: [TaskStatus.COMPLETED, TaskStatus.DISPUTED] } } }),
    db.task.aggregate({
      where: { hireeId: agentId, status: TaskStatus.COMPLETED, startedAt: { not: null }, completedAt: { not: null } },
      _avg: { bountyAmountSats: true },
    }),
  ])

  if (!tasks.length) return

  const completed = tasks.filter((t: { status: string }) => t.status === TaskStatus.COMPLETED).length
  const disputed = tasks.filter((t: { status: string }) => t.status === TaskStatus.DISPUTED).length
  const completionRate = completed / tasks.length
  const disputeRate = disputed / tasks.length

  const agent = await db.agent.findUnique({ where: { id: agentId } })
  if (!agent) return

  const stakeScore = Math.min(1, agent.stakeAmountSats / 10_000)
  const responseScore = Math.max(0, 1 - (agent.avgResponseMs ?? 0) / 30_000)

  const reputationScore =
    completionRate * 0.4 + responseScore * 0.2 + (1 - disputeRate) * 0.3 + stakeScore * 0.1

  await db.agent.update({
    where: { id: agentId },
    data: {
      reputationScore: Math.round(reputationScore * 100) / 100,
      completionRate: Math.round(completionRate * 100) / 100,
      disputeRate: Math.round(disputeRate * 100) / 100,
      totalTasksDone: completed,
    },
  })

  await redis.del(CACHE_KEYS.agentList)
}
