import { onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut } from "firebase/auth";
import { RondaServices } from "./firebase-config.js";
import { DB, User } from "./db.js";

export class AuthService {
  currentUser: User | null;

  /** Perfil guardado localmente durante registro para evitar race condition con onAuthStateChanged */
  private _pendingProfile: User | null = null;

  constructor() {
    this.currentUser = null;
    
    // Iniciar escucha del estado de autenticación
    setTimeout(() => this.initAuthStateListener(), 100);
  }

  private _getAuth() {
    return RondaServices.auth;
  }

  initAuthStateListener() {
    onAuthStateChanged(this._getAuth(), async (firebaseUser) => {
      if (firebaseUser) {
        console.log("[Auth] Usuario de Firebase detectado:", firebaseUser.uid);

        // Si registerWithEmail ya guardó el perfil, usarlo directamente
        // para evitar la race condition de Firestore read-after-write
        if (this._pendingProfile && this._pendingProfile.uid === firebaseUser.uid) {
          const profile = this._pendingProfile;
          this._pendingProfile = null;
          this.currentUser = profile;
          console.log("[Auth] Usando perfil pendiente del registro (sin releer Firestore).");
          window.dispatchEvent(new CustomEvent('auth:login', { detail: profile }));
          return;
        }

        // Si ya tenemos el perfil cargado para este UID, no releer
        if (this.currentUser && this.currentUser.uid === firebaseUser.uid) {
          console.log("[Auth] Perfil ya cargado, reemitiendo auth:login.");
          window.dispatchEvent(new CustomEvent('auth:login', { detail: this.currentUser }));
          return;
        }
        
        let userProfile = await DB.getUser(firebaseUser.uid);
        
        if (!userProfile) {
          console.warn("[Auth] No se encontró perfil de Firestore para el UID. Creando uno básico...");
          userProfile = {
            uid: firebaseUser.uid,
            name: '',
            role: 'client',
            gender: '',
            orientation: '',
            wallet_address: '',
            nfts: []
          } as User;
          
          await DB.saveUser(userProfile);
        }
        
        this.currentUser = userProfile;
        
        if (userProfile.role === 'client' && (!userProfile.name || !userProfile.gender || !userProfile.orientation)) {
          console.log("[Auth] Perfil incompleto para cliente. Mostrando modal...");
          window.dispatchEvent(new CustomEvent('auth:needsProfile', { detail: userProfile }));
        } else {
          window.dispatchEvent(new CustomEvent('auth:login', { detail: userProfile }));
        }
      } else {
        console.log("[Auth] Ningún usuario autenticado en Firebase.");
        this.currentUser = null;
        this._pendingProfile = null;
        window.dispatchEvent(new Event('auth:logout'));
      }
    });
  }

  async loginWithEmail(email: string, password: string) {
    console.log(`[Auth] Login intent: ${email}`);
    try {
      await signInWithEmailAndPassword(this._getAuth(), email, password);
    } catch (error: any) {
      console.error("Error de login en Firebase Auth:", error);

      // Traducir códigos de error de Firebase a mensajes claros en español
      const code = error?.code || '';
      if (code === 'auth/invalid-credential' || code === 'auth/wrong-password' || code === 'auth/user-not-found') {
        throw new Error('Correo o contraseña incorrectos. Si no tienes cuenta, créala con "Registro interno".');
      } else if (code === 'auth/too-many-requests') {
        throw new Error('Demasiados intentos. Espera unos minutos antes de intentar de nuevo.');
      } else if (code === 'auth/invalid-email') {
        throw new Error('El correo electrónico no tiene un formato válido.');
      } else if (code === 'auth/user-disabled') {
        throw new Error('Esta cuenta ha sido deshabilitada. Contacta al equipo RONDA.');
      }
      throw error;
    }
  }

  async registerWithEmail(email: string, password: string, profileData: Partial<User>) {
    console.log(`[Auth] Register intent: ${email}`);
    try {
      const userCredential = await createUserWithEmailAndPassword(this._getAuth(), email, password);
      const uid = userCredential.user.uid;

      const newProfile: User = {
        uid: uid,
        role: 'client',
        name: profileData.name || 'Anónimo',
        birthDate: profileData.birthDate || '',
        zodiacSign: profileData.zodiacSign || '',
        age: profileData.age || 0,
        gender: profileData.gender || '',
        orientation: profileData.orientation || '',
        email: email,
        wallet_address: '',
        nfts: [],
        ...profileData
      };
      
      // Guardar localmente ANTES de Firestore para ganarle a onAuthStateChanged
      this._pendingProfile = newProfile;
      this.currentUser = newProfile;

      await DB.saveUser(newProfile);
      console.log("[Auth] Registro y perfil creados exitosamente.");

      // Si onAuthStateChanged ya se disparó y consumió _pendingProfile, bien.
      // Si no, emitimos auth:login explícitamente.
      if (this._pendingProfile) {
        this._pendingProfile = null;
        window.dispatchEvent(new CustomEvent('auth:login', { detail: newProfile }));
      }

      return newProfile;
    } catch (error: any) {
      this._pendingProfile = null;
      console.error("Error durante el registro:", error);

      const code = error?.code || '';
      if (code === 'auth/email-already-in-use') {
        throw new Error('Ya existe una cuenta con este correo. Usa "Ingresar" para iniciar sesión.');
      } else if (code === 'auth/weak-password') {
        throw new Error('La contraseña es muy débil. Usa al menos 6 caracteres.');
      } else if (code === 'auth/invalid-email') {
        throw new Error('El correo electrónico no tiene un formato válido.');
      }
      throw error;
    }
  }

  async logout() {
    try {
      await signOut(this._getAuth());
    } catch (error) {
      console.error("Error cerrando sesión en Firebase:", error);
    }
  }
}

export const Auth = new AuthService();
