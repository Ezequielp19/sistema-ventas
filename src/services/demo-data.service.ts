import { get, remove, ref } from "firebase/database"
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  type DocumentData,
  type QueryDocumentSnapshot,
  where,
  writeBatch,
} from "firebase/firestore"
import { database, firestore } from "@/src/lib/firebase/client"
import { ANALYTICS_EVENTS, trackEvent, withAnalyticsSuppressed } from "@/src/services/analytics.service"
import { saveProvider } from "@/src/services/providers.service"
import { saveProduct } from "@/src/services/products.service"
import { saveSaleWithStockUpdateById, type SaleRecord } from "@/src/services/sales.service"
import { saveStoreConfig, type StoreConfig } from "@/src/services/store.service"
import { invalidateBusinessCache } from "@/src/lib/business-cache"

export const DEMO_DATA_VERSION = "demo-seed-v1"
const DEMO_CREATED_BY = "demo-data"
const DEMO_BATCH_ID = DEMO_DATA_VERSION

type DemoProductTemplate = {
  id: string
  nombre: string
  descripcion: string
  codigo: string
  categoria: string
  tipo: string
  precioVenta: number
  costPrice: number
  stock: number
  stockMinimo: number
  providerId: string
  providerName: string
  visibleInStore: boolean
}

type DemoProviderTemplate = {
  id: string
  nombre: string
  telefono: string
  email?: string
  direccion?: string
  notas?: string
}

type DemoSaleItemTemplate = {
  productId: string
  cantidad: number
}

type DemoSaleTemplate = {
  id: string
  cliente: string
  metodoPago: string
  daysAgo: number
  items: DemoSaleItemTemplate[]
}

export interface DemoSeedResult {
  businessId: string
  storeName: string
  productsCreated: number
  providersCreated: number
  salesCreated: number
  demoDataVersion: string
}

export interface DemoDeletionResult {
  businessId: string
  firestore: {
    products: number
    providers: number
    sales: number
    storeConfigDeleted: boolean
  }
  legacy: {
    products: number
    providers: number
    sales: number
    storeConfigDeleted: boolean
    paths: string[]
  }
}

const DAY_IN_MS = 24 * 60 * 60 * 1000
const LEGACY_DEMO_MARKER_VALUES = [DEMO_CREATED_BY, DEMO_BATCH_ID, DEMO_DATA_VERSION]

const DEMO_PROVIDERS: DemoProviderTemplate[] = [
  {
    id: "demo-provider-01",
    nombre: "Proveedor Centro SRL",
    telefono: "+54 11 5555-1100",
    email: "ventas@proveedorcentro.com",
    direccion: "Av. Corrientes 1200, CABA",
    notas: "Entrega rápida 24/48h",
  },
  {
    id: "demo-provider-02",
    nombre: "Distribuidora Norte",
    telefono: "+54 11 5555-2200",
    email: "contacto@distribuidoranorte.com",
    direccion: "Av. Rivadavia 3500, CABA",
    notas: "Mayorista textil",
  },
  {
    id: "demo-provider-03",
    nombre: "Importadora Sur",
    telefono: "+54 11 5555-3300",
    email: "info@importadorasur.com",
    direccion: "Perú 880, CABA",
    notas: "Accesorios y mochilas",
  },
]

