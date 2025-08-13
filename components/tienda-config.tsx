"use client"

import { useState, useEffect } from "react"
import { ref, set, onValue } from "firebase/database"
import { database } from "@/lib/firebase"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { Settings, Save, Store, Phone, MapPin, Clock, MessageCircle } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

interface TiendaConfig {
  nombre: string
  descripcion: string
  telefono: string
  whatsapp: string
  direccion: string
  horarios: string
  logo: string
  email: string
  redesSociales: {
    facebook?: string
    instagram?: string
    twitter?: string
  }
}

interface User {
  uid: string
  phone?: string
  name?: string
  email?: string
}

export default function TiendaConfig({ user }: { user: User }) {
  const [showDialog, setShowDialog] = useState(false)
  const [config, setConfig] = useState<TiendaConfig>({
    nombre: "Mi Tienda",
    descripcion: "Los mejores productos al mejor precio",
    telefono: "",
    whatsapp: "",
    direccion: "",
    horarios: "",
    logo: "",
    email: "",
    redesSociales: {}
  })
  const { toast } = useToast()

  // Cargar configuración existente
  useEffect(() => {
    if (user?.uid) {
      const configRef = ref(database, `tiendas/${user.uid}/config`)
      const unsubscribe = onValue(configRef, (snapshot) => {
        const data = snapshot.val()
        if (data) {
          setConfig(prev => ({ ...prev, ...data }))
        }
      })
      return () => unsubscribe()
    }
  }, [user])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    try {
      await set(ref(database, `tiendas/${user.uid}/config`), config)
      toast({
        title: "Configuración guardada",
        description: "La configuración de tu tienda se guardó correctamente"
      })
      setShowDialog(false)
    } catch (error) {
      console.error("Error al guardar configuración:", error)
      toast({
        title: "Error",
        description: "No se pudo guardar la configuración",
        variant: "destructive"
      })
    }
  }

  const handleInputChange = (field: keyof TiendaConfig, value: string) => {
    setConfig(prev => ({ ...prev, [field]: value }))
  }

  const handleRedesSocialesChange = (red: string, value: string) => {
    setConfig(prev => ({
      ...prev,
      redesSociales: {
        ...prev.redesSociales,
        [red]: value
      }
    }))
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Configuración de Mi Tienda</h2>
          <p className="text-muted-foreground">
            Personaliza la información de tu tienda para compartir con clientes
          </p>
        </div>
        
        <Dialog open={showDialog} onOpenChange={setShowDialog}>
          <DialogTrigger asChild>
            <Button>
              <Settings className="h-4 w-4 mr-2" />
              Editar Configuración
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Configuración de la Tienda</DialogTitle>
            </DialogHeader>
            
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="nombre">Nombre de la Tienda *</Label>
                  <Input
                    id="nombre"
                    value={config.nombre}
                    onChange={(e) => handleInputChange('nombre', e.target.value)}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">Email de Contacto</Label>
                  <Input
                    id="email"
                    type="email"
                    value={config.email}
                    onChange={(e) => handleInputChange('email', e.target.value)}
                    placeholder="tu@email.com"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="telefono">Teléfono</Label>
                  <Input
                    id="telefono"
                    value={config.telefono}
                    onChange={(e) => handleInputChange('telefono', e.target.value)}
                    placeholder="+54 9 11 1234-5678"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="whatsapp">WhatsApp *</Label>
                  <Input
                    id="whatsapp"
                    value={config.whatsapp}
                    onChange={(e) => handleInputChange('whatsapp', e.target.value)}
                    placeholder="5491112345678"
                    required
                  />
                  <p className="text-xs text-muted-foreground">
                    Solo números, sin + ni espacios (ej: 5491112345678)
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="descripcion">Descripción de la Tienda</Label>
                <Textarea
                  id="descripcion"
                  value={config.descripcion}
                  onChange={(e) => handleInputChange('descripcion', e.target.value)}
                  rows={3}
                  placeholder="Describe tu tienda y los productos que ofreces..."
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="direccion">Dirección</Label>
                <Input
                  id="direccion"
                  value={config.direccion}
                  onChange={(e) => handleInputChange('direccion', e.target.value)}
                  placeholder="Av. Principal 123, Ciudad, Provincia"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="horarios">Horarios de Atención</Label>
                <Input
                  id="horarios"
                  value={config.horarios}
                  onChange={(e) => handleInputChange('horarios', e.target.value)}
                  placeholder="Lunes a Viernes 9:00 - 18:00, Sábados 9:00 - 13:00"
                />
              </div>

              <div className="space-y-4">
                <Label>Redes Sociales</Label>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="facebook">Facebook</Label>
                    <Input
                      id="facebook"
                      value={config.redesSociales.facebook || ""}
                      onChange={(e) => handleRedesSocialesChange('facebook', e.target.value)}
                      placeholder="https://facebook.com/tutienda"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="instagram">Instagram</Label>
                    <Input
                      id="instagram"
                      value={config.redesSociales.instagram || ""}
                      onChange={(e) => handleRedesSocialesChange('instagram', e.target.value)}
                      placeholder="https://instagram.com/tutienda"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="twitter">Twitter</Label>
                    <Input
                      id="twitter"
                      value={config.redesSociales.twitter || ""}
                      onChange={(e) => handleRedesSocialesChange('twitter', e.target.value)}
                      placeholder="https://twitter.com/tutienda"
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setShowDialog(false)}>
                  Cancelar
                </Button>
                <Button type="submit">
                  <Save className="h-4 w-4 mr-2" />
                  Guardar Configuración
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Vista previa de la configuración */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Información Básica</CardTitle>
            <Store className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="space-y-2">
            <div>
              <p className="text-sm font-medium">{config.nombre}</p>
              <p className="text-xs text-muted-foreground">{config.descripcion}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Contacto</CardTitle>
            <Phone className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="space-y-2">
            {config.telefono && (
              <div>
                <p className="text-sm font-medium">Teléfono</p>
                <p className="text-xs text-muted-foreground">{config.telefono}</p>
              </div>
            )}
            {config.whatsapp && (
              <div>
                <p className="text-sm font-medium">WhatsApp</p>
                <p className="text-xs text-muted-foreground">+{config.whatsapp}</p>
              </div>
            )}
            {config.email && (
              <div>
                <p className="text-sm font-medium">Email</p>
                <p className="text-xs text-muted-foreground">{config.email}</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Ubicación</CardTitle>
            <MapPin className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="space-y-2">
            {config.direccion && (
              <div>
                <p className="text-sm font-medium">Dirección</p>
                <p className="text-xs text-muted-foreground">{config.direccion}</p>
              </div>
            )}
            {config.horarios && (
              <div>
                <p className="text-sm font-medium">Horarios</p>
                <p className="text-xs text-muted-foreground">{config.horarios}</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Información importante */}
      <Card className="bg-blue-50 dark:bg-blue-950/20">
        <CardContent className="pt-6">
          <div className="flex items-start space-x-3">
            <MessageCircle className="h-5 w-5 text-blue-600 mt-0.5" />
            <div>
              <h3 className="font-semibold text-blue-900 dark:text-blue-100">
                Información Importante
              </h3>
              <ul className="mt-2 text-sm text-blue-800 dark:text-blue-200 space-y-1">
                <li>• El número de WhatsApp es obligatorio para que funcionen los botones de compra</li>
                <li>• Usa solo números en el WhatsApp (ej: 5491112345678)</li>
                <li>• Esta información se usará en los mensajes de WhatsApp que se envíen a tus clientes</li>
                <li>• Los enlaces de redes sociales aparecerán en tu tienda pública</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
} 