import { deleteObject, getDownloadURL, ref as storageRef, uploadBytes } from "firebase/storage"
import { optimizeImage, isSupportedProductImageFile } from "@/src/lib/images/optimizeImage"
import { storage } from "@/src/lib/firebase/client"

export interface UploadedFileAsset {
  url: string
  path: string
}

export interface UploadedProductImagePair extends UploadedFileAsset {
  thumbUrl: string
  thumbPath: string
  imageUpdatedAt: string
}

export interface UploadOptimizedProductImageOptions {
  existingImagePath?: string
  existingThumbPath?: string
  onStatusChange?: (status: string) => void
}

const sanitizeFileName = (fileName: string) =>
  fileName
    .trim()
    .replace(/\s+/g, "_")
    .replace(/[^a-zA-Z0-9._-]/g, "_")

const uploadBlobToStorage = async (storagePath: string, blob: Blob, contentType: string): Promise<UploadedFileAsset> => {
  const fileRef = storageRef(storage, storagePath)
  const snapshot = await uploadBytes(fileRef, blob, { contentType })
  const url = await getDownloadURL(snapshot.ref)
  return { url, path: storagePath }
}

const deleteStoragePath = async (storagePath?: string) => {
  if (!storagePath) {
    return
  }

  try {
    await deleteObject(storageRef(storage, storagePath))
  } catch (error) {
    console.error("No se pudo borrar un archivo viejo de Storage:", error)
  }
}

const deleteStoragePathIfDifferent = async (existingPath?: string, nextPath?: string) => {
  if (!existingPath || !nextPath || existingPath === nextPath) {
    return
  }

  await deleteStoragePath(existingPath)
}

export const uploadFileToStorage = async (storagePath: string, file: File): Promise<UploadedFileAsset> => {
  const fileRef = storageRef(storage, storagePath)
  const snapshot = await uploadBytes(fileRef, file)
  const url = await getDownloadURL(snapshot.ref)
  return { url, path: storagePath }
}

export const uploadInventoryProductImage = async (userId: string, file: File): Promise<string> => {
  const fileName = `${Date.now()}_${sanitizeFileName(file.name)}`
  const asset = await uploadFileToStorage(`productos/${userId}/${fileName}`, file)
  return asset.url
}

export const uploadInventoryProductImageDetailed = async (userId: string, file: File): Promise<UploadedFileAsset> => {
  const fileName = `${Date.now()}_${sanitizeFileName(file.name)}`
  return uploadFileToStorage(`productos/${userId}/${fileName}`, file)
}

export const uploadOptimizedProductImagePair = async (
  businessId: string,
  productId: string,
  file: File,
  options: UploadOptimizedProductImageOptions = {},
): Promise<UploadedProductImagePair> => {
  if (!businessId || !productId) {
    throw new Error("Falta el negocio o el producto para subir la imagen")
  }

  if (!isSupportedProductImageFile(file)) {
    throw new Error("Formato de imagen no soportado")
  }

  options.onStatusChange?.("Optimizando imagen...")

  const [mainImage, thumbImage] = await Promise.all([
    optimizeImage(file, { maxWidth: 1200, maxHeight: 1200, quality: 0.8 }),
    optimizeImage(file, { maxWidth: 400, maxHeight: 400, quality: 0.75 }),
  ])

  options.onStatusChange?.("Subiendo imagen...")

  const mainPath = `businesses/${businessId}/products/${productId}/main.webp`
  const thumbPath = `businesses/${businessId}/products/${productId}/thumb.webp`

  const [mainAsset, thumbAsset] = await Promise.all([
    uploadBlobToStorage(mainPath, mainImage.blob, mainImage.mimeType),
    uploadBlobToStorage(thumbPath, thumbImage.blob, thumbImage.mimeType),
  ])

  await Promise.allSettled([
    deleteStoragePathIfDifferent(options.existingImagePath, mainPath),
    deleteStoragePathIfDifferent(options.existingThumbPath, thumbPath),
  ])

  return {
    ...mainAsset,
    thumbUrl: thumbAsset.url,
    thumbPath: thumbAsset.path,
    imageUpdatedAt: new Date().toISOString(),
  }
}

export const deleteProductImageAssets = async (imagePath?: string, thumbPath?: string) => {
  await Promise.allSettled([deleteStoragePath(imagePath), deleteStoragePath(thumbPath)])
}

export const uploadStoreProductImage = async (userId: string, file: File): Promise<string> => {
  const fileName = `${Date.now()}_${sanitizeFileName(file.name)}`
  const asset = await uploadFileToStorage(`tienda/${userId}/${fileName}`, file)
  return asset.url
}

export const uploadStoreLogo = async (userId: string, file: File): Promise<string> => {
  const fileName = `${Date.now()}_${sanitizeFileName(file.name)}`
  const asset = await uploadFileToStorage(`tienda/${userId}/logo/${fileName}`, file)
  return asset.url
}
