import { HostAdmin } from './host-admin.js';
import { setupIndependentPortal, PORTALS } from './portal-auth.js';

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

function init() {
  console.log('[EntryAdmin] Inicializando portal de Anfitrión de Bar & Sala...');
  setupIndependentPortal(PORTALS.admin, (user) => {
    HostAdmin.init(user);
  });
}
