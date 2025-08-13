"use client"

import { useState, useEffect } from "react"
import { ref, push, set, remove, update } from "firebase/database"
import { database } from "@/lib/firebase"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Plus, Edit, Trash2, TrendingUp } from "lucide-react"
import { Pagination } from "@/components/ui/pagination"
import ExportButtons from "./export-buttons"
import HelpTooltip from "./help-tooltip"
import { useAuth } from "@/contexts/auth-context"

export default function ProveedoresTab({ proveedores, productos }) {
  const { user } = useAuth()
  const [showDialog, setShowDialog] = useState(false)
  const [showPriceDialog, setShowPriceDialog] = useState(false)
  const [editingProveedor, setEditingProveedor] = useState(null)
  const [selectedProveedor, setSelectedProveedor] = useState(null)
  const [porcentajeAjuste, setPorcentajeAjuste] = useState("")
  const [tipoAjuste, setTipoAjuste] = useState("aumento") // "aumento" o "reduccion"

  // Paginación
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 10

  const [formData, setFormData] = useState({
    nombre: "",
    contacto: "",
    telefono: "",
    email: "",
    direccion: "",
  })

  const resetForm = () => {
    setFormData({
      nombre: "",
      contacto: "",
      telefono: "",
      email: "",
      direccion: "",
    })
    setEditingProveedor(null)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    if (!user?.id) {
      console.error("Usuario no autenticado")
      return
    }

    const proveedorData = {
      ...formData,
      usuarioId: user.id, // Agregar ID del usuario
    }

    try {
      if (editingProveedor) {
        await set(ref(database, `usuarios/${user.id}/proveedores/${editingProveedor}`), proveedorData)
      } else {
        await push(ref(database, `usuarios/${user.id}/proveedores`), proveedorData)
      }

      setShowDialog(false)
      resetForm()
    } catch (error) {
      console.error("Error al guardar proveedor:", error)
    }
  }

  const handleEdit = (id, proveedor) => {
    setEditingProveedor(id)
    setFormData(proveedor)
    setShowDialog(true)
  }

  const handleDelete = async (id) => {
    if (!user?.id) {
      console.error("Usuario no autenticado")
      return
    }

    if (confirm("¿Estás seguro de eliminar este proveedor?")) {
      try {
        await remove(ref(database, `usuarios/${user.id}/proveedores/${id}`))
      } catch (error) {
        console.error("Error al eliminar proveedor:", error)
      }
    }
  }

  const handlePriceAdjustment = async () => {
    if (!selectedProveedor || !porcentajeAjuste || !user?.id) return

    const porcentaje = Number.parseFloat(porcentajeAjuste) / 100
    const factor = tipoAjuste === "aumento" ? 1 + porcentaje : 1 - porcentaje

    let productosAfectados = []

    if (selectedProveedor === "todos") {
      // Actualizar TODOS los productos del usuario
      productosAfectados = Object.entries(productos)
    } else {
      // Actualizar solo productos del proveedor seleccionado
      productosAfectados = Object.entries(productos).filter(
        ([id, producto]) => producto.proveedor === selectedProveedor,
      )
    }

    try {
      const updates = {}
      productosAfectados.forEach(([id, producto]) => {
        updates[`usuarios/${user.id}/productos/${id}/precioVenta`] = producto.precioVenta * factor
      })

      await update(ref(database), updates)
      setShowPriceDialog(false)
      setPorcentajeAjuste("")
      setSelectedProveedor(null)
    } catch (error) {
      console.error("Error al ajustar precios:", error)
    }
  }

  const getProductosCount = (proveedorId) => {
    if (proveedorId === "todos") {
      return Object.keys(productos).length
    }
    return Object.values(productos).filter((p) => p.proveedor === proveedorId).length
  }

  // Paginación
  const proveedoresArray = Object.entries(proveedores).map(([id, proveedor]) => ({
    id,
    ...proveedor,
  }))

  const totalPages = Math.ceil(proveedoresArray.length / itemsPerPage)
  const currentItems = proveedoresArray.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2">
            <CardTitle>Gestión de Proveedores</CardTitle>
            <HelpTooltip
              title="Ayuda - Gestión de Proveedores"
              content={
                <div className="space-y-3">
                  <div>
                    <h4 className="font-semibold text-blue-600">¿Qué puedes hacer aquí?</h4>
                    <ul className="list-disc list-inside space-y-1 mt-2">
                      <li><strong>Crear proveedores:</strong> Agrega nuevos proveedores al sistema</li>
                      <li><strong>Editar información:</strong> Actualiza datos de contacto y dirección</li>
                      <li><strong>Gestionar productos:</strong> Asocia productos con proveedores</li>
                      <li><strong>Ajustar precios:</strong> Modifica precios masivamente por proveedor</li>
                      <li><strong>Exportar datos:</strong> Descarga la lista en PDF, Excel o CSV</li>
                    </ul>
                  </div>
                  <div>
                    <h4 className="font-semibold text-green-600">Funcionalidades principales:</h4>
                    <ul className="list-disc list-inside space-y-1 mt-2">
                      <li><strong>Información completa:</strong> Nombre, contacto, teléfono, email, dirección</li>
                      <li><strong>Productos asociados:</strong> Ver cuántos productos tiene cada proveedor</li>
                      <li><strong>Ajuste de precios:</strong> Aumentar o reducir precios por proveedor</li>
                      <li><strong>Gestión centralizada:</strong> Control total de proveedores</li>
                    </ul>
                  </div>
                  <div className="bg-blue-50 p-3 rounded-lg">
                    <p className="text-sm text-blue-800">
                      <strong>💡 Tip:</strong> Usa la función de ajuste de precios para actualizar rápidamente los precios de todos los productos de un proveedor específico.
                    </p>
                  </div>
                </div>
              }
            />
          </div>
          <div className="flex flex-col sm:flex-row gap-2">
            <ExportButtons 
              data={proveedoresArray} 
              type="proveedores" 
              title="Lista de Proveedores"
            />
            <Dialog open={showDialog} onOpenChange={setShowDialog}>
              <DialogTrigger asChild>
                <Button onClick={resetForm}>
                  <Plus className="h-4 w-4 mr-2" />
                  Nuevo Proveedor
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{editingProveedor ? "Editar Proveedor" : "Nuevo Proveedor"}</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <Label htmlFor="nombre">Nombre de la Empresa</Label>
                    <Input
                      id="nombre"
                      value={formData.nombre}
                      onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="contacto">Persona de Contacto</Label>
                    <Input
                      id="contacto"
                      value={formData.contacto}
                      onChange={(e) => setFormData({ ...formData, contacto: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="telefono">Teléfono</Label>
                    <Input
                      id="telefono"
                      value={formData.telefono}
                      onChange={(e) => setFormData({ ...formData, telefono: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="direccion">Dirección</Label>
                    <Input
                      id="direccion"
                      value={formData.direccion}
                      onChange={(e) => setFormData({ ...formData, direccion: e.target.value })}
                    />
                  </div>
                  <Button type="submit" className="w-full">
                    {editingProveedor ? "Actualizar" : "Crear"} Proveedor
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
            <Button
              variant="outline"
              onClick={() => {
                setSelectedProveedor("todos")
                setTipoAjuste("aumento")
                setShowPriceDialog(true)
              }}
              className="flex-1 sm:flex-none"
            >
              <TrendingUp className="h-4 w-4 mr-2" />
              Ajustar Precios
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead>Contacto</TableHead>
                <TableHead>Teléfono</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Productos</TableHead>
                <TableHead>Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {currentItems.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-24 text-center">
                    No se encontraron proveedores
                  </TableCell>
                </TableRow>
              ) : (
                currentItems.map((proveedor) => (
                  <TableRow key={proveedor.id}>
                    <TableCell className="font-medium">{proveedor.nombre}</TableCell>
                    <TableCell>{proveedor.contacto}</TableCell>
                    <TableCell>{proveedor.telefono}</TableCell>
                    <TableCell>{proveedor.email}</TableCell>
                    <TableCell>{getProductosCount(proveedor.id)} productos</TableCell>
                    <TableCell>
                      <div className="flex space-x-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setSelectedProveedor(proveedor.id)
                            setTipoAjuste("aumento")
                            setShowPriceDialog(true)
                          }}
                        >
                          <TrendingUp className="h-4 w-4" />
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => handleEdit(proveedor.id, proveedor)}>
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => handleDelete(proveedor.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
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

        {/* Dialog para ajuste de precios */}
        <Dialog open={showPriceDialog} onOpenChange={setShowPriceDialog}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Ajustar Precios por Proveedor</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="p-4 bg-blue-50 dark:bg-blue-950 rounded-lg border border-blue-200 dark:border-blue-800">
                <p className="font-semibold text-blue-800 dark:text-blue-200">
                  Proveedor:{" "}
                  {selectedProveedor === "todos" ? "🌟 TODOS LOS PROVEEDORES" : proveedores[selectedProveedor]?.nombre}
                </p>
                <p className="text-blue-700 dark:text-blue-300">
                  Productos afectados: <strong>{selectedProveedor ? getProductosCount(selectedProveedor) : 0}</strong>
                </p>
              </div>

              <Tabs defaultValue="aumento" value={tipoAjuste} onValueChange={setTipoAjuste}>
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="aumento">Aumentar Precios</TabsTrigger>
                  <TabsTrigger value="reduccion">Reducir Precios</TabsTrigger>
                </TabsList>
              </Tabs>

              <div>
                <Label htmlFor="porcentaje">
                  Porcentaje de {tipoAjuste === "aumento" ? "Aumento" : "Reducción"} (%)
                </Label>
                <Input
                  id="porcentaje"
                  type="number"
                  step="0.1"
                  value={porcentajeAjuste}
                  onChange={(e) => setPorcentajeAjuste(e.target.value)}
                  placeholder={`ej: 20 para 20% de ${tipoAjuste === "aumento" ? "aumento" : "reducción"}`}
                />
                {porcentajeAjuste && (
                  <p className="text-sm text-muted-foreground mt-1">
                    Los precios {tipoAjuste === "aumento" ? "aumentarán" : "se reducirán"} un {porcentajeAjuste}%
                  </p>
                )}
              </div>

              <div className="flex space-x-2">
                <Button onClick={handlePriceAdjustment} className="flex-1" disabled={!porcentajeAjuste}>
                  {tipoAjuste === "aumento" ? <>🚀 Aplicar Aumento</> : <>📉 Aplicar Reducción</>}
                </Button>
                <Button variant="outline" onClick={() => setShowPriceDialog(false)}>
                  Cancelar
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  )
}
