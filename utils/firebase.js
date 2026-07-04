// utils/firebase.js
// SSR-safe Firebase v9 modular initializer (no analytics at module load)

import { initializeApp, getApps } from "firebase/app";
import { getDatabase } from "firebase/database";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "",
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "",
  databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL || ""
};

let app;
if (!getApps().length) {
  app = initializeApp(firebaseConfig);
  console.log('NEXT_PUBLIC_FIREBASE_DATABASE_URL (server) 1:', process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL);

} else {
  app = getApps()[0];
  console.log('NEXT_PUBLIC_FIREBASE_DATABASE_URL (server) 2:', process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL);

}

export const db = getDatabase(app);

console.log('NEXT_PUBLIC_FIREBASE_DATABASE_URL (server) 3:', process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL);

