// auth.js: Lógica de Autenticación (Modo Demo y Real)

class AuthService {
  constructor() {
    this.currentUser = null;
  }

  async loginDemoUser(role) {
    console.log(`Logueando como ${role} en modo demo...`);
    const userId = role === 'client' ? 'u1' : 'admin1';
    
    // Obtener de DB
    const user = await window.DB.getUser(userId);
    if (user) {
      this.currentUser = user;
      // Disparar evento global de login
      window.dispatchEvent(new CustomEvent('auth:login', { detail: user }));
    } else {
      console.error("Usuario demo no encontrado");
    }
  }

  logout() {
    this.currentUser = null;
    window.dispatchEvent(new Event('auth:logout'));
  }
}

window.Auth = new AuthService();
