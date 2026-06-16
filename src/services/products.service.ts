import { get, onValue, ref, remove, set } from "firebase/database"
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  setDoc,
  startAfter,
  type DocumentData,
  type QueryConstraint,
  type QueryDocumentSnapshot,
} from "firebase/firestore"
import { database, firestore } from "@/src/lib/firebase/client"
import { mergePublicCatalogCollections, normalizeCatalogProduct, sanitizeFirestoreData } from "@/lib/product-sync"
import { getBusinessCache, invalidateBusinessCache, setBusinessCache } from "@/src/lib/business-cache"

export type ProductRecord = Record<string, any>
export type ProductCollection = Record<string, ProductRecord>
export type ProductUpdateMap = Record<string, Partial<ProductRecord>>

const DEFAULT_PRODUCTS_PAGE_SIZE = 50

const getFirestoreProductsPath = (businessId: string) => `businesses/${businessId}/products`
const getLegacyUserProductsPath = (businessId: string) => `usuarios/${businessId}/productos`
const getLegacyStoreProductsPath = (businessId: string) => `tiendas/${businessId}/productos`

const getFirestoreProductsCollectionRef = (businessId: string) =>
  collection(firestore, getFirestoreProductsPath(businessId))
const getFirestoreProductDocRef = (businessId: string, productId: string) =>
  doc(firestore, getFirestoreProductsPath(businessId), productId)

const getLegacyUserProductsRef = (businessId: string) => ref(database, getLegacyUserProductsPath(businessId))
const getLegacyStoreProductsRef = (businessId: string) => ref(database, getLegacyStoreProductsPath(businessId))

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

const getProductName = (product: ProductRecord) => toStringValue(product.name ?? product.nombre)

const getProductDescription = (product: ProductRecord) => toStringValue(product.description ?? product.descripcion)

const getProductCategory = (product: ProductRecord) => toStringValue(product.category ?? product.categoria ?? product.tipo)

const getProductType = (product: ProductRecord, category: string) =>
  toStringValue(product.type ?? product.tipo ?? category)

const getPrimaryImage = (product: ProductRecord) => {
  const imageCandidates = [
    product.imageUrl,
    product.thumbUrl,
    product.imagen,
    Array.isArray(product.imagenes) ? product.imagenes[0] : "",
  ]

  return imageCandidates.find((image) => typeof image === "string" && image.trim() !== "") ?? ""
}

const getNormalisedProductCollection = async (path: string): Promise<ProductCollection> => {
  const snapshot = await get(ref(database, path))
  if (!snapshot.exists()) {
    return {}
  }

  return snapshot.val() as ProductCollection
}

const normalizeLegacyProducts = async (businessId: string): Promise<ProductCollection> => {
  if (!businessId) {
    return {}
  }

  const [userProducts, storeProducts] = await Promise.all([
    getNormalisedProductCollection(getLegacyUserProductsPath(businessId)),
    getNormalisedProductCollection(getLegacyStoreProductsPath(businessId)),
  ])

  return mergePublicCatalogCollections(userProducts, storeProducts)
}

