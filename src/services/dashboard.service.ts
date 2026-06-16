import { collection, getDocs } from "firebase/firestore"
import { firestore } from "@/src/lib/firebase/client"
import { normalizeCatalogProduct, type ProductRecord } from "@/lib/product-sync"
import { getBusinessCache, setBusinessCache } from "@/src/lib/business-cache"
import { loadMergedProducts } from "@/src/services/products.service"
import {
  loadProviders,
  type ProviderCollection,
  type ProviderRecord,
} from "@/src/services/providers.service"
import { loadSales, type SaleCollection, type SaleRecord } from "@/src/services/sales.service"
import type { ProductCollection } from "@/src/services/products.service"

type LoadedCollection<T> = {
  data: T
  legacyUsed: boolean
}

export interface DashboardMetrics {
  totalProductos: number
  totalProveedores: number
  totalVentas: number
  ventasHoy: number
  ventasMes: number
  ganancias: number
  stockBajo: Array<ProductRecord & { id: string }>
  ultimasVentas: Array<SaleRecord & { id: string }>
}

export interface DashboardSummary {
  products: ProductCollection
  providers: ProviderCollection
  sales: SaleCollection
  metrics: DashboardMetrics
  legacySources: {
    products: boolean
    providers: boolean
    sales: boolean
  }
}

const getFirestoreProductsPath = (businessId: string) => `businesses/${businessId}/products`
const getFirestoreProvidersPath = (businessId: string) => `businesses/${businessId}/providers`
const getFirestoreSalesPath = (businessId: string) => `businesses/${businessId}/sales`

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

