import { initializeApp } from "firebase/app";
import { initializeFirestore, getFirestore, connectFirestoreEmulator, persistentLocalCache, persistentMultipleTabManager } from "firebase/firestore";
import { getAuth, connectAuthEmulator } from "firebase/auth";
import { getMessaging } from "firebase/messaging";

const productionFirebaseConfig = {
  apiKey: "AIzaSyA55U4CwLAv5tlNPGvO-OkRBB0qJHbTNKQ",
  authDomain: "ronda-uno.firebaseapp.com",
  projectId: "ronda-uno",
  storageBucket: "ronda-uno.firebasestorage.app",
  messagingSenderId: "391712707230",
  appId: "1:391712707230:web:3a5461ef25e71c4dc6e18f",
  measurementId: "G-RH65BSDMP5"
};

// Firebase Web App config is public client-side configuration, not a secret.
// Keep this dedicated to the isolated staging Firebase project.
const stagingFirebaseConfig = {
  apiKey: "AIzaSyCKQpjWuW2TCsbmOqAMD3y8FxU70UW-shc",
  authDomain: "ronda-staging-2026.firebaseapp.com",
  projectId: "ronda-staging-2026",
  storageBucket: "ronda-staging-2026.firebasestorage.app",
  messagingSenderId: "229663145659",
  appId: "1:229663145659:web:aa01ccc103c5f004bfb39e",
  measurementId: "G-7355D4K98E"
};

const env = (import.meta as any).env ?? {};
const requestedProjectId = env.VITE_FIREBASE_PROJECT_ID as string | undefined;
const stagingProjectId = "ronda-staging-2026";
const isStagingRequested = requestedProjectId === stagingProjectId;

// Staging is opt-in and fail-closed: only an explicit project ID selects it.
// There is no silent fallback from a partially configured staging environment.
const firebaseConfig = isStagingRequested
  ? stagingFirebaseConfig
  : productionFirebaseConfig;

if (requestedProjectId && requestedProjectId !== stagingProjectId && requestedProjectId !== "ronda-uno") {
  throw new Error(`Unrecognized Firebase project "${requestedProjectId}". Refusing to initialize Firebase.`);
}

export const RondaConfig = {
  kycSimulated: false,
  firebaseConfig
};

const app = initializeApp(RondaConfig.firebaseConfig);

// Local Emulator Suite is opt-in only. It is not used by the hosted staging
// environment; hosted staging connects to its dedicated Firebase project.
let useEmulator = false;
if (typeof window !== "undefined") {
  const urlParams = new URLSearchParams(window.location.search);
  const urlHasEmulator = urlParams.get("emulator") === "true";
  const urlClearsEmulator = urlParams.get("emulator") === "false";
  const isPort5002 = window.location.port === "5002";

  if (urlClearsEmulator) {
    sessionStorage.removeItem("ronda_use_emulator");
  } else if (urlHasEmulator || isPort5002) {
    sessionStorage.setItem("ronda_use_emulator", "true");
  }

  const storedEmulator = sessionStorage.getItem("ronda_use_emulator") === "true";
  const envEmulator = env.VITE_USE_FIREBASE_EMULATOR === "true";
  useEmulator = envEmulator || storedEmulator || urlHasEmulator;
}

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
if (typeof window !== "undefined" && !useEmulator) {
  try { messaging = getMessaging(app); } catch (e) { console.warn("FCM not supported", e); }
}

if (typeof window !== "undefined" && useEmulator) {
  try {
    connectFirestoreEmulator(db, "127.0.0.1", 8081);
    connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
    console.log("Conectado a Firebase Local Emulator Suite (Firestore: 8081, Auth: 9099).");
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
