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
}

// Carga instantánea: en producción usa IndexedDB persistente; en emulador usa memoria directa
// para evitar bloqueos de lease multi-pestaña y estados obsoletos entre reinicios del emulador.
let db: any;
try {
  if (useEmulator) {
    db = getFirestore(app);
  } else {
    db = initializeFirestore(app, {
      localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() })
    });
  }
} catch (e) {
  console.warn("[Firebase] Falló la inicialización de caché persistente, usando Firestore estándar:", e);
  db = getFirestore(app);
}

const auth = getAuth(app);
let messaging: any = null;
if (typeof window !== 'undefined' && !useEmulator) {
  try { messaging = getMessaging(app); } catch (e) { console.warn('FCM not supported', e); }
}

if (typeof window !== 'undefined' && useEmulator) {
  try {
    connectFirestoreEmulator(db, '127.0.0.1', 8081);
    connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
    console.log("Conectado a Firebase Local Emulator Suite (127.0.0.1 -> Firestore: 8081, Auth: 9099) vía sesión temporal.");
  } catch (e) {
    console.warn("Emuladores ya conectados o no disponibles:", e);
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
