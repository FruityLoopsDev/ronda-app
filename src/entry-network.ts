import { Network } from './network.js';
import { setupIndependentPortal, PORTALS } from './portal-auth.js';

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

function init() {
  console.log('[EntryNetwork] Inicializando portal Red de Bares...');
  setupIndependentPortal(PORTALS.network, () => {
    Network.init();
  });
}