const DEMO_PRODUCTS: DemoProductTemplate[] = [
  {
    id: "demo-product-01",
    nombre: "Remera básica",
    descripcion: "Remera algodón premium corte clásico",
    codigo: "DEM-001",
    categoria: "Ropa",
    tipo: "Indumentaria",
    precioVenta: 12000,
    costPrice: 7000,
    stock: 40,
    stockMinimo: 8,
    providerId: DEMO_PROVIDERS[0].id,
    providerName: DEMO_PROVIDERS[0].nombre,
    visibleInStore: true,
  },
  {
    id: "demo-product-02",
    nombre: "Jean clásico",
    descripcion: "Jean recto azul oscuro con elastano",
    codigo: "DEM-002",
    categoria: "Ropa",
    tipo: "Indumentaria",
    precioVenta: 24000,
    costPrice: 15000,
    stock: 28,
    stockMinimo: 5,
    providerId: DEMO_PROVIDERS[0].id,
    providerName: DEMO_PROVIDERS[0].nombre,
    visibleInStore: true,
  },
  {
    id: "demo-product-03",
    nombre: "Zapatillas urbanas",
    descripcion: "Zapatillas cómodas para uso diario",
    codigo: "DEM-003",
    categoria: "Calzado",
    tipo: "Indumentaria",
    precioVenta: 38000,
    costPrice: 24000,
    stock: 24,
    stockMinimo: 4,
    providerId: DEMO_PROVIDERS[1].id,
    providerName: DEMO_PROVIDERS[1].nombre,
    visibleInStore: true,
  },
  {
    id: "demo-product-04",
    nombre: "Campera liviana",
    descripcion: "Campera liviana ideal media estación",
    codigo: "DEM-004",
    categoria: "Abrigo",
    tipo: "Indumentaria",
    precioVenta: 45000,
    costPrice: 28000,
    stock: 16,
    stockMinimo: 4,
    providerId: DEMO_PROVIDERS[1].id,
    providerName: DEMO_PROVIDERS[1].nombre,
    visibleInStore: true,
  },
  {
    id: "demo-product-05",
    nombre: "Gorra bordada",
    descripcion: "Gorra regulable con bordado frontal",
    codigo: "DEM-005",
    categoria: "Accesorios",
    tipo: "Indumentaria",
    precioVenta: 8500,
    costPrice: 4000,
    stock: 20,
    stockMinimo: 6,
    providerId: DEMO_PROVIDERS[2].id,
    providerName: DEMO_PROVIDERS[2].nombre,
    visibleInStore: false,
  },
  {
    id: "demo-product-06",
    nombre: "Mochila clásica",
    descripcion: "Mochila de uso urbano con varios compartimentos",
    codigo: "DEM-006",
    categoria: "Accesorios",
    tipo: "Indumentaria",
    precioVenta: 32000,
    costPrice: 20000,
    stock: 12,
    stockMinimo: 3,
    providerId: DEMO_PROVIDERS[2].id,
    providerName: DEMO_PROVIDERS[2].nombre,
    visibleInStore: false,
  },
]

const DEMO_SALES: DemoSaleTemplate[] = [
  {
    id: "demo-sale-01",
    cliente: "Cliente demo 1",
    metodoPago: "efectivo",
    daysAgo: 3,
    items: [
      { productId: "demo-product-01", cantidad: 2 },
      { productId: "demo-product-03", cantidad: 1 },
    ],
  },
  {
    id: "demo-sale-02",
    cliente: "Cliente demo 2",
    metodoPago: "transferencia",
    daysAgo: 2,
    items: [{ productId: "demo-product-02", cantidad: 3 }],
  },
  {
    id: "demo-sale-03",
    cliente: "Cliente demo 3",
    metodoPago: "tarjeta",
    daysAgo: 1,
    items: [
      { productId: "demo-product-04", cantidad: 1 },
      { productId: "demo-product-01", cantidad: 1 },
    ],
  },
  {
    id: "demo-sale-04",
    cliente: "Cliente demo 4",
    metodoPago: "débito",
    daysAgo: 0,
    items: [
      { productId: "demo-product-03", cantidad: 2 },
      { productId: "demo-product-06", cantidad: 1 },
    ],
  },
]

const nowIso = () => new Date().toISOString()
const isoDaysAgo = (daysAgo: number) => new Date(Date.now() - daysAgo * DAY_IN_MS).toISOString()

const buildDemoMarkers = () => ({
  isDemo: true,
  isDemoData: true,
  demoBatchId: DEMO_BATCH_ID,
  demoDataVersion: DEMO_DATA_VERSION,
  createdBy: DEMO_CREATED_BY,
})

const isDemoMarkedRecord = (value: unknown): boolean => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false
  }

  const record = value as Record<string, unknown>
  return (
    record.isDemo === true ||
    record.isDemoData === true ||
    record.createdBy === DEMO_CREATED_BY ||
    LEGACY_DEMO_MARKER_VALUES.includes(String(record.demoBatchId ?? "")) ||
    LEGACY_DEMO_MARKER_VALUES.includes(String(record.demoDataVersion ?? ""))
  )
}

