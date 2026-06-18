import { ref, set } from "firebase/database"
import { doc, getDoc, setDoc } from "firebase/firestore"
import { database, firestore } from "@/src/lib/firebase/client"
import { sanitizeFirestoreData } from "@/lib/product-sync"

export type BillingStatus = "al_dia" | "por_vencer" | "vencido"

export interface BusinessBillingRecord {
  businessId: string
  nombre: string
  email: string
  empresa: string
  plan: string
  precioMensual: number
  fechaAlta: string
  ultimoPago: string
  proximoPago: string
  diasAvisoPago: number
  estadoPago: BillingStatus
  pagoActivo: boolean
  paymentNotes: string
  ultimoRecordatorioPagoEnviadoAt?: string
  paymentReminderCount?: number
  createdAt?: string
  updatedAt?: string
  activo?: boolean
  uid?: string
  firebaseUid?: string
}

type BillingLikeRecord = Record<string, any>

const DAY_IN_MS = 24 * 60 * 60 * 1000
const BILLING_STATUSES: BillingStatus[] = ["al_dia", "por_vencer", "vencido"]

const isPlainObject = (value: unknown): value is Record<string, unknown> => {
  return typeof value === "object" && value !== null && !Array.isArray(value)
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

const toNumberValue = (value: unknown, fallback = 0) => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value
  }

  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : fallback
  }

  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

const toBooleanValue = (value: unknown, fallback = false) => {
  if (typeof value === "boolean") {
    return value
  }

  if (typeof value === "number") {
    return value !== 0
  }

  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase()
    if (["true", "1", "yes", "si", "sí"].includes(normalized)) {
      return true
    }
    if (["false", "0", "no"].includes(normalized)) {
      return false
    }
  }

  return fallback
}

const pad = (value: number) => `${value}`.padStart(2, "0")

