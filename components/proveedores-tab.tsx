"use client"

import { useState, useEffect } from "react"
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
import { auth } from "@/lib/firebase"
import {
  adjustProductPricesByProvider,
  createProvider,
  deleteProvider,
  loadProviders,
  saveProvider,
  type ProviderCollection,
} from "@/src/services/providers.service"

export default function ProveedoresTab({ proveedores, productos }: { proveedores: any, productos: any }) {
  const { user, isLoading, firebaseAuthReady, firebaseUser } = useAuth()
  const [showDialog, setShowDialog] = useState(false)
  const [showPriceDialog, setShowPriceDialog] = useState(false)
  const [editingProveedor, setEditingProveedor] = useState<string | null>(null)
  const [selectedProveedor, setSelectedProveedor] = useState<string | null>(null)
  const [porcentajeAjuste, setPorcentajeAjuste] = useState("")
  const [tipoAjuste, setTipoAjuste] = useState("aumento") // "aumento" o "reduccion"
  const [proveedoresFirestore, setProveedoresFirestore] = useState<ProviderCollection>(proveedores || {})

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

  useEffect(() => {
    if (isLoading || !firebaseAuthReady || !firebaseUser || !user?.id) {
      return
    }

    const businessId = user.id
    let isMounted = true

    const loadFirestoreProviders = async () => {
      try {
        if (!auth.currentUser) {
          console.warn("Firebase Auth todavía no está listo en proveedores. Se posterga la carga.")
          return
        }

        const loadedProviders = await loadProviders(businessId)
        if (isMounted) {
          setProveedoresFirestore(loadedProviders)
        }
      } catch (error) {
        console.error("Error al cargar proveedores:", error)
      }
    }

    loadFirestoreProviders()

    return () => {
      isMounted = false
    }
  }, [user?.id, isLoading, firebaseAuthReady, firebaseUser?.uid])

  const refreshProviders = async () => {
    if (!user?.id) {
      return
    }

    const businessId = user.id
    if (!firebaseAuthReady || !firebaseUser || !auth.currentUser) {
      console.warn("Firebase Auth todavía no está listo para refrescar proveedores.")
      return
    }

    const loadedProviders = await loadProviders(businessId)
    setProveedoresFirestore(loadedProviders)
  }

  const handleSubmit = async (e: React.FormEvent) => {
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
        await saveProvider(user.id, editingProveedor, proveedorData)
      } else {
        await createProvider(user.id, proveedorData)
      }

      await refreshProviders()
      setShowDialog(false)
      resetForm()
    } catch (error) {
      console.error("Error al guardar proveedor:", error)
    }
  }

  const handleEdit = (id: string, proveedor: any) => {
    setEditingProveedor(id)
    setFormData({
      nombre: proveedor.nombre || "",
      contacto: proveedor.contacto || "",
      telefono: proveedor.telefono || "",
      email: proveedor.email || "",
      direccion: proveedor.direccion || "",
    })
    setShowDialog(true)
  }

  const handleDelete = async (id: string) => {
    if (!user?.id) {
      console.error("Usuario no autenticado")
      return
    }

    if (confirm("¿Estás seguro de eliminar este proveedor?")) {
      try {
        await deleteProvider(user.id, id)
        await refreshProviders()
      } catch (error) {
        console.error("Error al eliminar proveedor:", error)
      }
    }
  }

  const handlePriceAdjustment = async () => {
    if (!selectedProveedor || !porcentajeAjuste || !user?.id) return

    try {
      await adjustProductPricesByProvider(
        user.id,
        productos,
        selectedProveedor,
        tipoAjuste as "aumento" | "reduccion",
        porcentajeAjuste,
      )
      setShowPriceDialog(false)
      setPorcentajeAjuste("")
      setSelectedProveedor(null)
    } catch (error) {
      console.error("Error al ajustar precios:", error)
    }
  }

  const getProductosCount = (proveedorId: string | null) => {
    if (proveedorId === "todos" || !proveedorId) {
      return Object.keys(productos).length
    }
    return Object.values(productos).filter((p: any) => p.proveedor === proveedorId).length
  }

  // Paginación
  const proveedoresArray = Object.entries(proveedoresFirestore || {}).map(([id, proveedor]: [string, any]) => ({
    id,
    ...proveedor,
  }))

  const totalPages = Math.ceil(proveedoresArray.length / itemsPerPage)
  const currentItems = proveedoresArray.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="flex items-center gap-2">
            <CardTitle className="text-lg sm:text-xl">Gestión de Proveedores</CardTitle>
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
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
            <div className="block sm:hidden w-full">
              <ExportButtons 
                data={proveedoresArray} 
                type="proveedores" 
                title="Lista de Proveedores"
              />
            </div>
            <div className="hidden sm:block">
              <ExportButtons 
                data={proveedoresArray} 
                type="proveedores" 
                title="Lista de Proveedores"
              />
            </div>
            <Dialog open={showDialog} onOpenChange={setShowDialog}>
              <DialogTrigger asChild>
                <Button onClick={resetForm} className="w-full sm:w-auto">
                  <Plus className="h-4 w-4 mr-2" />
                  <span className="hidden sm:inline">Nuevo Proveedor</span>
                  <span className="sm:hidden">Nuevo</span>
                </Button>
              </DialogTrigger>
              <DialogContent className="w-[95vw] sm:w-full max-w-md">
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
              className="w-full sm:w-auto"
            >
              <TrendingUp className="h-4 w-4 mr-2" />
              <span className="hidden sm:inline">Ajustar Precios</span>
              <span className="sm:hidden">Ajustar</span>
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {/* Vista Desktop - Tabla */}
        <div className="hidden lg:block rounded-md border">
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

        {/* Vista Móvil - Cards */}
        <div className="lg:hidden space-y-4">
          {currentItems.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              No se encontraron proveedores
            </div>
          ) : (
            currentItems.map((proveedor) => (
              <Card key={proveedor.id}>
                <CardContent className="p-4">
                  <div className="space-y-3">
                    {/* Header con nombre y productos */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-base truncate">{proveedor.nombre}</h3>
                        <p className="text-sm text-muted-foreground mt-1">
                          {getProductosCount(proveedor.id)} productos
                        </p>
                      </div>
                    </div>
                    
                    {/* Información de contacto */}
                    <div className="space-y-2 text-sm">
                      {proveedor.contacto && (
                        <div>
                          <span className="text-muted-foreground">Contacto:</span>
                          <p className="font-medium">{proveedor.contacto}</p>
                        </div>
                      )}
                      {proveedor.telefono && (
                        <div>
                          <span className="text-muted-foreground">Teléfono:</span>
                          <p className="font-medium">{proveedor.telefono}</p>
                        </div>
                      )}
                      {proveedor.email && (
                        <div>
                          <span className="text-muted-foreground">Email:</span>
                          <p className="font-medium truncate">{proveedor.email}</p>
                        </div>
                      )}
                      {proveedor.direccion && (
                        <div>
                          <span className="text-muted-foreground">Dirección:</span>
                          <p className="font-medium">{proveedor.direccion}</p>
                        </div>
                      )}
                    </div>
                    
                    {/* Acciones */}
                    <div className="flex gap-2 pt-2 border-t">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setSelectedProveedor(proveedor.id)
                          setTipoAjuste("aumento")
                          setShowPriceDialog(true)
                        }}
                        className="flex-1"
                      >
                        <TrendingUp className="h-4 w-4 mr-2" />
                        Ajustar
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => handleEdit(proveedor.id, proveedor)}
                        className="flex-1"
                      >
                        <Edit className="h-4 w-4 mr-2" />
                        Editar
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => handleDelete(proveedor.id)}
                        className="flex-1"
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Eliminar
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

        {/* Dialog para ajuste de precios */}
        <Dialog open={showPriceDialog} onOpenChange={setShowPriceDialog}>
          <DialogContent className="w-[95vw] sm:w-full max-w-md">
            <DialogHeader>
              <DialogTitle className="text-lg sm:text-xl">Ajustar Precios por Proveedor</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="p-4 bg-blue-50 dark:bg-blue-950 rounded-lg border border-blue-200 dark:border-blue-800">
                <p className="font-semibold text-blue-800 dark:text-blue-200 text-sm sm:text-base">
                  Proveedor:{" "}
                  {selectedProveedor === "todos"
                    ? "🌟 TODOS LOS PROVEEDORES"
                    : selectedProveedor
                      ? proveedoresFirestore[selectedProveedor]?.nombre
                      : ""}
                </p>
                <p className="text-blue-700 dark:text-blue-300 text-xs sm:text-sm mt-1">
                  Productos afectados: <strong>{selectedProveedor ? getProductosCount(selectedProveedor) : 0}</strong>
                </p>
              </div>

              <Tabs defaultValue="aumento" value={tipoAjuste} onValueChange={setTipoAjuste}>
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="aumento" className="text-xs sm:text-sm">Aumentar Precios</TabsTrigger>
                  <TabsTrigger value="reduccion" className="text-xs sm:text-sm">Reducir Precios</TabsTrigger>
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
                  className="text-base"
                />
                {porcentajeAjuste && (
                  <p className="text-sm text-muted-foreground mt-1">
                    Los precios {tipoAjuste === "aumento" ? "aumentarán" : "se reducirán"} un {porcentajeAjuste}%
                  </p>
                )}
              </div>

              <div className="flex flex-col sm:flex-row gap-2">
                <Button onClick={handlePriceAdjustment} className="flex-1" disabled={!porcentajeAjuste}>
                  {tipoAjuste === "aumento" ? <>🚀 Aplicar Aumento</> : <>📉 Aplicar Reducción</>}
                </Button>
                <Button variant="outline" onClick={() => setShowPriceDialog(false)} className="w-full sm:w-auto">
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
