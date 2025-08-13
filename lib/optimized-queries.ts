import { ref, onValue, off, get, query, orderByChild, limitToLast, startAt, endAt } from "firebase/database"
import { database } from "./firebase"

// Cache para almacenar datos y evitar consultas repetidas
const cache = new Map()
const listeners = new Map()

// Configuración de cache
const CACHE_DURATION = 5 * 60 * 1000 // 5 minutos
const MAX_CACHE_SIZE = 100

interface CacheEntry {
  data: any
  timestamp: number
  listeners: number
}

interface QueryOptions {
  limit?: number
  orderBy?: string
  startAt?: any
  endAt?: any
  cache?: boolean
  realtime?: boolean
}

// Limpiar cache expirado
const cleanExpiredCache = () => {
  const now = Date.now()
  for (const [key, entry] of cache.entries()) {
    if (now - entry.timestamp > CACHE_DURATION) {
      cache.delete(key)
    }
  }
}

// Limitar tamaño del cache
const limitCacheSize = () => {
  if (cache.size > MAX_CACHE_SIZE) {
    const entries = Array.from(cache.entries())
    entries.sort((a, b) => a[1].timestamp - b[1].timestamp)
    const toDelete = entries.slice(0, Math.floor(MAX_CACHE_SIZE / 2))
    toDelete.forEach(([key]) => cache.delete(key))
  }
}

// Función optimizada para obtener datos
export const getOptimizedData = async (
  path: string,
  options: QueryOptions = {}
): Promise<any> => {
  const cacheKey = `${path}_${JSON.stringify(options)}`
  
  // Verificar cache si está habilitado
  if (options.cache !== false) {
    const cached = cache.get(cacheKey)
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
      return cached.data
    }
  }

  try {
    let dbRef = ref(database, path)
    
    // Aplicar filtros si están especificados
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

    const snapshot = await get(dbRef)
    const data = snapshot.val() || {}

    // Guardar en cache
    if (options.cache !== false) {
      cache.set(cacheKey, {
        data,
        timestamp: Date.now(),
        listeners: 0
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
  callback: (data: any) => void,
  options: QueryOptions = {}
): (() => void) => {
  const cacheKey = `${path}_${JSON.stringify(options)}`
  
  // Si ya hay un listener activo, reutilizarlo
  if (listeners.has(cacheKey)) {
    const entry = listeners.get(cacheKey)
    entry.callbacks.add(callback)
    entry.count++
    
    // Retornar callback inmediatamente si hay datos en cache
    if (cache.has(cacheKey)) {
      const cached = cache.get(cacheKey)
      callback(cached.data)
    }
    
    return () => {
      entry.callbacks.delete(callback)
      entry.count--
      if (entry.count === 0) {
        off(entry.ref)
        listeners.delete(cacheKey)
      }
    }
  }

  let dbRef = ref(database, path)
  
  // Aplicar filtros si están especificados
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

  const callbacks = new Set([callback])
  
  const unsubscribe = onValue(dbRef, (snapshot) => {
    const data = snapshot.val() || {}
    
    // Actualizar cache
    if (options.cache !== false) {
      cache.set(cacheKey, {
        data,
        timestamp: Date.now(),
        listeners: callbacks.size
      })
      limitCacheSize()
    }
    
    // Notificar a todos los callbacks
    callbacks.forEach(cb => cb(data))
  })

  listeners.set(cacheKey, {
    ref: dbRef,
    callbacks,
    count: 1,
    unsubscribe
  })

  return () => {
    const entry = listeners.get(cacheKey)
    if (entry) {
      entry.callbacks.delete(callback)
      entry.count--
      if (entry.count === 0) {
        entry.unsubscribe()
        listeners.delete(cacheKey)
      }
    }
  }
}

// Función para consultas paginadas optimizadas
export const getPaginatedData = async (
  path: string,
  page: number,
  pageSize: number,
  orderBy: string = 'fecha',
  options: QueryOptions = {}
): Promise<{ data: any, total: number, hasMore: boolean }> => {
  const offset = (page - 1) * pageSize
  
  // Obtener total de registros (solo una vez y cachear)
  const totalCacheKey = `${path}_total`
  let total = cache.get(totalCacheKey)?.data
  
  if (!total) {
    const totalSnapshot = await get(ref(database, path))
    total = Object.keys(totalSnapshot.val() || {}).length
    cache.set(totalCacheKey, {
      data: total,
      timestamp: Date.now(),
      listeners: 0
    })
  }

  // Obtener datos paginados
  const data = await getOptimizedData(path, {
    ...options,
    limit: pageSize,
    orderBy,
    cache: true
  })

  return {
    data,
    total,
    hasMore: offset + pageSize < total
  }
}

// Función para búsquedas optimizadas
export const searchOptimizedData = async (
  path: string,
  searchTerm: string,
  searchFields: string[],
  options: QueryOptions = {}
): Promise<any> => {
  if (!searchTerm.trim()) {
    return await getOptimizedData(path, options)
  }

  const cacheKey = `${path}_search_${searchTerm}_${JSON.stringify(options)}`
  
  // Verificar cache de búsqueda
  const cached = cache.get(cacheKey)
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return cached.data
  }

  const allData = await getOptimizedData(path, { cache: false })
  
  const filteredData = Object.entries(allData).filter(([id, item]: [string, any]) => {
    return searchFields.some(field => {
      const value = item[field]
      return value && value.toString().toLowerCase().includes(searchTerm.toLowerCase())
    })
  }).reduce((acc, [id, item]) => {
    acc[id] = item
    return acc
  }, {})

  // Cachear resultado de búsqueda
  cache.set(cacheKey, {
    data: filteredData,
    timestamp: Date.now(),
    listeners: 0
  })

  return filteredData
}

// Función para limpiar cache
export const clearCache = (path?: string) => {
  if (path) {
    // Limpiar cache específico
    for (const key of cache.keys()) {
      if (key.startsWith(path)) {
        cache.delete(key)
      }
    }
  } else {
    // Limpiar todo el cache
    cache.clear()
  }
}

// Función para obtener estadísticas del cache
export const getCacheStats = () => {
  return {
    size: cache.size,
    maxSize: MAX_CACHE_SIZE,
    listeners: listeners.size,
    memoryUsage: process.memoryUsage?.() || 'N/A'
  }
}

// Limpiar cache automáticamente cada 5 minutos
setInterval(cleanExpiredCache, CACHE_DURATION)

// Exportar funciones de utilidad
export const optimizedQueries = {
  getOptimizedData,
  listenOptimizedData,
  getPaginatedData,
  searchOptimizedData,
  clearCache,
  getCacheStats
} 