"use client"

import { useState, useEffect, useMemo } from "react"
import { ref, onValue, off } from "firebase/database"
import { database } from "@/lib/firebase"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { LogOut, Package, Users, ShoppingCart, AlertTriangle, Menu, ChevronDown, ChevronUp, Building, FileText, Store } from "lucide-react"
import { Sheet, SheetContent, SheetTrigger, SheetClose } from "@/components/ui/sheet"
import { ThemeToggle } from "@/components/theme-toggle"
import ProductosTab from "@/components/productos-tab"
import ProveedoresTab from "@/components/proveedores-tab"
import VentasTab from "@/components/ventas-tab"
import StockTab from "@/components/stock-tab"
import ReportesTab from "@/components/reportes-tab"
import CustomReports from "@/components/custom-reports"
import FacturacionTab from "@/components/facturacion-tab"
import TiendaTab from "@/components/tienda-tab"
import DataMigration from "@/components/data-migration"
import { useOptimizedRealtimeData } from "@/hooks/useOptimizedQueries"

export default function Dashboard({ user, onLogout }) {
  const [activeTab, setActiveTab] = useState("productos")
  const [triggerNewSale, setTriggerNewSale] = useState(false)
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [stockAlertsMinimized, setStockAlertsMinimized] = useState(false)
  const [empresaInfo, setEmpresaInfo] = useState(null)
  const [showMigration, setShowMigration] = useState(false)

  // Usar consultas optimizadas con filtro por usuario
  const { data: productos, loading: productosLoading } = useOptimizedRealtimeData(`usuarios/${user?.id}/productos`)
  const { data: proveedores, loading: proveedoresLoading } = useOptimizedRealtimeData(`usuarios/${user?.id}/proveedores`)
  const { data: ventas, loading: ventasLoading } = useOptimizedRealtimeData(`usuarios/${user?.id}/ventas`)

  // Verificar si hay datos en el formato anterior
  useEffect(() => {
    const checkOldData = async () => {
      try {
        const oldProductosRef = ref(database, "productos")
        const oldProductosSnapshot = await onValue(oldProductosRef, (snapshot) => {
          if (snapshot.exists() && Object.keys(productos || {}).length === 0) {
            setShowMigration(true)
          }
        })
        return () => off(oldProductosRef, 'value', oldProductosSnapshot)
      } catch (error) {
        console.error("Error verificando datos antiguos:", error)
      }
    }
    
    if (user?.id) {
      checkOldData()
    }
  }, [user, productos])

  // Cargar información de la empresa si el usuario tiene una
  useEffect(() => {
    if (user?.empresa) {
      const empresaRef = ref(database, `empresas/${user.empresa}`)
      const unsubscribeEmpresa = onValue(empresaRef, (snapshot) => {
        setEmpresaInfo(snapshot.val())
      })
      return () => unsubscribeEmpresa()
    }
  }, [user])

  // Escuchar teclas de función
  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === "F1") {
        event.preventDefault()
        setActiveTab("ventas")
        setTriggerNewSale(true)
        setTimeout(() => setTriggerNewSale(false), 100)
      } else if (event.key === "F2") {
        event.preventDefault()
        setActiveTab("proveedores")
      } else if (event.key === "F3") {
        event.preventDefault()
        setActiveTab("productos")
      } else if (event.key === "F7") {
        event.preventDefault()
        setActiveTab("reportes")
      } else if (event.key === "F8") {
        event.preventDefault()
        setActiveTab("facturacion")
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [])

  // Cálculos optimizados con useMemo
  const { totalProductos, totalProveedores, totalVentas, stockBajo } = useMemo(() => {
    const productosArray = Object.entries(productos || {}).map(([id, producto]) => ({
      id,
      ...producto,
    }))
    
    const stockBajoItems = productosArray.filter((p) => p.stock <= p.stockMinimo)
    
    return {
      totalProductos: Object.keys(productos || {}).length,
      totalProveedores: Object.keys(proveedores || {}).length,
      totalVentas: Object.values(ventas || {}).reduce((sum, venta) => sum + (venta.total || 0), 0),
      stockBajo: stockBajoItems
    }
  }, [productos, proveedores, ventas])

  const TabsNavigation = ({ isMobile = false }) => {
    const handleTabClick = (value: string) => {
      setActiveTab(value)
      if (isMobile) {
        setIsMobileMenuOpen(false)
      }
    }

    if (isMobile) {
      // En móvil, usar botones simples en lugar de TabsTrigger
      return (
        <div className="grid grid-cols-2 gap-2">
          <SheetClose asChild>
            <Button
              variant={activeTab === "productos" ? "default" : "outline"}
              className="w-full justify-start"
              onClick={() => handleTabClick("productos")}
            >
              Productos
            </Button>
          </SheetClose>
          <SheetClose asChild>
            <Button
              variant={activeTab === "proveedores" ? "default" : "outline"}
              className="w-full justify-start"
              onClick={() => handleTabClick("proveedores")}
            >
              Proveedores
            </Button>
          </SheetClose>
          <SheetClose asChild>
            <Button
              variant={activeTab === "ventas" ? "default" : "outline"}
              className="w-full justify-start"
              onClick={() => handleTabClick("ventas")}
            >
              Ventas
            </Button>
          </SheetClose>
          <SheetClose asChild>
            <Button
              variant={activeTab === "tienda" ? "default" : "outline"}
              className="w-full justify-start"
              onClick={() => handleTabClick("tienda")}
            >
              <Store className="h-4 w-4 mr-2" />
              Mi Tienda
            </Button>
          </SheetClose>
          <SheetClose asChild>
            <Button
              variant={activeTab === "stock" ? "default" : "outline"}
              className="w-full justify-start"
              onClick={() => handleTabClick("stock")}
            >
              Stock
            </Button>
          </SheetClose>
          <SheetClose asChild>
            <Button
              variant={activeTab === "reportes" ? "default" : "outline"}
              className="w-full justify-start"
              onClick={() => handleTabClick("reportes")}
            >
              Reportes
            </Button>
          </SheetClose>
          <SheetClose asChild>
            <Button
              variant={activeTab === "personalizados" ? "default" : "outline"}
              className="w-full justify-start"
              onClick={() => handleTabClick("personalizados")}
            >
              Personalizados
            </Button>
          </SheetClose>
          <SheetClose asChild>
            <Button
              variant={activeTab === "facturacion" ? "default" : "outline"}
              className="w-full justify-start"
              onClick={() => handleTabClick("facturacion")}
            >
              Facturación
            </Button>
          </SheetClose>
        </div>
      )
    }

    // En desktop, usar TabsTrigger normal
    return (
      <TabsList className="grid w-full grid-cols-8">
        <TabsTrigger value="productos">
          <span className="hidden sm:inline">Productos</span>
          <span className="sm:hidden">F3</span>
        </TabsTrigger>
        <TabsTrigger value="proveedores">
          <span className="hidden sm:inline">Proveedores</span>
          <span className="sm:hidden">F2</span>
        </TabsTrigger>
        <TabsTrigger value="ventas">
          <span className="hidden sm:inline">Ventas</span>
          <span className="sm:hidden">F1</span>
        </TabsTrigger>
        <TabsTrigger value="tienda">
          <Store className="h-4 w-4 mr-1" />
          <span className="hidden sm:inline">Mi Tienda</span>
        </TabsTrigger>
        <TabsTrigger value="stock">
          <span className="hidden sm:inline">Stock</span>
        </TabsTrigger>
        <TabsTrigger value="reportes">
          <span className="hidden sm:inline">Reportes</span>
          <span className="sm:hidden">F7</span>
        </TabsTrigger>
        <TabsTrigger value="personalizados">
          <span className="hidden sm:inline">Personalizados</span>
        </TabsTrigger>
        <TabsTrigger value="facturacion">
          <span className="hidden sm:inline">Facturación</span>
          <span className="sm:hidden">F8</span>
        </TabsTrigger>
      </TabsList>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-card shadow-sm border-b border-border">
        <div className="max-w-7xl mx-auto px-2 sm:px-4 lg:px-8">
          <div className="flex justify-between items-center py-3 sm:py-4">
            <div className="flex items-center space-x-4">
              <h1 className="text-lg sm:text-2xl font-bold text-foreground truncate">ControlStock</h1>
              {empresaInfo && (
                <div className="hidden sm:flex items-center space-x-2">
                  <Building className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">{empresaInfo.nombre}</span>
                  <Badge variant="outline" className="text-xs">
                    {empresaInfo.plan}
                  </Badge>
                </div>
              )}
            </div>

            {/* Desktop Navigation */}
            <div className="hidden lg:flex items-center space-x-4">
              <div className="flex flex-wrap gap-1">
                <Badge variant="outline" className="text-xs">
                  F1 = Venta
                </Badge>
                <Badge variant="outline" className="text-xs">
                  F2 = Proveedores
                </Badge>
                <Badge variant="outline" className="text-xs">
                  F3 = Productos
                </Badge>
                <Badge variant="outline" className="text-xs">
                  F7 = Reportes
                </Badge>
                <Badge variant="outline" className="text-xs">
                  F8 = Facturación
                </Badge>
              </div>
              <span className="text-sm text-muted-foreground hidden xl:block">
                Bienvenido, {user?.name || user?.email}
              </span>
              <ThemeToggle />
              <Button variant="outline" onClick={onLogout} size="sm">
                <LogOut className="h-4 w-4 mr-2" />
                <span className="hidden sm:inline">Cerrar Sesión</span>
              </Button>
            </div>

            {/* Mobile Menu */}
            <div className="lg:hidden flex items-center space-x-2">
              <ThemeToggle />
              <Button variant="outline" onClick={onLogout} size="sm">
                <LogOut className="h-4 w-4" />
              </Button>
              <Sheet open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
                <SheetTrigger asChild>
                  <Button variant="outline" size="sm">
                    <Menu className="h-4 w-4" />
                  </Button>
                </SheetTrigger>
                <SheetContent side="right" className="w-80">
                  <div className="space-y-4">
                    <div className="text-center">
                      <h2 className="text-lg font-semibold">Navegación</h2>
                      <p className="text-sm text-muted-foreground">{user?.name || user?.email}</p>
                      {empresaInfo && (
                        <div className="mt-2 flex items-center justify-center space-x-2">
                          <Building className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm text-muted-foreground">{empresaInfo.nombre}</span>
                        </div>
                      )}
                    </div>
                    <TabsNavigation isMobile={true} />
                    <div className="space-y-2">
                      <div className="text-sm font-medium">Atajos de Teclado:</div>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <Badge variant="outline">F1 = Nueva Venta</Badge>
                        <Badge variant="outline">F2 = Proveedores</Badge>
                        <Badge variant="outline">F3 = Productos</Badge>
                        <Badge variant="outline">F7 = Reportes</Badge>
                      </div>
                    </div>
                  </div>
                </SheetContent>
              </Sheet>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-2 sm:px-4 lg:px-8 py-4 sm:py-8">
        {/* Migración de datos */}
        {showMigration && (
          <div className="mb-6">
            <DataMigration />
          </div>
        )}

        {/* Alertas de Stock Bajo con opción de minimizar/maximizar */}
        {stockBajo.length > 0 && (
          <div className="mb-4 sm:mb-6">
            <Card className="border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950">
              <CardHeader className="pb-3">
                <div className="flex justify-between items-center">
                  <CardTitle className="text-red-800 dark:text-red-200 flex items-center text-sm sm:text-base">
                    <AlertTriangle className="h-4 w-4 sm:h-5 sm:w-5 mr-2" />
                    Alertas de Stock Bajo ({stockBajo.length})
                  </CardTitle>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setStockAlertsMinimized(!stockAlertsMinimized)}
                    className="h-8 w-8 p-0"
                  >
                    {stockAlertsMinimized ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
                  </Button>
                </div>
              </CardHeader>
              {!stockAlertsMinimized && (
                <CardContent>
                  <div className="space-y-2">
                    {stockBajo.slice(0, 3).map((producto) => (
                      <div
                        key={producto.id}
                        className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2"
                      >
                        <span className="font-medium text-sm">{producto.nombre}</span>
                        <Badge variant="destructive" className="text-xs w-fit">
                          Stock: {producto.stock} (Mín: {producto.stockMinimo})
                        </Badge>
                      </div>
                    ))}
                    {stockBajo.length > 3 && (
                      <p className="text-sm text-red-700 dark:text-red-300">
                        Y {stockBajo.length - 3} productos más...
                      </p>
                    )}
                  </div>
                </CardContent>
              )}
            </Card>
          </div>
        )}

        {/* Estadísticas */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6 mb-6 sm:mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-xs sm:text-sm font-medium">Productos</CardTitle>
              <Package className="h-3 w-3 sm:h-4 sm:w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-lg sm:text-2xl font-bold">{totalProductos}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-xs sm:text-sm font-medium">Proveedores</CardTitle>
              <Users className="h-3 w-3 sm:h-4 sm:w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-lg sm:text-2xl font-bold">{totalProveedores}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-xs sm:text-sm font-medium">Ventas Totales</CardTitle>
              <ShoppingCart className="h-3 w-3 sm:h-4 sm:w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-lg sm:text-2xl font-bold">${totalVentas.toFixed(2)}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-xs sm:text-sm font-medium">Stock Bajo</CardTitle>
              <AlertTriangle className="h-3 w-3 sm:h-4 sm:w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-lg sm:text-2xl font-bold text-red-600 dark:text-red-400">{stockBajo.length}</div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs principales */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          {/* Desktop Tabs */}
          <div className="hidden lg:block">
            <TabsNavigation />
          </div>

          {/* Mobile Tabs - Simplified */}
          <div className="lg:hidden">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold capitalize">{activeTab}</h2>
              <Sheet open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
                <SheetTrigger asChild>
                  <Button variant="outline" size="sm">
                    <Menu className="h-4 w-4 mr-2" />
                    Cambiar Sección
                  </Button>
                </SheetTrigger>
                <SheetContent side="right" className="w-80">
                  <div className="space-y-4">
                    <h2 className="text-lg font-semibold">Seleccionar Sección</h2>
                    <TabsNavigation isMobile={true} />
                  </div>
                </SheetContent>
              </Sheet>
            </div>
          </div>

          <TabsContent value="productos">
            <ProductosTab productos={productos} proveedores={proveedores} />
          </TabsContent>

          <TabsContent value="proveedores">
            <ProveedoresTab proveedores={proveedores} productos={productos} />
          </TabsContent>

          <TabsContent value="ventas">
            <VentasTab
              productos={productos}
              ventas={ventas}
              proveedores={proveedores}
              triggerNewSale={triggerNewSale}
            />
          </TabsContent>

                  <TabsContent value="tienda">
          <TiendaTab productos={productos} user={user} />
        </TabsContent>

          <TabsContent value="stock">
            <StockTab productos={productos} stockBajo={stockBajo} />
          </TabsContent>

          <TabsContent value="reportes">
            <ReportesTab ventas={ventas} productos={productos} proveedores={proveedores} />
          </TabsContent>

          <TabsContent value="personalizados">
            <CustomReports ventas={ventas} productos={productos} proveedores={proveedores} />
          </TabsContent>

          <TabsContent value="facturacion">
            <FacturacionTab ventas={ventas} productos={productos} proveedores={proveedores} />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  )
}
