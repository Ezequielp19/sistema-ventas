import { normalizeCatalogProduct, type ProductRecord } from "@/lib/product-sync"

export type SalesCollection = Record<string, any>
export type ProductCollection = Record<string, ProductRecord>

export interface SalesReportPayment {
  metodo: string
  monto: number
}

export interface SalesReportItem {
  id: string
  productId: string
  nombre: string
  cantidad: number
  precioUnitario: number
  subtotal: number
  costoUnitario: number
  ganancia: number
}

export interface SalesEntry {
  id: string
  fecha: Date
  date: string
  timestamp: string
  total: number
  subtotal: number
  descuento: number
  createdAt: string
  updatedAt: string
  items: SalesReportItem[]
  pagos: SalesReportPayment[]
  metodoPago?: string
  cliente?: string
  gananciaEstimada: number
}

export type ReportPeriod = "mes" | "trimestre" | "año"

type TopProductSummary = {
  id: string
  nombre: string
  cantidad: number
  total: number
  ganancia: number
}

type SalesTotals = {
  totalVentas: number
  cantidadVentas: number
  promedioVenta: number
  productosVendidos: number
  gananciaEstimada: number
  topProductos: TopProductSummary[]
  ventasPorDia: Record<string, { total: number; cantidad: number; ganancia: number }>
  metodosPago: Record<string, { total: number; cantidad: number }>
}

export type MonthlySalesReport = {
  ventasArray: SalesEntry[]
  ventasFiltradas: SalesEntry[]
  metricas: SalesTotals
  diasDelMes: Array<{
    dia: number
    total: number
    cantidad: number
    ganancia: number
  }>
  maxVentaDia: number
}

export type PeriodSalesReport = {
  ventasArray: SalesEntry[]
  ventasPeriodo: SalesEntry[]
  metricas: Pick<
    SalesTotals,
    "totalVentas" | "cantidadVentas" | "promedioVenta" | "productosVendidos" | "gananciaEstimada" | "topProductos"
  >
  datosGrafico: Array<{
    fecha: string
    ventas: number
    cantidad: number
    ganancia: number
  }>
}

export type ComparisonSalesReport = {
  ventasArray: SalesEntry[]
  actual: {
    total: number
    cantidad: number
    promedio: number
    gananciaEstimada: number
  }
  anterior: {
    total: number
    cantidad: number
    promedio: number
    gananciaEstimada: number
  }
  variaciones: {
    total: number
    cantidad: number
    promedio: number
    gananciaEstimada: number
  }
}

const toNumber = (value: unknown, fallback = 0) => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value
  }

  if (typeof value === "string" && value.trim() !== "") {
    const parsedValue = Number(value)
    return Number.isFinite(parsedValue) ? parsedValue : fallback
  }

  const parsedValue = Number(value)
  return Number.isFinite(parsedValue) ? parsedValue : fallback
}

const toStringValue = (value: unknown, fallback = "") => {
  if (typeof value === "string") {
    return value.trim()
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value)
  }

  if (typeof value === "boolean") {
    return value ? "true" : "false"
  }

  return fallback
}

const isPlainObject = (value: unknown): value is Record<string, unknown> => {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

const toDateValue = (value: unknown): Date | null => {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value
  }

  if (typeof value === "string" && value.trim() !== "") {
    const parsedDate = new Date(value)
    if (!Number.isNaN(parsedDate.getTime())) {
      return parsedDate
    }

    const numericValue = Number(value)
    if (Number.isFinite(numericValue)) {
      const numericDate = new Date(numericValue)
      if (!Number.isNaN(numericDate.getTime())) {
        return numericDate
      }
    }
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    const numericDate = new Date(value)
    if (!Number.isNaN(numericDate.getTime())) {
      return numericDate
    }
  }

  if (value && typeof value === "object") {
    const maybeTimestamp = value as {
      toDate?: () => Date
      seconds?: number
      _seconds?: number
    }

    if (typeof maybeTimestamp.toDate === "function") {
      const timestampDate = maybeTimestamp.toDate()
      if (!Number.isNaN(timestampDate.getTime())) {
        return timestampDate
      }
    }

    if (typeof maybeTimestamp.seconds === "number") {
      const secondsDate = new Date(maybeTimestamp.seconds * 1000)
      if (!Number.isNaN(secondsDate.getTime())) {
        return secondsDate
      }
    }

    if (typeof maybeTimestamp._seconds === "number") {
      const secondsDate = new Date(maybeTimestamp._seconds * 1000)
      if (!Number.isNaN(secondsDate.getTime())) {
        return secondsDate
      }
    }
  }

  return null
}