const normalizeProductForWrite = (
  businessId: string,
  productId: string,
  productData: ProductRecord,
  existingProduct: ProductRecord = {},
) => {
  const mergedSource: ProductRecord = {
    ...normalizeCatalogProduct(existingProduct, productId),
    ...productData,
  }

  const name = getProductName(mergedSource)
  const description = getProductDescription(mergedSource)
  const category = getProductCategory(mergedSource)
  const type = getProductType(mergedSource, category)
  const code = toStringValue(mergedSource.code ?? mergedSource.codigo)
  const salePrice = toNumberValue(mergedSource.salePrice ?? mergedSource.precioVenta ?? mergedSource.precio ?? 0)
  const costPrice = toNumberValue(mergedSource.costPrice ?? mergedSource.precioCompra ?? 0)
  const stock = toNumberValue(mergedSource.stock ?? 0)
  const rawMinStock = mergedSource.minStock ?? mergedSource.stockMinimo ?? mergedSource.stock_minimo
  const minStock =
    rawMinStock === undefined || rawMinStock === null || rawMinStock === "" ? 0 : toNumberValue(rawMinStock)
  const providerId = toStringValue(mergedSource.providerId ?? mergedSource.proveedor)
  const providerName = toStringValue(mergedSource.providerName ?? mergedSource.proveedorNombre)
  const imageUrl = toStringValue(mergedSource.imageUrl ?? mergedSource.imagen ?? getPrimaryImage(mergedSource))
  const thumbUrl = toStringValue(mergedSource.thumbUrl ?? imageUrl)
  const imagePath = toStringValue(mergedSource.imagePath)
  const thumbPath = toStringValue(mergedSource.thumbPath)
  const visibleInStore = toBooleanValue(mergedSource.visibleInStore ?? mergedSource.visibleEnTienda, true)
  const active = toBooleanValue(mergedSource.active ?? mergedSource.activo, true)
  const featured = toBooleanValue(mergedSource.featured ?? mergedSource.destacado, false)
  const createdAt = toStringValue(mergedSource.createdAt ?? mergedSource.fechaCreacion ?? new Date().toISOString())
  const updatedAt = new Date().toISOString()
  const imageUpdatedAt = toStringValue(mergedSource.imageUpdatedAt ?? mergedSource.fechaActualizacionImagen ?? updatedAt)
  const nameLower = toStringValue(mergedSource.nameLower ?? name.toLowerCase())
  const isLowStock =
    mergedSource.isLowStock !== undefined && mergedSource.isLowStock !== null
      ? toBooleanValue(mergedSource.isLowStock)
      : stock <= minStock
  const imagenes = Array.isArray(mergedSource.imagenes)
    ? mergedSource.imagenes.filter((image: unknown): image is string => typeof image === "string" && image.trim() !== "")
    : imageUrl
      ? [imageUrl]
      : []

  return normalizeCatalogProduct(
    {
      ...mergedSource,
      id: productId,
      businessId,
      usuarioId: businessId,
      tiendaId: businessId,
      code,
      codigo: code,
      name,
      nombre: name,
      nameLower,
      description,
      descripcion: description,
      category,
      categoria: category,
      type,
      tipo: type,
      salePrice,
      price: salePrice,
      precio: salePrice,
      precioVenta: salePrice,
      costPrice,
      stock,
      minStock,
      stockMinimo: minStock,
      isLowStock,
      providerId,
      proveedor: providerId,
      providerName,
      proveedorNombre: providerName,
      imageUrl,
      thumbUrl,
      imagePath,
      thumbPath,
      imagen: imageUrl,
      imagenes,
      visibleInStore,
      visibleEnTienda: visibleInStore,
      active,
      activo: active,
      featured,
      destacado: featured,
      createdAt,
      fechaCreacion: createdAt,
      updatedAt,
      fechaActualizacion: updatedAt,
      imageUpdatedAt,
    },
    productId,
  )
}

