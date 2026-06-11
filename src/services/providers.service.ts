import { get, push, ref, remove, set } from "firebase/database"
import { database } from "@/src/lib/firebase/client"
import { bulkUpdateProducts, type ProductCollection, type ProductRecord } from "@/src/services/products.service"

export type ProviderRecord = Record<string, any>
export type ProviderCollection = Record<string, ProviderRecord>
export type PriceAdjustmentType = "aumento" | "reduccion"

const getProvidersPath = (userId: string) => `usuarios/${userId}/proveedores`
const getProvidersRef = (userId: string) => ref(database, getProvidersPath(userId))

const readCollection = async (path: string): Promise<ProviderCollection> => {
  if (!path) {
    return {}
  }

  const snapshot = await get(ref(database, path))
  return snapshot.exists() ? (snapshot.val() as ProviderCollection) : {}
}

export const loadProviders = async (userId: string): Promise<ProviderCollection> => {
  if (!userId) {
    return {}
  }

  return readCollection(getProvidersPath(userId))
}

export const saveProvider = async (
  userId: string,
  providerId: string,
  providerData: ProviderRecord,
): Promise<void> => {
  if (!userId || !providerId) {
    return
  }

  await set(ref(database, `${getProvidersPath(userId)}/${providerId}`), providerData)
}

export const createProvider = async (userId: string, providerData: ProviderRecord): Promise<string> => {
  if (!userId) {
    return ""
  }

  const providerRef = push(getProvidersRef(userId))
  await set(providerRef, providerData)
  return providerRef.key ?? ""
}

export const deleteProvider = async (userId: string, providerId: string): Promise<void> => {
  if (!userId || !providerId) {
    return
  }

  await remove(ref(database, `${getProvidersPath(userId)}/${providerId}`))
}

export const adjustProductPricesByProvider = async (
  userId: string,
  products: ProductCollection,
  providerId: string,
  adjustmentType: PriceAdjustmentType,
  percentageValue: string,
): Promise<void> => {
  if (!userId || !providerId || !percentageValue) {
    return
  }

  const percentage = Number.parseFloat(percentageValue) / 100
  if (!Number.isFinite(percentage)) {
    return
  }

  const factor = adjustmentType === "aumento" ? 1 + percentage : Math.max(0, 1 - percentage)
  const affectedProducts =
    providerId === "todos"
      ? Object.entries(products)
      : Object.entries(products).filter(([, product]) => product.proveedor === providerId)

  const updates: Record<string, Partial<ProductRecord>> = {}

  affectedProducts.forEach(([productId, product]) => {
    const basePrice = Number(product.precioVenta ?? product.precio ?? 0)
    const updatedPrice = basePrice * factor

    updates[productId] = {
      precioVenta: updatedPrice,
      precio: updatedPrice,
      fechaActualizacion: new Date().toISOString(),
    }
  })

  await bulkUpdateProducts(userId, updates)
}
