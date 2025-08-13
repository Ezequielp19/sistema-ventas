"use client"

import { useState, useEffect, useMemo } from "react"
import { ref, push, set, get } from "firebase/database"
import { database } from "@/lib/firebase"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { 
  FileText, 
  Download, 
  Mail, 
  Printer, 
  Plus, 
  Search, 
  Filter,
  Eye,
  Trash2,
  Settings,
  Calendar,
  User,
  Building,
  Phone,
  MapPin,
  CreditCard
} from "lucide-react"
import { Pagination } from "@/components/ui/pagination"
import ExportButtons from "./export-buttons"
import HelpTooltip from "./help-tooltip"
import { generarFacturaPDF } from "./factura-pdf-generator"
import { jsPDF } from "jspdf"
import autoTable from "jspdf-autotable"
import { generarFacturaEmail } from "./factura-pdf-generator"
import { useAuth } from "@/contexts/auth-context"

interface Factura {
  id: string
  numero: string
  fecha: string
  cliente: {
    nombre: string
    email?: string
    telefono?: string
    direccion?: string
    ruc?: string
  }
  items: Array<{
    nombre: string
    cantidad: number
    precio: number
    subtotal: number
  }>
  subtotal: number
  impuesto: number
  total: number
  metodoPago: string
  estado: 'pagada' | 'pendiente' | 'anulada'
  ventaId?: string
  observaciones?: string
}

interface FacturacionTabProps {
  ventas: any
  productos: any
  proveedores: any
}