const normalizeProductUpdatePayload = (updates: Partial<ProductRecord>) => {
  const normalizedUpdates: Partial<ProductRecord> = { ...updates }

  if (updates.visibleEnTienda !== undefined && updates.visibleInStore === undefined) {
    normalizedUpdates.visibleInStore = updates.visibleEnTienda
  }

  if (updates.visibleInStore !== undefined && updates.visibleEnTienda === undefined) {
    normalizedUpdates.visibleEnTienda = updates.visibleInStore
  }

  if (updates.active !== undefined && updates.activo === undefined) {
    normalizedUpdates.activo = updates.active
  }

  if (updates.activo !== undefined && updates.active === undefined) {
    normalizedUpdates.active = updates.activo
  }

  if (updates.salePrice !== undefined) {
    normalizedUpdates.precioVenta = updates.precioVenta ?? updates.salePrice
    normalizedUpdates.precio = updates.precio ?? updates.salePrice
  }

  if (updates.precioVenta !== undefined) {
    normalizedUpdates.salePrice = updates.salePrice ?? updates.precioVenta
    normalizedUpdates.precio = updates.precio ?? updates.precioVenta
  }

  if (updates.precio !== undefined && updates.salePrice === undefined && updates.precioVenta === undefined) {
    normalizedUpdates.salePrice = updates.precio
    normalizedUpdates.precioVenta = updates.precio
  }

  if (updates.minStock !== undefined && updates.stockMinimo === undefined) {
    normalizedUpdates.stockMinimo = updates.minStock
  }

  if (updates.stockMinimo !== undefined && updates.minStock === undefined) {
    normalizedUpdates.minStock = updates.stockMinimo
  }

  if (updates.code !== undefined && updates.codigo === undefined) {
    normalizedUpdates.codigo = updates.code
  }

  if (updates.codigo !== undefined && updates.code === undefined) {
    normalizedUpdates.code = updates.codigo
  }

  if (updates.name !== undefined && updates.nombre === undefined) {
    normalizedUpdates.nombre = updates.name
  }

  if (updates.nombre !== undefined && updates.name === undefined) {
    normalizedUpdates.name = updates.nombre
  }

  if (updates.description !== undefined && updates.descripcion === undefined) {
    normalizedUpdates.descripcion = updates.description
  }

  if (updates.descripcion !== undefined && updates.description === undefined) {
    normalizedUpdates.description = updates.descripcion
  }

  if (updates.category !== undefined && updates.categoria === undefined && updates.tipo === undefined) {
    normalizedUpdates.categoria = updates.category
    normalizedUpdates.tipo = updates.category
  }

  if (updates.tipo !== undefined && updates.category === undefined) {
    normalizedUpdates.category = updates.tipo
    normalizedUpdates.categoria = updates.tipo
  }

  if (updates.providerId !== undefined && updates.proveedor === undefined) {
    normalizedUpdates.proveedor = updates.providerId
  }

  if (updates.proveedor !== undefined && updates.providerId === undefined) {
    normalizedUpdates.providerId = updates.proveedor
  }

  if (updates.providerName !== undefined && updates.proveedorNombre === undefined) {
    normalizedUpdates.proveedorNombre = updates.providerName
  }

  if (updates.proveedorNombre !== undefined && updates.providerName === undefined) {
    normalizedUpdates.providerName = updates.proveedorNombre
  }

  if (updates.featured !== undefined && updates.destacado === undefined) {
    normalizedUpdates.destacado = updates.featured
  }

  if (updates.destacado !== undefined && updates.featured === undefined) {
    normalizedUpdates.featured = updates.destacado
  }

  if (updates.imageUrl !== undefined && updates.imagen === undefined) {
    normalizedUpdates.imagen = updates.imageUrl
  }

  if (updates.imagen !== undefined && updates.imageUrl === undefined) {
    normalizedUpdates.imageUrl = updates.imagen
  }

  if (updates.thumbUrl !== undefined && updates.imageUrl === undefined && updates.imagen === undefined) {
    normalizedUpdates.imageUrl = updates.thumbUrl
    normalizedUpdates.imagen = updates.thumbUrl
  }

  if (updates.imagePath !== undefined && updates.thumbPath === undefined) {
    normalizedUpdates.thumbPath = updates.imagePath
  }

  if (updates.imageUpdatedAt !== undefined) {
    normalizedUpdates.imageUpdatedAt = updates.imageUpdatedAt
  }

  return normalizedUpdates
}

const loadFirestoreProductsPage = async (
  businessId: string,
  pageSize = DEFAULT_PRODUCTS_PAGE_SIZE,
  cursor: QueryDocumentSnapshot<DocumentData> | null = null,
): Promise<{
  products: ProductCollection
  lastDocument: QueryDocumentSnapshot<DocumentData> | null
  hasMore: boolean
}> => {
  if (!businessId) {
    return { products: {}, lastDocument: null, hasMore: false }
  }

  const constraints: QueryConstraint[] = [orderBy("updatedAt", "desc"), limit(pageSize)]
  if (cursor) {
    constraints.splice(1, 0, startAfter(cursor))
  }

  const snapshot = await getDocs(query(getFirestoreProductsCollectionRef(businessId), ...constraints))
  const products: ProductCollection = {}

  snapshot.forEach((documentSnapshot) => {
    products[documentSnapshot.id] = normalizeCatalogProduct(documentSnapshot.data(), documentSnapshot.id)
  })

  return {
    products,
    lastDocument: snapshot.docs[snapshot.docs.length - 1] ?? null,
    hasMore: snapshot.size === pageSize,
  }
}

