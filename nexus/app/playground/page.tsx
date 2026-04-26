"use client"

import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"

const TIERS = [
  { id: "FLASH", label: "Flash", sats: 1, desc: "Ultra-fast search", ms: "~800ms" },
  { id: "BASIC", label: "Basic", sats: 2, desc: "NLP-ranked results", ms: "~1.5s" },
  { id: "DEEP", label: "Deep", sats: 5, desc: "Advanced chunked", ms: "~3s" },
  { id: "RESEARCH", label: "Research", sats: 25, desc: "Multi-step LangGraph", ms: "~30s" },
  { id: "EXTRACT", label: "Extract", sats: 1, desc: "Full-page content", ms: "~2s" },
]

type Step =
  | { type: "idle" }
  | { type: "requesting" }
  | { type: "payment_required"; invoice: string; paymentHash: string; macaroon: string; amountSats: number }
  | { type: "paying" }
  | { type: "result"; data: unknown }
  | { type: "error"; message: string }

export default function PlaygroundPage() {
  const [query, setQuery] = useState("What is the current state of Bitcoin Lightning Network adoption?")
  const [tier, setTier] = useState("FLASH")
  const [step, setStep] = useState<Step>({ type: "idle" })
  const [streamEvents, setStreamEvents] = useState<string[]>([])

  const selectedTier = TIERS.find((t) => t.id === tier)!

  async function handleSearch() {
    setStep({ type: "requesting" })
    setStreamEvents([])

    if (tier === "RESEARCH") {
      await handleResearch()
      return
    }

    try {
      const res = await fetch("/api/v1/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query, tier }),
      })

      const text = await res.text()
      let data: unknown
      try {
        data = JSON.parse(text)
      } catch {
        setStep({ type: "error", message: `Server error (${res.status}): ${text.slice(0, 200) || "empty response"}` })
        return
      }

      if (res.status === 402) {
        const d = data as { invoice: string; paymentHash: string; macaroon: string; amountSats: number }
        setStep({
          type: "payment_required",
          invoice: d.invoice,
          paymentHash: d.paymentHash,
          macaroon: d.macaroon,
          amountSats: d.amountSats,
        })
        return
      }

      if (!res.ok) {
        const d = data as { error?: string }
        setStep({ type: "error", message: d.error ?? `Server error ${res.status}` })
        return
      }

      setStep({ type: "result", data })
    } catch (err) {
      setStep({ type: "error", message: err instanceof Error ? err.message : "Network error" })
    }
  }

  async function handleResearch() {
    const es = new EventSource("/api/v1/research")
    const events: string[] = []

    es.addEventListener("start", (e) => {
      events.push(`[start] ${e.data}`)
      setStreamEvents([...events])
    })

    const nodeEvents = ["node_start", "node_complete", "search_start", "search_complete"]
    nodeEvents.forEach((ev) => {
      es.addEventListener(ev, (e) => {
        const d = JSON.parse(e.data)
        events.push(`[${ev}] ${JSON.stringify(d)}`)
        setStreamEvents([...events])
      })
    })

    es.addEventListener("result", (e) => {
      const d = JSON.parse(e.data)
      setStep({ type: "result", data: d })
      es.close()
    })

    es.addEventListener("error", () => {
      setStep({ type: "error", message: "Research pipeline failed" })
      es.close()
    })

    // First we need to make a POST to kick off research with payment
    const res = await fetch("/api/v1/research", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query }),
    })

    if (res.status === 402) {
      const data = await res.json()
      es.close()
      setStep({
        type: "payment_required",
        invoice: data.invoice,
        paymentHash: data.paymentHash,
        macaroon: data.macaroon,
        amountSats: data.amountSats,
      })
    }
  }

  function simulatePay() {
    if (step.type !== "payment_required") return
    setStep({ type: "paying" })
    setTimeout(() => {
      setStep({
        type: "result",
        data: {
          demo: true,
          message: "In production: agent auto-pays via WebLN/Alby. Payment confirmed in <1s. Preimage returned.",
          simulation: `Macaroon: ${step.type === "payment_required" ? step.macaroon.slice(0, 20) : ""}...`,
        },
      })
    }, 1500)
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <div className="max-w-4xl mx-auto px-6 py-12 space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold">
            <span className="text-orange-500">⚡</span> Nexus Playground
          </h1>
          <p className="text-zinc-400 mt-2">
            Try the L402 flow — query the intelligence API, get a Lightning invoice, pay it, get results.
          </p>
        </div>

        {/* Tier selector */}
        <div className="grid grid-cols-5 gap-2">
          {TIERS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTier(t.id)}
              className={`rounded-lg border p-3 text-left transition-colors ${
                tier === t.id
                  ? "border-orange-500 bg-orange-500/10"
                  : "border-zinc-800 hover:border-zinc-600"
              }`}
            >
              <p className="font-semibold text-sm">{t.label}</p>
              <p className="text-xs text-zinc-400">{t.desc}</p>
              <p className="text-xs text-orange-400 mt-1">⚡ {t.sats} sat • {t.ms}</p>
            </button>
          ))}
        </div>

        {/* Query input */}
        <div className="space-y-3">
          <textarea
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            rows={3}
            className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-3 text-sm text-white placeholder-zinc-500 focus:border-orange-500 focus:outline-none resize-none"
            placeholder="Enter your query..."
          />
          <button
            onClick={handleSearch}
            disabled={step.type === "requesting" || step.type === "paying"}
            className="w-full rounded-lg bg-orange-500 py-3 font-semibold text-white transition hover:bg-orange-600 disabled:opacity-50"
          >
            {step.type === "requesting" ? "Requesting…" : step.type === "paying" ? "Paying…" : `Query for ⚡ ${selectedTier.sats} sat`}
          </button>
        </div>

        {/* Flow visualization */}
        <AnimatePresence mode="wait">
          {step.type === "payment_required" && (
            <motion.div
              key="payment"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="rounded-xl border border-yellow-500/30 bg-yellow-500/5 p-6 space-y-4"
            >
              <div className="flex items-center gap-2">
                <span className="text-yellow-400 text-lg">⚠️</span>
                <h3 className="font-semibold text-yellow-400">HTTP 402 — Payment Required</h3>
              </div>
              <div className="font-mono text-xs text-zinc-400 bg-zinc-900 rounded p-3 break-all">
                <p className="text-zinc-500">WWW-Authenticate: L402</p>
                <p>invoice=&quot;{step.invoice.slice(0, 60)}…&quot;</p>
                <p>macaroon=&quot;{step.macaroon.slice(0, 40)}…&quot;</p>
                <p className="text-orange-400 mt-2">Amount: ⚡ {step.amountSats} sats</p>
              </div>
              <p className="text-xs text-zinc-400">
                An autonomous agent would auto-pay this via WebLN. Click below to simulate:
              </p>
              <button
                onClick={simulatePay}
                className="w-full rounded-lg bg-yellow-500 py-2 font-semibold text-black hover:bg-yellow-400 transition"
              >
                ⚡ Simulate Lightning Payment
              </button>
            </motion.div>
          )}

          {step.type === "result" && (
            <motion.div
              key="result"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="rounded-xl border border-green-500/30 bg-green-500/5 p-6 space-y-3"
            >
              <div className="flex items-center gap-2">
                <span className="text-green-400">✓</span>
                <h3 className="font-semibold text-green-400">Result Received</h3>
              </div>
              <pre className="text-xs text-zinc-300 bg-zinc-900 rounded p-4 overflow-auto max-h-80 whitespace-pre-wrap">
                {JSON.stringify(step.data, null, 2)}
              </pre>
            </motion.div>
          )}

          {streamEvents.length > 0 && (
            <motion.div
              key="stream"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="rounded-xl border border-purple-500/30 bg-purple-500/5 p-4"
            >
              <h3 className="text-sm font-semibold text-purple-400 mb-2">LangGraph Pipeline Events</h3>
              <div className="space-y-1 max-h-48 overflow-y-auto">
                {streamEvents.map((ev, i) => (
                  <p key={i} className="text-xs font-mono text-zinc-400">{ev}</p>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
