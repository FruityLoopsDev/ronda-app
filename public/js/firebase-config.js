// Configuración para el entorno de Firebase.
// Esta configuración puede variar dependiendo del entorno (Demo vs Producción).

const DEMO_MODE = false; // Si es true, usa datos en memoria en lugar de Firebase real.

window.RondaConfig = {
  isDemo: DEMO_MODE,
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

// Inicialización de Firebase
let app, db, auth;

if (!DEMO_MODE && window.firebaseModules) {
  const { initializeApp, getFirestore, connectFirestoreEmulator, getAuth, connectAuthEmulator } = window.firebaseModules;
  app = initializeApp(window.RondaConfig.firebaseConfig);
  db = getFirestore(app);
  auth = getAuth(app);
  
  if (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1") {
    connectFirestoreEmulator(db, 'localhost', 8080);
    connectAuthEmulator(auth, 'http://localhost:9099', { disableWarnings: true });
    console.log("Conectado a Firebase Local Emulator Suite.");
  }
}

window.RondaServices = {
  app,
  db,
  auth
};
