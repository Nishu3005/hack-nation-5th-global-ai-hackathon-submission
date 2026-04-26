import { PaymentWaterfall } from "@/components/dashboard/payment-waterfall"
import { ResearchProgress } from "@/components/dashboard/research-progress"

export default function DashboardPage() {
  return (
    <main className="min-h-screen bg-zinc-950 text-white p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <span className="text-orange-500">⚡</span> Nexus Dashboard
            </h1>
            <p className="text-sm text-zinc-400 mt-1">Bitcoin Lightning Intelligence Marketplace — Live</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-green-400 animate-pulse" />
            <span className="text-xs text-zinc-400">Live</span>
          </div>
        </div>

        {/* Payment waterfall + stats */}
        <PaymentWaterfall />

        {/* Research pipeline progress */}
        <ResearchProgress />
      </div>
    </main>
  )
}
