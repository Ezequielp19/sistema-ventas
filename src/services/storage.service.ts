import { getDownloadURL, ref as storageRef, uploadBytes } from "firebase/storage"
import { storage } from "@/src/lib/firebase/client"

export interface UploadedFileAsset {
  url: string
  path: string
}

const sanitizeFileName = (fileName: string) =>
  fileName
    .trim()
    .replace(/\s+/g, "_")
    .replace(/[^a-zA-Z0-9._-]/g, "_")

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