const buildDemoStoreConfig = (businessId: string): StoreConfig => {
  const now = nowIso()

  return {
    nombre: "Tienda Demo Atenea",
    descripcion: "Negocio de ejemplo para validar ventas, dashboard, reportes y tienda pública.",
    telefono: "+54 11 5555-0000",
    whatsapp: "+54 11 5555-0000",
    direccion: "Av. Demo 1234, Buenos Aires",
    horarios: "Lun a Vie 9:00 a 18:00",
    logo: "",
    email: "demo@tienda.com",
    redesSociales: {
      facebook: "",
      instagram: "",
      twitter: "",
    },
    businessId,
    createdAt: now,
    updatedAt: now,
    demoDataVersion: DEMO_DATA_VERSION,
    demoDataSeededAt: now,
    isDemoData: true,
    isDemo: true,
    demoBatchId: DEMO_BATCH_ID,
    createdBy: DEMO_CREATED_BY,
  }
}

const buildDemoProductRecord = (businessId: string, product: DemoProductTemplate) => {
  const now = nowIso()

  return {
    businessId,
    usuarioId: businessId,
    tiendaId: businessId,
    id: product.id,
    nombre: product.nombre,
    name: product.nombre,
    descripcion: product.descripcion,
    description: product.descripcion,
    codigo: product.codigo,
    code: product.codigo,
    categoria: product.categoria,
    category: product.categoria,
    tipo: product.tipo,
    type: product.tipo,
    precioVenta: product.precioVenta,
    salePrice: product.precioVenta,
    precio: product.precioVenta,
    costPrice: product.costPrice,
    stock: product.stock,
    minStock: product.stockMinimo,
    stockMinimo: product.stockMinimo,
    providerId: product.providerId,
    proveedor: product.providerId,
    providerName: product.providerName,
    proveedorNombre: product.providerName,
    imageUrl: "",
    thumbUrl: "",
    imagePath: "",
    thumbPath: "",
    visibleInStore: product.visibleInStore,
    visibleEnTienda: product.visibleInStore,
    active: true,
    activo: true,
    featured: false,
    destacado: false,
    createdAt: now,
    updatedAt: now,
    imageUpdatedAt: now,
    ...buildDemoMarkers(),
  }
}

const buildDemoProviderRecord = (businessId: string, provider: DemoProviderTemplate) => {
  const now = nowIso()

  return {
    businessId,
    usuarioId: businessId,
    id: provider.id,
    providerId: provider.id,
    nombre: provider.nombre,
    name: provider.nombre,
    telefono: provider.telefono,
    email: provider.email ?? "",
    direccion: provider.direccion ?? "",
    notas: provider.notas ?? "",
    contacto: "",
    activo: true,
    active: true,
    createdAt: now,
    updatedAt: now,
    fechaCreacion: now,
    fechaActualizacion: now,
    ...buildDemoMarkers(),
  }
}

const getProductLookup = () => {
  return DEMO_PRODUCTS.reduce<Record<string, DemoProductTemplate>>((accumulator, product) => {
    accumulator[product.id] = product
    return accumulator
  }, {})
}

const buildSaleItems = (items: DemoSaleItemTemplate[]) => {
  const productLookup = getProductLookup()

  return items.map((item) => {
    const product = productLookup[item.productId]
    const salePrice = product?.precioVenta ?? 0
    const subtotal = salePrice * item.cantidad

    return {
      productId: item.productId,
      id: item.productId,
      nombre: product?.nombre ?? "",
      cantidad: item.cantidad,
      precioUnitario: salePrice,
      subtotal,
      precio: salePrice,
      salePrice,
      stockDisponible: product?.stock ?? 0,
    }
  })
}

const buildDemoSaleRecord = (businessId: string, sale: DemoSaleTemplate): SaleRecord => {
  const createdAt = isoDaysAgo(sale.daysAgo)
  const items = buildSaleItems(sale.items)
  const subtotal = items.reduce((sum, item) => sum + Number(item.subtotal ?? 0), 0)

  return {
    id: sale.id,
    businessId,
    usuarioId: businessId,
    tiendaId: businessId,
    cliente: sale.cliente,
    metodoPago: sale.metodoPago,
    pagos: [
      {
        metodo: sale.metodoPago,
        monto: subtotal,
      },
    ],
    subtotal,
    descuento: 0,
    total: subtotal,
    items,
    createdAt,
    updatedAt: createdAt,
    fecha: createdAt,
    activo: true,
    ...buildDemoMarkers(),
  }
}

