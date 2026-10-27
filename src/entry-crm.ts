import { CRM } from './crm.js';
import { setupIndependentPortal, PORTALS } from './portal-auth.js';

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

function init() {
  console.log('[EntryCRM] Inicializando portal CRM Comercial...');
  setupIndependentPortal(PORTALS.crm, (user) => {
    CRM.init(user.uid);
  });
}
