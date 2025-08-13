import { initializeApp } from "firebase/app"
import { getAuth } from "firebase/auth"
import { getDatabase } from "firebase/database"
import { getStorage } from "firebase/storage"

const firebaseConfig = {
  apiKey: "AIzaSyCpGByP4yV91k0hm3TZX8P3NHQUuckNumw",
  authDomain: "app-servicios-e99de.firebaseapp.com",
  projectId: "app-servicios-e99de",
  storageBucket: "app-servicios-e99de.appspot.com",
  messagingSenderId: "281743607632",
  appId: "1:281743607632:web:11509479f18726330e0e55",
  measurementId: "G-0CTZQ2JPY2",
}

const app = initializeApp(firebaseConfig)
export const auth = getAuth(app)
export const database = getDatabase(app)
export const storage = getStorage(app)
