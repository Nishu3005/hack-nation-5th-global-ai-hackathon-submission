import { NextRequest, NextResponse } from "next/server"
import { hashQuery, verifyMacaroon } from "@/lib/crypto"
import { createInvoice, verifyPayment } from "@/server/services/payment.service"
import { getSatsForTier, getCacheTtl } from "@/config/pricing"
import { Tier } from "@prisma/client"
import { z } from "zod"

export interface L402Context {
  queryHash: string
  tier: Tier
  agentId?: string
}

const AuthHeaderSchema = z.string().regex(/^L402 [A-Za-z0-9+/=._-]+:[0-9a-f]{64}$/)

export async function enforceL402(
  req: NextRequest,
  query: string,
  tier: Tier,
  agentId?: string
): Promise<{ authorized: false; response: NextResponse } | { authorized: true; ctx: L402Context }> {
  const queryHash = hashQuery(query, tier)
  const authHeader = req.headers.get("Authorization")

  // Validate Authorization header format
  if (authHeader) {
    const parsed = AuthHeaderSchema.safeParse(authHeader)
    if (parsed.success) {
      const [, credentials] = authHeader.split(" ")
      const [macaroon, preimage] = credentials.split(":")

      if (verifyMacaroon(macaroon, queryHash)) {
        const verification = await verifyPayment(macaroon, preimage, queryHash)
        if (verification.valid) {
          return { authorized: true, ctx: { queryHash, tier, agentId } }
        }
      }
    }
  }

  // No valid auth — issue invoice
  const amountSats = getSatsForTier(tier)
  const invoice = await createInvoice(queryHash, tier, amountSats, agentId)

  return {
    authorized: false,
    response: new NextResponse(
      JSON.stringify({
        error: "Payment Required",
        code: "L402_REQUIRED",
        invoice: invoice.bolt11,
        paymentHash: invoice.paymentHash,
        amountSats,
        macaroon: invoice.macaroon,
        expiresAt: invoice.expiresAt.toISOString(),
        instructions: "Pay the Lightning invoice, then retry with Authorization: L402 <macaroon>:<preimage>",
      }),
      {
        status: 402,
        headers: {
          "Content-Type": "application/json",
          "WWW-Authenticate": `L402 macaroon="${invoice.macaroon}", invoice="${invoice.bolt11}"`,
          "X-Payment-Required": "true",
          "X-Amount-Sats": amountSats.toString(),
        },
      }
    ),
  }
}

export function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  }
}
