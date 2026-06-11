import { get, push, ref, remove, set } from "firebase/database"
import { database } from "@/src/lib/firebase/client"
import { bulkUpdateProducts, type ProductCollection, type ProductRecord } from "@/src/services/products.service"

export type SaleRecord = Record<string, any>
export type SaleCollection = Record<string, SaleRecord>
export type InvoiceRecord = Record<string, any>
export type InvoiceCollection = Record<string, InvoiceRecord>

const getSalesPath = (userId: string) => `usuarios/${userId}/ventas`
const getInvoicesPath = (userId: string) => `usuarios/${userId}/facturas`

const readCollection = async <T extends Record<string, any>>(path: string): Promise<T> => {
  if (!path) {
    return {} as T
  }

  const snapshot = await get(ref(database, path))
  return snapshot.exists() ? (snapshot.val() as T) : ({} as T)
}

export const loadSales = async (userId: string): Promise<SaleCollection> => {
  if (!userId) {
    return {}
  }

  return readCollection<SaleCollection>(getSalesPath(userId))
}

export const loadInvoices = async (userId: string): Promise<InvoiceCollection> => {
  if (!userId) {
    return {}
  }

  return readCollection<InvoiceCollection>(getInvoicesPath(userId))
}

export const createSale = async (userId: string, saleData: SaleRecord): Promise<string> => {
  if (!userId) {
    return ""
  }

  const saleRef = push(ref(database, getSalesPath(userId)))
  await set(saleRef, saleData)
  return saleRef.key ?? ""
}

export const processSale = async (
  userId: string,
  saleData: SaleRecord,
  products: ProductCollection,
): Promise<string> => {
  const saleId = await createSale(userId, saleData)

  const stockUpdates: Record<string, Partial<ProductRecord>> = {}
  ;(saleData.items || []).forEach((item: any) => {
    const currentStock = Number(products[item.id]?.stock ?? 0)
    const quantity = Number(item.cantidad ?? 0)
    stockUpdates[item.id] = {
      stock: Math.max(0, currentStock - quantity),
      fechaActualizacion: new Date().toISOString(),
    }
  })

  await bulkUpdateProducts(userId, stockUpdates)
  return saleId
}

export const restoreSaleStock = async (
  userId: string,
  sale: SaleRecord,
  products: ProductCollection,
): Promise<void> => {
  const stockUpdates: Record<string, Partial<ProductRecord>> = {}

  ;(sale.items || []).forEach((item: any) => {
    const currentStock = Number(products[item.id]?.stock ?? 0)
    const quantity = Number(item.cantidad ?? 0)
    stockUpdates[item.id] = {
      stock: currentStock + quantity,
      fechaActualizacion: new Date().toISOString(),
    }
  })

  await bulkUpdateProducts(userId, stockUpdates)
}

export const deleteSale = async (userId: string, saleId: string): Promise<void> => {
  if (!userId || !saleId) {
    return
  }

  await remove(ref(database, `${getSalesPath(userId)}/${saleId}`))
}

export const deleteSaleAndRestoreStock = async (
  userId: string,
  saleId: string,
  sale: SaleRecord,
  products: ProductCollection,
): Promise<void> => {
  await restoreSaleStock(userId, sale, products)
  await deleteSale(userId, saleId)
}

export const createInvoice = async (userId: string, invoiceData: InvoiceRecord): Promise<string> => {
  if (!userId) {
    return ""
  }

  const invoiceRef = push(ref(database, getInvoicesPath(userId)))
  await set(invoiceRef, invoiceData)
  return invoiceRef.key ?? ""
}

export const deleteInvoice = async (userId: string, invoiceId: string): Promise<void> => {
  if (!userId || !invoiceId) {
    return
  }

  await remove(ref(database, `${getInvoicesPath(userId)}/${invoiceId}`))
}
