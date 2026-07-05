// utils/firebase.js
import { initializeApp, getApps } from "firebase/app";
import { getDatabase } from "firebase/database";
import { getAuth } from "firebase/auth"; // if you use auth

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "",
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "",
  databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL || "",
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID || "" // GA4 measurement id
};

let app;
if (!getApps().length) {
  app = initializeApp(firebaseConfig);
} else {
  app = getApps()[0];
}

export const db = getDatabase(app);
export const auth = getAuth ? getAuth(app) : null;

// Analytics: initialize only on client and only if measurementId is present
let analytics = null;
export const initAnalytics = async () => {
  if (typeof window === "undefined") return null;
  if (!firebaseConfig.measurementId) return null;
  if (analytics) return analytics;
  try {
    const analyticsModule = await import("firebase/analytics");
    analytics = analyticsModule.getAnalytics(app);
    return analytics;
  } catch (err) {
    console.warn("Firebase analytics init failed:", err);
    return null;
  }
};

export const getAnalyticsInstance = () => analytics;
