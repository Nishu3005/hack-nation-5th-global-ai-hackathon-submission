import { db } from "@/lib/db"
import { redis, CACHE_KEYS } from "@/lib/redis"
import { logger } from "@/lib/logger"
import { generateMacaroon } from "@/lib/crypto"
import { INVOICE_EXPIRY_SECONDS } from "@/config/pricing"
import { Tier, PaymentStatus } from "@/app/generated/prisma/index"
import { nanoid } from "nanoid"

const ALBY_API = process.env.LIGHTNING_NODE_URL ?? "https://api.getalby.com"
const ALBY_TOKEN = process.env.ALBY_ACCESS_TOKEN!

export interface InvoiceResult {
  bolt11: string
  paymentHash: string
  macaroon: string
  expiresAt: Date
  amountSats: number
}

export interface PaymentVerification {
  valid: boolean
  paymentHash?: string
  queryHash?: string
  tier?: Tier
}

export async function createInvoice(
  queryHash: string,
  tier: Tier,
  amountSats: number,
  agentId?: string
): Promise<InvoiceResult> {
  const expiresAt = new Date(Date.now() + INVOICE_EXPIRY_SECONDS * 1000)

  // Check idempotency — reuse unexpired invoice for same query+tier
  const existing = await db.invoiceIdempotency.findFirst({
    where: { queryHash, tier, expiresAt: { gt: new Date() } },
  })
  if (existing) {
    return {
      bolt11: existing.bolt11,
      paymentHash: existing.paymentHash,
      macaroon: existing.macaroon,
      expiresAt: existing.expiresAt,
      amountSats,
    }
  }

  // Call Alby API to create invoice
  const res = await fetch(`${ALBY_API}/invoices`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${ALBY_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      amount: amountSats,
      description: `Nexus ${tier} Intelligence — ${queryHash.slice(0, 8)}`,
      expiry: INVOICE_EXPIRY_SECONDS,
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    logger.error({ err, tier, amountSats }, "Alby invoice creation failed")
    throw new Error(`Invoice creation failed: ${err}`)
  }

  const invoice = (await res.json()) as { payment_request: string; payment_hash: string }
  const macaroon = generateMacaroon(queryHash, amountSats, expiresAt.getTime())

  // Persist for idempotency
  await db.invoiceIdempotency.create({
    data: {
      queryHash,
      tier,
      bolt11: invoice.payment_request,
      paymentHash: invoice.payment_hash,
      macaroon,
      expiresAt,
    },
  })

  // Store payment record
  await db.payment.create({
    data: {
      paymentHash: invoice.payment_hash,
      amountSats,
      tier,
      queryHash,
      status: PaymentStatus.PENDING,
      invoiceBolt11: invoice.payment_request,
      macaroon,
      expiresAt,
      agentId: agentId ?? null,
    },
  })

  return {
    bolt11: invoice.payment_request,
    paymentHash: invoice.payment_hash,
    macaroon,
    expiresAt,
    amountSats,
  }
}

export async function verifyPayment(
  macaroon: string,
  preimage: string,
  queryHash: string
): Promise<PaymentVerification> {
  // Check Redis cache first for speed
  const cacheKey = CACHE_KEYS.payment(`${macaroon.slice(-8)}:${preimage.slice(0, 8)}`)
  const cached = await redis.get<boolean>(cacheKey)
  if (cached === true) return { valid: true }

  // Look up the payment record
  const record = await db.invoiceIdempotency.findFirst({
    where: { macaroon, queryHash },
  })
  if (!record) return { valid: false }

  // Verify preimage against payment hash
  const { createHash } = await import("crypto")
  const computedHash = createHash("sha256")
    .update(Buffer.from(preimage, "hex"))
    .digest("hex")

  if (computedHash !== record.paymentHash) return { valid: false }

  // Check payment settled at Alby
  const res = await fetch(`${ALBY_API}/invoices/${record.paymentHash}`, {
    headers: { Authorization: `Bearer ${ALBY_TOKEN}` },
  })

  if (!res.ok) return { valid: false }

  const inv = (await res.json()) as { settled: boolean; preimage?: string }
  if (!inv.settled) return { valid: false }

  // Mark payment as paid
  await db.payment.updateMany({
    where: { paymentHash: record.paymentHash },
    data: {
      status: PaymentStatus.PAID,
      preimage,
      settledAt: new Date(),
    },
  })

  // Cache the validation
  await redis.setex(cacheKey, 3600, true)

  // Publish payment event for dashboard stream
  await redis.publish(CACHE_KEYS.stream, JSON.stringify({
    type: "payment",
    paymentHash: record.paymentHash,
    amountSats: record.tier,
    tier: record.tier,
    queryHash: record.queryHash,
    timestamp: Date.now(),
  }))

  return { valid: true, paymentHash: record.paymentHash, queryHash, tier: record.tier }
}

export async function getPaymentStats() {
  const [total, paid, totalSats] = await Promise.all([
    db.payment.count(),
    db.payment.count({ where: { status: PaymentStatus.PAID } }),
    db.payment.aggregate({ where: { status: PaymentStatus.PAID }, _sum: { amountSats: true } }),
  ])
  return { total, paid, totalSats: totalSats._sum.amountSats ?? 0 }
}
