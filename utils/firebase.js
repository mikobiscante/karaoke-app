// utils/firebase.js
import { initializeApp, getApps } from "firebase/app";
import { getDatabase } from "firebase/database";

// Client-only imports are not executed at module load
let getAuthModule = null;
let getAnalyticsModule = null;

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "",
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "",
  databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL || "",
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID || ""
};

let app;
if (!getApps().length) {
  app = initializeApp(firebaseConfig);
} else {
  app = getApps()[0];
}

// Realtime Database is safe to export for server and client
export const db = getDatabase(app);

// Lazy client-only auth and analytics instances
let authInstance = null;
let analyticsInstance = null;

/**
 * Initialize and return Firebase Auth (client only).
 * Call this from components or client-side code only.
 */
export const initAuth = async () => {
  if (typeof window === "undefined") return null;
  if (authInstance) return authInstance;
  try {
    if (!getAuthModule) getAuthModule = await import("firebase/auth");
    authInstance = getAuthModule.getAuth(app);
    return authInstance;
  } catch (err) {
    console.warn("initAuth failed:", err);
    return null;
  }
};

/**
 * Initialize and return Firebase Analytics (client only).
 * Call this from components or client-side code only.
 */
export const initAnalytics = async () => {
  if (typeof window === "undefined") return null;
  if (!firebaseConfig.measurementId) return null;
  if (analyticsInstance) return analyticsInstance;
  try {
    if (!getAnalyticsModule) getAnalyticsModule = await import("firebase/analytics");
    analyticsInstance = getAnalyticsModule.getAnalytics(app);
    return analyticsInstance;
  } catch (err) {
    console.warn("initAnalytics failed:", err);
    return null;
  }
};

export const getAnalyticsInstance = () => analyticsInstance;
