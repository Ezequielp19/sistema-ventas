import { get, ref, remove, set } from "firebase/database"
import { collection, doc, getDoc, getDocs, setDoc } from "firebase/firestore"
import { database, firestore } from "@/src/lib/firebase/client"
import { ANALYTICS_EVENTS, trackEvent } from "@/src/services/analytics.service"
import { sanitizeFirestoreData } from "@/lib/product-sync"
import { getBusinessCache, invalidateBusinessCache, setBusinessCache } from "@/src/lib/business-cache"
import { bulkUpdateProducts, type ProductCollection, type ProductRecord } from "@/src/services/products.service"

export type ProviderRecord = Record<string, any>
export type ProviderCollection = Record<string, ProviderRecord>
export type PriceAdjustmentType = "aumento" | "reduccion"

const getProvidersPath = (businessId: string) => `businesses/${businessId}/providers`
const getLegacyProvidersPath = (businessId: string) => `usuarios/${businessId}/proveedores`

const getProvidersCollectionRef = (businessId: string) => collection(firestore, getProvidersPath(businessId))
const getProviderDocRef = (businessId: string, providerId: string) =>
  doc(firestore, getProvidersPath(businessId), providerId)

const getLegacyProvidersRef = (businessId: string) => ref(database, getLegacyProvidersPath(businessId))
const getLegacyProviderRef = (businessId: string, providerId: string) =>
  ref(database, `${getLegacyProvidersPath(businessId)}/${providerId}`)

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

const toBooleanValue = (value: unknown, fallback = false) => {
  if (typeof value === "boolean") {
    return value
  }

  if (typeof value === "number") {
    return value !== 0
  }

  if (typeof value === "string") {
    const normalizedValue = value.trim().toLowerCase()
    if (["true", "1", "yes", "si", "sí"].includes(normalizedValue)) {
      return true
    }

    if (["false", "0", "no"].includes(normalizedValue)) {
      return false
    }
  }

  return fallback
}