const toIsoString = (value: unknown, fallback = new Date().toISOString()) => {
  const parsedDate = toDateValue(value)
  return parsedDate ? parsedDate.toISOString() : fallback
}

const getSaleDate = (sale: Record<string, any>) => {
  return (
    toDateValue(sale.createdAt) ||
    toDateValue(sale.fecha) ||
    toDateValue(sale.date) ||
    toDateValue(sale.timestamp) ||
    toDateValue(sale.fechaCreacion) ||
    toDateValue(sale.fechaActualizacion) ||
    new Date(0)
  )
}

const getCostPriceFromProduct = (product: ProductRecord | undefined) => {
  if (!product) {
    return 0
  }

  const normalizedProduct = normalizeCatalogProduct(product) as Record<string, any>
  return toNumber(normalizedProduct.costPrice ?? normalizedProduct.precioCompra ?? 0)
}

const normalizeSaleItem = (item: Record<string, any>, products: ProductCollection): SalesReportItem | null => {
  const productId = toStringValue(item.productId ?? item.id ?? item.productoId ?? item.producto)
  const nameFallback = toStringValue(item.nombre ?? item.name ?? productId)

  if (!productId && !nameFallback) {
    return null
  }

  const product = productId ? products[productId] : undefined
  const normalizedProduct = product ? (normalizeCatalogProduct(product as ProductRecord, productId) as Record<string, any>) : null
  const nombre = nameFallback || toStringValue(normalizedProduct?.nombre ?? normalizedProduct?.name)
  const cantidad = Math.max(0, toNumber(item.cantidad ?? item.quantity ?? item.qty ?? 0))
  const precioUnitario = toNumber(
    item.precioUnitario ??
      item.precio ??
      item.salePrice ??
      item.price ??
      normalizedProduct?.salePrice ??
      normalizedProduct?.precioVenta ??
      0,
  )
  const subtotal = toNumber(item.subtotal ?? cantidad * precioUnitario, cantidad * precioUnitario)
  const costoUnitario = toNumber(
    item.costoUnitario ??
      item.costPrice ??
      item.precioCompra ??
      normalizedProduct?.costPrice ??
      normalizedProduct?.precioCompra ??
      0,
  )
  const ganancia = cantidad > 0 ? Math.max(0, (precioUnitario - costoUnitario) * cantidad) : 0

  return {
    id: productId || nombre,
    productId: productId || nombre,
    nombre,
    cantidad,
    precioUnitario,
    subtotal,
    costoUnitario,
    ganancia,
  }
}

const normalizeSalePayments = (payments: unknown): SalesReportPayment[] => {
  if (!Array.isArray(payments)) {
    return []
  }

  return payments
    .map((payment) => {
      if (!isPlainObject(payment)) {
        return null
      }

      return {
        metodo: toStringValue(payment.metodo ?? payment.medio ?? payment.medioPago ?? payment.tipo),
        monto: toNumber(payment.monto ?? payment.importe ?? payment.valor ?? 0),
      }
    })
    .filter((payment): payment is SalesReportPayment => payment !== null)
}

const normalizeSaleRecord = (
  sale: Record<string, any>,
  saleId: string,
  products: ProductCollection,
): SalesEntry => {
  const saleDate = getSaleDate(sale)
  const items = Array.isArray(sale.items)
    ? sale.items
        .map((item) => (isPlainObject(item) ? normalizeSaleItem(item, products) : null))
        .filter((item): item is SalesReportItem => item !== null)
    : []
  const pagos = normalizeSalePayments(sale.pagos)
  const subtotalFromItems = items.reduce((sum, item) => sum + item.subtotal, 0)
  const subtotal = toNumber(sale.subtotal ?? subtotalFromItems, subtotalFromItems)
  const descuento = toNumber(sale.descuento ?? 0)
  const total = toNumber(sale.total ?? Math.max(0, subtotal - descuento), Math.max(0, subtotal - descuento))
  const gananciaEstimada = items.reduce((sum, item) => sum + item.ganancia, 0)
  const cliente = toStringValue(sale.cliente)
  const metodoPago = toStringValue(sale.metodoPago ?? (pagos.length > 1 ? "mixto" : pagos[0]?.metodo ?? ""))
  const createdAt = toIsoString(sale.createdAt ?? sale.fecha ?? sale.date ?? sale.timestamp ?? sale.fechaCreacion ?? saleDate)
  const updatedAt = toIsoString(sale.updatedAt ?? sale.fechaActualizacion ?? createdAt, createdAt)

  return {
    id: saleId || toStringValue(sale.id),
    fecha: saleDate,
    date: saleDate.toISOString(),
    timestamp: saleDate.toISOString(),
    total,
    subtotal,
    descuento,
    createdAt,
    updatedAt,
    items,
    pagos,
    metodoPago,
    cliente,
    gananciaEstimada,
  }
}

