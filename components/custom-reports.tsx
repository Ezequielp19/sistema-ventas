"use client"

import { useState, useMemo } from "react"
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
  BarChart3, 
  TrendingUp, 
  TrendingDown, 
  Calendar, 
  DollarSign, 
  ShoppingCart, 
  Target,
  Plus,
  Settings,
  Save,
  Trash2,
  Eye
} from "lucide-react"
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import ExportButtons from "./export-buttons"
import AdvancedComparisons from "./advanced-comparisons"
import HelpTooltip from "./help-tooltip"

interface CustomReport {
  id: string
  nombre: string
  descripcion: string
  tipo: 'ventas' | 'productos' | 'comparativa'
  configuracion: {
    periodo: 'mes' | 'trimestre' | 'año'
    comparacion: boolean
    metricas: string[]
    filtros: any
  }
  fechaCreacion: string
}

interface CustomReportsProps {
  ventas: any
  productos: any
  proveedores: any
}

export default function CustomReports({ ventas, productos, proveedores }: CustomReportsProps) {
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [selectedReport, setSelectedReport] = useState<CustomReport | null>(null)
  const [reports, setReports] = useState<CustomReport[]>([])
  const [activeTab, setActiveTab] = useState("reportes")
  
  // Estados para crear reporte
  const [newReport, setNewReport] = useState({
    nombre: "",
    descripcion: "",
    tipo: "ventas" as const,
    periodo: "mes" as const,
    comparacion: false,
    metricas: [] as string[],
    filtros: {}
  })

  // Procesar datos de ventas
  const ventasArray = Object.entries(ventas || {}).map(([id, venta]) => ({
    id,
    ...venta,
    fecha: new Date(venta.fecha),
  }))

  // Función para crear reporte personalizado
  const createCustomReport = () => {
    const report: CustomReport = {
      id: Date.now().toString(),
      nombre: newReport.nombre,
      descripcion: newReport.descripcion,
      tipo: newReport.tipo,
      configuracion: {
        periodo: newReport.periodo,
        comparacion: newReport.comparacion,
        metricas: newReport.metricas,
        filtros: newReport.filtros
      },
      fechaCreacion: new Date().toISOString()
    }

    setReports([...reports, report])
    setShowCreateDialog(false)
    resetNewReport()
  }

  const resetNewReport = () => {
    setNewReport({
      nombre: "",
      descripcion: "",
      tipo: "ventas",
      periodo: "mes",
      comparacion: false,
      metricas: [],
      filtros: {}
    })
  }

  // Función para eliminar reporte
  const deleteReport = (id: string) => {
    setReports(reports.filter(r => r.id !== id))
  }

  // Función para generar datos del reporte
  const generateReportData = (report: CustomReport) => {
    const currentDate = new Date()
    let startDate: Date
    let endDate: Date

    // Calcular fechas según el período
    switch (report.configuracion.periodo) {
      case 'mes':
        startDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1)
        endDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0)
        break
      case 'trimestre':
        const quarter = Math.floor(currentDate.getMonth() / 3)
        startDate = new Date(currentDate.getFullYear(), quarter * 3, 1)
        endDate = new Date(currentDate.getFullYear(), (quarter + 1) * 3, 0)
        break
      case 'año':
        startDate = new Date(currentDate.getFullYear(), 0, 1)
        endDate = new Date(currentDate.getFullYear(), 11, 31)
        break
      default:
        startDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1)
        endDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0)
    }

    // Filtrar ventas por período
    const ventasPeriodo = ventasArray.filter(venta => 
      venta.fecha >= startDate && venta.fecha <= endDate
    )

    // Calcular métricas
    const metricas = {
      totalVentas: ventasPeriodo.reduce((sum, v) => sum + v.total, 0),
      cantidadVentas: ventasPeriodo.length,
      promedioVenta: ventasPeriodo.length > 0 ? ventasPeriodo.reduce((sum, v) => sum + v.total, 0) / ventasPeriodo.length : 0,
      productosVendidos: ventasPeriodo.reduce((sum, v) => sum + (v.items?.reduce((s, i) => s + i.cantidad, 0) || 0), 0)
    }

    // Datos para gráficos
    const datosGrafico = ventasPeriodo.reduce((acc, venta) => {
      const fecha = venta.fecha.toLocaleDateString('es-ES', { 
        month: 'short', 
        day: 'numeric' 
      })
      
      if (acc[fecha]) {
        acc[fecha].ventas += venta.total
        acc[fecha].cantidad += 1
      } else {
        acc[fecha] = { fecha, ventas: venta.total, cantidad: 1 }
      }
      return acc
    }, {} as Record<string, any>)

    return {
      metricas,
      datosGrafico: Object.values(datosGrafico),
      ventasPeriodo
    }
  }

  // Función para comparar períodos
  const generateComparisonData = (report: CustomReport) => {
    const currentDate = new Date()
    let currentPeriod: { start: Date, end: Date }
    let previousPeriod: { start: Date, end: Date }

    // Calcular períodos actual y anterior
    switch (report.configuracion.periodo) {
      case 'mes':
        currentPeriod = {
          start: new Date(currentDate.getFullYear(), currentDate.getMonth(), 1),
          end: new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0)
        }
        previousPeriod = {
          start: new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1),
          end: new Date(currentDate.getFullYear(), currentDate.getMonth(), 0)
        }
        break
      case 'año':
        currentPeriod = {
          start: new Date(currentDate.getFullYear(), 0, 1),
          end: new Date(currentDate.getFullYear(), 11, 31)
        }
        previousPeriod = {
          start: new Date(currentDate.getFullYear() - 1, 0, 1),
          end: new Date(currentDate.getFullYear() - 1, 11, 31)
        }
        break
      default:
        currentPeriod = {
          start: new Date(currentDate.getFullYear(), currentDate.getMonth(), 1),
          end: new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0)
        }
        previousPeriod = {
          start: new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1),
          end: new Date(currentDate.getFullYear(), currentDate.getMonth(), 0)
        }
    }

    // Filtrar ventas por períodos
    const ventasActual = ventasArray.filter(v => v.fecha >= currentPeriod.start && v.fecha <= currentPeriod.end)
    const ventasAnterior = ventasArray.filter(v => v.fecha >= previousPeriod.start && v.fecha <= previousPeriod.end)

    // Calcular métricas comparativas
    const actual = {
      total: ventasActual.reduce((sum, v) => sum + v.total, 0),
      cantidad: ventasActual.length,
      promedio: ventasActual.length > 0 ? ventasActual.reduce((sum, v) => sum + v.total, 0) / ventasActual.length : 0
    }

    const anterior = {
      total: ventasAnterior.reduce((sum, v) => sum + v.total, 0),
      cantidad: ventasAnterior.length,
      promedio: ventasAnterior.length > 0 ? ventasAnterior.reduce((sum, v) => sum + v.total, 0) / ventasAnterior.length : 0
    }

    // Calcular variaciones
    const variaciones = {
      total: anterior.total > 0 ? ((actual.total - anterior.total) / anterior.total) * 100 : 0,
      cantidad: anterior.cantidad > 0 ? ((actual.cantidad - anterior.cantidad) / anterior.cantidad) * 100 : 0,
      promedio: anterior.promedio > 0 ? ((actual.promedio - anterior.promedio) / anterior.promedio) * 100 : 0
    }

    return { actual, anterior, variaciones }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-2">
          <div>
            <h2 className="text-2xl font-bold">Reportes Personalizados</h2>
            <p className="text-muted-foreground">Crea y gestiona tus propios reportes con comparativas</p>
          </div>
          <HelpTooltip
            title="Ayuda - Reportes Personalizados"
            content={
              <div className="space-y-3">
                <div>
                  <h4 className="font-semibold text-blue-600">¿Qué puedes hacer aquí?</h4>
                  <ul className="list-disc list-inside space-y-1 mt-2">
                    <li><strong>Crear reportes personalizados:</strong> Configura tus propios análisis</li>
                    <li><strong>Comparativas avanzadas:</strong> Análisis de múltiples períodos</li>
                    <li><strong>Gestión de reportes:</strong> Guarda, edita y elimina reportes</li>
                    <li><strong>Exportación:</strong> Descarga reportes en PDF, Excel o CSV</li>
                    <li><strong>Gráficos interactivos:</strong> Visualizaciones profesionales</li>
                  </ul>
                </div>
                <div>
                  <h4 className="font-semibold text-green-600">Tipos de reportes:</h4>
                  <ul className="list-disc list-inside space-y-1 mt-2">
                    <li><strong>Ventas:</strong> Análisis de ventas por período</li>
                    <li><strong>Productos:</strong> Análisis de productos y stock</li>
                    <li><strong>Comparativa:</strong> Comparación entre períodos</li>
                    <li><strong>Períodos:</strong> Mensual, trimestral y anual</li>
                  </ul>
                </div>
                <div className="bg-blue-50 p-3 rounded-lg">
                  <p className="text-sm text-blue-800">
                    <strong>💡 Tip:</strong> Usa las comparativas avanzadas para analizar tendencias y patrones en tus datos de ventas.
                  </p>
                </div>
              </div>
            }
          />
        </div>
      </div>

      {/* Tabs principales */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="reportes">Reportes Personalizados</TabsTrigger>
          <TabsTrigger value="comparativas">Comparativas Avanzadas</TabsTrigger>
        </TabsList>

        <TabsContent value="reportes" className="space-y-6">
          {/* Header de reportes */}
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-xl font-semibold">Mis Reportes</h3>
              <p className="text-muted-foreground">Reportes personalizados guardados</p>
            </div>
            <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
              <DialogTrigger asChild>
                <Button onClick={resetNewReport}>
                  <Plus className="h-4 w-4 mr-2" />
                  Nuevo Reporte
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>Crear Reporte Personalizado</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="nombre">Nombre del Reporte</Label>
                      <Input
                        id="nombre"
                        value={newReport.nombre}
                        onChange={(e) => setNewReport({...newReport, nombre: e.target.value})}
                        placeholder="Ej: Ventas Mensuales"
                      />
                    </div>
                    <div>
                      <Label htmlFor="tipo">Tipo de Reporte</Label>
                      <Select value={newReport.tipo} onValueChange={(value: any) => setNewReport({...newReport, tipo: value})}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="ventas">Ventas</SelectItem>
                          <SelectItem value="productos">Productos</SelectItem>
                          <SelectItem value="comparativa">Comparativa</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="descripcion">Descripción</Label>
                    <Input
                      id="descripcion"
                      value={newReport.descripcion}
                      onChange={(e) => setNewReport({...newReport, descripcion: e.target.value})}
                      placeholder="Descripción del reporte"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="periodo">Período</Label>
                      <Select value={newReport.periodo} onValueChange={(value: any) => setNewReport({...newReport, periodo: value})}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="mes">Mensual</SelectItem>
                          <SelectItem value="trimestre">Trimestral</SelectItem>
                          <SelectItem value="año">Anual</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id="comparacion"
                        checked={newReport.comparacion}
                        onChange={(e) => setNewReport({...newReport, comparacion: e.target.checked})}
                      />
                      <Label htmlFor="comparacion">Incluir comparativa</Label>
                    </div>
                  </div>
                  <div className="flex justify-end space-x-2">
                    <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
                      Cancelar
                    </Button>
                    <Button onClick={createCustomReport}>
                      <Save className="h-4 w-4 mr-2" />
                      Crear Reporte
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          {/* Lista de Reportes */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {reports.map((report) => {
              const reportData = generateReportData(report)
              const comparisonData = report.configuracion.comparacion ? generateComparisonData(report) : null

              return (
                <Card key={report.id} className="hover:shadow-lg transition-shadow">
                  <CardHeader>
                    <div className="flex justify-between items-start">
                      <div>
                        <CardTitle className="text-lg">{report.nombre}</CardTitle>
                        <p className="text-sm text-muted-foreground">{report.descripcion}</p>
                      </div>
                      <div className="flex space-x-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setSelectedReport(report)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => deleteReport(report.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Badge variant="outline">{report.tipo}</Badge>
                      <Badge variant="secondary">{report.configuracion.periodo}</Badge>
                      {report.configuracion.comparacion && (
                        <Badge variant="default">Comparativa</Badge>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div>
                          <p className="text-muted-foreground">Total Ventas</p>
                          <p className="font-semibold">${reportData.metricas.totalVentas.toFixed(2)}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Cantidad</p>
                          <p className="font-semibold">{reportData.metricas.cantidadVentas}</p>
                        </div>
                      </div>
                      {comparisonData && (
                        <div className="space-y-1">
                          <p className="text-xs text-muted-foreground">Variación vs período anterior</p>
                          <div className="flex items-center space-x-2">
                            <span className={`text-sm font-medium ${
                              comparisonData.variaciones.total > 0 ? 'text-green-600' : 'text-red-600'
                            }`}>
                              {comparisonData.variaciones.total > 0 ? '+' : ''}{comparisonData.variaciones.total.toFixed(1)}%
                            </span>
                            {comparisonData.variaciones.total > 0 ? (
                              <TrendingUp className="h-3 w-3 text-green-600" />
                            ) : (
                              <TrendingDown className="h-3 w-3 text-red-600" />
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </TabsContent>

        <TabsContent value="comparativas" className="space-y-6">
          <AdvancedComparisons ventas={ventas} productos={productos} proveedores={proveedores} />
        </TabsContent>
      </Tabs>

      {/* Modal de Vista Detallada */}
      {selectedReport && (
        <Dialog open={!!selectedReport} onOpenChange={() => setSelectedReport(null)}>
          <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{selectedReport.nombre}</DialogTitle>
            </DialogHeader>
            <Tabs defaultValue="resumen" className="w-full">
              <TabsList>
                <TabsTrigger value="resumen">Resumen</TabsTrigger>
                <TabsTrigger value="graficos">Gráficos</TabsTrigger>
                <TabsTrigger value="detalle">Detalle</TabsTrigger>
                {selectedReport.configuracion.comparacion && (
                  <TabsTrigger value="comparativa">Comparativa</TabsTrigger>
                )}
              </TabsList>

              <TabsContent value="resumen" className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  {(() => {
                    const data = generateReportData(selectedReport)
                    return (
                      <>
                        <Card>
                          <CardContent className="p-4">
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="text-sm font-medium text-muted-foreground">Total Ventas</p>
                                <p className="text-2xl font-bold">${data.metricas.totalVentas.toFixed(2)}</p>
                              </div>
                              <DollarSign className="h-8 w-8 text-green-500" />
                            </div>
                          </CardContent>
                        </Card>
                        <Card>
                          <CardContent className="p-4">
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="text-sm font-medium text-muted-foreground">Cantidad Ventas</p>
                                <p className="text-2xl font-bold">{data.metricas.cantidadVentas}</p>
                              </div>
                              <ShoppingCart className="h-8 w-8 text-blue-500" />
                            </div>
                          </CardContent>
                        </Card>
                        <Card>
                          <CardContent className="p-4">
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="text-sm font-medium text-muted-foreground">Promedio</p>
                                <p className="text-2xl font-bold">${data.metricas.promedioVenta.toFixed(2)}</p>
                              </div>
                              <Target className="h-8 w-8 text-purple-500" />
                            </div>
                          </CardContent>
                        </Card>
                        <Card>
                          <CardContent className="p-4">
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="text-sm font-medium text-muted-foreground">Productos Vendidos</p>
                                <p className="text-2xl font-bold">{data.metricas.productosVendidos}</p>
                              </div>
                              <BarChart3 className="h-8 w-8 text-orange-500" />
                            </div>
                          </CardContent>
                        </Card>
                      </>
                    )
                  })()}
                </div>
              </TabsContent>

              <TabsContent value="graficos" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Evolución de Ventas</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={300}>
                      <LineChart data={generateReportData(selectedReport).datosGrafico}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="fecha" />
                        <YAxis />
                        <Tooltip />
                        <Legend />
                        <Line type="monotone" dataKey="ventas" stroke="#8884d8" strokeWidth={2} />
                      </LineChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="detalle" className="space-y-4">
                <div className="flex justify-between items-center">
                  <h3 className="text-lg font-semibold">Detalle de Ventas</h3>
                  <ExportButtons 
                    data={generateReportData(selectedReport).ventasPeriodo} 
                    type="ventas" 
                    title={selectedReport.nombre}
                  />
                </div>
                <Card>
                  <CardContent className="p-0">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Fecha</TableHead>
                          <TableHead>Cliente</TableHead>
                          <TableHead>Productos</TableHead>
                          <TableHead>Total</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {generateReportData(selectedReport).ventasPeriodo.map((venta) => (
                          <TableRow key={venta.id}>
                            <TableCell>{venta.fecha.toLocaleDateString()}</TableCell>
                            <TableCell>{venta.cliente}</TableCell>
                            <TableCell>
                              {venta.items?.map((item, index) => (
                                <div key={index} className="text-sm">
                                  {item.nombre} x{item.cantidad}
                                </div>
                              ))}
                            </TableCell>
                            <TableCell className="font-bold">${venta.total?.toFixed(2)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              </TabsContent>

              {selectedReport.configuracion.comparacion && (
                <TabsContent value="comparativa" className="space-y-4">
                  <AdvancedComparisons 
                    actual={generateComparisonData(selectedReport).actual} 
                    anterior={generateComparisonData(selectedReport).anterior} 
                    variaciones={generateComparisonData(selectedReport).variaciones} 
                  />
                </TabsContent>
              )}
            </Tabs>
          </DialogContent>
        </Dialog>
      )}

      {/* Mensaje cuando no hay reportes */}
      {reports.length === 0 && (
        <Card>
          <CardContent className="p-8 text-center">
            <BarChart3 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No hay reportes personalizados</h3>
            <p className="text-muted-foreground mb-4">
              Crea tu primer reporte personalizado para analizar tus datos de manera más detallada
            </p>
            <Button onClick={() => setShowCreateDialog(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Crear Primer Reporte
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  )
} 