const toNumberValue = (value: unknown, fallback = 0) => {
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

const toBooleanValue = (value: unknown, fallback = false) => {
  if (typeof value === "boolean") {
    return value
  }

  if (typeof value === "number") {
    return value !== 0
  }

  if (typeof value === "string") {
    const normalizedValue = value.trim().toLowerCase()
    if (["true", "1", "yes", "si"].includes(normalizedValue)) {
      return true
    }

    if (["false", "0", "no"].includes(normalizedValue)) {
      return false
    }
  }

  return fallback
}

const getIsoString = (value: unknown, fallback = new Date().toISOString()) => {
  if (value instanceof Date) {
    return value.toISOString()
  }

  if (typeof value === "string" && value.trim() !== "") {
    return value.trim()
  }

  if (value && typeof value === "object") {
    const maybeTimestamp = value as { toDate?: () => Date; seconds?: number }

    if (typeof maybeTimestamp.toDate === "function") {
      return maybeTimestamp.toDate().toISOString()
    }

    if (typeof maybeTimestamp.seconds === "number") {
      return new Date(maybeTimestamp.seconds * 1000).toISOString()
    }
  }

  return fallback
}

const normalizeProviderForDashboard = (
  provider: ProviderRecord = {},
  providerId = "",
  businessId = "",
): ProviderRecord => {
  const nombre = toStringValue(provider.nombre ?? provider.name)
  const contacto = toStringValue(provider.contacto ?? provider.contactPerson ?? provider.contact)
  const telefono = toStringValue(provider.telefono ?? provider.phone)
  const email = toStringValue(provider.email ?? provider.mail)
  const direccion = toStringValue(provider.direccion ?? provider.address)
  const notas = toStringValue(provider.notas ?? provider.notes)
  const activo = toBooleanValue(provider.activo ?? provider.active, true)
  const createdAt = getIsoString(provider.createdAt ?? provider.fechaCreacion ?? new Date().toISOString())
  const updatedAt = getIsoString(provider.updatedAt ?? provider.fechaActualizacion ?? createdAt)

  return {
    ...provider,
    id: providerId || toStringValue(provider.id),
    providerId: providerId || toStringValue(provider.providerId),
    businessId: toStringValue(provider.businessId ?? businessId),
    usuarioId: toStringValue(provider.usuarioId ?? businessId),
    nombre,
    name: nombre,
    contacto,
    telefono,
    email,
    direccion,
    notas,
    activo,
    active: activo,
    createdAt,
    fechaCreacion: createdAt,
    updatedAt,
    fechaActualizacion: updatedAt,
  }
}

const normalizeSalePaymentForDashboard = (payment: Record<string, any> = {}) => {
  const metodo = toStringValue(payment.metodo ?? payment.medio ?? payment.medioPago ?? payment.tipo)
  const monto = toNumberValue(payment.monto ?? payment.importe ?? payment.valor ?? 0)

  return {
    ...payment,
    metodo,
    monto,
  }
}

const normalizeSaleItemForDashboard = (item: Record<string, any> = {}) => {
  const productId = toStringValue(item.productId ?? item.id ?? item.productoId ?? item.producto)
  if (!productId) {
    return null
  }

  const nombre = toStringValue(item.nombre ?? item.name)
  const cantidad = Math.max(0, toNumberValue(item.cantidad ?? item.quantity ?? item.qty ?? 0))
  const precioUnitario = toNumberValue(item.precioUnitario ?? item.precio ?? item.salePrice ?? item.price ?? 0)
  const subtotal = toNumberValue(item.subtotal ?? cantidad * precioUnitario)

  return {
    ...item,
    id: productId,
    productId,
    nombre,
    cantidad,
    precioUnitario,
    subtotal,
    precio: precioUnitario,
    salePrice: precioUnitario,
  }
}

const normalizeSaleForDashboard = (
  sale: SaleRecord = {},
  saleId = "",
  businessId = "",
): SaleRecord => {
  const createdAt = getIsoString(sale.createdAt ?? sale.fecha ?? sale.fechaCreacion ?? new Date().toISOString())
  const updatedAt = getIsoString(sale.updatedAt ?? sale.fechaActualizacion ?? createdAt)
  const rawItems = Array.isArray(sale.items) ? sale.items : []
  const items = rawItems.map((item) => normalizeSaleItemForDashboard(item)).filter(Boolean)
  const rawPayments = Array.isArray(sale.pagos) ? sale.pagos : []
  const pagos = rawPayments.map((payment) => normalizeSalePaymentForDashboard(payment))
  const subtotalFromItems = items.reduce((sum, item) => sum + toNumberValue(item?.subtotal, 0), 0)
  const subtotal = toNumberValue(sale.subtotal ?? subtotalFromItems, subtotalFromItems)
  const descuento = toNumberValue(sale.descuento ?? 0)
  const total = toNumberValue(sale.total ?? Math.max(0, subtotal - descuento), Math.max(0, subtotal - descuento))
  const cliente = toStringValue(sale.cliente)
  const metodoPago = toStringValue(sale.metodoPago ?? (pagos.length > 1 ? "mixto" : pagos[0]?.metodo ?? ""))
  const activo = toBooleanValue(sale.activo, true)

  return {
    ...sale,
    id: saleId || toStringValue(sale.id),
    businessId: toStringValue(sale.businessId ?? businessId),
    usuarioId: toStringValue(sale.usuarioId ?? sale.userId ?? businessId),
    tiendaId: toStringValue(sale.tiendaId ?? businessId),
    cliente,
    metodoPago,
    subtotal,
    descuento,
    total,
    items,
    pagos,
    createdAt,
    updatedAt,
    fecha: createdAt,
    fechaCreacion: createdAt,
    fechaActualizacion: updatedAt,
    activo,
  }
}

const readFirestoreProducts = async (businessId: string): Promise<ProductCollection> => {
  const snapshot = await getDocs(collection(firestore, getFirestoreProductsPath(businessId)))

  return snapshot.docs.reduce<ProductCollection>((accumulator, documentSnapshot) => {
    accumulator[documentSnapshot.id] = normalizeCatalogProduct(documentSnapshot.data() as ProductRecord, documentSnapshot.id)
    return accumulator
  }, {})
}

const readFirestoreProviders = async (businessId: string): Promise<ProviderCollection> => {
  const snapshot = await getDocs(collection(firestore, getFirestoreProvidersPath(businessId)))

  return snapshot.docs.reduce<ProviderCollection>((accumulator, documentSnapshot) => {
    const normalizedProvider = normalizeProviderForDashboard(
      documentSnapshot.data() as ProviderRecord,
      documentSnapshot.id,
      businessId,
    )
    if (toBooleanValue(normalizedProvider.activo ?? normalizedProvider.active, true)) {
      accumulator[documentSnapshot.id] = normalizedProvider
    }
    return accumulator
  }, {})
}

const readFirestoreSales = async (businessId: string): Promise<SaleCollection> => {
  const snapshot = await getDocs(collection(firestore, getFirestoreSalesPath(businessId)))

  return snapshot.docs.reduce<SaleCollection>((accumulator, documentSnapshot) => {
    accumulator[documentSnapshot.id] = normalizeSaleForDashboard(
      documentSnapshot.data() as SaleRecord,
      documentSnapshot.id,
      businessId,
    )
    return accumulator
  }, {})
}

const loadCollectionWithFallback = async <T extends Record<string, any>>(
  label: string,
  readFirestoreCollection: () => Promise<T>,
  readLegacyCollection: () => Promise<T>,
): Promise<LoadedCollection<T>> => {
  try {
    const firestoreData = await readFirestoreCollection()
    if (Object.keys(firestoreData).length > 0) {
      return { data: firestoreData, legacyUsed: false }
    }
  } catch (error) {
    console.error(`Error al leer ${label} desde Firestore:`, error)
  }

  try {
    const legacyData = await readLegacyCollection()
    return {
      data: legacyData,
      legacyUsed: Object.keys(legacyData).length > 0,
    }
  } catch (error) {
    console.error(`Error al leer ${label} legados:`, error)
    return {
      data: {} as T,
      legacyUsed: false,
    }
  }
}

const isSameDay = (dateA: Date, dateB: Date) =>
  dateA.getFullYear() === dateB.getFullYear() &&
  dateA.getMonth() === dateB.getMonth() &&
  dateA.getDate() === dateB.getDate()

const isSameMonth = (dateA: Date, dateB: Date) =>
  dateA.getFullYear() === dateB.getFullYear() &&
  dateA.getMonth() === dateB.getMonth()

const getSaleDate = (sale: SaleRecord) => {
  const dateValue = new Date(String(sale.createdAt ?? sale.fecha ?? sale.fechaCreacion ?? ""))
  return Number.isNaN(dateValue.getTime()) ? null : dateValue
}

const getProductCostPrice = (product: ProductRecord) => {
  const costPrice = toNumberValue(product.costPrice ?? product.precioCompra ?? 0)
  return Number.isFinite(costPrice) ? costPrice : 0
}

const buildDashboardMetrics = (
  products: ProductCollection,
  providers: ProviderCollection,
  sales: SaleCollection,
): DashboardMetrics => {
  const productEntries: Array<ProductRecord & { id: string }> = Object.entries(products || {}).map(([id, product]) => ({
    id,
    ...(normalizeCatalogProduct(product as ProductRecord, id) as ProductRecord),
  }))

  const salesEntries: Array<SaleRecord & { id: string }> = Object.entries(sales || {}).map(([id, sale]) => ({
    id,
    ...(normalizeSaleForDashboard(sale as SaleRecord, id) as SaleRecord),
  }))

  const stockBajo = productEntries.filter((product: ProductRecord & { id: string }) => {
    const stock = toNumberValue(product.stock, 0)
    const minStock = toNumberValue(product.minStock ?? product.stockMinimo ?? 0, 0)
    return stock <= minStock
  })

  const now = new Date()
  const ventasHoy = salesEntries.reduce((sum: number, sale: SaleRecord & { id: string }) => {
    const saleDate = getSaleDate(sale)
    if (!saleDate || !isSameDay(saleDate, now)) {
      return sum
    }
    return sum + toNumberValue(sale.total, 0)
  }, 0)

  const ventasMes = salesEntries.reduce((sum: number, sale: SaleRecord & { id: string }) => {
    const saleDate = getSaleDate(sale)
    if (!saleDate || !isSameMonth(saleDate, now)) {
      return sum
    }
    return sum + toNumberValue(sale.total, 0)
  }, 0)

  const totalVentas = salesEntries.reduce((sum: number, sale: SaleRecord & { id: string }) => sum + toNumberValue(sale.total, 0), 0)

  const ganancias = salesEntries.reduce((sum: number, sale: SaleRecord & { id: string }) => {
    const saleItems = Array.isArray(sale.items) ? sale.items : []

    const saleProfit = saleItems.reduce((saleSum: number, item: Record<string, any>) => {
      const productId = toStringValue(item.productId ?? item.id)
      const product = productId ? products[productId] : undefined
      const salePrice = toNumberValue(item.precioUnitario ?? item.precio ?? item.salePrice ?? 0, 0)
      const costPrice = product ? getProductCostPrice(product) : 0
      const quantity = Math.max(0, toNumberValue(item.cantidad, 0))

      if (quantity <= 0) {
        return saleSum
      }

      if (!Number.isFinite(costPrice) || costPrice <= 0) {
        return saleSum
      }

      return saleSum + (salePrice - costPrice) * quantity
    }, 0)

    return sum + saleProfit
  }, 0)

  const ultimasVentas = salesEntries
    .filter((sale: SaleRecord & { id: string }) => getSaleDate(sale) !== null)
    .sort((left, right) => {
      const leftDate = getSaleDate(left)?.getTime() ?? 0
      const rightDate = getSaleDate(right)?.getTime() ?? 0
      return rightDate - leftDate
    })
    .slice(0, 5)

  return {
    totalProductos: productEntries.length,
    totalProveedores: Object.keys(providers || {}).length,
    totalVentas,
    ventasHoy,
    ventasMes,
    ganancias,
    stockBajo,
    ultimasVentas,
  }
}

const loadProductsData = async (businessId: string): Promise<LoadedCollection<ProductCollection>> => {
  return loadCollectionWithFallback(
    "productos",
    async () => readFirestoreProducts(businessId),
    async () => loadMergedProducts(businessId),
  )
}

const loadProvidersData = async (businessId: string): Promise<LoadedCollection<ProviderCollection>> => {
  return loadCollectionWithFallback(
    "proveedores",
    async () => readFirestoreProviders(businessId),
    async () => loadProviders(businessId),
  )
}

const loadSalesData = async (businessId: string): Promise<LoadedCollection<SaleCollection>> => {
  return loadCollectionWithFallback(
    "ventas",
    async () => readFirestoreSales(businessId),
    async () => loadSales(businessId),
  )
}

export const loadDashboardSummary = async (businessId: string): Promise<DashboardSummary> => {
  if (!businessId) {
    return {
      products: {},
      providers: {},
      sales: {},
      metrics: {
        totalProductos: 0,
        totalProveedores: 0,
        totalVentas: 0,
        ventasHoy: 0,
        ventasMes: 0,
        ganancias: 0,
        stockBajo: [],
        ultimasVentas: [],
      },
      legacySources: {
        products: false,
        providers: false,
        sales: false,
      },
    }
  }

  const cachedSummary = getBusinessCache<DashboardSummary>("dashboard", businessId)
  if (cachedSummary) {
    return cachedSummary
  }

  const [productsResult, providersResult, salesResult] = await Promise.all([
    loadProductsData(businessId),
    loadProvidersData(businessId),
    loadSalesData(businessId),
  ])

  const metrics = buildDashboardMetrics(productsResult.data, providersResult.data, salesResult.data)

  const summary: DashboardSummary = {
    products: productsResult.data,
    providers: providersResult.data,
    sales: salesResult.data,
    metrics,
    legacySources: {
      products: productsResult.legacyUsed,
      providers: providersResult.legacyUsed,
      sales: salesResult.legacyUsed,
    },
  }

  setBusinessCache("dashboard", businessId, summary)

  return summary
}
