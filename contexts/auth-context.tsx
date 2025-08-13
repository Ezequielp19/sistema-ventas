"use client"

import { createContext, useContext, useState, useEffect, ReactNode } from "react"

interface User {
  id?: string
  uid?: string // Para compatibilidad con componentes existentes
  email: string
  role: string
  name: string
  empresa?: string
}

interface AuthContextType {
  user: User | null
  isLoggedIn: boolean
  isSuperAdmin: boolean
  isLoading: boolean
  login: (userData: User, isAdmin?: boolean) => void
  logout: () => void
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [isSuperAdmin, setIsSuperAdmin] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  // Función para guardar la sesión en localStorage
  const saveSession = (userData: User, isAdmin = false) => {
    const sessionData = {
      user: userData,
      isSuperAdmin: isAdmin,
      timestamp: Date.now()
    }
    localStorage.setItem('controlStockSession', JSON.stringify(sessionData))
  }

  // Función para cargar la sesión desde localStorage
  const loadSession = () => {
    try {
      const sessionData = localStorage.getItem('controlStockSession')
      if (sessionData) {
        const session = JSON.parse(sessionData)
        const sessionAge = Date.now() - session.timestamp
        const maxSessionAge = 7 * 24 * 60 * 60 * 1000 // 7 días en milisegundos
        
        // Verificar si la sesión no ha expirado
        if (sessionAge < maxSessionAge) {
          setUser(session.user)
          setIsLoggedIn(true)
          setIsSuperAdmin(session.isSuperAdmin)
          return true
        } else {
          // Sesión expirada, limpiar localStorage
          localStorage.removeItem('controlStockSession')
        }
      }
    } catch (error) {
      console.error('Error al cargar la sesión:', error)
      localStorage.removeItem('controlStockSession')
    }
    return false
  }

  // Función para limpiar la sesión
  const clearSession = () => {
    localStorage.removeItem('controlStockSession')
  }

  // Función de login
  const login = (userData: User, isAdmin = false) => {
    setUser(userData)
    setIsLoggedIn(true)
    setIsSuperAdmin(isAdmin)
    saveSession(userData, isAdmin)
  }

  // Función de logout
  const logout = () => {
    setUser(null)
    setIsLoggedIn(false)
    setIsSuperAdmin(false)
    clearSession()
  }

  // Cargar sesión al inicializar
  useEffect(() => {
    loadSession()
    setIsLoading(false)
  }, [])

  const value = {
    user,
    isLoggedIn,
    isSuperAdmin,
    isLoading,
    login,
    logout
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth debe ser usado dentro de un AuthProvider')
  }
  return context
} 