export default function FacturacionTab({ ventas, productos, proveedores }: FacturacionTabProps) {
  const { user } = useAuth()
  const [facturas, setFacturas] = useState<Factura[]>([])
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [selectedVenta, setSelectedVenta] = useState<any>(null)
  const [selectedFactura, setSelectedFactura] = useState<Factura | null>(null)
  const [searchTerm, setSearchTerm] = useState("")
  const [filterEstado, setFilterEstado] = useState("")
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 10
  const [showEmailModal, setShowEmailModal] = useState(false)
  const [clienteEmail, setClienteEmail] = useState("")

  // Configuración de facturación
  const [configuracion, setConfiguracion] = useState({
    empresa: {
      nombre: "Mi Empresa",
      ruc: "12345678-9",
      direccion: "Dirección de la empresa",
      telefono: "+595 21 123 456",
      email: "info@miempresa.com"
    },
    factura: {
      prefijo: "FAC",
      numeracionAutomatica: true,
      incluirImpuesto: true,
      porcentajeImpuesto: 10,
      terminosCondiciones: "Términos y condiciones de la empresa"
    }
  })

  // Cargar facturas desde Firebase
  useEffect(() => {
    const cargarFacturas = async () => {
      if (!user?.id) return
      try {
        const facturasRef = ref(database, `usuarios/${user.id}/facturas`)
        const snapshot = await get(facturasRef)
        if (snapshot.exists()) {
          const facturasData = Object.entries(snapshot.val()).map(([id, factura]: [string, any]) => ({
            id,
            ...factura
          }))
          setFacturas(facturasData)
        } else {
          setFacturas([])
        }
      } catch (error) {
        console.error("Error al cargar facturas:", error)
      }
    }

    cargarFacturas()
  }, [user])

  // Generar número de factura automático
  const generarNumeroFactura = () => {
    const año = new Date().getFullYear()
    const facturasDelAño = facturas.filter(f => 
      f.numero.startsWith(`${configuracion.factura.prefijo}-${año}`)
    )
    const siguienteNumero = facturasDelAño.length + 1
    return `${configuracion.factura.prefijo}-${año}-${siguienteNumero.toString().padStart(4, '0')}`
  }

  // Crear factura desde venta
  const crearFacturaDesdeVenta = async () => {
    if (!selectedVenta || !user?.id) return

    const numeroFactura = generarNumeroFactura()
    
    const factura: Omit<Factura, 'id'> = {
      numero: numeroFactura,
      fecha: new Date().toISOString(),
      cliente: {
        nombre: selectedVenta.cliente,
        email: "",
        telefono: "",
        direccion: "",
        ruc: ""
      },
      items: selectedVenta.items?.map((item: any) => ({
        nombre: item.nombre,
        cantidad: item.cantidad,
        precio: item.precio,
        subtotal: item.precio * item.cantidad
      })) || [],
      subtotal: selectedVenta.total,
      impuesto: configuracion.factura.incluirImpuesto 
        ? (selectedVenta.total * configuracion.factura.porcentajeImpuesto) / 100 
        : 0,
      total: configuracion.factura.incluirImpuesto 
        ? selectedVenta.total + (selectedVenta.total * configuracion.factura.porcentajeImpuesto) / 100
        : selectedVenta.total,
      metodoPago: selectedVenta.metodoPago || "efectivo",
      estado: 'pagada',
      ventaId: selectedVenta.id,
      observaciones: ""
    }

    try {
      const newFacturaRef = await push(ref(database, `usuarios/${user.id}/facturas`), factura)
      const newFacturaId = newFacturaRef.key
      setFacturas(prev => [...prev, { id: newFacturaId, ...factura }])
      setShowCreateDialog(false)
      setSelectedVenta(null)
    } catch (error) {
      console.error("Error al crear factura:", error)
    }
  }

  // Filtrar facturas
  const facturasFiltradas = facturas.filter(factura => {
    const matchesSearch = !searchTerm || 
      factura.numero.toLowerCase().includes(searchTerm.toLowerCase()) ||
      factura.cliente.nombre.toLowerCase().includes(searchTerm.toLowerCase())
    
    const matchesEstado = !filterEstado || filterEstado === "all" || factura.estado === filterEstado

    return matchesSearch && matchesEstado
  })

  // Paginación
  const totalPages = Math.ceil(facturasFiltradas.length / itemsPerPage)
  const currentItems = facturasFiltradas.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)

  // Ventas sin facturar
  const ventasSinFacturar = Object.entries(ventas || {}).filter(([id, venta]: [string, any]) => {
    return !facturas.some(f => f.ventaId === id)
  }).map(([id, venta]) => ({ id, ...venta }))

  // Función para generar PDF de factura
  const descargarFacturaPDF = (factura: Factura) => {
    const facturaData = {
      numero: factura.numero,
      fecha: factura.fecha,
      cliente: factura.cliente,
      items: factura.items,
      subtotal: factura.subtotal,
      impuesto: factura.impuesto,
      total: factura.total,
      metodoPago: factura.metodoPago,
      empresa: configuracion.empresa,
      terminosCondiciones: configuracion.factura.terminosCondiciones,
      porcentajeImpuesto: configuracion.factura.porcentajeImpuesto
    }
    
    generarFacturaPDF(facturaData)
  }

  // Función para imprimir factura
  const imprimirFactura = (factura: Factura) => {
    const facturaData = {
      numero: factura.numero,
      fecha: factura.fecha,
      cliente: factura.cliente,
      items: factura.items,
      subtotal: factura.subtotal,
      impuesto: factura.impuesto,
      total: factura.total,
      metodoPago: factura.metodoPago,
      empresa: configuracion.empresa,
      terminosCondiciones: configuracion.factura.terminosCondiciones,
      porcentajeImpuesto: configuracion.factura.porcentajeImpuesto
    }
    
    // Generar PDF y abrir en nueva ventana para imprimir
    const doc = new jsPDF()
    
    // Configuración de página
    const pageWidth = doc.internal.pageSize.width
    const margin = 20
    
    let yPosition = margin

    // Encabezado de la empresa
    doc.setFontSize(20)
    doc.setFont('helvetica', 'bold')
    doc.text(facturaData.empresa.nombre, margin, yPosition)
    yPosition += 8

    doc.setFontSize(10)
    doc.setFont('helvetica', 'normal')
    doc.text(`RUC: ${facturaData.empresa.ruc}`, margin, yPosition)
    yPosition += 5
    doc.text(facturaData.empresa.direccion, margin, yPosition)
    yPosition += 5
    doc.text(`Tel: ${facturaData.empresa.telefono}`, margin, yPosition)
    yPosition += 5
    doc.text(`Email: ${facturaData.empresa.email}`, margin, yPosition)
    yPosition += 15

    // Título de factura y número
    doc.setFontSize(24)
    doc.setFont('helvetica', 'bold')
    doc.text('FACTURA', pageWidth - margin - 30, yPosition)
    yPosition += 10

    doc.setFontSize(12)
    doc.setFont('helvetica', 'normal')
    doc.text(`Número: ${facturaData.numero}`, pageWidth - margin - 30, yPosition)
    yPosition += 5
    doc.text(`Fecha: ${new Date(facturaData.fecha).toLocaleDateString('es-ES')}`, pageWidth - margin - 30, yPosition)
    yPosition += 15

    // Información del cliente
    doc.setFontSize(14)
    doc.setFont('helvetica', 'bold')
    doc.text('Cliente:', margin, yPosition)
    yPosition += 8

    doc.setFontSize(10)
    doc.setFont('helvetica', 'normal')
    doc.text(`Nombre: ${facturaData.cliente.nombre}`, margin, yPosition)
    yPosition += 5
    
    if (facturaData.cliente.ruc) {
      doc.text(`RUC: ${facturaData.cliente.ruc}`, margin, yPosition)
      yPosition += 5
    }
    
    if (facturaData.cliente.direccion) {
      doc.text(`Dirección: ${facturaData.cliente.direccion}`, margin, yPosition)
      yPosition += 5
    }
    
    if (facturaData.cliente.telefono) {
      doc.text(`Teléfono: ${facturaData.cliente.telefono}`, margin, yPosition)
      yPosition += 5
    }
    
    if (facturaData.cliente.email) {
      doc.text(`Email: ${facturaData.cliente.email}`, margin, yPosition)
      yPosition += 5
    }

    yPosition += 10

    // Tabla de productos
    doc.setFontSize(14)
    doc.setFont('helvetica', 'bold')
    doc.text('Productos:', margin, yPosition)
    yPosition += 8

    const tableData = facturaData.items.map(item => [
      item.nombre,
      item.cantidad.toString(),
      `$${item.precio.toFixed(2)}`,
      `$${item.subtotal.toFixed(2)}`
    ])

    autoTable(doc, {
      head: [['Producto', 'Cantidad', 'Precio', 'Subtotal']],
      body: tableData,
      startY: yPosition,
      styles: {
        fontSize: 10,
        cellPadding: 3,
      },
      headStyles: {
        fillColor: [66, 139, 202],
        textColor: 255,
        fontStyle: 'bold',
      },
      alternateRowStyles: {
        fillColor: [245, 245, 245],
      },
      columnStyles: {
        1: { halign: 'center' },
        2: { halign: 'right' },
        3: { halign: 'right' }
      }
    })

    // Obtener la posición Y después de la tabla
    const finalY = (doc as any).lastAutoTable.finalY + 10

    // Totales
    const totalX = pageWidth - margin - 80
    let totalY = finalY

    doc.setFontSize(10)
    doc.setFont('helvetica', 'normal')
    doc.text('Subtotal:', totalX, totalY)
    doc.text(`$${facturaData.subtotal.toFixed(2)}`, pageWidth - margin, totalY)
    totalY += 5

    if (facturaData.impuesto > 0) {
      doc.text(`Impuesto (${facturaData.porcentajeImpuesto}%):`, totalX, totalY)
      doc.text(`$${facturaData.impuesto.toFixed(2)}`, pageWidth - margin, totalY)
      totalY += 5
    }

    doc.setFontSize(12)
    doc.setFont('helvetica', 'bold')
    doc.text('Total:', totalX, totalY)
    doc.text(`$${facturaData.total.toFixed(2)}`, pageWidth - margin, totalY)
    totalY += 10

    // Método de pago
    doc.setFontSize(10)
    doc.setFont('helvetica', 'normal')
    doc.text(`Método de Pago: ${facturaData.metodoPago}`, margin, totalY)
    totalY += 15

    // Términos y condiciones
    if (facturaData.terminosCondiciones) {
      doc.setFontSize(10)
      doc.setFont('helvetica', 'bold')
      doc.text('Términos y Condiciones:', margin, totalY)
      totalY += 5

      doc.setFontSize(8)
      doc.setFont('helvetica', 'normal')
      
      // Dividir el texto en líneas que quepan en el ancho de la página
      const maxWidth = pageWidth - (margin * 2)
      const lines = doc.splitTextToSize(facturaData.terminosCondiciones, maxWidth)
      
      lines.forEach((line: string) => {
        doc.text(line, margin, totalY)
        totalY += 4
      })
    }

    // Pie de página
    const pageHeight = doc.internal.pageSize.height
    doc.setFontSize(8)
    doc.setFont('helvetica', 'italic')
    doc.text('Documento generado automáticamente', margin, pageHeight - 10)
    doc.text(`Fecha de generación: ${new Date().toLocaleString('es-ES')}`, pageWidth - margin - 60, pageHeight - 10)

    // Abrir PDF en nueva ventana para imprimir
    const pdfBlob = doc.output('blob')
    const pdfUrl = URL.createObjectURL(pdfBlob)
    const printWindow = window.open(pdfUrl, '_blank')
    
    if (printWindow) {
      printWindow.onload = () => {
        printWindow.print()
      }
    }
  }

  // Función para enviar factura por WhatsApp
  const enviarFacturaWhatsApp = (factura: Factura) => {
    const facturaData = {
      numero: factura.numero,
      fecha: factura.fecha,
      cliente: factura.cliente,
      items: factura.items,
      subtotal: factura.subtotal,
      impuesto: factura.impuesto,
      total: factura.total,
      metodoPago: factura.metodoPago,
      empresa: configuracion.empresa,
      terminosCondiciones: configuracion.factura.terminosCondiciones,
      porcentajeImpuesto: configuracion.factura.porcentajeImpuesto
    }
    
    // Verificar si el cliente tiene teléfono
    if (!factura.cliente.telefono) {
      setClienteEmail("")
      setShowEmailModal(true)
      return
    }
    
    enviarWhatsApp(facturaData, factura.cliente.telefono)
  }

  // Función auxiliar para enviar WhatsApp
  const enviarWhatsApp = (facturaData: any, telefonoCliente: string) => {
    // Generar mensaje de WhatsApp
    const mensaje = generarMensajeWhatsApp({
      ...facturaData,
      cliente: { ...facturaData.cliente, telefono: telefonoCliente }
    })
    
    // Crear el enlace de WhatsApp con el mensaje prellenado
    const mensajeCodificado = encodeURIComponent(mensaje)
    const whatsappUrl = `https://wa.me/${telefonoCliente.replace(/\D/g, '')}?text=${mensajeCodificado}`
    
    // Abrir WhatsApp Web o la app
    window.open(whatsappUrl, '_blank')
  }

  // Función para generar mensaje de WhatsApp
  const generarMensajeWhatsApp = (facturaData: any) => {
    const mensaje = `🧾 *FACTURA ${facturaData.numero}*

🏢 *${facturaData.empresa.nombre}*
📅 Fecha: ${new Date(facturaData.fecha).toLocaleDateString('es-ES')}

👤 *Cliente:* ${facturaData.cliente.nombre}

📋 *Productos:*
${facturaData.items.map((item: any) => 
  `• ${item.nombre} x${item.cantidad} - $${item.precio.toFixed(2)}`
).join('\n')}

💰 *Totales:*
Subtotal: $${facturaData.subtotal.toFixed(2)}
${facturaData.impuesto > 0 ? `Impuesto (${facturaData.porcentajeImpuesto}%): $${facturaData.impuesto.toFixed(2)}` : ''}
*TOTAL: $${facturaData.total.toFixed(2)}*

💳 Método de Pago: ${facturaData.metodoPago}

📞 ${facturaData.empresa.telefono}
📧 ${facturaData.empresa.email}

*Gracias por su compra!* 🎉`

    return mensaje
  }

  // Función para confirmar envío de WhatsApp desde modal
  const confirmarEnvioWhatsApp = () => {
    if (!clienteEmail || clienteEmail.length < 8) {
      alert('Por favor, ingresa un número de teléfono válido.')
      return
    }
    
    if (!selectedFactura) return
    
    const facturaData = {
      numero: selectedFactura.numero,
      fecha: selectedFactura.fecha,
      cliente: selectedFactura.cliente,
      items: selectedFactura.items,
      subtotal: selectedFactura.subtotal,
      impuesto: selectedFactura.impuesto,
      total: selectedFactura.total,
      metodoPago: selectedFactura.metodoPago,
      empresa: configuracion.empresa,
      terminosCondiciones: configuracion.factura.terminosCondiciones,
      porcentajeImpuesto: configuracion.factura.porcentajeImpuesto
    }
    
    enviarWhatsApp(facturaData, clienteEmail)
    setShowEmailModal(false)
    setClienteEmail("")
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-2">
          <div>
            <h2 className="text-2xl font-bold">Sistema de Facturación</h2>
            <p className="text-muted-foreground">Genera y gestiona facturas automáticamente</p>
          </div>
          <HelpTooltip
            title="Ayuda - Sistema de Facturación"
            content={
              <div className="space-y-3">
                <div>
                  <h4 className="font-semibold text-blue-600">¿Qué puedes hacer aquí?</h4>
                  <ul className="list-disc list-inside space-y-1 mt-2">
                    <li><strong>Generar facturas:</strong> Crear facturas automáticas desde ventas</li>
                    <li><strong>Numeración automática:</strong> Secuencial por año</li>
                    <li><strong>Plantillas personalizables:</strong> Diseño profesional</li>
                    <li><strong>Exportación:</strong> PDF, email, impresión</li>
                    <li><strong>Gestión completa:</strong> Historial y estados</li>
                  </ul>
                </div>
                <div>
                  <h4 className="font-semibold text-green-600">Funcionalidades principales:</h4>
                  <ul className="list-disc list-inside space-y-1 mt-2">
                    <li><strong>Configuración empresarial:</strong> Datos de la empresa</li>
                    <li><strong>Impuestos automáticos:</strong> Cálculo de IVA</li>
                    <li><strong>Estados de factura:</strong> Pagada, pendiente, anulada</li>
                    <li><strong>Búsqueda y filtros:</strong> Encontrar facturas rápidamente</li>
                  </ul>
                </div>
                <div className="bg-blue-50 p-3 rounded-lg">
                  <p className="text-sm text-blue-800">
                    <strong>💡 Tip:</strong> Configura los datos de tu empresa en la pestaña de configuración para que aparezcan en todas las facturas.
                  </p>
                </div>
              </div>
            }
          />
        </div>
      </div>

      {/* Tabs principales */}
      <Tabs defaultValue="facturas" className="space-y-4">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="facturas">Facturas</TabsTrigger>
          <TabsTrigger value="generar">Generar Factura</TabsTrigger>
          <TabsTrigger value="configuracion">Configuración</TabsTrigger>
        </TabsList>

        <TabsContent value="facturas" className="space-y-6">
          {/* Filtros */}
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por número o cliente..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-8"
                />
              </div>
            </div>
            <Select value={filterEstado} onValueChange={setFilterEstado}>
              <SelectTrigger className="w-full sm:w-48">
                <SelectValue placeholder="Filtrar por estado" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los estados</SelectItem>
                <SelectItem value="pagada">Pagada</SelectItem>
                <SelectItem value="pendiente">Pendiente</SelectItem>
                <SelectItem value="anulada">Anulada</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Tabla de facturas */}
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <CardTitle>Historial de Facturas</CardTitle>
                <ExportButtons 
                  data={facturasFiltradas} 
                  type="reportes" 
                  title="Reporte de Facturas"
                />
              </div>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Número</TableHead>
                      <TableHead>Fecha</TableHead>
                      <TableHead>Cliente</TableHead>
                      <TableHead>Total</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead>Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {currentItems.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="h-24 text-center">
                          No se encontraron facturas
                        </TableCell>
                      </TableRow>
                    ) : (
                      currentItems.map((factura) => (
                        <TableRow key={factura.id}>
                          <TableCell className="font-medium">{factura.numero}</TableCell>
                          <TableCell>{new Date(factura.fecha).toLocaleDateString()}</TableCell>
                          <TableCell>{factura.cliente.nombre}</TableCell>
                          <TableCell className="font-bold">${factura.total.toFixed(2)}</TableCell>
                          <TableCell>
                            <Badge 
                              variant={
                                factura.estado === 'pagada' ? 'default' :
                                factura.estado === 'pendiente' ? 'secondary' : 'destructive'
                              }
                            >
                              {factura.estado}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex space-x-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setSelectedFactura(factura)}
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => descargarFacturaPDF(factura)}
                              >
                                <Download className="h-4 w-4" />
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
                <div className="mt-4 flex justify-center">
                  <Pagination
                    currentPage={currentPage}
                    totalPages={totalPages}
                    onPageChange={setCurrentPage}
                  />
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="generar" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Generar Factura desde Venta</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <Label>Seleccionar Venta</Label>
                  <Select onValueChange={(value) => {
                    const venta = ventasSinFacturar.find(v => v.id === value)
                    setSelectedVenta(venta)
                  }}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecciona una venta sin facturar" />
                    </SelectTrigger>
                    <SelectContent>
                      {ventasSinFacturar.map((venta) => (
                        <SelectItem key={venta.id} value={venta.id}>
                          {venta.cliente} - ${venta.total.toFixed(2)} - {new Date(venta.fecha).toLocaleDateString()}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {selectedVenta && (
                  <div className="space-y-4 p-4 bg-muted rounded-lg">
                    <h4 className="font-semibold">Detalles de la Venta</h4>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="font-medium">Cliente:</span> {selectedVenta.cliente}
                      </div>
                      <div>
                        <span className="font-medium">Fecha:</span> {new Date(selectedVenta.fecha).toLocaleDateString()}
                      </div>
                      <div>
                        <span className="font-medium">Total:</span> ${selectedVenta.total.toFixed(2)}
                      </div>
                      <div>
                        <span className="font-medium">Método de Pago:</span> {selectedVenta.metodoPago}
                      </div>
                    </div>
                    
                    <div>
                      <span className="font-medium">Productos:</span>
                      <ul className="mt-2 space-y-1">
                        {selectedVenta.items?.map((item: any, index: number) => (
                          <li key={index} className="text-sm">
                            {item.nombre} x{item.cantidad} - ${item.precio.toFixed(2)}
                          </li>
                        ))}
                      </ul>
                    </div>

                    <Button onClick={crearFacturaDesdeVenta} className="w-full">
                      <FileText className="h-4 w-4 mr-2" />
                      Generar Factura
                    </Button>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="configuracion" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Configuración de Facturación</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {/* Datos de la empresa */}
                <div>
                  <h4 className="font-semibold mb-4 flex items-center gap-2">
                    <Building className="h-4 w-4" />
                    Datos de la Empresa
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="empresa-nombre">Nombre de la Empresa</Label>
                      <Input
                        id="empresa-nombre"
                        value={configuracion.empresa.nombre}
                        onChange={(e) => setConfiguracion({
                          ...configuracion,
                          empresa: { ...configuracion.empresa, nombre: e.target.value }
                        })}
                      />
                    </div>
                    <div>
                      <Label htmlFor="empresa-ruc">RUC</Label>
                      <Input
                        id="empresa-ruc"
                        value={configuracion.empresa.ruc}
                        onChange={(e) => setConfiguracion({
                          ...configuracion,
                          empresa: { ...configuracion.empresa, ruc: e.target.value }
                        })}
                      />
                    </div>
                    <div>
                      <Label htmlFor="empresa-telefono">Teléfono</Label>
                      <Input
                        id="empresa-telefono"
                        value={configuracion.empresa.telefono}
                        onChange={(e) => setConfiguracion({
                          ...configuracion,
                          empresa: { ...configuracion.empresa, telefono: e.target.value }
                        })}
                      />
                    </div>
                    <div>
                      <Label htmlFor="empresa-email">Email</Label>
                      <Input
                        id="empresa-email"
                        type="email"
                        value={configuracion.empresa.email}
                        onChange={(e) => setConfiguracion({
                          ...configuracion,
                          empresa: { ...configuracion.empresa, email: e.target.value }
                        })}
                      />
                    </div>
                    <div className="md:col-span-2">
                      <Label htmlFor="empresa-direccion">Dirección</Label>
                      <Input
                        id="empresa-direccion"
                        value={configuracion.empresa.direccion}
                        onChange={(e) => setConfiguracion({
                          ...configuracion,
                          empresa: { ...configuracion.empresa, direccion: e.target.value }
                        })}
                      />
                    </div>
                  </div>
                </div>

                {/* Configuración de factura */}
                <div>
                  <h4 className="font-semibold mb-4 flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    Configuración de Factura
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="factura-prefijo">Prefijo de Factura</Label>
                      <Input
                        id="factura-prefijo"
                        value={configuracion.factura.prefijo}
                        onChange={(e) => setConfiguracion({
                          ...configuracion,
                          factura: { ...configuracion.factura, prefijo: e.target.value }
                        })}
                      />
                    </div>
                    <div>
                      <Label htmlFor="factura-impuesto">Porcentaje de Impuesto (%)</Label>
                      <Input
                        id="factura-impuesto"
                        type="number"
                        value={configuracion.factura.porcentajeImpuesto}
                        onChange={(e) => setConfiguracion({
                          ...configuracion,
                          factura: { ...configuracion.factura, porcentajeImpuesto: Number(e.target.value) }
                        })}
                      />
                    </div>
                    <div className="md:col-span-2">
                      <Label htmlFor="factura-terminos">Términos y Condiciones</Label>
                      <Input
                        id="factura-terminos"
                        value={configuracion.factura.terminosCondiciones}
                        onChange={(e) => setConfiguracion({
                          ...configuracion,
                          factura: { ...configuracion.factura, terminosCondiciones: e.target.value }
                        })}
                      />
                    </div>
                  </div>
                </div>

                <Button className="w-full">
                  <Settings className="h-4 w-4 mr-2" />
                  Guardar Configuración
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Modal de Vista de Factura */}
      {selectedFactura && (
        <Dialog open={!!selectedFactura} onOpenChange={() => setSelectedFactura(null)}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Factura {selectedFactura.numero}</DialogTitle>
            </DialogHeader>
            <div className="space-y-6">
              {/* Encabezado */}
              <div className="grid grid-cols-2 gap-8">
                <div>
                  <h3 className="font-bold text-lg">{configuracion.empresa.nombre}</h3>
                  <p className="text-sm text-muted-foreground">RUC: {configuracion.empresa.ruc}</p>
                  <p className="text-sm text-muted-foreground">{configuracion.empresa.direccion}</p>
                  <p className="text-sm text-muted-foreground">Tel: {configuracion.empresa.telefono}</p>
                  <p className="text-sm text-muted-foreground">Email: {configuracion.empresa.email}</p>
                </div>
                <div className="text-right">
                  <h3 className="font-bold text-lg">FACTURA</h3>
                  <p className="text-sm">Número: {selectedFactura.numero}</p>
                  <p className="text-sm">Fecha: {new Date(selectedFactura.fecha).toLocaleDateString()}</p>
                  <Badge variant={selectedFactura.estado === 'pagada' ? 'default' : 'secondary'}>
                    {selectedFactura.estado}
                  </Badge>
                </div>
              </div>

              {/* Cliente */}
              <div>
                <h4 className="font-semibold mb-2">Cliente</h4>
                <div className="p-4 bg-muted rounded-lg">
                  <p className="font-medium">{selectedFactura.cliente.nombre}</p>
                  {selectedFactura.cliente.ruc && <p className="text-sm">RUC: {selectedFactura.cliente.ruc}</p>}
                  {selectedFactura.cliente.direccion && <p className="text-sm">{selectedFactura.cliente.direccion}</p>}
                  {selectedFactura.cliente.telefono && <p className="text-sm">Tel: {selectedFactura.cliente.telefono}</p>}
                  {selectedFactura.cliente.email && <p className="text-sm">Email: {selectedFactura.cliente.email}</p>}
                </div>
              </div>

              {/* Productos */}
              <div>
                <h4 className="font-semibold mb-2">Productos</h4>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Producto</TableHead>
                      <TableHead className="text-right">Cantidad</TableHead>
                      <TableHead className="text-right">Precio</TableHead>
                      <TableHead className="text-right">Subtotal</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {selectedFactura.items.map((item, index) => (
                      <TableRow key={index}>
                        <TableCell>{item.nombre}</TableCell>
                        <TableCell className="text-right">{item.cantidad}</TableCell>
                        <TableCell className="text-right">${item.precio.toFixed(2)}</TableCell>
                        <TableCell className="text-right">${item.subtotal.toFixed(2)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Totales */}
              <div className="flex justify-end">
                <div className="w-64 space-y-2">
                  <div className="flex justify-between">
                    <span>Subtotal:</span>
                    <span>${selectedFactura.subtotal.toFixed(2)}</span>
                  </div>
                  {selectedFactura.impuesto > 0 && (
                    <div className="flex justify-between">
                      <span>Impuesto ({configuracion.factura.porcentajeImpuesto}%):</span>
                      <span>${selectedFactura.impuesto.toFixed(2)}</span>
                    </div>
                  )}
                  <div className="flex justify-between font-bold text-lg border-t pt-2">
                    <span>Total:</span>
                    <span>${selectedFactura.total.toFixed(2)}</span>
                  </div>
                </div>
              </div>

              {/* Observaciones */}
              {selectedFactura.observaciones && (
                <div>
                  <h4 className="font-semibold mb-2">Observaciones</h4>
                  <p className="text-sm text-muted-foreground">{selectedFactura.observaciones}</p>
                </div>
              )}

              {/* Términos */}
              <div>
                <h4 className="font-semibold mb-2">Términos y Condiciones</h4>
                <p className="text-sm text-muted-foreground">{configuracion.factura.terminosCondiciones}</p>
              </div>

              {/* Acciones */}
              <div className="flex justify-end space-x-2">
                <Button variant="outline" onClick={() => imprimirFactura(selectedFactura)}>
                  <Printer className="h-4 w-4 mr-2" />
                  Imprimir
                </Button>
                <Button variant="outline" onClick={() => descargarFacturaPDF(selectedFactura)}>
                  <Download className="h-4 w-4 mr-2" />
                  Descargar PDF
                </Button>
                <Button variant="outline" onClick={() => enviarFacturaWhatsApp(selectedFactura)}>
                  <Phone className="h-4 w-4 mr-2" />
                  Enviar por WhatsApp
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Modal para confirmar envío de email */}
      {showEmailModal && (
        <Dialog open={showEmailModal} onOpenChange={setShowEmailModal}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Enviar Factura por Email</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">
                  El cliente <strong>{selectedFactura?.cliente.nombre}</strong> no tiene un teléfono configurado.
                </p>
                <p className="text-sm text-muted-foreground">
                  Ingresa el número de teléfono del cliente para enviar la factura {selectedFactura?.numero}:
                </p>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="cliente-email">Número de Teléfono del Cliente</Label>
                <Input
                  id="cliente-email"
                  type="tel"
                  placeholder="Ej: +595 99 123 456"
                  value={clienteEmail}
                  onChange={(e) => setClienteEmail(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      confirmarEnvioWhatsApp()
                    }
                  }}
                />
              </div>
              
              <div className="flex justify-end space-x-2">
                <Button variant="outline" onClick={() => setShowEmailModal(false)}>
                  Cancelar
                </Button>
                <Button onClick={confirmarEnvioWhatsApp} disabled={!clienteEmail || clienteEmail.length < 8}>
                  <Phone className="h-4 w-4 mr-2" />
                  Enviar WhatsApp
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
} 