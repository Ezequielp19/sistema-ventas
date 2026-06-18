"use client"

import { useState } from "react"
import { ref, get } from "firebase/database"
import { database, auth } from "@/lib/firebase"
import { signInWithEmailAndPassword } from "firebase/auth"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import Dashboard from "@/components/dashboard"
import SuperAdminPanel from "@/components/super-admin-panel"
import { LogIn, AlertCircle } from "lucide-react"
import { useAuth } from "@/contexts/auth-context"
import { ANALYTICS_EVENTS, trackEvent } from "@/src/services/analytics.service"

type LegacyUserRecord = {
  email?: string
  password?: string
  activo?: boolean
  nombre?: string
  empresa?: string
}

const SUPER_ADMIN_EMAIL = "adminatenea@software.com"
const SUPER_ADMIN_PASSWORD = "adminatenea"

export default function Home() {
  const { user, isLoggedIn, isSuperAdmin, isLoading, login, logout } = useAuth()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [isLoadingLogin, setIsLoadingLogin] = useState(false)

  const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setIsLoadingLogin(true)
    setError("")

    try {
      const normalizedEmail = email.trim().toLowerCase()
      const normalizedPassword = password.trim()
      const expectedSuperAdminEmail = SUPER_ADMIN_EMAIL.toLowerCase()
      const isSuperAdminLogin = normalizedEmail === expectedSuperAdminEmail && normalizedPassword === SUPER_ADMIN_PASSWORD

      console.log("Intentando login super admin:", isSuperAdminLogin)
      console.log("DEBUG SUPER ADMIN:", {
        inputEmail: normalizedEmail,
        expectedEmail: expectedSuperAdminEmail,
        emailMatches: normalizedEmail === expectedSuperAdminEmail,
        passwordLength: normalizedPassword.length,
        expectedPasswordLength: SUPER_ADMIN_PASSWORD.length,
        passwordMatches: normalizedPassword === SUPER_ADMIN_PASSWORD,
      })

      if (isSuperAdminLogin) {
        const adminUser = {
          id: "admin",
          uid: "admin",
          email: SUPER_ADMIN_EMAIL,
          role: "super_admin",
          name: "Super Administrador",
        }
        login(adminUser, true)
        void trackEvent(ANALYTICS_EVENTS.loginSuccess, { role: "super_admin" })
        setEmail("")
        setPassword("")
        return
      }

      const usersRef = ref(database, "usuarios")
      const snapshot = await get(usersRef)
      const users = (snapshot.val() || {}) as Record<string, LegacyUserRecord>

      const user = Object.entries(users).find(([, userData]) =>
        (userData.email || "").trim().toLowerCase() === normalizedEmail && userData.password === normalizedPassword,
      )

      if (user) {
        const [userId, userData] = user

        if (userData.activo === false) {
          setError("Tu cuenta está suspendida. Contacta al administrador.")
          return
        }

        try {
          await signInWithEmailAndPassword(auth, normalizedEmail, normalizedPassword)
        } catch (authError) {
          console.error("Error al autenticar al usuario común con Firebase Auth:", authError)
          setError("Tu usuario existe, pero no pudo iniciar sesión en Firebase Auth. Verifica que esté creado también en Authentication.")
          return
        }

        const normalUser = {
          id: userId,
          uid: userId,
          email: userData.email || normalizedEmail,
          role: "user",
          name: userData.nombre || userData.email || normalizedEmail,
          empresa: userData.empresa || "Cliente",
        }
        login(normalUser, false)
        void trackEvent(ANALYTICS_EVENTS.loginSuccess, { role: "user" })
        setEmail("")
        setPassword("")
      } else {
        setError("Credenciales incorrectas. Verifica tu email y contraseña.")
      }
    } catch (error) {
      console.error("Error al iniciar sesión:", error)
      setError("Error al conectar con la base de datos.")
    } finally {
      setIsLoadingLogin(false)
    }
  }

  // Mostrar pantalla de carga mientras se inicializa
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Cargando sistema...</p>
        </div>
      </div>
    )
  }

  if (!isLoggedIn) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-sm sm:max-w-md">
          <CardHeader className="text-center">
            <CardTitle className="text-lg sm:text-xl">ControlStock - Sistema de Gestión</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="tu@email.com"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Contraseña</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                />
              </div>
              
              {error && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <Button type="submit" className="w-full" disabled={isLoadingLogin}>
                <LogIn className="mr-2 h-4 w-4" />
                {isLoadingLogin ? "Iniciando sesión..." : "Acceder al Sistema"}
              </Button>
            </form>
            
            <div className="text-xs text-muted-foreground text-center">
              <p>Sistema de Gestión Completo</p>
              <button 
                onClick={() => {
                  localStorage.removeItem('controlStockSession')
                  window.location.reload()
                }}
                className="text-blue-600 hover:text-blue-800 underline mt-2"
              >
                Limpiar sesión
              </button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (isSuperAdmin) {
    return <SuperAdminPanel user={user} onLogout={logout} />
  }

  return <Dashboard user={user} onLogout={logout} />
}