const normalizeProviderForWrite = (
  businessId: string,
  providerId: string,
  providerData: ProviderRecord,
  existingProvider: ProviderRecord = {},
) => {
  const mergedSource: ProviderRecord = {
    ...existingProvider,
    ...providerData,
  }

  const nombre = toStringValue(mergedSource.nombre ?? mergedSource.name)
  const contacto = toStringValue(mergedSource.contacto ?? mergedSource.contactPerson ?? mergedSource.contact)
  const telefono = toStringValue(mergedSource.telefono ?? mergedSource.phone)
  const email = toStringValue(mergedSource.email ?? mergedSource.mail)
  const direccion = toStringValue(mergedSource.direccion ?? mergedSource.address)
  const notas = toStringValue(mergedSource.notas ?? mergedSource.notes)
  const activo = toBooleanValue(mergedSource.activo ?? mergedSource.active, true)
  const createdAt = toStringValue(mergedSource.createdAt ?? mergedSource.fechaCreacion ?? new Date().toISOString())
  const updatedAt = new Date().toISOString()

  return {
    ...mergedSource,
    id: providerId,
    providerId,
    businessId,
    usuarioId: businessId,
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

const normalizeProviderCollection = (businessId: string, providers: ProviderCollection): ProviderCollection => {
  return Object.entries(providers || {}).reduce<ProviderCollection>((accumulator, [providerId, providerData]) => {
    accumulator[providerId] = normalizeProviderForWrite(businessId, providerId, providerData || {})
    return accumulator
  }, {})
}

const filterActiveProviders = (providers: ProviderCollection): ProviderCollection => {
  return Object.entries(providers || {}).reduce<ProviderCollection>((accumulator, [providerId, providerData]) => {
    const isActive = toBooleanValue(providerData?.activo ?? providerData?.active, true)
    if (isActive) {
      accumulator[providerId] = providerData
    }
    return accumulator
  }, {})
}

const readFirestoreProviders = async (businessId: string): Promise<ProviderCollection> => {
  const snapshot = await getDocs(getProvidersCollectionRef(businessId))
  return snapshot.docs.reduce<ProviderCollection>((accumulator, providerDoc) => {
    accumulator[providerDoc.id] = {
      ...(providerDoc.data() as ProviderRecord),
      id: providerDoc.id,
    }
    return accumulator
  }, {})
}

const readLegacyProviders = async (businessId: string): Promise<ProviderCollection> => {
  const snapshot = await get(getLegacyProvidersRef(businessId))
  return snapshot.exists() ? (snapshot.val() as ProviderCollection) : {}
}

const mirrorActiveProvidersToLegacy = async (businessId: string, providers: ProviderCollection) => {
  const activeProviders = filterActiveProviders(providers)
  const sanitizedProviders = sanitizeFirestoreData(activeProviders)

  if (Object.keys(activeProviders).length === 0) {
    await remove(getLegacyProvidersRef(businessId))
    return
  }

  await set(getLegacyProvidersRef(businessId), sanitizedProviders)
}

const readExistingProvider = async (businessId: string, providerId: string): Promise<ProviderRecord | null> => {
  if (!businessId || !providerId) {
    return null
  }

  const [firestoreSnapshot, legacySnapshot] = await Promise.all([
    getDoc(getProviderDocRef(businessId, providerId)),
    get(getLegacyProviderRef(businessId, providerId)),
  ])

  const firestoreProvider = firestoreSnapshot.exists() ? (firestoreSnapshot.data() as ProviderRecord) : null
  const legacyProvider = legacySnapshot.exists() ? (legacySnapshot.val() as ProviderRecord) : null

  if (firestoreProvider) {
    return normalizeProviderForWrite(
      businessId,
      providerId,
      firestoreProvider,
      legacyProvider ?? {},
    )
  }

  if (legacyProvider) {
    const normalizedLegacyProvider = normalizeProviderForWrite(businessId, providerId, legacyProvider)
    await setDoc(getProviderDocRef(businessId, providerId), sanitizeFirestoreData(normalizedLegacyProvider))
    return normalizedLegacyProvider
  }

  return null
}

export const migrateLegacyProvidersToFirestore = async (businessId: string): Promise<ProviderCollection> => {
  if (!businessId) {
    return {}
  }

  const legacyProviders = normalizeProviderCollection(businessId, await readLegacyProviders(businessId))
  const migrationEntries = Object.entries(legacyProviders)

  if (migrationEntries.length === 0) {
    return {}
  }

  try {
    await Promise.all(
      migrationEntries.map(([providerId, providerData]) =>
        setDoc(getProviderDocRef(businessId, providerId), sanitizeFirestoreData(providerData)),
      ),
    )
  } finally {
    invalidateBusinessCache(businessId)
  }

  return legacyProviders
}

export const loadProviders = async (businessId: string): Promise<ProviderCollection> => {
  if (!businessId) {
    return {}
  }

  const cachedProviders = getBusinessCache<ProviderCollection>("providers", businessId)
  if (cachedProviders) {
    return cachedProviders
  }

  let firestoreProviders: ProviderCollection = {}
  let legacyProviders: ProviderCollection = {}

  try {
    firestoreProviders = normalizeProviderCollection(businessId, await readFirestoreProviders(businessId))
  } catch (error) {
    console.error("Error al cargar proveedores desde Firestore:", error)
  }

  try {
    legacyProviders = normalizeProviderCollection(businessId, await readLegacyProviders(businessId))
  } catch (error) {
    console.error("Error al cargar proveedores legados:", error)
  }

  const legacyProvidersToMigrate = Object.entries(legacyProviders).filter(
    ([providerId]) => firestoreProviders[providerId] === undefined,
  )

  if (legacyProvidersToMigrate.length > 0) {
    await Promise.all(
      legacyProvidersToMigrate.map(([providerId, providerData]) =>
        setDoc(getProviderDocRef(businessId, providerId), sanitizeFirestoreData(providerData)),
      ),
    )

    firestoreProviders = {
      ...firestoreProviders,
      ...Object.fromEntries(legacyProvidersToMigrate),
    }
  }

  const mergedProviders = {
    ...legacyProviders,
    ...firestoreProviders,
  }

  const activeProviders = filterActiveProviders(mergedProviders)

  await Promise.allSettled([mirrorActiveProvidersToLegacy(businessId, activeProviders)])

  setBusinessCache("providers", businessId, activeProviders)

  return activeProviders
}

export const saveProvider = async (
  businessId: string,
  providerId: string,
  providerData: ProviderRecord,
): Promise<void> => {
  if (!businessId || !providerId) {
    return
  }

  const existingProvider = await readExistingProvider(businessId, providerId)
  const normalizedProvider = normalizeProviderForWrite(businessId, providerId, providerData, existingProvider ?? {})
  const firestoreProviderData = sanitizeFirestoreData(normalizedProvider)

  try {
    await Promise.all([
      setDoc(getProviderDocRef(businessId, providerId), firestoreProviderData),
      normalizedProvider.activo === false
        ? remove(getLegacyProviderRef(businessId, providerId))
        : set(getLegacyProviderRef(businessId, providerId), firestoreProviderData),
    ])
    void trackEvent(existingProvider ? ANALYTICS_EVENTS.providerUpdated : ANALYTICS_EVENTS.providerCreated, {
      businessId,
      providerId,
    })
  } finally {
    invalidateBusinessCache(businessId)
  }
}

export const createProvider = async (businessId: string, providerData: ProviderRecord): Promise<string> => {
  if (!businessId) {
    return ""
  }

  const providerRef = doc(collection(firestore, getProvidersPath(businessId)))
  await saveProvider(businessId, providerRef.id, providerData)
  return providerRef.id
}

export const deleteProvider = async (businessId: string, providerId: string): Promise<void> => {
  if (!businessId || !providerId) {
    return
  }

  const existingProvider = await readExistingProvider(businessId, providerId)
  const deactivatedProvider = normalizeProviderForWrite(
    businessId,
    providerId,
    {
      ...(existingProvider ?? {}),
      activo: false,
      active: false,
      updatedAt: new Date().toISOString(),
      fechaActualizacion: new Date().toISOString(),
    },
    existingProvider ?? {},
  )

  try {
    await Promise.all([
      setDoc(getProviderDocRef(businessId, providerId), sanitizeFirestoreData(deactivatedProvider)),
      remove(getLegacyProviderRef(businessId, providerId)),
    ])
    void trackEvent(ANALYTICS_EVENTS.providerDeleted, {
      businessId,
      providerId,
    })
  } finally {
    invalidateBusinessCache(businessId)
  }
}

export const setProviderActive = async (
  businessId: string,
  providerId: string,
  active: boolean,
): Promise<void> => {
  if (!businessId || !providerId) {
    return
  }

  const existingProvider = await readExistingProvider(businessId, providerId)
  const updatedProvider = normalizeProviderForWrite(
    businessId,
    providerId,
    {
      ...(existingProvider ?? {}),
      activo: active,
      active,
      updatedAt: new Date().toISOString(),
      fechaActualizacion: new Date().toISOString(),
    },
    existingProvider ?? {},
  )

  try {
    await Promise.all([
      setDoc(getProviderDocRef(businessId, providerId), sanitizeFirestoreData(updatedProvider)),
      active
        ? set(getLegacyProviderRef(businessId, providerId), sanitizeFirestoreData(updatedProvider))
        : remove(getLegacyProviderRef(businessId, providerId)),
    ])
    void trackEvent(ANALYTICS_EVENTS.providerUpdated, {
      businessId,
      providerId,
    })
  } finally {
    invalidateBusinessCache(businessId)
  }
}

export const adjustProductPricesByProvider = async (
  businessId: string,
  products: ProductCollection,
  providerId: string,
  adjustmentType: PriceAdjustmentType,
  percentageValue: string,
): Promise<void> => {
  if (!businessId || !providerId || !percentageValue) {
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

  await bulkUpdateProducts(businessId, updates)
}
