/**
 * RONDA B2B — Fuente Única de Verdad para Comisiones de Scouts y Normalización CRM
 *
 * Consume exclusivamente `DEFAULT_SCOUT_POLICY` (v5.1 confirmada por el fundador:
 * $450.000 COP en 3 hitos: A = $100.000, B = $250.000, C = $100.000).
 */

import { DEFAULT_SCOUT_POLICY, ScoutPolicy } from './config/b2b-policies.js';
import type { Lead, LedgerEntry, MilestoneState } from './db.js';

export interface HitBreakdown {
  A: number;
  B: number;
  C: number;
  total: number;
}

export interface LeadAccrualSummary {
  devengado: number;
  pagado: number;
  proyectado: number;
}

export interface CommissionBreakdown {
  leadId: string;
  leadName: string;
  baseCommissionCop: number;
  milestoneA: { amountCop: number; status: MilestoneState };
  milestoneB: { amountCop: number; status: MilestoneState };
  milestoneC: { amountCop: number; status: MilestoneState };
  grossCop: number;
  paidCop: number;
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

export const TAX_RATES_BOGOTA = {
  DEFAULT_RETEFUENTE_RATE: 0.11, // 11% tarifa declarantes / honorarios
  ICA_BOGOTA_RATE: 0.00966       // 9.66 x 1000
} as const;

/**
 * Devuelve los montos oficiales de los 3 hitos según la política vigente (DEFAULT_SCOUT_POLICY).
 * Si el bar pertenece a una cohorte con acelerador (Tier 2 o Tier 3), aplica `accelerator_bps`.
 */
export function bounty(
  policy: ScoutPolicy = DEFAULT_SCOUT_POLICY,
  cohortTier: 1 | 2 | 3 = 1
): HitBreakdown {
  const multiplier = cohortTier >= 2 ? 1 + policy.accelerator_bps / 10000 : 1;
  const A = Math.round(policy.hit_a_cop * multiplier);
  const B = Math.round(policy.hit_b_cop * multiplier);
  const C = Math.round(policy.hit_c_cop * multiplier);
  return {
    A,
    B,
    C,
    total: A + B + C
  };
}

const ACCRUED_STATES: ReadonlySet<MilestoneState> = new Set([
  'accrued',
  'review',
  'payable'
]);

/**
 * Calcula los montos proyectado, devengado (accrued/review/payable) y pagado (paid)
 * para un lead. Si se proveen asientos de `commission_ledger`, la cifra devengada y pagada
 * coincide exactamente con la suma del ledger para ese lead y scout (desviación 0).
 */
export function accrued(
  lead: Lead,
  ledgerEntries?: LedgerEntry[],
  policy: ScoutPolicy = DEFAULT_SCOUT_POLICY
): LeadAccrualSummary {
  if (lead.status === 'archived') {
    return { devengado: 0, pagado: 0, proyectado: 0 };
  }

  const hits = bounty(policy, lead.cohort_tier || 1);
  const proyectado = hits.total;

  // Si se suministra el ledger real del scout, reconciliar directamente contra él
  if (Array.isArray(ledgerEntries) && ledgerEntries.length > 0) {
    const scoutUid = lead.scout_uid || lead.sales_uid;
    const matching = ledgerEntries.filter((e) => {
      const sameScout = !scoutUid || e.payee_uid === scoutUid;
      const sameLead =
        e.lead_id === lead.id ||
        (lead.venueId && e.venue_id === lead.venueId) ||
        (lead.venue_id && e.venue_id === lead.venue_id);
      return sameScout && sameLead;
    });

    if (matching.length > 0) {
      const devengado = matching
        .filter((e) => e.status === 'accrued' || e.status === 'review' || e.status === 'payable')
        .reduce((sum, e) => sum + (e.amount_gross_cop || 0), 0);
      const pagado = matching
        .filter((e) => e.status === 'paid')
        .reduce((sum, e) => sum + (e.amount_gross_cop || 0), 0);
      return { devengado, pagado, proyectado };
    }
  }

  if (lead.status !== 'signed' && !lead.milestone_status) {
    return { devengado: 0, pagado: 0, proyectado };
  }

  const ms = lead.milestone_status || {
    A: lead.status === 'signed' ? 'accrued' : 'not_eligible',
    B: 'not_eligible',
    C: 'not_eligible'
  };

  let devengado = 0;
  let pagado = 0;

  if (ACCRUED_STATES.has(ms.A)) devengado += hits.A;
  else if (ms.A === 'paid') pagado += hits.A;

  if (ACCRUED_STATES.has(ms.B)) devengado += hits.B;
  else if (ms.B === 'paid') pagado += hits.B;

  if (ACCRUED_STATES.has(ms.C)) devengado += hits.C;
  else if (ms.C === 'paid') pagado += hits.C;

  return { devengado, pagado, proyectado };
}

/**
 * Calcula el desglose detallado de comisión por hitos (A, B, C) e impuestos de referencia.
 */
export function calculateLeadCommission(
  lead: Lead,
  options: {
    applyWithholding?: boolean;
    withholdingRate?: number;
    policy?: ScoutPolicy;
  } = {}
): CommissionBreakdown {
  const policy = options.policy || DEFAULT_SCOUT_POLICY;
  const hits = bounty(policy, lead.cohort_tier || 1);

  const ms = lead.milestone_status || {
    A: lead.status === 'signed' ? 'accrued' : 'not_eligible',
    B: 'not_eligible',
    C: 'not_eligible'
  };

  const summary = accrued(lead, undefined, policy);
  const gross = summary.devengado + summary.pagado;
  const rate = options.withholdingRate ?? TAX_RATES_BOGOTA.DEFAULT_RETEFUENTE_RATE;
  const withholdingTaxCop = options.applyWithholding ? Math.round(gross * rate) : 0;
  const icaTaxCop = options.applyWithholding ? Math.round(gross * TAX_RATES_BOGOTA.ICA_BOGOTA_RATE) : 0;
  const netPayableCop = Math.max(0, gross - withholdingTaxCop - icaTaxCop);

  return {
    leadId: lead.id,
    leadName: lead.name || 'Sin nombre',
    baseCommissionCop: hits.total,
    milestoneA: { amountCop: hits.A, status: ms.A },
    milestoneB: { amountCop: hits.B, status: ms.B },
    milestoneC: { amountCop: hits.C, status: ms.C },
    grossCop: summary.devengado,
    paidCop: summary.pagado,
    withholdingTaxCop,
    icaTaxCop,
    netPayableCop
  };
}

/**
 * Calcula las métricas consolidadas del pipeline activo (excluyendo archivados).
 */
export function calculatePipelineSummary(
  leads: Lead[],
  ledgerEntries?: LedgerEntry[],
  policy: ScoutPolicy = DEFAULT_SCOUT_POLICY
): PipelineSummary {
  const activeLeads = leads.filter((l) => l.status !== 'archived');
  const totalLeads = activeLeads.length;
  let signedCount = 0;
  let negotiatingCount = 0;
  let prospectCount = 0;
  let totalProjectedCommissionsCop = 0;
  let totalAccruedCommissionsCop = 0;
  let totalPaidCommissionsCop = 0;

  for (const lead of activeLeads) {
    const summary = accrued(lead, ledgerEntries, policy);
    totalProjectedCommissionsCop += summary.proyectado;
    totalAccruedCommissionsCop += summary.devengado;
    totalPaidCommissionsCop += summary.pagado;

    if (lead.status === 'signed') {
      signedCount++;
    } else if (lead.status === 'negotiating') {
      negotiatingCount++;
    } else {
      prospectCount++;
    }
  }

  // Si hay asientos en el ledger que no están atados a un lead en memoria (ej. residuales), sumarlos
  if (Array.isArray(ledgerEntries) && ledgerEntries.length > 0) {
    const ledgerDev = ledgerEntries
      .filter((e) => e.status === 'accrued' || e.status === 'review' || e.status === 'payable')
      .reduce((s, e) => s + (e.amount_gross_cop || 0), 0);
    const ledgerPaid = ledgerEntries
      .filter((e) => e.status === 'paid')
      .reduce((s, e) => s + (e.amount_gross_cop || 0), 0);
    if (ledgerDev > totalAccruedCommissionsCop) totalAccruedCommissionsCop = ledgerDev;
    if (ledgerPaid > totalPaidCommissionsCop) totalPaidCommissionsCop = ledgerPaid;
  }

  const conversionRatePct =
    totalLeads > 0 ? Math.round((signedCount / totalLeads) * 1000) / 10 : 0;

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

/**
 * Normaliza un teléfono móvil colombiano a formato numérico internacional (`573XXXXXXXXX`)
 * para enlaces `https://wa.me/...`, evitando doble prefijo `57` y rechazando números inválidos.
 */
export function toWaPhone(raw?: string | null): string | null {
  if (!raw) return null;
  let digits = String(raw).replace(/\D/g, '');
  if (!digits) return null;

  // Quitar prefijo internacional 0057 o 57 cuando quedan los 10 dígitos del móvil CO
  if (digits.startsWith('0057') && digits.length === 14) {
    digits = digits.slice(4);
  } else if (digits.startsWith('57') && digits.length === 12) {
    digits = digits.slice(2);
  }

  if (!/^3\d{9}$/.test(digits)) {
    return null;
  }

  return `57${digits}`;
}