const isTruthy = (value: unknown) => {
  return value === true || value === "true" || value === 1 || value === "1"
}

const hasLegacyDemoMarkers = (value: Record<string, unknown>) => {
  return (
    isTruthy(value.isDemo) ||
    isTruthy(value.isDemoData) ||
    value.createdBy === DEMO_CREATED_BY ||
    LEGACY_DEMO_MARKER_VALUES.includes(String(value.demoBatchId ?? "")) ||
    LEGACY_DEMO_MARKER_VALUES.includes(String(value.demoDataVersion ?? ""))
  )
}

const getFirestoreCollectionRef = (businessId: string, collectionName: "products" | "providers" | "sales") =>
  collection(firestore, "businesses", businessId, collectionName)

const deleteDocumentsInChunks = async (documents: QueryDocumentSnapshot<DocumentData>[]) => {
  if (documents.length === 0) {
    return 0
  }

  const chunkSize = 400
  let deletedCount = 0

  for (let index = 0; index < documents.length; index += chunkSize) {
    const chunk = documents.slice(index, index + chunkSize)
    const batch = writeBatch(firestore)
    chunk.forEach((documentSnapshot) => {
      batch.delete(documentSnapshot.ref)
    })
    await batch.commit()
    deletedCount += chunk.length
  }

  return deletedCount
}

const collectDemoFirestoreDocuments = async (
  businessId: string,
  collectionName: "products" | "providers" | "sales",
): Promise<QueryDocumentSnapshot<DocumentData>[]> => {
  const collectionRef = getFirestoreCollectionRef(businessId, collectionName)
  const discoveredDocuments = new Map<string, QueryDocumentSnapshot<DocumentData>>()
  const markerQueries = [
    where("isDemo", "==", true),
    where("isDemoData", "==", true),
    where("createdBy", "==", DEMO_CREATED_BY),
    where("demoBatchId", "==", DEMO_BATCH_ID),
    where("demoDataVersion", "==", DEMO_DATA_VERSION),
  ]

  await Promise.all(
    markerQueries.map(async (markerQuery) => {
      const snapshot = await getDocs(query(collectionRef, markerQuery))
      snapshot.docs.forEach((documentSnapshot) => {
        discoveredDocuments.set(documentSnapshot.id, documentSnapshot)
      })
    }),
  )

  return Array.from(discoveredDocuments.values())
}

const deleteDemoFirestoreStoreConfig = async (businessId: string) => {
  const storeConfigRef = doc(firestore, "businesses", businessId, "storeConfig", "public")
  const snapshot = await getDoc(storeConfigRef)

  if (!snapshot.exists()) {
    return false
  }

  const storeConfig = snapshot.data() as Record<string, unknown>
  if (!hasLegacyDemoMarkers(storeConfig)) {
    return false
  }

  await deleteDoc(storeConfigRef)
  return true
}

const deleteLegacyMarkedEntries = async (path: string) => {
  const snapshot = await get(ref(database, path))
  if (!snapshot.exists()) {
    return 0
  }

  const value = snapshot.val()
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return 0
  }

  const entries = Object.entries(value as Record<string, unknown>)
  const keysToDelete = entries
    .filter(([, record]) => record && typeof record === "object" && !Array.isArray(record) && hasLegacyDemoMarkers(record as Record<string, unknown>))
    .map(([key]) => key)

  await Promise.all(keysToDelete.map((key) => remove(ref(database, `${path}/${key}`))))
  return keysToDelete.length
}

const deleteLegacyMarkedStoreConfig = async (businessId: string) => {
  const paths = [`usuarios/${businessId}/tienda`, `tiendas/${businessId}/config`]
  const snapshots = await Promise.all(paths.map((path) => get(ref(database, path))))
  const shouldDelete = snapshots.some((snapshot) => {
    return snapshot.exists() && hasLegacyDemoMarkers(snapshot.val() as Record<string, unknown>)
  })

  if (!shouldDelete) {
    return { deleted: false, paths: [] as string[] }
  }

  await Promise.all(paths.map((path) => remove(ref(database, path))))
  return { deleted: true, paths }
}

