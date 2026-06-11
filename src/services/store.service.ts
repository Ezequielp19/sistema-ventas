import { get, onValue, ref, set } from "firebase/database"
import { database } from "@/src/lib/firebase/client"
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
  [key: string]: any
}

const getStoreConfigPath = (userId: string) => `tiendas/${userId}/config`
const getStoreConfigRef = (userId: string) => ref(database, getStoreConfigPath(userId))

export const loadStoreConfig = async (userId: string): Promise<StoreConfig | null> => {
  if (!userId) {
    return null
  }

  const snapshot = await get(getStoreConfigRef(userId))
  return snapshot.exists() ? (snapshot.val() as StoreConfig) : null
}

export const watchStoreConfig = (
  userId: string,
  callback: (config: StoreConfig | null) => void,
): (() => void) => {
  if (!userId) {
    callback(null)
    return () => {}
  }

  const unsubscribe = onValue(getStoreConfigRef(userId), (snapshot) => {
    callback(snapshot.exists() ? (snapshot.val() as StoreConfig) : null)
  })

  return unsubscribe
}

export const saveStoreConfig = async (userId: string, config: StoreConfig): Promise<void> => {
  if (!userId) {
    return
  }

  await set(getStoreConfigRef(userId), config)
}

export const loadStoreProducts = async (userId: string): Promise<ProductCollection> => {
  return loadMergedProducts(userId)
}

export const watchStoreProducts = (
  userId: string,
  callback: (products: ProductCollection) => void,
): (() => void) => {
  return watchMergedProducts(userId, callback)
}

export const saveStoreProduct = async (
  userId: string,
  productId: string,
  productData: ProductRecord,
): Promise<void> => {
  await saveProduct(userId, productId, productData)
}

export const createStoreProduct = async (userId: string, productData: ProductRecord): Promise<string> => {
  if (!userId) {
    return ""
  }

  return createProduct(userId, productData)
}

export const deleteStoreProduct = async (userId: string, productId: string): Promise<void> => {
  await deleteProduct(userId, productId)
}

export const toggleStoreProductVisibility = async (
  userId: string,
  productId: string,
  visibleEnTienda: boolean,
): Promise<void> => {
  await setProductVisibility(userId, productId, visibleEnTienda)
}

export const loadPublicStore = async (userId: string) => {
  const [config, products] = await Promise.all([
    loadStoreConfig(userId),
    loadStoreProducts(userId),
  ])

  return {
    config,
    products,
  }
}

export const uploadStoreProductPhoto = async (userId: string, file: File): Promise<string> => {
  return uploadStoreProductImage(userId, file)
}

export const uploadStoreLogoImage = async (userId: string, file: File): Promise<string> => {
  return uploadStoreLogo(userId, file)
}
