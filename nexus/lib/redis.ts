import { Redis } from "@upstash/redis"

const hasRedis =
  process.env.UPSTASH_REDIS_REST_URL &&
  !process.env.UPSTASH_REDIS_REST_URL.includes("YOUR_DB") &&
  process.env.UPSTASH_REDIS_REST_TOKEN &&
  !process.env.UPSTASH_REDIS_REST_TOKEN.includes("YOUR_TOKEN")

export const redis = hasRedis
  ? new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL!,
      token: process.env.UPSTASH_REDIS_REST_TOKEN!,
    })
  : null

export const CACHE_KEYS = {
  search: (hash: string) => `nexus:search:${hash}`,
  payment: (hash: string) => `nexus:payment:${hash}`,
  rateLimit: (ip: string) => `nexus:rate:${ip}`,
  stream: "nexus:stream:events",
  agentList: "nexus:agents:list",
} as const
