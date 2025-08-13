# 🔐 Sistema de Persistencia de Sesión

## 🎯 Descripción

El sistema de persistencia de sesión permite que los usuarios permanezcan logueados incluso después de recargar la página o cerrar y abrir el navegador. La sesión se mantiene activa hasta que el usuario cierre sesión manualmente o la sesión expire automáticamente.

## ✨ Características Implementadas

### 🔄 **Persistencia Automática**
- **localStorage**: La información de la sesión se guarda en el navegador
- **Recuperación automática**: Al cargar la página, se restaura la sesión automáticamente
- **Expiración configurable**: La sesión expira después de 7 días por defecto
- **Limpieza automática**: Las sesiones expiradas se eliminan automáticamente

### 🛡️ **Seguridad**
- **Validación de tiempo**: Verifica que la sesión no haya expirado
- **Manejo de errores**: Limpia datos corruptos automáticamente
- **Cierre seguro**: Elimina todos los datos al cerrar sesión

### 🎛️ **Gestión de Estado**
- **Contexto global**: Estado de autenticación disponible en toda la aplicación
- **Hooks personalizados**: `useAuth()` para acceder fácilmente al estado
- **Actualización en tiempo real**: Cambios reflejados inmediatamente

## 🏗️ Arquitectura del Sistema

### **Contexto de Autenticación** (`contexts/auth-context.tsx`)

```tsx
interface AuthContextType {
  user: User | null
  isLoggedIn: boolean
  isSuperAdmin: boolean
  isLoading: boolean
  login: (userData: User, isAdmin?: boolean) => void
  logout: () => void
}
```

### **Estructura de Datos de Sesión**

```json
{
  "user": {
    "id": "userId123",
    "email": "usuario@ejemplo.com",
    "role": "user",
    "name": "Nombre del Usuario",
    "empresa": "Empresa del Usuario"
  },
  "isSuperAdmin": false,
  "timestamp": 1703123456789
}
```

## 🚀 Cómo Funciona

### **1. Inicio de Sesión**
```tsx
const { login } = useAuth()

// Para usuario normal
login(userData, false)

// Para super admin
login(adminUser, true)
```

### **2. Verificación de Sesión**
```tsx
const { user, isLoggedIn, isLoading } = useAuth()

if (isLoading) {
  // Mostrar pantalla de carga
}

if (isLoggedIn) {
  // Usuario autenticado
}
```

### **3. Cierre de Sesión**
```tsx
const { logout } = useAuth()
logout() // Limpia localStorage y estado
```

## 📋 Flujo de Autenticación

### **Al Cargar la Aplicación:**
1. **Inicialización**: Se muestra pantalla de carga
2. **Verificación**: Se busca sesión en localStorage
3. **Validación**: Se verifica que la sesión no haya expirado
4. **Restauración**: Si es válida, se restaura el estado
5. **Renderizado**: Se muestra la interfaz correspondiente

### **Al Iniciar Sesión:**
1. **Validación**: Se verifican las credenciales
2. **Creación**: Se crea el objeto de usuario
3. **Persistencia**: Se guarda en localStorage
4. **Estado**: Se actualiza el contexto global
5. **Redirección**: Se muestra el dashboard

### **Al Cerrar Sesión:**
1. **Limpieza**: Se elimina la sesión del localStorage
2. **Estado**: Se resetea el contexto global
3. **Redirección**: Se vuelve al login

## 🔧 Configuración

### **Duración de la Sesión**
```tsx
const maxSessionAge = 7 * 24 * 60 * 60 * 1000 // 7 días
```

### **Clave de Almacenamiento**
```tsx
localStorage.setItem('controlStockSession', JSON.stringify(sessionData))
```

## 💡 Uso en Componentes

### **Componente con Autenticación**
```tsx
import { useAuth } from "@/contexts/auth-context"

export default function MiComponente() {
  const { user, isLoggedIn, logout } = useAuth()

  if (!isLoggedIn) {
    return <div>No autorizado</div>
  }

  return (
    <div>
      <h1>Bienvenido, {user.name}</h1>
      <button onClick={logout}>Cerrar Sesión</button>
    </div>
  )
}
```

### **Protección de Rutas**
```tsx
function ProtectedRoute({ children }) {
  const { isLoggedIn, isLoading } = useAuth()

  if (isLoading) {
    return <LoadingSpinner />
  }

  if (!isLoggedIn) {
    return <LoginPage />
  }

  return children
}
```

## 🛠️ Implementación Técnica

### **1. Provider en Layout**
```tsx
// app/layout.tsx
<AuthProvider>
  {children}
</AuthProvider>
```

### **2. Hook Personalizado**
```tsx
// contexts/auth-context.tsx
export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth debe ser usado dentro de AuthProvider')
  }
  return context
}
```

### **3. Gestión de Estado**
```tsx
const [user, setUser] = useState<User | null>(null)
const [isLoggedIn, setIsLoggedIn] = useState(false)
const [isSuperAdmin, setIsSuperAdmin] = useState(false)
const [isLoading, setIsLoading] = useState(true)
```

## 🔒 Consideraciones de Seguridad

### **Datos Sensibles**
- ❌ **No se almacenan**: Contraseñas en localStorage
- ✅ **Se almacenan**: Información básica del usuario
- ✅ **Se validan**: Timestamps para expiración

### **Limpieza Automática**
- **Sesiones expiradas**: Se eliminan automáticamente
- **Datos corruptos**: Se limpian al detectar errores
- **Cierre manual**: Limpia completamente al logout

### **Validaciones**
- **Formato JSON**: Se valida antes de parsear
- **Estructura de datos**: Se verifica que sea correcta
- **Timestamps**: Se valida la fecha de expiración

## 🎯 Beneficios

### **Para el Usuario:**
- ✅ **No necesita relogin**: Después de recargar la página
- ✅ **Experiencia fluida**: Sin interrupciones
- ✅ **Sesión persistente**: Hasta cerrar manualmente

### **Para el Desarrollador:**
- ✅ **Estado global**: Fácil acceso desde cualquier componente
- ✅ **Gestión centralizada**: Lógica de auth en un lugar
- ✅ **Reutilizable**: Hook `useAuth()` en toda la app

### **Para la Aplicación:**
- ✅ **Rendimiento**: No necesita verificar auth en cada carga
- ✅ **Escalabilidad**: Fácil de extender con más funcionalidades
- ✅ **Mantenibilidad**: Código organizado y documentado

## 🔄 Futuras Mejoras

- [ ] **Refresh tokens**: Para sesiones más seguras
- [ ] **Múltiples dispositivos**: Sincronización entre navegadores
- [ ] **Notificaciones**: Alertas de sesión próxima a expirar
- [ ] **Configuración**: Duración de sesión configurable por usuario
- [ ] **Auditoría**: Logs de inicio/cierre de sesión

---

**¡El sistema de persistencia de sesión está listo para mejorar la experiencia del usuario!** 🚀 