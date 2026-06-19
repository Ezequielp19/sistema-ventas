"use client"

import { useState, useMemo, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { BarChart3, TrendingUp, Calendar, DollarSign, ShoppingCart, Target } from "lucide-react"
import { Pagination } from "@/components/ui/pagination"
import ExportButtons from "./export-buttons"
import HelpTooltip from "./help-tooltip"
import { buildDailySalesReport, buildMonthlySalesReport } from "@/src/services/reports.service"

interface ReportesTabProps {
  ventas: Record<string, any>
  productos?: Record<string, any>
  proveedores?: Record<string, any>
}

export default function ReportesTab({ ventas, productos, proveedores }: ReportesTabProps) {
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth().toString())
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear().toString())

  // Paginación para la tabla de ventas
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 10

  // Estados para el modal de ventas del día
  const [selectedDay, setSelectedDay] = useState<{ dia: number; total: number; cantidad: number } | null>(null)
  const [showDayModal, setShowDayModal] = useState(false)
  const [ventasDelDiaSeleccionado, setVentasDelDiaSeleccionado] = useState<any[]>([])

  const monthlyReport = useMemo(
    () =>
      buildMonthlySalesReport(
        ventas || {},
        Number.parseInt(selectedMonth),
        Number.parseInt(selectedYear),
        productos || {},
      ),
    [ventas, selectedMonth, selectedYear, productos],
  ) as ReturnType<typeof buildMonthlySalesReport>

  const selectedDayReport = useMemo(() => {
    if (!selectedDay) {
      return null
    }

    return buildDailySalesReport(
      ventas || {},
      new Date(Number.parseInt(selectedYear), Number.parseInt(selectedMonth), selectedDay.dia),
      productos || {},
    )
  }, [ventas, selectedMonth, selectedYear, selectedDay, productos])

  const { ventasArray, ventasFiltradas, metricas, diasDelMes, maxVentaDia } = monthlyReport

  // Función para manejar click en día del calendario
  const handleDayClick = (dia: { dia: number; total: number; cantidad: number }) => {
    const ventasDelDia = ventasFiltradas.filter((venta) => venta.fecha.getDate() === dia.dia)
    if (ventasDelDia.length > 0) {
      setSelectedDay(dia)
      setVentasDelDiaSeleccionado(ventasDelDia)
      setShowDayModal(true)
    }
  }

  // Paginación para ventas
  const totalPages = Math.ceil(ventasFiltradas.length / itemsPerPage)
  const currentItems = ventasFiltradas
    .sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime())
    .slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)

  // Cuando cambian los filtros, volver a la primera página
  useEffect(() => {
    setCurrentPage(1)
  }, [selectedMonth, selectedYear])

  const meses = [
    "Enero",
    "Febrero",
    "Marzo",
    "Abril",
    "Mayo",
    "Junio",
    "Julio",
    "Agosto",
    "Septiembre",
    "Octubre",
    "Noviembre",
    "Diciembre",
  ]

  const años = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i)

  return (
    <div className="space-y-6">
      {/* Header con filtros */}
      <Card className="bg-gradient-to-r from-blue-600 to-purple-600 text-white">
        <CardHeader>
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div className="flex items-center gap-2">
              <div>
                <CardTitle className="text-white text-lg sm:text-xl">Reportes de Ventas</CardTitle>
                <p className="text-blue-100 text-xs sm:text-sm">Análisis detallado de ventas y métricas</p>
              </div>
              <HelpTooltip
                title="Ayuda - Reportes de Ventas"
                content={
                  <div className="space-y-3">
                    <div>
                      <h4 className="font-semibold text-blue-600">¿Qué puedes hacer aquí?</h4>
                      <ul className="list-disc list-inside space-y-1 mt-2">
                        <li><strong>Métricas generales:</strong> Total, cantidad y promedio de ventas</li>
                        <li><strong>Análisis por día:</strong> Gráfico de ventas diarias</li>
                        <li><strong>Top productos:</strong> Productos más vendidos</li>
                        <li><strong>Métodos de pago:</strong> Distribución por tipo de pago</li>
                        <li><strong>Detalle de ventas:</strong> Lista completa con paginación</li>
                        <li><strong>Exportar reportes:</strong> Descarga en PDF, Excel o CSV</li>
                      </ul>
                    </div>
                    <div>
                      <h4 className="font-semibold text-green-600">Funcionalidades principales:</h4>
                      <ul className="list-disc list-inside space-y-1 mt-2">
                        <li><strong>Filtros temporales:</strong> Por mes y año específico</li>
                        <li><strong>Gráficos interactivos:</strong> Visualización clara de datos</li>
                        <li><strong>Métricas en tiempo real:</strong> Datos actualizados automáticamente</li>
                        <li><strong>Análisis detallado:</strong> Click en días para ver ventas específicas</li>
                      </ul>
                    </div>
                    <div className="bg-blue-50 p-3 rounded-lg">
                      <p className="text-sm text-blue-800">
                        <strong>💡 Tip:</strong> Haz clic en cualquier día del gráfico para ver el detalle de las ventas de ese día específico.
                      </p>
                    </div>
                  </div>
                }
              />
            </div>
            <div className="flex flex-col sm:flex-row gap-2">
              <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                <SelectTrigger className="w-full sm:w-40 bg-white text-black">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {meses.map((mes, index) => (
                    <SelectItem key={index} value={index.toString()}>
                      {mes}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={selectedYear} onValueChange={setSelectedYear}>
                <SelectTrigger className="w-full sm:w-32 bg-white text-black">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {años.map((año) => (
                    <SelectItem key={año} value={año.toString()}>
                      {año}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Métricas principales */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        <Card className="bg-gradient-to-br from-green-500 to-green-600 text-white">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Ventas Totales</CardTitle>
            <DollarSign className="h-4 w-4" />
          </CardHeader>
          <CardContent>
            <div className="text-xl sm:text-2xl font-bold">${metricas.totalVentas.toFixed(2)}</div>
            <p className="text-xs text-green-100">
              {meses[Number.parseInt(selectedMonth)]} {selectedYear}
            </p>
          </CardContent>
        </Card>

        {/* Eliminado Costos Totales */}
        {/* Eliminado Ganancia Neta */}

        <Card className="bg-gradient-to-br from-blue-500 to-blue-600 text-white">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Cantidad de Ventas</CardTitle>
            <ShoppingCart className="h-4 w-4" />
          </CardHeader>
          <CardContent>
            <div className="text-xl sm:text-2xl font-bold">{metricas.cantidadVentas}</div>
            <p className="text-xs text-blue-100">Transacciones realizadas</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-purple-500 to-purple-600 text-white">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Promedio por Venta</CardTitle>
            <Target className="h-4 w-4" />
          </CardHeader>
          <CardContent>
            <div className="text-xl sm:text-2xl font-bold">${metricas.promedioVenta.toFixed(2)}</div>
            <p className="text-xs text-purple-100">Ticket promedio</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-orange-500 to-orange-600 text-white">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Ganancia Estimada</CardTitle>
            <TrendingUp className="h-4 w-4" />
          </CardHeader>
          <CardContent>
            <div className="text-xl sm:text-2xl font-bold">${metricas.gananciaEstimada.toFixed(2)}</div>
            <p className="text-xs text-orange-100">Calculada con costo de productos</p>
          </CardContent>
        </Card>
      </div>

      {/* Eliminado Resumen de Ganancias Destacado */}

      {/* Gráfico de ventas por día */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center text-base sm:text-lg">
            <Calendar className="h-4 w-4 sm:h-5 sm:w-5 mr-2" />
            <span className="hidden sm:inline">Ventas por Día - {meses[Number.parseInt(selectedMonth)]} {selectedYear}</span>
            <span className="sm:hidden">Ventas por Día</span>
          </CardTitle>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">💡 Haz clic en los días con ventas para ver el detalle</p>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 sm:space-y-4">
            <div className="grid grid-cols-7 gap-1 sm:gap-2 text-center text-xs sm:text-sm font-medium text-muted-foreground">
              <div>Dom</div>
              <div>Lun</div>
              <div>Mar</div>
              <div>Mié</div>
              <div>Jue</div>
              <div>Vie</div>
              <div>Sáb</div>
            </div>

            <div className="grid grid-cols-7 gap-1 sm:gap-2">
              {/* Espacios vacíos para el primer día del mes */}
              {Array.from({
                length: new Date(Number.parseInt(selectedYear), Number.parseInt(selectedMonth), 1).getDay(),
              }).map((_, i) => (
                <div key={i} className="h-14 sm:h-16 md:h-20"></div>
              ))}

              {/* Días del mes */}
              {diasDelMes.map((dia) => {
                return (
                  <div
                    key={dia.dia}
                    className={`h-14 sm:h-16 md:h-20 rounded-lg border-2 border-border p-1 sm:p-2 text-center transition-all ${
                      dia.total > 0
                        ? "bg-blue-100 dark:bg-blue-900 hover:bg-blue-200 dark:hover:bg-blue-800 cursor-pointer hover:border-blue-400 dark:hover:border-blue-600 hover:shadow-md transform hover:scale-105"
                        : "bg-muted"
                    }`}
                    onClick={() => dia.total > 0 && handleDayClick(dia)}
                    title={
                      dia.total > 0 ? `Clic para ver ${dia.cantidad} venta${dia.cantidad !== 1 ? "s" : ""} del día` : ""
                    }
                  >
                    <div className="font-bold text-xs sm:text-sm">{dia.dia}</div>
                    {dia.total > 0 && (
                      <>
                        <div className="text-[10px] sm:text-xs text-green-600 font-semibold">${dia.total.toFixed(0)}</div>
                        <div className="text-[10px] sm:text-xs text-muted-foreground">
                          {dia.cantidad} v{dia.cantidad !== 1 ? "s" : ""}
                        </div>
                      </>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top productos */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <TrendingUp className="h-5 w-5 mr-2" />
              Productos Más Vendidos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {metricas.topProductos.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">No hay ventas en este período</p>
              ) : (
                metricas.topProductos.map((producto, index) => (
                  <div key={producto.id} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                    <div className="flex items-center space-x-3">
                      <Badge variant="outline" className="w-8 h-8 rounded-full flex items-center justify-center">
                        {index + 1}
                      </Badge>
                      <div>
                        <div className="font-medium">{producto.nombre}</div>
                        <div className="text-sm text-muted-foreground">{producto.cantidad} unidades vendidas</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-green-600">${producto.total.toFixed(2)}</div>
                      {/* Eliminado Ganancia de producto individual */}
                      {/* <div className="text-xs text-muted-foreground">
                        Ganancia: ${(producto.total - producto.costo).toFixed(2)}
                      </div> */}
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        {/* Métodos de pago */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <DollarSign className="h-5 w-5 mr-2" />
              Métodos de Pago
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {Object.keys(metricas.metodosPago).length === 0 ? (
                <p className="text-muted-foreground text-center py-8">No hay datos de métodos de pago</p>
              ) : (
                Object.entries(metricas.metodosPago).map(([metodo, datos]) => {
                  const porcentaje = (datos.total / metricas.totalVentas) * 100
                  return (
                    <div key={metodo} className="space-y-2">
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <span className="font-medium capitalize">{metodo}</span>
                        <span className="text-sm text-muted-foreground">
                          ${datos.total.toFixed(2)} ({porcentaje.toFixed(1)}%)
                        </span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-blue-600 h-2 rounded-full transition-all"
                          style={{ width: `${porcentaje}%` }}
                        ></div>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {datos.cantidad} transacción{datos.cantidad !== 1 ? "es" : ""}
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabla detallada de ventas con paginación */}
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <CardTitle className="text-lg sm:text-xl">Detalle de Ventas del Período</CardTitle>
            <div className="w-full sm:w-auto">
              <ExportButtons 
                data={ventasFiltradas} 
                type="ventas" 
                title="Reporte de Ventas"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Vista Desktop - Tabla */}
          <div className="hidden lg:block rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Productos</TableHead>
                  <TableHead>Método de Pago</TableHead>
                  <TableHead>Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {currentItems.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                      No hay ventas en este período
                    </TableCell>
                  </TableRow>
                ) : (
                  currentItems.map((venta) => (
                    <TableRow key={venta.id}>
                      <TableCell>{venta.fecha.toLocaleDateString()}</TableCell>
                      <TableCell className="font-medium">{venta.cliente}</TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          {venta.items?.map((item, index) => (
                            <div key={index} className="text-sm">
                              {item.nombre} x{item.cantidad}
                            </div>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          {venta.pagos ? (
                            venta.pagos.map((pago, index) => (
                              <div key={index} className="flex items-center gap-2">
                                <Badge variant="outline" className="capitalize text-xs">
                                  {pago.metodo}
                                </Badge>
                                <span className="text-xs">${Number(pago.monto).toFixed(2)}</span>
                              </div>
                            ))
                          ) : (
                            <Badge variant="outline" className="capitalize">
                              {venta.metodoPago || "No especificado"}
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="font-bold">${venta.total?.toFixed(2)}</TableCell>
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
                No hay ventas en este período
              </div>
            ) : (
              currentItems.map((venta) => (
                <Card key={venta.id}>
                  <CardContent className="p-4">
                    <div className="space-y-3">
                      {/* Header con fecha y total */}
                      <div className="flex justify-between items-start gap-2">
                        <div className="flex-1">
                          <div className="text-xs text-muted-foreground">
                            {venta.fecha.toLocaleDateString()}
                          </div>
                          <h3 className="font-semibold text-base mt-1">{venta.cliente}</h3>
                        </div>
                        <div className="text-right">
                          <div className="text-lg font-bold">${venta.total?.toFixed(2)}</div>
                        </div>
                      </div>

                      {/* Productos */}
                      <div>
                        <div className="text-xs text-muted-foreground mb-1">Productos:</div>
                        <div className="space-y-1">
                          {venta.items?.map((item: any, index: number) => (
                            <div key={index} className="text-sm">
                              {item.nombre} x{item.cantidad}
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Métodos de pago */}
                      <div>
                        <div className="text-xs text-muted-foreground mb-1">Métodos de Pago:</div>
                        <div className="flex flex-wrap gap-2">
                          {venta.pagos ? (
                            venta.pagos.map((pago: any, index: number) => (
                              <div key={index} className="flex items-center space-x-1">
                                <Badge variant="outline" className="capitalize text-xs">
                                  {pago.metodo}
                                </Badge>
                                <span className="text-xs">${Number.parseFloat(pago.monto).toFixed(2)}</span>
                              </div>
                            ))
                          ) : (
                            <Badge variant="outline" className="capitalize text-xs">
                              {venta.metodoPago || "No especificado"}
                            </Badge>
                          )}
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

      {/* Modal para ventas del día */}
      <Dialog open={showDayModal} onOpenChange={setShowDayModal}>
        <DialogContent className="w-[95vw] sm:w-[90vw] md:max-w-4xl lg:max-w-5xl max-h-[90vh] overflow-y-auto p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle className="flex items-center text-base sm:text-lg">
              <Calendar className="h-4 w-4 sm:h-5 sm:w-5 mr-2" />
              <span className="hidden sm:inline">Ventas del {selectedDay?.dia} de {meses[Number.parseInt(selectedMonth)]} {selectedYear}</span>
              <span className="sm:hidden">Ventas del {selectedDay?.dia}</span>
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {/* Resumen del día */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
              <Card className="bg-blue-50 dark:bg-blue-950">
                <CardContent className="p-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                      {selectedDayReport?.metricas.cantidadVentas ?? ventasDelDiaSeleccionado.length}
                    </div>
                    <div className="text-sm text-blue-700 dark:text-blue-300">Ventas realizadas</div>
                  </div>
                </CardContent>
              </Card>
              <Card className="bg-green-50">
                <CardContent className="p-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-600">
                      ${selectedDayReport?.metricas.totalVentas.toFixed(2) ?? ventasDelDiaSeleccionado.reduce((sum, venta) => sum + venta.total, 0).toFixed(2)}
                    </div>
                    <div className="text-sm text-green-700">Total vendido</div>
                  </div>
                </CardContent>
              </Card>
              <Card className="bg-purple-50">
                <CardContent className="p-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-purple-600">
                      ${selectedDayReport?.metricas.gananciaEstimada.toFixed(2) ?? "0.00"}
                    </div>
                    <div className="text-sm text-purple-700">Ganancia estimada</div>
                  </div>
                </CardContent>
              </Card>
              <Card className="bg-orange-50">
                <CardContent className="p-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-orange-600">
                      {selectedDayReport?.metricas.productosVendidos ?? 0}
                    </div>
                    <div className="text-sm text-orange-700">Productos vendidos</div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Lista detallada de ventas */}
            <div className="space-y-3">
              <h3 className="font-semibold text-base sm:text-lg">Detalle de Ventas</h3>
              {ventasDelDiaSeleccionado.map((venta, index) => (
                <Card key={venta.id} className="border-l-4 border-l-blue-500">
                  <CardContent className="p-3 sm:p-4">
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 sm:gap-4">
                      {/* Información básica */}
                      <div>
                      <div className="flex items-center justify-between gap-2 mb-2">
                          <h4 className="font-semibold">Venta #{index + 1}</h4>
                          <Badge variant="outline">{new Date(venta.fecha).toLocaleTimeString()}</Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          <strong>Cliente:</strong> {venta.cliente}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          <strong>Total:</strong>{" "}
                          <span className="font-bold text-green-600">${venta.total.toFixed(2)}</span>
                        </p>
                      </div>

                      {/* Productos */}
                      <div>
                        <h5 className="font-medium mb-2">Productos:</h5>
                        <div className="space-y-1">
                          {venta.items?.map((item: any, itemIndex: number) => (
                            <div key={itemIndex} className="text-sm bg-muted p-2 rounded">
                              <div className="font-medium">{item.nombre}</div>
                              <div className="text-muted-foreground">
                                {item.cantidad} x ${item.precio.toFixed(2)} = $
                                {(item.cantidad * item.precio).toFixed(2)}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Métodos de pago */}
                      <div>
                        <h5 className="font-medium mb-2">Métodos de Pago:</h5>
                        <div className="space-y-1">
                          {venta.pagos ? (
                            venta.pagos.map((pago: any, pagoIndex: number) => (
                              <div
                                key={pagoIndex}
                                className="flex items-center justify-between gap-2 text-sm bg-muted p-2 rounded"
                              >
                                <Badge variant="outline" className="capitalize">
                                  {pago.metodo}
                                </Badge>
                                <span className="font-medium">${Number(pago.monto).toFixed(2)}</span>
                              </div>
                            ))
                          ) : (
                            <div className="flex items-center justify-between text-sm bg-muted p-2 rounded">
                              <Badge variant="outline" className="capitalize">
                                {venta.metodoPago || "No especificado"}
                              </Badge>
                              <span className="font-medium">${venta.total.toFixed(2)}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
