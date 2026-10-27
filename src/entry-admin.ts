import { Admin } from './bar.js';
import { setupIndependentPortal, PORTALS } from './portal-auth.js';

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

function init() {
  console.log('[EntryAdmin] Inicializando portal de Anfitrión de Bar...');
  setupIndependentPortal(PORTALS.admin, () => {
    Admin.init();
  });
}
