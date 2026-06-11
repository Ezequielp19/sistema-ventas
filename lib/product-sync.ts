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

const toBoolean = (value: unknown, fallback = false) => {
  if (typeof value === "boolean") {
    return value
  }

  if (typeof value === "number") {
    return value !== 0
  }

  if (typeof value === "string") {
    const normalizedValue = value.trim().toLowerCase()
    if (["true", "1", "yes", "si"].includes(normalizedValue)) {
      return true
    }
    if (["false", "0", "no"].includes(normalizedValue)) {
      return false
    }
  }

  return fallback
}

const isPlainObject = (value: unknown): value is Record<string, unknown> => {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

export const sanitizeFirestoreData = <T>(value: T): T => {
  if (Array.isArray(value)) {
    return value
      .map((item) => sanitizeFirestoreData(item))
      .filter((item) => item !== undefined) as T
  }

  if (isPlainObject(value)) {
    return Object.entries(value).reduce<Record<string, unknown>>((accumulator, [key, item]) => {
      if (item === undefined) {
        return accumulator
      }

      if (typeof item === "number" && !Number.isFinite(item)) {
        accumulator[key] = 0
        return accumulator
      }

      accumulator[key] = sanitizeFirestoreData(item)
      return accumulator
    }, {}) as T
  }

  if (typeof value === "number" && !Number.isFinite(value)) {
    return 0 as T
  }

  return value
}

const getPrimaryImage = (product: ProductRecord = {}) => {
  const imageCandidates = [
    product.imageUrl,
    product.thumbUrl,
    product.imagen,
    Array.isArray(product.imagenes) ? product.imagenes[0] : "",
  ]

  return imageCandidates.find((image) => typeof image === "string" && image.trim() !== "") ?? ""
}

export const normalizeCatalogProduct = (product: ProductRecord = {}, id?: string) => {
  const name = toStringValue(product.name ?? product.nombre)
  const description = toStringValue(product.description ?? product.descripcion)
  const salePrice = toNumber(product.salePrice ?? product.precioVenta ?? product.precio ?? 0)
  const costPrice = toNumber(product.costPrice ?? product.precioCompra ?? 0)
  const stock = toNumber(product.stock ?? 0)
  const rawMinStock = product.minStock ?? product.stockMinimo ?? product.stock_minimo
  const minStock = rawMinStock === undefined || rawMinStock === null || rawMinStock === "" ? 0 : toNumber(rawMinStock)
  const category = toStringValue(product.category ?? product.categoria ?? product.tipo)
  const type = toStringValue(product.type ?? product.tipo ?? category)
  const code = toStringValue(product.code ?? product.codigo)
  const providerId = toStringValue(product.providerId ?? product.proveedor)
  const providerName = toStringValue(product.providerName ?? product.proveedorNombre)
  const imageUrl = getPrimaryImage(product)
  const thumbUrl = toStringValue(product.thumbUrl ?? imageUrl)
  const imagePath = toStringValue(product.imagePath)
  const thumbPath = toStringValue(product.thumbPath)
  const visibleInStore = toBoolean(product.visibleInStore ?? product.visibleEnTienda, true)
  const active = toBoolean(product.active ?? product.activo, true)
  const featured = toBoolean(product.featured ?? product.destacado, false)
  const createdAt = toStringValue(product.createdAt ?? product.fechaCreacion)
  const updatedAt = toStringValue(product.updatedAt ?? product.fechaActualizacion ?? createdAt)
  const nameLower = toStringValue(product.nameLower ?? name.toLowerCase())
  const isLowStock =
    product.isLowStock !== undefined && product.isLowStock !== null
      ? toBoolean(product.isLowStock)
      : stock <= minStock
  const imagenes = Array.isArray(product.imagenes)
    ? product.imagenes.filter((image: unknown): image is string => typeof image === "string" && image.trim() !== "")
    : imageUrl
      ? [imageUrl]
      : []

  return {
    ...product,
    id: id ?? product.id,
    code,
    codigo: code,
    name,
    nombre: name,
    nameLower,
    description,
    descripcion: description,
    category,
    categoria: category,
    type,
    tipo: type,
    salePrice,
    price: salePrice,
    precio: salePrice,
    precioVenta: salePrice,
    costPrice,
    stock,
    minStock,
    stockMinimo: minStock,
    isLowStock,
    providerId,
    proveedor: providerId,
    providerName,
    proveedorNombre: providerName,
    imageUrl,
    thumbUrl,
    imagePath,
    thumbPath,
    imagen: imageUrl,
    imagenes,
    visibleInStore,
    visibleEnTienda: visibleInStore,
    active,
    activo: active,
    featured,
    destacado: featured,
    createdAt,
    fechaCreacion: createdAt,
    updatedAt,
    fechaActualizacion: updatedAt,
    usuarioId: toStringValue(product.usuarioId ?? product.businessId),
    tiendaId: toStringValue(product.tiendaId ?? product.businessId),
    businessId: toStringValue(product.businessId ?? product.usuarioId ?? product.tiendaId),
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
  const salePrice = toNumber(formData.precioVenta)
  const stock = toNumber(formData.stock)
  const minStock = toNumber(formData.stockMinimo)
  const now = new Date().toISOString()
  const normalizedExistingProduct = normalizeCatalogProduct(existingProduct, productId)
  const name = formData.nombre.trim()
  const category = formData.tipo.trim()
  const code = formData.codigo.trim()
  const imageUrl = options.imageUrl ?? normalizedExistingProduct.imageUrl ?? normalizedExistingProduct.imagen ?? ""
  const visibleEnTienda = options.visibleEnTienda ?? normalizedExistingProduct.visibleEnTienda ?? true
  const imagenes = imageUrl
    ? [imageUrl]
    : Array.isArray(normalizedExistingProduct.imagenes)
      ? normalizedExistingProduct.imagenes
      : []
  const isLowStock = stock <= minStock

  return {
    ...existingProduct,
    id: productId,
    code,
    codigo: code,
    name,
    nombre: name,
    nameLower: name.toLowerCase(),
    description: formData.descripcion.trim(),
    descripcion: formData.descripcion.trim(),
    category,
    categoria: category,
    type: category,
    tipo: category,
    salePrice,
    price: salePrice,
    precioVenta: salePrice,
    precio: salePrice,
    costPrice: toNumber(existingProduct.costPrice ?? existingProduct.precioCompra ?? 0),
    stock,
    minStock,
    stockMinimo: minStock,
    isLowStock,
    providerId: formData.proveedor,
    proveedor: formData.proveedor,
    providerName: normalizedExistingProduct.providerName ?? "",
    proveedorNombre: normalizedExistingProduct.providerName ?? "",
    imageUrl,
    thumbUrl: imageUrl,
    imagePath: normalizedExistingProduct.imagePath ?? "",
    thumbPath: normalizedExistingProduct.thumbPath ?? "",
    imagen: imageUrl,
    imagenes,
    featured: normalizedExistingProduct.featured !== undefined ? normalizedExistingProduct.featured : false,
    destacado: normalizedExistingProduct.destacado !== undefined ? normalizedExistingProduct.destacado : false,
    active: normalizedExistingProduct.active !== undefined ? normalizedExistingProduct.active : true,
    activo: normalizedExistingProduct.activo !== undefined ? normalizedExistingProduct.activo : true,
    visibleInStore: visibleEnTienda,
    visibleEnTienda,
    createdAt: normalizedExistingProduct.createdAt || now,
    fechaCreacion: normalizedExistingProduct.fechaCreacion || now,
    updatedAt: now,
    fechaActualizacion: now,
    usuarioId: userId,
    tiendaId: userId,
    businessId: userId,
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
    const salePrice = toNumber(
      inventoryProduct.salePrice ??
        inventoryProduct.precioVenta ??
        inventoryProduct.precio ??
        storeProduct.salePrice ??
        storeProduct.precioVenta ??
        storeProduct.precio ??
        0,
    )
    const costPrice = toNumber(inventoryProduct.costPrice ?? storeProduct.costPrice ?? 0)
    const stock = toNumber(inventoryProduct.stock ?? storeProduct.stock ?? 0)
    const minStockValue =
      inventoryProduct.minStock ??
      inventoryProduct.stockMinimo ??
      storeProduct.minStock ??
      storeProduct.stockMinimo
    const minStock = minStockValue === undefined || minStockValue === null ? 0 : toNumber(minStockValue)
    const imageUrl =
      inventoryProduct.imageUrl ||
      inventoryProduct.thumbUrl ||
      inventoryProduct.imagen ||
      storeProduct.imageUrl ||
      storeProduct.thumbUrl ||
      storeProduct.imagen ||
      ""
    const thumbUrl = inventoryProduct.thumbUrl || storeProduct.thumbUrl || imageUrl
    const visibleInStore =
      inventoryProduct.visibleInStore !== undefined
        ? inventoryProduct.visibleInStore
        : storeProduct.visibleInStore !== undefined
          ? storeProduct.visibleInStore
          : storeProduct.visibleEnTienda ?? false
    const active =
      inventoryProduct.active !== undefined
        ? inventoryProduct.active
        : storeProduct.active !== undefined
          ? storeProduct.active
          : storeProduct.activo ?? true
    const createdAt =
      inventoryProduct.createdAt ||
      storeProduct.createdAt ||
      inventoryProduct.fechaCreacion ||
      storeProduct.fechaCreacion ||
      ""
    const updatedAt =
      inventoryProduct.updatedAt ||
      storeProduct.updatedAt ||
      inventoryProduct.fechaActualizacion ||
      storeProduct.fechaActualizacion ||
      createdAt
    const name = inventoryProduct.name || storeProduct.name || ""
    const description = inventoryProduct.description || storeProduct.description || ""
    const category = inventoryProduct.category || inventoryProduct.tipo || storeProduct.category || storeProduct.tipo || ""
    const type = inventoryProduct.type || storeProduct.type || category
    const providerId =
      inventoryProduct.providerId || inventoryProduct.proveedor || storeProduct.providerId || storeProduct.proveedor || ""
    const providerName =
      inventoryProduct.providerName ||
      storeProduct.providerName ||
      storeProduct.proveedorNombre ||
      ""
    const code = inventoryProduct.code || storeProduct.code || ""
    const imagenes =
      Array.isArray(inventoryProduct.imagenes) && inventoryProduct.imagenes.length > 0
        ? inventoryProduct.imagenes
        : Array.isArray(storeProduct.imagenes) && storeProduct.imagenes.length > 0
          ? storeProduct.imagenes
          : imageUrl
            ? [imageUrl]
            : []

    mergedProducts[id] = {
      ...storeProduct,
      ...inventoryProduct,
      code,
      codigo: code,
      name,
      nombre: name,
      nameLower: inventoryProduct.nameLower || name.toLowerCase(),
      description,
      descripcion: description,
      category,
      categoria: category,
      type,
      tipo: type,
      salePrice,
      price: salePrice,
      precio: salePrice,
      precioVenta: salePrice,
      costPrice,
      stock,
      minStock: minStock ?? 0,
      stockMinimo: minStock,
      isLowStock:
        inventoryProduct.isLowStock !== undefined
          ? inventoryProduct.isLowStock
          : stock <= minStock,
      providerId,
      proveedor: providerId,
      providerName,
      proveedorNombre: providerName,
      imageUrl,
      thumbUrl,
      imagePath: inventoryProduct.imagePath || storeProduct.imagePath || "",
      thumbPath: inventoryProduct.thumbPath || storeProduct.thumbPath || "",
      imagen: imageUrl,
      imagenes,
      active,
      activo: active,
      visibleInStore,
      visibleEnTienda: visibleInStore,
      createdAt,
      fechaCreacion: createdAt,
      updatedAt,
      fechaActualizacion: updatedAt,
      featured:
        inventoryProduct.featured !== undefined
          ? inventoryProduct.featured
          : storeProduct.featured ?? false,
      destacado:
        inventoryProduct.destacado !== undefined
          ? inventoryProduct.destacado
          : storeProduct.destacado ?? false,
      usuarioId: inventoryProduct.usuarioId || storeProduct.usuarioId || "",
      tiendaId: inventoryProduct.tiendaId || storeProduct.tiendaId || "",
      businessId:
        inventoryProduct.businessId ||
        storeProduct.businessId ||
        inventoryProduct.usuarioId ||
        storeProduct.usuarioId ||
        "",
    }
  }

  return mergedProducts
}
