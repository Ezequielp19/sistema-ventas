"use client"

import { useState, useEffect } from "react"
import { ref, get, set, push } from "firebase/database"
import { database } from "@/lib/firebase"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { useAuth } from "@/contexts/auth-context"
import { Database, CheckCircle, AlertTriangle } from "lucide-react"

export default function DataMigration() {
  const { user } = useAuth()
  const [isMigrating, setIsMigrating] = useState(false)
  const [migrationStatus, setMigrationStatus] = useState("")
  const [migrationComplete, setMigrationComplete] = useState(false)

  const migrateData = async () => {
    if (!user?.id) {
      setMigrationStatus("Error: Usuario no autenticado")
      return
    }

    setIsMigrating(true)
    setMigrationStatus("Iniciando migración de datos...")

    try {
      // Migrar productos
      setMigrationStatus("Migrando productos...")
      const productosRef = ref(database, "productos")
      const productosSnapshot = await get(productosRef)
      const productos = productosSnapshot.val() || {}

      for (const [id, producto] of Object.entries(productos)) {
        await set(ref(database, `usuarios/${user.id}/productos/${id}`), {
          ...producto,
          usuarioId: user.id
        })
      }

      // Migrar proveedores
      setMigrationStatus("Migrando proveedores...")
      const proveedoresRef = ref(database, "proveedores")
      const proveedoresSnapshot = await get(proveedoresRef)
      const proveedores = proveedoresSnapshot.val() || {}

      for (const [id, proveedor] of Object.entries(proveedores)) {
        await set(ref(database, `usuarios/${user.id}/proveedores/${id}`), {
          ...proveedor,
          usuarioId: user.id
        })
      }

      // Migrar ventas
      setMigrationStatus("Migrando ventas...")
      const ventasRef = ref(database, "ventas")
      const ventasSnapshot = await get(ventasRef)
      const ventas = ventasSnapshot.val() || {}

      for (const [id, venta] of Object.entries(ventas)) {
        await set(ref(database, `usuarios/${user.id}/ventas/${id}`), {
          ...venta,
          usuarioId: user.id
        })
      }

      setMigrationStatus("Migración completada exitosamente")
      setMigrationComplete(true)
    } catch (error) {
      console.error("Error durante la migración:", error)
      setMigrationStatus(`Error durante la migración: ${error.message}`)
    } finally {
      setIsMigrating(false)
    }
  }

  const checkExistingData = async () => {
    if (!user?.id) return false

    try {
      const userProductosRef = ref(database, `usuarios/${user.id}/productos`)
      const userProductosSnapshot = await get(userProductosRef)
      return userProductosSnapshot.exists()
    } catch (error) {
      console.error("Error verificando datos existentes:", error)
      return false
    }
  }

  const [hasExistingData, setHasExistingData] = useState(false)

  useEffect(() => {
    checkExistingData().then(setHasExistingData)
  }, [user])

  if (!user) {
    return null
  }

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Database className="h-5 w-5" />
          Migración de Datos
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {migrationComplete ? (
          <Alert>
            <CheckCircle className="h-4 w-4" />
            <AlertDescription>
              {migrationStatus}
            </AlertDescription>
          </Alert>
        ) : hasExistingData ? (
          <Alert>
            <CheckCircle className="h-4 w-4" />
            <AlertDescription>
              Ya tienes datos migrados. No es necesario migrar nuevamente.
            </AlertDescription>
          </Alert>
        ) : (
          <>
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                Se detectó que tienes datos en el formato anterior. 
                Es necesario migrar los datos para que funcionen correctamente.
              </AlertDescription>
            </Alert>
            
            <Button 
              onClick={migrateData} 
              disabled={isMigrating}
              className="w-full"
            >
              {isMigrating ? "Migrando..." : "Migrar Datos"}
            </Button>
            
            {migrationStatus && (
              <p className="text-sm text-muted-foreground">
                {migrationStatus}
              </p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}