const hasExistingDemoSale = async (businessId: string, saleId: string) => {
  const firestoreSaleSnapshot = await getDoc(doc(firestore, "businesses", businessId, "sales", saleId))
  if (firestoreSaleSnapshot.exists()) {
    return true
  }

  const legacySaleSnapshot = await get(ref(database, `usuarios/${businessId}/ventas/${saleId}`))
  return legacySaleSnapshot.exists()
}

export const seedDemoDataForBusiness = async (businessId: string): Promise<DemoSeedResult> => {
  if (!businessId) {
    throw new Error("Falta el negocio para cargar datos demo")
  }

  const result = await withAnalyticsSuppressed(async () => {
    const storeConfig = buildDemoStoreConfig(businessId)
    const providerRecords = DEMO_PROVIDERS.map((provider) => buildDemoProviderRecord(businessId, provider))
    const productRecords = DEMO_PRODUCTS.map((product) => buildDemoProductRecord(businessId, product))

    await saveStoreConfig(businessId, storeConfig)
    await Promise.all(providerRecords.map((providerRecord) => saveProvider(businessId, providerRecord.id, providerRecord)))
    await Promise.all(productRecords.map((productRecord) => saveProduct(businessId, productRecord.id, productRecord)))

    let salesCreated = 0
    for (const saleTemplate of DEMO_SALES) {
      const alreadyExists = await hasExistingDemoSale(businessId, saleTemplate.id)
      if (alreadyExists) {
        continue
      }

      const saleRecord = buildDemoSaleRecord(businessId, saleTemplate)
      await saveSaleWithStockUpdateById(businessId, saleTemplate.id, saleRecord, {})
      salesCreated += 1
    }

    return {
      businessId,
      storeName: storeConfig.nombre,
      productsCreated: productRecords.length,
      providersCreated: providerRecords.length,
      salesCreated,
      demoDataVersion: DEMO_DATA_VERSION,
    }
  })

  void trackEvent(ANALYTICS_EVENTS.demoDataLoaded, {
    businessId,
    productsCreated: result.productsCreated,
    providersCreated: result.providersCreated,
    salesCreated: result.salesCreated,
    demoDataVersion: result.demoDataVersion,
  })

  return result
}

export const deleteDemoDataForBusiness = async (businessId: string): Promise<DemoDeletionResult> => {
  if (!businessId) {
    throw new Error("Falta el negocio para eliminar datos demo")
  }

  const [demoProducts, demoProviders, demoSales] = await Promise.all([
    collectDemoFirestoreDocuments(businessId, "products"),
    collectDemoFirestoreDocuments(businessId, "providers"),
    collectDemoFirestoreDocuments(businessId, "sales"),
  ])

  const [deletedProducts, deletedProviders, deletedSales, storeConfigDeleted, legacyStoreConfig] = await Promise.all([
    deleteDocumentsInChunks(demoProducts),
    deleteDocumentsInChunks(demoProviders),
    deleteDocumentsInChunks(demoSales),
    deleteDemoFirestoreStoreConfig(businessId),
    deleteLegacyMarkedStoreConfig(businessId),
  ])

  const [legacyUserProducts, legacyStoreProducts, legacyProviders, legacySales] = await Promise.all([
    deleteLegacyMarkedEntries(`usuarios/${businessId}/productos`),
    deleteLegacyMarkedEntries(`tiendas/${businessId}/productos`),
    deleteLegacyMarkedEntries(`usuarios/${businessId}/proveedores`),
    deleteLegacyMarkedEntries(`usuarios/${businessId}/ventas`),
  ])

  invalidateBusinessCache(businessId)

  return {
    businessId,
    firestore: {
      products: deletedProducts,
      providers: deletedProviders,
      sales: deletedSales,
      storeConfigDeleted,
    },
    legacy: {
      products: legacyUserProducts + legacyStoreProducts,
      providers: legacyProviders,
      sales: legacySales,
      storeConfigDeleted: legacyStoreConfig.deleted,
      paths: legacyStoreConfig.paths,
    },
  }
}
