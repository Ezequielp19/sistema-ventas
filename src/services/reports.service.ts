export type SalesCollection = Record<string, any>

export interface SalesEntry {
  id: string
  fecha: Date
  total: number
  items?: Array<{
    id?: string
    nombre: string
    cantidad: number
    precio: number
  }>
  pagos?: Array<{
    metodo: string
    monto: string | number
  }>
  metodoPago?: string
  cliente?: string
}

export type ReportPeriod = "mes" | "trimestre" | "año"

const toNumber = (value: unknown) => {
  const parsedValue = typeof value === "number" ? value : Number.parseFloat(String(value ?? 0))
  return Number.isFinite(parsedValue) ? parsedValue : 0
}

const toSalesArray = (ventas: SalesCollection = {}): SalesEntry[] => {
  return Object.entries(ventas).map(([id, venta]: [string, any]) => ({
    id,
    ...venta,
    fecha: new Date(venta.fecha),
    total: toNumber(venta.total),
  }))
}

const getPeriodRange = (periodo: ReportPeriod, currentDate = new Date()) => {
  switch (periodo) {
    case "trimestre": {
      const quarter = Math.floor(currentDate.getMonth() / 3)
      return {
        start: new Date(currentDate.getFullYear(), quarter * 3, 1),
        end: new Date(currentDate.getFullYear(), (quarter + 1) * 3, 0),
      }
    }
    case "año":
      return {
        start: new Date(currentDate.getFullYear(), 0, 1),
        end: new Date(currentDate.getFullYear(), 11, 31),
      }
    case "mes":
    default:
      return {
        start: new Date(currentDate.getFullYear(), currentDate.getMonth(), 1),
        end: new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0),
      }
  }
}

const getPreviousPeriodRange = (periodo: ReportPeriod, currentDate = new Date()) => {
  switch (periodo) {
    case "año":
      return {
        start: new Date(currentDate.getFullYear() - 1, 0, 1),
        end: new Date(currentDate.getFullYear() - 1, 11, 31),
      }
    case "trimestre": {
      const quarter = Math.floor(currentDate.getMonth() / 3)
      const previousQuarterDate = new Date(currentDate.getFullYear(), quarter * 3 - 1, 1)
      return getPeriodRange("trimestre", previousQuarterDate)
    }
    case "mes":
    default:
      return {
        start: new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1),
        end: new Date(currentDate.getFullYear(), currentDate.getMonth(), 0),
      }
  }
}

const buildVentasPorDia = (ventas: SalesEntry[]) => {
  return ventas.reduce<Record<string, { total: number; cantidad: number }>>((accumulator, venta) => {
    const fecha = venta.fecha.toLocaleDateString("es-ES", {
      month: "short",
      day: "numeric",
    })

    if (accumulator[fecha]) {
      accumulator[fecha].total += venta.total
      accumulator[fecha].cantidad += 1
    } else {
      accumulator[fecha] = { total: venta.total, cantidad: 1 }
    }

    return accumulator
  }, {})
}

const buildMetodosPago = (ventas: SalesEntry[]) => {
  return ventas.reduce<Record<string, { total: number; cantidad: number }>>((accumulator, venta) => {
    if (venta.pagos && venta.pagos.length > 0) {
      venta.pagos.forEach((pago) => {
        const metodo = pago.metodo || "sin-metodo"
        const monto = toNumber(pago.monto)

        if (accumulator[metodo]) {
          accumulator[metodo].total += monto
          accumulator[metodo].cantidad += 1
        } else {
          accumulator[metodo] = { total: monto, cantidad: 1 }
        }
      })
      return accumulator
    }

    const metodo = venta.metodoPago || "sin-metodo"
    if (accumulator[metodo]) {
      accumulator[metodo].total += venta.total
      accumulator[metodo].cantidad += 1
    } else {
      accumulator[metodo] = { total: venta.total, cantidad: 1 }
    }

    return accumulator
  }, {})
}

const buildProductosVendidos = (ventas: SalesEntry[]) => {
  const productosVendidos: Record<string, { nombre: string; cantidad: number; total: number }> = {}

  ventas.forEach((venta) => {
    venta.items?.forEach((item) => {
      if (productosVendidos[item.id || item.nombre]) {
        const key = item.id || item.nombre
        productosVendidos[key].cantidad += item.cantidad
        productosVendidos[key].total += item.precio * item.cantidad
      } else {
        productosVendidos[item.id || item.nombre] = {
          nombre: item.nombre,
          cantidad: item.cantidad,
          total: item.precio * item.cantidad,
        }
      }
    })
  })

  return productosVendidos
}

