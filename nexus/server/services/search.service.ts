import { tavily } from "@tavily/core"
import { redis, CACHE_KEYS } from "@/lib/redis"
import { db } from "@/lib/db"
import { logger } from "@/lib/logger"
import { getCacheTtl } from "@/config/pricing"
import { Tier } from "@prisma/client"
import { LRUCache } from "lru-cache"
import CircuitBreaker from "opossum"
import pLimit from "p-limit"
import pRetry from "p-retry"

function getClient() {
  return tavily({ apiKey: process.env.TAVILY_API_KEY! })
}

// Layer 1: In-process LRU
const lruCache = new LRUCache<string, SearchResult>({ max: 500, ttl: 60_000 })

export interface SearchResult {
  query: string
  tier: Tier
  results: SearchResultItem[]
  answer?: string
  queryHash: string
  cachedAt?: number
  fromCache: boolean
  took: number
}

export interface SearchResultItem {
  title: string
  url: string
  content: string
  score: number
  publishedDate?: string
}

let _breaker: CircuitBreaker | null = null
function getBreaker() {
  if (!_breaker) {
    _breaker = new CircuitBreaker(
      async (fn: () => Promise<unknown>) => fn(),
      { timeout: 10_000, errorThresholdPercentage: 50, resetTimeout: 30_000 }
    )
    _breaker.on("open", () => logger.warn("Tavily circuit breaker OPEN"))
    _breaker.on("halfOpen", () => logger.info("Tavily circuit breaker HALF-OPEN"))
  }
  return _breaker
}

async function executeTavilySearch(query: string, tier: Tier): Promise<SearchResult> {
  const start = Date.now()

  const c = getClient()
  const tierConfig: Record<Tier, Parameters<typeof c.search>[1]> = {
    FLASH: { searchDepth: "basic", maxResults: 5, includeAnswer: true },
    BASIC: { searchDepth: "basic", maxResults: 10, includeAnswer: true },
    DEEP: { searchDepth: "advanced", maxResults: 15, includeAnswer: true, includeRawContent: "text" as const },
    RESEARCH: { searchDepth: "advanced", maxResults: 20, includeAnswer: true, includeRawContent: "text" as const },
    EXTRACT: { searchDepth: "basic", maxResults: 5 },
  }

  const response = await (getBreaker().fire(async () =>
    pRetry(() => c.search(query, tierConfig[tier] ?? { searchDepth: "basic", maxResults: 5 }), {
      retries: 2,
      minTimeout: 500,
    })
  ) as Promise<Awaited<ReturnType<typeof c.search>>>)

  return {
    query,
    tier,
    results: (response.results ?? []).map((r) => ({
      title: r.title ?? "",
      url: r.url ?? "",
      content: r.content ?? "",
      score: r.score ?? 0,
      publishedDate: r.publishedDate,
    })),
    answer: response.answer,
    queryHash: "",
    fromCache: false,
    took: Date.now() - start,
  }
}

async function executeTavilyExtract(urls: string[]): Promise<{ url: string; content: string }[]> {
  const limit = pLimit(3)
  const results = await Promise.all(
    urls.map((url) =>
      limit(() =>
        pRetry(() => getClient().extract([url]), { retries: 1 }).then((r) => ({
          url,
          content: r.results?.[0]?.rawContent ?? "",
        }))
      )
    )
  )
  return results
}

export async function searchWithCache(
  queryHash: string,
  query: string,
  tier: Tier
): Promise<SearchResult> {
  // Layer 1: LRU
  const lruHit = lruCache.get(queryHash)
  if (lruHit) return { ...lruHit, fromCache: true, cachedAt: Date.now() }

  // Layer 2: Redis
  const redisHit = await redis?.get<SearchResult>(CACHE_KEYS.search(queryHash))
  if (redisHit) {
    lruCache.set(queryHash, redisHit)
    return { ...redisHit, fromCache: true, cachedAt: Date.now() }
  }

  // Layer 3: DB (skip gracefully if tables don't exist yet)
  try {
    const dbHit = await db.searchCache.findUnique({ where: { queryHash } })
    if (dbHit && dbHit.expiresAt > new Date()) {
      const result = dbHit.result as unknown as SearchResult
      await db.searchCache.update({ where: { queryHash }, data: { hitCount: { increment: 1 } } })
      const ttl = getCacheTtl(tier)
      await redis?.setex(CACHE_KEYS.search(queryHash), ttl, result)
      lruCache.set(queryHash, result)
      return { ...result, fromCache: true, cachedAt: Date.now() }
    }
  } catch {
    logger.warn("DB cache unavailable — falling through to Tavily")
  }

  // Miss — call Tavily
  const result = await executeTavilySearch(query, tier)
  result.queryHash = queryHash

  const ttl = getCacheTtl(tier)
  const expiresAt = new Date(Date.now() + ttl * 1000)

  // Write to all layers (DB write skipped gracefully if tables missing)
  await Promise.all([
    redis?.setex(CACHE_KEYS.search(queryHash), ttl, result),
    db.searchCache.upsert({
      where: { queryHash },
      create: { queryHash, tier, query, result: JSON.parse(JSON.stringify(result)), expiresAt },
      update: { result: JSON.parse(JSON.stringify(result)), expiresAt, hitCount: 0 },
    }).catch(() => null),
  ])
  lruCache.set(queryHash, result)

  logger.info({ queryHash, tier, took: result.took }, "Tavily search complete")
  return result
}

export async function extractContent(urls: string[]): Promise<{ url: string; content: string }[]> {
  return executeTavilyExtract(urls)
}
