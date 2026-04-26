import Link from "next/link"

export default function Home() {
  return (
    <main className="min-h-screen bg-zinc-950 text-white flex flex-col">
      {/* Nav */}
      <nav className="border-b border-zinc-800 px-6 py-4 flex items-center justify-between">
        <span className="text-lg font-bold">
          <span className="text-orange-500">⚡</span> Nexus
        </span>
        <div className="flex gap-4 text-sm text-zinc-400">
          <Link href="/playground" className="hover:text-white transition">Playground</Link>
          <Link href="/dashboard" className="hover:text-white transition">Dashboard</Link>
          <a href="/api/v1/health" className="hover:text-white transition">Health</a>
        </div>
      </nav>

      {/* Hero */}
      <section className="flex-1 flex flex-col items-center justify-center text-center px-6 py-24">
        <p className="text-sm font-mono text-orange-500 mb-4 tracking-widest">BITCOIN LIGHTNING • L402 PROTOCOL</p>
        <h1 className="text-5xl font-bold leading-tight max-w-3xl">
          The Intelligence Marketplace for{" "}
          <span className="text-orange-500">AI Agents</span>
        </h1>
        <p className="mt-6 text-lg text-zinc-400 max-w-xl">
          Pay per query with Bitcoin micropayments. No accounts. No API keys. Just math.
          $0.001 per search — impossible on any other payment rail.
        </p>

        <div className="mt-10 flex gap-4">
          <Link
            href="/playground"
            className="rounded-full bg-orange-500 px-8 py-3 font-semibold text-white hover:bg-orange-600 transition"
          >
            Try the L402 Flow →
          </Link>
          <Link
            href="/dashboard"
            className="rounded-full border border-zinc-700 px-8 py-3 font-semibold hover:border-zinc-500 transition"
          >
            Live Dashboard
          </Link>
        </div>

        {/* Feature grid */}
        <div className="mt-20 grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl w-full text-left">
          {[
            {
              icon: "⚡",
              title: "$0.001 per query",
              desc: "Stripe minimum: $0.30. Our Flash tier: $0.001. A different order of magnitude made possible only by Lightning.",
            },
            {
              icon: "🔐",
              title: "Zero-identity access",
              desc: "Agent calls API → gets 402 + invoice → pays → retries with preimage. No account. No KYC. Zero humans.",
            },
            {
              icon: "🤖",
              title: "Agent-to-agent economy",
              desc: "Agents register capabilities, stake Bitcoin, earn sats. Reputation from cryptographic payment history — unfakeable.",
            },
          ].map((f) => (
            <div key={f.title} className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
              <p className="text-2xl mb-3">{f.icon}</p>
              <h3 className="font-semibold mb-2">{f.title}</h3>
              <p className="text-sm text-zinc-400">{f.desc}</p>
            </div>
          ))}
        </div>

        {/* Tier pricing */}
        <div className="mt-16 w-full max-w-4xl">
          <h2 className="text-xl font-semibold mb-6">Intelligence Tiers</h2>
          <div className="grid grid-cols-5 gap-3">
            {[
              { tier: "Flash", sats: 1, usd: "$0.001", time: "800ms" },
              { tier: "Basic", sats: 2, usd: "$0.002", time: "1.5s" },
              { tier: "Deep", sats: 5, usd: "$0.005", time: "3s" },
              { tier: "Research", sats: 25, usd: "$0.025", time: "30s" },
              { tier: "Extract", sats: 1, usd: "$0.001", time: "2s" },
            ].map((t) => (
              <div key={t.tier} className="rounded-lg border border-zinc-800 bg-zinc-900 p-4 text-center">
                <p className="font-semibold text-sm">{t.tier}</p>
                <p className="text-orange-400 font-bold mt-1">⚡ {t.sats}</p>
                <p className="text-xs text-zinc-500">{t.usd}</p>
                <p className="text-xs text-zinc-600 mt-1">{t.time}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <footer className="border-t border-zinc-800 px-6 py-4 text-center text-xs text-zinc-600">
        Nexus — Built at Hack-Nation 5th Global AI Hackathon • Team HN-0454 • MIT License
      </footer>
    </main>
  )
}
