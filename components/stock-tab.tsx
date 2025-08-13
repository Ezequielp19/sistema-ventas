"use client"

import { useState, useEffect } from "react"
import { ref, update } from "firebase/database"
import { database } from "@/lib/firebase"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Plus, Package, ChevronDown, ChevronUp, X } from "lucide-react"
import { Pagination } from "@/components/ui/pagination"
import HelpTooltip from "./help-tooltip"

export default function StockTab({ productos, stockBajo }) {
  const [showDialog, setShowDialog] = useState(false)
  const [selectedProduct, setSelectedProduct] = useState(null)
  const [cantidadAgregar, setCantidadAgregar] = useState("")
  const [stockAlertsMinimized, setStockAlertsMinimized] = useState(false)

  // Filtros
  const [filterEstado, setFilterEstado] = useState("")
  const [filterStock, setFilterStock] = useState("")

  // Paginación
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 10

  const handleAddStock = async () => {
    if (!selectedProduct || !cantidadAgregar) return

    const cantidad = Number.parseInt(cantidadAgregar)
    const nuevoStock = productos[selectedProduct].stock + cantidad

    try {
      await update(ref(database), {
        [`productos/${selectedProduct}/stock`]: nuevoStock,
      })

      setShowDialog(false)
      setSelectedProduct(null)
      setCantidadAgregar("")
    } catch (error) {
      console.error("Error al actualizar stock:", error)
    }
  }

  const limpiarFiltros = () => {
    setFilterEstado("")
    setFilterStock("")
  }

  const productosArray = Object.entries(productos).map(([id, producto]) => ({
    id,
    ...producto,
  }))

  // Filtrar productos
  const filteredProducts = productosArray.filter((producto) => {
    // Filtro por estado
    let matchesEstado = true
    if (filterEstado === "disponible") {
      matchesEstado = producto.stock > producto.stockMinimo
    } else if (filterEstado === "stock-bajo") {
      matchesEstado = producto.stock <= producto.stockMinimo
    }

    // Filtro por cantidad de stock
    let matchesStock = true
    if (filterStock === "sin-stock") {
      matchesStock = producto.stock === 0
    } else if (filterStock === "poco-stock") {
      matchesStock = producto.stock > 0 && producto.stock <= 5
    } else if (filterStock === "stock-normal") {
      matchesStock = producto.stock > 5
    }

    return matchesEstado && matchesStock
  })

  // Paginación
  const totalPages = Math.ceil(filteredProducts.length / itemsPerPage)
  const currentItems = filteredProducts.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)

  // Cuando cambian los filtros, volver a la primera página
  useEffect(() => {
    setCurrentPage(1)
  }, [filterEstado, filterStock])

  return (
    <div className="space-y-6">
      {/* Alertas de Stock Bajo con opción de minimizar/maximizar */}
      {stockBajo.length > 0 && (
        <Card className="border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950">
          <CardHeader className="pb-3">
            <div className="flex justify-between items-center">
              <CardTitle className="text-red-800 dark:text-red-200 flex items-center">
                <Package className="h-5 w-5 mr-2" />
                Productos con Stock Bajo ({stockBajo.length})
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
              <div className="grid gap-4">
                {stockBajo.map((producto) => (
                  <div key={producto.id} className="flex justify-between items-center p-4 bg-card rounded border">
                    <div>
                      <h3 className="font-semibold">{producto.nombre}</h3>
                      <p className="text-sm text-muted-foreground">
                        Stock actual: {producto.stock} | Mínimo: {producto.stockMinimo}
                      </p>
                    </div>
                    <Button
                      onClick={() => {
                        setSelectedProduct(producto.id)
                        setShowDialog(true)
                      }}
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Reponer Stock
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          )}
        </Card>
      )}

      {/* Control de Stock General */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-2">
              <CardTitle>Control de Stock General</CardTitle>
              <HelpTooltip
                title="Ayuda - Control de Stock"
                content={
                  <div className="space-y-3">
                    <div>
                      <h4 className="font-semibold text-blue-600">¿Qué puedes hacer aquí?</h4>
                      <ul className="list-disc list-inside space-y-1 mt-2">
                        <li><strong>Monitorear stock:</strong> Controla el inventario en tiempo real</li>
                        <li><strong>Alertas automáticas:</strong> Productos con stock bajo destacados</li>
                        <li><strong>Reponer stock:</strong> Agrega inventario fácilmente</li>
                        <li><strong>Filtrar productos:</strong> Por estado y cantidad de stock</li>
                        <li><strong>Gestión preventiva:</strong> Evita quedarte sin productos</li>
                      </ul>
                    </div>
                    <div>
                      <h4 className="font-semibold text-green-600">Estados de stock:</h4>
                      <ul className="list-disc list-inside space-y-1 mt-2">
                        <li><strong>Sin Stock:</strong> Productos con 0 unidades</li>
                        <li><strong>Stock Bajo:</strong> Por debajo del mínimo establecido</li>
                        <li><strong>Stock Medio:</strong> Entre el mínimo y el doble</li>
                        <li><strong>Stock Bueno:</strong> Más del doble del mínimo</li>
                      </ul>
                    </div>
                    <div className="bg-blue-50 p-3 rounded-lg">
                      <p className="text-sm text-blue-800">
                        <strong>💡 Tip:</strong> Mantén actualizado el stock mínimo de cada producto para recibir alertas automáticas cuando necesites reponer.
                      </p>
                    </div>
                  </div>
                }
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Filtros */}
          <div className="flex flex-col sm:flex-row gap-4 mb-6">
            <div className="flex flex-col sm:flex-row gap-2 flex-1">
              <Select value={filterEstado} onValueChange={setFilterEstado}>
                <SelectTrigger className="w-full sm:w-48">
                  <SelectValue placeholder="Filtrar por estado" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los estados</SelectItem>
                  <SelectItem value="disponible">Disponible</SelectItem>
                  <SelectItem value="stock-bajo">Stock Bajo</SelectItem>
                </SelectContent>
              </Select>

              <Select value={filterStock} onValueChange={setFilterStock}>
                <SelectTrigger className="w-full sm:w-48">
                  <SelectValue placeholder="Filtrar por cantidad" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas las cantidades</SelectItem>
                  <SelectItem value="sin-stock">Sin Stock (0)</SelectItem>
                  <SelectItem value="poco-stock">Poco Stock (1-5)</SelectItem>
                  <SelectItem value="stock-normal">Stock Normal (6+)</SelectItem>
                </SelectContent>
              </Select>

              {(filterEstado || filterStock) && (
                <Button variant="outline" onClick={limpiarFiltros} className="w-full sm:w-auto bg-transparent">
                  <X className="h-4 w-4 mr-2" />
                  Limpiar filtros
                </Button>
              )}
            </div>
          </div>

          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Producto</TableHead>
                  <TableHead>Stock Actual</TableHead>
                  <TableHead>Stock Mínimo</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {currentItems.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="h-24 text-center">
                      No se encontraron productos
                    </TableCell>
                  </TableRow>
                ) : (
                  currentItems.map((producto) => (
                    <TableRow key={producto.id}>
                      <TableCell className="font-medium">{producto.nombre}</TableCell>
                      <TableCell>{producto.stock}</TableCell>
                      <TableCell>{producto.stockMinimo}</TableCell>
                      <TableCell>
                        {producto.stock === 0 ? (
                          <Badge variant="destructive">Sin Stock</Badge>
                        ) : producto.stock <= producto.stockMinimo ? (
                          <Badge variant="destructive">Stock Bajo</Badge>
                        ) : producto.stock <= producto.stockMinimo * 2 ? (
                          <Badge variant="secondary">Stock Medio</Badge>
                        ) : (
                          <Badge variant="default">Stock Bueno</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setSelectedProduct(producto.id)
                            setShowDialog(true)
                          }}
                        >
                          <Package className="h-4 w-4 mr-2" />
                          Reponer
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {/* Paginación */}
          {totalPages > 1 && (
            <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} />
          )}
        </CardContent>
      </Card>

      {/* Dialog para agregar stock */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Reponer Stock</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {selectedProduct && (
              <>
                <div>
                  <p>
                    <strong>Producto:</strong> {productos[selectedProduct]?.nombre}
                  </p>
                  <p>
                    <strong>Stock actual:</strong> {productos[selectedProduct]?.stock}
                  </p>
                  <p>
                    <strong>Stock mínimo:</strong> {productos[selectedProduct]?.stockMinimo}
                  </p>
                </div>
                <div>
                  <Label htmlFor="cantidad">Cantidad a agregar</Label>
                  <Input
                    id="cantidad"
                    type="number"
                    min="1"
                    value={cantidadAgregar}
                    onChange={(e) => setCantidadAgregar(e.target.value)}
                    placeholder="Ingrese la cantidad"
                  />
                </div>
                {cantidadAgregar && (
                  <div className="p-4 bg-muted rounded">
                    <p>
                      <strong>Nuevo stock:</strong>{" "}
                      {productos[selectedProduct]?.stock + Number.parseInt(cantidadAgregar || 0)}
                    </p>
                  </div>
                )}
                <div className="flex space-x-2">
                  <Button onClick={handleAddStock} className="flex-1">
                    Confirmar Reposición
                  </Button>
                  <Button variant="outline" onClick={() => setShowDialog(false)}>
                    Cancelar
                  </Button>
                </div>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
