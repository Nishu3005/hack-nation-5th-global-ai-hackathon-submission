import { StateGraph, END, START } from "@langchain/langgraph"
import { Annotation } from "@langchain/langgraph"
import { ChatAnthropic } from "@langchain/anthropic"
import { tavily } from "@tavily/core"
import { redis } from "@/lib/redis"
import { logger } from "@/lib/logger"
import pLimit from "p-limit"

// Lazy clients — never initialized at module load time (breaks Next.js build)
function getTavily() {
  return tavily({ apiKey: process.env.TAVILY_API_KEY! })
}
function getClaude() {
  return new ChatAnthropic({ model: "claude-sonnet-4-6", apiKey: process.env.ANTHROPIC_API_KEY, maxTokens: 4096 })
}

const ResearchState = Annotation.Root({
  query: Annotation<string>(),
  subQuestions: Annotation<string[]>({ default: () => [], reducer: (_a, b) => b }),
  searchResults: Annotation<Record<string, SearchResult[]>>({
    default: () => ({}),
    reducer: (a, b) => ({ ...a, ...b }),
  }),
  gaps: Annotation<string[]>({ default: () => [], reducer: (_a, b) => b }),
  synthesis: Annotation<string>({ default: () => "", reducer: (_a, b) => b }),
  citations: Annotation<Citation[]>({ default: () => [], reducer: (_a, b) => b }),
  confidence: Annotation<number>({ default: () => 0, reducer: (_a, b) => b }),
  iteration: Annotation<number>({ default: () => 0, reducer: (_a, b) => b }),
  streamId: Annotation<string>({ default: () => "", reducer: (_a, b) => b }),
})

interface SearchResult {
  title: string
  url: string
  content: string
  score: number
}

interface Citation {
  index: number
  title: string
  url: string
}

async function pushEvent(streamId: string, event: string, data: unknown) {
  if (!streamId) return
  await redis?.rpush(`nexus:stream:${streamId}`, JSON.stringify({ event, data, timestamp: Date.now() }))
  await redis?.expire(`nexus:stream:${streamId}`, 120)
}

async function analyzeQuery(state: typeof ResearchState.State) {
  await pushEvent(state.streamId, "node_start", { node: "analyzer", query: state.query })

  const claude = getClaude()
  const response = await claude.invoke([
    {
      role: "user",
      content: `Decompose this research query into 3-5 specific sub-questions. Return ONLY a JSON array of strings, no explanation.\n\nQuery: "${state.query}"`,
    },
  ])

  let subQuestions: string[]
  try {
    const text = typeof response.content === "string" ? response.content : (response.content[0] as { text: string }).text
    const match = text.match(/\[[\s\S]*\]/)
    subQuestions = match ? JSON.parse(match[0]) : [state.query]
  } catch {
    subQuestions = [state.query]
  }

  await pushEvent(state.streamId, "node_complete", { node: "analyzer", subQuestions })
  return { subQuestions }
}

async function parallelSearch(state: typeof ResearchState.State) {
  await pushEvent(state.streamId, "node_start", { node: "searcher", count: state.subQuestions.length })

  const tc = getTavily()
  const limit = pLimit(3)
  const results = await Promise.all(
    state.subQuestions.map((q) =>
      limit(async () => {
        await pushEvent(state.streamId, "search_start", { question: q })
        const res = await tc.search(q, { searchDepth: "advanced", maxResults: 8, includeAnswer: true })
        const mapped: SearchResult[] = (res.results ?? []).map((r) => ({
          title: r.title ?? "",
          url: r.url ?? "",
          content: r.content ?? "",
          score: r.score ?? 0,
        }))
        await pushEvent(state.streamId, "search_complete", { question: q, count: mapped.length })
        return { [q]: mapped }
      })
    )
  )

  const searchResults = Object.assign({}, ...results)
  await pushEvent(state.streamId, "node_complete", { node: "searcher", total: Object.values(searchResults).flat().length })
  return { searchResults }
}

