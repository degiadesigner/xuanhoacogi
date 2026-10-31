// Firebase Realtime Database Configuration
// Cấu hình Firebase Realtime Database cho XuanHoaCoGi
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getDatabase, ref, onValue, runTransaction, Database } from 'firebase/database';

export const BASE_SPIN_COUNT = 4230; // Khởi điểm chuẩn xác theo Cloudflare Analytics thực tế

export const firebaseConfig = {
  apiKey: import.meta.env?.VITE_FIREBASE_API_KEY || "AIzaSyCOiXc2W9oW6R-pycAyQl6iIe_LDCQezNw",
  authDomain: import.meta.env?.VITE_FIREBASE_AUTH_DOMAIN || "xuanhoacogi.firebaseapp.com",
  databaseURL: import.meta.env?.VITE_FIREBASE_DATABASE_URL || "https://xuanhoacogi-default-rtdb.firebaseio.com",
  projectId: import.meta.env?.VITE_FIREBASE_PROJECT_ID || "xuanhoacogi",
  storageBucket: import.meta.env?.VITE_FIREBASE_STORAGE_BUCKET || "xuanhoacogi.firebasestorage.app",
  messagingSenderId: import.meta.env?.VITE_FIREBASE_MESSAGING_SENDER_ID || "691215879950",
  appId: import.meta.env?.VITE_FIREBASE_APP_ID || "1:691215879950:web:0d94b3e8632096ee04d15f",
  measurementId: import.meta.env?.VITE_FIREBASE_MEASUREMENT_ID || "G-BTPWJCDMJR"
};

let db: Database | null = null;

export function getRealtimeDb(): Database | null {
  if (typeof window === 'undefined') return null;
  if (!firebaseConfig.databaseURL && !firebaseConfig.projectId) return null;
  
  try {
    if (!db) {
      const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
      db = getDatabase(app);
    }
    return db;
  } catch (err) {
    console.warn('Firebase init warning:', err);
    return null;
  }
}

export { ref, onValue, runTransaction };
