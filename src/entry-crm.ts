import { Auth } from './auth.js';
import { CRM } from './crm.js';
import { RondaDialog } from './dialog.js';

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

function init() {
  console.log('Inicializando Panel CRM...');
  
  Auth.onAuthStateChanged((user) => {
    if (!user) {
      window.location.href = '/';
      return;
    }
    
    if (user.role !== 'sales' && user.role !== 'superadmin') {
      RondaDialog.alert({
        title: 'Acceso Denegado',
        message: 'No tienes permisos para este panel.',
        icon: '🔒'
      }).then(() => {
        window.location.href = '/';
      });
      return;
    }
    
    CRM.init(user.uid);
    document.getElementById('view-crm')?.classList.add('on');
  });
}
