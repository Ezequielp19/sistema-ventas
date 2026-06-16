import { get, push, ref, remove, set } from "firebase/database"
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  runTransaction,
  setDoc,
  startAfter,
  type QueryConstraint,
  type DocumentData,
  type QueryDocumentSnapshot,
} from "firebase/firestore"
import { database, firestore } from "@/src/lib/firebase/client"
import { normalizeCatalogProduct, sanitizeFirestoreData } from "@/lib/product-sync"
import { getBusinessCache, invalidateBusinessCache, setBusinessCache } from "@/src/lib/business-cache"
import { type ProductCollection, type ProductRecord } from "@/src/services/products.service"

export type SaleRecord = Record<string, any>
export type SaleCollection = Record<string, SaleRecord>
export type InvoiceRecord = Record<string, any>
export type InvoiceCollection = Record<string, InvoiceRecord>

type SaleItemRecord = {
  id: string
  productId: string
  nombre: string
  cantidad: number
  precioUnitario: number
  subtotal: number
  precio?: number
  salePrice?: number
  stockDisponible?: number
  [key: string]: any
}

type NormalizedSaleRecord = SaleRecord & {
  id: string
  businessId: string
  usuarioId: string
  tiendaId: string
  cliente: string
  metodoPago: string
  subtotal: number
  descuento: number
  total: number
  items: SaleItemRecord[]
  pagos: Record<string, any>[]
  createdAt: string
  updatedAt: string
  fecha: string
  fechaCreacion: string
  fechaActualizacion: string
  activo: boolean
}

const DEFAULT_SALES_PAGE_SIZE = 50

const getFirestoreSalesPath = (businessId: string) => `businesses/${businessId}/sales`
const getFirestoreProductsPath = (businessId: string) => `businesses/${businessId}/products`
const getLegacySalesPath = (businessId: string) => `usuarios/${businessId}/ventas`
const getLegacyUserProductsPath = (businessId: string) => `usuarios/${businessId}/productos`
const getLegacyStoreProductsPath = (businessId: string) => `tiendas/${businessId}/productos`
const getInvoicesPath = (userId: string) => `usuarios/${userId}/facturas`

const getFirestoreSalesCollectionRef = (businessId: string) =>
  collection(firestore, getFirestoreSalesPath(businessId))
const getFirestoreSaleDocRef = (businessId: string, saleId: string) =>
  doc(firestore, getFirestoreSalesPath(businessId), saleId)
const getFirestoreProductDocRef = (businessId: string, productId: string) =>
  doc(firestore, getFirestoreProductsPath(businessId), productId)

const getLegacySaleRef = (businessId: string, saleId: string) => ref(database, `${getLegacySalesPath(businessId)}/${saleId}`)
const getLegacyUserProductRef = (businessId: string, productId: string) =>
  ref(database, `${getLegacyUserProductsPath(businessId)}/${productId}`)
const getLegacyStoreProductRef = (businessId: string, productId: string) =>
  ref(database, `${getLegacyStoreProductsPath(businessId)}/${productId}`)
const getInvoicesRef = (userId: string) => ref(database, getInvoicesPath(userId))

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

