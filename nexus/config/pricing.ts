export const TIER_PRICING = {
  FLASH: { sats: 1, cacheTtlSeconds: 300 },
  BASIC: { sats: 2, cacheTtlSeconds: 600 },
  DEEP: { sats: 5, cacheTtlSeconds: 1800 },
  RESEARCH: { sats: 25, cacheTtlSeconds: 7200 },
  EXTRACT: { sats: 1, cacheTtlSeconds: 3600 },
} as const

export const PLATFORM_FEE_PCT = 10
export const AGENT_REGISTRATION_SATS = 100
export const INVOICE_EXPIRY_SECONDS = 300
export const MAX_AUTO_PAY_SATS = 200

export type Tier = keyof typeof TIER_PRICING

export function getSatsForTier(tier: Tier): number {
  return TIER_PRICING[tier].sats
}

export function getCacheTtl(tier: Tier): number {
  return TIER_PRICING[tier].cacheTtlSeconds
}

export function satsToUsd(sats: number, btcPriceUsd = 100000): number {
  return (sats / 100_000_000) * btcPriceUsd
}
