import { createHash, randomBytes } from "crypto"

export function hashQuery(query: string, tier: string): string {
  return createHash("sha256").update(`${tier}:${query.toLowerCase().trim()}`).digest("hex").slice(0, 32)
}

export function generateMacaroon(queryHash: string, amountSats: number, expiresAt: number): string {
  const payload = Buffer.from(JSON.stringify({ queryHash, amountSats, expiresAt })).toString("base64url")
  const sig = createHash("sha256")
    .update(`${payload}:${process.env.NEXTAUTH_SECRET ?? "nexus-secret"}`)
    .digest("hex")
    .slice(0, 16)
  return `${payload}.${sig}`
}

export function verifyMacaroon(macaroon: string, queryHash: string): boolean {
  try {
    const [payload, sig] = macaroon.split(".")
    const expectedSig = createHash("sha256")
      .update(`${payload}:${process.env.NEXTAUTH_SECRET ?? "nexus-secret"}`)
      .digest("hex")
      .slice(0, 16)
    if (sig !== expectedSig) return false
    const data = JSON.parse(Buffer.from(payload, "base64url").toString())
    if (data.queryHash !== queryHash) return false
    if (Date.now() > data.expiresAt) return false
    return true
  } catch {
    return false
  }
}

export function randomHex(bytes = 32): string {
  return randomBytes(bytes).toString("hex")
}
