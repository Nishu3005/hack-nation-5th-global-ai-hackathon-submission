"use client"

import { useState } from "react"
import { useEventStream } from "@/hooks/use-stream"
import { motion } from "framer-motion"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"

interface ResearchEvent {
  streamId: string
  event: string
  data: {
    node?: string
    query?: string
    subQuestions?: string[]
    question?: string
    count?: number
    gaps?: string[]
    confidence?: number
  }
}

const NODE_LABELS: Record<string, string> = {
  analyzer: "Query Analysis",
  searcher: "Parallel Search",
  gap_detector: "Gap Detection",
  gap_filler: "Gap Fill",
  synthesizer: "Synthesis",
}

const NODE_ORDER = ["analyzer", "searcher", "gap_detector", "gap_filler", "synthesizer"]

export function ResearchProgress() {
  const [activeStreams, setActiveStreams] = useState<Map<string, ResearchEvent["data"] & { node: string; active: boolean }>>(new Map())

  useEventStream("/api/v1/stream", {
    research_event: (raw) => {
      const ev = raw as { streamId: string; event: string; data: ResearchEvent["data"] }
      if (!ev.streamId) return

      setActiveStreams((prev) => {
        const next = new Map(prev)
        const current = next.get(ev.streamId) ?? { node: "", active: false }

        if (ev.event === "node_start" && ev.data.node) {
          next.set(ev.streamId, { ...current, ...ev.data, node: ev.data.node, active: true })
        } else if (ev.event === "node_complete") {
          next.set(ev.streamId, { ...current, ...ev.data, active: false })
        }

        return next
      })
    },
  })

  const streams = Array.from(activeStreams.entries())

  return (
    <Card>
      <CardHeader><CardTitle>LangGraph Research Pipelines</CardTitle></CardHeader>
      <CardContent>
        {streams.length === 0 ? (
          <p className="text-center text-sm text-zinc-400 py-6">No active research pipelines</p>
        ) : (
          <div className="space-y-4">
            {streams.map(([streamId, state]) => (
              <div key={streamId} className="space-y-2">
                <p className="text-xs font-mono text-zinc-400">{streamId.slice(0, 8)}…</p>
                <div className="flex gap-1">
                  {NODE_ORDER.map((node) => {
                    const isActive = state.node === node && state.active
                    const isDone = NODE_ORDER.indexOf(node) < NODE_ORDER.indexOf(state.node)
                    return (
                      <motion.div
                        key={node}
                        className={`flex-1 rounded px-2 py-1 text-center text-xs font-medium transition-colors ${
                          isActive
                            ? "bg-orange-500 text-white"
                            : isDone
                            ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                            : "bg-zinc-100 text-zinc-400 dark:bg-zinc-800"
                        }`}
                        animate={isActive ? { scale: [1, 1.05, 1] } : {}}
                        transition={{ repeat: Infinity, duration: 1 }}
                      >
                        {NODE_LABELS[node] ?? node}
                      </motion.div>
                    )
                  })}
                </div>
                {state.confidence ? (
                  <p className="text-xs text-green-600">Confidence: {state.confidence}%</p>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
