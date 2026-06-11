import { getDownloadURL, ref as storageRef, uploadBytes } from "firebase/storage"
import { storage } from "@/src/lib/firebase/client"

const sanitizeFileName = (fileName: string) =>
  fileName
    .trim()
    .replace(/\s+/g, "_")
    .replace(/[^a-zA-Z0-9._-]/g, "_")

export const uploadFileToStorage = async (storagePath: string, file: File): Promise<string> => {
  const fileRef = storageRef(storage, storagePath)
  const snapshot = await uploadBytes(fileRef, file)
  return getDownloadURL(snapshot.ref)
}

export const uploadInventoryProductImage = async (userId: string, file: File): Promise<string> => {
  const fileName = `${Date.now()}_${sanitizeFileName(file.name)}`
  return uploadFileToStorage(`productos/${userId}/${fileName}`, file)
}

export const uploadStoreProductImage = async (userId: string, file: File): Promise<string> => {
  const fileName = `${Date.now()}_${sanitizeFileName(file.name)}`
  return uploadFileToStorage(`tienda/${userId}/${fileName}`, file)
}

export const uploadStoreLogo = async (userId: string, file: File): Promise<string> => {
  const fileName = `${Date.now()}_${sanitizeFileName(file.name)}`
  return uploadFileToStorage(`tienda/${userId}/logo/${fileName}`, file)
}
