export type ProductRecord = Record<string, any>

export interface ProductFormValues {
  nombre: string
  descripcion: string
  precioVenta: string | number
  stock: string | number
  stockMinimo: string | number
  proveedor: string
  tipo: string
  codigo: string
}

export interface InventoryProductOptions {
  imageUrl?: string
  visibleEnTienda?: boolean
}

const toNumber = (value: unknown, fallback = 0) => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value
  }

  if (typeof value === "string" && value.trim() !== "") {
    const parsedValue = Number(value)
    return Number.isFinite(parsedValue) ? parsedValue : fallback
  }

  const parsedValue = Number(value)
  return Number.isFinite(parsedValue) ? parsedValue : fallback
}

export const normalizeCatalogProduct = (product: ProductRecord = {}, id?: string) => {
  const precio = toNumber(product.precio ?? product.precioVenta ?? 0)
  const stock = toNumber(product.stock ?? 0)
  const rawStockMinimo = product.stockMinimo ?? product.stock_minimo
  const stockMinimo =
    rawStockMinimo === undefined || rawStockMinimo === null || rawStockMinimo === ""
      ? undefined
      : toNumber(rawStockMinimo)
  const categoria =
    typeof product.categoria === "string" && product.categoria.trim()
      ? product.categoria
      : typeof product.tipo === "string"
        ? product.tipo
        : ""
  const imagenes = Array.isArray(product.imagenes)
    ? product.imagenes.filter((image: unknown): image is string => typeof image === "string" && image.trim() !== "")
    : []
  const imagen =
    typeof product.imagen === "string" && product.imagen.trim()
      ? product.imagen
      : imagenes[0] || ""

  return {
    ...product,
    id: id ?? product.id,
    nombre: product.nombre ?? "",
    descripcion: product.descripcion ?? "",
    precio,
    precioVenta: toNumber(product.precioVenta ?? precio),
    stock,
    ...(stockMinimo !== undefined ? { stockMinimo } : {}),
    proveedor: product.proveedor ?? "",
    tipo: product.tipo ?? categoria,
    categoria,
    codigo: product.codigo ?? "",
    imagen,
    imagenes: imagenes.length > 0 ? imagenes : imagen ? [imagen] : [],
    destacado: product.destacado,
    activo: product.activo,
    visibleEnTienda: product.visibleEnTienda,
    fechaCreacion: product.fechaCreacion,
    fechaActualizacion: product.fechaActualizacion,
    usuarioId: product.usuarioId,
    tiendaId: product.tiendaId,
  }
}

export const normalizeProductCollection = (products: Record<string, ProductRecord> = {}) => {
  return Object.entries(products).reduce<Record<string, ReturnType<typeof normalizeCatalogProduct>>>(
    (accumulator, [id, product]) => {
      accumulator[id] = normalizeCatalogProduct(product, id)
      return accumulator
    },
    {},
  )
}

export const buildInventoryProductRecord = (
  formData: ProductFormValues,
  productId: string,
  userId: string,
  existingProduct: ProductRecord = {},
  options: InventoryProductOptions = {},
) => {
  const precioVenta = toNumber(formData.precioVenta)
  const stock = toNumber(formData.stock)
  const stockMinimo = toNumber(formData.stockMinimo)
  const now = new Date().toISOString()
  const normalizedExistingProduct = normalizeCatalogProduct(existingProduct, productId)
  const imageUrl = options.imageUrl ?? normalizedExistingProduct.imagen ?? ""
  const visibleEnTienda = options.visibleEnTienda ?? normalizedExistingProduct.visibleEnTienda ?? true
  const imagenes = imageUrl
    ? [imageUrl]
    : Array.isArray(normalizedExistingProduct.imagenes)
      ? normalizedExistingProduct.imagenes
      : []

  return {
    ...existingProduct,
    id: productId,
    nombre: formData.nombre.trim(),
    descripcion: formData.descripcion.trim(),
    precioVenta,
    precio: precioVenta,
    stock,
    stockMinimo,
    proveedor: formData.proveedor,
    tipo: formData.tipo,
    categoria: formData.tipo,
    codigo: formData.codigo,
    imagen: imageUrl,
    imagenes,
    destacado: normalizedExistingProduct.destacado ?? false,
    activo: normalizedExistingProduct.activo !== undefined ? normalizedExistingProduct.activo : true,
    visibleEnTienda,
    fechaCreacion: normalizedExistingProduct.fechaCreacion || now,
    fechaActualizacion: now,
    usuarioId: userId,
    tiendaId: userId,
  }
}

export const mergePublicCatalogCollections = (
  inventoryProducts: Record<string, ProductRecord> = {},
  storeProducts: Record<string, ProductRecord> = {},
) => {
  const mergedProducts = normalizeProductCollection(storeProducts)
  const normalizedInventoryProducts = normalizeProductCollection(inventoryProducts)

  for (const [id, inventoryProduct] of Object.entries(normalizedInventoryProducts)) {
    const storeProduct = mergedProducts[id] || {}

    mergedProducts[id] = {
      ...storeProduct,
      ...inventoryProduct,
      precio: inventoryProduct.precio ?? storeProduct.precio ?? 0,
      precioVenta: inventoryProduct.precioVenta ?? storeProduct.precioVenta ?? inventoryProduct.precio ?? 0,
      stock: inventoryProduct.stock ?? storeProduct.stock ?? 0,
      stockMinimo: inventoryProduct.stockMinimo ?? storeProduct.stockMinimo,
      nombre: inventoryProduct.nombre || storeProduct.nombre || "",
      descripcion: inventoryProduct.descripcion || storeProduct.descripcion || "",
      categoria: inventoryProduct.categoria || inventoryProduct.tipo || storeProduct.categoria || "",
      imagen:
        inventoryProduct.imagen ||
        inventoryProduct.imagenes?.[0] ||
        storeProduct.imagen ||
        storeProduct.imagenes?.[0] ||
        "",
      imagenes:
        (Array.isArray(inventoryProduct.imagenes) && inventoryProduct.imagenes.length > 0
          ? inventoryProduct.imagenes
          : Array.isArray(storeProduct.imagenes)
            ? storeProduct.imagenes
            : []),
      destacado:
        inventoryProduct.destacado !== undefined
          ? inventoryProduct.destacado
          : storeProduct.destacado ?? false,
      activo:
        inventoryProduct.activo !== undefined
          ? inventoryProduct.activo
          : storeProduct.activo !== false,
      visibleEnTienda:
        inventoryProduct.visibleEnTienda !== undefined
          ? inventoryProduct.visibleEnTienda
          : storeProduct.visibleEnTienda !== false,
      codigo: inventoryProduct.codigo || storeProduct.codigo || "",
      proveedor: inventoryProduct.proveedor || storeProduct.proveedor || "",
      tipo: inventoryProduct.tipo || storeProduct.tipo || "",
      usuarioId: inventoryProduct.usuarioId || storeProduct.usuarioId,
      tiendaId: inventoryProduct.tiendaId || storeProduct.tiendaId,
    }
  }

  return mergedProducts
}
