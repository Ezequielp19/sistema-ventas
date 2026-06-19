"use client"

import { useState, useEffect, useRef, type FormEvent } from "react"
import { ref, get, push, remove } from "firebase/database"
import { initializeApp, getApps } from "firebase/app"
import {
  createUserWithEmailAndPassword,
  deleteUser,
  getAuth,
  type User,
  signInWithEmailAndPassword,
  signOut,
} from "firebase/auth"
import { database, auth, firebaseConfig } from "@/lib/firebase"
import emailjs from "@emailjs/browser"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { 
  Plus, 
  Edit, 
  Trash2, 
  Users, 
  LogOut, 
  Crown,
  Copy,
  CheckCircle,
  AlertCircle,
  UserX,
  UserCheck,
  Database,
  BellRing,
  BadgeDollarSign,
  Wallet,
} from "lucide-react"
import { ThemeToggle } from "@/components/theme-toggle"
import { deleteDemoDataForBusiness, seedDemoDataForBusiness } from "@/src/services/demo-data.service"
import {
  addMonthsToDateString,
  calculateBillingStatus,
  findBusinessBillingRecordsByEmail,
  formatBillingDate,
  loadBusinessBillingRecord,
  resolveBillingStatus,
  saveBusinessBillingRecord,
  todayDateString,
  type BillingStatus,
  type BusinessBillingRecord,
} from "@/src/services/business-billing.service"
import { deleteBusinessClientData } from "@/src/services/business-cleanup.service"

// Configuración de EmailJS
const EMAILJS_SERVICE_ID = "service_161dv6f"
const EMAILJS_PUBLIC_KEY = "QLg98FNv2a5z4ZK77"
const ACCOUNT_CREATION_TEMPLATE_ID = "template_njhbffj"
const PAYMENT_REMINDER_TEMPLATE_ID = "template_fheag2h"
const GESTIONPRO_CONTACT_EMAIL = "gestionproinfo@gmail.com"

const APP_URL = "https://sistema-ventas-lilac.vercel.app/"
const SUPER_ADMIN_EMAIL = "adminatenea@software.com"
const SUPER_ADMIN_PASSWORD = "adminatenea"
const SECONDARY_AUTH_APP_NAME = "SecondaryAuthApp"
let emailjsInitialized = false

type SuperAdminPanelProps = {
  user: {
    email?: string
  } | null
  onLogout: () => void
}

type UserFormData = {
  nombre: string
  email: string
  password: string
  empresa: string
  rol: string
  activo: boolean
  plan: string
  precioMensual: string
  fechaAlta: string
  ultimoPago: string
  proximoPago: string
  diasAvisoPago: string
  estadoPago: BillingStatus
  pagoActivo: boolean
  paymentNotes: string
}

type InternalUserRecord = Partial<BusinessBillingRecord> & {
  nombre?: string
  email?: string
  password?: string
  empresa?: string
  rol?: string
  role?: string
  activo?: boolean
  uid?: string
  firebaseUid?: string
  businessId?: string
  createdAt?: string
  updatedAt?: string
  fechaCreacion?: string
  fechaActualizacion?: string
  creadoPor?: string
}

type PaymentNotice = {
  type: "success" | "error"
  message: string
} | null

type ExistingClientMatch = {
  businessId: string
  source: "realtime" | "firestore"
  nombre: string
  email: string
  empresa: string
  activo: boolean
  firebaseUid?: string
  uid?: string
  password?: string
  createdAt?: string
  updatedAt?: string
  rawRecord: InternalUserRecord
}

type PendingClientCreation = {
  formData: UserFormData
  matches: ExistingClientMatch[]
}

type ErrorDetails = {
  code: string
  message: string
  status?: number
  text?: string
}

const secondaryApp =
  getApps().find((app) => app.name === SECONDARY_AUTH_APP_NAME) ??
  initializeApp(firebaseConfig, SECONDARY_AUTH_APP_NAME)
const secondaryAuth = getAuth(secondaryApp)

