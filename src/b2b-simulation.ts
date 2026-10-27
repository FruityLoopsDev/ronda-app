/**
 * src/b2b-simulation.ts — FASE 2: Lógica de Liquidación (Emuladores / Modo Simulación)
 *
 * Emulador determinista que ejercita el motor REAL (RondaB2BEngine) de punta a punta:
 *   1. verifyCompletedEvent(): consolida check-in vs transacciones pagadas reales.
 *   2. Motor de estado de Hitos: A (firma) -> B (activación 16+) -> C (retención 90d) + Residuales.
 *   3. Idempotencia: ledger con identificadores deterministas (A_lead, B_lead, residual_venueId_week).
 *   4. Emisión de pagos en SIMULACIÓN (referencias SIM-*, sin desembolso externo real).
 *
 * Módulo puro: sin Firestore, sin DOM, sin dependencias de Node types.
 * Ejecutar: node src/b2b-simulation.ts
 */

import { RondaB2BEngine, type VerificationResult } from './b2b-engine.ts';
import type { Lead, LedgerEntry, Payout, EventTicket } from './db.ts';

// --- Mini-assert (sin @types/node) ---
let passed = 0;
let failed = 0;
function check(cond: boolean, label: string): void {
  if (cond) {
    passed++;
    console.log(`  OK ${label}`);
  } else {
    failed++;
    console.error(`  FALLO: ${label}`);
  }
}
function section(title: string): void {
  console.log(`\n=== ${title} ===`);
}

// --- Ledger en memoria con idempotencia estricta ---
class SimLedger {
  entries: LedgerEntry[] = [];
  payouts: Payout[] = [];
  private keys = new Set<string>();

  /** Aplica un resultado del motor. Ignora claves ya causadas (idempotencia ante reintentos de red). */
  apply(result: VerificationResult): number {
    let added = 0;
    for (const e of result.ledgerEntries) {
      if (this.keys.has(e.idempotency_key)) continue;
      this.keys.add(e.idempotency_key);
      this.entries.push(e);
      added++;
    }
    return added;
  }

  hasKey(key: string): boolean {
    return this.keys.has(key);
  }

  byMilestone(milestone: LedgerEntry['milestone']): LedgerEntry[] {
    return this.entries.filter(e => e.milestone === milestone);
  }

  unpaidOf(payeeUid: string): LedgerEntry[] {
    return this.entries.filter(e => e.payee_uid === payeeUid && e.status !== 'paid' && e.status !== 'void');
  }

  netOf(payeeUid: string): number {
    return this.entries.filter(e => e.payee_uid === payeeUid).reduce((s, e) => s + e.amount_gross_cop, 0);
  }
}

/** Simula el paso del tiempo: madura 'accrued' -> 'payable' al vencer payable_after (ventana antifraude de 7 días). */
function mature(entries: LedgerEntry[], asOfIso: string): void {
  const asOf = new Date(asOfIso).getTime();
  for (const e of entries) {
    if (e.status === 'accrued' && e.payable_after && new Date(e.payable_after).getTime() <= asOf) {
      e.status = 'payable';
    }
  }
}

// --- Motor y estado de la simulación ---
const engine = new RondaB2BEngine();
const ledger = new SimLedger();

const SUPERADMIN = 'uid_superadmin_1';
const SCOUT = 'uid_scout_maria';
const HOST = 'uid_host_jorge';

// Fechas fijas: 2026-03-03 martes, 03-05 jueves, 03-09 lunes, 03-10 martes, 03-11 miércoles, 03-12 jueves
const VERIFIED_AT = '2026-03-03T17:00:00.000Z';
const EV1_ISO = '2026-03-05T20:00:00.000Z';
const EV_MON_ISO = '2026-03-09T20:00:00.000Z';
const EV2_ISO = '2026-03-10T20:00:00.000Z';
const EV4_ISO = '2026-03-11T20:00:00.000Z';
const EV3_ISO = '2026-03-12T20:00:00.000Z';
const FOUNDER_EV_ISO = '2026-04-07T20:00:00.000Z';
const DAY_59_ISO = '2026-05-01T17:00:00.000Z';
const DAY_90_ISO = '2026-06-01T17:00:00.000Z';
const MATURE_ISO = '2026-06-01T18:00:00.000Z';

