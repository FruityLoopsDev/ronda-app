/**
 * RONDA CRM Comercial — Orquestador de Entrada y Motor de Liquidación de Comisiones
 * 
 * Responsabilidades:
 * 1. Inicialización resiliente del portal comercial con portal-auth.
 * 2. Monitoreo de conectividad (offline/online) con degradación elegante.
 * 3. Motor determinista de cálculo de comisiones B2B (Hitos A, B, C, ReteFuente e ICA Bogotá).
 * 4. Aislamiento de fallos en runtime (Error Boundary UI).
 * 5. Registro de Service Worker para resiliencia offline.
 */

import { CRM } from './crm.js';
import { setupIndependentPortal, PORTALS } from './portal-auth.js';
import { Lead, MilestoneState, User } from './db.js';

// =========================================================================
// Tipos del Motor de Comisiones B2B
// =========================================================================

export interface CommissionBreakdown {
  leadId: string;
  leadName: string;
  baseCommissionCop: number;
  milestoneA: { amountCop: number; status: MilestoneState };
  milestoneB: { amountCop: number; status: MilestoneState };
  milestoneC: { amountCop: number; status: MilestoneState };
  grossCop: number;
  withholdingTaxCop: number; // ReteFuente (11% honorarios / 4% servicios)
  icaTaxCop: number;         // ICA Bogotá (9.66 por mil)
  netPayableCop: number;
}

export interface PipelineSummary {
  totalLeads: number;
  signedCount: number;
  negotiatingCount: number;
  prospectCount: number;
  conversionRatePct: number;
  totalProjectedCommissionsCop: number;
  totalAccruedCommissionsCop: number;
  totalPaidCommissionsCop: number;
}

// Configuración económica estándar (Bogotá)
export const COMMISSION_CONFIG = {
  DEFAULT_BASE_COP: 500_000,
  MILESTONE_A_PCT: 0.50, // 50% al firmar contrato y verificar venue
  MILESTONE_B_PCT: 0.30, // 30% tras primer evento válido (>= 16 pax)
  MILESTONE_C_PCT: 0.20, // 20% por retención a 90 días (>= 8 eventos)
  DEFAULT_RETEFUENTE_RATE: 0.11, // 11% tarifa declarantes / contratos
  ICA_BOGOTA_RATE: 0.00966      // 9.66 x 1000
};

/**
 * Calcula el desglose detallado de comisión para un bar/lead comercial
 */
export function calculateLeadCommission(
  lead: Lead, 
  options: { applyWithholding?: boolean; withholdingRate?: number } = {}
): CommissionBreakdown {
  const base = lead.commission && lead.commission > 0 
    ? lead.commission 
    : COMMISSION_CONFIG.DEFAULT_BASE_COP;

  const ms = lead.milestone_status || {
    A: lead.status === 'signed' ? 'accrued' : 'not_eligible',
    B: 'not_eligible',
    C: 'not_eligible'
  };

  const amountA = Math.round(base * COMMISSION_CONFIG.MILESTONE_A_PCT);
  const amountB = Math.round(base * COMMISSION_CONFIG.MILESTONE_B_PCT);
  const amountC = Math.round(base * COMMISSION_CONFIG.MILESTONE_C_PCT);

  let gross = 0;
  if (['accrued', 'payable', 'paid'].includes(ms.A)) gross += amountA;
  if (['accrued', 'payable', 'paid'].includes(ms.B)) gross += amountB;
  if (['accrued', 'payable', 'paid'].includes(ms.C)) gross += amountC;

  const rate = options.withholdingRate ?? COMMISSION_CONFIG.DEFAULT_RETEFUENTE_RATE;
  const withholdingTaxCop = options.applyWithholding ? Math.round(gross * rate) : 0;
  const icaTaxCop = options.applyWithholding ? Math.round(gross * COMMISSION_CONFIG.ICA_BOGOTA_RATE) : 0;
  const netPayableCop = Math.max(0, gross - withholdingTaxCop - icaTaxCop);

  return {
    leadId: lead.id,
    leadName: lead.name || 'Sin nombre',
    baseCommissionCop: base,
    milestoneA: { amountCop: amountA, status: ms.A },
    milestoneB: { amountCop: amountB, status: ms.B },
    milestoneC: { amountCop: amountC, status: ms.C },
    grossCop: gross,
    withholdingTaxCop,
    icaTaxCop,
    netPayableCop
  };
}

/**
 * Calcula las métricas consolidadas del pipeline de un scout o del equipo global
 */
export function calculatePipelineSummary(leads: Lead[]): PipelineSummary {
  const totalLeads = leads.length;
  let signedCount = 0;
  let negotiatingCount = 0;
  let prospectCount = 0;
  let totalProjectedCommissionsCop = 0;
  let totalAccruedCommissionsCop = 0;
  let totalPaidCommissionsCop = 0;

  for (const lead of leads) {
    const baseComm = lead.commission || COMMISSION_CONFIG.DEFAULT_BASE_COP;
    totalProjectedCommissionsCop += baseComm;

    if (lead.status === 'signed') {
      signedCount++;
      const breakdown = calculateLeadCommission(lead);
      totalAccruedCommissionsCop += breakdown.grossCop;
      if (lead.milestone_status?.A === 'paid') totalPaidCommissionsCop += breakdown.milestoneA.amountCop;
      if (lead.milestone_status?.B === 'paid') totalPaidCommissionsCop += breakdown.milestoneB.amountCop;
      if (lead.milestone_status?.C === 'paid') totalPaidCommissionsCop += breakdown.milestoneC.amountCop;
    } else if (lead.status === 'negotiating') {
      negotiatingCount++;
    } else {
      prospectCount++;
    }
  }

  const conversionRatePct = totalLeads > 0 
    ? Math.round((signedCount / totalLeads) * 1000) / 10 
    : 0;

  return {
    totalLeads,
    signedCount,
    negotiatingCount,
    prospectCount,
    conversionRatePct,
    totalProjectedCommissionsCop,
    totalAccruedCommissionsCop,
    totalPaidCommissionsCop
  };
}

// =========================================================================
// Orquestación del Ciclo de Vida y Resiliencia
// =========================================================================

let portalCleanup: (() => void) | null = null;

function setupConnectivityListeners(): void {
  window.addEventListener('offline', () => {
    console.warn('[EntryCRM] Conexión perdida. Activando modo offline local.');
    showCrmNotification('Modo offline: Los cambios locales se sincronizarán al recuperar la señal.', 'warning');
  });

  window.addEventListener('online', () => {
    console.info('[EntryCRM] Conexión restablecida.');
    showCrmNotification('Conexión reestablecida con Firebase Cloud Firestore.', 'success');
  });
}

function showCrmNotification(message: string, type: 'warning' | 'success' | 'error'): void {
  let toast = document.getElementById('crm-network-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'crm-network-toast';
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
  toast.innerHTML = `<span>${isWarn ? '⚠️' : isErr ? '🛑' : '✅'}</span> <span>${message}</span>`;
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
          ${errorText}
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

  try {
    portalCleanup = setupIndependentPortal(PORTALS.crm, async (user: User) => {
      try {
        await CRM.init(user.uid);
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
