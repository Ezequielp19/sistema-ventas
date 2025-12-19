"use client"

import { useState, useEffect } from "react"
import { use } from "react"
import { ref, get } from "firebase/database"
import { database } from "@/lib/firebase"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Search, Share2, ShoppingCart, Image, Phone, MapPin, Clock, Instagram, Facebook, Store, X, ChevronLeft, ChevronRight } from "lucide-react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Pagination } from "@/components/ui/pagination"
import { useClient } from "@/hooks/use-client"
import { ClientOnly } from "@/components/client-only"

interface Producto {
  id?: string
  nombre: string
  descripcion: string
  precio?: number
  precioVenta?: number
  stock: number
  categoria?: string
  tipo?: string
  imagen?: string
  imagenes?: string[]
  destacado?: boolean
  activo?: boolean
}

interface TiendaConfig {
  nombre: string
  descripcion: string
  telefono: string
  whatsapp: string
  direccion: string
  horarios: string
  logo: string
  redesSociales: {
    instagram?: string
    facebook?: string
  }
}

export default function TiendaPublica({ params }: { params: Promise<{ userId: string }> }) {
  const { userId } = use(params)
  
  const [productos, setProductos] = useState<Record<string, Producto>>({})
  const [tiendaConfig, setTiendaConfig] = useState<TiendaConfig>({
    nombre: "Mi Tienda",
    descripcion: "Los mejores productos al mejor precio",
    telefono: "",
    whatsapp: "",
    direccion: "",
    horarios: "",
    logo: "",
    redesSociales: {}
  })
  const [searchTerm, setSearchTerm] = useState("")
  const [filterCategoria, setFilterCategoria] = useState("todas")
  const [currentPage, setCurrentPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [selectedProduct, setSelectedProduct] = useState<Producto | null>(null)
  const [showProductModal, setShowProductModal] = useState(false)
  const [currentModalImageIndex, setCurrentModalImageIndex] = useState(0)
  const itemsPerPage = 12

  const isClient = useClient()
  const [catalogUrl, setCatalogUrl] = useState("")

  useEffect(() => {
    if (isClient) {
      setCatalogUrl(window.location.href)
    }
  }, [isClient])

  useEffect(() => {
    const cargarTienda = async () => {
      setLoading(true)
      try {
        const configRef = ref(database, `tiendas/${userId}/config`)
        const productosRef = ref(database, `tiendas/${userId}/productos`)

        const [configSnapshot, productosSnapshot] = await Promise.all([
          get(configRef),
          get(productosRef)
        ]);

        if (configSnapshot.exists()) {
          setTiendaConfig(configSnapshot.val())
        }

        if (productosSnapshot.exists()) {
          setProductos(productosSnapshot.val())
        } else {
          setProductos({})
        }
      } catch (error) {
        console.error("Error al cargar la tienda:", error)
        setProductos({})
      } finally {
        setLoading(false)
      }
    }

    if (userId) {
      cargarTienda()
    }
  }, [userId])

  const productosFiltrados = Object.entries(productos || {})
    .map(([id, producto]) => ({ 
      ...producto, 
      id,
      // Normalizar campos: usar precioVenta si existe, sino precio
      precio: producto.precioVenta || producto.precio || 0,
      // Normalizar categoría: usar categoria si existe, sino tipo
      categoria: producto.categoria || producto.tipo || "",
      // Asegurar que activo sea boolean (por defecto true si no está definido)
      activo: producto.activo !== false
    }))
    .filter(producto => {
      // Filtrar productos activos con stock > 0
      const isActive = producto.activo !== false && producto.stock > 0
      if (!isActive) return false

      const matchesSearch = searchTerm.trim() === '' ||
                           producto.nombre?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           producto.descripcion?.toLowerCase().includes(searchTerm.toLowerCase())
      
      const matchesCategoria = filterCategoria === "todas" || !filterCategoria || producto.categoria === filterCategoria
      
      return matchesSearch && matchesCategoria
    })

  const totalPages = Math.ceil(productosFiltrados.length / itemsPerPage)
  const productosPaginados = productosFiltrados.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)

  const categorias = [...new Set(Object.values(productos || {}).map(p => p.categoria || p.tipo).filter(Boolean))] as string[]

  const generateWhatsAppMessage = (producto: Producto) => {
    return encodeURIComponent(
      `¡Hola! Quiero comprar:\n\n` +
      `*${producto.nombre}*\n` +
      `${producto.descripcion}\n\n` +
      `💰 Precio: $${producto.precio}\n` +
      `📦 Stock disponible: ${producto.stock} unidades\n\n` +
      `¿Tienes stock disponible?`
    )
  }

  const shareTienda = () => {
    const mensaje = `¡Hola! Te comparto el catálogo de ${tiendaConfig.nombre}:\n\n` +
      `${tiendaConfig.descripcion}\n\n` +
      `🛍️ Ver productos: ${catalogUrl}\n\n` +
      `📞 Contacto: ${tiendaConfig.whatsapp || tiendaConfig.telefono}`
    
    const whatsappURL = `https://wa.me/?text=${encodeURIComponent(mensaje)}`
    window.open(whatsappURL, '_blank')
  }

  const limpiarFiltros = () => {
    setSearchTerm("")
    setFilterCategoria("todas")
    setCurrentPage(1)
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500 mx-auto"></div>
          <p className="mt-4 text-slate-500 dark:text-slate-400">Cargando catálogo...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-200">
      <header className="bg-gradient-to-b from-white to-slate-50 dark:from-slate-800 dark:to-slate-900 shadow-sm border-b border-slate-200 dark:border-slate-700">
        <div className="max-w-7xl mx-auto px-3 sm:px-4 md:px-6 lg:px-8 py-4 sm:py-6 md:py-8">
          <div className="flex flex-col sm:flex-row items-center sm:items-start justify-between gap-4 sm:gap-6">
            <div className="flex flex-col sm:flex-row items-center sm:items-center gap-3 sm:gap-4 md:gap-5 w-full sm:w-auto">
              {tiendaConfig.logo ? (
                <img 
                  src={tiendaConfig.logo} 
                  alt={tiendaConfig.nombre}
                  className="w-16 h-16 sm:w-20 sm:h-20 md:w-24 md:h-24 rounded-full object-cover border-2 sm:border-4 border-white dark:border-slate-700 shadow-lg flex-shrink-0"
                />
              ) : (
                <div className="w-16 h-16 sm:w-20 sm:h-20 md:w-24 md:h-24 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full flex items-center justify-center border-2 sm:border-4 border-white dark:border-slate-700 shadow-lg flex-shrink-0">
                  <Store className="h-8 w-8 sm:h-10 sm:w-10 md:h-12 md:w-12 text-white" />
                </div>
              )}
              <div className="text-center sm:text-left flex-1 sm:flex-none">
                <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold tracking-tight text-slate-900 dark:text-white break-words">{tiendaConfig.nombre}</h1>
                <p className="text-sm sm:text-base md:text-lg text-slate-600 dark:text-slate-400 mt-1 line-clamp-2">{tiendaConfig.descripcion}</p>
              </div>
            </div>
            
            <div className="flex items-center gap-2 sm:gap-3 w-full sm:w-auto justify-center sm:justify-end">
              <ClientOnly
                fallback={
                  <Button variant="outline" disabled size="sm" className="rounded-full shadow-lg w-full sm:w-auto sm:text-base">
                    <Share2 className="h-4 w-4 sm:h-5 sm:w-5 sm:mr-2" />
                    <span className="hidden sm:inline">Compartir Tienda</span>
                    <span className="sm:hidden">Compartir</span>
                  </Button>
                }
              >
                <Button 
                  onClick={shareTienda} 
                  variant="outline"
                  size="sm"
                  className="sm:size-lg rounded-full shadow-lg bg-white/50 dark:bg-slate-800/50 backdrop-blur-lg border-slate-300 dark:border-slate-600 hover:bg-white/80 dark:hover:bg-slate-800/80 w-full sm:w-auto text-xs sm:text-base"
                >
                  <Share2 className="h-4 w-4 sm:h-5 sm:w-5 sm:mr-2" />
                  <span className="hidden sm:inline">Compartir Tienda</span>
                  <span className="sm:hidden">Compartir</span>
                </Button>
              </ClientOnly>
            </div>
          </div>

          <div className="mt-4 sm:mt-6 md:mt-8 pt-4 sm:pt-6 border-t border-slate-200 dark:border-slate-700 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 text-xs sm:text-sm">
            {tiendaConfig.telefono && (
              <div className="flex items-start sm:items-center gap-2 text-slate-600 dark:text-slate-400">
                <Phone className="h-4 w-4 text-indigo-500 flex-shrink-0 mt-0.5 sm:mt-0" />
                <span className="break-words">{tiendaConfig.telefono}</span>
              </div>
            )}
            {tiendaConfig.whatsapp && (
              <div className="flex items-start sm:items-center gap-2 text-slate-600 dark:text-slate-400">
                <ShoppingCart className="h-4 w-4 text-indigo-500 flex-shrink-0 mt-0.5 sm:mt-0" />
                <span className="break-words">
                  <span className="hidden sm:inline">WhatsApp: </span>
                  <span className="sm:hidden">WA: </span>
                  {tiendaConfig.whatsapp}
                </span>
              </div>
            )}
            {tiendaConfig.direccion && (
              <div className="flex items-start sm:items-center gap-2 text-slate-600 dark:text-slate-400">
                <MapPin className="h-4 w-4 text-indigo-500 flex-shrink-0 mt-0.5 sm:mt-0" />
                <span className="break-words line-clamp-2">{tiendaConfig.direccion}</span>
              </div>
            )}
            {tiendaConfig.horarios && (
              <div className="flex items-start sm:items-center gap-2 text-slate-600 dark:text-slate-400">
                <Clock className="h-4 w-4 text-indigo-500 flex-shrink-0 mt-0.5 sm:mt-0" />
                <span className="break-words line-clamp-2">{tiendaConfig.horarios}</span>
              </div>
            )}
          </div>

          {(tiendaConfig.redesSociales?.instagram || tiendaConfig.redesSociales?.facebook) && (
            <div className="mt-3 sm:mt-4 flex items-center gap-3 sm:gap-4 justify-center sm:justify-start flex-wrap">
              {tiendaConfig.redesSociales?.instagram && (
                <a 
                  href={`https://instagram.com/${tiendaConfig.redesSociales.instagram}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-slate-600 hover:text-pink-600 dark:text-slate-400 dark:hover:text-pink-500 transition-colors text-xs sm:text-sm"
                >
                  <Instagram className="h-4 w-4 sm:h-5 sm:w-5" />
                  <span className="hidden sm:inline">@</span>
                  <span className="truncate max-w-[120px] sm:max-w-none">{tiendaConfig.redesSociales.instagram}</span>
                </a>
              )}
              {tiendaConfig.redesSociales?.facebook && (
                <a 
                  href={`https://facebook.com/${tiendaConfig.redesSociales.facebook}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-slate-600 hover:text-blue-600 dark:text-slate-400 dark:hover:text-blue-500 transition-colors text-xs sm:text-sm"
                >
                  <Facebook className="h-4 w-4 sm:h-5 sm:w-5" />
                  <span className="truncate max-w-[120px] sm:max-w-none">{tiendaConfig.redesSociales.facebook}</span>
                </a>
              )}
            </div>
          )}
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-3 sm:px-4 md:px-6 lg:px-8 py-6 sm:py-8 md:py-12">
        <div className="flex flex-col gap-4 sm:gap-6 mb-6 sm:mb-8 md:mb-10">
          <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white text-center sm:text-left">Nuestro Catálogo</h2>
          <div className="flex flex-col gap-3 w-full">
            <div className="relative w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 sm:h-5 sm:w-5 text-slate-400" />
              <Input
                placeholder="Buscar productos..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 sm:pl-10 py-2.5 sm:py-2 text-sm sm:text-base rounded-full bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600 w-full"
              />
            </div>
            
            <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
              <Select value={filterCategoria} onValueChange={setFilterCategoria}>
                <SelectTrigger className="w-full sm:w-[200px] rounded-full bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600 text-sm sm:text-base h-10 sm:h-auto">
                  <SelectValue placeholder="Todas las categorías" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todas">Todas las categorías</SelectItem>
                  {categorias.filter(Boolean).map((categoria) => (
                    <SelectItem key={categoria} value={categoria}>
                      {categoria}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {(searchTerm || (filterCategoria && filterCategoria !== "todas")) && (
                <Button variant="ghost" onClick={limpiarFiltros} size="sm" className="rounded-full w-full sm:w-auto text-sm sm:text-base">
                  Limpiar filtros
                </Button>
              )}
            </div>
          </div>
        </div>

        {productosFiltrados.length === 0 ? (
          <div className="text-center py-12 sm:py-16 md:py-20 px-4">
            <div className="inline-block p-4 sm:p-6 bg-indigo-100 dark:bg-indigo-500/20 rounded-full">
              <ShoppingCart className="h-12 w-12 sm:h-16 sm:w-16 md:h-20 md:w-20 text-indigo-500 dark:text-indigo-400" />
            </div>
            <h3 className="text-xl sm:text-2xl font-semibold text-slate-900 dark:text-white mt-4 sm:mt-6">No se encontraron productos</h3>
            <p className="text-sm sm:text-base text-slate-600 dark:text-slate-400 mt-2">Intenta ajustar los filtros o revisa más tarde.</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6 md:gap-8">
              {productosPaginados.map((producto) => (
                <Card 
                  key={producto.id} 
                  className="overflow-hidden rounded-xl border-0 bg-white/50 dark:bg-slate-800/50 backdrop-blur-lg shadow-lg transition-all duration-300 hover:shadow-2xl hover:-translate-y-2 active:scale-95 flex flex-col cursor-pointer touch-manipulation"
                  onClick={() => {
                    setSelectedProduct(producto)
                    setShowProductModal(true)
                    setCurrentModalImageIndex(0)
                  }}
                >
                  <div className="relative">
                    <div className="aspect-video w-full overflow-hidden relative group">
                      {producto.imagenes && producto.imagenes.length > 0 ? (
                        <>
                          <img
                            src={producto.imagenes[0]}
                            alt={producto.nombre}
                            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110"
                          />
                          {producto.imagenes.length > 1 && (
                            <>
                              <div className="absolute bottom-1.5 sm:bottom-2 left-1/2 transform -translate-x-1/2 flex gap-0.5 sm:gap-1">
                                {producto.imagenes.map((_, index) => (
                                  <div
                                    key={index}
                                    className={`h-1 sm:h-1.5 rounded-full transition-all ${
                                      index === 0 ? 'w-4 sm:w-6 bg-white' : 'w-1 sm:w-1.5 bg-white/50'
                                    }`}
                                  />
                                ))}
                              </div>
                              <div className="absolute top-1.5 sm:top-2 right-1.5 sm:right-2 bg-black/50 text-white text-[10px] sm:text-xs px-1 sm:px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-full">
                                {producto.imagenes.length} {producto.imagenes.length === 1 ? 'foto' : 'fotos'}
                              </div>
                            </>
                          )}
                        </>
                      ) : (
                        <div className="w-full h-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center">
                          <Image className="h-16 w-16 text-slate-400 dark:text-slate-500" />
                        </div>
                      )}
                    </div>
                    {producto.destacado && (
                      <Badge className="absolute top-3 left-3 bg-amber-400 text-amber-900 font-semibold py-1 px-3 rounded-full shadow-md z-10">
                        Destacado
                      </Badge>
                    )}
                  </div>

                  <CardContent className="p-3 sm:p-4 md:p-5 flex flex-col flex-grow">
                    <div className="space-y-2 sm:space-y-3 flex-grow">
                      {producto.categoria && (
                        <Badge variant="outline" className="text-[10px] sm:text-xs font-medium text-indigo-600 border-indigo-300 dark:text-indigo-400 dark:border-indigo-500/50">
                          {producto.categoria}
                        </Badge>
                      )}
                      <h3 className="font-bold text-lg sm:text-xl text-slate-900 dark:text-white line-clamp-2 min-h-[3rem]">{producto.nombre}</h3>
                      <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 line-clamp-2 min-h-[2.5rem] sm:min-h-[2.75rem]">
                        {producto.descripcion}
                      </p>
                      
                      <div className="flex items-baseline justify-between pt-2 flex-wrap gap-2">
                        <span className="text-xl sm:text-2xl font-bold text-indigo-600 dark:text-indigo-400">
                          ${producto.precio}
                        </span>
                        <span className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
                          Stock: {producto.stock}
                        </span>
                      </div>
                    </div>

                    <ClientOnly
                      fallback={
                        <Button className="w-full mt-3 sm:mt-4 font-semibold rounded-lg text-sm sm:text-base sm:py-3" size="sm" disabled>
                          <ShoppingCart className="h-4 w-4 sm:h-5 sm:w-5 sm:mr-2" />
                          <span className="hidden sm:inline">Comprar por WhatsApp</span>
                          <span className="sm:hidden">Comprar</span>
                        </Button>
                      }
                    >
                      <Button
                        className="w-full mt-3 sm:mt-4 font-semibold rounded-lg bg-green-600 hover:bg-green-700 active:bg-green-800 text-white transition-transform transform active:scale-95 shadow-md hover:shadow-lg text-sm sm:text-base py-2.5 sm:py-3 touch-manipulation"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation() // Evitar que se abra el modal
                          if (!tiendaConfig.whatsapp) {
                            alert("No hay número de WhatsApp configurado para la tienda.")
                            return
                          }
                          const mensaje = generateWhatsAppMessage(producto)
                          const whatsappURL = `https://wa.me/${tiendaConfig.whatsapp}?text=${mensaje}`
                          window.open(whatsappURL, '_blank')
                        }}
                      >
                        <ShoppingCart className="h-4 w-4 sm:h-5 sm:w-5 sm:mr-2" />
                        <span className="hidden sm:inline">Comprar por WhatsApp</span>
                        <span className="sm:hidden">Comprar</span>
                      </Button>
                    </ClientOnly>
                  </CardContent>
                </Card>
              ))}
            </div>

            {totalPages > 1 && (
              <div className="flex justify-center mt-8 sm:mt-12 px-4">
                 <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} />
              </div>
            )}
          </>
        )}
      </main>

      <footer className="bg-white dark:bg-slate-800/50 border-t border-slate-200 dark:border-slate-700 mt-8 sm:mt-12 md:mt-16">
        <div className="max-w-7xl mx-auto px-3 sm:px-4 md:px-6 lg:px-8 py-4 sm:py-6 text-center text-slate-500 dark:text-slate-400">
          <p className="text-xs sm:text-sm">&copy; {new Date().getFullYear()} {tiendaConfig.nombre}. Todos los derechos reservados.</p>
          <p className="text-[10px] sm:text-xs mt-1 sm:mt-2">Catálogo impulsado por ControlStock.</p>
        </div>
      </footer>

      {/* Modal de Producto */}
      <Dialog open={showProductModal} onOpenChange={setShowProductModal}>
        <DialogContent className="max-w-[95vw] sm:max-w-2xl md:max-w-4xl max-h-[95vh] sm:max-h-[90vh] overflow-y-auto p-3 sm:p-6">
          {selectedProduct && (
            <>
              <DialogHeader className="px-1 sm:px-0">
                <DialogTitle className="text-xl sm:text-2xl font-bold line-clamp-2">{selectedProduct.nombre || "Producto"}</DialogTitle>
              </DialogHeader>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
                {/* Galería de imágenes del producto */}
                <div className="relative">
                  <div className="aspect-square w-full rounded-lg overflow-hidden bg-slate-100 dark:bg-slate-800 relative">
                    {selectedProduct.imagenes && selectedProduct.imagenes.length > 0 ? (
                      <>
                        <img
                          src={selectedProduct.imagenes[currentModalImageIndex]}
                          alt={`${selectedProduct.nombre} - Imagen ${currentModalImageIndex + 1}`}
                          className="w-full h-full object-cover"
                        />
                        {selectedProduct.imagenes.length > 1 && (
                          <>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="absolute left-1 sm:left-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 active:bg-black/80 text-white rounded-full h-8 w-8 sm:h-10 sm:w-10 touch-manipulation"
                              onClick={(e) => {
                                e.stopPropagation()
                                setCurrentModalImageIndex((prev) => 
                                  prev === 0 ? selectedProduct.imagenes!.length - 1 : prev - 1
                                )
                              }}
                            >
                              <ChevronLeft className="h-4 w-4 sm:h-5 sm:w-5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="absolute right-1 sm:right-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 active:bg-black/80 text-white rounded-full h-8 w-8 sm:h-10 sm:w-10 touch-manipulation"
                              onClick={(e) => {
                                e.stopPropagation()
                                setCurrentModalImageIndex((prev) => 
                                  prev === selectedProduct.imagenes!.length - 1 ? 0 : prev + 1
                                )
                              }}
                            >
                              <ChevronRight className="h-4 w-4 sm:h-5 sm:w-5" />
                            </Button>
                            <div className="absolute bottom-2 left-1/2 transform -translate-x-1/2 flex gap-1">
                              {selectedProduct.imagenes.map((_, index) => (
                                <button
                                  key={index}
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    setCurrentModalImageIndex(index)
                                  }}
                                  className={`h-2 rounded-full transition-all ${
                                    index === currentModalImageIndex ? 'w-6 bg-white' : 'w-2 bg-white/50'
                                  }`}
                                />
                              ))}
                            </div>
                            <div className="absolute top-2 right-2 bg-black/50 text-white text-[10px] sm:text-xs px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-full">
                              {currentModalImageIndex + 1} / {selectedProduct.imagenes.length}
                            </div>
                          </>
                        )}
                        {/* Miniaturas de todas las imágenes */}
                        {selectedProduct.imagenes.length > 1 && (
                          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-1.5 sm:p-2">
                            <div className="flex gap-1.5 sm:gap-2 overflow-x-auto pb-1 scrollbar-hide">
                              {selectedProduct.imagenes.map((img, index) => (
                                <button
                                  key={index}
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    setCurrentModalImageIndex(index)
                                  }}
                                  className={`flex-shrink-0 w-12 h-12 sm:w-14 sm:h-14 md:w-16 md:h-16 rounded overflow-hidden border-2 transition-all touch-manipulation active:scale-95 ${
                                    index === currentModalImageIndex 
                                      ? 'border-white scale-110' 
                                      : 'border-white/50 opacity-70 active:opacity-100'
                                  }`}
                                >
                                  <img
                                    src={img}
                                    alt={`Miniatura ${index + 1}`}
                                    className="w-full h-full object-cover"
                                  />
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                      </>
                    ) : selectedProduct.imagen ? (
                      <img
                        src={selectedProduct.imagen}
                        alt={selectedProduct.nombre}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Image className="h-24 w-24 text-slate-400 dark:text-slate-500" />
                      </div>
                    )}
                  </div>
                  {selectedProduct.destacado && (
                    <Badge className="absolute top-3 left-3 bg-amber-400 text-amber-900 font-semibold py-1 px-3 rounded-full shadow-md z-10">
                      Destacado
                    </Badge>
                  )}
                </div>

                {/* Información del producto */}
                <div className="space-y-3 sm:space-y-4">
                  {selectedProduct.categoria && (
                    <Badge variant="outline" className="text-xs sm:text-sm font-medium text-indigo-600 border-indigo-300 dark:text-indigo-400 dark:border-indigo-500/50">
                      {selectedProduct.categoria}
                    </Badge>
                  )}
                  
                  <div>
                    <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white mb-2">
                      {selectedProduct.nombre}
                    </h2>
                    {selectedProduct.descripcion && (
                      <p className="text-sm sm:text-base text-slate-600 dark:text-slate-400 leading-relaxed">
                        {selectedProduct.descripcion}
                      </p>
                    )}
                  </div>

                  <div className="flex flex-col sm:flex-row items-start sm:items-baseline gap-3 sm:gap-4 pt-3 sm:pt-4 border-t border-slate-200 dark:border-slate-700">
                    <div>
                      <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">Precio</p>
                      <p className="text-3xl sm:text-4xl font-bold text-indigo-600 dark:text-indigo-400">
                        ${selectedProduct.precio}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">Stock disponible</p>
                      <p className="text-xl sm:text-2xl font-semibold text-slate-900 dark:text-white">
                        {selectedProduct.stock} unidades
                      </p>
                    </div>
                  </div>

                  <div className="pt-3 sm:pt-4 space-y-2 sm:space-y-3">
                    <ClientOnly
                      fallback={
                        <Button className="w-full font-semibold rounded-lg text-sm sm:text-base sm:py-6" size="sm" disabled>
                          <ShoppingCart className="h-4 w-4 sm:h-5 sm:w-5 sm:mr-2" />
                          <span className="hidden sm:inline">Comprar por WhatsApp</span>
                          <span className="sm:hidden">Comprar</span>
                        </Button>
                      }
                    >
                      <Button
                        className="w-full font-semibold rounded-lg bg-green-600 hover:bg-green-700 active:bg-green-800 text-white text-base sm:text-lg py-3 sm:py-6 transition-transform transform active:scale-95 shadow-md hover:shadow-lg touch-manipulation"
                        size="sm"
                        onClick={() => {
                          if (!tiendaConfig.whatsapp) {
                            alert("No hay número de WhatsApp configurado para la tienda.")
                            return
                          }
                          const mensaje = generateWhatsAppMessage(selectedProduct)
                          const whatsappURL = `https://wa.me/${tiendaConfig.whatsapp}?text=${mensaje}`
                          window.open(whatsappURL, '_blank')
                        }}
                      >
                        <ShoppingCart className="h-4 w-4 sm:h-5 sm:w-5 sm:mr-2" />
                        <span className="hidden sm:inline">Comprar por WhatsApp</span>
                        <span className="sm:hidden">Comprar</span>
                      </Button>
                    </ClientOnly>

                    <Button
                      variant="outline"
                      className="w-full text-sm sm:text-base py-2.5 sm:py-3 touch-manipulation"
                      size="sm"
                      onClick={() => setShowProductModal(false)}
                    >
                      Cerrar
                    </Button>
                  </div>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
