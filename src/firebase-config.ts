import { initializeApp } from "firebase/app";
import { getFirestore, connectFirestoreEmulator } from "firebase/firestore";
import { getAuth, connectAuthEmulator } from "firebase/auth";

export const RondaConfig = {
  isDemo: false,
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
const db = getFirestore(app);
const auth = getAuth(app);

if (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1") {
  connectFirestoreEmulator(db, 'localhost', 8081); // Emulator port 8081 from prompt
  connectAuthEmulator(auth, 'http://localhost:9099', { disableWarnings: true });
  console.log("Conectado a Firebase Local Emulator Suite.");
}

export const RondaServices = {
  app,
  db,
  auth
};