const loadAllFirestoreProducts = async (businessId: string): Promise<ProductCollection> => {
  if (!businessId) {
    return {}
  }

  const products: ProductCollection = {}
  let cursor: QueryDocumentSnapshot<DocumentData> | null = null

  while (true) {
    const page = await loadFirestoreProductsPage(businessId, DEFAULT_PRODUCTS_PAGE_SIZE, cursor)
    Object.assign(products, page.products)

    if (!page.hasMore || !page.lastDocument) {
      break
    }

    cursor = page.lastDocument
  }

  return products
}

const syncFirestoreProducts = async (businessId: string, products: ProductCollection): Promise<void> => {
  if (!businessId) {
    return
  }

  const productEntries = Object.entries(products)
  if (productEntries.length === 0) {
    return
  }

  await Promise.all(
    productEntries.map(async ([productId, productData]) => {
      const normalizedProduct = normalizeProductForWrite(businessId, productId, productData)
      await setDoc(getFirestoreProductDocRef(businessId, productId), sanitizeFirestoreData(normalizedProduct))
    }),
  )
}

const readExistingProduct = async (businessId: string, productId: string): Promise<ProductRecord | null> => {
  if (!businessId || !productId) {
    return null
  }

  const [firestoreSnapshot, legacyUserSnapshot, legacyStoreSnapshot] = await Promise.all([
    getDoc(getFirestoreProductDocRef(businessId, productId)),
    get(ref(database, `${getLegacyUserProductsPath(businessId)}/${productId}`)),
    get(ref(database, `${getLegacyStoreProductsPath(businessId)}/${productId}`)),
  ])

  const firestoreProduct = firestoreSnapshot.exists()
    ? normalizeCatalogProduct(firestoreSnapshot.data(), productId)
    : null
  const legacyProduct = mergePublicCatalogCollections(
    legacyUserSnapshot.exists() ? { [productId]: legacyUserSnapshot.val() as ProductRecord } : {},
    legacyStoreSnapshot.exists() ? { [productId]: legacyStoreSnapshot.val() as ProductRecord } : {},
  )[productId]

  return firestoreProduct ?? legacyProduct ?? null
}

const writeProductMirrors = async (
  businessId: string,
  productId: string,
  productData: ProductRecord,
): Promise<void> => {
  const productRef = `${getLegacyUserProductsPath(businessId)}/${productId}`
  const storeProductRef = `${getLegacyStoreProductsPath(businessId)}/${productId}`
  await Promise.all([set(ref(database, productRef), productData), set(ref(database, storeProductRef), productData)])
}

const deleteProductMirrors = async (businessId: string, productId: string): Promise<void> => {
  const productRef = `${getLegacyUserProductsPath(businessId)}/${productId}`
  const storeProductRef = `${getLegacyStoreProductsPath(businessId)}/${productId}`
  await Promise.all([remove(ref(database, productRef)), remove(ref(database, storeProductRef))])
}

export const loadUserProducts = async (businessId: string): Promise<ProductCollection> => {
  if (!businessId) {
    return {}
  }

  const snapshot = await get(ref(database, getLegacyUserProductsPath(businessId)))
  return snapshot.exists() ? (snapshot.val() as ProductCollection) : {}
}

export const loadLegacyStoreProducts = async (businessId: string): Promise<ProductCollection> => {
  if (!businessId) {
    return {}
  }

  const snapshot = await get(ref(database, getLegacyStoreProductsPath(businessId)))
  return snapshot.exists() ? (snapshot.val() as ProductCollection) : {}
}

export const loadMergedProducts = async (businessId: string): Promise<ProductCollection> => {
  if (!businessId) {
    return {}
  }

  const cachedProducts = getBusinessCache<ProductCollection>("products", businessId)
  if (cachedProducts) {
    return cachedProducts
  }

  const [firestoreProducts, legacyProducts] = await Promise.all([
    loadAllFirestoreProducts(businessId),
    normalizeLegacyProducts(businessId),
  ])

  if (Object.keys(firestoreProducts).length === 0 && Object.keys(legacyProducts).length > 0) {
    await syncFirestoreProducts(businessId, legacyProducts)
    setBusinessCache("products", businessId, legacyProducts)
    return legacyProducts
  }

  const missingLegacyProducts = Object.entries(legacyProducts).reduce<ProductCollection>((accumulator, [productId, product]) => {
    if (!firestoreProducts[productId]) {
      accumulator[productId] = product
    }
    return accumulator
  }, {})

  if (Object.keys(missingLegacyProducts).length > 0) {
    await syncFirestoreProducts(businessId, missingLegacyProducts)
  }

  const mergedProducts = mergePublicCatalogCollections(firestoreProducts, legacyProducts)
  setBusinessCache("products", businessId, mergedProducts)
  return mergedProducts
}

