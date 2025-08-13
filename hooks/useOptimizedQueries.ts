import { useState, useEffect, useCallback, useMemo } from 'react'
import { 
  getOptimizedData, 
  listenOptimizedData, 
  getPaginatedData, 
  searchOptimizedData,
  clearCache 
} from '@/lib/optimized-queries'

interface QueryOptions {
  limit?: number
  orderBy?: string
  startAt?: any
  endAt?: any
  cache?: boolean
  realtime?: boolean
}

interface PaginationOptions {
  page: number
  pageSize: number
  orderBy?: string
}

// Hook para datos optimizados
export const useOptimizedData = (path: string, options: QueryOptions = {}) => {
  const [data, setData] = useState<any>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true

    const loadData = async () => {
      try {
        setLoading(true)
        setError(null)
        
        const result = await getOptimizedData(path, options)
        
        if (mounted) {
          setData(result)
          setLoading(false)
        }
      } catch (err) {
        if (mounted) {
          setError(err instanceof Error ? err.message : 'Error desconocido')
          setLoading(false)
        }
      }
    }

    loadData()

    return () => {
      mounted = false
    }
  }, [path, JSON.stringify(options)])

  const refresh = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      
      // Limpiar cache para forzar recarga
      clearCache(path)
      
      const result = await getOptimizedData(path, { ...options, cache: false })
      setData(result)
      setLoading(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido')
      setLoading(false)
    }
  }, [path, options])

  return { data, loading, error, refresh }
}

// Hook para datos en tiempo real optimizados
export const useOptimizedRealtimeData = (path: string, options: QueryOptions = {}) => {
  const [data, setData] = useState<any>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    setError(null)

    const unsubscribe = listenOptimizedData(path, (newData) => {
      setData(newData)
      setLoading(false)
    }, options)

    return unsubscribe
  }, [path, JSON.stringify(options)])

  return { data, loading, error }
}

// Hook para datos paginados optimizados
export const useOptimizedPaginatedData = (
  path: string, 
  pagination: PaginationOptions,
  options: QueryOptions = {}
) => {
  const [data, setData] = useState<any>({})
  const [total, setTotal] = useState(0)
  const [hasMore, setHasMore] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true

    const loadData = async () => {
      try {
        setLoading(true)
        setError(null)
        
        const result = await getPaginatedData(
          path, 
          pagination.page, 
          pagination.pageSize, 
          pagination.orderBy || 'fecha',
          options
        )
        
        if (mounted) {
          setData(result.data)
          setTotal(result.total)
          setHasMore(result.hasMore)
          setLoading(false)
        }
      } catch (err) {
        if (mounted) {
          setError(err instanceof Error ? err.message : 'Error desconocido')
          setLoading(false)
        }
      }
    }

    loadData()

    return () => {
      mounted = false
    }
  }, [path, pagination.page, pagination.pageSize, pagination.orderBy, JSON.stringify(options)])

  return { data, total, hasMore, loading, error }
}

// Hook para búsquedas optimizadas
export const useOptimizedSearch = (
  path: string,
  searchTerm: string,
  searchFields: string[],
  options: QueryOptions = {}
) => {
  const [data, setData] = useState<any>({})
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true

    const performSearch = async () => {
      if (!searchTerm.trim()) {
        // Si no hay término de búsqueda, cargar todos los datos
        try {
          setLoading(true)
          const result = await getOptimizedData(path, options)
          if (mounted) {
            setData(result)
            setLoading(false)
          }
        } catch (err) {
          if (mounted) {
            setError(err instanceof Error ? err.message : 'Error desconocido')
            setLoading(false)
          }
        }
        return
      }

      try {
        setLoading(true)
        setError(null)
        
        const result = await searchOptimizedData(path, searchTerm, searchFields, options)
        
        if (mounted) {
          setData(result)
          setLoading(false)
        }
      } catch (err) {
        if (mounted) {
          setError(err instanceof Error ? err.message : 'Error desconocido')
          setLoading(false)
        }
      }
    }

    // Debounce para evitar muchas consultas
    const timeoutId = setTimeout(performSearch, 300)

    return () => {
      mounted = false
      clearTimeout(timeoutId)
    }
  }, [path, searchTerm, JSON.stringify(searchFields), JSON.stringify(options)])

  return { data, loading, error }
}

// Hook para estadísticas de cache
export const useCacheStats = () => {
  const [stats, setStats] = useState<any>(null)

  useEffect(() => {
    const updateStats = () => {
      try {
        // Importar dinámicamente para evitar problemas de SSR
        import('@/lib/optimized-queries').then(({ getCacheStats }) => {
          setStats(getCacheStats())
        }).catch(error => {
          console.error('Error loading cache stats:', error)
          // Fallback con datos básicos
          setStats({
            size: 0,
            maxSize: 100,
            listeners: 0,
            memoryUsage: 'N/A'
          })
        })
      } catch (error) {
        console.error('Error updating cache stats:', error)
      }
    }

    updateStats()
    const interval = setInterval(updateStats, 10000) // Actualizar cada 10 segundos

    return () => clearInterval(interval)
  }, [])

  return stats
}

// Hook para limpiar cache
export const useCacheManagement = () => {
  const clearAllCache = useCallback(async () => {
    try {
      // Importar dinámicamente para evitar problemas de SSR
      const { clearCache } = await import('@/lib/optimized-queries')
      clearCache()
      console.log('Cache limpiado exitosamente')
    } catch (error) {
      console.error('Error al limpiar cache:', error)
    }
  }, [])

  const clearPathCache = useCallback(async (path: string) => {
    try {
      // Importar dinámicamente para evitar problemas de SSR
      const { clearCache } = await import('@/lib/optimized-queries')
      clearCache(path)
      console.log(`Cache de ${path} limpiado exitosamente`)
    } catch (error) {
      console.error('Error al limpiar cache de path:', error)
    }
  }, [])

  return { clearAllCache, clearPathCache }
} 