let lead: Lead = {
  id: 'lead_1',
  name: 'Bar Test — Zona G',
  contactName: 'Ana Administradora',
  status: 'lead',
  sales_uid: SCOUT,
  scout_uid: SCOUT,
  venue_id: 'venue_1',
  commission: 22500
};

function attendees(count: number, eventIso: string): EventTicket[] {
  const tickets: EventTicket[] = [];
  for (let i = 1; i <= count; i++) {
    tickets.push({
      ticket_id: `tk_${eventIso}_${i}`,
      event_id: `ev_${eventIso}`,
      attendee_uid: `att_${eventIso}_${i}`,
      purchaser_uid: `att_${eventIso}_${i}`,
      transaction_id: `tx_${eventIso}_${i}`,
      payment_state: 'paid',
      checked_in_at: eventIso,
      ip_address: `200.10.1.${i}`
    });
  }
  return tickets;
}

/** Convierte el Set de claves idempotentes del ledger a la forma que espera el motor. */
function keys(): Set<string> {
  return (ledger as any).keys as Set<string>;
}


console.log('RONDA B2B — FASE 2: Simulación de Hitos y Pagos (Motor Real RondaB2BEngine)');

// -----------------------------------------------
// 1. Hito A — Verificación independiente + firma
// -----------------------------------------------
section('Hito A: Verificación del Bar (idempotencia A_lead_1)');
const resA = engine.verifyVenue(lead, { bar_package_price_cop: 22000 }, SUPERADMIN, {
  independentVerificationPassed: true,
  authorizedSignature: true
});
check(resA.success, 'Verificación aprobada (independiente + firma autorizada)');
check(ledger.apply(resA) === 1, 'Ledger: 1 asiento Hito A causado');
check(!!resA.leadUpdates && resA.leadUpdates.milestone_status?.A === 'accrued', 'Lead milestone A = accrued');
check(ledger.apply(resA) === 0, 'Re-ejecución (doble clic / reintento): 0 asientos duplicados');
check(ledger.hasKey('A_lead_1'), 'Clave determinista A_lead_1 presente');

const resCap = engine.verifyVenue(lead, { bar_package_price_cop: 25000 }, SUPERADMIN, {
  independentVerificationPassed: true,
  authorizedSignature: true
});
check(!resCap.success, 'Paquete > 22.500 COP rechazado por el tope confirmado');

lead = {
  ...lead,
  ...resA.leadUpdates,
  status: 'signed',
  verified_at: VERIFIED_AT,
  signed_at: VERIFIED_AT
} as Lead;

// -----------------------------------------------
// 2. Conciliación de pagos — check-in vs transacciones reales
// -----------------------------------------------
section('Conciliación de pagos: compra grupal con free/refunded/duplicados');
const order = engine.reconcilePayment({
  transactionId: 'tx_grupal_1',
  purchaserUid: 'buyer_1',
  eventId: 'ev_reconciled',
  paidAmountCop: 16 * 75000,
  ipAddress: '190.45.1.10',
  tickets: [
    ...Array.from({ length: 16 }, (_, i) => ({
      attendeeUid: `att_ok_${i}`,
      ticketId: `tk_ok_${i}`,
      paymentState: 'paid' as const
    })),
    { attendeeUid: 'att_free', ticketId: 'tk_free', paymentState: 'free' as const },
    { attendeeUid: 'att_refund', ticketId: 'tk_refund', paymentState: 'refunded' as const },
    { attendeeUid: 'att_ok_0', ticketId: 'tk_dup', paymentState: 'paid' as const },
    { attendeeUid: 'att_fail', ticketId: 'tk_fail', paymentState: 'failed' as const }
  ]
});
check(order.validTickets.length === 16, '16 tickets válidos (free, refunded, duplicado y failed excluidos)');
check(order.requiresReview, 'Señal de revisión activada por exclusiones');

// -----------------------------------------------
// 3. Hito B — 15 asistentes NO activan; 16 SÍ
// -----------------------------------------------
section('Hito B: aforo real vs pago (15 vs 16 asistentes)');
const ev1 = { id: 'ev_15', venue_id: 'venue_1', scheduled_at: EV1_ISO, host_uid: HOST };
const resB15 = engine.verifyCompletedEvent(ev1, lead, attendees(15, EV1_ISO), SUPERADMIN, keys());
check(!resB15.success, '15 asistentes pagados con check-in NO activan el Hito B');
check(!ledger.hasKey('B_lead_1'), 'Sin clave B_lead_1 con 15 asistentes');
check(resB15.ledgerEntries.some(e => e.milestone === 'host_base' && e.amount_gross_cop === 250000),
  'Honorario Hoster 250.000 COP SÍ emitido (independiente del aforo)');