export const watchMergedProducts = (
  businessId: string,
  callback: (products: ProductCollection) => void,
): (() => void) => {
  if (!businessId) {
    callback({})
    return () => {}
  }

  let userProducts: ProductCollection = {}
  let legacyProducts: ProductCollection = {}

  const emit = () => {
    const mergedProducts = mergePublicCatalogCollections(userProducts, legacyProducts)
    setBusinessCache("products", businessId, mergedProducts)
    callback(mergedProducts)
  }

  const unsubscribeUser = onValue(getLegacyUserProductsRef(businessId), (snapshot) => {
    userProducts = snapshot.exists() ? (snapshot.val() as ProductCollection) : {}
    emit()
  })

  const unsubscribeLegacy = onValue(getLegacyStoreProductsRef(businessId), (snapshot) => {
    legacyProducts = snapshot.exists() ? (snapshot.val() as ProductCollection) : {}
    emit()
  })

  return () => {
    unsubscribeUser()
    unsubscribeLegacy()
  }
}

export const saveProduct = async (
  businessId: string,
  productId: string,
  productData: ProductRecord,
): Promise<void> => {
  if (!businessId || !productId) {
    return
  }

  const existingProduct = await readExistingProduct(businessId, productId)
  const normalizedProduct = normalizeProductForWrite(businessId, productId, productData, existingProduct ?? {})
  const firestoreProductData = sanitizeFirestoreData(normalizedProduct)

  try {
    await Promise.all([
      setDoc(getFirestoreProductDocRef(businessId, productId), firestoreProductData),
      writeProductMirrors(businessId, productId, firestoreProductData),
    ])
  } finally {
    invalidateBusinessCache(businessId)
  }
}

export const createProduct = async (businessId: string, productData: ProductRecord): Promise<string> => {
  if (!businessId) {
    return ""
  }

  const productRef = doc(collection(firestore, getFirestoreProductsPath(businessId)))
  await saveProduct(businessId, productRef.id, productData)
  return productRef.id
}

export const deleteProduct = async (businessId: string, productId: string): Promise<void> => {
  if (!businessId || !productId) {
    return
  }

  try {
    await Promise.all([
      deleteDoc(getFirestoreProductDocRef(businessId, productId)),
      deleteProductMirrors(businessId, productId),
    ])
  } finally {
    invalidateBusinessCache(businessId)
  }
}

export const updateProduct = async (
  businessId: string,
  productId: string,
  updates: Partial<ProductRecord>,
): Promise<void> => {
  if (!businessId || !productId) {
    return
  }

  const existingProduct = await readExistingProduct(businessId, productId)
  await saveProduct(businessId, productId, {
    ...(existingProduct ?? {}),
    ...normalizeProductUpdatePayload(updates),
  })

  invalidateBusinessCache(businessId)
}

export const bulkUpdateProducts = async (
  businessId: string,
  updates: ProductUpdateMap,
): Promise<void> => {
  if (!businessId) {
    return
  }

  const updateEntries = Object.entries(updates)
  if (updateEntries.length === 0) {
    return
  }

  await Promise.all(updateEntries.map(([productId, productUpdates]) => updateProduct(businessId, productId, productUpdates)))
  invalidateBusinessCache(businessId)
}

export const setProductStock = async (businessId: string, productId: string, stock: number): Promise<void> => {
  await updateProduct(businessId, productId, {
    stock,
    fechaActualizacion: new Date().toISOString(),
  })

  invalidateBusinessCache(businessId)
}

export const setProductVisibility = async (
  businessId: string,
  productId: string,
  visibleEnTienda: boolean,
): Promise<void> => {
  await updateProduct(businessId, productId, {
    visibleInStore: visibleEnTienda,
    visibleEnTienda,
    fechaActualizacion: new Date().toISOString(),
  })

  invalidateBusinessCache(businessId)
}