const toSalesArray = (ventas: SalesCollection = {}, products: ProductCollection = {}): SalesEntry[] => {
  return Object.entries(ventas).map(([id, venta]) => normalizeSaleRecord(isPlainObject(venta) ? venta : {}, id, products))
}

const getPeriodRange = (periodo: ReportPeriod, currentDate = new Date()) => {
  switch (periodo) {
    case "trimestre": {
      const quarter = Math.floor(currentDate.getMonth() / 3)
      return {
        start: new Date(currentDate.getFullYear(), quarter * 3, 1),
        end: new Date(currentDate.getFullYear(), quarter * 3 + 3, 0),
      }
    }
    case "año":
      return {
        start: new Date(currentDate.getFullYear(), 0, 1),
        end: new Date(currentDate.getFullYear(), 11, 31, 23, 59, 59, 999),
      }
    case "mes":
    default:
      return {
        start: new Date(currentDate.getFullYear(), currentDate.getMonth(), 1),
        end: new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0, 23, 59, 59, 999),
      }
  }
}

const getPreviousPeriodRange = (periodo: ReportPeriod, currentDate = new Date()) => {
  switch (periodo) {
    case "año":
      return {
        start: new Date(currentDate.getFullYear() - 1, 0, 1),
        end: new Date(currentDate.getFullYear() - 1, 11, 31, 23, 59, 59, 999),
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
        end: new Date(currentDate.getFullYear(), currentDate.getMonth(), 0, 23, 59, 59, 999),
      }
  }
}

const isWithinRange = (date: Date, start: Date, end: Date) => {
  return date.getTime() >= start.getTime() && date.getTime() <= end.getTime()
}

const buildProductsSummary = (ventas: SalesEntry[]) => {
  const productsMap = new Map<string, TopProductSummary>()

  ventas.forEach((venta) => {
    venta.items.forEach((item) => {
      const key = item.productId || item.id || item.nombre
      if (!key) {
        return
      }

      const current = productsMap.get(key) || {
        id: key,
        nombre: item.nombre || key,
        cantidad: 0,
        total: 0,
        ganancia: 0,
      }

      current.cantidad += item.cantidad
      current.total += item.subtotal
      current.ganancia += item.ganancia
      productsMap.set(key, current)
    })
  })

  return Array.from(productsMap.values())
    .sort((a, b) => b.cantidad - a.cantidad)
    .slice(0, 5)
}

const buildPaymentMethods = (ventas: SalesEntry[]) => {
  return ventas.reduce<Record<string, { total: number; cantidad: number }>>((accumulator, venta) => {
    if (venta.pagos.length > 0) {
      venta.pagos.forEach((pago) => {
        const metodo = pago.metodo || "sin-metodo"
        if (!accumulator[metodo]) {
          accumulator[metodo] = { total: 0, cantidad: 0 }
        }

        accumulator[metodo].total += pago.monto
        accumulator[metodo].cantidad += 1
      })
      return accumulator
    }

    const metodo = venta.metodoPago || "sin-metodo"
    if (!accumulator[metodo]) {
      accumulator[metodo] = { total: 0, cantidad: 0 }
    }

    accumulator[metodo].total += venta.total
    accumulator[metodo].cantidad += 1
    return accumulator
  }, {})
}

