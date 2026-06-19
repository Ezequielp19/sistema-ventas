export type BusinessCacheScope = "products" | "providers" | "sales" | "dashboard" | "store" | "public-store" | "reports" | "billing"

type CacheEntry<T> = {
  value: T
  timestamp: number
}

const BUSINESS_CACHE_TTL = 2 * 60 * 1000
const businessCache = new Map<string, CacheEntry<unknown>>()

const buildCacheKey = (scope: BusinessCacheScope, businessId: string, detail = "") => {
  return `${scope}::${businessId}::${detail}`
}

const isExpired = (entry: CacheEntry<unknown>) => {
  return Date.now() - entry.timestamp > BUSINESS_CACHE_TTL
}

export const getBusinessCache = <T>(scope: BusinessCacheScope, businessId: string, detail = ""): T | null => {
  if (!businessId) {
    return null
  }

  const key = buildCacheKey(scope, businessId, detail)
  const entry = businessCache.get(key)

  if (!entry) {
    return null
  }

  if (isExpired(entry)) {
    businessCache.delete(key)
    return null
  }

  return entry.value as T
}

export const setBusinessCache = <T>(scope: BusinessCacheScope, businessId: string, value: T, detail = "") => {
  if (!businessId) {
    return
  }

  businessCache.set(buildCacheKey(scope, businessId, detail), {
    value,
    timestamp: Date.now(),
  })
}

export const invalidateBusinessCache = (businessId: string, scopes?: BusinessCacheScope[]) => {
  if (!businessId) {
    return
  }

  const scopePrefixList = scopes && scopes.length > 0 ? scopes.map((scope) => `${scope}::${businessId}::`) : null

  for (const key of Array.from(businessCache.keys())) {
    if (!key.includes(`::${businessId}::`)) {
      continue
    }

    if (scopePrefixList && !scopePrefixList.some((prefix) => key.startsWith(prefix))) {
      continue
    }

    businessCache.delete(key)
  }
}

export const clearBusinessCache = () => {
  businessCache.clear()
}
