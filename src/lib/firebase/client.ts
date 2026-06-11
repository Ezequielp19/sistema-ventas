import { getApp, getApps, initializeApp, type FirebaseApp } from "firebase/app"
import { getAuth } from "firebase/auth"
import { getFirestore } from "firebase/firestore"
import { getDatabase } from "firebase/database"
import { getStorage } from "firebase/storage"

export const firebaseConfig = {
  apiKey: "AIzaSyB3BHHh94t_WmyUHFvzIlmfRUW3tHq2XC0",
  authDomain: "project-2be81f90-7132-4b3f-ac0.firebaseapp.com",
  projectId: "project-2be81f90-7132-4b3f-ac0",
  storageBucket: "project-2be81f90-7132-4b3f-ac0.firebasestorage.app",
  messagingSenderId: "602477706615",
  appId: "1:602477706615:web:2247a85babee7a3f2e7572",
  measurementId: "G-6DVFNCLNTR"
}

export const app: FirebaseApp = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig)
export const auth = getAuth(app)
export const firestore = getFirestore(app)
export const database = getDatabase(app)
export const storage = getStorage(app)
