import { HostAdmin } from './host-admin.js';
import { setupIndependentPortal, PORTALS } from './portal-auth.js';

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

function init(): void {
  console.info('[EntryAdmin] Inicializando consola de Anfitrión & Sala...');

  // Monitoreo de conectividad en sala
  window.addEventListener('offline', () => {
    console.warn('[EntryAdmin] Conexión perdida en sala.');
    showAdminAlert('Sin conexión a internet. Los cambios locales se sincronizarán al recuperar señal.', 'warning');
  });

  window.addEventListener('online', () => {
    console.info('[EntryAdmin] Conexión restablecida.');
    showAdminAlert('Conexión recuperada. Sincronizando con sala...', 'success');
  });

  try {
    setupIndependentPortal(PORTALS.admin, async (user) => {
      try {
        if (!user) {
          // Si el portal desautentica, ejecutar limpieza de recursos si existe
          if (typeof (HostAdmin as any).destroy === 'function') {
            (HostAdmin as any).destroy();
          }
          return;
        }

        await HostAdmin.init(user);
        // Desbloquear AudioContext para iOS/Safari al primer gesto de interacción
        await (HostAdmin as any).initAudioContext?.();
        
        // Registrar Service Worker para resiliencia offline
        if ('serviceWorker' in navigator) {
          try {
            await navigator.serviceWorker.register('/sw-registrar.js', { scope: '/' });
            console.info('[EntryAdmin] Service Worker registrado para resiliencia offline');
          } catch (swErr) {
            console.warn('[EntryAdmin] No se pudo registrar Service Worker:', swErr);
          }
        }
      } catch (err: unknown) {
        console.error('[EntryAdmin] Error crítico al montar HostAdmin:', err);
        renderErrorFallback(err instanceof Error ? err.message : 'Error desconocido al iniciar la sala.');
      }
    });
  } catch (authInitError: unknown) {
    console.error('[EntryAdmin] Error en setupIndependentPortal:', authInitError);
    renderErrorFallback('No fue posible inicializar la autenticación del anfitrión.');
  }
}

function renderErrorFallback(message: string): void {
  const container = document.getElementById('view-admin');
  if (!container) return;

  container.innerHTML = `
    <div style="max-width: 420px; margin: 40px auto; padding: 24px; background: rgba(155, 39, 72, 0.15); border: 1px solid var(--vino, #9B2748); border-radius: 16px; text-align: center; color: var(--papel, #F3EDE2);">
      <div style="font-size: 32px; margin-bottom: 8px;">⚠️</div>
      <h3 style="font-family: var(--font-display, serif); font-size: 20px; margin: 0 0 8px;">Fallo al cargar la sala</h3>
      <p style="font-size: 13px; color: var(--humo, rgba(243,237,226,0.65)); line-height: 1.4; margin: 0 0 16px;">${message}</p>
      <button type="button" onclick="window.location.reload()" class="btn ambar" style="padding: 10px 20px; font-size: 13px; border-radius: 999px; cursor: pointer; font-weight: 700;">
        🔄 Reintentar conexión
      </button>
    </div>
  `;
}

function showAdminAlert(message: string, type: 'warning' | 'success'): void {
  const toastContainer = document.getElementById('toast-container');
  if (!toastContainer) return;

  const toast = document.createElement('div');
  toast.className = `toast-v2 show ${type === 'warning' ? 'reservation' : 'match'}`;
  toast.innerHTML = `
    <div class="toast-icon">${type === 'warning' ? '📡' : '✅'}</div>
    <div class="toast-text">
      <h4>${type === 'warning' ? 'Alerta de Red' : 'En línea'}</h4>
      <p>${message}</p>
    </div>
  `;
  toastContainer.appendChild(toast);
  setTimeout(() => toast.remove(), 4000);
}