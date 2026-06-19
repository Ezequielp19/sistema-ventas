"use client"

import { useState, useEffect, useMemo, useRef, type FormEvent } from "react"
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
import { Pagination } from "@/components/ui/pagination"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
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
  Search,
  SlidersHorizontal,
  MoreHorizontal,
  Building2,
  CalendarClock,
  Mail,
  RefreshCw,
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

const APP_URL = "https://app.gestionpro.pro/"
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
  businessName?: string
  nombreEmpresa?: string
  comercio?: string
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

type PaymentInfoCell = {
  status: BillingStatus
  dueDate: string
  diasRestantes: number | null
}

type ClientListItem = InternalUserRecord & {
  id: string
  paymentInfo: PaymentInfoCell
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
  const [searchTerm, setSearchTerm] = useState("")
  const [sortBy, setSortBy] = useState<"due" | "recent" | "name" | "mrr">("due")
  const [itemsPerPage, setItemsPerPage] = useState("10")
  const [currentPage, setCurrentPage] = useState(1)
  const [loadingUsers, setLoadingUsers] = useState(false)
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
  const [selectedClientTarget, setSelectedClientTarget] = useState<ClientListItem | null>(null)
  const [permanentDeleteTarget, setPermanentDeleteTarget] = useState<{ id: string; userData: InternalUserRecord } | null>(null)
  const [permanentDeleteConfirmation, setPermanentDeleteConfirmation] = useState("")
  const [permanentDeleteLoading, setPermanentDeleteLoading] = useState(false)
  const [demoDeleteTarget, setDemoDeleteTarget] = useState<{ id: string; userData: InternalUserRecord } | null>(null)
  const [demoDeleteConfirmation, setDemoDeleteConfirmation] = useState("")
  const [demoDeleteLoading, setDemoDeleteLoading] = useState(false)
  const paymentNoticeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const initialPaymentStatusRef = useRef<BillingStatus>("al_dia")
  const usersCacheRef = useRef<{ loadedAt: number; data: Record<string, InternalUserRecord> } | null>(null)

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

  const normalizeSearchText = (value: string) =>
    value
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()

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
  ): PaymentInfoCell => {
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

  const syncUsersCache = (nextUsers: Record<string, InternalUserRecord>) => {
    usersCacheRef.current = {
      loadedAt: Date.now(),
      data: nextUsers,
    }
  }

  const patchCachedUser = (id: string, patch: Partial<InternalUserRecord>) => {
    setUsuarios((currentUsers) => {
      const nextUsers = {
        ...currentUsers,
        [id]: {
          ...(currentUsers[id] || {}),
          ...patch,
        },
      }
      syncUsersCache(nextUsers)
      return nextUsers
    })
    setSelectedClientTarget((currentTarget) =>
      currentTarget && currentTarget.id === id
        ? {
            ...currentTarget,
            ...patch,
            paymentInfo: getPaymentStatusCell({
              ...currentTarget,
              ...patch,
            }),
          }
        : currentTarget,
    )
  }

  const removeCachedUser = (id: string) => {
    setUsuarios((currentUsers) => {
      if (!currentUsers[id]) {
        return currentUsers
      }

      const nextUsers = { ...currentUsers }
      delete nextUsers[id]
      syncUsersCache(nextUsers)
      return nextUsers
    })
    setSelectedClientTarget((currentTarget) => (currentTarget && currentTarget.id === id ? null : currentTarget))
  }

  const loadData = async (options: { force?: boolean } = {}) => {
    if (!options.force && usersCacheRef.current?.data) {
      setUsuarios(usersCacheRef.current.data)
      return
    }

    try {
      setLoadingUsers(true)
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

      const nextUsers = Object.fromEntries(usuariosEntries)
      syncUsersCache(nextUsers)
      setUsuarios(nextUsers)
      setError("") // Limpiar errores si la carga es exitosa
    } catch (error) {
      console.error("Error al cargar datos:", error)
      const loadError = getErrorDetails(error)
      if (loadError.code === "PERMISSION_DENIED") {
        setError("Error de permisos al cargar usuarios. Verifica las reglas de seguridad de Firebase Realtime Database.")
      } else {
        setError(`Error al cargar los usuarios: ${loadError.message || "Error desconocido"}`)
      }
    } finally {
      setLoadingUsers(false)
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
        app_url: APP_URL,
        website_url: APP_URL,
        frontend_url: APP_URL,
        public_url: APP_URL,
        redirect_url: APP_URL,
        app_name: "GestiónPro",
        title: "Bienvenido a GestiónPro",
        email: GESTIONPRO_CONTACT_EMAIL,
        reply_to: GESTIONPRO_CONTACT_EMAIL,
        contact_email: GESTIONPRO_CONTACT_EMAIL,
      }

      console.log("EMAILJS PAYLOAD", templateParams)

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
        app_url: APP_URL,
        website_url: APP_URL,
        frontend_url: APP_URL,
        public_url: APP_URL,
        redirect_url: APP_URL,
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

  const getBusinessDisplayName = (userData: InternalUserRecord, fallbackId: string) => {
    return (
      userData.empresa?.trim() ||
      userData.businessName?.trim() ||
      userData.comercio?.trim() ||
      userData.nombre?.trim() ||
      fallbackId ||
      "Sin negocio"
    )
  }

  const openClientDetail = (clientData: ClientListItem) => {
    setSelectedClientTarget(clientData)
  }

  const closeClientDetail = () => {
    setSelectedClientTarget(null)
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

    return {
      businessId: match.businessId,
      record: userData,
    }
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

      return {
        businessId: internalUserId,
        record: userData,
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
        const updatedClient = await reuseExistingClientAccount(formData, primaryMatch)
        if (updatedClient) {
          patchCachedUser(updatedClient.businessId, updatedClient.record)
        }
        setSuccess("Cliente existente reactivado correctamente")
        showPaymentNotice("success", `Datos reutilizados para ${formData.nombre || formData.email}.`)
      } else {
        await prepareCleanClientAccount(matches)
        const createdClient = await createFreshClientAccount(formData, { notify: false })
        if (createdClient) {
          patchCachedUser(createdClient.businessId, createdClient.record)
        }
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
        patchCachedUser(editingUser, userData)
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

      const createdClient = await createFreshClientAccount({
        ...userFormData,
        nombre: normalizedName,
        email: normalizedEmail,
        password: normalizedPassword,
        empresa: userFormData.empresa.trim(),
        rol: userFormData.rol || "user",
        activo: userFormData.activo,
      })

      if (createdClient) {
        patchCachedUser(createdClient.businessId, createdClient.record)
      }

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
      removeCachedUser(id)
      if (id !== businessId) {
        removeCachedUser(businessId)
      }
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
        patchCachedUser(id, updatedUserRecord)
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
      patchCachedUser(id, updatedUserRecord)
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
        patchCachedUser(id, updatedUserRecord)
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

  const resendAccessEmail = async (userData: InternalUserRecord) => {
    if (!userData.email || !userData.password) {
      setError("No hay datos de acceso completos para reenviar")
      return
    }

    const emailSent = await sendWelcomeEmail(
      userData.email,
      userData.nombre || userData.empresa || userData.email,
      userData.password,
    )

    if (emailSent) {
      showPaymentNotice("success", `Acceso reenviado a ${userData.email}.`)
    } else {
      showPaymentNotice("error", `No se pudo reenviar el acceso a ${userData.email}.`)
    }
  }

  useEffect(() => {
    setCurrentPage(1)
  }, [searchTerm, paymentFilter, sortBy, itemsPerPage])

  const usuariosArray = useMemo<Array<{ id: string } & InternalUserRecord>>(
    () =>
      Object.entries(usuarios).map(([id, userData]) => ({
        id,
        ...(userData as InternalUserRecord),
      })),
    [usuarios],
  )

  const usuariosConPagos = useMemo<ClientListItem[]>(
    () =>
      usuariosArray.map((userData) => ({
        ...userData,
        paymentInfo: getPaymentStatusCell(userData),
      })),
    [usuariosArray],
  )

  const usuariosActivos = useMemo(
    () => usuariosArray.filter((user) => user.activo !== false),
    [usuariosArray],
  )
  const usuariosInactivos = useMemo(
    () => usuariosArray.filter((user) => user.activo === false),
    [usuariosArray],
  )
  const paymentStatusCounts = useMemo<Record<"al_dia" | "por_vencer" | "vencido", number>>(
    () =>
      usuariosConPagos.reduce(
        (accumulator, userData) => {
          accumulator[userData.paymentInfo.status] += 1
          return accumulator
        },
        { al_dia: 0, por_vencer: 0, vencido: 0 },
      ),
    [usuariosConPagos],
  )
  const totalMonthlyRevenue = useMemo(
    () => usuariosActivos.reduce((accumulator, userData) => accumulator + Number(userData.precioMensual ?? 0), 0),
    [usuariosActivos],
  )
  const atRiskRevenue = useMemo(
    () =>
      usuariosConPagos
        .filter((userData) => userData.paymentInfo.status !== "al_dia")
        .reduce((accumulator, userData) => accumulator + Number(userData.precioMensual ?? 0), 0),
    [usuariosConPagos],
  )

  const usuariosFiltradosBase = useMemo(
    () =>
      paymentFilter === "all"
        ? usuariosConPagos
        : usuariosConPagos.filter((userData) => userData.paymentInfo.status === paymentFilter),
    [paymentFilter, usuariosConPagos],
  )

  const usuariosBuscados = useMemo(
    () =>
      usuariosFiltradosBase.filter((userData) => {
        if (!searchTerm.trim()) {
          return true
        }

        const searchValue = normalizeSearchText(searchTerm)
        const searchableContent = [
          userData.nombre,
          userData.email,
          userData.empresa,
          userData.businessId,
          userData.uid,
          userData.firebaseUid,
          userData.plan,
          userData.rol,
          userData.role,
          userData.paymentNotes,
        ]
          .filter(Boolean)
          .join(" ")

        return normalizeSearchText(searchableContent).includes(searchValue)
      }),
    [searchTerm, usuariosFiltradosBase],
  )

  const usuariosOrdenados = useMemo(
    () =>
      [...usuariosBuscados].sort((left, right) => {
        const getStatusPriority = (status: BillingStatus) => {
          switch (status) {
            case "vencido":
              return 0
            case "por_vencer":
              return 1
            default:
              return 2
          }
        }

        if (sortBy === "recent") {
          const leftDate = new Date(left.createdAt || left.fechaCreacion || left.updatedAt || 0).getTime() || 0
          const rightDate = new Date(right.createdAt || right.fechaCreacion || right.updatedAt || 0).getTime() || 0
          return rightDate - leftDate
        }

        if (sortBy === "name") {
          return (left.nombre || left.empresa || left.email || "").localeCompare(right.nombre || right.empresa || right.email || "", "es")
        }

        if (sortBy === "mrr") {
          const leftValue = Number(left.precioMensual ?? 0)
          const rightValue = Number(right.precioMensual ?? 0)
          return rightValue - leftValue
        }

        const statusDiff = getStatusPriority(left.paymentInfo.status) - getStatusPriority(right.paymentInfo.status)
        if (statusDiff !== 0) {
          return statusDiff
        }

        const daysLeftLeft = left.paymentInfo.diasRestantes ?? Number.POSITIVE_INFINITY
        const daysLeftRight = right.paymentInfo.diasRestantes ?? Number.POSITIVE_INFINITY
        if (daysLeftLeft !== daysLeftRight) {
          return daysLeftLeft - daysLeftRight
        }

        return (left.nombre || left.empresa || left.email || "").localeCompare(right.nombre || right.empresa || right.email || "", "es")
      }),
    [sortBy, usuariosBuscados],
  )

  const parsedItemsPerPage = Number(itemsPerPage) || 10
  const totalPages = Math.max(1, Math.ceil(usuariosOrdenados.length / parsedItemsPerPage))
  const currentPageSafe = Math.min(currentPage, totalPages)
  const pageStartIndex = (currentPageSafe - 1) * parsedItemsPerPage
  const pageEndIndex = pageStartIndex + parsedItemsPerPage
  const usuariosPaginados = useMemo(
    () => usuariosOrdenados.slice(pageStartIndex, pageEndIndex),
    [pageEndIndex, pageStartIndex, usuariosOrdenados],
  )
  const visibleItemsLabel =
    usuariosOrdenados.length === 0
      ? "0 resultados"
      : `${pageStartIndex + 1}-${Math.min(pageEndIndex, usuariosOrdenados.length)} de ${usuariosOrdenados.length}`

  const renderPaymentBadges = (userData: ClientListItem) => (
    <div className="flex flex-wrap gap-1.5">
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
      <Badge variant={userData.activo ? "default" : "destructive"}>
        {userData.activo ? "Activo" : "Suspendido"}
      </Badge>
    </div>
  )

  const renderAccessControls = (userData: ClientListItem) => (
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
      <Button
        variant="secondary"
        size="sm"
        className="justify-start gap-2"
        onClick={() => resendAccessEmail(userData)}
        disabled={!userData.email || !userData.password || sendingEmail}
      >
        {sendingEmail ? (
          <div className="h-4 w-4 animate-spin rounded-full border-b-2 border-current" />
        ) : (
          <Mail className="h-4 w-4" />
        )}
        Reenviar acceso
      </Button>
    </div>
  )

  const renderActionMenu = (userData: ClientListItem) => (
    <div className="flex flex-wrap items-center gap-2">
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
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="h-8 w-8 p-0">
            <MoreHorizontal className="h-4 w-4" />
            <span className="sr-only">Más acciones</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel>Acciones</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => handleEditUser(userData.id, userData)}>
            <Edit className="h-4 w-4" />
            Editar cliente
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => handleToggleUserStatus(userData.id, userData)}>
            {userData.activo ? <UserX className="h-4 w-4" /> : <UserCheck className="h-4 w-4" />}
            {userData.activo ? "Suspender cliente" : "Reactivar cliente"}
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={() => handleLoadDemoData(userData.id, userData)}
            disabled={demoLoadingUserId === userData.id}
          >
            {demoLoadingUserId === userData.id ? (
              <div className="h-4 w-4 animate-spin rounded-full border-b-2 border-current" />
            ) : (
              <Database className="h-4 w-4" />
            )}
            Cargar datos demo
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onSelect={() => handleOpenDemoDeleteDialog(userData.id, userData)}
            disabled={demoDeleteLoading && demoDeleteTarget?.id === userData.id}
            className="text-amber-600"
          >
            {demoDeleteLoading && demoDeleteTarget?.id === userData.id ? (
              <div className="h-4 w-4 animate-spin rounded-full border-b-2 border-current" />
            ) : (
              <Trash2 className="h-4 w-4" />
            )}
            Eliminar demo
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={() => handleOpenPermanentDeleteDialog(userData.id, userData)}
            className="text-red-600"
          >
            <Trash2 className="h-4 w-4" />
            Eliminar definitivamente
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )

  const renderUserCard = (userData: ClientListItem) => {
    const businessId = getClientBusinessId(userData, userData.id)
    const businessName = getBusinessDisplayName(userData, businessId)
    const createdDate = formatBillingDate(userData.fechaAlta || userData.createdAt || userData.fechaCreacion) || "-"

    return (
      <Card
        key={userData.id}
        role="button"
        tabIndex={0}
        aria-label={`Abrir cliente ${businessName}`}
        className={`${userData.activo === false ? "border-muted bg-muted/40" : "shadow-sm"} cursor-pointer transition hover:shadow-md`}
        onClick={() => openClientDetail(userData)}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault()
            openClientDetail(userData)
          }
        }}
      >
        <CardContent className="p-4">
          <div className="space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 space-y-1">
                <div className="flex items-center gap-2">
                  <h3 className="truncate font-semibold text-foreground">{businessName}</h3>
                  <Badge variant={userData.rol === "admin" ? "default" : "secondary"}>{userData.rol}</Badge>
                </div>
                <p className="text-xs text-muted-foreground break-all">{userData.email}</p>
                {businessName !== businessId && (
                  <p className="font-mono text-[11px] text-muted-foreground break-all">{businessId}</p>
                )}
              </div>
              <div className="flex flex-col items-end gap-2">
                <Badge variant={userData.activo ? "default" : "destructive"} className="shrink-0">
                  {userData.activo ? "Activo" : "Suspendido"}
                </Badge>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-lg bg-muted/50 p-3">
                <div className="text-xs text-muted-foreground">Plan</div>
                <div className="mt-1 font-medium">{userData.plan || "mensual"}</div>
              </div>
              <div className="rounded-lg bg-muted/50 p-3">
                <div className="text-xs text-muted-foreground">Precio</div>
                <div className="mt-1 font-medium">${Number(userData.precioMensual ?? 0).toLocaleString("es-AR")}</div>
              </div>
              <div className="rounded-lg bg-muted/50 p-3">
                <div className="text-xs text-muted-foreground">Últ. pago</div>
                <div className="mt-1 font-medium">{formatBillingDate(userData.ultimoPago) || "-"}</div>
              </div>
              <div className="rounded-lg bg-muted/50 p-3">
                <div className="text-xs text-muted-foreground">Próx. pago</div>
                <div className="mt-1 font-medium">{formatBillingDate(userData.proximoPago) || "-"}</div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className="gap-1">
                <CalendarClock className="h-3.5 w-3.5" />
                Alta {createdDate}
              </Badge>
              <Badge variant="outline" className="gap-1">
                <Building2 className="h-3.5 w-3.5" />
                {userData.paymentInfo.diasRestantes === null
                  ? "Sin fecha"
                  : `${userData.paymentInfo.diasRestantes} día${Math.abs(userData.paymentInfo.diasRestantes) === 1 ? "" : "s"}`}
              </Badge>
            </div>

            {renderPaymentBadges(userData)}

            <div className="rounded-lg border border-border/60 p-3" onClick={(event) => event.stopPropagation()}>
              <div className="text-xs font-medium text-muted-foreground">Acceso</div>
              <div className="mt-2">{renderAccessControls(userData)}</div>
            </div>

            <div className="rounded-lg border border-border/60 p-3" onClick={(event) => event.stopPropagation()}>
              <div className="text-xs font-medium text-muted-foreground">Acciones</div>
              <div className="mt-2 flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleMarkAsPaid(userData.id, userData)}
                  disabled={paymentAction?.userId === userData.id}
                  className="gap-2"
                >
                  {paymentAction?.userId === userData.id && paymentAction.type === "mark_paid" ? (
                    <div className="h-4 w-4 animate-spin rounded-full border-b-2 border-current" />
                  ) : (
                    <Wallet className="h-4 w-4 text-green-500" />
                  )}
                  Pagado
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleSendPaymentReminder(userData.id, userData)}
                  disabled={paymentAction?.userId === userData.id}
                  className="gap-2"
                >
                  {paymentAction?.userId === userData.id && paymentAction.type === "reminder" ? (
                    <div className="h-4 w-4 animate-spin rounded-full border-b-2 border-current" />
                  ) : (
                    <BellRing className="h-4 w-4 text-amber-500" />
                  )}
                  Recordatorio
                </Button>
                <Button variant="secondary" size="sm" onClick={() => handleEditUser(userData.id, userData)} className="gap-2">
                  <Edit className="h-4 w-4" />
                  Editar
                </Button>
                <Button
                  variant={userData.activo ? "destructive" : "secondary"}
                  size="sm"
                  onClick={() => handleToggleUserStatus(userData.id, userData)}
                  className="gap-2"
                >
                  {userData.activo ? <UserX className="h-4 w-4" /> : <UserCheck className="h-4 w-4" />}
                  {userData.activo ? "Suspender" : "Reactivar"}
                </Button>
              </div>
              <div className="mt-2">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="w-full gap-2">
                      <MoreHorizontal className="h-4 w-4" />
                      Más opciones
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-[var(--radix-dropdown-menu-trigger-width)]">
                    <DropdownMenuItem
                      onSelect={() => handleLoadDemoData(userData.id, userData)}
                      disabled={demoLoadingUserId === userData.id}
                    >
                      {demoLoadingUserId === userData.id ? (
                        <div className="h-4 w-4 animate-spin rounded-full border-b-2 border-current" />
                      ) : (
                        <Database className="h-4 w-4" />
                      )}
                      Cargar datos demo
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onSelect={() => handleOpenDemoDeleteDialog(userData.id, userData)}
                      disabled={demoDeleteLoading && demoDeleteTarget?.id === userData.id}
                      className="text-amber-600"
                    >
                      <Trash2 className="h-4 w-4" />
                      Eliminar demo
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onSelect={() => handleOpenPermanentDeleteDialog(userData.id, userData)}
                      className="text-red-600"
                    >
                      <Trash2 className="h-4 w-4" />
                      Eliminar definitivamente
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  const renderEmptyState = () => (
    <div className="flex flex-col items-center gap-3 py-8 text-center text-muted-foreground">
      {loadingUsers ? (
        <div className="space-y-2">
          <div className="mx-auto h-6 w-6 animate-spin rounded-full border-b-2 border-primary" />
          <p>Cargando clientes...</p>
        </div>
      ) : (
      <p>
        {usuariosOrdenados.length === 0
          ? "No hay coincidencias con los filtros aplicados."
          : "No hay usuarios registrados"}
      </p>
      )}
      {!loadingUsers && usuariosOrdenados.length === 0 && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => {
            setSearchTerm("")
            setPaymentFilter("all")
            setSortBy("due")
            setCurrentPage(1)
          }}
        >
          Limpiar filtros
        </Button>
      )}
    </div>
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
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            {[
              {
                label: "Total clientes",
                value: usuariosArray.length,
                helper: "Registrados en el sistema",
                icon: Users,
                iconClassName: "text-blue-500",
              },
              {
                label: "Activos",
                value: usuariosActivos.length,
                helper: "Con acceso habilitado",
                icon: UserCheck,
                iconClassName: "text-green-500",
              },
              {
                label: "Suspendidos",
                value: usuariosInactivos.length,
                helper: "Bloqueados temporalmente",
                icon: UserX,
                iconClassName: "text-red-500",
              },
              {
                label: "Al día",
                value: paymentStatusCounts.al_dia,
                helper: "Pagos vigentes",
                icon: CheckCircle,
                iconClassName: "text-emerald-500",
              },
              {
                label: "Por vencer",
                value: paymentStatusCounts.por_vencer,
                helper: "Requieren seguimiento",
                icon: BellRing,
                iconClassName: "text-amber-500",
              },
              {
                label: "Vencidos",
                value: paymentStatusCounts.vencido,
                helper: "Clientes con mora",
                icon: AlertCircle,
                iconClassName: "text-rose-500",
              },
              {
                label: "MRR estimado",
                value: `$${totalMonthlyRevenue.toLocaleString("es-AR")}`,
                helper: "Ingreso mensual activo",
                icon: BadgeDollarSign,
                iconClassName: "text-violet-500",
              },
              {
                label: "En riesgo",
                value: `$${atRiskRevenue.toLocaleString("es-AR")}`,
                helper: "Suma de vencidos y por vencer",
                icon: Wallet,
                iconClassName: "text-orange-500",
              },
            ].map((metric) => {
              const MetricIcon = metric.icon

              return (
                <Card key={metric.label} className="shadow-sm">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 space-y-1">
                        <p className="text-sm font-medium text-muted-foreground">{metric.label}</p>
                        <p className="text-2xl font-bold leading-none">{metric.value}</p>
                        <p className="text-xs text-muted-foreground">{metric.helper}</p>
                      </div>
                      <MetricIcon className={`h-8 w-8 shrink-0 ${metric.iconClassName}`} />
                    </div>
                  </CardContent>
                </Card>
              )
            })}
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
              <DialogContent className="w-[95vw] sm:w-[90vw] max-w-2xl max-h-[90vh] overflow-y-auto p-4 sm:p-6">
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
              <DialogContent className="w-[95vw] sm:w-[90vw] max-w-lg max-h-[90vh] overflow-y-auto p-4 sm:p-6">
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
              <DialogContent className="w-[95vw] sm:w-[90vw] max-w-lg max-h-[90vh] overflow-y-auto p-4 sm:p-6">
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
              <DialogContent className="w-[95vw] sm:w-[90vw] max-w-lg max-h-[90vh] overflow-y-auto p-4 sm:p-6">
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

          <Dialog
            open={Boolean(selectedClientTarget)}
            onOpenChange={(open) => {
              if (!open) {
                closeClientDetail()
              }
            }}
          >
            <DialogContent className="w-[95vw] sm:w-[90vw] max-w-6xl max-h-[90vh] overflow-y-auto p-4 sm:p-6">
              {selectedClientTarget && (() => {
                const userData = selectedClientTarget
                const businessId = getClientBusinessId(userData, userData.id)
                const businessName = getBusinessDisplayName(userData, businessId)
                const createdDate = formatBillingDate(userData.fechaAlta || userData.createdAt || userData.fechaCreacion) || "-"
                const updatedDate = formatBillingDate(userData.updatedAt || userData.fechaActualizacion) || "-"

                return (
                  <div className="space-y-6">
                    <DialogHeader className="space-y-2">
                      <DialogTitle className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <span className="truncate">{businessName}</span>
                        <Badge variant={userData.activo ? "default" : "destructive"} className="w-fit">
                          {userData.activo ? "Activo" : "Suspendido"}
                        </Badge>
                      </DialogTitle>
                      <p className="text-sm text-muted-foreground break-all">
                        {userData.email || "Sin email"} · {userData.empresa || "Sin empresa"}
                      </p>
                    </DialogHeader>

                    <div className="rounded-2xl border border-border/60 bg-muted/20 p-4 shadow-sm">
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
                        {[
                          {
                            label: "Estado de cuenta",
                            value:
                              userData.paymentInfo.status === "al_dia"
                                ? "Al día"
                                : userData.paymentInfo.status === "por_vencer"
                                  ? "Por vencer"
                                  : "Vencido",
                            helper: userData.pagoActivo ? "Pago activo" : "Pago pausado",
                            icon: Wallet,
                            iconClassName: userData.paymentInfo.status === "vencido" ? "text-red-500" : userData.paymentInfo.status === "por_vencer" ? "text-amber-500" : "text-emerald-500",
                          },
                          {
                            label: "Días restantes",
                            value:
                              userData.paymentInfo.diasRestantes === null
                                ? "-"
                                : `${userData.paymentInfo.diasRestantes} día${Math.abs(userData.paymentInfo.diasRestantes) === 1 ? "" : "s"}`,
                            helper: `Próximo pago ${formatBillingDate(userData.proximoPago) || "-"}`,
                            icon: CalendarClock,
                            iconClassName: "text-blue-500",
                          },
                          {
                            label: "Ingreso mensual",
                            value: `$${Number(userData.precioMensual ?? 0).toLocaleString("es-AR")}`,
                            helper: userData.plan || "mensual",
                            icon: BadgeDollarSign,
                            iconClassName: "text-violet-500",
                          },
                          {
                            label: "Acceso",
                            value: userData.activo ? "Habilitado" : "Suspendido",
                            helper:
                              userData.paymentReminderCount && userData.paymentReminderCount > 0
                                ? `${userData.paymentReminderCount} recordatorio${userData.paymentReminderCount === 1 ? "" : "s"} enviado${userData.paymentReminderCount === 1 ? "" : "s"}`
                                : "Sin recordatorios",
                            icon: userData.activo ? UserCheck : UserX,
                            iconClassName: userData.activo ? "text-green-500" : "text-red-500",
                          },
                        ].map((metric) => {
                          const MetricIcon = metric.icon

                          return (
                            <div key={metric.label} className="rounded-xl border border-border/60 bg-background/80 p-3">
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0 space-y-1">
                                  <div className="text-xs font-medium text-muted-foreground">{metric.label}</div>
                                  <div className="text-lg font-semibold text-foreground">{metric.value}</div>
                                  <div className="text-xs text-muted-foreground">{metric.helper}</div>
                                </div>
                                <MetricIcon className={`h-5 w-5 shrink-0 ${metric.iconClassName}`} />
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>

                    <div className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
                      <Card className="shadow-sm">
                        <CardHeader className="pb-3">
                          <CardTitle className="text-base">Información del cliente</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {[
                              { label: "Nombre", value: userData.nombre || "Sin nombre" },
                              { label: "Empresa", value: userData.empresa || "Sin empresa" },
                              { label: "Negocio", value: businessName },
                              { label: "Business ID", value: businessId },
                              { label: "UID", value: userData.uid || userData.id },
                              { label: "Firebase UID", value: userData.firebaseUid || userData.uid || userData.id },
                              { label: "Rol", value: userData.rol || "user" },
                              { label: "Plan", value: userData.plan || "mensual" },
                              { label: "Precio mensual", value: `$${Number(userData.precioMensual ?? 0).toLocaleString("es-AR")}` },
                              { label: "Fecha alta", value: createdDate },
                              { label: "Última actualización", value: updatedDate },
                              { label: "Días aviso", value: String(userData.diasAvisoPago ?? 3) },
                              { label: "Último pago", value: formatBillingDate(userData.ultimoPago) || "-" },
                              { label: "Próximo pago", value: formatBillingDate(userData.proximoPago) || "-" },
                            ].map((field) => (
                              <div key={field.label} className="rounded-lg border border-border/60 bg-muted/30 p-3">
                                <div className="text-xs font-medium text-muted-foreground">{field.label}</div>
                                <div className="mt-1 break-words text-sm font-medium text-foreground">{field.value}</div>
                              </div>
                            ))}
                          </div>
                          <div className="space-y-2">
                            <div className="text-xs font-medium text-muted-foreground">Notas de pago</div>
                            <div className="rounded-lg border border-border/60 bg-muted/30 p-3 text-sm text-foreground">
                              {userData.paymentNotes?.trim() || "Sin notas"}
                            </div>
                          </div>
                        </CardContent>
                      </Card>

                      <div className="space-y-4">
                        <Card className="shadow-sm">
                          <CardHeader className="pb-3">
                            <CardTitle className="text-base">Estado y pagos</CardTitle>
                          </CardHeader>
                          <CardContent className="space-y-4">
                            {renderPaymentBadges(userData)}
                            <div className="grid grid-cols-2 gap-3 text-sm">
                              <div className="rounded-lg border border-border/60 bg-muted/30 p-3">
                                <div className="text-xs text-muted-foreground">Pago activo</div>
                                <div className="mt-1 font-medium">{userData.pagoActivo ? "Sí" : "No"}</div>
                              </div>
                              <div className="rounded-lg border border-border/60 bg-muted/30 p-3">
                                <div className="text-xs text-muted-foreground">Días restantes</div>
                                <div className="mt-1 font-medium">
                                  {userData.paymentInfo.diasRestantes === null
                                    ? "-"
                                    : `${userData.paymentInfo.diasRestantes} día${Math.abs(userData.paymentInfo.diasRestantes) === 1 ? "" : "s"}`}
                                </div>
                              </div>
                            </div>
                            <div className="flex flex-wrap gap-2">
                              <Button
                                size="sm"
                                onClick={() => handleMarkAsPaid(userData.id, userData)}
                                disabled={paymentAction?.userId === userData.id}
                                className="gap-2"
                              >
                                {paymentAction?.userId === userData.id && paymentAction.type === "mark_paid" ? (
                                  <div className="h-4 w-4 animate-spin rounded-full border-b-2 border-current" />
                                ) : (
                                  <Wallet className="h-4 w-4" />
                                )}
                                Marcar como pagado
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleSendPaymentReminder(userData.id, userData)}
                                disabled={paymentAction?.userId === userData.id}
                                className="gap-2"
                              >
                                {paymentAction?.userId === userData.id && paymentAction.type === "reminder" ? (
                                  <div className="h-4 w-4 animate-spin rounded-full border-b-2 border-current" />
                                ) : (
                                  <BellRing className="h-4 w-4 text-amber-500" />
                                )}
                                Recordatorio
                              </Button>
                            </div>
                          </CardContent>
                        </Card>

                        <Card className="shadow-sm">
                          <CardHeader className="pb-3">
                            <CardTitle className="text-base">Acceso</CardTitle>
                          </CardHeader>
                          <CardContent>{renderAccessControls(userData)}</CardContent>
                        </Card>

                        <Card className="shadow-sm">
                          <CardHeader className="pb-3">
                            <CardTitle className="text-base">Acciones del cliente</CardTitle>
                          </CardHeader>
                          <CardContent className="space-y-3">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                              <Button
                                variant="secondary"
                                size="sm"
                                onClick={() => {
                                  closeClientDetail()
                                  handleEditUser(userData.id, userData)
                                }}
                                className="justify-start gap-2"
                              >
                                <Edit className="h-4 w-4" />
                                Editar cliente
                              </Button>
                              <Button
                                variant={userData.activo ? "destructive" : "secondary"}
                                size="sm"
                                onClick={() => handleToggleUserStatus(userData.id, userData)}
                                className="justify-start gap-2"
                              >
                                {userData.activo ? <UserX className="h-4 w-4" /> : <UserCheck className="h-4 w-4" />}
                                {userData.activo ? "Suspender" : "Reactivar"}
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleLoadDemoData(userData.id, userData)}
                                disabled={demoLoadingUserId === userData.id}
                                className="justify-start gap-2"
                              >
                                {demoLoadingUserId === userData.id ? (
                                  <div className="h-4 w-4 animate-spin rounded-full border-b-2 border-current" />
                                ) : (
                                  <Database className="h-4 w-4" />
                                )}
                                Cargar datos demo
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  closeClientDetail()
                                  handleOpenDemoDeleteDialog(userData.id, userData)
                                }}
                                disabled={demoDeleteLoading && demoDeleteTarget?.id === userData.id}
                                className="justify-start gap-2 text-amber-600"
                              >
                                <Trash2 className="h-4 w-4" />
                                Eliminar demo
                              </Button>
                            </div>
                              <Button
                                variant="destructive"
                                size="sm"
                                onClick={() => {
                                  closeClientDetail()
                                  handleOpenPermanentDeleteDialog(userData.id, userData)
                                }}
                                className="w-full gap-2"
                              >
                              <Trash2 className="h-4 w-4" />
                              Eliminar definitivamente
                            </Button>
                          </CardContent>
                        </Card>
                      </div>
                    </div>
                  </div>
                )
              })()}
            </DialogContent>
          </Dialog>

          <div className="rounded-2xl border bg-card/80 p-4 shadow-sm">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                  <SlidersHorizontal className="h-4 w-4 text-muted-foreground" />
                  Control de lista
                </div>
                <p className="text-sm text-muted-foreground">
                  Buscá por nombre, email, empresa o negocio. Ordená por vencimiento, antigüedad o monto.
                </p>
              </div>
              <div className="grid w-full gap-3 sm:grid-cols-2 xl:grid-cols-4 lg:max-w-4xl">
                <div className="relative sm:col-span-2 xl:col-span-1">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={searchTerm}
                    onChange={(event) => setSearchTerm(event.target.value)}
                    placeholder="Buscar cliente, email o negocio"
                    className="pl-9"
                  />
                </div>
                <Select value={sortBy} onValueChange={(value) => setSortBy(value as typeof sortBy)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Ordenar por" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="due">Pago más urgente</SelectItem>
                    <SelectItem value="recent">Más recientes</SelectItem>
                    <SelectItem value="name">Nombre A-Z</SelectItem>
                    <SelectItem value="mrr">Mayor MRR</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={itemsPerPage} onValueChange={setItemsPerPage}>
                  <SelectTrigger>
                    <SelectValue placeholder="Por página" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="5">5 por página</SelectItem>
                    <SelectItem value="10">10 por página</SelectItem>
                    <SelectItem value="20">20 por página</SelectItem>
                    <SelectItem value="50">50 por página</SelectItem>
                  </SelectContent>
                </Select>
                <div className="flex items-center justify-between gap-2 rounded-lg border border-border/60 bg-background/60 px-3 py-2">
                  <div className="min-w-0 text-sm text-muted-foreground">
                    <div className="font-medium text-foreground">{visibleItemsLabel}</div>
                    <div className="text-xs text-muted-foreground">Vista optimizada con cache local</div>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="gap-2"
                    onClick={() => loadData({ force: true })}
                    disabled={loadingUsers}
                  >
                    {loadingUsers ? (
                      <div className="h-4 w-4 animate-spin rounded-full border-b-2 border-current" />
                    ) : (
                      <RefreshCw className="h-4 w-4" />
                    )}
                    Actualizar
                  </Button>
                </div>
              </div>
            </div>
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

          <div className="grid gap-4 md:hidden">
            {usuariosPaginados.length === 0 ? renderEmptyState() : usuariosPaginados.map(renderUserCard)}
          </div>

          <Card className="hidden overflow-hidden shadow-sm md:block">
            <CardContent className="p-0">
              <div className="flex flex-col gap-2 border-b border-border/60 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="text-sm text-muted-foreground">
                  Mostrando <span className="font-medium text-foreground">{visibleItemsLabel}</span>
                </div>
                <div className="text-sm text-muted-foreground">
                  {usuariosOrdenados.length === 0 ? "Sin resultados" : `${totalPages} página${totalPages === 1 ? "" : "s"}`}
                </div>
              </div>
              <div className="w-full overflow-x-auto">
                <Table className="min-w-[1500px] w-full">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nombre</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Empresa</TableHead>
                      <TableHead>Negocio</TableHead>
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
                    {usuariosPaginados.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={14} className="py-8 text-center text-muted-foreground">
                          {renderEmptyState()}
                        </TableCell>
                      </TableRow>
                    ) : (
                      usuariosPaginados.map((userData) => {
                        const businessId = getClientBusinessId(userData, userData.id)
                        const businessName = getBusinessDisplayName(userData, businessId)
                        const createdDate = formatBillingDate(userData.fechaAlta || userData.createdAt || userData.fechaCreacion) || "-"

                        return (
                          <TableRow
                            key={userData.id}
                            className={`${userData.activo === false ? "bg-muted/50" : ""} cursor-pointer transition hover:bg-muted/50`}
                            role="button"
                            tabIndex={0}
                            aria-label={`Abrir cliente ${businessName}`}
                            onClick={() => openClientDetail(userData)}
                            onKeyDown={(event) => {
                              if (event.key === "Enter" || event.key === " ") {
                                event.preventDefault()
                                openClientDetail(userData)
                              }
                            }}
                          >
                            <TableCell className="font-medium">
                              <div className="space-y-1">
                                <div>{userData.nombre || "Sin nombre"}</div>
                                <div className="text-xs text-muted-foreground">{userData.uid || userData.firebaseUid || userData.id}</div>
                              </div>
                            </TableCell>
                            <TableCell>{userData.email}</TableCell>
                            <TableCell>{userData.empresa || "Sin empresa"}</TableCell>
                            <TableCell>
                              <div className="space-y-1">
                                <div className="flex items-center gap-1 font-medium text-foreground">
                                  <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                                  <span className="truncate max-w-[240px]">{businessName}</span>
                                </div>
                                {businessName !== businessId && (
                                  <div className="font-mono text-[11px] text-muted-foreground break-all">{businessId}</div>
                                )}
                                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                  <CalendarClock className="h-3.5 w-3.5" />
                                  Alta {createdDate}
                                </div>
                              </div>
                            </TableCell>
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
                              <div className="flex flex-col gap-2" onClick={(event) => event.stopPropagation()}>
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
                                <Button
                                  variant="secondary"
                                  size="sm"
                                  className="justify-start gap-2"
                                  onClick={() => resendAccessEmail(userData)}
                                  disabled={!userData.email || !userData.password || sendingEmail}
                                >
                                  {sendingEmail ? (
                                    <div className="h-4 w-4 animate-spin rounded-full border-b-2 border-current" />
                                  ) : (
                                    <Mail className="h-4 w-4" />
                                  )}
                                  Reenviar acceso
                                </Button>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex flex-wrap items-center gap-2" onClick={(event) => event.stopPropagation()}>
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
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button variant="outline" size="sm" className="h-8 w-8 p-0">
                                      <MoreHorizontal className="h-4 w-4" />
                                      <span className="sr-only">Más acciones</span>
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end" className="w-56">
                                    <DropdownMenuLabel>Acciones</DropdownMenuLabel>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem onSelect={() => handleEditUser(userData.id, userData)}>
                                      <Edit className="h-4 w-4" />
                                      Editar cliente
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                      onSelect={() => handleToggleUserStatus(userData.id, userData)}
                                    >
                                      {userData.activo ? (
                                        <UserX className="h-4 w-4" />
                                      ) : (
                                        <UserCheck className="h-4 w-4" />
                                      )}
                                      {userData.activo ? "Suspender cliente" : "Reactivar cliente"}
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                      onSelect={() => handleLoadDemoData(userData.id, userData)}
                                      disabled={demoLoadingUserId === userData.id}
                                    >
                                      {demoLoadingUserId === userData.id ? (
                                        <div className="h-4 w-4 animate-spin rounded-full border-b-2 border-current" />
                                      ) : (
                                        <Database className="h-4 w-4" />
                                      )}
                                      Cargar datos demo
                                    </DropdownMenuItem>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem
                                      onSelect={() => handleOpenDemoDeleteDialog(userData.id, userData)}
                                      disabled={demoDeleteLoading && demoDeleteTarget?.id === userData.id}
                                      className="text-amber-600"
                                    >
                                      {demoDeleteLoading && demoDeleteTarget?.id === userData.id ? (
                                        <div className="h-4 w-4 animate-spin rounded-full border-b-2 border-current" />
                                      ) : (
                                        <Trash2 className="h-4 w-4" />
                                      )}
                                      Eliminar demo
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                      onSelect={() => handleOpenPermanentDeleteDialog(userData.id, userData)}
                                      className="text-red-600"
                                    >
                                      <Trash2 className="h-4 w-4" />
                                      Eliminar definitivamente
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </div>
                            </TableCell>
                          </TableRow>
                        )
                      })
                    )}
                  </TableBody>
                </Table>
              </div>
              <div className="border-t border-border/60 px-4 py-3">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="text-sm text-muted-foreground">
                    {usuariosOrdenados.length === 0
                      ? "No hay coincidencias para los filtros seleccionados."
                      : `Página ${currentPageSafe} de ${totalPages}`}
                  </div>
                  <Pagination
                    currentPage={currentPageSafe}
                    totalPages={totalPages}
                    onPageChange={setCurrentPage}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  )
} 