ledger.apply(resB15);

const resMon = engine.verifyCompletedEvent(
  { id: 'ev_lunes', venue_id: 'venue_1', scheduled_at: EV_MON_ISO },
  lead,
  attendees(20, EV_MON_ISO),
  SUPERADMIN,
  keys()
);
check(!resMon.success && (resMon.reason || '').includes('no operativo'), 'Evento en lunes rechazado (solo mar/mié/jue)');
ledger.apply(resMon);

const ev2 = { id: 'ev_2', venue_id: 'venue_1', scheduled_at: EV2_ISO, host_uid: HOST };
const ticketsEv2: EventTicket[] = order.validTickets.map(t => ({ ...t, checked_in_at: EV2_ISO }));
const resB16 = engine.verifyCompletedEvent(ev2, lead, ticketsEv2, SUPERADMIN, keys());
check(resB16.success, '16 asistentes pagados con check-in ÚNICO activan el Hito B');
check(ledger.apply(resB16) === 2, 'Ledger: B_lead_1 + host_base_ev_2 causados');
check(ledger.hasKey('B_lead_1'), 'Clave determinista B_lead_1 presente');
check(!!resB16.leadUpdates && resB16.leadUpdates.milestone_status?.B === 'accrued', 'Lead milestone B = accrued');
check(resB16.leadUpdates?.first_valid_event_at === EV2_ISO, 'first_valid_event_at registrado');
check(ledger.apply(resB16) === 0, 'Re-ejecución (doble clic / reintento): 0 asientos duplicados');
lead = { ...lead, ...resB16.leadUpdates } as Lead;

const resFounder = engine.verifyCompletedEvent(
  { id: 'ev_founder', venue_id: 'venue_1', scheduled_at: FOUNDER_EV_ISO, host_uid: HOST, founder_mode: true },
  lead,
  attendees(18, FOUNDER_EV_ISO),
  SUPERADMIN,
  keys()
);
const founderEntry = resFounder.ledgerEntries.find(e => e.milestone === 'host_base');
check(resFounder.success && founderEntry?.amount_gross_cop === 0 && founderEntry.status === 'void',
  'Evento fundador: asiento analítico 0 COP / status void (caja $0)');
ledger.apply(resFounder);
lead = { ...lead, ...resFounder.leadUpdates } as Lead;

// -----------------------------------------------
// 4. Hito C — Retención 90 días
// -----------------------------------------------
section('Hito C: retención al día 90 (8 eventos, bar activo)');
const resEarly = engine.evaluateRetention(lead, DAY_59_ISO, 8, true, false);
check(!resEarly.success && (resEarly.reason || '').includes('90'), 'Día 59: rechazado (ventana en progreso)');

const resC = engine.evaluateRetention(lead, DAY_90_ISO, 8, true, false);
check(resC.success, 'Día 90 exacto con 8 eventos y bar activo: Hito C devengado');
check(ledger.apply(resC) === 1, 'Ledger: C_lead_1 causado');
check(ledger.hasKey('C_lead_1'), 'Clave determinista C_lead_1 presente');
check(ledger.apply(resC) === 0, 'Re-ejecución del corte: 0 duplicados');
check(!!resC.leadUpdates && resC.leadUpdates.milestone_status?.C === 'payable', 'Lead milestone C = payable');
lead = { ...lead, ...resC.leadUpdates } as Lead;

check(!engine.evaluateRetention(lead, DAY_90_ISO, 7, true, false).success, 'C rechazado con 7 eventos (< 8)');
check(!engine.evaluateRetention(lead, DAY_90_ISO, 8, false, false).success, 'C rechazado si el bar está inactivo');
check(!engine.evaluateRetention(lead, DAY_90_ISO, 8, true, true).success, 'C rechazado con revisión de riesgo abierta');

