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

// Persistencia del modo emulador en local a través de sesión temporal (sessionStorage)
let useEmulator = false;
if (typeof window !== 'undefined') {
  const urlParams = new URLSearchParams(window.location.search);
  const urlHasEmulator = urlParams.get('emulator') === 'true' || window.location.search.includes('emulator=true');
  const urlClearsEmulator = urlParams.get('emulator') === 'false' || window.location.search.includes('emulator=false');
  const isPort5002 = window.location.port === '5002'; // Puerto del Hosting Emulator

  if (urlClearsEmulator) {
    sessionStorage.removeItem('ronda_use_emulator');
  } else if (urlHasEmulator || isPort5002) {
    sessionStorage.setItem('ronda_use_emulator', 'true');
  }

  const storedEmulator = sessionStorage.getItem('ronda_use_emulator') === 'true';
  const envEmulator = (import.meta as any).env?.VITE_USE_FIREBASE_EMULATOR === 'true';

  useEmulator = envEmulator || storedEmulator || urlHasEmulator;

  if (useEmulator) {
    try {
      connectFirestoreEmulator(db, 'localhost', 8081);
      connectAuthEmulator(auth, 'http://localhost:9099', { disableWarnings: true });
      console.log("Conectado a Firebase Local Emulator Suite (Firestore: 8081, Auth: 9099) vía sesión temporal.");
    } catch (e) {
      console.warn("Emuladores ya conectados o no disponibles:", e);
    }
  }
}

export const RondaServices = {
  app,
  db,
  auth,
  messaging,
  useEmulator
};
export { app, db, auth, messaging, useEmulator };
