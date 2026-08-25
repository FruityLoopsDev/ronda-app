import { onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut } from "firebase/auth";
import { RondaServices } from "./firebase-config.js";
import { DB, User } from "./db.js";

export class AuthService {
  currentUser: User | null;

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
        
        let userProfile = await DB.getUser(firebaseUser.uid);
        
        if (!userProfile) {
          console.warn("[Auth] No se encontró perfil de Firestore para el UID. Creando uno básico...");
          let role = 'client';
          if (firebaseUser.email) {
            const emailLower = firebaseUser.email.toLowerCase();
            if (emailLower.includes('superadmin')) role = 'superadmin';
            else if (emailLower.includes('sales') || emailLower.includes('ventas')) role = 'sales';
            else if (emailLower.includes('network') || emailLower.includes('red')) role = 'network';
            else if (emailLower.includes('admin')) role = 'admin';
          }
          
          userProfile = {
            uid: firebaseUser.uid,
            name: role !== 'client' ? `Usuario ${role}` : '',
            role: role,
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
      throw error;
    }
  }

  async registerWithEmail(email: string, password: string, profileData: Partial<User>) {
    console.log(`[Auth] Register intent: ${email}`);
    try {
      const userCredential = await createUserWithEmailAndPassword(this._getAuth(), email, password);
      const uid = userCredential.user.uid;
      let role = 'client';
      const emailLower = email.toLowerCase();
      if (emailLower.includes('superadmin')) role = 'superadmin';
      else if (emailLower.includes('sales') || emailLower.includes('ventas')) role = 'sales';
      else if (emailLower.includes('network') || emailLower.includes('red')) role = 'network';
      else if (emailLower.includes('admin')) role = 'admin';
      
      const newProfile: User = {
        uid: uid,
        role: role,
        name: profileData.name || (role !== 'client' ? `Usuario ${role}` : 'Anónimo'),
        birthDate: profileData.birthDate || '',
        zodiacSign: profileData.zodiacSign || '',
        age: profileData.age || 0,
        gender: profileData.gender || '',
        orientation: profileData.orientation || '',
        email: email,
        wallet_address: '',
        nfts: []
      };
      
      await DB.saveUser(newProfile);
      console.log("[Auth] Registro y perfil creados exitosamente.");
      return newProfile;
    } catch (error: any) {
      console.error("Error durante el registro:", error);
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
