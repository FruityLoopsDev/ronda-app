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
import { Venue, User } from './db.js';

// =========================================================================
// Tipos del Motor de Exclusividad Territorial
// =========================================================================

export interface ExclusivityConflict {
  conflictingVenueId: string;
  conflictingVenueName: string;
  distanceMeters: number;
  zone: string;
}

export interface ExclusivityCheckResult {
  isCompliant: boolean; // true si respeta el radio de exclusividad (>= 500m)
  conflicts: ExclusivityConflict[];
  closestDistanceMeters: number;
}

export const EXCLUSIVITY_CONFIG = {
  MIN_DISTANCE_METERS: 500,
  EARTH_RADIUS_METERS: 6371000,
  // 500m representan aprox 0.0045 grados en Bogotá (~4.6°N)
  BOUNDING_BOX_DELTA_DEG: 0.006 
};

// =========================================================================
// Motor Matemático Haversine y Bounding Box
// =========================================================================

/**
 * Calcula la distancia ortodrómica en metros entre dos coordenadas geográficas
 * mediante la fórmula de Haversine con estabilidad numérica.
 */
export function calculateHaversineDistance(
  lat1: number, 
  lon1: number, 
  lat2: number, 
  lon2: number
): number {
  if (lat1 === lat2 && lon1 === lon2) return 0;

  const toRad = Math.PI / 180;
  const φ1 = lat1 * toRad;
  const φ2 = lat2 * toRad;
  const Δφ = (lat2 - lat1) * toRad;
  const Δλ = (lon2 - lon1) * toRad;

  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ / 2) * Math.sin(Δλ / 2);

  const c = 2 * Math.atan2(Math.sqrt(Math.max(0, Math.min(1, a))), Math.sqrt(Math.max(0, 1 - a)));

  return Math.round(EXCLUSIVITY_CONFIG.EARTH_RADIUS_METERS * c);
}

/**
 * Verifica si un punto geográfico candidato cumple con el radio de exclusividad de 500m
 * frente a los locales ya registrados y activos en la red.
 */
export function checkTerritorialExclusivity(
  candidate: { lat: number; lng: number; id?: string },
  existingVenues: Venue[],
  minRadiusMeters: number = EXCLUSIVITY_CONFIG.MIN_DISTANCE_METERS
): ExclusivityCheckResult {
  const conflicts: ExclusivityConflict[] = [];
  let closestDistanceMeters = Infinity;

  for (const venue of existingVenues) {
    // No comparar contra sí mismo si se está editando
    if (candidate.id && venue.id === candidate.id) continue;
    // Solo locales activos generan conflicto de exclusividad comercial
    if (venue.status !== 'active') continue;
    if (typeof venue.lat !== 'number' || typeof venue.lng !== 'number') continue;

    // Filtro rápido Bounding Box (evita cálculos trigonométricos costosos)
    if (
      Math.abs(venue.lat - candidate.lat) > EXCLUSIVITY_CONFIG.BOUNDING_BOX_DELTA_DEG ||
      Math.abs(venue.lng - candidate.lng) > EXCLUSIVITY_CONFIG.BOUNDING_BOX_DELTA_DEG
    ) {
      continue;
    }

    const distance = calculateHaversineDistance(candidate.lat, candidate.lng, venue.lat, venue.lng);
    if (distance < closestDistanceMeters) {
      closestDistanceMeters = distance;
    }

    if (distance < minRadiusMeters) {
      conflicts.push({
        conflictingVenueId: venue.id,
        conflictingVenueName: venue.name,
        distanceMeters: distance,
        zone: venue.zone || 'Bogotá'
      });
    }
  }

  return {
    isCompliant: conflicts.length === 0,
    conflicts,
    closestDistanceMeters: closestDistanceMeters === Infinity ? -1 : closestDistanceMeters
  };
}

/**
 * Detecta todos los pares en conflicto dentro de la red completa
 */
export function detectAllNetworkCollisions(
  venues: Venue[],
  minRadiusMeters: number = EXCLUSIVITY_CONFIG.MIN_DISTANCE_METERS
): Map<string, ExclusivityConflict[]> {
  const collisions = new Map<string, ExclusivityConflict[]>();
  const activeVenues = venues.filter(v => v.status === 'active' && typeof v.lat === 'number' && typeof v.lng === 'number');

  for (let i = 0; i < activeVenues.length; i++) {
    for (let j = i + 1; j < activeVenues.length; j++) {
      const v1 = activeVenues[i];
      const v2 = activeVenues[j];

      // Bounding Box check
      if (
        Math.abs(v1.lat - v2.lat) > EXCLUSIVITY_CONFIG.BOUNDING_BOX_DELTA_DEG ||
        Math.abs(v1.lng - v2.lng) > EXCLUSIVITY_CONFIG.BOUNDING_BOX_DELTA_DEG
      ) {
        continue;
      }

      const dist = calculateHaversineDistance(v1.lat, v1.lng, v2.lat, v2.lng);
      if (dist < minRadiusMeters) {
        const c1: ExclusivityConflict = { conflictingVenueId: v2.id, conflictingVenueName: v2.name, distanceMeters: dist, zone: v2.zone };
        const c2: ExclusivityConflict = { conflictingVenueId: v1.id, conflictingVenueName: v1.name, distanceMeters: dist, zone: v1.zone };

        if (!collisions.has(v1.id)) collisions.set(v1.id, []);
        if (!collisions.has(v2.id)) collisions.set(v2.id, []);
        collisions.get(v1.id)!.push(c1);
        collisions.get(v2.id)!.push(c2);
      }
    }
  }

  return collisions;
}

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
