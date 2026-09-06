import { Auth } from './auth.js';
import { Network } from './network.js';
import { RondaDialog } from './dialog.js';

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

function init() {
  console.log('Inicializando Panel Network...');
  
  Auth.onAuthStateChanged((user) => {
    if (!user) {
      window.location.href = '/';
      return;
    }
    
    if (user.role !== 'network' && user.role !== 'superadmin') {
      RondaDialog.alert({
        title: 'Acceso Denegado',
        message: 'No tienes permisos para este panel.',
        icon: '🔒'
      }).then(() => {
        window.location.href = '/';
      });
      return;
    }
    
    Network.init();
    document.getElementById('view-network')?.classList.add('on');
  });
}
