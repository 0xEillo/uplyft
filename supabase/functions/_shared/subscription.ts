/**
 * Server-side Pro entitlement lookup via the RevenueCat REST API.
 *
 * The app logs into RevenueCat with the Supabase user id
 * (`Purchases.logIn(user.id)`), so the authenticated user id doubles as the
 * RevenueCat app user id.
 *
 * Requires the `REVENUECAT_SECRET_KEY` secret (RevenueCat secret API key).
 */

const PRO_ENTITLEMENT_ID = 'Pro'
const CACHE_TTL_MS = 5 * 60 * 1000
const REQUEST_TIMEOUT_MS = 3000

type CacheEntry = { isPro: boolean; expiresAt: number }

// Per-isolate cache so most chat messages don't wait on RevenueCat.
const cache = new Map<string, CacheEntry>()

type RevenueCatEntitlement = {
  expires_date?: string | null
}

type RevenueCatSubscriberResponse = {
  subscriber?: {
    entitlements?: Record<string, RevenueCatEntitlement | undefined>
  }
}

function isEntitlementActive(
  entitlement: RevenueCatEntitlement | undefined,
  now: number,
): boolean {
  if (!entitlement) return false
  // null expiry = lifetime / non-expiring purchase.
  if (!entitlement.expires_date) return true
  const expiresAt = Date.parse(entitlement.expires_date)
  return Number.isFinite(expiresAt) && expiresAt > now
}

/**
 * Returns whether the user currently has an active Pro entitlement.
 *
 * Fails open (returns true) when RevenueCat is unreachable or not
 * configured, so a RevenueCat outage never caps paying users. The only cost
 * is that free users temporarily get the Pro chat limits.
 *
 * Pass `forceRefresh` to bypass the cache, e.g. before rejecting a free user
 * who may have just upgraded.
 */
export async function isProSubscriber(
  userId: string,
  options: { forceRefresh?: boolean } = {},
): Promise<boolean> {
  const now = Date.now()
  const cached = cache.get(userId)
  if (!options.forceRefresh && cached && cached.expiresAt > now) {
    return cached.isPro
  }

  const apiKey = Deno.env.get('REVENUECAT_SECRET_KEY')
  if (!apiKey) {
    console.error(
      '[subscription] REVENUECAT_SECRET_KEY not set; treating user as Pro',
    )
    return true
  }

  try {
    const response = await fetch(
      `https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(userId)}`,
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      },
    )

    if (!response.ok) {
      console.error(
        '[subscription] RevenueCat lookup failed; treating user as Pro',
        { status: response.status },
      )
      return true
    }

    const data = (await response.json()) as RevenueCatSubscriberResponse
    const isPro = isEntitlementActive(
      data.subscriber?.entitlements?.[PRO_ENTITLEMENT_ID],
      now,
    )

    cache.set(userId, { isPro, expiresAt: now + CACHE_TTL_MS })
    return isPro
  } catch (err) {
    console.error(
      '[subscription] RevenueCat lookup error; treating user as Pro',
      err,
    )
    return true
  }
}
