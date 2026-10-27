import { SuperAdmin } from './superadmin.js';
import { setupIndependentPortal, PORTALS } from './portal-auth.js';
import { mountAdminWorkspace, type AdminWorkspace } from './admin-workspace.js';

let workspace: AdminWorkspace | null = null;
let generation = 0;

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init, { once: true });
} else {
  init();
}

function init() {
  setupIndependentPortal(PORTALS.superadmin, () => {
    const current = ++generation;
    workspace?.destroy();
    workspace = null;
    void Promise.resolve(SuperAdmin.init()).then(() => {
      if (current === generation) workspace = mountAdminWorkspace();
    }).catch((error: unknown) => {
      console.error('[EntrySuperAdmin] Initialization failed:', error);
    });
  });
}