// -----------------------------------------------
// 5. Residuales semanales — 1/semana, tope 12, ventana 6 meses
// -----------------------------------------------
section('Residuales semanales (máx 1/semana, tope 12, ventana 6m)');
const residualEvents = [
  { id: 'ev_4', scheduled_at: EV4_ISO, attendance: 14, isFirstActivationEvent: false },
  { id: 'ev_3', scheduled_at: EV3_ISO, attendance: 12, isFirstActivationEvent: false }
];
const resR1 = engine.closeWeeklyResiduals('venue_1', lead, [residualEvents[1]], keys());
check(resR1.success, 'Residual semanal causado por el primer evento elegible (jue 12-mar)');
check(ledger.apply(resR1) === 1, 'Ledger: 1 residual causado');
const residualKey = ledger.entries.find(e => e.milestone === 'residual')?.idempotency_key || '';
check(/^residual_venue_1_\d{4}-W\d{2}$/.test(residualKey), `Clave determinista ${residualKey}`);

const resR2 = engine.closeWeeklyResiduals('venue_1', lead, residualEvents, keys());
check(!resR2.success && (resR2.reason || '').includes('ya causado'), 'Segundo evento en la MISMA semana: bloqueado (1/semana)');
check(ledger.apply(resR2) === 0, 'Sin asientos nuevos en re-ejecución semanal');

const cappedLead: Lead = { ...lead, residual_accrued_count: 12 };
const resCapR = engine.closeWeeklyResiduals('venue_1', cappedLead, residualEvents, new Set<string>());
check(!resCapR.success && (resCapR.reason || '').includes('12'), 'Tope de 12 residuales respetado');

const outOfWindow = [
  { id: 'ev_late', scheduled_at: '2026-10-07T20:00:00.000Z', attendance: 14, isFirstActivationEvent: false }
];
const resWindow = engine.closeWeeklyResiduals('venue_1', lead, outOfWindow, keys());
check(!resWindow.success, 'Residual fuera de la ventana de 6 meses: rechazado');

// -----------------------------------------------
// 6. Cohortes mensuales — Tiers / aceleradores
// -----------------------------------------------
section('Cohortes mensuales: Tier 2 (4 bares) con acelerador +20%');
const monthLeads: Lead[] = [1, 2, 3, 4].map(i => ({
  id: `lead_${i}`,
  name: `Bar ${i}`,
  contactName: `Contacto ${i}`,
  status: 'signed' as const,
  sales_uid: SCOUT,
  commission: 22500,
  venue_id: `venue_${i}`
}));
const resT = engine.closeMonthlyCohorts(SCOUT, '2026-03', monthLeads, new Set<string>());
check(resT.success && resT.ledgerEntries.length === 4, '4 ajustes de cohorte generados (Tier 2)');
check(resT.ledgerEntries.every(e => e.amount_gross_cop === 70000), 'Acelerador +20% sobre A+B = 70.000 COP c/u');
check(ledger.apply(resT) === 4, 'Ledger: 4 ajustes aplicados');
check(ledger.apply(resT) === 0, 'Ajustes idempotentes (clave cohort_adj_lead_T2)');

// -----------------------------------------------
// 7. Emisión de PAGOS EN SIMULACIÓN
// -----------------------------------------------
section('Pagos en simulación (referencias SIM-*, sin desembolso externo)');
mature(ledger.entries, MATURE_ISO); // Vence la ventana antifraude de 7 días del Hito B

const scoutUnpaid = ledger.unpaidOf(SCOUT);
check(scoutUnpaid.length > 0, `Scout tiene ${scoutUnpaid.length} asientos pagaderos`);

function expectThrow(fn: () => void, label: string): void {
  let threw = false;
  try { fn(); } catch { threw = true; }
  check(threw, label);
}

expectThrow(
  () => engine.approvePayout(scoutUnpaid, 'uid_sales_1', 'sales', 'SIM-001', true, { rutVerified: true, pilaVerified: true }),
  'ROL incorrecto no puede aprobar desembolso (solo superadmin)'
);
expectThrow(
  () => engine.approvePayout(scoutUnpaid, SUPERADMIN, 'superadmin', 'SIM-001', true, { rutVerified: false, pilaVerified: true }),
  'RUT sin verificar bloquea el desembolso'
);
expectThrow(
  () => engine.approvePayout(scoutUnpaid, SUPERADMIN, 'superadmin', 'SIM-001', true, { rutVerified: true, pilaVerified: false }),
  'PILA sin verificar bloquea el desembolso'
);
expectThrow(
  () => engine.approvePayout(scoutUnpaid, SUPERADMIN, 'superadmin', '  ', true, { rutVerified: true, pilaVerified: true }),
  'Referencia de transferencia vacía bloquea el desembolso'
);

