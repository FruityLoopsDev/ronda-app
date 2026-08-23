// auth.js: Lógica de Autenticación (Modo Demo y Real)

class AuthService {
  constructor() {
    this.currentUser = null;
    this.isDemo = window.RondaConfig.isDemo;
    
    // Iniciar escucha del estado de autenticación real si no es demo
    setTimeout(() => this.initAuthStateListener(), 800);
  }

  _getAuth() {
    return window.RondaServices.auth;
  }

  initAuthStateListener() {
    if (this.isDemo || !window.firebaseModules) return;
    
    const { onAuthStateChanged } = window.firebaseModules;
    
    onAuthStateChanged(this._getAuth(), async (firebaseUser) => {
      if (firebaseUser) {
        console.log("[Auth] Usuario de Firebase detectado:", firebaseUser.uid);
        
        // Obtener el perfil extendido de Firestore
        let userProfile = await window.DB.getUser(firebaseUser.uid);
        
        if (!userProfile) {
          console.warn("[Auth] No se encontró perfil de Firestore para el UID. Creando uno básico...");
          // Fallback en caso de que no se haya guardado previamente
          userProfile = {
            uid: firebaseUser.uid,
            name: firebaseUser.email.split('@')[0],
            role: firebaseUser.email.includes('admin') ? 'admin' : 'client',
            wallet_address: '0x' + Array.from({length: 40}, () => "0123456789abcdef".charAt(Math.floor(Math.random() * 16))).join(''),
            nfts: []
          };
          await window.DB.saveUser(userProfile);
        }
        
        this.currentUser = userProfile;
        window.dispatchEvent(new CustomEvent('auth:login', { detail: userProfile }));
      } else {
        console.log("[Auth] Ningún usuario autenticado en Firebase.");
        this.currentUser = null;
        window.dispatchEvent(new Event('auth:logout'));
      }
    });
  }

  async loginDemoUser(role) {
    if (this.isDemo) {
      console.log(`Logueando como ${role} en modo demo...`);
      const userId = role === 'client' ? 'u1' : 'admin1';
      const user = await window.DB.getUser(userId);
      if (user) {
        this.currentUser = user;
        window.dispatchEvent(new CustomEvent('auth:login', { detail: user }));
      } else {
        console.error("Usuario demo no encontrado");
      }
      return;
    }

    // Modo Firebase Emulator / Producción: Registro e inicio automático rápido
    const { signInWithEmailAndPassword, createUserWithEmailAndPassword } = window.firebaseModules;
    const email = role === 'client' ? 'cliente@ronda.com' : 'admin@ronda.com';
    const password = 'Password123!';
    
    console.log(`[Auth Real] Intentando loguear en Firebase Auth: ${email}`);
    
    try {
      await signInWithEmailAndPassword(this._getAuth(), email, password);
    } catch (error) {
      if (error.code === 'auth/user-not-found' || error.code === 'auth/invalid-credential') {
        console.log("[Auth Real] Usuario no registrado. Registrando nuevo usuario en Firebase Auth...");
        try {
          const userCredential = await createUserWithEmailAndPassword(this._getAuth(), email, password);
          const uid = userCredential.user.uid;
          
          // Crear perfil extendido en Firestore
          const newProfile = role === 'client' ? {
            uid: uid,
            name: 'Juan Pérez (Firebase)',
            role: 'client',
            gender: 'M',
            orientation: 'F',
            age: 28,
            wallet_address: '0x1111111111111111111111111111111111111111',
            nfts: []
          } : {
            uid: uid,
            name: 'Admin Bar Central (Firebase)',
            role: 'admin',
            venueId: 'v1'
          };
          
          // Guardar perfil en Firestore
          await window.DB.saveUser(newProfile);
          
          // Inicializar evento de prueba en Firestore si somos Admin y no existe
          if (role === 'admin') {
            const defaultEvent = {
              id: 'e1',
              venueId: 'v1',
              status: 'waiting',
              participants: [],
              tables: 2,
              currentRound: 0
            };
            await window.DB.saveEvent(defaultEvent);
          }
          
          console.log("[Auth Real] Registro y perfil creados exitosamente.");
        } catch (regError) {
          console.error("Error durante el registro automático:", regError);
        }
      } else {
        console.error("Error de login en Firebase Auth:", error);
      }
    }
  }

  async logout() {
    if (this.isDemo) {
      this.currentUser = null;
      window.dispatchEvent(new Event('auth:logout'));
      return;
    }
    
    const { signOut } = window.firebaseModules;
    try {
      await signOut(this._getAuth());
    } catch (error) {
      console.error("Error cerrando sesión en Firebase:", error);
    }
  }
}

window.Auth = new AuthService();