async function detectGaps(state: typeof ResearchState.State) {
  await pushEvent(state.streamId, "node_start", { node: "gap_detector" })

  const allResults = Object.values(state.searchResults).flat()
  const summaries = allResults
    .slice(0, 12)
    .map((r, i) => `[${i + 1}] ${r.title}: ${r.content.slice(0, 200)}`)
    .join("\n")

  const claude = getClaude()
  const response = await claude.invoke([
    {
      role: "user",
      content: `Research query: "${state.query}"\n\nCurrent results:\n${summaries}\n\nList gaps — aspects not yet answered. Return ONLY a JSON array (max 2 items, empty array if coverage is sufficient).`,
    },
  ])

  let gaps: string[] = []
  try {
    const text = typeof response.content === "string" ? response.content : (response.content[0] as { text: string }).text
    const match = text.match(/\[[\s\S]*\]/)
    gaps = match ? JSON.parse(match[0]) : []
  } catch {
    gaps = []
  }

  await pushEvent(state.streamId, "node_complete", { node: "gap_detector", gaps })
  return { gaps, iteration: state.iteration + 1 }
}

async function fillGaps(state: typeof ResearchState.State) {
  await pushEvent(state.streamId, "node_start", { node: "gap_filler", gaps: state.gaps })

  const tc = getTavily()
  const limit = pLimit(2)
  const results = await Promise.all(
    state.gaps.map((gap) =>
      limit(async () => {
        const res = await tc.search(gap, { searchDepth: "advanced", maxResults: 5 })
        const mapped: SearchResult[] = (res.results ?? []).map((r) => ({
          title: r.title ?? "",
          url: r.url ?? "",
          content: r.content ?? "",
          score: r.score ?? 0,
        }))
        return { [gap]: mapped }
      })
    )
  )

  await pushEvent(state.streamId, "node_complete", { node: "gap_filler" })
  return { searchResults: Object.assign({}, state.searchResults, ...results) }
}

async function synthesize(state: typeof ResearchState.State) {
  await pushEvent(state.streamId, "node_start", { node: "synthesizer" })

  const allResults = Object.values(state.searchResults).flat()
  const deduped = Array.from(new Map(allResults.map((r) => [r.url, r])).values())
    .sort((a, b) => b.score - a.score)
    .slice(0, 20)

  const citations: Citation[] = deduped.map((r, i) => ({ index: i + 1, title: r.title, url: r.url }))
  const sourcesText = deduped.map((r, i) => `[${i + 1}] ${r.title}\n${r.url}\n${r.content.slice(0, 500)}`).join("\n\n")

  const claude = getClaude()
  const response = await claude.invoke([
    {
      role: "user",
      content: `Write a comprehensive, cited research answer.\n\nQuery: "${state.query}"\n\nSources:\n${sourcesText}\n\nRequirements:\n- 3-5 clear paragraphs\n- Use [N] citations\n- Final line: "CONFIDENCE: <0-100>"`,
    },
  ])

  const text = typeof response.content === "string" ? response.content : (response.content[0] as { text: string }).text
  const confidenceMatch = text.match(/CONFIDENCE:\s*(\d+)/)
  const confidence = confidenceMatch ? Math.min(100, parseInt(confidenceMatch[1])) : 75
  const synthesis = text.replace(/CONFIDENCE:\s*\d+\s*$/, "").trim()

  await pushEvent(state.streamId, "node_complete", { node: "synthesizer", confidence })
  return { synthesis, citations, confidence }
}

function shouldFillGaps(state: typeof ResearchState.State): "fill_gaps" | "synthesize" {
  return state.gaps.length > 0 && state.iteration < 2 ? "fill_gaps" : "synthesize"
}

const workflow = new StateGraph(ResearchState)
  .addNode("analyzer", analyzeQuery)
  .addNode("searcher", parallelSearch)
  .addNode("gap_detector", detectGaps)
  .addNode("gap_filler", fillGaps)
  .addNode("synthesizer", synthesize)
  .addEdge(START, "analyzer")
  .addEdge("analyzer", "searcher")
  .addEdge("searcher", "gap_detector")
  .addConditionalEdges("gap_detector", shouldFillGaps)
  .addEdge("gap_filler", "gap_detector")
  .addEdge("synthesizer", END)

export const researchGraph = workflow.compile()

export interface ResearchResult {
  query: string
  synthesis: string
  citations: Citation[]
  confidence: number
  sources: SearchResult[]
}

export async function runResearch(query: string, streamId: string): Promise<ResearchResult> {
  logger.info({ query, streamId }, "Research pipeline started")
  const result = await researchGraph.invoke({ query, streamId })
  return {
    query,
    synthesis: result.synthesis,
    citations: result.citations,
    confidence: result.confidence,
    sources: Object.values(result.searchResults as Record<string, SearchResult[]>).flat().slice(0, 20),
  }
}
