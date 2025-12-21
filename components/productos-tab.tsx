"use client"

import { useState, useEffect, useRef } from "react"
import { ref, set, remove, get } from "firebase/database"
import { ref as storageRef, uploadBytes as uploadStorageBytes, getDownloadURL as getStorageDownloadURL } from "firebase/storage"
import { database, storage } from "@/lib/firebase"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Plus, Edit, Trash2, Search, X, Image, Upload } from "lucide-react"
import { Pagination } from "@/components/ui/pagination"
import ExportButtons from "./export-buttons"
import HelpTooltip from "./help-tooltip"
import { useAuth } from "@/contexts/auth-context"
import { useToast } from "@/hooks/use-toast"

export default function ProductosTab({ proveedores }) {
  const { user } = useAuth()
  const { toast } = useToast()
  const [productos, setProductos] = useState({})
  const [showDialog, setShowDialog] = useState(false)
  const [editingProduct, setEditingProduct] = useState(null)
  const [searchTerm, setSearchTerm] = useState("")
  const [filterProveedor, setFilterProveedor] = useState("")
  const [filterTipo, setFilterTipo] = useState("")
  const [uploadingImage, setUploadingImage] = useState(false)
  const [selectedImages, setSelectedImages] = useState<File[]>([])
  const [imagePreviews, setImagePreviews] = useState<string[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Paginación
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 10

  const [formData, setFormData] = useState({
    nombre: "",
    descripcion: "",
    // Precio de Compra eliminado
    precioVenta: "", // Solo se mantiene el precio de venta
    stock: "",
    stockMinimo: "",
    proveedor: "",
    tipo: "",
    codigo: "",
    imagenes: [] as string[],
  })

  const resetForm = () => {
    setFormData({
      nombre: "",
      descripcion: "",
      // Precio de Compra eliminado
      precioVenta: "",
      stock: "",
      stockMinimo: "",
      proveedor: "",
      tipo: "",
      codigo: "",
      imagenes: [],
    })
    setEditingProduct(null)
    setSelectedImages([])
    setImagePreviews([])
    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
  }

  const handleImageSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files
    if (!files || files.length === 0) return

    const newFiles: File[] = []
    const newPreviews: string[] = []

    Array.from(files).forEach((file) => {
      // Validar tipo de archivo
      if (!file.type.startsWith('image/')) {
        toast({
          title: "Error",
          description: `${file.name} no es un archivo de imagen válido`,
          variant: "destructive"
        })
        return
      }
      // Validar tamaño (máximo 5MB)
      if (file.size > 5 * 1024 * 1024) {
        toast({
          title: "Error",
          description: `${file.name} es demasiado grande. Máximo 5MB`,
          variant: "destructive"
        })
        return
      }
      newFiles.push(file)
      const reader = new FileReader()
      reader.onload = (e) => {
        const result = e.target?.result
        if (typeof result === 'string') {
          newPreviews.push(result)
          if (newPreviews.length === newFiles.length) {
            setSelectedImages(prev => [...prev, ...newFiles])
            setImagePreviews(prev => [...prev, ...newPreviews])
          }
        }
      }
      reader.readAsDataURL(file)
    })

    // Limpiar el input para permitir seleccionar el mismo archivo nuevamente
    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
  }

  const handleImageUpload = async (files: File[]): Promise<string[]> => {
    if (!files || files.length === 0 || !user?.id) return []
    
    setUploadingImage(true)
    const uploadPromises = files.map(async (file) => {
      try {
        const imageRef = storageRef(storage, `productos/${user.id}/${Date.now()}_${file.name}`)
        const snapshot = await uploadStorageBytes(imageRef, file)
        const downloadURL = await getStorageDownloadURL(snapshot.ref)
        return downloadURL
      } catch (error) {
        console.error("Error al subir imagen:", error)
        toast({
          title: "Error",
          description: `No se pudo subir ${file.name}`,
          variant: "destructive"
        })
        return null
      }
    })

    const urls = await Promise.all(uploadPromises)
    setUploadingImage(false)
    return urls.filter((url): url is string => url !== null)
  }

  const generarIdProducto = () => {
    // Genera un id único simple (puedes usar uuid si lo prefieres)
    return "prod_" + Math.random().toString(36).substr(2, 9)
  }

  // Cargar productos desde Firebase
  const cargarProductos = async () => {
    if (!user?.id) return
    const productosRef = ref(database, `tiendas/${user.id}/productos`)
    const snapshot = await get(productosRef)
    if (snapshot.exists()) {
      setProductos(snapshot.val())
    } else {
      setProductos({})
    }
  }

  useEffect(() => {
    cargarProductos()
  }, [user?.id])

  // Filtrar productos
  const productosArray = Object.entries(productos).map(([id, producto]) => ({
    id,
    ...producto,
  }))

  const filteredProducts = productosArray.filter((producto) => {
    const matchesSearch =
      producto.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
      producto.codigo?.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesProveedor = !filterProveedor || filterProveedor === "all" || producto.proveedor === filterProveedor
    const matchesTipo = !filterTipo || filterTipo === "all" || producto.tipo === filterTipo

    return matchesSearch && matchesProveedor && matchesTipo
  })

  // Paginación
  const totalPages = Math.ceil(filteredProducts.length / itemsPerPage)
  const currentItems = filteredProducts.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)

  // Cuando cambian los filtros, volver a la primera página
  useEffect(() => {
    setCurrentPage(1)
  }, [searchTerm, filterProveedor, filterTipo])

  // Obtener tipos únicos
  const tiposUnicos = [...new Set(productosArray.map((p) => p.tipo).filter(Boolean))]

  const handleSubmit = async (e) => {
    e.preventDefault()

    if (!user?.id) {
      toast({
        title: "Error",
        description: "Usuario no autenticado",
        variant: "destructive"
      })
      return
    }

    // Validación de campos obligatorios
    if (
      !formData.nombre.trim() ||
      !formData.codigo.trim() ||
      !formData.tipo.trim() ||
      !formData.precioVenta ||
      isNaN(Number(formData.precioVenta)) ||
      !formData.stock ||
      isNaN(Number(formData.stock)) ||
      !formData.stockMinimo ||
      isNaN(Number(formData.stockMinimo))
    ) {
      toast({
        title: "Error",
        description: "Completa todos los campos obligatorios correctamente.",
        variant: "destructive"
      })
      return
    }

    let imagenesURLs = formData.imagenes || []
    
    // Subir imágenes nuevas si hay alguna seleccionada
    if (selectedImages.length > 0) {
      const nuevasURLs = await handleImageUpload(selectedImages)
      imagenesURLs = [...imagenesURLs, ...nuevasURLs]
    }

    const productId = editingProduct || generarIdProducto()
    const productData = {
      ...formData,
      precioVenta: Number.parseFloat(formData.precioVenta),
      stock: Number.parseInt(formData.stock),
      stockMinimo: Number.parseInt(formData.stockMinimo),
      proveedor: formData.proveedor || null, // Guardar null si no hay proveedor
      imagenes: imagenesURLs.length > 0 ? imagenesURLs : null, // Guardar array de imágenes o null
      imagen: imagenesURLs[0] || null, // Mantener compatibilidad con campo imagen (primera imagen)
      activo: true, // Por defecto los productos están activos
      fechaCreacion: new Date().toISOString(),
      usuarioId: user.id,
      id: productId,
    }

    try {
      await set(ref(database, `tiendas/${user.id}/productos/${productId}`), productData)
      toast({
        title: "Éxito",
        description: editingProduct ? "Producto actualizado correctamente" : "Producto creado correctamente"
      })
      setShowDialog(false)
      resetForm()
      await cargarProductos()
    } catch (error) {
      toast({
        title: "Error",
        description: "Error al guardar producto: " + error.message,
        variant: "destructive"
      })
      console.error("Error al guardar producto:", error)
    }
  }

  const handleEdit = (id, producto) => {
    setEditingProduct(id)
    // Asegurarse de que los campos de precio de compra y venta estén presentes
    const productToEdit = {
      ...producto,
      // precioCompra: producto.precioCompra || producto.precio, // Eliminado
      precioVenta: producto.precioVenta || producto.precio, // Asegurarse de que se use este
      proveedor: producto.proveedor || "", // Asegurar que sea string vacío si no hay proveedor
      imagenes: producto.imagenes || (producto.imagen ? [producto.imagen] : []), // Convertir imagen única a array si es necesario
    }
    setFormData(productToEdit)
    setImagePreviews(producto.imagenes || (producto.imagen ? [producto.imagen] : []))
    setSelectedImages([])
    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
    setShowDialog(true)
  }

  const handleDelete = async (id) => {
    if (!user?.id) {
      console.error("Usuario no autenticado")
      return
    }

    if (confirm("¿Estás seguro de eliminar este producto?")) {
      try {
        await remove(ref(database, `tiendas/${user.id}/productos/${id}`))
        await cargarProductos() // Recargar productos después de eliminar
      } catch (error) {
        console.error("Error al eliminar producto:", error)
      }
    }
  }

  // Limpiar filtros
  const limpiarFiltros = () => {
    setSearchTerm("")
    setFilterProveedor("")
    setFilterTipo("")
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="flex items-center gap-2">
            <CardTitle className="text-lg sm:text-xl">Gestión de Productos</CardTitle>
            <HelpTooltip
              title="Ayuda - Gestión de Productos"
              content={
                <div className="space-y-3">
                  <div>
                    <h4 className="font-semibold text-blue-600">¿Qué puedes hacer aquí?</h4>
                    <ul className="list-disc list-inside space-y-1 mt-2">
                      <li><strong>Crear productos:</strong> Agrega nuevos productos al catálogo</li>
                      <li><strong>Editar productos:</strong> Modifica información existente</li>
                      <li><strong>Gestionar stock:</strong> Controla inventario y stock mínimo</li>
                      <li><strong>Filtrar y buscar:</strong> Encuentra productos rápidamente</li>
                      <li><strong>Exportar datos:</strong> Descarga el catálogo en PDF, Excel o CSV</li>
                    </ul>
                  </div>
                  <div>
                    <h4 className="font-semibold text-green-600">Funcionalidades principales:</h4>
                    <ul className="list-disc list-inside space-y-1 mt-2">
                      <li><strong>Búsqueda:</strong> Por nombre o código de producto</li>
                      <li><strong>Filtros:</strong> Por proveedor y tipo de producto</li>
                      <li><strong>Stock:</strong> Control automático de inventario</li>
                      <li><strong>Precios:</strong> Gestión de precios de venta</li>
                      <li><strong>Proveedores:</strong> Asociación con proveedores</li>
                    </ul>
                  </div>
                  <div className="bg-blue-50 p-3 rounded-lg">
                    <p className="text-sm text-blue-800">
                      <strong>💡 Tip:</strong> Usa los filtros para organizar mejor tu catálogo y mantén actualizado el stock mínimo para recibir alertas automáticas.
                    </p>
                  </div>
                </div>
              }
            />
          </div>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
            <div className="block sm:hidden w-full">
              <ExportButtons 
                data={productosArray} 
                type="productos" 
                title="Catálogo de Productos"
              />
            </div>
            <div className="hidden sm:block">
              <ExportButtons 
                data={productosArray} 
                type="productos" 
                title="Catálogo de Productos"
              />
            </div>
            <Dialog open={showDialog} onOpenChange={setShowDialog}>
              <DialogTrigger asChild>
                <Button onClick={resetForm} className="w-full sm:w-auto">
                  <Plus className="h-4 w-4 mr-2" />
                  <span className="hidden sm:inline">Nuevo Producto</span>
                  <span className="sm:hidden">Nuevo</span>
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto w-[95vw] sm:w-full">
                <DialogHeader>
                  <DialogTitle>
                    {editingProduct ? "Editar Producto" : "Nuevo Producto"}
                  </DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="codigo">Código</Label>
                      <Input
                        id="codigo"
                        value={formData.codigo}
                        onChange={(e) => setFormData({ ...formData, codigo: e.target.value })}
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor="nombre">Nombre</Label>
                      <Input
                        id="nombre"
                        value={formData.nombre}
                        onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                        required
                      />
                    </div>
                  </div>
                  
                  <div>
                    <Label htmlFor="descripcion">Descripción</Label>
                    <Input
                      id="descripcion"
                      value={formData.descripcion}
                      onChange={(e) => setFormData({ ...formData, descripcion: e.target.value })}
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="tipo">Tipo</Label>
                      <Input
                        id="tipo"
                        value={formData.tipo}
                        onChange={(e) => setFormData({ ...formData, tipo: e.target.value })}
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor="proveedor">Proveedor (Opcional)</Label>
                      <Select value={formData.proveedor || ""} onValueChange={(value) => setFormData({ ...formData, proveedor: value === "none" ? "" : value })}>
                        <SelectTrigger>
                          <SelectValue placeholder="Seleccionar proveedor (opcional)" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Sin proveedor</SelectItem>
                          {Object.entries(proveedores).map(([id, proveedor]) => (
                            <SelectItem key={id} value={id}>
                              {proveedor.nombre}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <Label htmlFor="precioVenta">Precio Venta</Label>
                      <Input
                        id="precioVenta"
                        type="number"
                        step="0.01"
                        value={formData.precioVenta}
                        onChange={(e) => setFormData({ ...formData, precioVenta: e.target.value })}
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor="stock">Stock</Label>
                      <Input
                        id="stock"
                        type="number"
                        value={formData.stock}
                        onChange={(e) => setFormData({ ...formData, stock: e.target.value })}
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor="stockMinimo">Stock Mínimo</Label>
                      <Input
                        id="stockMinimo"
                        type="number"
                        value={formData.stockMinimo}
                        onChange={(e) => setFormData({ ...formData, stockMinimo: e.target.value })}
                        required
                      />
                    </div>
                  </div>

                  {/* Campo de imágenes */}
                  <div>
                    <Label htmlFor="imagenes">Imágenes del Producto (Opcional)</Label>
                    <div className="space-y-2">
                      {(imagePreviews.length > 0 || formData.imagenes?.length > 0) && (
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                          {formData.imagenes?.map((img, index) => (
                            <div key={`existing-${index}`} className="relative w-full h-32 border rounded-lg overflow-hidden">
                              <img
                                src={img}
                                alt={`Imagen ${index + 1}`}
                                className="w-full h-full object-cover"
                              />
                              <Button
                                type="button"
                                variant="destructive"
                                size="sm"
                                className="absolute top-1 right-1 h-6 w-6 p-0"
                                onClick={() => {
                                  const newImagenes = formData.imagenes?.filter((_, i) => i !== index) || []
                                  setFormData({ ...formData, imagenes: newImagenes })
                                }}
                              >
                                <X className="h-3 w-3" />
                              </Button>
                            </div>
                          ))}
                          {imagePreviews.map((preview, index) => (
                            <div key={`preview-${index}`} className="relative w-full h-32 border rounded-lg overflow-hidden">
                              <img
                                src={preview}
                                alt={`Vista previa ${index + 1}`}
                                className="w-full h-full object-cover"
                              />
                              <Button
                                type="button"
                                variant="destructive"
                                size="sm"
                                className="absolute top-1 right-1 h-6 w-6 p-0"
                                onClick={() => {
                                  const newPreviews = imagePreviews.filter((_, i) => i !== index)
                                  const newSelected = selectedImages.filter((_, i) => i !== index)
                                  setImagePreviews(newPreviews)
                                  setSelectedImages(newSelected)
                                }}
                              >
                                <X className="h-3 w-3" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      )}
                      <div className="flex items-center gap-2">
                        <Input
                          id="imagenes"
                          type="file"
                          accept="image/*"
                          multiple
                          ref={fileInputRef}
                          onChange={handleImageSelect}
                          className="hidden"
                        />
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => fileInputRef.current?.click()}
                          disabled={uploadingImage}
                          className="flex-1"
                        >
                          {uploadingImage ? (
                            <>
                              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary mr-2"></div>
                              Subiendo...
                            </>
                          ) : (
                            <>
                              <Upload className="h-4 w-4 mr-2" />
                              Agregar Imágenes
                            </>
                          )}
                        </Button>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Formatos soportados: JPG, PNG, GIF. Tamaño máximo: 5MB por imagen. Puedes seleccionar múltiples imágenes.
                      </p>
                    </div>
                  </div>

                  <div className="flex justify-end space-x-2">
                    <Button type="button" variant="outline" onClick={() => setShowDialog(false)}>
                      Cancelar
                    </Button>
                    <Button type="submit">
                      {editingProduct ? "Actualizar" : "Crear"} Producto
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {/* Filtros */}
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nombre o código..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8"
              />
            </div>
          </div>
          <div className="flex flex-col sm:flex-row gap-2">
            <Select value={filterProveedor} onValueChange={setFilterProveedor}>
              <SelectTrigger className="w-full sm:w-48">
                <SelectValue placeholder="Filtrar por proveedor" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los proveedores</SelectItem>
                {Object.entries(proveedores).map(([id, proveedor]) => (
                  <SelectItem key={id} value={id}>
                    {proveedor.nombre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterTipo} onValueChange={setFilterTipo}>
              <SelectTrigger className="w-full sm:w-48">
                <SelectValue placeholder="Filtrar por tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los tipos</SelectItem>
                {tiposUnicos.map((tipo) => (
                  <SelectItem key={tipo} value={tipo}>
                    {tipo}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {(searchTerm || filterProveedor || filterTipo) && (
              <Button variant="outline" onClick={limpiarFiltros} className="w-full sm:w-auto bg-transparent">
                <X className="h-4 w-4 mr-2" />
                Limpiar filtros
              </Button>
            )}
          </div>
        </div>

        {/* Vista Desktop - Tabla */}
        <div className="hidden lg:block rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Imagen</TableHead>
                <TableHead>Código</TableHead>
                <TableHead>Nombre</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Proveedor</TableHead>
                <TableHead>Precio Venta</TableHead>
                <TableHead>Stock</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {currentItems.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="h-24 text-center">
                    No se encontraron productos
                  </TableCell>
                </TableRow>
              ) : (
                currentItems.map((producto) => (
                  <TableRow key={producto.id}>
                    <TableCell>
                      {producto.imagen ? (
                        <div className="w-12 h-12 rounded overflow-hidden border">
                          <img
                            src={producto.imagen}
                            alt={producto.nombre}
                            className="w-full h-full object-cover"
                          />
                        </div>
                      ) : (
                        <div className="w-12 h-12 rounded border flex items-center justify-center bg-muted">
                          <Image className="h-6 w-6 text-muted-foreground" />
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="font-mono">{producto.codigo}</TableCell>
                    <TableCell className="font-medium">{producto.nombre}</TableCell>
                    <TableCell>{producto.tipo}</TableCell>
                    <TableCell>{proveedores[producto.proveedor]?.nombre || "Sin proveedor"}</TableCell>
                    <TableCell>${producto.precioVenta?.toFixed(2) || producto.precio?.toFixed(2)}</TableCell>
                    <TableCell>{producto.stock}</TableCell>
                    <TableCell>
                      {producto.stock <= producto.stockMinimo ? (
                        <Badge variant="destructive">Stock Bajo</Badge>
                      ) : (
                        <Badge variant="default">Disponible</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex space-x-2">
                        <Button variant="outline" size="sm" onClick={() => handleEdit(producto.id, producto)}>
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => handleDelete(producto.id)}>
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
              No se encontraron productos
            </div>
          ) : (
            currentItems.map((producto) => (
              <Card key={producto.id} className="overflow-hidden">
                <CardContent className="p-4">
                  <div className="flex gap-4">
                    {/* Imagen */}
                    <div className="flex-shrink-0">
                      {producto.imagen ? (
                        <div className="w-20 h-20 rounded overflow-hidden border">
                          <img
                            src={producto.imagen}
                            alt={producto.nombre}
                            className="w-full h-full object-cover"
                          />
                        </div>
                      ) : (
                        <div className="w-20 h-20 rounded border flex items-center justify-center bg-muted">
                          <Image className="h-8 w-8 text-muted-foreground" />
                        </div>
                      )}
                    </div>
                    
                    {/* Información */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold text-base truncate">{producto.nombre}</h3>
                          <p className="text-xs text-muted-foreground font-mono">{producto.codigo}</p>
                        </div>
                        <div className="flex-shrink-0">
                          {producto.stock <= producto.stockMinimo ? (
                            <Badge variant="destructive" className="text-xs">Stock Bajo</Badge>
                          ) : (
                            <Badge variant="default" className="text-xs">Disponible</Badge>
                          )}
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-2 text-sm mb-3">
                        <div>
                          <span className="text-muted-foreground">Tipo:</span>
                          <p className="font-medium">{producto.tipo}</p>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Proveedor:</span>
                          <p className="font-medium truncate">{proveedores[producto.proveedor]?.nombre || "Sin proveedor"}</p>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Precio:</span>
                          <p className="font-medium">${producto.precioVenta?.toFixed(2) || producto.precio?.toFixed(2)}</p>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Stock:</span>
                          <p className="font-medium">{producto.stock}</p>
                        </div>
                      </div>
                      
                      {/* Acciones */}
                      <div className="flex gap-2">
                        <Button 
                          variant="outline" 
                          size="sm" 
                          onClick={() => handleEdit(producto.id, producto)}
                          className="flex-1"
                        >
                          <Edit className="h-4 w-4 mr-2" />
                          Editar
                        </Button>
                        <Button 
                          variant="outline" 
                          size="sm" 
                          onClick={() => handleDelete(producto.id)}
                          className="flex-1"
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Eliminar
                        </Button>
                      </div>
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
  )
}
