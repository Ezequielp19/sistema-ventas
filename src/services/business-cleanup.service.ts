import { remove, ref } from "firebase/database"
import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  limit,
  query,
  writeBatch,
  type CollectionReference,
  type DocumentData,
} from "firebase/firestore"
import { database, firestore } from "@/src/lib/firebase/client"
import { invalidateBusinessCache } from "@/src/lib/business-cache"

const FIRESTORE_BATCH_SIZE = 400

const getBusinessCollectionRef = (businessId: string, collectionName: string) =>
  collection(firestore, "businesses", businessId, collectionName)

const deleteCollectionInBatches = async (collectionRef: CollectionReference<DocumentData>) => {
  let deletedCount = 0

  while (true) {
    const snapshot = await getDocs(query(collectionRef, limit(FIRESTORE_BATCH_SIZE)))

    if (snapshot.empty) {
      break
    }

    const batch = writeBatch(firestore)
    snapshot.docs.forEach((documentSnapshot) => {
      batch.delete(documentSnapshot.ref)
    })

    await batch.commit()
    deletedCount += snapshot.size

    if (snapshot.size < FIRESTORE_BATCH_SIZE) {
      break
    }
  }

  return deletedCount
}

export type BusinessCleanupResult = {
  businessId: string
  firestore: Record<string, number>
  legacyPaths: string[]
}

export const deleteBusinessClientData = async (businessId: string): Promise<BusinessCleanupResult> => {
  if (!businessId) {
    throw new Error("Falta el negocio para eliminar")
  }

  const firestoreCollections = ["products", "providers", "sales", "storeConfig"]
  const firestoreDeleted: Record<string, number> = {}

  for (const collectionName of firestoreCollections) {
    firestoreDeleted[collectionName] = await deleteCollectionInBatches(getBusinessCollectionRef(businessId, collectionName))
  }

  await deleteDoc(doc(firestore, "businesses", businessId))

  const legacyPaths = [`usuarios/${businessId}`, `tiendas/${businessId}`]
  await Promise.all(legacyPaths.map((path) => remove(ref(database, path))))

  invalidateBusinessCache(businessId)

  return {
    businessId,
    firestore: firestoreDeleted,
    legacyPaths,
  }
}
