// Configuración centralizada para optimizaciones de rendimiento

export const PERFORMANCE_CONFIG = {
  // Configuración de Cache
  CACHE: {
    DURATION: 5 * 60 * 1000, // 5 minutos
    MAX_SIZE: 100, // Máximo 100 entradas
    CLEANUP_INTERVAL: 5 * 60 * 1000, // Limpiar cada 5 minutos
  },

  // Configuración de Búsquedas
  SEARCH: {
    DEBOUNCE_MS: 300, // 300ms de debounce
    MIN_CHARS: 2, // Mínimo 2 caracteres para buscar
    MAX_RESULTS: 50, // Máximo 50 resultados
  },

  // Configuración de Paginación
  PAGINATION: {
    DEFAULT_PAGE_SIZE: 10,
    PAGE_SIZE_OPTIONS: [5, 10, 20, 50],
    MAX_PAGES_VISIBLE: 5,
  },

  // Configuración de Rendimiento
  PERFORMANCE: {
    RENDER_TIME_THRESHOLD: 100, // ms - umbral para considerar lento
    MEMORY_THRESHOLD: 100, // MB - umbral de memoria
    UPDATE_INTERVAL: 10000, // 10 segundos para actualizar métricas
  },

  // Configuración de Firebase
  FIREBASE: {
    MAX_CONCURRENT_REQUESTS: 10,
    REQUEST_TIMEOUT: 30000, // 30 segundos
    RETRY_ATTEMPTS: 3,
  },

  // Configuración de UI
  UI: {
    LOADING_DELAY: 200, // ms antes de mostrar loading
    ANIMATION_DURATION: 150, // ms para animaciones
    TOOLTIP_DELAY: 500, // ms para tooltips
  },

  // Configuración de Monitoreo
  MONITORING: {
    ENABLED: true,
    LOG_LEVEL: 'info', // 'debug', 'info', 'warn', 'error'
    SEND_ANALYTICS: false, // Enviar métricas a analytics
  },
}

// Tipos para la configuración
export interface PerformanceConfig {
  CACHE: {
    DURATION: number
    MAX_SIZE: number
    CLEANUP_INTERVAL: number
  }
  SEARCH: {
    DEBOUNCE_MS: number
    MIN_CHARS: number
    MAX_RESULTS: number
  }
  PAGINATION: {
    DEFAULT_PAGE_SIZE: number
    PAGE_SIZE_OPTIONS: number[]
    MAX_PAGES_VISIBLE: number
  }
  PERFORMANCE: {
    RENDER_TIME_THRESHOLD: number
    MEMORY_THRESHOLD: number
    UPDATE_INTERVAL: number
  }
  FIREBASE: {
    MAX_CONCURRENT_REQUESTS: number
    REQUEST_TIMEOUT: number
    RETRY_ATTEMPTS: number
  }
  UI: {
    LOADING_DELAY: number
    ANIMATION_DURATION: number
    TOOLTIP_DELAY: number
  }
  MONITORING: {
    ENABLED: boolean
    LOG_LEVEL: string
    SEND_ANALYTICS: boolean
  }
}

// Funciones de utilidad para la configuración
export const getConfig = (): PerformanceConfig => PERFORMANCE_CONFIG

export const updateConfig = (updates: Partial<PerformanceConfig>) => {
  Object.assign(PERFORMANCE_CONFIG, updates)
}

export const isPerformanceMode = (): boolean => {
  return process.env.NODE_ENV === 'production' || process.env.NEXT_PUBLIC_PERFORMANCE_MODE === 'true'
}

export const shouldEnableCache = (): boolean => {
  return PERFORMANCE_CONFIG.CACHE.MAX_SIZE > 0 && PERFORMANCE_CONFIG.CACHE.DURATION > 0
}

export const getCacheKey = (path: string, options: any = {}): string => {
  return `${path}_${JSON.stringify(options)}`
}

export const logPerformance = (message: string, data?: any) => {
  if (PERFORMANCE_CONFIG.MONITORING.ENABLED) {
    const timestamp = new Date().toISOString()
    const logData = {
      timestamp,
      message,
      data,
      level: PERFORMANCE_CONFIG.MONITORING.LOG_LEVEL
    }
    
    if (PERFORMANCE_CONFIG.MONITORING.LOG_LEVEL === 'debug') {
      console.log('[Performance]', logData)
    } else if (PERFORMANCE_CONFIG.MONITORING.LOG_LEVEL === 'warn') {
      console.warn('[Performance]', logData)
    } else if (PERFORMANCE_CONFIG.MONITORING.LOG_LEVEL === 'error') {
      console.error('[Performance]', logData)
    } else {
      console.info('[Performance]', logData)
    }
  }
}

// Configuración específica por entorno
export const getEnvironmentConfig = () => {
  const isDev = process.env.NODE_ENV === 'development'
  const isProd = process.env.NODE_ENV === 'production'
  
  if (isDev) {
    return {
      ...PERFORMANCE_CONFIG,
      CACHE: {
        ...PERFORMANCE_CONFIG.CACHE,
        DURATION: 1 * 60 * 1000, // 1 minuto en desarrollo
        MAX_SIZE: 50, // Menos cache en desarrollo
      },
      MONITORING: {
        ...PERFORMANCE_CONFIG.MONITORING,
        LOG_LEVEL: 'debug', // Más logs en desarrollo
      }
    }
  }
  
  if (isProd) {
    return {
      ...PERFORMANCE_CONFIG,
      CACHE: {
        ...PERFORMANCE_CONFIG.CACHE,
        DURATION: 10 * 60 * 1000, // 10 minutos en producción
        MAX_SIZE: 200, // Más cache en producción
      },
      MONITORING: {
        ...PERFORMANCE_CONFIG.MONITORING,
        LOG_LEVEL: 'warn', // Menos logs en producción
        SEND_ANALYTICS: true, // Enviar analytics en producción
      }
    }
  }
  
  return PERFORMANCE_CONFIG
} 