const buildSalesTotals = (ventas: SalesEntry[]): SalesTotals => {
  const totalVentas = ventas.reduce((sum, venta) => sum + venta.total, 0)
  const cantidadVentas = ventas.length
  const promedioVenta = cantidadVentas > 0 ? totalVentas / cantidadVentas : 0
  const productosVendidos = ventas.reduce(
    (sum, venta) => sum + venta.items.reduce((itemsSum, item) => itemsSum + item.cantidad, 0),
    0,
  )
  const gananciaEstimada = ventas.reduce((sum, venta) => sum + venta.gananciaEstimada, 0)
  const topProductos = buildProductsSummary(ventas)
  const ventasPorDia = ventas.reduce<Record<string, { total: number; cantidad: number; ganancia: number }>>(
    (accumulator, venta) => {
      const fecha = venta.fecha.toLocaleDateString("es-ES", {
        month: "short",
        day: "numeric",
      })

      if (!accumulator[fecha]) {
        accumulator[fecha] = { total: 0, cantidad: 0, ganancia: 0 }
      }

      accumulator[fecha].total += venta.total
      accumulator[fecha].cantidad += 1
      accumulator[fecha].ganancia += venta.gananciaEstimada
      return accumulator
    },
    {},
  )
  const metodosPago = buildPaymentMethods(ventas)

  return {
    totalVentas,
    cantidadVentas,
    promedioVenta,
    productosVendidos,
    gananciaEstimada,
    topProductos,
    ventasPorDia,
    metodosPago,
  }
}

const filterSalesByRange = (ventas: SalesEntry[], start: Date, end: Date) => {
  return ventas.filter((venta) => isWithinRange(venta.fecha, start, end))
}

export const buildSalesRangeReport = (
  ventas: SalesCollection = {},
  startDate: Date,
  endDate: Date,
  products: ProductCollection = {},
) => {
  const ventasArray = toSalesArray(ventas, products)
  const ventasPeriodo = filterSalesByRange(ventasArray, startDate, endDate)
  const totals = buildSalesTotals(ventasPeriodo)

  return {
    ventasArray,
    ventasPeriodo,
    metricas: totals,
    datosGrafico: Object.entries(totals.ventasPorDia).map(([fecha, data]) => ({
      fecha,
      ventas: data.total,
      cantidad: data.cantidad,
      ganancia: data.ganancia,
    })),
  }
}

export const buildMonthlySalesReport = (
  ventas: SalesCollection = {},
  selectedMonth: number,
  selectedYear: number,
  products: ProductCollection = {},
): MonthlySalesReport => {
  const ventasArray = toSalesArray(ventas, products)
  const startDate = new Date(selectedYear, selectedMonth, 1)
  const endDate = new Date(selectedYear, selectedMonth + 1, 0, 23, 59, 59, 999)
  const ventasFiltradas = filterSalesByRange(ventasArray, startDate, endDate)
  const totals = buildSalesTotals(ventasFiltradas)

  const ventasPorDia = ventasFiltradas.reduce<Record<number, { total: number; cantidad: number; ganancia: number }>>(
    (accumulator, venta) => {
      const dia = venta.fecha.getDate()
      if (!accumulator[dia]) {
        accumulator[dia] = { total: 0, cantidad: 0, ganancia: 0 }
      }

      accumulator[dia].total += venta.total
      accumulator[dia].cantidad += 1
      accumulator[dia].ganancia += venta.gananciaEstimada
      return accumulator
    },
    {},
  )

  const daysInMonth = new Date(selectedYear, selectedMonth + 1, 0).getDate()
  const diasDelMes = Array.from({ length: daysInMonth }, (_, index) => {
    const day = index + 1
    const ventasDelDia = ventasPorDia[day] || { total: 0, cantidad: 0, ganancia: 0 }
    return {
      dia: day,
      total: ventasDelDia.total,
      cantidad: ventasDelDia.cantidad,
      ganancia: ventasDelDia.ganancia,
    }
  })

  const maxVentaDia = Math.max(...diasDelMes.map((dia) => dia.total), 1)

  return {
    ventasArray,
    ventasFiltradas,
    metricas: totals,
    diasDelMes,
    maxVentaDia,
  }
}

