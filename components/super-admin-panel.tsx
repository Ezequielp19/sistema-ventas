"use client"

import { useState, useEffect } from "react"
import { ref, get, set, push, remove } from "firebase/database"
import { database } from "@/lib/firebase"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
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
  UserCheck
} from "lucide-react"
import { ThemeToggle } from "@/components/theme-toggle"

export default function SuperAdminPanel({ user, onLogout }) {
  const [usuarios, setUsuarios] = useState({})
  const [showUserDialog, setShowUserDialog] = useState(false)
  const [editingUser, setEditingUser] = useState(null)
  const [copiedPassword, setCopiedPassword] = useState(null)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")

  const [userFormData, setUserFormData] = useState({
    nombre: "",
    email: "",
    password: "",
    empresa: "",
    rol: "user",
    activo: true
  })

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      const usuariosSnapshot = await get(ref(database, "usuarios"))
      setUsuarios(usuariosSnapshot.val() || {})
    } catch (error) {
      console.error("Error al cargar datos:", error)
      setError("Error al cargar los usuarios")
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

  const resetUserForm = () => {
    setUserFormData({
      nombre: "",
      email: "",
      password: generatePassword(),
      empresa: "",
      rol: "user",
      activo: true
    })
    setEditingUser(null)
    setError("")
    setSuccess("")
  }

  const handleUserSubmit = async (e) => {
    e.preventDefault()
    setError("")
    setSuccess("")
    
    try {
      // Validar que el email no esté duplicado
      const usuariosArray = Object.values(usuarios)
      const emailExists = usuariosArray.some(u => 
        u.email.toLowerCase() === userFormData.email.toLowerCase() && 
        (!editingUser || u.id !== editingUser)
      )

      if (emailExists) {
        setError("Este email ya está registrado")
        return
      }

      const userData = {
        ...userFormData,
        fechaCreacion: new Date().toISOString(),
        creadoPor: user.email
      }

      if (editingUser) {
        await set(ref(database, `usuarios/${editingUser}`), userData)
        setSuccess("Usuario actualizado correctamente")
      } else {
        await push(ref(database, "usuarios"), userData)
        setSuccess("Usuario creado correctamente")
      }

      setShowUserDialog(false)
      resetUserForm()
      loadData()
    } catch (error) {
      console.error("Error al guardar usuario:", error)
      setError("Error al guardar el usuario")
    }
  }

  const handleEditUser = (id, userData) => {
    setEditingUser(id)
    setUserFormData({
      nombre: userData.nombre || "",
      email: userData.email || "",
      password: userData.password || "",
      empresa: userData.empresa || "",
      rol: userData.rol || "user",
      activo: userData.activo !== false
    })
    setShowUserDialog(true)
  }

  const handleDeleteUser = async (id) => {
    if (confirm("¿Estás seguro de eliminar este usuario?")) {
      try {
        await remove(ref(database, `usuarios/${id}`))
        setSuccess("Usuario eliminado correctamente")
        loadData()
      } catch (error) {
        console.error("Error al eliminar usuario:", error)
        setError("Error al eliminar el usuario")
      }
    }
  }

  const handleToggleUserStatus = async (id, userData) => {
    const newStatus = !userData.activo
    const statusText = newStatus ? "activado" : "desactivado"
    
    if (confirm(`¿Estás seguro de ${newStatus ? "activar" : "desactivar"} este usuario?`)) {
      try {
        await set(ref(database, `usuarios/${id}/activo`), newStatus)
        setSuccess(`Usuario ${statusText} correctamente`)
        loadData()
      } catch (error) {
        console.error("Error al cambiar estado del usuario:", error)
        setError("Error al cambiar el estado del usuario")
      }
    }
  }

  const copyPassword = async (password) => {
    try {
      await navigator.clipboard.writeText(password)
      setCopiedPassword(password)
      setTimeout(() => setCopiedPassword(null), 2000)
    } catch (error) {
      console.error("Error al copiar contraseña:", error)
    }
  }

  const usuariosArray = Object.entries(usuarios).map(([id, userData]) => ({
    id,
    ...userData,
  }))

  const usuariosActivos = usuariosArray.filter(user => user.activo !== false)
  const usuariosInactivos = usuariosArray.filter(user => user.activo === false)

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-card shadow-sm border-b border-border">
        <div className="max-w-7xl mx-auto px-4 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center space-x-4">
              <Crown className="h-8 w-8 text-yellow-500" />
              <div>
                <h1 className="text-2xl font-bold text-foreground">Panel Super Administrador</h1>
                <p className="text-sm text-muted-foreground">Gestión de usuarios del sistema</p>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <ThemeToggle />
              <Button variant="outline" onClick={onLogout}>
                <LogOut className="h-4 w-4 mr-2" />
                Cerrar Sesión
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 lg:px-8 py-8">
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
                    <p className="text-sm font-medium text-muted-foreground">Usuarios Inactivos</p>
                    <p className="text-2xl font-bold text-red-600">{usuariosInactivos.length}</p>
                  </div>
                  <UserX className="h-8 w-8 text-red-500" />
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-xl font-semibold">Gestión de Usuarios</h2>
              <p className="text-muted-foreground">Administra los usuarios del sistema</p>
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
                  
                  <div className="grid grid-cols-2 gap-4">
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
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="password">Contraseña</Label>
                      <div className="flex space-x-2">
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
                  <div className="grid grid-cols-2 gap-4">
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
                  <div className="flex justify-end space-x-2">
                    <Button type="button" variant="outline" onClick={() => setShowUserDialog(false)}>
                      Cancelar
                    </Button>
                    <Button type="submit">
                      {editingUser ? "Actualizar" : "Crear"} Usuario
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          </div>

          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nombre</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Empresa</TableHead>
                    <TableHead>Rol</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Contraseña</TableHead>
                    <TableHead>Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {usuariosArray.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                        No hay usuarios registrados
                      </TableCell>
                    </TableRow>
                  ) : (
                    usuariosArray.map((userData) => (
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
                            {userData.activo ? "Activo" : "Inactivo"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center space-x-2">
                            <span className="font-mono text-sm">••••••••</span>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => copyPassword(userData.password)}
                            >
                              {copiedPassword === userData.password ? (
                                <CheckCircle className="h-4 w-4 text-green-500" />
                              ) : (
                                <Copy className="h-4 w-4" />
                              )}
                            </Button>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex space-x-2">
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
                              title={userData.activo ? "Desactivar usuario" : "Activar usuario"}
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
                              onClick={() => handleDeleteUser(userData.id)}
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
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  )
} 