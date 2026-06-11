import { get, onValue, push, ref, remove, set, update } from "firebase/database"
import { database } from "@/src/lib/firebase/client"
import { mergePublicCatalogCollections } from "@/lib/product-sync"

export type ProductRecord = Record<string, any>
export type ProductCollection = Record<string, ProductRecord>
export type ProductUpdateMap = Record<string, Partial<ProductRecord>>

const getUserProductsPath = (userId: string) => `usuarios/${userId}/productos`
const getLegacyStoreProductsPath = (userId: string) => `tiendas/${userId}/productos`

const getUserProductsRef = (userId: string) => ref(database, getUserProductsPath(userId))
const getLegacyStoreProductsRef = (userId: string) => ref(database, getLegacyStoreProductsPath(userId))

const readCollection = async (path: string): Promise<ProductCollection> => {
  if (!path) {
    return {}
  }

  const snapshot = await get(ref(database, path))
  return snapshot.exists() ? (snapshot.val() as ProductCollection) : {}
}

export const loadUserProducts = async (userId: string): Promise<ProductCollection> => {
  if (!userId) {
    return {}
  }

  return readCollection(getUserProductsPath(userId))
}

export const loadLegacyStoreProducts = async (userId: string): Promise<ProductCollection> => {
  if (!userId) {
    return {}
  }

  return readCollection(getLegacyStoreProductsPath(userId))
}

export const loadMergedProducts = async (userId: string): Promise<ProductCollection> => {
  if (!userId) {
    return {}
  }

  const [userProducts, legacyProducts] = await Promise.all([
    loadUserProducts(userId),
    loadLegacyStoreProducts(userId),
  ])

  return mergePublicCatalogCollections(userProducts, legacyProducts)
}

export const watchMergedProducts = (
  userId: string,
  callback: (products: ProductCollection) => void,
): (() => void) => {
  if (!userId) {
    callback({})
    return () => {}
  }

  let userProducts: ProductCollection = {}
  let legacyProducts: ProductCollection = {}

  const emit = () => {
    callback(mergePublicCatalogCollections(userProducts, legacyProducts))
  }

  const unsubscribeUser = onValue(getUserProductsRef(userId), (snapshot) => {
    userProducts = snapshot.exists() ? (snapshot.val() as ProductCollection) : {}
    emit()
  })

  const unsubscribeLegacy = onValue(getLegacyStoreProductsRef(userId), (snapshot) => {
    legacyProducts = snapshot.exists() ? (snapshot.val() as ProductCollection) : {}
    emit()
  })

  return () => {
    unsubscribeUser()
    unsubscribeLegacy()
  }
}

export const saveProduct = async (
  userId: string,
  productId: string,
  productData: ProductRecord,
): Promise<void> => {
  if (!userId || !productId) {
    return
  }

  await set(ref(database, `${getUserProductsPath(userId)}/${productId}`), productData)
}

export const createProduct = async (userId: string, productData: ProductRecord): Promise<string> => {
  if (!userId) {
    return ""
  }

  const productRef = push(getUserProductsRef(userId))
  await set(productRef, productData)
  return productRef.key ?? ""
}

export const deleteProduct = async (userId: string, productId: string): Promise<void> => {
  if (!userId || !productId) {
    return
  }

  await Promise.all([
    remove(ref(database, `${getUserProductsPath(userId)}/${productId}`)),
    remove(ref(database, `${getLegacyStoreProductsPath(userId)}/${productId}`)),
  ])
}

export const updateProduct = async (
  userId: string,
  productId: string,
  updates: Partial<ProductRecord>,
): Promise<void> => {
  if (!userId || !productId) {
    return
  }

  await update(ref(database, `${getUserProductsPath(userId)}/${productId}`), updates)
}

export const bulkUpdateProducts = async (
  userId: string,
  updates: ProductUpdateMap,
): Promise<void> => {
  if (!userId) {
    return
  }

  const flattenedUpdates = Object.entries(updates).reduce<Record<string, unknown>>((accumulator, [productId, productUpdates]) => {
    Object.entries(productUpdates).forEach(([field, value]) => {
      accumulator[`${getUserProductsPath(userId)}/${productId}/${field}`] = value
    })
    return accumulator
  }, {})

  if (Object.keys(flattenedUpdates).length === 0) {
    return
  }

  await update(ref(database), flattenedUpdates)
}

export const setProductStock = async (userId: string, productId: string, stock: number): Promise<void> => {
  await updateProduct(userId, productId, {
    stock,
    fechaActualizacion: new Date().toISOString(),
  })
}

export const setProductVisibility = async (
  userId: string,
  productId: string,
  visibleEnTienda: boolean,
): Promise<void> => {
  await updateProduct(userId, productId, {
    visibleEnTienda,
    fechaActualizacion: new Date().toISOString(),
  })
}
