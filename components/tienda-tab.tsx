"use client"

import { useState, useEffect, useRef } from "react"
import { ref, push, set, remove, onValue, off, get } from "firebase/database"
import { ref as storageRef, uploadBytes as uploadStorageBytes, getDownloadURL as getStorageDownloadURL } from "firebase/storage"
import { database, storage } from "@/lib/firebase"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import { Plus, Trash2, Search, X, Share2, ShoppingCart, Image, Upload, Copy, ExternalLink, Package, Store, MoreVertical } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { Pagination } from "@/components/ui/pagination"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Separator } from "@/components/ui/separator"
import TiendaConfig from "./tienda-config"
import { ClientOnly } from "@/components/client-only"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"

interface Producto {
  id?: string
  nombre: string
  descripcion: string
  precio: number
  stock: number
  categoria: string
  imagen: string
  destacado: boolean
  activo: boolean
  fechaCreacion?: string
  tiendaId?: string
}

interface User {
  id?: string
  uid?: string // Mantener compatibilidad
  phone?: string
  name?: string
  email?: string
  role?: string
  empresa?: string
}

export default function TiendaTab({ productos: productosProp, user }: { productos?: Record<string, Producto>, user: User }) {
  const [productos, setProductos] = useState<Record<string, Producto>>({})
  const [searchTerm, setSearchTerm] = useState("")
  const [filterCategoria, setFilterCategoria] = useState("todas")
  const [currentPage, setCurrentPage] = useState(1)
  const [uploadingImage, setUploadingImage] = useState(false)
  const [selectedImage, setSelectedImage] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState("")
  const [showShareDialog, setShowShareDialog] = useState(false)
  const [selectedProductForShare, setSelectedProductForShare] = useState(null)
  const [tiendaConfig, setTiendaConfig] = useState({
    nombre: "Mi Tienda",
    descripcion: "Los mejores productos al mejor precio",
    telefono: "",
    whatsapp: "",
    direccion: "",
    horarios: "",
    logo: ""
  })
  
  const fileInputRef = useRef(null)
  const { toast } = useToast()
  const itemsPerPage = 12

  // Cargar productos desde Firebase
  useEffect(() => {
    const userId = user?.uid || user?.id
    if (!userId) return

    const productosRef = ref(database, `tiendas/${userId}/productos`)
    const unsubscribe = onValue(productosRef, (snapshot) => {
      if (snapshot.exists()) {
        setProductos(snapshot.val())
      } else {
        setProductos({})
      }
    })

    return () => {
      off(productosRef, 'value', unsubscribe)
    }
  }, [user?.uid, user?.id])

  // También cargar desde usuarios si no hay productos en tiendas (para compatibilidad)
  useEffect(() => {
    const userId = user?.uid || user?.id
    if (!userId || Object.keys(productos).length > 0) return

    const productosUsuariosRef = ref(database, `usuarios/${userId}/productos`)
    const unsubscribe = onValue(productosUsuariosRef, (snapshot) => {
      if (snapshot.exists()) {
        setProductos(snapshot.val())
      }
    })

    return () => {
      off(productosUsuariosRef, 'value', unsubscribe)
    }
  }, [user?.uid, user?.id, productos])

  const [formData, setFormData] = useState({
    nombre: "",
    descripcion: "",
    precio: "",
    stock: "",
    categoria: "",
    imagen: "",
    destacado: false,
    activo: true
  })

  // Cargar configuración de la tienda
  useEffect(() => {
    const userId = user?.uid || user?.id
    if (!userId) return

    const tiendaRef = ref(database, `tiendas/${userId}/config`)
    const unsubscribe = onValue(tiendaRef, (snapshot) => {
      if (snapshot.exists()) {
        setTiendaConfig(snapshot.val())
      }
    })

    return () => {
      off(tiendaRef, 'value', unsubscribe)
    }
  }, [user?.uid, user?.id])

  const resetForm = () => {
    setFormData({
      nombre: "",
      descripcion: "",
      precio: "",
      stock: "",
      categoria: "",
      imagen: "",
      destacado: false,
      activo: true
    })
    setSelectedImage(null)
    setImagePreview("")
  }

  const handleImageUpload = async (file: File) => {
    if (!file) return ""
    const userId = user?.uid || user?.id
    if (!userId) return ""
    
    setUploadingImage(true)
    try {
      const imageRef = storageRef(storage, `tienda/${userId}/${Date.now()}_${file.name}`)
      const snapshot = await uploadStorageBytes(imageRef, file)
      const downloadURL = await getStorageDownloadURL(snapshot.ref)
      setUploadingImage(false)
      return downloadURL
    } catch (error) {
      console.error("Error al subir imagen:", error)
      setUploadingImage(false)
      toast({
        title: "Error",
        description: "No se pudo subir la imagen",
        variant: "destructive"
      })
      return ""
    }
  }

  const handleImageSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      setSelectedImage(file)
      const reader = new FileReader()
      reader.onload = (e) => {
        const result = e.target?.result
        if (typeof result === 'string') {
          setImagePreview(result)
        }
      }
      reader.readAsDataURL(file)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const userId = user?.uid || user?.id
    if (!userId) {
      toast({
        title: "Error",
        description: "Usuario no identificado",
        variant: "destructive"
      })
      return
    }

    let imagenURL = formData.imagen
    
    if (selectedImage) {
      imagenURL = await handleImageUpload(selectedImage)
    }

    const productData = {
      ...formData,
      precio: Number.parseFloat(formData.precio),
      stock: Number.parseInt(formData.stock),
      imagen: imagenURL,
      fechaCreacion: new Date().toISOString(),
      tiendaId: userId
    }

    try {
      await push(ref(database, `tiendas/${userId}/productos`), productData)
      toast({
        title: "Producto agregado",
        description: "El producto se agregó correctamente"
      })

      resetForm()
    } catch (error) {
      console.error("Error al guardar producto:", error)
      toast({
        title: "Error",
        description: "No se pudo guardar el producto",
        variant: "destructive"
      })
    }
  }

  const handleDelete = async (id) => {
    const userId = user?.uid || user?.id
    if (!userId) return

    if (confirm("¿Estás seguro de eliminar este producto?")) {
      try {
        await remove(ref(database, `tiendas/${userId}/productos/${id}`))
        toast({
          title: "Producto eliminado",
          description: "El producto se eliminó correctamente"
        })
      } catch (error) {
        console.error("Error al eliminar producto:", error)
        toast({
          title: "Error",
          description: "No se pudo eliminar el producto",
          variant: "destructive"
        })
      }
    }
  }

  const handleShare = (producto) => {
    setSelectedProductForShare(producto)
    setShowShareDialog(true)
  }

  const generateWhatsAppMessage = (producto) => {
    const mensaje = `¡Hola! Te comparto este producto de mi tienda:\n\n` +
      `*${producto.nombre}*\n` +
      `${producto.descripcion}\n\n` +
      `💰 Precio: $${producto.precio}\n` +
      `📦 Stock disponible: ${producto.stock} unidades\n\n` +
      `¿Te interesa? ¡Contáctame para más información!`
    
    return encodeURIComponent(mensaje)
  }

  const generateBuyWhatsAppMessage = (producto) => {
    const mensaje = `¡Hola! Quiero comprar:\n\n` +
      `*${producto.nombre}*\n` +
      `💰 Precio: $${producto.precio}\n\n` +
      `¿Tienes stock disponible?`
    
    return encodeURIComponent(mensaje)
  }

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text)
    toast({
      title: "Copiado",
      description: "Enlace copiado al portapapeles"
    })
  }

  const limpiarFiltros = () => {
    setSearchTerm("")
    setFilterCategoria("todas")
    setCurrentPage(1)
  }

  const productosFiltrados = Object.entries(productos || {})
    .filter(([id, producto]) => {
      const matchesSearch = producto.nombre?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           producto.descripcion?.toLowerCase().includes(searchTerm.toLowerCase())
      const matchesCategoria = filterCategoria === "todas" || !filterCategoria || producto.categoria === filterCategoria
      return matchesSearch && matchesCategoria
    })
    .map(([id, producto]) => ({ id, ...producto }))

  const totalPages = Math.ceil(productosFiltrados.length / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const productosPaginados = productosFiltrados.slice(startIndex, startIndex + itemsPerPage)

  const categorias = [...new Set(Object.values(productos || {}).map(p => p.categoria).filter(Boolean))]
  const userId = user?.uid || user?.id

  if (!userId) {
    return (
      <div className="space-y-6">
        <div className="text-center py-12">
          <Store className="h-16 w-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">Usuario no identificado</h3>
          <p className="text-gray-600">No se puede cargar la tienda. Por favor, inicia sesión nuevamente.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
        <div>
          <h2 className="text-2xl font-bold">Mi Tienda</h2>
          <p className="text-muted-foreground">Gestiona tus productos y configura tu catálogo público</p>
        </div>
        <ClientOnly
          fallback={
            <div className="flex gap-2">
              <Button variant="outline" disabled>
                <Share2 className="h-4 w-4 mr-2" />
                Compartir Catálogo
              </Button>
              <Button disabled>
                <ExternalLink className="h-4 w-4 mr-2" />
                Ver mi Tienda
              </Button>
            </div>
          }
        >
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => {
                if (userId) {
                  const tiendaURL = `${window.location.origin}/tienda/${userId}`
                  copyToClipboard(tiendaURL)
                } else {
                  toast({
                    title: "Error",
                    description: "No se puede compartir el catálogo. Usuario no identificado.",
                    variant: "destructive"
                  })
                }
              }}
              disabled={!userId}
            >
              <Share2 className="h-4 w-4 mr-2" />
              Compartir Catálogo
            </Button>
            <Button
              onClick={() => {
                if (userId) {
                  const tiendaURL = `${window.location.origin}/tienda/${userId}`
                  window.open(tiendaURL, '_blank')
                }
              }}
              disabled={!userId}
            >
              <ExternalLink className="h-4 w-4 mr-2" />
              Ver mi Tienda
            </Button>
          </div>
        </ClientOnly>
      </div>

      <Tabs defaultValue="productos" className="space-y-6">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="productos">Mis Productos</TabsTrigger>
          <TabsTrigger value="configuracion">Configuración</TabsTrigger>
        </TabsList>

        <TabsContent value="productos" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Statistics Cards */}
          </div>

          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
            {/* Search and Filter Controls */}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {productosPaginados.map((producto) => (
              <Card key={producto.id} className="overflow-hidden bg-white dark:bg-slate-800/50 rounded-xl shadow-md hover:shadow-xl transition-all duration-300 flex flex-col">
                <div className="relative">
                  <div className="aspect-video w-full overflow-hidden">
                    {producto.imagen ? (
                      <img
                        src={producto.imagen}
                        alt={producto.nombre}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center">
                        <Image className="h-16 w-16 text-slate-400 dark:text-slate-500" />
                      </div>
                    )}
                  </div>
                  <div className="absolute top-2 left-2 flex flex-col gap-2">
                    {producto.destacado && (
                      <Badge className="bg-amber-400 text-amber-900 font-semibold py-1 px-3 rounded-full shadow-md">Destacado</Badge>
                    )}
                    {producto.activo === false && (
                      <Badge variant="destructive" className="font-semibold py-1 px-3 rounded-full shadow-md">Inactivo</Badge>
                    )}
                  </div>
                </div>
                <CardContent className="p-4 flex flex-col flex-grow">
                  <div className="flex-grow">
                    {producto.categoria && (
                      <Badge variant="outline" className="text-xs font-medium text-indigo-600 border-indigo-300 dark:text-indigo-400 dark:border-indigo-500/50 mb-2">
                        {producto.categoria}
                      </Badge>
                    )}
                    <h3 className="font-bold text-lg text-slate-900 dark:text-white truncate">{producto.nombre}</h3>
                    <p className="text-sm text-slate-600 dark:text-slate-400 line-clamp-2 h-[40px] mt-1">
                      {producto.descripcion}
                    </p>
                  </div>
                  <div className="flex items-baseline justify-between pt-4 mt-auto">
                    <span className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">
                      ${producto.precio}
                    </span>
                    <span className="text-sm font-semibold text-slate-500 dark:text-slate-400">
                      Stock: {producto.stock}
                    </span>
                  </div>
                </CardContent>
                <div className="p-2 border-t border-slate-200 dark:border-slate-700/50 flex items-center gap-2">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button size="sm" variant="outline" className="px-2">
                        <MoreVertical className="h-5 w-5" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => handleShare(producto)}>
                        <Share2 className="h-4 w-4 mr-2" />
                        Compartir
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleDelete(producto.id)} className="text-red-600">
                        <Trash2 className="h-4 w-4 mr-2" />
                        Eliminar
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </Card>
            ))}
          </div>

          {totalPages > 1 && (
            <div className="flex justify-center">
              {/* Pagination... */}
            </div>
          )}
        </TabsContent>

        <TabsContent value="configuracion">
          <TiendaConfig user={user} />
        </TabsContent>
      </Tabs>

      <Dialog open={showShareDialog} onOpenChange={setShowShareDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Compartir Producto</DialogTitle>
          </DialogHeader>
          {selectedProductForShare && (
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                {selectedProductForShare.imagen && (
                  <img
                    src={selectedProductForShare.imagen}
                    alt={selectedProductForShare.nombre}
                    className="w-20 h-20 object-cover rounded-lg"
                  />
                )}
                <div>
                  <h3 className="font-semibold">{selectedProductForShare.nombre}</h3>
                  <p className="text-sm text-muted-foreground">
                    ${selectedProductForShare.precio}
                  </p>
                </div>
              </div>
              <Separator />
              <div className="space-y-3">
                <div>
                  <Label>Compartir por WhatsApp</Label>
                  <Button
                    className="w-full bg-green-600 hover:bg-green-700"
                    onClick={() => {
                      const mensaje = generateWhatsAppMessage(selectedProductForShare)
                      const whatsappURL = `https://wa.me/${tiendaConfig.whatsapp || user.phone}?text=${mensaje}`
                      window.open(whatsappURL, '_blank')
                    }}
                  >
                    <Share2 className="h-4 w-4 mr-2" />
                    Enviar por WhatsApp
                  </Button>
                </div>
                <ClientOnly
                  fallback={
                    <div className="flex gap-2">
                      <Input value="Generando enlace..." readOnly disabled />
                      <Button variant="outline" disabled><Copy className="h-4 w-4" /></Button>
                    </div>
                  }
                >
                  <div>
                    <Label>Enlace directo del producto</Label>
                    <div className="flex gap-2">
                      <Input
                        value={`${window.location.origin}/tienda/${userId}/producto/${selectedProductForShare.id}`}
                        readOnly
                      />
                      <Button
                        variant="outline"
                        onClick={() => copyToClipboard(`${window.location.origin}/tienda/${userId}/producto/${selectedProductForShare.id}`)}
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </ClientOnly>
                <ClientOnly
                  fallback={
                    <div className="flex gap-2">
                      <Input value="Generando enlace..." readOnly disabled />
                      <Button variant="outline" disabled><Copy className="h-4 w-4" /></Button>
                    </div>
                  }
                >
                  <div>
                    <Label>Enlace del catálogo completo</Label>
                    <div className="flex gap-2">
                      <Input
                        value={userId ? `${window.location.origin}/tienda/${userId}` : "Usuario no identificado"}
                        readOnly
                      />
                      <Button
                        variant="outline"
                        onClick={() => {
                          if (userId) {
                            copyToClipboard(`${window.location.origin}/tienda/${userId}`)
                          } else {
                            toast({
                              title: "Error",
                              description: "No se puede copiar el enlace. Usuario no identificado.",
                              variant: "destructive"
                            })
                          }
                        }}
                        disabled={!userId}
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </ClientOnly>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}