export default function SuperAdminPanel({ user, onLogout }: SuperAdminPanelProps) {
  const [usuarios, setUsuarios] = useState<Record<string, InternalUserRecord>>({})
  const [showUserDialog, setShowUserDialog] = useState(false)
  const [editingUser, setEditingUser] = useState<string | null>(null)
  const [copiedPassword, setCopiedPassword] = useState<string | null>(null)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")
  const [sendingEmail, setSendingEmail] = useState(false)
  const [savingUser, setSavingUser] = useState(false)
  const [demoLoadingUserId, setDemoLoadingUserId] = useState<string | null>(null)
  const [paymentFilter, setPaymentFilter] = useState<"all" | BillingStatus>("all")
  const [paymentAction, setPaymentAction] = useState<{ userId: string; type: "mark_paid" | "reminder" } | null>(null)
  const [paymentNotice, setPaymentNotice] = useState<PaymentNotice>(null)
  const [pendingClientCreation, setPendingClientCreation] = useState<PendingClientCreation | null>(null)
  const [pendingClientDecision, setPendingClientDecision] = useState<"reuse" | "clean" | null>(null)
  const [showClientConflictDialog, setShowClientConflictDialog] = useState(false)
  const [permanentDeleteTarget, setPermanentDeleteTarget] = useState<{ id: string; userData: InternalUserRecord } | null>(null)
  const [permanentDeleteConfirmation, setPermanentDeleteConfirmation] = useState("")
  const [permanentDeleteLoading, setPermanentDeleteLoading] = useState(false)
  const [demoDeleteTarget, setDemoDeleteTarget] = useState<{ id: string; userData: InternalUserRecord } | null>(null)
  const [demoDeleteConfirmation, setDemoDeleteConfirmation] = useState("")
  const [demoDeleteLoading, setDemoDeleteLoading] = useState(false)
  const paymentNoticeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const initialPaymentStatusRef = useRef<BillingStatus>("al_dia")

  const [userFormData, setUserFormData] = useState<UserFormData>({
    nombre: "",
    email: "",
    password: "",
    empresa: "",
    rol: "user",
    activo: true,
    plan: "mensual",
    precioMensual: "0",
    fechaAlta: todayDateString(),
    ultimoPago: todayDateString(),
    proximoPago: addMonthsToDateString(todayDateString(), 1),
    diasAvisoPago: "3",
    estadoPago: "al_dia",
    pagoActivo: true,
    paymentNotes: "",
  })

  const normalizeEmail = (value: string) => value.trim().toLowerCase()

  const isValidEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())

  const getErrorDetails = (value: unknown): ErrorDetails => {
    if (value instanceof Error) {
      return { code: "", message: value.message }
    }

    if (value && typeof value === "object") {
      const errorValue = value as ErrorDetails
      return {
        code: errorValue.code || "",
        message: errorValue.message || errorValue.text || "",
        status: errorValue.status,
        text: errorValue.text || "",
      }
    }

    return {
      code: "",
      message: typeof value === "string" ? value : "Error desconocido",
    }
  }

  const mapAuthCreationError = (value: unknown) => {
    const { code, message } = getErrorDetails(value)

    switch (code) {
      case "auth/email-already-in-use":
        return "Ese email ya existe en Firebase Auth"
      case "auth/weak-password":
        return "La contraseña debe tener mínimo 6 caracteres"
      case "auth/invalid-email":
        return "Email inválido"
      case "auth/admin-restricted-operation":
        return "Firebase bloqueó la creación de usuarios. Revisar Authentication settings"
      default:
        return code ? `${code}: ${message || "Error desconocido"}` : message || "Error desconocido"
    }
  }

  const getDefaultUserFormData = (): UserFormData => {
    const currentDate = todayDateString()

    return {
      nombre: "",
      email: "",
      password: generatePassword(),
      empresa: "",
      rol: "user",
      activo: true,
      plan: "mensual",
      precioMensual: "0",
      fechaAlta: currentDate,
      ultimoPago: currentDate,
      proximoPago: addMonthsToDateString(currentDate, 1),
      diasAvisoPago: "3",
      estadoPago: "al_dia",
      pagoActivo: true,
      paymentNotes: "",
    }
  }

  const buildPaymentFormData = (userData: InternalUserRecord): Pick<
    UserFormData,
    "plan" | "precioMensual" | "fechaAlta" | "ultimoPago" | "proximoPago" | "diasAvisoPago" | "estadoPago" | "pagoActivo" | "paymentNotes"
  > => {
    const resolvedStatus = resolveBillingStatus(userData)
    const fechaAlta = userData.fechaAlta || userData.createdAt || todayDateString()
    const ultimoPago = userData.ultimoPago || fechaAlta
    const proximoPago = userData.proximoPago || addMonthsToDateString(ultimoPago, 1)

    return {
      plan: userData.plan || "mensual",
      precioMensual: String(userData.precioMensual ?? 0),
      fechaAlta,
      ultimoPago,
      proximoPago,
      diasAvisoPago: String(userData.diasAvisoPago ?? 3),
      estadoPago: resolvedStatus.estadoPago,
      pagoActivo: userData.pagoActivo !== false,
      paymentNotes: userData.paymentNotes || "",
    }
  }

  const buildFormDataForRecord = (userData: InternalUserRecord): UserFormData => {
    return {
      nombre: userData.nombre || "",
      email: userData.email || "",
      password: userData.password || "",
      empresa: userData.empresa || "",
      rol: userData.rol || "user",
      activo: userData.activo !== false,
      ...buildPaymentFormData(userData),
    }
  }

  const showPaymentNotice = (type: "success" | "error", message: string) => {
    setPaymentNotice({ type, message })

    if (paymentNoticeTimerRef.current) {
      clearTimeout(paymentNoticeTimerRef.current)
    }

    paymentNoticeTimerRef.current = setTimeout(() => {
      setPaymentNotice(null)
      paymentNoticeTimerRef.current = null
    }, 4000)
  }

  const computePaymentPayloadFromForm = (
    formData: UserFormData,
  ): {
    plan: string
    precioMensual: number
    fechaAlta: string
    ultimoPago: string
    proximoPago: string
    diasAvisoPago: number
    estadoPago: BillingStatus
    pagoActivo: boolean
    paymentNotes: string
    updatedAt: string
  } => {
    const now = new Date().toISOString()
    const fechaAlta = formData.fechaAlta.trim() || todayDateString()
    const ultimoPago = formData.ultimoPago.trim() || fechaAlta
    const proximoPago = formData.proximoPago.trim() || addMonthsToDateString(ultimoPago, 1)
    const precioMensual = Number(formData.precioMensual)
    const diasAvisoPago = Number(formData.diasAvisoPago)
    const calculatedStatus = calculateBillingStatus({
      proximoPago,
      diasAvisoPago,
      pagoActivo: formData.pagoActivo,
    })
    const finalStatus: BillingStatus =
      formData.estadoPago === initialPaymentStatusRef.current ? calculatedStatus.estadoPago : formData.estadoPago

    return {
      plan: formData.plan.trim() || "mensual",
      precioMensual: Number.isFinite(precioMensual) ? precioMensual : 0,
      fechaAlta,
      ultimoPago,
      proximoPago,
      diasAvisoPago: Number.isFinite(diasAvisoPago) ? diasAvisoPago : 3,
      estadoPago: finalStatus,
      pagoActivo: formData.pagoActivo,
      paymentNotes: formData.paymentNotes.trim(),
      updatedAt: now,
    }
  }

  const getPaymentStatusCell = (
    userData: InternalUserRecord,
  ): { status: BillingStatus; dueDate: string; diasRestantes: number | null } => {
    const resolvedStatus = resolveBillingStatus(userData)
    const dueDate = formatBillingDate(userData.proximoPago)
    const daysRemaining = resolvedStatus.diasRestantes

    return {
      status: resolvedStatus.estadoPago,
      dueDate,
      diasRestantes: daysRemaining,
    }
  }

  const buildInternalUserRecord = (
    params: {
      businessId: string
      firebaseUid: string
      formData: UserFormData
      createdBy?: string
      previousRecord?: InternalUserRecord
    },
  ): InternalUserRecord => {
    const now = new Date().toISOString()
    const normalizedName = params.formData.nombre.trim()
    const normalizedEmail = normalizeEmail(params.formData.email)
    const normalizedCompany = params.formData.empresa.trim()
    const normalizedRole = params.formData.rol || "user"
    const paymentPayload = computePaymentPayloadFromForm(params.formData)

    return {
      ...(params.previousRecord ?? {}),
      businessId: params.businessId,
      uid: params.firebaseUid,
      firebaseUid: params.firebaseUid,
      email: normalizedEmail,
      nombre: normalizedName,
      password: params.formData.password,
      empresa: normalizedCompany,
      rol: normalizedRole,
      role: normalizedRole,
      activo: params.formData.activo,
      ...paymentPayload,
      createdAt: params.previousRecord?.createdAt || now,
      updatedAt: now,
      fechaCreacion: params.previousRecord?.fechaCreacion || now,
      fechaActualizacion: now,
      creadoPor: params.previousRecord?.creadoPor || params.createdBy || "",
    }
  }

  const ensureSuperAdminFirebaseAuth = async () => {
    if (auth.currentUser && !auth.currentUser.isAnonymous && auth.currentUser.email === SUPER_ADMIN_EMAIL) {
      return auth.currentUser
    }

    const credential = await signInWithEmailAndPassword(auth, SUPER_ADMIN_EMAIL, SUPER_ADMIN_PASSWORD)
    return credential.user
  }

  useEffect(() => {
    // Inicializar EmailJS
    try {
      if (!emailjsInitialized) {
        emailjs.init(EMAILJS_PUBLIC_KEY)
        emailjsInitialized = true
      }
    } catch (error) {
      console.error("Error al inicializar EmailJS:", error)
    }
    
    // Asegurar autenticación antes de cargar datos
    const initializeAndLoad = async () => {
      try {
        await ensureSuperAdminFirebaseAuth()
        await loadData()
      } catch (error) {
        console.error("Error al inicializar:", error)
        setError("Error al autenticar el super administrador con Firebase. Verifica el usuario y la contraseña configurados en el panel.")
      }
    }
    
    initializeAndLoad()

    return () => {
      if (paymentNoticeTimerRef.current) {
        clearTimeout(paymentNoticeTimerRef.current)
      }
    }
  }, [])

  const loadData = async () => {
    try {
      await ensureSuperAdminFirebaseAuth()
      
      const usuariosSnapshot = await get(ref(database, "usuarios"))
      const usuariosSnapshotValue =
        usuariosSnapshot.exists() && typeof usuariosSnapshot.val() === "object" && usuariosSnapshot.val() !== null
          ? usuariosSnapshot.val()
          : {}
      const usuariosEntries = await Promise.all(
        Object.entries(usuariosSnapshotValue).map(async ([id, userData]) => {
          const normalizedUserData = userData && typeof userData === "object" ? (userData as InternalUserRecord) : {}
          const billingData = await loadBusinessBillingRecord(id, normalizedUserData)
          return [
            id,
            {
              ...normalizedUserData,
              ...(billingData ?? {}),
              businessId: billingData?.businessId || normalizedUserData.businessId || id,
              uid: billingData?.uid || normalizedUserData.uid || id,
              firebaseUid: billingData?.firebaseUid || normalizedUserData.firebaseUid || id,
            },
          ] as const
        }),
      )

      setUsuarios(Object.fromEntries(usuariosEntries))
      setError("") // Limpiar errores si la carga es exitosa
    } catch (error) {
      console.error("Error al cargar datos:", error)
      const loadError = getErrorDetails(error)
      if (loadError.code === "PERMISSION_DENIED") {
        setError("Error de permisos al cargar usuarios. Verifica las reglas de seguridad de Firebase Realtime Database.")
      } else {
        setError(`Error al cargar los usuarios: ${loadError.message || "Error desconocido"}`)
      }
    }
  }

  const generatePassword = () => {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789"
    let password = ""
    for (let i = 0; i < 8; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    return password
  }

  const sendWelcomeEmail = async (userEmail: string, userName: string, userPassword: string): Promise<boolean> => {
    try {
      setSendingEmail(true)
      
      // Verificar que EmailJS esté inicializado
      if (!emailjsInitialized) {
        emailjs.init(EMAILJS_PUBLIC_KEY)
        emailjsInitialized = true
      }
      
      const templateParams = {
        to_email: userEmail,
        to_name: userName || userEmail.split('@')[0], // Usar nombre o parte del email si no hay nombre
        user_email: userEmail,
        user_password: userPassword,
        login_url: APP_URL,
        app_name: "GestiónPro",
        title: "Bienvenido a GestiónPro",
        email: GESTIONPRO_CONTACT_EMAIL,
        reply_to: GESTIONPRO_CONTACT_EMAIL,
        contact_email: GESTIONPRO_CONTACT_EMAIL,
      }

      await emailjs.send(
        EMAILJS_SERVICE_ID,
        ACCOUNT_CREATION_TEMPLATE_ID,
        templateParams,
        EMAILJS_PUBLIC_KEY
      )

      return true
    } catch (error) {
      const emailError = getErrorDetails(error)
      console.error("Error al enviar email con EmailJS:", {
        code: emailError.code || "",
        message: emailError.message,
        status: emailError.status,
      })
      return false
    } finally {
      setSendingEmail(false)
    }
  }

  const sendPaymentReminderEmail = async (userData: InternalUserRecord): Promise<boolean> => {
    try {
      if (!emailjsInitialized) {
        emailjs.init(EMAILJS_PUBLIC_KEY)
        emailjsInitialized = true
      }

      const templateParams = {
        to_email: userData.email || "",
        to_name: userData.nombre || userData.empresa || userData.email || "Cliente",
        business_name: userData.empresa || userData.nombre || "Cliente",
        client_name: userData.nombre || userData.empresa || "Cliente",
        plan: userData.plan || "mensual",
        precio_mensual: String(userData.precioMensual ?? 0),
        price_monthly: String(userData.precioMensual ?? 0),
        proximo_pago: formatBillingDate(userData.proximoPago) || userData.proximoPago || "",
        next_payment: formatBillingDate(userData.proximoPago) || userData.proximoPago || "",
        ultimo_pago: formatBillingDate(userData.ultimoPago) || userData.ultimoPago || "",
        last_payment: formatBillingDate(userData.ultimoPago) || userData.ultimoPago || "",
        payment_status: userData.estadoPago || "al_dia",
        payment_notes: userData.paymentNotes || "",
        app_name: "GestiónPro",
        email: GESTIONPRO_CONTACT_EMAIL,
        reply_to: GESTIONPRO_CONTACT_EMAIL,
        title: "Recordatorio de pago",
        message:
          `Hola ${userData.nombre || userData.empresa || "Cliente"}, te recordamos que tu servicio GestiónPro vence el día ${formatBillingDate(userData.proximoPago) || userData.proximoPago || "próximamente"}. ` +
          "Para mantener activo tu acceso, podés abonar el período correspondiente.",
        login_url: APP_URL,
      }

      await emailjs.send(
        EMAILJS_SERVICE_ID,
        PAYMENT_REMINDER_TEMPLATE_ID,
        templateParams,
        EMAILJS_PUBLIC_KEY,
      )

      return true
    } catch (error) {
      const emailError = getErrorDetails(error)
      console.error("Error al enviar recordatorio de pago:", {
        code: emailError.code || "",
        message: emailError.message,
        status: emailError.status,
      })
      return false
    }
  }

  const resetUserForm = () => {
    const defaultFormData = getDefaultUserFormData()
    setUserFormData(defaultFormData)
    initialPaymentStatusRef.current = defaultFormData.estadoPago
    setEditingUser(null)
    setError("")
    setSuccess("")
  }

  const closePendingClientCreation = () => {
    setPendingClientCreation(null)
    setPendingClientDecision(null)
    setShowClientConflictDialog(false)
  }

  const getClientBusinessId = (userData: InternalUserRecord, fallbackId: string) => {
    return userData.businessId || fallbackId || ""
  }

  const buildExistingClientMatches = async (normalizedEmail: string, editingUserId: string | null) => {
    const userMatches = Object.entries(usuarios)
      .filter(([id, userData]) => {
        if (editingUserId && id === editingUserId) {
          return false
        }

        if (!userData || typeof userData !== "object") {
          return false
        }

        const record = userData as InternalUserRecord
        const emailValue = typeof record.email === "string" ? record.email.trim().toLowerCase() : ""

        return emailValue === normalizedEmail
      })
      .map(([id, userData]) => {
        const record = userData as InternalUserRecord
        const businessId = getClientBusinessId(record, id)

        return {
          businessId,
          source: "realtime" as const,
          nombre: record.nombre || "",
          email: record.email || normalizedEmail,
          empresa: record.empresa || "",
          activo: record.activo !== false,
          firebaseUid: record.firebaseUid || record.uid || "",
          uid: record.uid || "",
          password: record.password || "",
          createdAt: record.createdAt || record.fechaCreacion || "",
          updatedAt: record.updatedAt || record.fechaActualizacion || "",
          rawRecord: record,
        }
      })

    const firestoreMatches = await findBusinessBillingRecordsByEmail(normalizedEmail)

    const mergedMatches = new Map<string, ExistingClientMatch>()

    for (const match of firestoreMatches) {
      const existingMatch = mergedMatches.get(match.businessId)
      mergedMatches.set(match.businessId, {
        businessId: match.businessId,
        source: existingMatch?.source ?? "firestore",
        nombre: match.nombre || "",
        email: match.email || normalizedEmail,
        empresa: match.empresa || "",
        activo: match.activo !== false,
        firebaseUid: match.firebaseUid || match.uid || "",
        uid: match.uid || "",
        password: existingMatch?.password || "",
        createdAt: match.createdAt || "",
        updatedAt: match.updatedAt || "",
        rawRecord: {
          ...existingMatch?.rawRecord,
          ...match,
          password: existingMatch?.password || "",
        },
      })
    }

    for (const match of userMatches) {
      const existingMatch = mergedMatches.get(match.businessId)
      mergedMatches.set(match.businessId, {
        ...match,
        source: "realtime",
        password: match.password || existingMatch?.password || "",
        rawRecord: {
          ...existingMatch?.rawRecord,
          ...match.rawRecord,
          password: match.password || existingMatch?.password || "",
        },
      })
    }

    return Array.from(mergedMatches.values())
  }

  const ensureSecondaryAuthAccount = async (
    emailAddress: string,
    password: string,
    options: { allowExistingAuth: boolean },
  ) => {
    try {
      const authCredential = await createUserWithEmailAndPassword(secondaryAuth, emailAddress, password)
      return authCredential.user
    } catch (error) {
      const { code } = getErrorDetails(error)

      if (code === "auth/email-already-in-use" && options.allowExistingAuth) {
        return null
      }

      throw error
    } finally {
      try {
        await signOut(secondaryAuth)
      } catch (signOutError) {
        console.error("No se pudo cerrar la sesión secundaria:", signOutError)
      }
    }
  }

  const deleteLegacyAuthAccountIfPossible = async (match: ExistingClientMatch) => {
    if (!match.email || !match.password) {
      return false
    }

    try {
      const credential = await signInWithEmailAndPassword(secondaryAuth, match.email, match.password)
      await deleteUser(credential.user)
      return true
    } catch (error) {
      console.error("No se pudo eliminar el usuario de Auth legacy:", error)
      return false
    } finally {
      try {
        await signOut(secondaryAuth)
      } catch (signOutError) {
        console.error("No se pudo cerrar la sesión secundaria:", signOutError)
      }
    }
  }

  const prepareCleanClientAccount = async (matches: ExistingClientMatch[]) => {
    for (const match of matches) {
      await deleteLegacyAuthAccountIfPossible(match)
    }

    for (const match of matches) {
      await deleteBusinessClientData(match.businessId)
    }
  }

  const reuseExistingClientAccount = async (formData: UserFormData, match: ExistingClientMatch) => {
    await ensureSecondaryAuthAccount(normalizeEmail(formData.email), match.password || formData.password, {
      allowExistingAuth: true,
    })

    const firebaseUid = match.firebaseUid || match.uid || match.businessId
    const userData = buildInternalUserRecord({
      businessId: match.businessId,
      firebaseUid,
      formData: {
        ...formData,
        activo: true,
        password: match.password || formData.password,
      },
      previousRecord: match.rawRecord,
      createdBy: user?.email || "",
    })

    await saveBusinessBillingRecord(match.businessId, userData, userData)
  }

  const createFreshClientAccount = async (formData: UserFormData, options: { notify?: boolean } = {}) => {
    const shouldNotify = options.notify !== false
    let authCreatedUser: User | null = null
    let internalUserId = ""

    try {
      const authCredential = await createUserWithEmailAndPassword(secondaryAuth, normalizeEmail(formData.email), formData.password)
      authCreatedUser = authCredential.user
      const firebaseUid = authCredential.user.uid
      const newUserRef = push(ref(database, "usuarios"))
      internalUserId = newUserRef.key || ""

      if (!internalUserId) {
        throw new Error("No se pudo generar el ID interno del usuario")
      }

      const userData = buildInternalUserRecord({
        businessId: internalUserId,
        firebaseUid,
        formData: {
          ...formData,
          nombre: formData.nombre.trim(),
          email: normalizeEmail(formData.email),
          password: formData.password,
          empresa: formData.empresa.trim(),
          rol: formData.rol || "user",
          activo: formData.activo,
        },
        createdBy: user?.email || "",
      })

      await saveBusinessBillingRecord(internalUserId, userData, userData)

      const emailSent = await sendWelcomeEmail(normalizeEmail(formData.email), formData.nombre.trim(), formData.password)

      if (shouldNotify) {
        if (emailSent) {
          setSuccess("Usuario creado correctamente. Email de bienvenida enviado.")
          showPaymentNotice("success", `Usuario creado para ${formData.nombre || formData.email}.`)
        } else {
          setSuccess("Usuario creado correctamente. Usuario creado, pero no se pudo enviar el email.")
          showPaymentNotice("success", `Usuario creado para ${formData.nombre || formData.email}.`)
        }
      }
    } catch (createError) {
      if (authCreatedUser) {
        try {
          await deleteUser(authCreatedUser)
        } catch (rollbackError) {
          console.error("No se pudo revertir el usuario de Auth:", rollbackError)
        }
      }

      throw createError
    } finally {
      try {
        await signOut(secondaryAuth)
      } catch (signOutError) {
        console.error("No se pudo cerrar la sesión secundaria:", signOutError)
      }
    }
  }

  const handlePendingClientCreationChoice = async (decision: "reuse" | "clean") => {
    if (!pendingClientCreation) {
      return
    }

    const { formData, matches } = pendingClientCreation
    const primaryMatch = matches.find((match) => match.source === "realtime" && match.activo === false) ?? matches[0]

    try {
      setSavingUser(true)
      setPendingClientDecision(decision)

      if (decision === "reuse") {
        await reuseExistingClientAccount(formData, primaryMatch)
        setSuccess("Cliente existente reactivado correctamente")
        showPaymentNotice("success", `Datos reutilizados para ${formData.nombre || formData.email}.`)
      } else {
        await prepareCleanClientAccount(matches)
        await createFreshClientAccount(formData, { notify: false })
        setSuccess("Cliente creado como negocio limpio correctamente")
        showPaymentNotice("success", `Cliente limpio creado para ${formData.nombre || formData.email}.`)
      }

      setShowUserDialog(false)
      resetUserForm()
      closePendingClientCreation()
      loadData()
    } catch (error) {
      console.error("Error al resolver el conflicto de cliente:", error)
      const { code, message } = getErrorDetails(error)
      setError(`No se pudo completar la operación: ${code ? `${code}: ${message || "Error desconocido"}` : message || "Error desconocido"}`)
    } finally {
      setSavingUser(false)
      setPendingClientDecision(null)
    }
  }

  const handleUserSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError("")
    setSuccess("")
    setSavingUser(true)

    const normalizedName = userFormData.nombre.trim()
    const normalizedEmail = normalizeEmail(userFormData.email)
    const normalizedPassword = userFormData.password.trim()

    if (!normalizedName) {
      setError("El nombre es obligatorio")
      setSavingUser(false)
      return
    }

    if (!normalizedEmail) {
      setError("El email es obligatorio")
      setSavingUser(false)
      return
    }

    if (!isValidEmail(normalizedEmail)) {
      setError("Email inválido")
      setSavingUser(false)
      return
    }

    if (!normalizedPassword) {
      setError("La contraseña es obligatoria")
      setSavingUser(false)
      return
    }

    if (normalizedPassword.length < 6) {
      setError("La contraseña debe tener mínimo 6 caracteres")
      setSavingUser(false)
      return
    }

    try {
      await ensureSuperAdminFirebaseAuth()

      const matchingClients = await buildExistingClientMatches(normalizedEmail, editingUser)

      if (editingUser) {
        const conflictingClients = matchingClients.filter((client) => client.businessId !== editingUser)

        if (conflictingClients.length > 0) {
          setError("Ya existen datos previos asociados a este cliente. Usá la edición del registro existente o eliminá el negocio viejo primero.")
          return
        }

        const previousUser = usuarios[editingUser] || {}
        const userData = buildInternalUserRecord({
          businessId: editingUser,
          firebaseUid: previousUser.firebaseUid || previousUser.uid || editingUser,
          formData: {
            ...userFormData,
            nombre: normalizedName,
            email: normalizedEmail,
            password: normalizedPassword,
            empresa: userFormData.empresa.trim(),
            rol: userFormData.rol || "user",
            activo: userFormData.activo,
          },
          previousRecord: previousUser,
          createdBy: previousUser.creadoPor || user?.email || "",
        })

        await saveBusinessBillingRecord(editingUser, userData, userData)
        setSuccess("Usuario actualizado correctamente")
        showPaymentNotice("success", `Datos actualizados para ${normalizedName || normalizedEmail}.`)
        setShowUserDialog(false)
        resetUserForm()
        loadData()
        return
      }

      if (matchingClients.length > 0) {
        setPendingClientCreation({
          formData: {
            ...userFormData,
            nombre: normalizedName,
            email: normalizedEmail,
            password: normalizedPassword,
            empresa: userFormData.empresa.trim(),
            rol: userFormData.rol || "user",
            activo: userFormData.activo,
          },
          matches: matchingClients,
        })
        setShowClientConflictDialog(true)
        setShowUserDialog(false)
        return
      }

      await createFreshClientAccount({
        ...userFormData,
        nombre: normalizedName,
        email: normalizedEmail,
        password: normalizedPassword,
        empresa: userFormData.empresa.trim(),
        rol: userFormData.rol || "user",
        activo: userFormData.activo,
      })

      setShowUserDialog(false)
      resetUserForm()
      loadData()
    } catch (error) {
      console.error("Error al guardar usuario:", error)
      const { code, message } = getErrorDetails(error)

      if (code && code.startsWith("auth/")) {
        setError(mapAuthCreationError(error))
        return
      }

      if (code === "PERMISSION_DENIED") {
        setError("Error de permisos. Verifica las reglas de seguridad de Firebase Realtime Database.")
      } else {
        setError(`Error al guardar el usuario: ${code ? `${code}: ${message || "Error desconocido"}` : message || "Error desconocido"}`)
      }
    } finally {
      setSavingUser(false)
    }
  }
  const handleEditUser = (id: string, userData: InternalUserRecord) => {
    setEditingUser(id)
    const formData = buildFormDataForRecord(userData)
    setUserFormData({
      ...formData,
      password: userData.password || "",
    })
    initialPaymentStatusRef.current = formData.estadoPago
    setShowUserDialog(true)
  }

  const handleOpenPermanentDeleteDialog = (id: string, userData: InternalUserRecord) => {
    setPermanentDeleteTarget({ id, userData })
    setPermanentDeleteConfirmation("")
  }

  const handleConfirmPermanentDelete = async () => {
    if (!permanentDeleteTarget || permanentDeleteConfirmation.trim().toUpperCase() !== "ELIMINAR") {
      setError("Escribí ELIMINAR para confirmar el borrado definitivo")
      return
    }

    const { id, userData } = permanentDeleteTarget
    const businessId = getClientBusinessId(userData, id)
    let authRemovalWarning = ""

    try {
      setPermanentDeleteLoading(true)
      await ensureSuperAdminFirebaseAuth()

      const authMatch: ExistingClientMatch = {
        businessId,
        source: "realtime",
        nombre: userData.nombre || "",
        email: userData.email || "",
        empresa: userData.empresa || "",
        activo: userData.activo !== false,
        firebaseUid: userData.firebaseUid || userData.uid || "",
        uid: userData.uid || "",
        password: userData.password || "",
        createdAt: userData.createdAt || userData.fechaCreacion || "",
        updatedAt: userData.updatedAt || userData.fechaActualizacion || "",
        rawRecord: userData,
      }

      const authDeleted = await deleteLegacyAuthAccountIfPossible(authMatch)
      if (!authDeleted && authMatch.email) {
        authRemovalWarning = "No se pudo borrar el usuario de Firebase Auth."
      }

      await deleteBusinessClientData(businessId)

      if (id !== businessId) {
        await Promise.all([
          remove(ref(database, `usuarios/${id}`)),
          remove(ref(database, `tiendas/${id}`)),
        ])
      }

      if (authRemovalWarning) {
        setError("")
        setSuccess(`Cliente eliminado definitivamente. ${authRemovalWarning}`)
      } else {
        setError("")
        setSuccess("Cliente eliminado definitivamente")
      }

      showPaymentNotice("success", `Cliente eliminado definitivamente para ${userData.nombre || userData.email || businessId}.`)
      setPermanentDeleteTarget(null)
      setPermanentDeleteConfirmation("")
      loadData()
    } catch (error) {
      console.error("Error al eliminar cliente definitivamente:", error)
      const errorDetails = getErrorDetails(error)
      if (errorDetails.code === "PERMISSION_DENIED") {
        setError("Error de permisos. Verifica las reglas de seguridad de Firebase.")
      } else {
        setError(`Error al eliminar el cliente: ${errorDetails.code ? `${errorDetails.code}: ${errorDetails.message || "Error desconocido"}` : errorDetails.message || "Error desconocido"}`)
      }
    } finally {
      setPermanentDeleteLoading(false)
    }
  }

  const handleToggleUserStatus = async (id: string, userData: InternalUserRecord) => {
    const newStatus = !userData.activo
    const statusText = newStatus ? "reactivado" : "suspendido"
    
    if (confirm(`¿Estás seguro de ${newStatus ? "reactivar" : "suspender"} este cliente?`)) {
      try {
        await ensureSuperAdminFirebaseAuth()
        
        const updatedUserRecord = {
          ...userData,
          activo: newStatus,
        }

        await saveBusinessBillingRecord(id, updatedUserRecord, updatedUserRecord)
        setSuccess(`Cliente ${statusText} correctamente`)
        loadData()
      } catch (error) {
        console.error("Error al cambiar estado del usuario:", error)
        const errorDetails = getErrorDetails(error)
        if (errorDetails.code === "PERMISSION_DENIED") {
          setError("Error de permisos. Verifica las reglas de seguridad de Firebase.")
        } else {
          setError("Error al cambiar el estado del usuario")
        }
      }
    }
  }

  const handleMarkAsPaid = async (id: string, userData: InternalUserRecord) => {
    if (paymentAction) {
      return
    }

    try {
      setPaymentAction({ userId: id, type: "mark_paid" })
      await ensureSuperAdminFirebaseAuth()

      const today = todayDateString()
      const updatedUserRecord = {
        ...userData,
        ultimoPago: today,
        proximoPago: addMonthsToDateString(today, 1),
        estadoPago: "al_dia" as BillingStatus,
        pagoActivo: true,
        updatedAt: new Date().toISOString(),
      }

      await saveBusinessBillingRecord(id, updatedUserRecord, updatedUserRecord)
      setUsuarios((currentUsers) => ({
        ...currentUsers,
        [id]: {
          ...currentUsers[id],
          ...updatedUserRecord,
        },
      }))
      setSuccess("Pago marcado como registrado")
      showPaymentNotice("success", `Pago actualizado para ${userData.nombre || userData.empresa || userData.email || "el cliente"}.`)
    } catch (error) {
      console.error("Error al marcar el pago:", error)
      const errorDetails = getErrorDetails(error)
      if (errorDetails.code === "PERMISSION_DENIED") {
        setError("Error de permisos. Verifica las reglas de seguridad de Firebase.")
      } else {
        setError("No se pudo actualizar el pago")
      }
      showPaymentNotice("error", "No se pudo actualizar el pago")
    } finally {
      setPaymentAction(null)
    }
  }

  const handleSendPaymentReminder = async (id: string, userData: InternalUserRecord) => {
    if (paymentAction) {
      return
    }

    try {
      setPaymentAction({ userId: id, type: "reminder" })
      await ensureSuperAdminFirebaseAuth()

      const reminderSent = await sendPaymentReminderEmail(userData)
      if (!reminderSent) {
        showPaymentNotice("error", "No se pudo enviar el recordatorio")
        setError("No se pudo enviar el recordatorio de pago")
        return
      }

      const updatedUserRecord = {
        ...userData,
        ultimoRecordatorioPagoEnviadoAt: new Date().toISOString(),
        paymentReminderCount: Number(userData.paymentReminderCount ?? 0) + 1,
        updatedAt: new Date().toISOString(),
      }

      try {
        await saveBusinessBillingRecord(id, updatedUserRecord, updatedUserRecord)
        setUsuarios((currentUsers) => ({
          ...currentUsers,
          [id]: {
            ...currentUsers[id],
            ...updatedUserRecord,
          },
        }))
        setSuccess("Recordatorio enviado correctamente")
        showPaymentNotice("success", `Recordatorio enviado a ${userData.email || userData.nombre || "el cliente"}.`)
      } catch (saveError) {
        console.error("No se pudo guardar el registro del recordatorio:", saveError)
        setSuccess("Recordatorio enviado, pero no se pudo guardar el registro opcional.")
        showPaymentNotice("success", `Recordatorio enviado a ${userData.email || userData.nombre || "el cliente"}.`)
      }
    } catch (error) {
      console.error("Error al enviar recordatorio:", error)
      const errorDetails = getErrorDetails(error)
      if (errorDetails.code === "PERMISSION_DENIED") {
        setError("Error de permisos. Verifica las reglas de seguridad de Firebase.")
      } else {
        setError("No se pudo enviar el recordatorio")
      }
      showPaymentNotice("error", "No se pudo enviar el recordatorio")
    } finally {
      setPaymentAction(null)
    }
  }

  const handleLoadDemoData = async (id: string, userData: InternalUserRecord) => {
    const businessId = userData.businessId || userData.uid || id
    const businessLabel = userData.nombre || userData.empresa || userData.email || businessId

    if (!businessId) {
      setError("No se pudo identificar el negocio para cargar datos demo")
      return
    }

    const confirmed = window.confirm(
      `Esto cargará o actualizará los datos demo de ${businessLabel}. Solo toca los registros demo de ese negocio. ¿Continuar?`,
    )

    if (!confirmed) {
      return
    }

    try {
      setDemoLoadingUserId(id)
      setError("")
      setSuccess("")
      await ensureSuperAdminFirebaseAuth()

      const result = await seedDemoDataForBusiness(businessId)
      setSuccess(
        `Datos demo cargados en ${result.storeName}: ${result.productsCreated} productos, ${result.providersCreated} proveedores y ${result.salesCreated} ventas.`,
      )
      await loadData()
    } catch (error) {
      console.error("Error al cargar datos demo:", error)
      const errorDetails = getErrorDetails(error)
      if (errorDetails.code === "PERMISSION_DENIED") {
        setError("Error de permisos. Verifica las reglas de seguridad de Firebase.")
      } else {
        setError(
          `Error al cargar los datos demo: ${errorDetails.code ? `${errorDetails.code}: ` : ""}${errorDetails.message || "Error desconocido"}`,
        )
      }
    } finally {
      setDemoLoadingUserId(null)
    }
  }

  const handleOpenDemoDeleteDialog = (id: string, userData: InternalUserRecord) => {
    setDemoDeleteTarget({ id, userData })
    setDemoDeleteConfirmation("")
  }

  const handleConfirmDeleteDemo = async () => {
    if (!demoDeleteTarget || demoDeleteConfirmation.trim().toUpperCase() !== "DEMO") {
      setError("Escribí DEMO para confirmar la eliminación de datos demo")
      return
    }

    const { id, userData } = demoDeleteTarget
    const businessId = getClientBusinessId(userData, id)
    const businessLabel = userData.nombre || userData.empresa || userData.email || businessId

    try {
      setDemoDeleteLoading(true)
      setError("")
      setSuccess("")
      await ensureSuperAdminFirebaseAuth()

      const result = await deleteDemoDataForBusiness(businessId)
      const totalDeleted =
        result.firestore.products +
        result.firestore.providers +
        result.firestore.sales +
        result.legacy.products +
        result.legacy.providers +
        result.legacy.sales

      if (
        totalDeleted === 0 &&
        !result.firestore.storeConfigDeleted &&
        !result.legacy.storeConfigDeleted
      ) {
        setSuccess("No se encontraron datos demo para eliminar.")
      } else {
        const summaryParts = [
          `${result.firestore.products + result.legacy.products} productos eliminados`,
          `${result.firestore.providers + result.legacy.providers} proveedores eliminados`,
          `${result.firestore.sales + result.legacy.sales} ventas eliminadas`,
        ]

        if (result.firestore.storeConfigDeleted || result.legacy.storeConfigDeleted) {
          summaryParts.push("tienda demo eliminada")
        }

        setSuccess(`Datos demo eliminados de ${businessLabel}. ${summaryParts.join(", ")}.`)
      }

      await loadData()
      setDemoDeleteTarget(null)
      setDemoDeleteConfirmation("")
    } catch (error) {
      console.error("Error al eliminar datos demo:", error)
      const errorDetails = getErrorDetails(error)
      if (errorDetails.code === "PERMISSION_DENIED") {
        setError("Error de permisos. Verifica las reglas de seguridad de Firebase.")
      } else {
        setError(
          `Error al eliminar los datos demo: ${errorDetails.code ? `${errorDetails.code}: ` : ""}${errorDetails.message || "Error desconocido"}`,
        )
      }
    } finally {
      setDemoDeleteLoading(false)
    }
  }

  const copyPassword = async (password: string) => {
    if (!password) {
      setError("No hay contraseña disponible para copiar")
      return
    }

    try {
      await navigator.clipboard.writeText(password)
      setCopiedPassword(password)
      setTimeout(() => setCopiedPassword(null), 2000)
    } catch (error) {
      console.error("Error al copiar contraseña:", error)
    }
  }

  const usuariosArray: Array<{ id: string } & InternalUserRecord> = Object.entries(usuarios).map(([id, userData]) => ({
    id,
    ...(userData as InternalUserRecord),
  }))

  const usuariosConPagos = usuariosArray.map((userData) => ({
    ...userData,
    paymentInfo: getPaymentStatusCell(userData),
  }))

  const usuariosFiltrados = paymentFilter === "all"
    ? usuariosConPagos
    : usuariosConPagos.filter((userData) => userData.paymentInfo.status === paymentFilter)

  const usuariosActivos = usuariosArray.filter(user => user.activo !== false)
  const usuariosInactivos = usuariosArray.filter(user => user.activo === false)
  const paymentStatusCounts = usuariosConPagos.reduce<Record<"al_dia" | "por_vencer" | "vencido", number>>(
    (accumulator, userData) => {
      accumulator[userData.paymentInfo.status] += 1
      return accumulator
    },
    { al_dia: 0, por_vencer: 0, vencido: 0 },
  )

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-card shadow-sm border-b border-border">
        <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-8">
          <div className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center sm:space-x-4">
              <Crown className="h-8 w-8 text-yellow-500" />
              <div className="min-w-0">
                <h1 className="text-2xl font-bold text-foreground">Panel Super Administrador</h1>
                <p className="text-sm text-muted-foreground break-words">Gestión de usuarios del sistema</p>
              </div>
            </div>
            <div className="flex items-center gap-2 sm:gap-4">
              <ThemeToggle />
              <Button variant="outline" onClick={onLogout} className="whitespace-nowrap">
                <LogOut className="h-4 w-4 mr-2" />
                Cerrar Sesión
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-8 py-6 sm:py-8">
        {paymentNotice && (
          <div className="fixed bottom-4 left-4 right-4 z-50 w-auto sm:left-auto sm:right-4 sm:max-w-sm">
            <Alert variant={paymentNotice.type === "error" ? "destructive" : "default"} className="shadow-lg">
              <AlertDescription className="text-sm">{paymentNotice.message}</AlertDescription>
            </Alert>
          </div>
        )}
        <div className="space-y-6">
          {/* Estadísticas */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Total Usuarios</p>
                    <p className="text-2xl font-bold">{usuariosArray.length}</p>
                  </div>
                  <Users className="h-8 w-8 text-blue-500" />
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Usuarios Activos</p>
                    <p className="text-2xl font-bold text-green-600">{usuariosActivos.length}</p>
                  </div>
                  <UserCheck className="h-8 w-8 text-green-500" />
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Clientes Suspendidos</p>
                    <p className="text-2xl font-bold text-red-600">{usuariosInactivos.length}</p>
                  </div>
                  <UserX className="h-8 w-8 text-red-500" />
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <h2 className="text-xl font-semibold">Gestión de Usuarios</h2>
              <p className="text-muted-foreground break-words">Administra los usuarios del sistema</p>
            </div>
            <Dialog open={showUserDialog} onOpenChange={setShowUserDialog}>
              <DialogTrigger asChild>
                <Button onClick={resetUserForm}>
                  <Plus className="h-4 w-4 mr-2" />
                  Nuevo Usuario
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>
                    {editingUser ? "Editar Usuario" : "Crear Nuevo Usuario"}
                  </DialogTitle>
                </DialogHeader>
                <form onSubmit={handleUserSubmit} className="space-y-4">
                  {error && (
                    <Alert variant="destructive">
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>{error}</AlertDescription>
                    </Alert>
                  )}
                  {success && (
                    <Alert>
                      <CheckCircle className="h-4 w-4" />
                      <AlertDescription>{success}</AlertDescription>
                    </Alert>
                  )}
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="nombre">Nombre</Label>
                      <Input
                        id="nombre"
                        value={userFormData.nombre}
                        onChange={(e) => setUserFormData({...userFormData, nombre: e.target.value})}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="email">Email</Label>
                      <Input
                        id="email"
                        type="email"
                        value={userFormData.email}
                        onChange={(e) => setUserFormData({...userFormData, email: e.target.value})}
                        required
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="password">Contraseña</Label>
                      <div className="flex gap-2">
                        <Input
                          id="password"
                          type="password"
                          value={userFormData.password}
                          onChange={(e) => setUserFormData({...userFormData, password: e.target.value})}
                          required
                        />
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => setUserFormData({...userFormData, password: generatePassword()})}
                        >
                          Generar
                        </Button>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="empresa">Empresa</Label>
                      <Input
                        id="empresa"
                        value={userFormData.empresa}
                        onChange={(e) => setUserFormData({...userFormData, empresa: e.target.value})}
                        placeholder="Nombre de la empresa"
                        required
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="rol">Rol</Label>
                      <Select
                        value={userFormData.rol}
                        onValueChange={(value) => setUserFormData({...userFormData, rol: value})}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="user">Usuario</SelectItem>
                          <SelectItem value="admin">Administrador</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="activo">Estado</Label>
                      <Select
                        value={userFormData.activo ? "activo" : "inactivo"}
                        onValueChange={(value) => setUserFormData({...userFormData, activo: value === "activo"})}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="activo">Activo</SelectItem>
                          <SelectItem value="inactivo">Inactivo</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="rounded-lg border border-border/60 p-4 space-y-4">
                    <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                      <BadgeDollarSign className="h-4 w-4" />
                      Datos de pago
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="plan">Plan</Label>
                        <Input
                          id="plan"
                          value={userFormData.plan}
                          onChange={(e) => setUserFormData({ ...userFormData, plan: e.target.value })}
                          placeholder="mensual"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="precioMensual">Precio mensual</Label>
                        <Input
                          id="precioMensual"
                          type="number"
                          min="0"
                          step="0.01"
                          value={userFormData.precioMensual}
                          onChange={(e) => setUserFormData({ ...userFormData, precioMensual: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="fechaAlta">Fecha de alta</Label>
                        <Input
                          id="fechaAlta"
                          type="date"
                          value={userFormData.fechaAlta}
                          onChange={(e) => setUserFormData({ ...userFormData, fechaAlta: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="ultimoPago">Último pago</Label>
                        <Input
                          id="ultimoPago"
                          type="date"
                          value={userFormData.ultimoPago}
                          onChange={(e) => setUserFormData({ ...userFormData, ultimoPago: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="proximoPago">Próximo pago</Label>
                        <Input
                          id="proximoPago"
                          type="date"
                          value={userFormData.proximoPago}
                          onChange={(e) => setUserFormData({ ...userFormData, proximoPago: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="diasAvisoPago">Días de aviso</Label>
                        <Input
                          id="diasAvisoPago"
                          type="number"
                          min="0"
                          step="1"
                          value={userFormData.diasAvisoPago}
                          onChange={(e) => setUserFormData({ ...userFormData, diasAvisoPago: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="estadoPago">Estado de pago</Label>
                        <Select
                          value={userFormData.estadoPago}
                          onValueChange={(value) =>
                            setUserFormData({ ...userFormData, estadoPago: value as BillingStatus })
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="al_dia">Al día</SelectItem>
                            <SelectItem value="por_vencer">Por vencer</SelectItem>
                            <SelectItem value="vencido">Vencido</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="pagoActivo">Pago activo</Label>
                        <Select
                          value={userFormData.pagoActivo ? "activo" : "inactivo"}
                          onValueChange={(value) => setUserFormData({ ...userFormData, pagoActivo: value === "activo" })}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="activo">Activo</SelectItem>
                            <SelectItem value="inactivo">Inactivo</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2 md:col-span-2">
                        <Label htmlFor="paymentNotes">Notas de pago</Label>
                        <Textarea
                          id="paymentNotes"
                          value={userFormData.paymentNotes}
                          onChange={(e) => setUserFormData({ ...userFormData, paymentNotes: e.target.value })}
                          placeholder="Notas internas sobre la suscripción o pagos"
                          rows={3}
                        />
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
                    <Button type="button" variant="outline" onClick={() => setShowUserDialog(false)} className="w-full sm:w-auto">
                      Cancelar
                    </Button>
                    <Button type="submit" disabled={sendingEmail || savingUser}>
                      {sendingEmail || savingUser ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                          {sendingEmail ? "Enviando email..." : "Guardando..."}
                        </>
                      ) : (
                        <>
                          {editingUser ? "Actualizar" : "Crear"} Usuario
                        </>
                      )}
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
            <Dialog
              open={showClientConflictDialog && Boolean(pendingClientCreation)}
              onOpenChange={(open) => {
                if (!open) {
                  closePendingClientCreation()
                  setShowUserDialog(true)
                }
              }}
            >
              <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                  <DialogTitle>Ya existen datos previos asociados a este cliente</DialogTitle>
                </DialogHeader>
                {pendingClientCreation && (
                  <div className="space-y-4">
                    <Alert>
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>
                        Se encontraron registros previos para <strong>{pendingClientCreation.formData.email}</strong>.
                        Podés reactivar ese negocio o crear uno limpio.
                      </AlertDescription>
                    </Alert>
                    <div className="rounded-lg border border-border/60 p-4 text-sm text-muted-foreground space-y-1">
                      <p><strong>Nombre:</strong> {pendingClientCreation.formData.nombre}</p>
                      <p><strong>Coincidencias:</strong> {pendingClientCreation.matches.length}</p>
                      <p>
                        <strong>Estado detectado:</strong>{" "}
                        {pendingClientCreation.matches[0]?.activo ? "Activo" : "Suspendido / histórico"}
                      </p>
                    </div>
                    <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                          closePendingClientCreation()
                          setShowUserDialog(true)
                        }}
                        disabled={pendingClientDecision !== null}
                      >
                        Volver
                      </Button>
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={() => handlePendingClientCreationChoice("reuse")}
                        disabled={pendingClientDecision !== null}
                      >
                        {pendingClientDecision === "reuse" ? "Procesando..." : "Reactivar cliente existente"}
                      </Button>
                      <Button
                        type="button"
                        onClick={() => handlePendingClientCreationChoice("clean")}
                        disabled={pendingClientDecision !== null}
                      >
                        {pendingClientDecision === "clean" ? "Procesando..." : "Crear cliente limpio"}
                      </Button>
                    </div>
                  </div>
                )}
              </DialogContent>
            </Dialog>
            <Dialog
              open={Boolean(demoDeleteTarget)}
              onOpenChange={(open) => {
                if (!open) {
                  setDemoDeleteTarget(null)
                  setDemoDeleteConfirmation("")
                }
              }}
            >
              <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                  <DialogTitle>Eliminar datos demo</DialogTitle>
                </DialogHeader>
                {demoDeleteTarget && (
                  <div className="space-y-4">
                    <Alert variant="destructive">
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>
                        Esto eliminará únicamente datos demo marcados como demo. No borra datos reales.
                      </AlertDescription>
                    </Alert>
                    <div className="rounded-lg border border-border/60 p-4 text-sm text-muted-foreground space-y-1">
                      <p><strong>Cliente:</strong> {demoDeleteTarget.userData.nombre || demoDeleteTarget.userData.empresa || demoDeleteTarget.userData.email}</p>
                      <p><strong>Email:</strong> {demoDeleteTarget.userData.email || "Sin email"}</p>
                      <p><strong>Negocio:</strong> {getClientBusinessId(demoDeleteTarget.userData, demoDeleteTarget.id)}</p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="demo-delete-confirmation">Escribí DEMO para confirmar</Label>
                      <Input
                        id="demo-delete-confirmation"
                        value={demoDeleteConfirmation}
                        onChange={(e) => setDemoDeleteConfirmation(e.target.value)}
                        placeholder="DEMO"
                      />
                    </div>
                    <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                          setDemoDeleteTarget(null)
                          setDemoDeleteConfirmation("")
                        }}
                        disabled={demoDeleteLoading}
                      >
                        Cancelar
                      </Button>
                      <Button
                        type="button"
                        variant="destructive"
                        onClick={handleConfirmDeleteDemo}
                        disabled={demoDeleteLoading || demoDeleteConfirmation.trim().toUpperCase() !== "DEMO"}
                      >
                        {demoDeleteLoading ? "Eliminando..." : "Eliminar demo"}
                      </Button>
                    </div>
                  </div>
                )}
              </DialogContent>
            </Dialog>
            <Dialog
              open={Boolean(permanentDeleteTarget)}
              onOpenChange={(open) => {
                if (!open) {
                  setPermanentDeleteTarget(null)
                  setPermanentDeleteConfirmation("")
                }
              }}
            >
              <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                  <DialogTitle>Eliminar cliente definitivamente</DialogTitle>
                </DialogHeader>
                {permanentDeleteTarget && (
                  <div className="space-y-4">
                    <Alert variant="destructive">
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>
                        Esta acción borra productos, ventas, proveedores, configuración de tienda, espejos legacy y el negocio asociado. Es irreversible.
                      </AlertDescription>
                    </Alert>
                    <div className="rounded-lg border border-border/60 p-4 text-sm text-muted-foreground space-y-1">
                      <p><strong>Cliente:</strong> {permanentDeleteTarget.userData.nombre || permanentDeleteTarget.userData.empresa || permanentDeleteTarget.userData.email}</p>
                      <p><strong>Email:</strong> {permanentDeleteTarget.userData.email || "Sin email"}</p>
                      <p><strong>Negocio:</strong> {getClientBusinessId(permanentDeleteTarget.userData, permanentDeleteTarget.id)}</p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="delete-confirmation">Escribí ELIMINAR para confirmar</Label>
                      <Input
                        id="delete-confirmation"
                        value={permanentDeleteConfirmation}
                        onChange={(e) => setPermanentDeleteConfirmation(e.target.value)}
                        placeholder="ELIMINAR"
                      />
                    </div>
                    <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                          setPermanentDeleteTarget(null)
                          setPermanentDeleteConfirmation("")
                        }}
                        disabled={permanentDeleteLoading}
                      >
                        Cancelar
                      </Button>
                      <Button
                        type="button"
                        variant="destructive"
                        onClick={handleConfirmPermanentDelete}
                        disabled={permanentDeleteLoading || permanentDeleteConfirmation.trim().toUpperCase() !== "ELIMINAR"}
                      >
                        {permanentDeleteLoading ? "Eliminando..." : "Eliminar definitivamente"}
                      </Button>
                    </div>
                  </div>
                )}
              </DialogContent>
            </Dialog>
          </div>

          <div className="flex flex-wrap gap-2">
            {[
              { key: "all", label: "Todos", count: usuariosConPagos.length },
              { key: "al_dia", label: "Al día", count: paymentStatusCounts.al_dia },
              { key: "por_vencer", label: "Por vencer", count: paymentStatusCounts.por_vencer },
              { key: "vencido", label: "Vencidos", count: paymentStatusCounts.vencido },
            ].map((filterOption) => (
              <Button
                key={filterOption.key}
                type="button"
                variant={paymentFilter === filterOption.key ? "default" : "outline"}
                size="sm"
                onClick={() => setPaymentFilter(filterOption.key as "all" | BillingStatus)}
              >
                {filterOption.label} ({filterOption.count})
              </Button>
            ))}
          </div>

          <Card>
            <CardContent className="p-0">
              <div className="w-full overflow-x-auto">
              <Table className="min-w-[1280px] w-full">
                <TableHeader>
                  <TableRow>
                    <TableHead>Nombre</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Empresa</TableHead>
                    <TableHead>Rol</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Plan</TableHead>
                    <TableHead>Precio</TableHead>
                    <TableHead>Últ. pago</TableHead>
                    <TableHead>Próx. pago</TableHead>
                    <TableHead>Días</TableHead>
                    <TableHead>Pago</TableHead>
                    <TableHead>Acceso</TableHead>
                    <TableHead>Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {usuariosFiltrados.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={13} className="text-center text-muted-foreground py-8">
                        No hay usuarios registrados
                      </TableCell>
                    </TableRow>
                  ) : (
                    usuariosFiltrados.map((userData) => (
                      <TableRow key={userData.id} className={userData.activo === false ? "bg-muted/50" : ""}>
                        <TableCell className="font-medium">{userData.nombre}</TableCell>
                        <TableCell>{userData.email}</TableCell>
                        <TableCell>{userData.empresa || "Sin empresa"}</TableCell>
                        <TableCell>
                          <Badge variant={userData.rol === "admin" ? "default" : "secondary"}>
                            {userData.rol}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant={userData.activo ? "default" : "destructive"}>
                            {userData.activo ? "Activo" : "Suspendido"}
                          </Badge>
                        </TableCell>
                        <TableCell>{userData.plan || "mensual"}</TableCell>
                        <TableCell>${Number(userData.precioMensual ?? 0).toLocaleString("es-AR")}</TableCell>
                        <TableCell>{formatBillingDate(userData.ultimoPago) || "-"}</TableCell>
                        <TableCell>{formatBillingDate(userData.proximoPago) || "-"}</TableCell>
                        <TableCell>
                          {userData.paymentInfo.diasRestantes === null
                            ? "-"
                            : `${userData.paymentInfo.diasRestantes} día${Math.abs(userData.paymentInfo.diasRestantes) === 1 ? "" : "s"}`}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col gap-1">
                            <Badge
                              variant={userData.paymentInfo.status === "vencido" ? "destructive" : userData.paymentInfo.status === "por_vencer" ? "outline" : "default"}
                              className={userData.paymentInfo.status === "por_vencer" ? "border-amber-500 text-amber-600" : ""}
                            >
                              {userData.paymentInfo.status === "al_dia"
                                ? "Al día"
                                : userData.paymentInfo.status === "por_vencer"
                                  ? "Por vencer"
                                  : "Vencido"}
                            </Badge>
                            <Badge variant={userData.pagoActivo ? "secondary" : "outline"}>
                              {userData.pagoActivo ? "Pago activo" : "Pago pausado"}
                            </Badge>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col gap-2">
                            {userData.password ? (
                              <Button
                                variant="outline"
                                size="sm"
                                className="justify-start gap-2"
                                onClick={() => copyPassword(userData.password || "")}
                              >
                                {copiedPassword === userData.password ? (
                                  <CheckCircle className="h-4 w-4 text-green-500" />
                                ) : (
                                  <Copy className="h-4 w-4" />
                                )}
                                {copiedPassword === userData.password ? "Copiado" : "Copiar"}
                              </Button>
                            ) : (
                              <span className="text-xs text-muted-foreground">No disponible</span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                      <div className="flex gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleMarkAsPaid(userData.id, userData)}
                              disabled={paymentAction?.userId === userData.id}
                              title="Marcar como pagado"
                            >
                              {paymentAction?.userId === userData.id && paymentAction.type === "mark_paid" ? (
                                <div className="h-4 w-4 animate-spin rounded-full border-b-2 border-current" />
                              ) : (
                                <Wallet className="h-4 w-4 text-green-500" />
                              )}
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleSendPaymentReminder(userData.id, userData)}
                              disabled={paymentAction?.userId === userData.id}
                              title="Enviar recordatorio de pago"
                            >
                              {paymentAction?.userId === userData.id && paymentAction.type === "reminder" ? (
                                <div className="h-4 w-4 animate-spin rounded-full border-b-2 border-current" />
                              ) : (
                                <BellRing className="h-4 w-4 text-amber-500" />
                              )}
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEditUser(userData.id, userData)}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleToggleUserStatus(userData.id, userData)}
                              title={userData.activo ? "Suspender cliente" : "Reactivar cliente"}
                            >
                              {userData.activo ? (
                                <UserX className="h-4 w-4 text-red-500" />
                              ) : (
                                <UserCheck className="h-4 w-4 text-green-500" />
                              )}
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleLoadDemoData(userData.id, userData)}
                              title="Cargar datos demo"
                              disabled={demoLoadingUserId === userData.id}
                            >
                              {demoLoadingUserId === userData.id ? (
                                <div className="h-4 w-4 animate-spin rounded-full border-b-2 border-current" />
                              ) : (
                                <Database className="h-4 w-4" />
                              )}
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleOpenDemoDeleteDialog(userData.id, userData)}
                              title="Eliminar datos demo"
                              disabled={demoDeleteLoading && demoDeleteTarget?.id === userData.id}
                            >
                              {demoDeleteLoading && demoDeleteTarget?.id === userData.id ? (
                                <div className="h-4 w-4 animate-spin rounded-full border-b-2 border-current" />
                              ) : (
                                <Trash2 className="h-4 w-4 text-amber-500" />
                              )}
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleOpenPermanentDeleteDialog(userData.id, userData)}
                              title="Eliminar definitivamente"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  )
} 

