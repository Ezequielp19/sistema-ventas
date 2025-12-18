// Tipos para el sistema de ventas

export interface Producto {
  id?: string
  nombre: string
  descripcion?: string
  precio?: number
  precioVenta?: number
  stock: number
  stockMinimo: number
  proveedor?: string
  tipo?: string
  codigo?: string
  imagen?: string
  fechaCreacion?: string
}

export interface Proveedor {
  id?: string
  nombre: string
  contacto?: string
  telefono?: string
  email?: string
  direccion?: string
}

export interface Venta {
  id?: string
  fecha: string | Date
  cliente: string
  items?: VentaItem[]
  pagos?: Pago[]
  metodoPago?: string
  total: number
}

export interface VentaItem {
  id: string
  nombre: string
  precio: number
  cantidad: number
  stockDisponible?: number
}

export interface Pago {
  metodo: string
  monto: number | string
}

export interface Usuario {
  id?: string
  nombre: string
  email: string
  password: string
  empresa?: string
  rol: 'user' | 'admin' | 'super_admin'
  activo: boolean
  fechaCreacion?: string
  creadoPor?: string
}

export interface Empresa {
  id?: string
  nombre: string
  plan?: string
  fechaCreacion?: string
}

// Tipos para exportación
export type ExportDataType = 'ventas' | 'productos' | 'proveedores' | 'stock' | 'reportes'

export interface ExportData {
  ventas?: Venta[]
  productos?: Producto[]
  proveedores?: Proveedor[]
  stock?: Producto[]
  reportes?: any[]
} 