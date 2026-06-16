import { get, onValue, ref, set } from "firebase/database"
import {
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  setDoc,
  where,
} from "firebase/firestore"
import { database, firestore } from "@/src/lib/firebase/client"
import {
  mergePublicCatalogCollections,
  normalizeCatalogProduct,
  sanitizeFirestoreData,
} from "@/lib/product-sync"
import { getBusinessCache, invalidateBusinessCache, setBusinessCache } from "@/src/lib/business-cache"
import {
  createProduct,
  deleteProduct,
  loadMergedProducts,
  saveProduct,
  setProductVisibility,
  watchMergedProducts,
  type ProductCollection,
  type ProductRecord,
} from "@/src/services/products.service"
import { uploadStoreLogo, uploadStoreProductImage } from "@/src/services/storage.service"

export interface StoreConfig {
  nombre: string
  descripcion: string
  telefono: string
  whatsapp: string
  direccion: string
  horarios: string
  logo: string
  email?: string
  redesSociales?: {
    facebook?: string
    instagram?: string
    twitter?: string
  }
  createdAt?: string
  updatedAt?: string
  businessId?: string
  [key: string]: any
}

const DEFAULT_STORE_CONFIG: StoreConfig = {
  nombre: "Mi Tienda",
  descripcion: "Los mejores productos al mejor precio",
  telefono: "",
  whatsapp: "",
  direccion: "",
  horarios: "",
  logo: "",
  email: "",
  redesSociales: {
    facebook: "",
    instagram: "",
    twitter: "",
  },
}

const getLegacyUserStoreConfigPath = (businessId: string) => `usuarios/${businessId}/tienda`
const getLegacyStoreConfigPath = (businessId: string) => `tiendas/${businessId}/config`
const getLegacyUserProductsPath = (businessId: string) => `usuarios/${businessId}/productos`
const getLegacyStoreProductsPath = (businessId: string) => `tiendas/${businessId}/productos`

const getFirestoreStoreConfigDocRef = (businessId: string) =>
  doc(firestore, "businesses", businessId, "storeConfig", "public")

const getFirestorePublicProductsCollectionRef = (businessId: string) =>
  collection(firestore, "businesses", businessId, "products")

const getLegacyUserStoreConfigRef = (businessId: string) => ref(database, getLegacyUserStoreConfigPath(businessId))
const getLegacyStoreConfigRef = (businessId: string) => ref(database, getLegacyStoreConfigPath(businessId))
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

