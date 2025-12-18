"use client"

import { useState, useEffect } from "react"
import { use } from "react"
import { ref, get } from "firebase/database"
import { database } from "@/lib/firebase"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Search, Share2, ShoppingCart, Image, Phone, MapPin, Clock, Instagram, Facebook, Store } from "lucide-react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Pagination } from "@/components/ui/pagination"
import { useClient } from "@/hooks/use-client"
import { ClientOnly } from "@/components/client-only"

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

  const categorias = [...new Set(Object.values(productos || {}).map(p => p.categoria || p.tipo).filter(Boolean))]

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
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-5">
              {tiendaConfig.logo ? (
                <img 
                  src={tiendaConfig.logo} 
                  alt={tiendaConfig.nombre}
                  className="w-24 h-24 rounded-full object-cover border-4 border-white dark:border-slate-700 shadow-lg"
                />
              ) : (
                <div className="w-24 h-24 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full flex items-center justify-center border-4 border-white dark:border-slate-700 shadow-lg">
                  <Store className="h-12 w-12 text-white" />
                </div>
              )}
              <div>
                <h1 className="text-4xl font-bold tracking-tight text-slate-900 dark:text-white">{tiendaConfig.nombre}</h1>
                <p className="text-lg text-slate-600 dark:text-slate-400 mt-1">{tiendaConfig.descripcion}</p>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              <ClientOnly
                fallback={
                  <Button variant="outline" disabled size="lg" className="rounded-full shadow-lg">
                    <Share2 className="h-5 w-5 mr-2" />
                    Compartir Tienda
                  </Button>
                }
              >
                <Button 
                  onClick={shareTienda} 
                  variant="outline"
                  size="lg"
                  className="rounded-full shadow-lg bg-white/50 dark:bg-slate-800/50 backdrop-blur-lg border-slate-300 dark:border-slate-600 hover:bg-white/80 dark:hover:bg-slate-800/80"
                >
                  <Share2 className="h-5 w-5 mr-2" />
                  Compartir Tienda
                </Button>
              </ClientOnly>
            </div>
          </div>

          <div className="mt-8 pt-6 border-t border-slate-200 dark:border-slate-700 grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            {tiendaConfig.telefono && (
              <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
                <Phone className="h-4 w-4 text-indigo-500" />
                <span>{tiendaConfig.telefono}</span>
              </div>
            )}
            {tiendaConfig.whatsapp && (
              <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
                <ShoppingCart className="h-4 w-4 text-indigo-500" />
                <span>WhatsApp: {tiendaConfig.whatsapp}</span>
              </div>
            )}
            {tiendaConfig.direccion && (
              <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
                <MapPin className="h-4 w-4 text-indigo-500" />
                <span>{tiendaConfig.direccion}</span>
              </div>
            )}
            {tiendaConfig.horarios && (
              <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
                <Clock className="h-4 w-4 text-indigo-500" />
                <span>{tiendaConfig.horarios}</span>
              </div>
            )}
          </div>

          {(tiendaConfig.redesSociales?.instagram || tiendaConfig.redesSociales?.facebook) && (
            <div className="mt-4 flex items-center gap-4">
              {tiendaConfig.redesSociales?.instagram && (
                <a 
                  href={`https://instagram.com/${tiendaConfig.redesSociales.instagram}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-slate-600 hover:text-pink-600 dark:text-slate-400 dark:hover:text-pink-500 transition-colors"
                >
                  <Instagram className="h-5 w-5" />
                  <span>@{tiendaConfig.redesSociales.instagram}</span>
                </a>
              )}
              {tiendaConfig.redesSociales?.facebook && (
                <a 
                  href={`https://facebook.com/${tiendaConfig.redesSociales.facebook}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-slate-600 hover:text-blue-600 dark:text-slate-400 dark:hover:text-blue-500 transition-colors"
                >
                  <Facebook className="h-5 w-5" />
                  <span>{tiendaConfig.redesSociales.facebook}</span>
                </a>
              )}
            </div>
          )}
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="flex flex-col md:flex-row gap-6 items-center justify-between mb-10">
          <h2 className="text-3xl font-bold text-slate-900 dark:text-white">Nuestro Catálogo</h2>
          <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
            <div className="relative flex-1 md:min-w-[250px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
              <Input
                placeholder="Buscar productos..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 py-2 rounded-full bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600"
              />
            </div>
            
            <Select value={filterCategoria} onValueChange={setFilterCategoria}>
              <SelectTrigger className="w-full sm:w-[200px] rounded-full bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600">
                <SelectValue placeholder="Todas las categorías" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas las categorías</SelectItem>
                {categorias.map((categoria) => (
                  <SelectItem key={categoria} value={categoria}>
                    {categoria}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {(searchTerm || (filterCategoria && filterCategoria !== "todas")) && (
              <Button variant="ghost" onClick={limpiarFiltros} size="sm" className="rounded-full">
                Limpiar filtros
              </Button>
            )}
          </div>
        </div>

        {productosFiltrados.length === 0 ? (
          <div className="text-center py-20">
            <div className="inline-block p-6 bg-indigo-100 dark:bg-indigo-500/20 rounded-full">
              <ShoppingCart className="h-20 w-20 text-indigo-500 dark:text-indigo-400" />
            </div>
            <h3 className="text-2xl font-semibold text-slate-900 dark:text-white mt-6">No se encontraron productos</h3>
            <p className="text-slate-600 dark:text-slate-400 mt-2">Intenta ajustar los filtros o revisa más tarde.</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
              {productosPaginados.map((producto) => (
                <Card key={producto.id} className="overflow-hidden rounded-xl border-0 bg-white/50 dark:bg-slate-800/50 backdrop-blur-lg shadow-lg transition-all duration-300 hover:shadow-2xl hover:-translate-y-2 flex flex-col">
                  <div className="relative">
                    <div className="aspect-video w-full overflow-hidden">
                      {producto.imagen ? (
                        <img
                          src={producto.imagen}
                          alt={producto.nombre}
                          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110"
                        />
                      ) : (
                        <div className="w-full h-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center">
                          <Image className="h-16 w-16 text-slate-400 dark:text-slate-500" />
                        </div>
                      )}
                    </div>
                    {producto.destacado && (
                      <Badge className="absolute top-3 left-3 bg-amber-400 text-amber-900 font-semibold py-1 px-3 rounded-full shadow-md">
                        Destacado
                      </Badge>
                    )}
                  </div>

                  <CardContent className="p-5 flex flex-col flex-grow">
                    <div className="space-y-3 flex-grow">
                      {producto.categoria && (
                        <Badge variant="outline" className="text-xs font-medium text-indigo-600 border-indigo-300 dark:text-indigo-400 dark:border-indigo-500/50">
                          {producto.categoria}
                        </Badge>
                      )}
                      <h3 className="font-bold text-xl text-slate-900 dark:text-white truncate">{producto.nombre}</h3>
                      <p className="text-sm text-slate-600 dark:text-slate-400 line-clamp-2 h-[40px]">
                        {producto.descripcion}
                      </p>
                      
                      <div className="flex items-baseline justify-between pt-2">
                        <span className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">
                          ${producto.precio}
                        </span>
                        <span className="text-sm text-slate-500 dark:text-slate-400">
                          Stock: {producto.stock}
                        </span>
                      </div>
                    </div>

                    <ClientOnly
                      fallback={
                        <Button className="w-full mt-4 font-semibold rounded-lg" size="lg" disabled>
                          <ShoppingCart className="h-5 w-5 mr-2" />
                          Comprar por WhatsApp
                        </Button>
                      }
                    >
                      <Button
                        className="w-full mt-4 font-semibold rounded-lg bg-green-600 hover:bg-green-700 text-white transition-transform transform hover:scale-105 shadow-md hover:shadow-lg"
                        size="lg"
                        onClick={() => {
                          if (!tiendaConfig.whatsapp) {
                            alert("No hay número de WhatsApp configurado para la tienda.")
                            return
                          }
                          const mensaje = generateWhatsAppMessage(producto)
                          const whatsappURL = `https://wa.me/${tiendaConfig.whatsapp}?text=${mensaje}`
                          window.open(whatsappURL, '_blank')
                        }}
                      >
                        <ShoppingCart className="h-5 w-5 mr-2" />
                        Comprar por WhatsApp
                      </Button>
                    </ClientOnly>
                  </CardContent>
                </Card>
              ))}
            </div>

            {totalPages > 1 && (
              <div className="flex justify-center mt-12">
                 <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} />
              </div>
            )}
          </>
        )}
      </main>

      <footer className="bg-white dark:bg-slate-800/50 border-t border-slate-200 dark:border-slate-700 mt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 text-center text-slate-500 dark:text-slate-400">
          <p className="text-sm">&copy; {new Date().getFullYear()} {tiendaConfig.nombre}. Todos los derechos reservados.</p>
          <p className="text-xs mt-2">Catálogo impulsado por ControlStock.</p>
        </div>
      </footer>
    </div>
  )
}
