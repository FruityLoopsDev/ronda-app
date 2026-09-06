import { Auth } from './auth.js';
import { Admin } from './bar.js';
import { RondaDialog } from './dialog.js';
import { initAuthForm } from './auth-ui.js';

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initAdmin);
} else {
  initAdmin();
}

function initAdmin() {
  console.log("Inicializando Panel Admin...");
  
  Auth.onAuthStateChanged((user) => {
    if (!user) {
      window.location.href = '/';
      return;
    }
    
    if (user.role !== 'admin' && user.role !== 'superadmin') {
      RondaDialog.alert({
        title: 'Acceso Denegado',
        message: 'No tienes permisos de anfitrión.',
        icon: '🔒'
      }).then(() => {
        window.location.href = '/';
      });
      return;
    }
    
    document.getElementById('view-auth')?.classList.remove('on');
    Admin.init();
    document.getElementById('view-admin')?.classList.add('on');
  });

  initAuthForm(() => {
    console.log("Login exitoso en admin");
  });
}