const isPlainObject = (value: unknown): value is Record<string, unknown> => {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

const normalizeStoreConfig = (config: Record<string, any> = {}): StoreConfig => {
  const mergedSocials = isPlainObject(config.redesSociales) ? config.redesSociales : {}

  return {
    ...DEFAULT_STORE_CONFIG,
    ...config,
    nombre: toStringValue(config.nombre ?? config.name, DEFAULT_STORE_CONFIG.nombre),
    descripcion: toStringValue(config.descripcion ?? config.description, DEFAULT_STORE_CONFIG.descripcion),
    telefono: toStringValue(config.telefono ?? config.phone, DEFAULT_STORE_CONFIG.telefono),
    whatsapp: toStringValue(config.whatsapp, DEFAULT_STORE_CONFIG.whatsapp),
    direccion: toStringValue(config.direccion ?? config.address, DEFAULT_STORE_CONFIG.direccion),
    horarios: toStringValue(config.horarios ?? config.schedule, DEFAULT_STORE_CONFIG.horarios),
    logo: toStringValue(config.logo ?? config.imageUrl, DEFAULT_STORE_CONFIG.logo),
    email: toStringValue(config.email, DEFAULT_STORE_CONFIG.email),
    redesSociales: {
      facebook: toStringValue(mergedSocials.facebook ?? config.facebook, DEFAULT_STORE_CONFIG.redesSociales?.facebook ?? ""),
      instagram: toStringValue(mergedSocials.instagram ?? config.instagram, DEFAULT_STORE_CONFIG.redesSociales?.instagram ?? ""),
      twitter: toStringValue(mergedSocials.twitter ?? config.twitter, DEFAULT_STORE_CONFIG.redesSociales?.twitter ?? ""),
    },
    createdAt: toStringValue(config.createdAt ?? config.fechaCreacion),
    updatedAt: toStringValue(config.updatedAt ?? config.fechaActualizacion),
    businessId: toStringValue(config.businessId ?? config.usuarioId ?? config.tiendaId),
  }
}

const hasMeaningfulConfigData = (config: Record<string, unknown>): boolean => {
  return Object.values(config).some((value) => {
    if (typeof value === "string") {
      return value.trim() !== ""
    }
    if (typeof value === "number") {
      return Number.isFinite(value)
    }
    if (typeof value === "boolean") {
      return true
    }
    if (Array.isArray(value)) {
      return value.length > 0
    }
    return isPlainObject(value) && hasMeaningfulConfigData(value)
  })
}

const mergeLegacyStoreConfigs = (storeConfig: Record<string, any>, userConfig: Record<string, any>) => {
  return normalizeStoreConfig({
    ...userConfig,
    ...storeConfig,
  })
}

const loadLegacyStoreConfig = async (businessId: string): Promise<StoreConfig | null> => {
  if (!businessId) {
    return null
  }

  try {
    const [userSnapshot, storeSnapshot] = await Promise.all([
      get(getLegacyUserStoreConfigRef(businessId)),
      get(getLegacyStoreConfigRef(businessId)),
    ])

    const userConfig = userSnapshot.exists() && isPlainObject(userSnapshot.val()) ? userSnapshot.val() : {}
    const storeConfig = storeSnapshot.exists() && isPlainObject(storeSnapshot.val()) ? storeSnapshot.val() : {}
    const mergedConfig = mergeLegacyStoreConfigs(storeConfig, userConfig)

    return hasMeaningfulConfigData(mergedConfig) ? mergedConfig : null
  } catch (error) {
    console.error("Error al cargar configuración legacy de la tienda:", error)
    return null
  }
}

const loadFirestoreStoreConfig = async (businessId: string): Promise<StoreConfig | null> => {
  if (!businessId) {
    return null
  }

  try {
    const snapshot = await getDoc(getFirestoreStoreConfigDocRef(businessId))
    if (!snapshot.exists()) {
      return null
    }

    return normalizeStoreConfig(snapshot.data() as Record<string, any>)
  } catch (error) {
    console.error("Error al cargar configuración de Firestore:", error)
    return null
  }
}

export const loadStoreConfig = async (businessId: string): Promise<StoreConfig | null> => {
  const cachedConfig = getBusinessCache<StoreConfig>("store", businessId, "config")
  if (cachedConfig) {
    return cachedConfig
  }

  const firestoreConfig = await loadFirestoreStoreConfig(businessId)
  if (firestoreConfig) {
    setBusinessCache("store", businessId, firestoreConfig, "config")
    return firestoreConfig
  }

  const legacyConfig = await loadLegacyStoreConfig(businessId)
  if (legacyConfig) {
    setBusinessCache("store", businessId, legacyConfig, "config")
  }

  return legacyConfig
}

export const watchStoreConfig = (
  businessId: string,
  callback: (config: StoreConfig | null) => void,
): (() => void) => {
  if (!businessId) {
    callback(null)
    return () => {}
  }

  let fallbackUnsubscribe = () => {}
  let fallbackStarted = false

  const startFallback = () => {
    if (fallbackStarted) {
      return
    }

    fallbackStarted = true
    let legacyUserConfig: Record<string, any> = {}
    let legacyStoreConfig: Record<string, any> = {}

    const emitLegacyConfig = () => {
      const mergedConfig = mergeLegacyStoreConfigs(legacyStoreConfig, legacyUserConfig)
      if (hasMeaningfulConfigData(mergedConfig)) {
        setBusinessCache("store", businessId, mergedConfig, "config")
        callback(mergedConfig)
        return
      }

      invalidateBusinessCache(businessId, ["store", "public-store"])
      callback(null)
    }

    const unsubscribeUser = onValue(getLegacyUserStoreConfigRef(businessId), (snapshot) => {
      legacyUserConfig = snapshot.exists() && isPlainObject(snapshot.val()) ? (snapshot.val() as Record<string, any>) : {}
      emitLegacyConfig()
    })

    const unsubscribeStore = onValue(getLegacyStoreConfigRef(businessId), (snapshot) => {
      legacyStoreConfig = snapshot.exists() && isPlainObject(snapshot.val()) ? (snapshot.val() as Record<string, any>) : {}
      emitLegacyConfig()
    })

    fallbackUnsubscribe = () => {
      unsubscribeUser()
      unsubscribeStore()
    }
  }

  const unsubscribeFirestore = onSnapshot(
    getFirestoreStoreConfigDocRef(businessId),
    (snapshot) => {
      if (snapshot.exists()) {
        const normalizedConfig = normalizeStoreConfig(snapshot.data() as Record<string, any>)
        setBusinessCache("store", businessId, normalizedConfig, "config")
        callback(normalizedConfig)
        return
      }

      invalidateBusinessCache(businessId, ["store", "public-store"])
      startFallback()
    },
    (error) => {
      console.error("Error al escuchar configuración de Firestore:", error)
      startFallback()
    },
  )

  return () => {
    unsubscribeFirestore()
    fallbackUnsubscribe()
  }
}

const saveLegacyStoreConfig = async (businessId: string, config: StoreConfig): Promise<void> => {
  const normalizedConfig = sanitizeFirestoreData(normalizeStoreConfig(config))

  await Promise.all([
    set(getLegacyUserStoreConfigRef(businessId), normalizedConfig),
    set(getLegacyStoreConfigRef(businessId), normalizedConfig),
  ])
}

export const saveStoreConfig = async (businessId: string, config: StoreConfig): Promise<void> => {
  if (!businessId) {
    return
  }

  const now = new Date().toISOString()
  const existingSnapshot = await getDoc(getFirestoreStoreConfigDocRef(businessId))
  const existingConfig = existingSnapshot.exists() ? (existingSnapshot.data() as Record<string, any>) : {}
  const normalizedConfig = normalizeStoreConfig({
    ...existingConfig,
    ...config,
    businessId,
    createdAt: toStringValue(existingConfig.createdAt ?? config.createdAt ?? now, now),
    updatedAt: now,
  })
  const firestorePayload = sanitizeFirestoreData(normalizedConfig)

  try {
    await Promise.all([
      setDoc(getFirestoreStoreConfigDocRef(businessId), firestorePayload),
      saveLegacyStoreConfig(businessId, normalizedConfig),
    ])
  } finally {
    invalidateBusinessCache(businessId)
  }
}

export const loadStoreProducts = async (businessId: string): Promise<ProductCollection> => {
  return loadMergedProducts(businessId)
}

export const watchStoreProducts = (
  businessId: string,
  callback: (products: ProductCollection) => void,
): (() => void) => {
  return watchMergedProducts(businessId, callback)
}

export const saveStoreProduct = async (
  businessId: string,
  productId: string,
  productData: ProductRecord,
): Promise<void> => {
  await saveProduct(businessId, productId, productData)
}

export const createStoreProduct = async (businessId: string, productData: ProductRecord): Promise<string> => {
  if (!businessId) {
    return ""
  }

  return createProduct(businessId, productData)
}

export const deleteStoreProduct = async (businessId: string, productId: string): Promise<void> => {
  await deleteProduct(businessId, productId)
}

export const toggleStoreProductVisibility = async (
  businessId: string,
  productId: string,
  visibleEnTienda: boolean,
): Promise<void> => {
  await setProductVisibility(businessId, productId, visibleEnTienda)
}

const loadFirestoreVisibleStoreProducts = async (businessId: string): Promise<ProductCollection> => {
  if (!businessId) {
    return {}
  }

  const snapshot = await getDocs(
    query(
      getFirestorePublicProductsCollectionRef(businessId),
      where("active", "==", true),
      where("visibleInStore", "==", true),
      where("stock", ">", 0),
    ),
  )

  const products: ProductCollection = {}

  snapshot.forEach((documentSnapshot) => {
    products[documentSnapshot.id] = normalizeCatalogProduct(documentSnapshot.data() as ProductRecord, documentSnapshot.id)
  })

  return products
}

const loadLegacyPublicStoreProducts = async (businessId: string): Promise<ProductCollection> => {
  if (!businessId) {
    return {}
  }

  try {
    const [userSnapshot, storeSnapshot] = await Promise.all([
      get(getLegacyUserProductsRef(businessId)),
      get(getLegacyStoreProductsRef(businessId)),
    ])

    const userProducts = userSnapshot.exists() && isPlainObject(userSnapshot.val()) ? (userSnapshot.val() as ProductCollection) : {}
    const storeProducts =
      storeSnapshot.exists() && isPlainObject(storeSnapshot.val()) ? (storeSnapshot.val() as ProductCollection) : {}

    return mergePublicCatalogCollections(userProducts, storeProducts)
  } catch (error) {
    console.error("Error al cargar productos legacy públicos:", error)
    return {}
  }
}

const filterPublicProducts = (products: ProductCollection): ProductCollection => {
  return Object.entries(products).reduce<ProductCollection>((accumulator, [productId, product]) => {
    const normalizedProduct = normalizeCatalogProduct(product as ProductRecord, productId)
    const isVisible = normalizedProduct.active !== false && normalizedProduct.visibleInStore !== false
    const hasStock = Number(normalizedProduct.stock ?? 0) > 0

    if (isVisible && hasStock) {
      accumulator[productId] = normalizedProduct
    }

    return accumulator
  }, {})
}

export const loadPublicStore = async (businessId: string) => {
  const cachedPublicStore = getBusinessCache<{
    config: StoreConfig | null
    products: ProductCollection
  }>("public-store", businessId, "public")
  if (cachedPublicStore) {
    return cachedPublicStore
  }

  const config = await loadStoreConfig(businessId)

  let products: ProductCollection = {}

  try {
    const firestoreProducts = await loadFirestoreVisibleStoreProducts(businessId)
    products = filterPublicProducts(firestoreProducts)
  } catch (error) {
    console.error("Error al cargar productos públicos desde Firestore:", error)
  }

  if (Object.keys(products).length === 0) {
    const legacyProducts = await loadLegacyPublicStoreProducts(businessId)
    products = filterPublicProducts(legacyProducts)
  }

  if (Object.keys(products).length === 0) {
    try {
      const mergedProducts = await loadMergedProducts(businessId)
      products = filterPublicProducts(mergedProducts)
    } catch (error) {
      console.error("Error al cargar productos combinados para la tienda pública:", error)
    }
  }

  const publicStore = {
    config,
    products,
  }

  setBusinessCache("public-store", businessId, publicStore, "public")

  return publicStore
}

export const uploadStoreProductPhoto = async (businessId: string, file: File): Promise<string> => {
  return uploadStoreProductImage(businessId, file)
}

export const uploadStoreLogoImage = async (businessId: string, file: File): Promise<string> => {
  return uploadStoreLogo(businessId, file)
}
