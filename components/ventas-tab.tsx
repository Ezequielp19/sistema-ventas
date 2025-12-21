"use client"

import { useState, useEffect } from "react"
import { ref, push, update, remove } from "firebase/database"
import { database } from "@/lib/firebase"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Plus, Trash2, Search, Filter, X, CreditCard } from "lucide-react"
import { Pagination } from "@/components/ui/pagination"
import ExportButtons from "./export-buttons"
import HelpTooltip from "./help-tooltip"
import { useAuth } from "@/contexts/auth-context"

export default function VentasTab({ productos, ventas, proveedores, triggerNewSale }) {
  const { user } = useAuth()
  const [showDialog, setShowDialog] = useState(false)
  const [carrito, setCarrito] = useState([])
  const [cliente, setCliente] = useState("")
  const [pagos, setPagos] = useState([])

  // Estados para filtros
  const [searchTerm, setSearchTerm] = useState("")
  const [filterProveedor, setFilterProveedor] = useState("")
  const [filterTipo, setFilterTipo] = useState("")

  // Paginación para la tabla de ventas
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 10

  // Efecto para abrir nueva venta con F1
  useEffect(() => {
    if (triggerNewSale) {
      setShowDialog(true)
    }
  }, [triggerNewSale])

  const agregarAlCarrito = (productoId) => {
    const producto = productos[productoId]
    if (!producto || producto.stock <= 0) return

    const itemExistente = carrito.find((item) => item.id === productoId)

    if (itemExistente) {
      if (itemExistente.cantidad < producto.stock) {
        setCarrito(carrito.map((item) => (item.id === productoId ? { ...item, cantidad: item.cantidad + 1 } : item)))
      }
    } else {
      setCarrito([
        ...carrito,
        {
          id: productoId,
          nombre: producto.nombre,
          precio: producto.precioVenta || producto.precio,
          precioCompra: producto.precioCompra || producto.precio,
          cantidad: 1,
          stockDisponible: producto.stock,
        },
      ])
    }
  }

  const removerDelCarrito = (productoId) => {
    setCarrito(carrito.filter((item) => item.id !== productoId))
  }

  const actualizarCantidad = (productoId, nuevaCantidad) => {
    if (nuevaCantidad <= 0) {
      removerDelCarrito(productoId)
      return
    }

    const producto = productos[productoId]
    if (nuevaCantidad > producto.stock) return

    setCarrito(carrito.map((item) => (item.id === productoId ? { ...item, cantidad: nuevaCantidad } : item)))
  }

  const calcularTotal = () => {
    return carrito.reduce((total, item) => total + item.precio * item.cantidad, 0)
  }

  const calcularTotalPagos = () => {
    return pagos.reduce((total, pago) => total + (Number.parseFloat(pago.monto) || 0), 0)
  }

  const agregarPago = () => {
    setPagos([...pagos, { metodo: "", monto: "" }])
  }

  const actualizarPago = (index, campo, valor) => {
    const nuevosPagos = [...pagos]
    nuevosPagos[index][campo] = valor
    setPagos(nuevosPagos)
  }

  const removerPago = (index) => {
    setPagos(pagos.filter((_, i) => i !== index))
  }

  const procesarVenta = async () => {
    if (carrito.length === 0 || !cliente || pagos.length === 0 || !user?.id) return

    const totalVenta = calcularTotal()
    const totalPagado = calcularTotalPagos()

    // Validar que el total pagado coincida con el total de la venta
    if (Math.abs(totalVenta - totalPagado) > 0.01) {
      alert(
        `Error: El total pagado ($${totalPagado.toFixed(2)}) no coincide con el total de la venta ($${totalVenta.toFixed(2)})`,
      )
      return
    }

    // Validar que todos los pagos tengan método y monto
    const pagosValidos = pagos.filter((pago) => pago.metodo && pago.monto && Number.parseFloat(pago.monto) > 0)
    if (pagosValidos.length !== pagos.length) {
      alert("Por favor, complete todos los métodos de pago y montos")
      return
    }

    const ventaData = {
      cliente,
      pagos: pagosValidos,
      items: carrito,
      total: totalVenta,
      fecha: new Date().toISOString(),
      usuarioId: user.id, // Agregar ID del usuario
    }

    try {
      // Crear la venta
      await push(ref(database, `usuarios/${user.id}/ventas`), ventaData)

      // Actualizar stock de productos
      const updates = {}
      carrito.forEach((item) => {
        const nuevoStock = productos[item.id].stock - item.cantidad
        updates[`usuarios/${user.id}/productos/${item.id}/stock`] = nuevoStock
      })

      await update(ref(database), updates)

      // Limpiar formulario
      setCarrito([])
      setCliente("")
      setPagos([])
      setShowDialog(false)

      alert("Venta procesada exitosamente")
    } catch (error) {
      console.error("Error al procesar venta:", error)
    }
  }

  const eliminarVenta = async (ventaId, venta) => {
    if (!user?.id) {
      console.error("Usuario no autenticado")
      return
    }

    if (
      !confirm(
        `¿Estás seguro de eliminar la venta de ${venta.cliente}? Esta acción restaurará el stock de los productos.`,
      )
    ) {
      return
    }

    try {
      // Restaurar stock de productos
      const updates = {}
      venta.items?.forEach((item) => {
        if (productos[item.id]) {
          const nuevoStock = productos[item.id].stock + item.cantidad
          updates[`usuarios/${user.id}/productos/${item.id}/stock`] = nuevoStock
        }
      })

      // Actualizar stock primero
      if (Object.keys(updates).length > 0) {
        await update(ref(database), updates)
      }

      // Eliminar la venta
      await remove(ref(database, `usuarios/${user.id}/ventas/${ventaId}`))

      alert("Venta eliminada exitosamente y stock restaurado")
    } catch (error) {
      console.error("Error al eliminar venta:", error)
      alert("Error al eliminar la venta")
    }
  }

  const limpiarFiltros = () => {
    setSearchTerm("")
    setFilterProveedor("")
    setFilterTipo("")
  }

  // Filtrar productos
  const productosArray = Object.entries(productos).map(([id, producto]) => ({
    id,
    ...producto,
  }))

  const filteredProducts = productosArray.filter((producto) => {
    // Solo productos con stock disponible
    if (producto.stock <= 0) return false

    // Filtro por búsqueda (nombre o código)
    const matchesSearch =
      !searchTerm ||
      producto.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
      producto.codigo?.toLowerCase().includes(searchTerm.toLowerCase())

    // Filtro por proveedor
    const matchesProveedor = !filterProveedor || filterProveedor === "all" || producto.proveedor === filterProveedor

    // Filtro por tipo
    const matchesTipo = !filterTipo || filterTipo === "all" || producto.tipo === filterTipo

    return matchesSearch && matchesProveedor && matchesTipo
  })

  // Obtener tipos únicos de productos con stock
  const tiposUnicos = [
    ...new Set(
      productosArray
        .filter((p) => p.stock > 0)
        .map((p) => p.tipo)
        .filter(Boolean),
    ),
  ]

  // Obtener proveedores que tienen productos con stock
  const proveedoresConStock = Object.entries(proveedores || {}).filter(([id]) =>
    productosArray.some((p) => p.proveedor === id && p.stock > 0),
  )

  const ventasArray = Object.entries(ventas || {})
    .map(([id, venta]) => ({
      id,
      ...venta,
    }))
    .sort((a, b) => new Date(b.fecha) - new Date(a.fecha))

  // Paginación para ventas
  const totalPages = Math.ceil(ventasArray.length / itemsPerPage)
  const currentItems = ventasArray.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)

  const metodosPago = ["efectivo", "tarjeta", "transferencia", "debito", "cheque"]

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div className="flex items-center gap-2">
              <CardTitle className="text-lg sm:text-xl">Nueva Venta</CardTitle>
              <HelpTooltip
                title="Ayuda - Gestión de Ventas"
                content={
                  <div className="space-y-3">
                    <div>
                      <h4 className="font-semibold text-blue-600">¿Qué puedes hacer aquí?</h4>
                      <ul className="list-disc list-inside space-y-1 mt-2">
                        <li><strong>Crear ventas:</strong> Procesa nuevas transacciones</li>
                        <li><strong>Gestionar carrito:</strong> Agrega/remueve productos</li>
                        <li><strong>Múltiples pagos:</strong> Combina diferentes métodos de pago</li>
                        <li><strong>Control de stock:</strong> Actualización automática de inventario</li>
                        <li><strong>Historial completo:</strong> Ver todas las ventas realizadas</li>
                        <li><strong>Exportar datos:</strong> Descarga reportes en PDF, Excel o CSV</li>
                      </ul>
                    </div>
                    <div>
                      <h4 className="font-semibold text-green-600">Funcionalidades principales:</h4>
                      <ul className="list-disc list-inside space-y-1 mt-2">
                        <li><strong>Búsqueda rápida:</strong> Encuentra productos por nombre o código</li>
                        <li><strong>Filtros avanzados:</strong> Por proveedor y tipo de producto</li>
                        <li><strong>Stock en tiempo real:</strong> Solo muestra productos disponibles</li>
                        <li><strong>Métodos de pago:</strong> Efectivo, tarjeta, transferencia, débito, cheque</li>
                        <li><strong>Atajos de teclado:</strong> F1 para nueva venta</li>
                      </ul>
                    </div>
                    <div className="bg-blue-50 p-3 rounded-lg">
                      <p className="text-sm text-blue-800">
                        <strong>💡 Tip:</strong> Usa F1 para crear una venta rápidamente. Puedes combinar múltiples métodos de pago en una sola venta.
                      </p>
                    </div>
                  </div>
                }
              />
            </div>
            <Dialog open={showDialog} onOpenChange={setShowDialog}>
              <DialogTrigger asChild>
                <Button className="w-full sm:w-auto">
                  <Plus className="h-4 w-4 mr-2" />
                  <span className="hidden sm:inline">Nueva Venta (F1)</span>
                  <span className="sm:hidden">Nueva Venta</span>
                </Button>
              </DialogTrigger>
              <DialogContent className="w-[95vw] sm:w-[90vw] lg:max-w-[95vw] xl:max-w-[90vw] max-h-[90vh] overflow-y-auto p-4 sm:p-6">
                <DialogHeader>
                  <DialogTitle className="text-lg sm:text-xl">Procesar Nueva Venta</DialogTitle>
                </DialogHeader>
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
                  {/* Productos disponibles con filtros */}
                  <div className="order-1 lg:order-1">
                    <div className="flex justify-between items-center mb-4">
                      <h3 className="font-semibold text-sm sm:text-base">Productos Disponibles</h3>
                      <Badge variant="outline" className="text-xs">{filteredProducts.length} productos</Badge>
                    </div>

                    {/* Filtros */}
                    <div className="space-y-3 mb-4 p-3 sm:p-4 bg-muted rounded-lg">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <Filter className="h-4 w-4 text-muted-foreground" />
                          <span className="text-xs sm:text-sm font-medium">Filtros</span>
                        </div>
                        <Button variant="ghost" size="sm" onClick={limpiarFiltros} className="h-7 sm:h-8 text-xs">
                          <X className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
                          <span className="hidden sm:inline">Limpiar</span>
                        </Button>
                      </div>

                      {/* Barra de búsqueda */}
                      <div className="relative">
                        <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                          placeholder="Buscar por nombre o código..."
                          value={searchTerm}
                          onChange={(e) => setSearchTerm(e.target.value)}
                          className="pl-8 text-sm"
                        />
                      </div>

                      {/* Filtros por proveedor y tipo */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <Select value={filterProveedor} onValueChange={setFilterProveedor}>
                          <SelectTrigger className="text-sm">
                            <SelectValue placeholder="Proveedor" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">Todos</SelectItem>
                            {proveedoresConStock.map(([id, proveedor]) => (
                              <SelectItem key={id} value={id}>
                                {proveedor.nombre}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>

                        <Select value={filterTipo} onValueChange={setFilterTipo}>
                          <SelectTrigger className="text-sm">
                            <SelectValue placeholder="Tipo" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">Todos</SelectItem>
                            {tiposUnicos.map((tipo) => (
                              <SelectItem key={tipo} value={tipo}>
                                {tipo}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    {/* Lista de productos filtrados */}
                    <div className="max-h-64 sm:max-h-96 overflow-y-auto space-y-2">
                      {filteredProducts.length === 0 ? (
                        <div className="text-center py-6 sm:py-8 text-muted-foreground">
                          <Search className="h-6 w-6 sm:h-8 sm:w-8 mx-auto mb-2 opacity-50" />
                          <p className="text-sm">No se encontraron productos</p>
                          <p className="text-xs">Intenta ajustar los filtros</p>
                        </div>
                      ) : (
                        filteredProducts.map((producto) => (
                          <div
                            key={producto.id}
                            className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 p-2 sm:p-3 border border-border rounded-lg hover:bg-gray-50"
                          >
                            <div className="flex-1 min-w-0">
                              <div className="font-medium text-sm sm:text-base truncate">{producto.nombre}</div>
                              <div className="text-xs sm:text-sm text-muted-foreground">
                                <span className="font-mono">{producto.codigo}</span> • $
                                {producto.precioVenta?.toFixed(2) || producto.precio?.toFixed(2)} • Stock:{" "}
                                {producto.stock}
                              </div>
                              <div className="flex flex-wrap gap-1 sm:gap-2 mt-1">
                                {producto.tipo && (
                                  <Badge variant="secondary" className="text-xs">
                                    {producto.tipo}
                                  </Badge>
                                )}
                                {proveedores && proveedores[producto.proveedor] && (
                                  <Badge variant="outline" className="text-xs">
                                    {proveedores[producto.proveedor].nombre}
                                  </Badge>
                                )}
                              </div>
                            </div>
                            <Button size="sm" onClick={() => agregarAlCarrito(producto.id)} className="w-full sm:w-auto">
                              Agregar
                            </Button>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  {/* Carrito */}
                  <div className="order-2 lg:order-2">
                    <div className="flex justify-between items-center mb-4">
                      <h3 className="font-semibold text-sm sm:text-base">Carrito de Compras</h3>
                      <Badge variant="outline" className="text-xs">{carrito.length} items</Badge>
                    </div>
                    <div className="space-y-4">
                      <div>
                        <Label htmlFor="cliente" className="text-sm">Cliente</Label>
                        <Input
                          id="cliente"
                          value={cliente}
                          onChange={(e) => setCliente(e.target.value)}
                          placeholder="Nombre del cliente"
                          className="text-sm"
                        />
                      </div>

                      <div className="max-h-48 overflow-y-auto">
                        {carrito.length === 0 ? (
                          <div className="text-center py-6 sm:py-8 text-muted-foreground">
                            <div className="text-3xl sm:text-4xl mb-2">🛒</div>
                            <p className="text-sm">Carrito vacío</p>
                            <p className="text-xs">Agrega productos para comenzar</p>
                          </div>
                        ) : (
                          carrito.map((item) => (
                            <div
                              key={item.id}
                              className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 p-2 border border-border rounded mb-2"
                            >
                              <div className="flex-1 min-w-0">
                                <div className="font-medium text-sm sm:text-base truncate">{item.nombre}</div>
                                <div className="text-xs sm:text-sm text-muted-foreground">
                                  ${item.precio} x {item.cantidad} = ${(item.precio * item.cantidad).toFixed(2)}
                                </div>
                              </div>
                              <div className="flex items-center space-x-2 w-full sm:w-auto">
                                <Input
                                  type="number"
                                  min="1"
                                  max={item.stockDisponible}
                                  value={item.cantidad}
                                  onChange={(e) => actualizarCantidad(item.id, Number.parseInt(e.target.value))}
                                  className="w-20 sm:w-16 text-sm"
                                />
                                <Button size="sm" variant="outline" onClick={() => removerDelCarrito(item.id)} className="flex-1 sm:flex-none">
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                          ))
                        )}
                      </div>

                      <div className="border-t border-border pt-4">
                        <div className="text-lg sm:text-xl font-bold">Total: ${calcularTotal().toFixed(2)}</div>
                      </div>
                    </div>
                  </div>

                  {/* Métodos de Pago Múltiples */}
                  <div className="order-3 lg:order-3">
                    <div className="flex justify-between items-center mb-4">
                      <h3 className="font-semibold flex items-center text-sm sm:text-base">
                        <CreditCard className="h-4 w-4 mr-2" />
                        Métodos de Pago
                      </h3>
                      <Button size="sm" onClick={agregarPago} variant="outline" className="text-xs sm:text-sm">
                        <Plus className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
                        <span className="hidden sm:inline">Agregar Pago</span>
                        <span className="sm:hidden">Agregar</span>
                      </Button>
                    </div>

                    <div className="space-y-4">
                      {pagos.length === 0 ? (
                        <div className="text-center py-6 sm:py-8 text-muted-foreground border-2 border-dashed border-border rounded-lg">
                          <CreditCard className="h-6 w-6 sm:h-8 sm:w-8 mx-auto mb-2 opacity-50" />
                          <p className="text-sm">Sin métodos de pago</p>
                          <p className="text-xs">Agrega al menos un método</p>
                        </div>
                      ) : (
                        <div className="max-h-48 overflow-y-auto space-y-3">
                          {pagos.map((pago, index) => (
                            <div key={index} className="p-2 sm:p-3 border border-border rounded-lg bg-muted">
                              <div className="flex justify-between items-start mb-2">
                                <span className="text-xs sm:text-sm font-medium">Pago #{index + 1}</span>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => removerPago(index)}
                                  className="h-6 w-6 p-0"
                                >
                                  <X className="h-3 w-3 sm:h-4 sm:w-4" />
                                </Button>
                              </div>
                              <div className="space-y-2">
                                <Select
                                  value={pago.metodo}
                                  onValueChange={(value) => actualizarPago(index, "metodo", value)}
                                >
                                  <SelectTrigger className="text-sm">
                                    <SelectValue placeholder="Método de pago" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {metodosPago.map((metodo) => (
                                      <SelectItem key={metodo} value={metodo}>
                                        {metodo.charAt(0).toUpperCase() + metodo.slice(1)}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                                <Input
                                  type="number"
                                  step="0.01"
                                  placeholder="Monto"
                                  value={pago.monto}
                                  onChange={(e) => actualizarPago(index, "monto", e.target.value)}
                                  className="text-sm"
                                />
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Resumen de pagos */}
                      <div className="border-t border-border pt-4 space-y-2">
                        <div className="flex justify-between text-xs sm:text-sm">
                          <span>Total de la venta:</span>
                          <span className="font-bold">${calcularTotal().toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between text-xs sm:text-sm">
                          <span>Total pagado:</span>
                          <span
                            className={`font-bold ${Math.abs(calcularTotal() - calcularTotalPagos()) < 0.01 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}
                          >
                            ${calcularTotalPagos().toFixed(2)}
                          </span>
                        </div>
                        <div className="flex justify-between text-xs sm:text-sm">
                          <span>Diferencia:</span>
                          <span
                            className={`font-bold ${Math.abs(calcularTotal() - calcularTotalPagos()) < 0.01 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}
                          >
                            ${(calcularTotal() - calcularTotalPagos()).toFixed(2)}
                          </span>
                        </div>

                        {Math.abs(calcularTotal() - calcularTotalPagos()) < 0.01 && pagos.length > 0 && (
                          <div className="bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded p-2 text-center">
                            <span className="text-green-800 dark:text-green-200 text-xs sm:text-sm font-medium">
                              ✅ Pagos balanceados
                            </span>
                          </div>
                        )}

                        <Button
                          onClick={procesarVenta}
                          className="w-full mt-4 text-sm sm:text-base"
                          disabled={
                            carrito.length === 0 ||
                            !cliente ||
                            pagos.length === 0 ||
                            Math.abs(calcularTotal() - calcularTotalPagos()) > 0.01
                          }
                        >
                          Procesar Venta
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <CardTitle className="text-lg sm:text-xl">Historial de Ventas</CardTitle>
            <div className="w-full sm:w-auto">
              <ExportButtons 
                data={ventasArray} 
                type="ventas" 
                title="Historial de Ventas"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Vista Desktop - Tabla */}
          <div className="hidden lg:block rounded-md border border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Productos</TableHead>
                  <TableHead>Métodos de Pago</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead>Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {currentItems.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="h-24 text-center">
                      No se encontraron ventas
                    </TableCell>
                  </TableRow>
                ) : (
                  currentItems.map((venta) => (
                    <TableRow key={venta.id}>
                      <TableCell>{new Date(venta.fecha).toLocaleDateString()}</TableCell>
                      <TableCell className="font-medium">{venta.cliente}</TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          {venta.items?.map((item, index) => (
                            <div key={index} className="text-sm">
                              {item.nombre} x{item.cantidad}
                            </div>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          {venta.pagos ? (
                            venta.pagos.map((pago, index) => (
                              <div key={index} className="flex items-center space-x-2">
                                <Badge variant="outline" className="capitalize text-xs">
                                  {pago.metodo}
                                </Badge>
                                <span className="text-xs">${Number.parseFloat(pago.monto).toFixed(2)}</span>
                              </div>
                            ))
                          ) : (
                            <Badge variant="outline" className="capitalize">
                              {venta.metodoPago || "No especificado"}
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="font-bold">${venta.total?.toFixed(2)}</TableCell>
                      <TableCell>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => eliminarVenta(venta.id, venta)}
                          className="text-red-600 dark:text-red-400 hover:text-red-700 hover:border-red-300"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {/* Vista Móvil - Cards */}
          <div className="lg:hidden space-y-4">
            {currentItems.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                No se encontraron ventas
              </div>
            ) : (
              currentItems.map((venta) => (
                <Card key={venta.id}>
                  <CardContent className="p-4">
                    <div className="space-y-3">
                      {/* Header con fecha y total */}
                      <div className="flex justify-between items-start gap-2">
                        <div className="flex-1">
                          <div className="text-xs text-muted-foreground">
                            {new Date(venta.fecha).toLocaleDateString()}
                          </div>
                          <h3 className="font-semibold text-base mt-1">{venta.cliente}</h3>
                        </div>
                        <div className="text-right">
                          <div className="text-lg font-bold">${venta.total?.toFixed(2)}</div>
                        </div>
                      </div>

                      {/* Productos */}
                      <div>
                        <div className="text-xs text-muted-foreground mb-1">Productos:</div>
                        <div className="space-y-1">
                          {venta.items?.map((item: any, index: number) => (
                            <div key={index} className="text-sm">
                              {item.nombre} x{item.cantidad}
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Métodos de pago */}
                      <div>
                        <div className="text-xs text-muted-foreground mb-1">Métodos de Pago:</div>
                        <div className="flex flex-wrap gap-2">
                          {venta.pagos ? (
                            venta.pagos.map((pago: any, index: number) => (
                              <div key={index} className="flex items-center space-x-1">
                                <Badge variant="outline" className="capitalize text-xs">
                                  {pago.metodo}
                                </Badge>
                                <span className="text-xs">${Number.parseFloat(pago.monto).toFixed(2)}</span>
                              </div>
                            ))
                          ) : (
                            <Badge variant="outline" className="capitalize text-xs">
                              {venta.metodoPago || "No especificado"}
                            </Badge>
                          )}
                        </div>
                      </div>

                      {/* Acciones */}
                      <div className="pt-2 border-t">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => eliminarVenta(venta.id, venta)}
                          className="w-full text-red-600 dark:text-red-400 hover:text-red-700 hover:border-red-300"
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Eliminar Venta
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>

          {/* Paginación */}
          {totalPages > 1 && (
            <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} />
          )}
        </CardContent>
      </Card>
    </div>
  )
}