// Pago real en simulación: Scout
const scoutGrossBefore = scoutUnpaid.reduce((s, e) => s + e.amount_gross_cop, 0);
const payoutScout = engine.approvePayout(scoutUnpaid, SUPERADMIN, 'superadmin', 'SIM-2026-06-SCOUT-001', true, {
  rutVerified: true,
  pilaVerified: true,
  taxIdNumber: 'COL-SIM-12345678'
});
ledger.payouts.push(payoutScout.payout);
for (const u of payoutScout.updatedEntries) {
  const idx = ledger.entries.findIndex(e => e.id === u.id);
  if (idx >= 0) ledger.entries[idx] = u;
}
check(!!payoutScout.payout.transfer_reference?.startsWith('SIM-'),
  `Payout Scout emitido en SIMULACIÓN (${payoutScout.payout.transfer_reference})`);
check(payoutScout.payout.net_cop === scoutGrossBefore, `Neto Scout = ${scoutGrossBefore.toLocaleString('es-CO')} COP`);
check(payoutScout.updatedEntries.every(e => e.status === 'paid' && !!e.payout_id), 'Asientos marcados paid con payout_id');
check(ledger.unpaidOf(SCOUT).length === 0, 'Scout sin asientos pendientes (doble clic = 0 pagos duplicados)');

// Pago en simulación: Hoster
const hostUnpaid = ledger.unpaidOf(HOST);
const hostGross = hostUnpaid.reduce((s, e) => s + e.amount_gross_cop, 0);
const payoutHost = engine.approvePayout(hostUnpaid, SUPERADMIN, 'superadmin', 'SIM-2026-06-HOST-001', true, {
  rutVerified: true,
  pilaVerified: true
});
ledger.payouts.push(payoutHost.payout);
for (const u of payoutHost.updatedEntries) {
  const idx = ledger.entries.findIndex(e => e.id === u.id);
  if (idx >= 0) ledger.entries[idx] = u;
}
check(hostUnpaid.every(e => e.milestone === 'host_base'),
  `Hoster: ${hostUnpaid.length} honorarios base (evento fundador excluido por status void)`);
check(hostGross === 500000, `Hoster = ${hostGross.toLocaleString('es-CO')} COP (2 eventos × 250.000; aforo independiente)`);

// -----------------------------------------------
// 8. Asiento contrario (reverso auditado)
// -----------------------------------------------
section('Reverso auditado sin borrar historial');
const entryB = ledger.byMilestone('B')[0];
const reversal = engine.processReversal(entryB, 'Auditoría interna: ajuste de duplicidad de convenio', SUPERADMIN);
check(reversal.amount_gross_cop === -250000 && reversal.original_entry_id === entryB.id,
  'Reverso -250.000 COP enlazado al original');
check(ledger.apply({ success: true, ledgerEntries: [reversal] }) === 1, 'Reverso aplicado (clave rev_ledg_B_lead_1)');
check(ledger.apply({ success: true, ledgerEntries: [reversal] }) === 0, 'Reverso idempotente');
check(!!ledger.entries.find(e => e.id === entryB.id), 'El asiento original NUNCA se elimina');

// -----------------------------------------------
// Resumen contable
// -----------------------------------------------
section('Resumen contable de la simulación');
const netScout = ledger.netOf(SCOUT);
const netHost = ledger.netOf(HOST);
console.log(`  Scout  (${SCOUT}): bruto ${scoutGrossBefore.toLocaleString('es-CO')} | reversos -250.000 | neto ${netScout.toLocaleString('es-CO')} COP`);
console.log(`  Hoster (${HOST}): bruto ${hostGross.toLocaleString('es-CO')} | neto ${netHost.toLocaleString('es-CO')} COP`);
console.log(`  Payouts emitidos (SIM): ${ledger.payouts.length} → ${ledger.payouts.map(p => p.transfer_reference).join(', ')}`);
console.log(`  Asientos totales en ledger: ${ledger.entries.length}`);

check(netScout === scoutGrossBefore - 250000, 'Cuadre contable Scout: bruto − reverso = neto');
check(netHost === 500000, 'Cuadre contable Hoster: 500.000 COP netos');

console.log(`\n==========================================`);
console.log(` ${passed} verificaciones OK, ${failed} fallos`);
console.log(`==========================================`);
if (failed > 0) {
  throw new Error(`${failed} verificaciones fallidas en la simulación Fase 2`);
}
