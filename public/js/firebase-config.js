// Configuración para el entorno de Firebase.
// Esta configuración puede variar dependiendo del entorno (Demo vs Producción).

const DEMO_MODE = true; // Si es true, usa datos en memoria en lugar de Firebase real.

window.RondaConfig = {
  isDemo: DEMO_MODE,
  firebaseConfig: {
    // Reemplaza con tus credenciales de Firebase cuando pases a producción real.
    apiKey: "AIzaSyDummyKeyForDemo",
    authDomain: "ronda-app-demo.firebaseapp.com",
    projectId: "ronda-app-demo",
    storageBucket: "ronda-app-demo.appspot.com",
    messagingSenderId: "1234567890",
    appId: "1:1234567890:web:abcdef123456"
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