export const buildMonthlySalesReport = (
  ventas: SalesCollection = {},
  selectedMonth: number,
  selectedYear: number,
) => {
  const ventasArray = toSalesArray(ventas)

  const ventasFiltradas = ventasArray.filter((venta) => {
    return (
      venta.fecha.getMonth() === selectedMonth &&
      venta.fecha.getFullYear() === selectedYear
    )
  })

  const totalVentas = ventasFiltradas.reduce((sum, venta) => sum + venta.total, 0)
  const cantidadVentas = ventasFiltradas.length
  const promedioVenta = cantidadVentas > 0 ? totalVentas / cantidadVentas : 0
  const productosVendidos = buildProductosVendidos(ventasFiltradas)

  const topProductos = Object.entries(productosVendidos)
    .sort(([, a], [, b]) => b.cantidad - a.cantidad)
    .slice(0, 5)

  const ventasPorDia = ventasFiltradas.reduce<Record<number, { total: number; cantidad: number }>>((accumulator, venta) => {
    const dia = venta.fecha.getDate()

    if (accumulator[dia]) {
      accumulator[dia].total += venta.total
      accumulator[dia].cantidad += 1
    } else {
      accumulator[dia] = {
        total: venta.total,
        cantidad: 1,
      }
    }

    return accumulator
  }, {})

  const metodosPago = buildMetodosPago(ventasFiltradas)

  const daysInMonth = new Date(selectedYear, selectedMonth + 1, 0).getDate()
  const diasDelMes = Array.from({ length: daysInMonth }, (_, index) => {
    const day = index + 1
    const ventasDelDia = ventasPorDia[day] || { total: 0, cantidad: 0 }
    return {
      dia: day,
      total: ventasDelDia.total,
      cantidad: ventasDelDia.cantidad,
    }
  })

  const maxVentaDia = Math.max(...diasDelMes.map((dia) => dia.total), 1)

  return {
    ventasArray,
    ventasFiltradas,
    metricas: {
      totalVentas,
      cantidadVentas,
      promedioVenta,
      topProductos,
      ventasPorDia,
      metodosPago,
    },
    diasDelMes,
    maxVentaDia,
  }
}

export const buildPeriodSalesReport = (
  ventas: SalesCollection = {},
  periodo: ReportPeriod,
) => {
  const ventasArray = toSalesArray(ventas)
  const currentDate = new Date()
  const { start, end } = getPeriodRange(periodo, currentDate)

  const ventasPeriodo = ventasArray.filter((venta) => venta.fecha >= start && venta.fecha <= end)

  const metricas = {
    totalVentas: ventasPeriodo.reduce((sum, venta) => sum + venta.total, 0),
    cantidadVentas: ventasPeriodo.length,
    promedioVenta:
      ventasPeriodo.length > 0
        ? ventasPeriodo.reduce((sum, venta) => sum + venta.total, 0) / ventasPeriodo.length
        : 0,
    productosVendidos: ventasPeriodo.reduce(
      (sum, venta) => sum + (venta.items?.reduce((itemsSum, item) => itemsSum + item.cantidad, 0) || 0),
      0,
    ),
  }

  const datosGrafico = ventasPeriodo.reduce<Record<string, { fecha: string; ventas: number; cantidad: number }>>(
    (accumulator, venta) => {
      const fecha = venta.fecha.toLocaleDateString("es-ES", {
        month: "short",
        day: "numeric",
      })

      if (accumulator[fecha]) {
        accumulator[fecha].ventas += venta.total
        accumulator[fecha].cantidad += 1
      } else {
        accumulator[fecha] = { fecha, ventas: venta.total, cantidad: 1 }
      }

      return accumulator
    },
    {},
  )

  return {
    ventasArray,
    ventasPeriodo,
    metricas,
    datosGrafico: Object.values(datosGrafico),
  }
}

export const buildComparisonSalesReport = (
  ventas: SalesCollection = {},
  periodo: ReportPeriod,
) => {
  const ventasArray = toSalesArray(ventas)
  const currentDate = new Date()
  const { start: currentStart, end: currentEnd } = getPeriodRange(periodo, currentDate)
  const { start: previousStart, end: previousEnd } = getPreviousPeriodRange(periodo, currentDate)

  const ventasActual = ventasArray.filter((venta) => venta.fecha >= currentStart && venta.fecha <= currentEnd)
  const ventasAnterior = ventasArray.filter((venta) => venta.fecha >= previousStart && venta.fecha <= previousEnd)

  const actual = {
    total: ventasActual.reduce((sum, venta) => sum + venta.total, 0),
    cantidad: ventasActual.length,
    promedio: ventasActual.length > 0 ? ventasActual.reduce((sum, venta) => sum + venta.total, 0) / ventasActual.length : 0,
  }

  const anterior = {
    total: ventasAnterior.reduce((sum, venta) => sum + venta.total, 0),
    cantidad: ventasAnterior.length,
    promedio:
      ventasAnterior.length > 0
        ? ventasAnterior.reduce((sum, venta) => sum + venta.total, 0) / ventasAnterior.length
        : 0,
  }

  const variaciones = {
    total: anterior.total > 0 ? ((actual.total - anterior.total) / anterior.total) * 100 : 0,
    cantidad: anterior.cantidad > 0 ? ((actual.cantidad - anterior.cantidad) / anterior.cantidad) * 100 : 0,
    promedio: anterior.promedio > 0 ? ((actual.promedio - anterior.promedio) / anterior.promedio) * 100 : 0,
  }

  return {
    ventasArray,
    actual,
    anterior,
    variaciones,
  }
}

export const buildSalesByPaymentMethod = (ventas: SalesCollection = {}) => {
  return buildMetodosPago(toSalesArray(ventas))
}

export const buildSalesByDay = (ventas: SalesCollection = {}) => {
  return buildVentasPorDia(toSalesArray(ventas))
}
