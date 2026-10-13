// Firebase Realtime Database Configuration
// Cấu hình Firebase Realtime Database cho XuanHoaCoGi
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getDatabase, ref, onValue, runTransaction, Database } from 'firebase/database';

export const BASE_SPIN_COUNT = 4230; // Khởi điểm chuẩn xác theo Cloudflare Analytics thực tế

// Điền cấu hình Firebase của bạn vào đây (hoặc thông qua biến môi trường)
export const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "xuanhoacogi.firebaseapp.com",
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL || "https://xuanhoacogi-default-rtdb.firebaseio.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "xuanhoacogi",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "xuanhoacogi.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || ""
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