const isPlainObject = (value: unknown): value is Record<string, unknown> => {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

const getIsoString = (value: unknown, fallback = new Date().toISOString()) => {
  if (value instanceof Date) {
    return value.toISOString()
  }

  if (typeof value === "string" && value.trim() !== "") {
    return value.trim()
  }

  if (value && typeof value === "object") {
    const maybeTimestamp = value as { toDate?: () => Date; seconds?: number; nanoseconds?: number }
    if (typeof maybeTimestamp.toDate === "function") {
      return maybeTimestamp.toDate().toISOString()
    }

    if (typeof maybeTimestamp.seconds === "number") {
      return new Date(maybeTimestamp.seconds * 1000).toISOString()
    }
  }

  return fallback
}

const normalizeSalePayment = (payment: Record<string, any> = {}) => {
  const metodo = toStringValue(payment.metodo ?? payment.medio ?? payment.medioPago ?? payment.tipo)
  const monto = toNumberValue(payment.monto ?? payment.importe ?? payment.valor ?? 0)

  return sanitizeFirestoreData({
    ...payment,
    metodo,
    monto,
  })
}

const normalizeSaleItem = (item: Record<string, any> = {}, fallbackProduct: ProductRecord = {}): SaleItemRecord | null => {
  const fallbackNormalizedProduct = normalizeCatalogProduct(fallbackProduct, toStringValue(fallbackProduct.id))
  const productId = toStringValue(
    item.productId ?? item.id ?? item.productoId ?? item.producto ?? fallbackNormalizedProduct.id ?? "",
  )

  if (!productId) {
    return null
  }

  const nombre = toStringValue(item.nombre ?? item.name ?? fallbackNormalizedProduct.nombre ?? fallbackNormalizedProduct.name)
  const cantidad = Math.max(0, toNumberValue(item.cantidad ?? item.quantity ?? item.qty ?? 0))
  const precioUnitario = toNumberValue(
    item.precioUnitario ?? item.precio ?? item.salePrice ?? item.price ?? fallbackNormalizedProduct.salePrice ?? 0,
  )
  const subtotal = toNumberValue(item.subtotal ?? cantidad * precioUnitario)
  const stockDisponible = toNumberValue(item.stockDisponible ?? fallbackNormalizedProduct.stock ?? 0)

  return sanitizeFirestoreData({
    ...item,
    id: productId,
    productId,
    nombre,
    cantidad,
    precioUnitario,
    subtotal,
    precio: precioUnitario,
    salePrice: precioUnitario,
    stockDisponible,
  })
}

const normalizeSaleItems = (
  items: unknown,
  products: ProductCollection = {},
): SaleItemRecord[] => {
  if (!Array.isArray(items)) {
    return []
  }

  return items
    .map((item) => {
      const rawItem = isPlainObject(item) ? item : {}
      const fallbackProductId = toStringValue(rawItem.id ?? rawItem.productId ?? rawItem.productoId)
      const fallbackProduct = fallbackProductId && products[fallbackProductId] ? products[fallbackProductId] : {}
      return normalizeSaleItem(rawItem, fallbackProduct)
    })
    .filter((item) => item !== null) as SaleItemRecord[]
}

const normalizeSalePayments = (payments: unknown) => {
  if (!Array.isArray(payments)) {
    return []
  }

  return payments
    .map((payment) => (isPlainObject(payment) ? normalizeSalePayment(payment) : null))
    .filter((payment) => payment !== null) as Record<string, any>[]
}

const getPrimaryPaymentMethod = (payments: Record<string, any>[]) => {
  const firstPaymentMethod = payments.find((payment) => toStringValue(payment.metodo))
  if (firstPaymentMethod) {
    return toStringValue(firstPaymentMethod.metodo)
  }

  return payments.length > 1 ? "mixto" : ""
}

const normalizeSaleRecord = (
  sale: SaleRecord = {},
  saleId = "",
  businessId = "",
): NormalizedSaleRecord => {
  const createdAt = getIsoString(sale.createdAt ?? sale.fechaCreacion ?? sale.fecha ?? new Date().toISOString())
  const updatedAt = getIsoString(sale.updatedAt ?? sale.fechaActualizacion ?? createdAt)
  const items = normalizeSaleItems(sale.items)
  const pagos = normalizeSalePayments(sale.pagos)
  const subtotalFromItems = items.reduce((sum, item) => sum + toNumberValue(item.subtotal, 0), 0)
  const subtotal = toNumberValue(sale.subtotal ?? subtotalFromItems, subtotalFromItems)
  const descuento = toNumberValue(sale.descuento ?? 0)
  const total = toNumberValue(sale.total ?? Math.max(0, subtotal - descuento), Math.max(0, subtotal - descuento))
  const cliente = toStringValue(sale.cliente)
  const metodoPago = toStringValue(sale.metodoPago ?? getPrimaryPaymentMethod(pagos))
  const usuarioId = toStringValue(sale.usuarioId ?? sale.userId ?? businessId)
  const tiendaId = toStringValue(sale.tiendaId ?? businessId)
  const activo = toBooleanValue(sale.activo, true)

  return sanitizeFirestoreData({
    ...sale,
    id: saleId || toStringValue(sale.id),
    businessId: toStringValue(sale.businessId ?? businessId ?? usuarioId ?? tiendaId),
    usuarioId,
    tiendaId,
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
  }) as NormalizedSaleRecord
}

const normalizeSaleCollection = (sales: SaleCollection = {}, businessId = ""): SaleCollection => {
  return Object.entries(sales).reduce<SaleCollection>((accumulator, [saleId, sale]) => {
    accumulator[saleId] = normalizeSaleRecord(sale, saleId, businessId)
    return accumulator
  }, {})
}

const mergeSaleCollections = (primary: SaleCollection = {}, fallback: SaleCollection = {}) => {
  return {
    ...fallback,
    ...primary,
  }
}

const aggregateSaleItems = (items: SaleItemRecord[]) => {
  return items.reduce<Record<string, number>>((accumulator, item) => {
    const quantity = toNumberValue(item.cantidad, 0)
    if (!item.productId || quantity <= 0) {
      return accumulator
    }

    accumulator[item.productId] = (accumulator[item.productId] || 0) + quantity
    return accumulator
  }, {})
}

const buildSaleRecordForWrite = (
  businessId: string,
  saleId: string,
  saleData: SaleRecord,
  products: ProductCollection = {},
): NormalizedSaleRecord => {
  const normalizedItems = normalizeSaleItems(saleData.items, products)
  const validItems = normalizedItems.filter((item) => item.cantidad > 0 && item.productId)

  if (validItems.length === 0) {
    throw new Error("La venta no tiene productos válidos")
  }

  const normalizedPayments = normalizeSalePayments(saleData.pagos ?? saleData.paymentMethods ?? [])
  const subtotalFromItems = validItems.reduce((sum, item) => sum + toNumberValue(item.subtotal, 0), 0)
  const subtotal = toNumberValue(saleData.subtotal ?? subtotalFromItems, subtotalFromItems)
  const descuento = toNumberValue(saleData.descuento ?? 0)
  const total = toNumberValue(saleData.total ?? Math.max(0, subtotal - descuento), Math.max(0, subtotal - descuento))
  const createdAt = getIsoString(saleData.createdAt ?? saleData.fecha ?? new Date().toISOString())
  const updatedAt = getIsoString(saleData.updatedAt ?? createdAt)
  const cliente = toStringValue(saleData.cliente)
  const metodoPago = toStringValue(saleData.metodoPago ?? getPrimaryPaymentMethod(normalizedPayments))
  const usuarioId = toStringValue(saleData.usuarioId ?? saleData.userId ?? businessId)
  const tiendaId = toStringValue(saleData.tiendaId ?? businessId)
  const activo = toBooleanValue(saleData.activo, true)

  return normalizeSaleRecord(
    {
      ...saleData,
      id: saleId,
      businessId,
      usuarioId,
      tiendaId,
      cliente,
      metodoPago,
      subtotal,
      descuento,
      total,
      items: validItems,
      pagos: normalizedPayments,
      createdAt,
      updatedAt,
      fecha: createdAt,
      fechaCreacion: createdAt,
      fechaActualizacion: updatedAt,
      activo,
    },
    saleId,
    businessId,
  ) as NormalizedSaleRecord
}

const readCollection = async <T extends Record<string, any>>(path: string): Promise<T> => {
  if (!path) {
    return {} as T
  }

  const snapshot = await get(ref(database, path))
  return snapshot.exists() ? (snapshot.val() as T) : ({} as T)
}

const readFirestoreSalesPage = async (
  businessId: string,
  pageSize = DEFAULT_SALES_PAGE_SIZE,
  cursor: QueryDocumentSnapshot<DocumentData> | null = null,
): Promise<{
  sales: SaleCollection
  lastDocument: QueryDocumentSnapshot<DocumentData> | null
  hasMore: boolean
}> => {
  if (!businessId) {
    return { sales: {}, lastDocument: null, hasMore: false }
  }

  const constraints: QueryConstraint[] = [orderBy("createdAt", "desc"), limit(pageSize)]
  if (cursor) {
    constraints.splice(1, 0, startAfter(cursor))
  }

  const snapshot = await getDocs(query(getFirestoreSalesCollectionRef(businessId), ...constraints))
  const sales: SaleCollection = {}

  snapshot.forEach((documentSnapshot) => {
    sales[documentSnapshot.id] = normalizeSaleRecord(documentSnapshot.data() as SaleRecord, documentSnapshot.id, businessId)
  })

  return {
    sales,
    lastDocument: snapshot.docs[snapshot.docs.length - 1] ?? null,
    hasMore: snapshot.size === pageSize,
  }
}

const loadAllFirestoreSales = async (businessId: string): Promise<SaleCollection> => {
  if (!businessId) {
    return {}
  }

  const sales: SaleCollection = {}
  let cursor: QueryDocumentSnapshot<DocumentData> | null = null

  while (true) {
    const page = await readFirestoreSalesPage(businessId, DEFAULT_SALES_PAGE_SIZE, cursor)
    Object.assign(sales, page.sales)

    if (!page.hasMore || !page.lastDocument) {
      break
    }

    cursor = page.lastDocument
  }

  return sales
}

const syncFirestoreSales = async (businessId: string, sales: SaleCollection): Promise<void> => {
  if (!businessId) {
    return
  }

  const entries = Object.entries(sales)
  if (entries.length === 0) {
    return
  }

  await Promise.all(
    entries.map(async ([saleId, saleData]) => {
      await setDoc(getFirestoreSaleDocRef(businessId, saleId), sanitizeFirestoreData(normalizeSaleRecord(saleData, saleId, businessId)))
    }),
  )
}

const syncSaleMirrorToRealtime = async (
  businessId: string,
  saleId: string,
  saleData: SaleRecord,
): Promise<void> => {
  if (!businessId || !saleId) {
    return
  }

  await set(getLegacySaleRef(businessId, saleId), sanitizeFirestoreData(normalizeSaleRecord(saleData, saleId, businessId)))
}

const syncSaleDeletionToRealtime = async (businessId: string, saleId: string): Promise<void> => {
  if (!businessId || !saleId) {
    return
  }

  await remove(getLegacySaleRef(businessId, saleId))
}

const syncProductStockToRealtime = async (
  businessId: string,
  productId: string,
  productData: ProductRecord,
): Promise<void> => {
  if (!businessId || !productId) {
    return
  }

  const sanitizedProduct = sanitizeFirestoreData(productData)
  await Promise.all([
    set(getLegacyUserProductRef(businessId, productId), sanitizedProduct),
    set(getLegacyStoreProductRef(businessId, productId), sanitizedProduct),
  ])
}

const deleteSaleMirrorInFirestore = async (businessId: string, saleId: string): Promise<void> => {
  if (!businessId || !saleId) {
    return
  }

  await deleteDoc(getFirestoreSaleDocRef(businessId, saleId))
}

const writeSaleOnly = async (businessId: string, saleId: string, saleData: SaleRecord): Promise<void> => {
  const firestoreSaleData = sanitizeFirestoreData(normalizeSaleRecord(saleData, saleId, businessId))
  await setDoc(getFirestoreSaleDocRef(businessId, saleId), firestoreSaleData)
  await syncSaleMirrorToRealtime(businessId, saleId, firestoreSaleData)
}

const updateProductStocksInTransaction = async (
  transaction: {
    get: (reference: ReturnType<typeof getFirestoreProductDocRef> | ReturnType<typeof getFirestoreSaleDocRef>) => Promise<any>
    set: (...args: any[]) => void
    delete: (reference: ReturnType<typeof getFirestoreSaleDocRef>) => void
  },
  businessId: string,
  stockChanges: Record<string, number>,
  fallbackProducts: ProductCollection,
  direction: 1 | -1,
) => {
  const updatedProducts = new Map<string, ProductRecord>()

  for (const [productId, quantity] of Object.entries(stockChanges)) {
    if (!productId || quantity <= 0) {
      continue
    }

    const productRef = getFirestoreProductDocRef(businessId, productId)
    const productSnapshot = await transaction.get(productRef)
    const fallbackProduct = fallbackProducts[productId]
    const sourceProduct = productSnapshot.exists()
      ? normalizeCatalogProduct(productSnapshot.data() as ProductRecord, productId)
      : fallbackProduct
        ? normalizeCatalogProduct(fallbackProduct, productId)
        : null

    if (!sourceProduct) {
      throw Object.assign(new Error(`El producto ${productId} no existe.`), { code: "product-not-found" })
    }

    const currentStock = toNumberValue(sourceProduct.stock ?? 0)
    const nextStock = direction === -1 ? currentStock - quantity : currentStock + quantity

    if (direction === -1 && nextStock < 0) {
      throw Object.assign(
        new Error(`Stock insuficiente para ${sourceProduct.nombre || sourceProduct.name || productId}. Disponible: ${currentStock}, solicitado: ${quantity}.`),
        { code: "insufficient-stock" },
      )
    }

    const updatedProduct = normalizeCatalogProduct(
      {
        ...sourceProduct,
        stock: nextStock,
        isLowStock: nextStock <= toNumberValue(sourceProduct.minStock ?? sourceProduct.stockMinimo ?? 0),
        updatedAt: new Date().toISOString(),
        fechaActualizacion: new Date().toISOString(),
      },
      productId,
    )

    transaction.set(productRef, sanitizeFirestoreData(updatedProduct), { merge: true })
    updatedProducts.set(productId, sanitizeFirestoreData(updatedProduct))
  }

  return updatedProducts
}

const saveSaleWithStockUpdate = async (
  businessId: string,
  saleData: SaleRecord,
  products: ProductCollection,
  stockDirection: 1 | -1,
  existingSaleData: SaleRecord = {},
): Promise<string> => {
  if (!businessId) {
    return ""
  }

  const saleRef = doc(collection(firestore, getFirestoreSalesPath(businessId)))
  const saleId = saleRef.id
  const normalizedSale = buildSaleRecordForWrite(businessId, saleId, {
    ...existingSaleData,
    ...saleData,
  }, products)
  const stockChanges = aggregateSaleItems(normalizedSale.items)
  const firestoreSaleData = sanitizeFirestoreData(normalizedSale)
  const productMirrorUpdates = new Map<string, ProductRecord>()

  await runTransaction(firestore, async (transaction) => {
    const updatedProducts = await updateProductStocksInTransaction(
      transaction,
      businessId,
      stockChanges,
      products,
      stockDirection,
    )

    updatedProducts.forEach((productData, productId) => {
      productMirrorUpdates.set(productId, productData)
    })

    transaction.set(saleRef, firestoreSaleData)
  })

  const syncResults = await Promise.allSettled([
    syncSaleMirrorToRealtime(businessId, saleId, firestoreSaleData),
    ...Array.from(productMirrorUpdates.entries()).map(([productId, productData]) =>
      syncProductStockToRealtime(businessId, productId, productData)
    ),
  ])

  syncResults.forEach((result) => {
    if (result.status === "rejected") {
      console.error("Error al sincronizar el espejo Realtime Database:", result.reason)
    }
  })

  invalidateBusinessCache(businessId)

  return saleId
}

export const loadSales = async (businessId: string): Promise<SaleCollection> => {
  if (!businessId) {
    return {}
  }

  const cachedSales = getBusinessCache<SaleCollection>("sales", businessId)
  if (cachedSales) {
    return cachedSales
  }

  const [firestoreSales, legacySales] = await Promise.all([
    loadAllFirestoreSales(businessId),
    readCollection<SaleCollection>(getLegacySalesPath(businessId)),
  ])

  const normalizedFirestoreSales = normalizeSaleCollection(firestoreSales, businessId)
  const normalizedLegacySales = normalizeSaleCollection(legacySales, businessId)

  if (Object.keys(normalizedFirestoreSales).length === 0 && Object.keys(normalizedLegacySales).length > 0) {
    await syncFirestoreSales(businessId, normalizedLegacySales)
    setBusinessCache("sales", businessId, normalizedLegacySales)
    return normalizedLegacySales
  }

  const missingLegacySales = Object.entries(normalizedLegacySales).reduce<SaleCollection>((accumulator, [saleId, saleData]) => {
    if (!normalizedFirestoreSales[saleId]) {
      accumulator[saleId] = saleData
    }
    return accumulator
  }, {})

  if (Object.keys(missingLegacySales).length > 0) {
    await syncFirestoreSales(businessId, missingLegacySales)
  }

  const mergedSales = mergeSaleCollections(normalizedFirestoreSales, normalizedLegacySales)
  setBusinessCache("sales", businessId, mergedSales)

  return mergedSales
}

export const createSale = async (businessId: string, saleData: SaleRecord): Promise<string> => {
  if (!businessId) {
    return ""
  }

  const saleId = doc(collection(firestore, getFirestoreSalesPath(businessId))).id
  if (!saleId) {
    return ""
  }

  const normalizedSale = normalizeSaleRecord(saleData, saleId, businessId)
  await writeSaleOnly(businessId, saleId, normalizedSale)
  invalidateBusinessCache(businessId)
  return saleId
}

export const processSale = async (
  businessId: string,
  saleData: SaleRecord,
  products: ProductCollection,
): Promise<string> => {
  return saveSaleWithStockUpdate(businessId, saleData, products, -1)
}

export const restoreSaleStock = async (
  businessId: string,
  sale: SaleRecord,
  products: ProductCollection,
): Promise<void> => {
  if (!businessId) {
    return
  }

  const saleId = toStringValue(sale.id)
  const firestoreSale = saleId ? await getDoc(getFirestoreSaleDocRef(businessId, saleId)) : null
  const sourceSale = firestoreSale?.exists() ? (firestoreSale.data() as SaleRecord) : sale
  const saleRef = doc(collection(firestore, getFirestoreSalesPath(businessId)))
  const normalizedSale = buildSaleRecordForWrite(
    businessId,
    saleId || saleRef.id,
    {
      ...sourceSale,
      activo: sourceSale.activo !== false,
    },
    products,
  )
  const stockChanges = aggregateSaleItems(normalizedSale.items)
  const productMirrorUpdates = new Map<string, ProductRecord>()

  await runTransaction(firestore, async (transaction) => {
    const updatedProducts = await updateProductStocksInTransaction(
      transaction,
      businessId,
      stockChanges,
      products,
      1,
    )

    updatedProducts.forEach((productData, productId) => {
      productMirrorUpdates.set(productId, productData)
    })

    if (saleId) {
      const saleDocRef = getFirestoreSaleDocRef(businessId, saleId)
      transaction.delete(saleDocRef)
    }
  })

  const syncResults = await Promise.allSettled([
    saleId ? syncSaleDeletionToRealtime(businessId, saleId) : Promise.resolve(),
    ...Array.from(productMirrorUpdates.entries()).map(([productId, productData]) =>
      syncProductStockToRealtime(businessId, productId, productData)
    ),
  ])

  syncResults.forEach((result) => {
    if (result.status === "rejected") {
      console.error("Error al sincronizar el espejo Realtime Database:", result.reason)
    }
  })

  invalidateBusinessCache(businessId)
}

export const deleteSale = async (businessId: string, saleId: string): Promise<void> => {
  if (!businessId || !saleId) {
    return
  }

  try {
    await deleteSaleMirrorInFirestore(businessId, saleId)
    await syncSaleDeletionToRealtime(businessId, saleId)
  } finally {
    invalidateBusinessCache(businessId)
  }
}

export const deleteSaleAndRestoreStock = async (
  businessId: string,
  saleId: string,
  sale: SaleRecord,
  products: ProductCollection,
): Promise<void> => {
  const normalizedSale = normalizeSaleRecord(
    {
      ...sale,
      id: saleId,
      activo: sale.activo !== false,
    },
    saleId,
    businessId,
  )

  const stockChanges = aggregateSaleItems(normalizedSale.items)
  const productMirrorUpdates = new Map<string, ProductRecord>()

  await runTransaction(firestore, async (transaction) => {
    const saleDocRef = getFirestoreSaleDocRef(businessId, saleId)
    const saleSnapshot = await transaction.get(saleDocRef)
    const firestoreSaleData = saleSnapshot.exists()
      ? normalizeSaleRecord(saleSnapshot.data() as SaleRecord, saleId, businessId)
      : normalizedSale
    const updatedProducts = await updateProductStocksInTransaction(
      transaction,
      businessId,
      aggregateSaleItems(firestoreSaleData.items),
      products,
      1,
    )

    updatedProducts.forEach((productData, currentProductId) => {
      productMirrorUpdates.set(currentProductId, productData)
    })

    transaction.delete(saleDocRef)
  })

  await Promise.allSettled([
    syncSaleDeletionToRealtime(businessId, saleId),
    ...Array.from(productMirrorUpdates.entries()).map(([productId, productData]) =>
      syncProductStockToRealtime(businessId, productId, productData),
    ),
  ]).then((results) => {
    results.forEach((result) => {
      if (result.status === "rejected") {
        console.error("Error al sincronizar el espejo Realtime Database:", result.reason)
      }
    })
  })

  invalidateBusinessCache(businessId)
}

export const createInvoice = async (userId: string, invoiceData: InvoiceRecord): Promise<string> => {
  if (!userId) {
    return ""
  }

  const invoiceRef = push(getInvoicesRef(userId))
  await set(invoiceRef, sanitizeFirestoreData(invoiceData))
  return invoiceRef.key ?? ""
}

export const deleteInvoice = async (userId: string, invoiceId: string): Promise<void> => {
  if (!userId || !invoiceId) {
    return
  }

  await remove(ref(database, `${getInvoicesPath(userId)}/${invoiceId}`))
}