export const buildDailySalesReport = (
  ventas: SalesCollection = {},
  dateValue: Date,
  products: ProductCollection = {},
) => {
  const startDate = new Date(dateValue.getFullYear(), dateValue.getMonth(), dateValue.getDate())
  const endDate = new Date(dateValue.getFullYear(), dateValue.getMonth(), dateValue.getDate(), 23, 59, 59, 999)
  const ventasArray = toSalesArray(ventas, products)
  const ventasDelDia = filterSalesByRange(ventasArray, startDate, endDate)
  const totals = buildSalesTotals(ventasDelDia)

  return {
    ventasArray,
    ventasDelDia,
    metricas: totals,
  }
}

export const buildPeriodSalesReport = (
  ventas: SalesCollection = {},
  periodo: ReportPeriod,
  products: ProductCollection = {},
): PeriodSalesReport => {
  const ventasArray = toSalesArray(ventas, products)
  const currentDate = new Date()
  const { start, end } = getPeriodRange(periodo, currentDate)

  const ventasPeriodo = filterSalesByRange(ventasArray, start, end)
  const totals = buildSalesTotals(ventasPeriodo)

  const datosGrafico = ventasPeriodo.reduce<Record<string, { fecha: string; ventas: number; cantidad: number; ganancia: number }>>(
    (accumulator, venta) => {
      const fecha = venta.fecha.toLocaleDateString("es-ES", {
        month: "short",
        day: "numeric",
      })

      if (!accumulator[fecha]) {
        accumulator[fecha] = { fecha, ventas: 0, cantidad: 0, ganancia: 0 }
      }

      accumulator[fecha].ventas += venta.total
      accumulator[fecha].cantidad += 1
      accumulator[fecha].ganancia += venta.gananciaEstimada
      return accumulator
    },
    {},
  )

  return {
    ventasArray,
    ventasPeriodo,
    metricas: {
      totalVentas: totals.totalVentas,
      cantidadVentas: totals.cantidadVentas,
      promedioVenta: totals.promedioVenta,
      productosVendidos: totals.productosVendidos,
      gananciaEstimada: totals.gananciaEstimada,
      topProductos: totals.topProductos,
    },
    datosGrafico: Object.values(datosGrafico),
  }
}

export const buildComparisonSalesReport = (
  ventas: SalesCollection = {},
  periodo: ReportPeriod,
  products: ProductCollection = {},
): ComparisonSalesReport => {
  const ventasArray = toSalesArray(ventas, products)
  const currentDate = new Date()
  const { start: currentStart, end: currentEnd } = getPeriodRange(periodo, currentDate)
  const { start: previousStart, end: previousEnd } = getPreviousPeriodRange(periodo, currentDate)

  const ventasActual = filterSalesByRange(ventasArray, currentStart, currentEnd)
  const ventasAnterior = filterSalesByRange(ventasArray, previousStart, previousEnd)

  const actualTotals = buildSalesTotals(ventasActual)
  const previousTotals = buildSalesTotals(ventasAnterior)

  const actual = {
    total: actualTotals.totalVentas,
    cantidad: actualTotals.cantidadVentas,
    promedio: actualTotals.promedioVenta,
    gananciaEstimada: actualTotals.gananciaEstimada,
  }

  const anterior = {
    total: previousTotals.totalVentas,
    cantidad: previousTotals.cantidadVentas,
    promedio: previousTotals.promedioVenta,
    gananciaEstimada: previousTotals.gananciaEstimada,
  }

  const variaciones = {
    total: anterior.total > 0 ? ((actual.total - anterior.total) / anterior.total) * 100 : 0,
    cantidad: anterior.cantidad > 0 ? ((actual.cantidad - anterior.cantidad) / anterior.cantidad) * 100 : 0,
    promedio: anterior.promedio > 0 ? ((actual.promedio - anterior.promedio) / anterior.promedio) * 100 : 0,
    gananciaEstimada:
      anterior.gananciaEstimada > 0
        ? ((actual.gananciaEstimada - anterior.gananciaEstimada) / anterior.gananciaEstimada) * 100
        : 0,
  }

  return {
    ventasArray,
    actual,
    anterior,
    variaciones,
  }
}

export const buildSalesByPaymentMethod = (ventas: SalesCollection = {}, products: ProductCollection = {}) => {
  return buildSalesTotals(toSalesArray(ventas, products)).metodosPago
}

export const buildSalesByDay = (ventas: SalesCollection = {}, products: ProductCollection = {}) => {
  return buildSalesTotals(toSalesArray(ventas, products)).ventasPorDia
}
