import { Auth } from './auth.js';
import { SuperAdmin } from './superadmin.js';
import { RondaDialog } from './dialog.js';
import { initAuthForm } from './auth-ui.js';

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

function init() {
  console.log('Inicializando Panel SuperAdmin...', Auth);
  
  if (typeof Auth.onAuthStateChanged !== 'function') {
    console.error("CRITICAL: Auth.onAuthStateChanged no es una función. Métodos disponibles:", Object.keys(Object.getPrototypeOf(Auth)));
  }

  Auth.onAuthStateChanged((user) => {
    if (!user) {
      window.location.href = '/';
      return;
    }
    
    if (user.role !== 'superadmin') {
      RondaDialog.alert({
        title: 'Acceso Denegado',
        message: 'No tienes permisos para este panel.',
        icon: '🔒'
      }).then(() => {
        Auth.logout().then(() => window.location.reload());
      });
      return;
    }
    
    document.getElementById('view-auth')?.classList.remove('on');
    SuperAdmin.init();
    document.getElementById('view-superadmin')?.classList.add('on');
  });

  initAuthForm(() => {
    console.log("Login exitoso en superadmin");
  });
}
