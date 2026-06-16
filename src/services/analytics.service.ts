import type { Analytics } from "firebase/analytics"

export const ANALYTICS_EVENTS = {
  loginSuccess: "login_success",
  productCreated: "product_created",
  productUpdated: "product_updated",
  productDeleted: "product_deleted",
  providerCreated: "provider_created",
  providerUpdated: "provider_updated",
  providerDeleted: "provider_deleted",
  saleCreated: "sale_created",
  saleDeleted: "sale_deleted",
  storeOpened: "store_opened",
  demoDataLoaded: "demo_data_loaded",
} as const

type AnalyticsParams = Record<string, string | number | boolean>

let analyticsInstancePromise: Promise<Analytics | null> | null = null
let analyticsInitWarningShown = false
let analyticsSuppressionDepth = 0

const isBrowser = () => typeof window !== "undefined"

const sanitizeParams = (params: AnalyticsParams = {}) => {
  return Object.entries(params).reduce<AnalyticsParams>((accumulator, [key, value]) => {
    if (value === undefined || value === null) {
      return accumulator
    }

    if (typeof value === "string") {
      accumulator[key] = value.slice(0, 100)
      return accumulator
    }

    if (typeof value === "number" && Number.isFinite(value)) {
      accumulator[key] = value
      return accumulator
    }

    if (typeof value === "boolean") {
      accumulator[key] = value
    }

    return accumulator
  }, {})
}

const logAnalyticsWarningOnce = (message: string, error?: unknown) => {
  if (analyticsInitWarningShown) {
    return
  }

  analyticsInitWarningShown = true

  if (process.env.NODE_ENV !== "production") {
    console.warn(message, error)
  }
}

const getAnalyticsInstance = async (): Promise<Analytics | null> => {
  if (!isBrowser()) {
    return null
  }

  if (analyticsInstancePromise) {
    return analyticsInstancePromise
  }

  analyticsInstancePromise = (async () => {
    try {
      const [{ app, firebaseConfig }, analyticsModule] = await Promise.all([
        import("@/src/lib/firebase/client"),
        import("firebase/analytics"),
      ])

      if (!firebaseConfig.measurementId) {
        return null
      }

      if (!(await analyticsModule.isSupported())) {
        return null
      }

      return analyticsModule.getAnalytics(app)
    } catch (error) {
      logAnalyticsWarningOnce("No se pudo inicializar Firebase Analytics. La app seguirá funcionando.", error)
      return null
    }
  })()

  return analyticsInstancePromise
}

export const withAnalyticsSuppressed = async <T>(callback: () => Promise<T> | T): Promise<T> => {
  analyticsSuppressionDepth += 1

  try {
    return await callback()
  } finally {
    analyticsSuppressionDepth = Math.max(0, analyticsSuppressionDepth - 1)
  }
}

export const trackEvent = async (eventName: string, params: AnalyticsParams = {}): Promise<void> => {
  if (!isBrowser() || analyticsSuppressionDepth > 0) {
    return
  }

  try {
    const analytics = await getAnalyticsInstance()
    if (!analytics) {
      return
    }

    const { logEvent } = await import("firebase/analytics")
    await logEvent(analytics, eventName, sanitizeParams(params))
  } catch (error) {
    logAnalyticsWarningOnce(`No se pudo registrar el evento de analytics: ${eventName}`, error)
  }
}
