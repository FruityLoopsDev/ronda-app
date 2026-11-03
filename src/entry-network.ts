/**
 * RONDA Red de Bares Aliados — Orquestador de Entrada y Motor de Exclusividad Territorial (500m)
 * 
 * Responsabilidades:
 * 1. Inicialización resiliente del portal de red de aliados con portal-auth.
 * 2. Motor de exclusividad territorial con cálculo Haversine de precisión geodésica.
 * 3. Pre-filtrado por Bounding Box espacial para escalabilidad $O(N)$.
 * 4. Monitoreo de conectividad (offline/online) y manejo de errores con Error Boundary UI.
 * 5. Registro de Service Worker para operación local resiliente.
 */
import { escapeHtml } from './utils.js';

import { Network } from './network.js';
import { setupIndependentPortal, PORTALS } from './portal-auth.js';
import { User } from './db.js';

// =========================================================================
// Motor de Exclusividad Territorial (500m)
// El cálculo puro vive en `territorial.ts`; se re-exporta aquí para no romper
// a los consumidores históricos de este punto de entrada.
// =========================================================================

export {
  EXCLUSIVITY_CONFIG,
  calculateHaversineDistance,
  checkTerritorialExclusivity,
  detectAllNetworkCollisions
} from './territorial.js';
export type { ExclusivityConflict, ExclusivityCheckResult } from './territorial.js';

// =========================================================================
// Orquestación del Ciclo de Vida y Resiliencia
// =========================================================================

let portalCleanup: (() => void) | null = null;

function setupConnectivityListeners(): void {
  window.addEventListener('offline', () => {
    console.warn('[EntryNetwork] Conexión perdida. Operando con caché local.');
    showNetworkToast('Modo offline: Consultas territoriales ejecutándose sobre el grafo local.', 'warning');
  });

  window.addEventListener('online', () => {
    console.info('[EntryNetwork] Conexión restablecida.');
    showNetworkToast('Conexión reestablecida con la Red de Bares.', 'success');
  });
}

function showNetworkToast(message: string, type: 'warning' | 'success' | 'error'): void {
  let toast = document.getElementById('network-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'network-toast';
    toast.style.cssText = `
      position: fixed; bottom: 24px; right: 24px; z-index: 99999;
      max-width: 360px; padding: 12px 18px; border-radius: 12px;
      font-family: var(--font-mono, monospace); font-size: 11px;
      display: flex; align-items: center; gap: 10px;
      box-shadow: 0 8px 30px rgba(0,0,0,0.5); backdrop-filter: blur(10px);
      transition: opacity 0.3s ease, transform 0.3s ease;
    `;
    document.body.appendChild(toast);
  }

  const isWarn = type === 'warning';
  const isErr = type === 'error';
  toast.style.background = isWarn ? 'rgba(240,168,48,0.92)' : isErr ? 'rgba(155,39,72,0.92)' : 'rgba(46,107,84,0.92)';
  toast.style.color = '#fff';
  toast.style.border = `1px solid ${isWarn ? 'var(--luz)' : isErr ? 'var(--vino)' : 'var(--botella)'}`;
  toast.innerHTML = `<span>${isWarn ? '⚠️' : isErr ? '🛑' : '🗺️'}</span> <span>${escapeHtml(message)}</span>`;
  toast.style.display = 'flex';
  toast.style.opacity = '1';

  setTimeout(() => {
    if (toast) {
      toast.style.opacity = '0';
      setTimeout(() => { if (toast) toast.style.display = 'none'; }, 300);
    }
  }, 5000);
}

function renderNetworkCrashFallback(errorText: string): void {
  const container = document.getElementById('view-network');
  if (!container) return;

  container.innerHTML = `
    <div style="min-height: 70vh; display: flex; align-items: center; justify-content: center; padding: 24px;">
      <div style="max-width: 500px; width: 100%; background: rgba(22, 16, 27, 0.95); border: 1px solid var(--vino); border-radius: 18px; padding: 32px; text-align: center;">
        <div style="font-size: 42px; margin-bottom: 12px;">🗺️</div>
        <h3 style="font-family: var(--font-display); font-size: 22px; color: var(--papel); margin: 0 0 10px;">Error en Consola de Red</h3>
        <p style="font-size: 12.5px; color: var(--humo); line-height: 1.5; margin: 0 0 20px;">
          No se pudo sincronizar la cartografía de exclusividad territorial de bares.
        </p>
        <div style="background: rgba(0,0,0,0.4); border: 1px solid var(--linea); border-radius: 8px; padding: 12px; font-family: var(--font-mono); font-size: 10.5px; color: #ff8ca8; text-align: left; margin-bottom: 20px; max-height: 120px; overflow-y: auto;">
          ${escapeHtml(errorText)}
        </div>
        <button id="btn-net-retry" class="btn ambar" style="width: 100%; padding: 12px; font-weight: 700;">
          Recargar Mapa de Red ↺
        </button>
      </div>
    </div>
  `;

  document.getElementById('btn-net-retry')?.addEventListener('click', () => {
    window.location.reload();
  });
}

async function registerOfflineWorker(): Promise<void> {
  if ('serviceWorker' in navigator && window.location.protocol === 'https:') {
    try {
      await navigator.serviceWorker.register('/sw-registrar.js', { scope: '/' });
      console.info('[EntryNetwork] Service Worker registrado.');
    } catch (swErr) {
      console.warn('[EntryNetwork] No se pudo registrar Service Worker:', swErr);
    }
  }
}

/**
 * Inicializador principal del Portal de Red de Bares
 */
export function init(): void {
  console.info('[EntryNetwork] Inicializando portal Red de Bares y Motor de Exclusividad Territorial...');
  setupConnectivityListeners();

  try {
    portalCleanup = setupIndependentPortal(PORTALS.network, async (user: User) => {
      try {
        await Network.init();
        await registerOfflineWorker();
      } catch (err: unknown) {
        console.error('[EntryNetwork] Error en inicialización del controlador Network:', err);
        renderNetworkCrashFallback(err instanceof Error ? err.message : String(err));
      }
    });
  } catch (setupErr: unknown) {
    console.error('[EntryNetwork] Error crítico en setupIndependentPortal:', setupErr);
    renderNetworkCrashFallback(setupErr instanceof Error ? setupErr.message : String(setupErr));
  }
}

// Auto-arranque al cargar el DOM
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