const formatDateOnly = (value: Date) => {
  return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`
}

const parseDateOnly = (value: unknown): Date | null => {
  if (typeof value !== "string" || value.trim() === "") {
    return null
  }

  const normalized = value.trim()
  const candidate = new Date(normalized.includes("T") ? normalized : `${normalized}T12:00:00`)

  if (Number.isNaN(candidate.getTime())) {
    return null
  }

  return candidate
}

const toDateOnlyString = (value: unknown, fallback = "") => {
  const parsedDate = parseDateOnly(value)
  if (parsedDate) {
    return formatDateOnly(parsedDate)
  }

  return toStringValue(value, fallback)
}

const startOfDay = (value: Date) => {
  const date = new Date(value)
  date.setHours(0, 0, 0, 0)
  return date
}

const isBillingStatus = (value: unknown): value is BillingStatus => {
  return typeof value === "string" && BILLING_STATUSES.includes(value as BillingStatus)
}

export const todayDateString = () => formatDateOnly(new Date())

export const addMonthsToDateString = (value: string, months: number) => {
  const parsedDate = parseDateOnly(value) ?? new Date()
  const date = new Date(parsedDate)
  date.setMonth(date.getMonth() + months)
  return formatDateOnly(date)
}

export const formatBillingDate = (value?: string | null) => {
  const parsedDate = parseDateOnly(value)
  if (!parsedDate) {
    return ""
  }

  return parsedDate.toLocaleDateString("es-AR")
}

export const calculateBillingStatus = (
  record: Partial<BusinessBillingRecord>,
): { estadoPago: BillingStatus; diasRestantes: number | null } => {
  const dueDate = parseDateOnly(record.proximoPago)
  const warningDays = Math.max(0, Math.trunc(toNumberValue(record.diasAvisoPago, 3)))
  const paidActive = toBooleanValue(record.pagoActivo, true)

  if (!dueDate) {
    return {
      estadoPago: paidActive ? "al_dia" : "vencido",
      diasRestantes: null as number | null,
    }
  }

  const today = startOfDay(new Date())
  const due = startOfDay(dueDate)
  const diffDays = Math.floor((due.getTime() - today.getTime()) / DAY_IN_MS)

  if (diffDays < 0) {
    return {
      estadoPago: "vencido" as BillingStatus,
      diasRestantes: diffDays,
    }
  }

  if (diffDays <= warningDays) {
    return {
      estadoPago: "por_vencer" as BillingStatus,
      diasRestantes: diffDays,
    }
  }

  return {
    estadoPago: "al_dia" as BillingStatus,
    diasRestantes: diffDays,
  }
}

export const resolveBillingStatus = (
  record: Partial<BusinessBillingRecord>,
): { estadoPago: BillingStatus; diasRestantes: number | null } => {
  const calculated = calculateBillingStatus(record)

  if (isBillingStatus(record.estadoPago)) {
    return {
      estadoPago: record.estadoPago as BillingStatus,
      diasRestantes: calculated.diasRestantes,
    }
  }

  return calculated
}

const normalizeBillingRecord = (
  record: BillingLikeRecord = {},
  businessId = "",
): BusinessBillingRecord => {
  const normalizedNombre = toStringValue(record.nombre)
  const normalizedEmail = toStringValue(record.email)
  const normalizedEmpresa = toStringValue(record.empresa ?? record.nombre ?? normalizedNombre)
  const normalizedPlan = toStringValue(record.plan, "mensual") || "mensual"
  const normalizedPrecioMensual = toNumberValue(record.precioMensual ?? record.precio_mensual ?? 0)
  const normalizedFechaAlta = toDateOnlyString(record.fechaAlta ?? record.createdAt ?? todayDateString(), todayDateString()) || todayDateString()
  const normalizedUltimoPago = toDateOnlyString(record.ultimoPago ?? record.paymentLastPaidAt ?? normalizedFechaAlta, normalizedFechaAlta) || normalizedFechaAlta
  const normalizedProximoPago =
    toDateOnlyString(record.proximoPago ?? record.paymentNextDueAt ?? addMonthsToDateString(normalizedUltimoPago, 1), "") ||
    addMonthsToDateString(normalizedUltimoPago, 1)
  const normalizedDiasAvisoPago = toNumberValue(record.diasAvisoPago ?? record.daysWarning ?? 3, 3)
  const normalizedPagoActivo = toBooleanValue(record.pagoActivo ?? record.paymentActive ?? true, true)
  const normalizedNotes = toStringValue(record.paymentNotes ?? record.notasPago ?? record.notas ?? "")
  const resolvedStatus = resolveBillingStatus({
    estadoPago: record.estadoPago,
    proximoPago: normalizedProximoPago,
    diasAvisoPago: normalizedDiasAvisoPago,
    pagoActivo: normalizedPagoActivo,
  })

  return {
    businessId,
    nombre: normalizedNombre,
    email: normalizedEmail,
    empresa: normalizedEmpresa,
    plan: normalizedPlan,
    precioMensual: normalizedPrecioMensual,
    fechaAlta: normalizedFechaAlta,
    ultimoPago: normalizedUltimoPago,
    proximoPago: normalizedProximoPago,
    diasAvisoPago: normalizedDiasAvisoPago,
    estadoPago: resolvedStatus.estadoPago,
    pagoActivo: normalizedPagoActivo,
    paymentNotes: normalizedNotes,
    ultimoRecordatorioPagoEnviadoAt: toStringValue(record.ultimoRecordatorioPagoEnviadoAt),
    paymentReminderCount: toNumberValue(record.paymentReminderCount, 0),
    createdAt: toStringValue(record.createdAt ?? normalizedFechaAlta),
    updatedAt: toStringValue(record.updatedAt ?? record.fechaActualizacion ?? ""),
    activo: toBooleanValue(record.activo ?? true, true),
    uid: toStringValue(record.uid ?? record.firebaseUid ?? businessId),
    firebaseUid: toStringValue(record.firebaseUid ?? record.uid ?? businessId),
  }
}

export const loadBusinessBillingRecord = async (
  businessId: string,
  fallbackData: BillingLikeRecord = {},
): Promise<BusinessBillingRecord | null> => {
  if (!businessId) {
    return null
  }

  try {
    const snapshot = await getDoc(doc(firestore, "businesses", businessId))
    const firestoreData = snapshot.exists() && isPlainObject(snapshot.data()) ? snapshot.data() : {}

    return normalizeBillingRecord(
      {
        ...fallbackData,
        ...firestoreData,
        businessId,
      },
      businessId,
    )
  } catch (error) {
    console.error("Error al cargar datos de pago del negocio:", error)
    return normalizeBillingRecord({ ...fallbackData, businessId }, businessId)
  }
}

export const saveBusinessBillingRecord = async (
  businessId: string,
  billingData: BillingLikeRecord,
  legacyMirror?: BillingLikeRecord | null,
): Promise<BusinessBillingRecord> => {
  if (!businessId) {
    throw new Error("Falta el negocio para guardar los datos de pago")
  }

  const existingSnapshot = await getDoc(doc(firestore, "businesses", businessId))
  const existingData = existingSnapshot.exists() && isPlainObject(existingSnapshot.data()) ? existingSnapshot.data() : {}
  const normalizedRecord = normalizeBillingRecord(
    {
      ...existingData,
      ...billingData,
      businessId,
    },
    businessId,
  )

  const firestorePayload = sanitizeFirestoreData(normalizedRecord)

  await setDoc(doc(firestore, "businesses", businessId), firestorePayload, { merge: true })

  if (legacyMirror) {
    await set(ref(database, `usuarios/${businessId}`), sanitizeFirestoreData({ ...legacyMirror, ...normalizedRecord }))
  }

  return normalizedRecord
}
