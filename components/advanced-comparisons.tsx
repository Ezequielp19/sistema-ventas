"use client"

import { useState, useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  ShoppingCart, 
  Target,
  Calendar,
  BarChart3,
  ArrowUpRight,
  ArrowDownRight,
  Minus
} from "lucide-react"
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'

interface AdvancedComparisonsProps {
  ventas: any
  productos: any
  proveedores: any
}

export default function AdvancedComparisons({ ventas, productos, proveedores }: AdvancedComparisonsProps) {
  const [comparisonType, setComparisonType] = useState<'mes' | 'trimestre' | 'año'>('mes')
  const [selectedPeriods, setSelectedPeriods] = useState<number>(3)

  // Procesar datos de ventas
  const ventasArray = Object.entries(ventas || {}).map(([id, venta]) => ({
    id,
    ...venta,
    fecha: new Date(venta.fecha),
  }))

  // Función para obtener datos de múltiples períodos
  const getPeriodData = (periods: number) => {
    const currentDate = new Date()
    const data = []

    for (let i = periods - 1; i >= 0; i--) {
      let startDate: Date
      let endDate: Date
      let periodName: string

      switch (comparisonType) {
        case 'mes':
          startDate = new Date(currentDate.getFullYear(), currentDate.getMonth() - i, 1)
          endDate = new Date(currentDate.getFullYear(), currentDate.getMonth() - i + 1, 0)
          periodName = startDate.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })
          break
        case 'trimestre':
          const quarter = Math.floor((currentDate.getMonth() - i * 3) / 3)
          const year = currentDate.getFullYear() - Math.floor(i * 3 / 12)
          startDate = new Date(year, quarter * 3, 1)
          endDate = new Date(year, (quarter + 1) * 3, 0)
          periodName = `Q${quarter + 1} ${year}`
          break
        case 'año':
          const yearValue = currentDate.getFullYear() - i
          startDate = new Date(yearValue, 0, 1)
          endDate = new Date(yearValue, 11, 31)
          periodName = yearValue.toString()
          break
      }

      const ventasPeriodo = ventasArray.filter(venta => 
        venta.fecha >= startDate && venta.fecha <= endDate
      )

      const metricas = {
        total: ventasPeriodo.reduce((sum, v) => sum + v.total, 0),
        cantidad: ventasPeriodo.length,
        promedio: ventasPeriodo.length > 0 ? ventasPeriodo.reduce((sum, v) => sum + v.total, 0) / ventasPeriodo.length : 0,
        productosVendidos: ventasPeriodo.reduce((sum, v) => sum + (v.items?.reduce((s, i) => s + i.cantidad, 0) || 0), 0)
      }

      data.push({
        periodo: periodName,
        ...metricas,
        startDate,
        endDate
      })
    }

    return data
  }

  const periodData = useMemo(() => getPeriodData(selectedPeriods), [selectedPeriods, comparisonType, ventasArray])

  // Calcular variaciones
  const calculateVariations = () => {
    const variations = []
    
    for (let i = 1; i < periodData.length; i++) {
      const current = periodData[i]
      const previous = periodData[i - 1]
      
      const variation = {
        periodo: current.periodo,
        total: previous.total > 0 ? ((current.total - previous.total) / previous.total) * 100 : 0,
        cantidad: previous.cantidad > 0 ? ((current.cantidad - previous.cantidad) / previous.cantidad) * 100 : 0,
        promedio: previous.promedio > 0 ? ((current.promedio - previous.promedio) / previous.promedio) * 100 : 0
      }
      
      variations.push(variation)
    }
    
    return variations
  }

  const variations = calculateVariations()

  // Datos para gráficos
  const chartData = periodData.map(item => ({
    periodo: item.periodo,
    total: item.total,
    cantidad: item.cantidad,
    promedio: item.promedio
  }))

  // Top productos por período
  const getTopProducts = () => {
    const productSales = {}
    
    ventasArray.forEach(venta => {
      venta.items?.forEach(item => {
        if (productSales[item.nombre]) {
          productSales[item.nombre] += item.cantidad
        } else {
          productSales[item.nombre] = item.cantidad
        }
      })
    })

    return Object.entries(productSales)
      .map(([nombre, cantidad]) => ({ nombre, cantidad }))
      .sort((a, b) => b.cantidad - a.cantidad)
      .slice(0, 5)
  }

  const topProducts = getTopProducts()

  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8']

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Comparativas Avanzadas</h2>
          <p className="text-muted-foreground">Análisis detallado de múltiples períodos</p>
        </div>
        <div className="flex items-center space-x-4">
          <Select value={comparisonType} onValueChange={(value: any) => setComparisonType(value)}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="mes">Mensual</SelectItem>
              <SelectItem value="trimestre">Trimestral</SelectItem>
              <SelectItem value="año">Anual</SelectItem>
            </SelectContent>
          </Select>
          <Select value={selectedPeriods.toString()} onValueChange={(value) => setSelectedPeriods(Number(value))}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="3">3 períodos</SelectItem>
              <SelectItem value="6">6 períodos</SelectItem>
              <SelectItem value="12">12 períodos</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Métricas por período */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Evolución de Ventas</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="periodo" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="total" stroke="#8884d8" strokeWidth={2} name="Total Ventas" />
                <Line type="monotone" dataKey="cantidad" stroke="#82ca9d" strokeWidth={2} name="Cantidad Ventas" />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Comparación de Períodos</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="periodo" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="total" fill="#8884d8" name="Total Ventas" />
                <Bar dataKey="promedio" fill="#82ca9d" name="Promedio" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Tabla de comparación */}
      <Card>
        <CardHeader>
          <CardTitle>Detalle por Período</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-2">Período</th>
                  <th className="text-right p-2">Total Ventas</th>
                  <th className="text-right p-2">Cantidad</th>
                  <th className="text-right p-2">Promedio</th>
                  <th className="text-right p-2">Productos</th>
                  <th className="text-center p-2">Variación</th>
                </tr>
              </thead>
              <tbody>
                {periodData.map((period, index) => {
                  const variation = variations[index - 1]
                  return (
                    <tr key={period.periodo} className="border-b hover:bg-muted/50">
                      <td className="p-2 font-medium">{period.periodo}</td>
                      <td className="p-2 text-right">${period.total.toFixed(2)}</td>
                      <td className="p-2 text-right">{period.cantidad}</td>
                      <td className="p-2 text-right">${period.promedio.toFixed(2)}</td>
                      <td className="p-2 text-right">{period.productosVendidos}</td>
                      <td className="p-2 text-center">
                        {variation ? (
                          <div className="flex items-center justify-center space-x-1">
                            <span className={`text-sm font-medium ${
                              variation.total > 0 ? 'text-green-600' : variation.total < 0 ? 'text-red-600' : 'text-gray-600'
                            }`}>
                              {variation.total > 0 ? '+' : ''}{variation.total.toFixed(1)}%
                            </span>
                            {variation.total > 0 ? (
                              <ArrowUpRight className="h-3 w-3 text-green-600" />
                            ) : variation.total < 0 ? (
                              <ArrowDownRight className="h-3 w-3 text-red-600" />
                            ) : (
                              <Minus className="h-3 w-3 text-gray-600" />
                            )}
                          </div>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Top productos */}
      <Card>
        <CardHeader>
          <CardTitle>Top 5 Productos Más Vendidos</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={topProducts}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ nombre, porcentaje }) => `${nombre} (${porcentaje}%)`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="cantidad"
                  >
                    {topProducts.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="space-y-3">
              {topProducts.map((product, index) => (
                <div key={product.nombre} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                  <div className="flex items-center space-x-3">
                    <div className="w-4 h-4 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                    <span className="font-medium">{product.nombre}</span>
                  </div>
                  <Badge variant="secondary">{product.cantidad} unidades</Badge>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Resumen de variaciones */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {(() => {
          const latestVariation = variations[variations.length - 1]
          if (!latestVariation) return null

          return (
            <>
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Variación Total</p>
                      <p className={`text-2xl font-bold ${
                        latestVariation.total > 0 ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {latestVariation.total > 0 ? '+' : ''}{latestVariation.total.toFixed(1)}%
                      </p>
                    </div>
                    {latestVariation.total > 0 ? (
                      <TrendingUp className="h-8 w-8 text-green-500" />
                    ) : (
                      <TrendingDown className="h-8 w-8 text-red-500" />
                    )}
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Variación Cantidad</p>
                      <p className={`text-2xl font-bold ${
                        latestVariation.cantidad > 0 ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {latestVariation.cantidad > 0 ? '+' : ''}{latestVariation.cantidad.toFixed(1)}%
                      </p>
                    </div>
                    {latestVariation.cantidad > 0 ? (
                      <ShoppingCart className="h-8 w-8 text-green-500" />
                    ) : (
                      <ShoppingCart className="h-8 w-8 text-red-500" />
                    )}
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Variación Promedio</p>
                      <p className={`text-2xl font-bold ${
                        latestVariation.promedio > 0 ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {latestVariation.promedio > 0 ? '+' : ''}{latestVariation.promedio.toFixed(1)}%
                      </p>
                    </div>
                    {latestVariation.promedio > 0 ? (
                      <Target className="h-8 w-8 text-green-500" />
                    ) : (
                      <Target className="h-8 w-8 text-red-500" />
                    )}
                  </div>
                </CardContent>
              </Card>
            </>
          )
        })()}
      </div>
    </div>
  )
} 