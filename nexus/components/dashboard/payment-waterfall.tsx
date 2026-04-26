"use client"

import { useState } from "react"
import { useEventStream } from "@/hooks/use-stream"
import { motion, AnimatePresence } from "framer-motion"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"

interface Payment {
  id: string
  amountSats: number
  tier: string
  settledAt: string
  queryHash: string
}

interface Stats {
  totalSats: number
  totalPayments: number
  activeAgents: number
}

const TIER_COLORS: Record<string, string> = {
  FLASH: "bg-yellow-400",
  BASIC: "bg-blue-400",
  DEEP: "bg-purple-400",
  RESEARCH: "bg-green-400",
  EXTRACT: "bg-orange-400",
}

export function PaymentWaterfall() {
  const [payments, setPayments] = useState<Payment[]>([])
  const [stats, setStats] = useState<Stats>({ totalSats: 0, totalPayments: 0, activeAgents: 0 })
  const [satRate, setSatRate] = useState(0)

  useEventStream("/api/v1/stream", {
    snapshot: (data) => {
      const d = data as { totalSats: number; totalPayments: number; activeAgents: number; recentPayments: Payment[] }
      setStats({ totalSats: d.totalSats, totalPayments: d.totalPayments, activeAgents: d.activeAgents })
      setPayments(d.recentPayments ?? [])
    },
    payment: (data) => {
      const p = data as Payment
      setPayments((prev) => [p, ...prev].slice(0, 20))
      setStats((prev) => ({
        ...prev,
        totalSats: prev.totalSats + p.amountSats,
        totalPayments: prev.totalPayments + 1,
      }))
      setSatRate((r) => r + p.amountSats)
      setTimeout(() => setSatRate((r) => Math.max(0, r - p.amountSats)), 60_000)
    },
  })

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
      {/* Stat cards */}
      <Card>
        <CardHeader><CardTitle className="text-sm text-zinc-500">Total Sats Earned</CardTitle></CardHeader>
        <CardContent>
          <p className="text-3xl font-bold text-orange-500">⚡ {stats.totalSats.toLocaleString()}</p>
          <p className="text-xs text-zinc-400 mt-1">${((stats.totalSats / 100_000_000) * 100_000).toFixed(4)} USD</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-sm text-zinc-500">Payments Processed</CardTitle></CardHeader>
        <CardContent>
          <p className="text-3xl font-bold text-blue-500">{stats.totalPayments.toLocaleString()}</p>
          <p className="text-xs text-zinc-400 mt-1">{satRate} sats/min</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-sm text-zinc-500">Active Agents</CardTitle></CardHeader>
        <CardContent>
          <p className="text-3xl font-bold text-green-500">{stats.activeAgents}</p>
          <p className="text-xs text-zinc-400 mt-1">registered in marketplace</p>
        </CardContent>
      </Card>

      {/* Payment waterfall */}
      <Card className="md:col-span-3">
        <CardHeader><CardTitle>Live Payment Stream</CardTitle></CardHeader>
        <CardContent>
          <div className="space-y-2 max-h-96 overflow-y-auto">
            <AnimatePresence initial={false}>
              {payments.map((p, i) => (
                <motion.div
                  key={p.id ?? i}
                  initial={{ opacity: 0, y: -20, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.3 }}
                  className="flex items-center justify-between rounded-lg border border-zinc-100 bg-zinc-50 px-4 py-2 dark:border-zinc-800 dark:bg-zinc-900/50"
                >
                  <div className="flex items-center gap-3">
                    <span className={`h-2 w-2 rounded-full ${TIER_COLORS[p.tier] ?? "bg-zinc-400"}`} />
                    <span className="text-xs font-mono text-zinc-500">{p.queryHash?.slice(0, 8)}…</span>
                    <span className="text-xs text-zinc-400">{p.tier}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-orange-500">⚡ {p.amountSats} sats</span>
                    <span className="text-xs text-zinc-400">
                      {p.settledAt ? new Date(p.settledAt).toLocaleTimeString() : "now"}
                    </span>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
            {payments.length === 0 && (
              <p className="text-center text-sm text-zinc-400 py-8">Waiting for payments…</p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
