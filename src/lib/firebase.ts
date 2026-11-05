// Firebase Realtime Database & Authentication Configuration
// Cấu hình Firebase Realtime Database & Authentication cho XuanHoaCoGi
import { initializeApp, getApps, getApp, deleteApp, type FirebaseApp } from 'firebase/app';
import {
  getDatabase,
  connectDatabaseEmulator,
  ref,
  onValue,
  runTransaction,
  Database,
} from 'firebase/database';
import { getAuth, setPersistence, inMemoryPersistence, type Auth } from 'firebase/auth';

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
let dbEmulatorConnected = false;
let authInstance: Auth | null = null;

export function getFirebaseApp(): FirebaseApp | null {
  if (typeof window === 'undefined') return null;
  if (!firebaseConfig.databaseURL && !firebaseConfig.projectId) return null;
  try {
    return getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
  } catch (err) {
    console.warn('Firebase app init warning:', err);
    return null;
  }
}

export function getRealtimeDb(): Database | null {
  if (typeof window === 'undefined') return null;
  if (!firebaseConfig.databaseURL && !firebaseConfig.projectId) return null;

  try {
    if (!db) {
      const app = getFirebaseApp();
      if (!app) return null;
      db = getDatabase(app);
    }
    if (
      db &&
      !dbEmulatorConnected &&
      (import.meta.env.DEV ||
        window.location.hostname === '127.0.0.1' ||
        window.location.hostname === 'localhost')
    ) {
      const searchParams = new URLSearchParams(window.location.search || '');
      const hashStr = window.location.hash || '';
      const qIdx = hashStr.indexOf('?');
      const hashParams = new URLSearchParams(qIdx >= 0 ? hashStr.slice(qIdx + 1) : '');
      const rawPort =
        (window as any).__XUANHOA_RTDB_EMULATOR_PORT__ ||
        searchParams.get('rtdbEmulatorPort') ||
        hashParams.get('rtdbEmulatorPort');
      const port = Number(rawPort);
      if (Number.isFinite(port) && port > 0) {
        const mockUserToken = (window as any).__XUANHOA_RTDB_EMULATOR_TOKEN__ || undefined;
        connectDatabaseEmulator(
          db,
          '127.0.0.1',
          port,
          mockUserToken ? { mockUserToken } : undefined
        );
        dbEmulatorConnected = true;
      }
    }
    return db;
  } catch (err) {
    console.warn('Firebase init warning:', err);
    return null;
  }
}

export function getFirebaseAuth(): Auth | null {
  if (typeof window === 'undefined') return null;
  try {
    if (!authInstance) {
      const app = getFirebaseApp();
      if (!app) return null;
      authInstance = getAuth(app);
    }
    return authInstance;
  } catch (err) {
    console.warn('Firebase Auth init warning:', err);
    return null;
  }
}

/**
 * Tạo phiên bản Firebase Auth phụ (in-memory) hoàn toàn cô lập để Primary Founder
 * khởi tạo tài khoản Backup Founder trên Firebase Authentication mà không làm gián đoạn
 * phiên đăng nhập hiện tại của Primary Founder.
 */
export async function createIsolatedProvisioningAuth(): Promise<{
  auth: Auth;
  dispose: () => Promise<void>;
} | null> {
  if (typeof window === 'undefined') return null;
  try {
    const appName = `xh_founder_provisioner_${Date.now()}`;
    const secondaryApp = initializeApp(firebaseConfig, appName);
    const secondaryAuth = getAuth(secondaryApp);
    await setPersistence(secondaryAuth, inMemoryPersistence);
    return {
      auth: secondaryAuth,
      dispose: async () => {
        try {
          await secondaryAuth.signOut();
        } catch {}
        try {
          await deleteApp(secondaryApp);
        } catch {}
      },
    };
  } catch (err) {
    console.warn('Isolated provisioning auth init warning:', err);
    return null;
  }
}

export { ref, onValue, runTransaction };
