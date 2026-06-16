import {
  get,
  limitToLast,
  onValue,
  orderByChild,
  query,
  ref,
  startAt,
  endAt,
  type DatabaseReference,
  type Query,
  type Unsubscribe,
} from "firebase/database"
import { database } from "./firebase"

type CacheEntry = {
  data: unknown
  timestamp: number
  listeners: number
}

interface QueryOptions {
  limit?: number
  orderBy?: string
  startAt?: string | number | boolean | null
  endAt?: string | number | boolean | null
  cache?: boolean
  realtime?: boolean
}

type ListenerCallback = (data: Record<string, unknown>) => void

type ListenerEntry = {
  ref: DatabaseReference | Query
  callbacks: Set<ListenerCallback>
  count: number
  unsubscribe: Unsubscribe
}

const cache = new Map<string, CacheEntry>()
const listeners = new Map<string, ListenerEntry>()

const CACHE_DURATION = 5 * 60 * 1000
const MAX_CACHE_SIZE = 100

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

const toRecord = (value: unknown): Record<string, unknown> => {
  return isRecord(value) ? value : {}
}

const cleanExpiredCache = () => {
  const now = Date.now()
  for (const [key, entry] of cache.entries()) {
    if (now - entry.timestamp > CACHE_DURATION) {
      cache.delete(key)
    }
  }
}

const limitCacheSize = () => {
  if (cache.size <= MAX_CACHE_SIZE) {
    return
  }

  const entries = Array.from(cache.entries())
  entries.sort((a, b) => a[1].timestamp - b[1].timestamp)
  const toDelete = entries.slice(0, Math.floor(MAX_CACHE_SIZE / 2))

  toDelete.forEach(([key]) => {
    cache.delete(key)
  })
}

const buildQueryReference = (path: string, options: QueryOptions = {}): DatabaseReference | Query => {
  let dbRef: DatabaseReference | Query = ref(database, path)

  if (options.orderBy) {
    dbRef = query(dbRef, orderByChild(options.orderBy))
  }

  if (options.limit) {
    dbRef = query(dbRef, limitToLast(options.limit))
  }

  if (options.startAt !== undefined) {
    dbRef = query(dbRef, startAt(options.startAt))
  }

  if (options.endAt !== undefined) {
    dbRef = query(dbRef, endAt(options.endAt))
  }

  return dbRef
}

// Función optimizada para obtener datos
export const getOptimizedData = async (path: string, options: QueryOptions = {}): Promise<Record<string, unknown>> => {
  const cacheKey = `${path}_${JSON.stringify(options)}`

  if (options.cache !== false) {
    const cached = cache.get(cacheKey)
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
      return toRecord(cached.data)
    }
  }

  try {
    const dbRef = buildQueryReference(path, options)
    const snapshot = await get(dbRef)
    const data = toRecord(snapshot.val())

    if (options.cache !== false) {
      cache.set(cacheKey, {
        data,
        timestamp: Date.now(),
        listeners: 0,
      })
      limitCacheSize()
    }

    return data
  } catch (error) {
    console.error(`Error getting data from ${path}:`, error)
    throw error
  }
}

// Función optimizada para listeners en tiempo real
export const listenOptimizedData = (
  path: string,
  callback: ListenerCallback,
  options: QueryOptions = {},
): (() => void) => {
  const cacheKey = `${path}_${JSON.stringify(options)}`

  if (listeners.has(cacheKey)) {
    const entry = listeners.get(cacheKey)
    if (entry) {
      entry.callbacks.add(callback)
      entry.count++

      if (cache.has(cacheKey)) {
        const cached = cache.get(cacheKey)
        callback(toRecord(cached?.data))
      }

      return () => {
        entry.callbacks.delete(callback)
        entry.count--

        if (entry.count === 0) {
          entry.unsubscribe()
          listeners.delete(cacheKey)
        }
      }
    }
  }

  const dbRef = buildQueryReference(path, options)
  const callbacks = new Set<ListenerCallback>([callback])

  const unsubscribe = onValue(dbRef, (snapshot) => {
    const data = toRecord(snapshot.val())

    if (options.cache !== false) {
      cache.set(cacheKey, {
        data,
        timestamp: Date.now(),
        listeners: callbacks.size,
      })
      limitCacheSize()
    }

    callbacks.forEach((currentCallback) => currentCallback(data))
  })

  listeners.set(cacheKey, {
    ref: dbRef,
    callbacks,
    count: 1,
    unsubscribe,
  })

  return () => {
    const entry = listeners.get(cacheKey)
    if (!entry) {
      return
    }

    entry.callbacks.delete(callback)
    entry.count--

    if (entry.count === 0) {
      entry.unsubscribe()
      listeners.delete(cacheKey)
    }
  }
}

// Función para consultas paginadas optimizadas
export const getPaginatedData = async (
  path: string,
  page: number,
  pageSize: number,
  orderBy: string = "fecha",
  options: QueryOptions = {},
): Promise<{ data: Record<string, unknown>; total: number; hasMore: boolean }> => {
  const offset = (page - 1) * pageSize

  const totalCacheKey = `${path}_total`
  let total = 0
  const cachedTotal = cache.get(totalCacheKey)
  if (cachedTotal && typeof cachedTotal.data === "number") {
    total = cachedTotal.data
  }

  if (!total) {
    const totalSnapshot = await get(ref(database, path))
    total = Object.keys(toRecord(totalSnapshot.val())).length
    cache.set(totalCacheKey, {
      data: total,
      timestamp: Date.now(),
      listeners: 0,
    })
  }

  const data = await getOptimizedData(path, {
    ...options,
    limit: pageSize,
    orderBy,
    cache: true,
  })

  return {
    data,
    total,
    hasMore: offset + pageSize < total,
  }
}

// Función para búsquedas optimizadas
export const searchOptimizedData = async (
  path: string,
  searchTerm: string,
  searchFields: string[],
  options: QueryOptions = {},
): Promise<Record<string, unknown>> => {
  if (!searchTerm.trim()) {
    return await getOptimizedData(path, options)
  }

  const cacheKey = `${path}_search_${searchTerm}_${JSON.stringify(options)}`

  const cached = cache.get(cacheKey)
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return toRecord(cached.data)
  }

  const allData = await getOptimizedData(path, { cache: false })
  const filteredData = Object.entries(allData).filter(([, item]) => {
    const record = toRecord(item)
    return searchFields.some((field) => {
      const value = record[field]
      return value !== undefined && value !== null && String(value).toLowerCase().includes(searchTerm.toLowerCase())
    })
  }).reduce<Record<string, unknown>>((accumulator, [id, item]) => {
    accumulator[id] = item
    return accumulator
  }, {})

  cache.set(cacheKey, {
    data: filteredData,
    timestamp: Date.now(),
    listeners: 0,
  })

  return filteredData
}

// Función para limpiar cache
export const clearCache = (path?: string) => {
  if (path) {
    for (const key of cache.keys()) {
      if (key.startsWith(path)) {
        cache.delete(key)
      }
    }
    return
  }

  cache.clear()
}

// Función para obtener estadísticas del cache
export const getCacheStats = () => {
  return {
    size: cache.size,
    maxSize: MAX_CACHE_SIZE,
    listeners: listeners.size,
    memoryUsage: typeof process !== "undefined" && typeof process.memoryUsage === "function" ? process.memoryUsage() : "N/A",
  }
}

setInterval(cleanExpiredCache, CACHE_DURATION)

export const optimizedQueries = {
  getOptimizedData,
  listenOptimizedData,
  getPaginatedData,
  searchOptimizedData,
  clearCache,
  getCacheStats,
}
