/**
 * RONDA CRM Comercial — Orquestador de Entrada y Ciclo de Vida del Portal B2B
 *
 * Responsabilidades:
 * 1. Inicialización resiliente e idempotente del portal comercial con portal-auth.
 * 2. Monitoreo de conectividad (offline/online) con degradación elegante.
 * 3. Re-exportación de la fuente única de comisiones (`src/commissions.ts`).
 * 4. Aislamiento de fallos en runtime (Error Boundary UI).
 * 5. Registro de Service Worker para resiliencia offline.
 */

import { CRM } from './crm.js';
import { setupIndependentPortal, PORTALS } from './portal-auth.js';
import { User, UserRole } from './db.js';
import { escapeHtml } from './utils.js';

export {
  bounty,
  accrued,
  toWaPhone,
  calculateLeadCommission,
  calculatePipelineSummary,
  TAX_RATES_BOGOTA
} from './commissions.js';

export type {
  HitBreakdown,
  LeadAccrualSummary,
  CommissionBreakdown,
  PipelineSummary
} from './commissions.js';

// =========================================================================
// Orquestación del Ciclo de Vida y Resiliencia
// =========================================================================

let portalCleanup: (() => void) | null = null;
let connectivityListenersBound = false;

function setupConnectivityListeners(): void {
  if (connectivityListenersBound) return;
  connectivityListenersBound = true;

  window.addEventListener('offline', () => {
    console.warn('[EntryCRM] Conexión perdida. Activando modo offline local.');
    showCrmNotification('Modo offline: Los cambios locales se sincronizarán al recuperar la señal.', 'warning');
  });

  window.addEventListener('online', () => {
    console.info('[EntryCRM] Conexión restablecida.');
    showCrmNotification('Conexión reestablecida con Firebase Cloud Firestore.', 'success');
  });
}

export function showCrmNotification(message: string, type: 'warning' | 'success' | 'error'): void {
  let toast = document.getElementById('crm-network-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'crm-network-toast';
    toast.setAttribute('role', 'status');
    toast.setAttribute('aria-live', 'polite');
    toast.style.cssText = `
      position: fixed; bottom: 24px; right: 24px; z-index: 99999;
      max-width: 380px; padding: 12px 18px; border-radius: 12px;
      font-family: var(--font-mono, monospace); font-size: 11px;
      display: flex; align-items: center; gap: 10px;
      box-shadow: 0 8px 30px rgba(0,0,0,0.5); backdrop-filter: blur(10px);
      transition: opacity 0.3s ease, transform 0.3s ease;
    `;
    document.body.appendChild(toast);
  }

  const isWarn = type === 'warning';
  const isErr = type === 'error';
  toast.style.background = isWarn ? 'rgba(240,168,48,0.94)' : isErr ? 'rgba(155,39,72,0.94)' : 'rgba(46,107,84,0.94)';
  toast.style.color = '#fff';
  toast.style.border = `1px solid ${isWarn ? 'var(--luz)' : isErr ? 'var(--vino)' : 'var(--botella)'}`;
  toast.innerHTML = `<span aria-hidden="true">${isWarn ? '⚠️' : isErr ? '🛑' : '✅'}</span> <span>${escapeHtml(message)}</span>`;
  toast.style.display = 'flex';
  toast.style.opacity = '1';

  setTimeout(() => {
    if (toast) {
      toast.style.opacity = '0';
      setTimeout(() => { if (toast) toast.style.display = 'none'; }, 300);
    }
  }, 5000);
}

function renderCrmCrashFallback(errorText: string): void {
  const container = document.getElementById('view-crm');
  if (!container) return;

  container.innerHTML = `
    <div style="min-height: 70vh; display: flex; align-items: center; justify-content: center; padding: 24px;">
      <div style="max-width: 500px; width: 100%; background: rgba(22, 16, 27, 0.95); border: 1px solid var(--vino); border-radius: 18px; padding: 32px; text-align: center;">
        <div style="font-size: 42px; margin-bottom: 12px;">⚠️</div>
        <h3 style="font-family: var(--font-display); font-size: 22px; color: var(--papel); margin: 0 0 10px;">Interrupción en el CRM</h3>
        <p style="font-size: 12.5px; color: var(--humo); line-height: 1.5; margin: 0 0 20px;">
          Ocurrió un problema inesperado al cargar el pipeline comercial. Tu progreso no se ha perdido.
        </p>
        <div style="background: rgba(0,0,0,0.4); border: 1px solid var(--linea); border-radius: 8px; padding: 12px; font-family: var(--font-mono); font-size: 10.5px; color: #ff8ca8; text-align: left; margin-bottom: 20px; max-height: 120px; overflow-y: auto;">
          ${escapeHtml(errorText)}
        </div>
        <button id="btn-crm-retry" class="btn ambar" style="width: 100%; padding: 12px; font-weight: 700;">
          Reintentar Inicialización ↺
        </button>
      </div>
    </div>
  `;

  document.getElementById('btn-crm-retry')?.addEventListener('click', () => {
    window.location.reload();
  });
}

async function registerOfflineWorker(): Promise<void> {
  if ('serviceWorker' in navigator && window.location.protocol === 'https:') {
    try {
      await navigator.serviceWorker.register('/sw-registrar.js', { scope: '/' });
      console.info('[EntryCRM] Service Worker registrado.');
    } catch (swErr) {
      console.warn('[EntryCRM] No se pudo registrar Service Worker:', swErr);
    }
  }
}

/**
 * Inicializador principal del Portal CRM
 */
export function init(): void {
  console.info('[EntryCRM] Inicializando portal CRM Comercial y Pipeline B2B...');
  setupConnectivityListeners();

  if (portalCleanup) {
    try {
      portalCleanup();
      CRM.destroy();
    } catch (e) {
      console.warn('[EntryCRM] Limpieza previa:', e);
    }
    portalCleanup = null;
  }

  try {
    portalCleanup = setupIndependentPortal(PORTALS.crm, async (user: User) => {
      try {
        await CRM.init(user.uid, (user.role as UserRole) || 'sales', user.name || user.email || user.uid);
        await registerOfflineWorker();
      } catch (err: unknown) {
        console.error('[EntryCRM] Error en inicialización del controlador CRM:', err);
        renderCrmCrashFallback(err instanceof Error ? err.message : String(err));
      }
    });
  } catch (setupErr: unknown) {
    console.error('[EntryCRM] Error crítico en setupIndependentPortal:', setupErr);
    renderCrmCrashFallback(setupErr instanceof Error ? setupErr.message : String(setupErr));
  }
}

// Auto-arranque al cargar el DOM
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
