import { initializeApp } from "firebase/app";
import { initializeFirestore, getFirestore, connectFirestoreEmulator, persistentLocalCache, persistentMultipleTabManager } from "firebase/firestore";
import { getAuth, connectAuthEmulator } from "firebase/auth";
import { getMessaging } from "firebase/messaging";

export const RondaConfig = {
  // false = la verificación KYC corre el flujo REAL (cámara + rostro + OCR).
  kycSimulated: false,
  firebaseConfig: {
    apiKey: "AIzaSyA55U4CwLAv5tlNPGvO-OkRBB0qJHbTNKQ",
    authDomain: "ronda-uno.firebaseapp.com",
    projectId: "ronda-uno",
    storageBucket: "ronda-uno.firebasestorage.app",
    messagingSenderId: "391712707230",
    appId: "1:391712707230:web:3a5461ef25e71c4dc6e18f",
    measurementId: "G-RH65BSDMP5"
  }
};

const app = initializeApp(RondaConfig.firebaseConfig);
// Carga instantánea desde IndexedDB: la caché local persistente evita round-trips
// de red en visitas repetidas y deja que Firestore sincronice en segundo plano.
let db: any;
try {
  // Carga instantánea desde IndexedDB: la caché local persistente evita round-trips
  // de red en visitas repetidas y deja que Firestore sincronice en segundo plano.
  db = initializeFirestore(app, {
    localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() })
  });
} catch (e) {
  console.warn("[Firebase] Falló la inicialización de caché persistente, usando Firestore estándar:", e);
  db = getFirestore(app);
}

const auth = getAuth(app);
let messaging: any = null;
if (typeof window !== 'undefined') {
  try { messaging = getMessaging(app); } catch (e) { console.warn('FCM not supported', e); }
}

const useEmulator = typeof window !== 'undefined' && ((import.meta as any).env?.VITE_USE_FIREBASE_EMULATOR === 'true' || window.location.search.includes('emulator=true'));
if (useEmulator) {
  try {
    connectFirestoreEmulator(db, 'localhost', 8081);
    connectAuthEmulator(auth, 'http://localhost:9099', { disableWarnings: true });
    console.log("Conectado a Firebase Local Emulator Suite (Firestore: 8081, Auth: 9099).");
  } catch (e) {
    console.warn("Emuladores ya conectados o no disponibles:", e);
  }
}

export const RondaServices = {
  app,
  db,
  auth,
  messaging
};
export { app, db, auth, messaging };
