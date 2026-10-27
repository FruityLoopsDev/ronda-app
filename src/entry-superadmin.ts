import { SuperAdmin } from './superadmin.js';
import { setupIndependentPortal, PORTALS } from './portal-auth.js';

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

function init() {
  console.log('[EntrySuperAdmin] Inicializando portal SuperAdmin...');
  setupIndependentPortal(PORTALS.superadmin, () => {
    SuperAdmin.init();
  });
}
