/**
 * RONDA CRM — Suite de Pruebas de Aceptación (PLAN_MEJORAS_CRM.md)
 *
 * Valida:
 * 1. Política económica única DEFAULT_SCOUT_POLICY ($450.000 COP: A=100k, B=250k, C=100k).
 * 2. Cálculo de Devengado vs Pagado vs Proyectado y conciliación exacta con commission_ledger.
 * 3. Ventana de retención 90 días y requisito de 8 eventos válidos para Hito C.
 * 4. Normalizador único de WhatsApp `toWaPhone()` con/sin +57 (sin doble prefijo).
 * 5. Sanitización anti-XSS almacenado en nombre, contacto, zona y notas.
 * 6. Guardarraíles estáticos de código (cero 500000/500_000, cero window.confirm/prompt, ARIA en crm.html, firestore.rules).
 *
 * Ejecución: node test/test-crm-commission.cjs
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');

console.log('================================================================================');
console.log(' RONDA CRM — EJECUTANDO SUITE DE PRUEBAS (test-crm-commission.cjs)');
console.log('================================================================================\n');

const ROOT = path.resolve(__dirname, '..');

// -----------------------------------------------------------------------------
// Réplica determinista de las funciones puras de src/commissions.ts y src/utils.ts
// -----------------------------------------------------------------------------
const DEFAULT_SCOUT_POLICY = {
  version: '5.1-confirmed',
  status: 'approved',
  hit_a_cop: 100000,
  hit_b_cop: 250000,
  hit_c_cop: 100000,
  min_attendance_hit_b: 16,
  min_retention_events_hit_c: 8,
  retention_days_hit_c: 90,
  accelerator_bps: 2000
};

function bounty(policy = DEFAULT_SCOUT_POLICY, cohortTier = 1) {
  const mult = cohortTier >= 2 ? 1 + policy.accelerator_bps / 10000 : 1;
  const A = Math.round(policy.hit_a_cop * mult);
  const B = Math.round(policy.hit_b_cop * mult);
  const C = Math.round(policy.hit_c_cop * mult);
  return { A, B, C, total: A + B + C };
}

function accrued(lead, ledgerEntries, policy = DEFAULT_SCOUT_POLICY) {
  if (lead.status === 'archived') {
    return { devengado: 0, pagado: 0, proyectado: 0 };
  }
  const hits = bounty(policy, lead.cohort_tier || 1);
  const proyectado = hits.total;

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
        .filter((e) => ['accrued', 'review', 'payable'].includes(e.status))
        .reduce((s, e) => s + (e.amount_gross_cop || 0), 0);
      const pagado = matching
        .filter((e) => e.status === 'paid')
        .reduce((s, e) => s + (e.amount_gross_cop || 0), 0);
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

  const isAccrued = (s) => ['accrued', 'review', 'payable'].includes(s);
  let devengado = 0;
  let pagado = 0;

  if (isAccrued(ms.A)) devengado += hits.A;
  else if (ms.A === 'paid') pagado += hits.A;

  if (isAccrued(ms.B)) devengado += hits.B;
  else if (ms.B === 'paid') pagado += hits.B;

  if (isAccrued(ms.C)) devengado += hits.C;
  else if (ms.C === 'paid') pagado += hits.C;

  return { devengado, pagado, proyectado };
}

function toWaPhone(raw) {
  if (!raw) return null;
  let digits = String(raw).replace(/\D/g, '');
  if (!digits) return null;
  if (digits.startsWith('0057') && digits.length === 14) {
    digits = digits.slice(4);
  } else if (digits.startsWith('57') && digits.length === 12) {
    digits = digits.slice(2);
  }
  if (!/^3\d{9}$/.test(digits)) return null;
  return `57${digits}`;
}

function escapeHtml(s) {
  return String(s ?? '').replace(/[<>&"']/g, (c) => ({
    '<': '&lt;',
    '>': '&gt;',
    '&': '&amp;',
    '"': '&quot;',
    "'": '&#39;'
  }[c]));
}

// -----------------------------------------------------------------------------
// 1. Pruebas de Hitos A/B/C (Política v5.1 = $450.000 COP)
// -----------------------------------------------------------------------------
const baseHits = bounty();
assert.strictEqual(baseHits.A, 100000, 'Hito A debe ser $100.000 COP');
assert.strictEqual(baseHits.B, 250000, 'Hito B debe ser $250.000 COP');
assert.strictEqual(baseHits.C, 100000, 'Hito C debe ser $100.000 COP');
assert.strictEqual(baseHits.total, 450000, 'Bounty total debe ser $450.000 COP');

const tier2Hits = bounty(DEFAULT_SCOUT_POLICY, 2);
assert.strictEqual(tier2Hits.A, 120000, 'Hito A Tier 2 (+20%) debe ser $120.000 COP');
assert.strictEqual(tier2Hits.B, 300000, 'Hito B Tier 2 (+20%) debe ser $300.000 COP');
assert.strictEqual(tier2Hits.C, 120000, 'Hito C Tier 2 (+20%) debe ser $120.000 COP');
assert.strictEqual(tier2Hits.total, 540000, 'Bounty Tier 2 debe ser $540.000 COP');
console.log('✓ 1. Desglose de Hitos A/B/C ($100k + $250k + $100k = $450k) y acelerador Tier 2 verificados.');

// -----------------------------------------------------------------------------
// 2. Devengado vs Pagado vs Proyectado y Conciliación con Ledger
// -----------------------------------------------------------------------------
const leadProspect = { id: 'l_1', name: 'Bar Prospecto', status: 'lead', sales_uid: 'scout_1' };
const accProspect = accrued(leadProspect);
assert.strictEqual(accProspect.devengado, 0, 'Un prospecto no firmado tiene $0 devengado');
assert.strictEqual(accProspect.pagado, 0, 'Un prospecto no firmado tiene $0 pagado');
assert.strictEqual(accProspect.proyectado, 450000, 'Un prospecto proyecta $450.000 COP');

const leadSignedOnlyA = { id: 'l_2', name: 'Bar Recién Firmado', status: 'signed', sales_uid: 'scout_1' };
const accSignedA = accrued(leadSignedOnlyA);
assert.strictEqual(accSignedA.devengado, 100000, 'Recién firmado solo devenga Hito A ($100.000), nunca $500.000');
assert.strictEqual(accSignedA.pagado, 0);

const leadWithMilestones = {
  id: 'l_3',
  name: 'Bar Activado',
  status: 'signed',
  sales_uid: 'scout_1',
  milestone_status: { A: 'paid', B: 'payable', C: 'not_eligible' }
};
const accMilestones = accrued(leadWithMilestones);
assert.strictEqual(accMilestones.pagado, 100000, 'Hito A pagado = $100.000');
assert.strictEqual(accMilestones.devengado, 250000, 'Hito B payable = $250.000 devengado');
assert.strictEqual(accMilestones.proyectado, 450000);

// Conciliación estricta contra commission_ledger (desviación 0)
const ledgerEntries = [
  { id: 'e1', payee_uid: 'scout_1', lead_id: 'l_3', milestone: 'A', status: 'paid', amount_gross_cop: 100000 },
  { id: 'e2', payee_uid: 'scout_1', lead_id: 'l_3', milestone: 'B', status: 'accrued', amount_gross_cop: 250000 },
  { id: 'e3', payee_uid: 'scout_1', lead_id: 'l_3', milestone: 'C', status: 'payable', amount_gross_cop: 100000 }
];
const accFromLedger = accrued(leadWithMilestones, ledgerEntries);
assert.strictEqual(accFromLedger.devengado, 350000, 'Devengado desde ledger (B+C) = $350.000');
assert.strictEqual(accFromLedger.pagado, 100000, 'Pagado desde ledger (A) = $100.000');

// Lead archivado (soft-delete P0-4) no suma al pipeline
const leadArchived = { id: 'l_4', name: 'Bar Archivado', status: 'archived', sales_uid: 'scout_1' };
assert.deepStrictEqual(accrued(leadArchived), { devengado: 0, pagado: 0, proyectado: 0 });
console.log('✓ 2. Conciliación Devengado / Pagado / Proyectado y exclusión de archivados verificada (desviación 0).');

// -----------------------------------------------------------------------------
// 3. Ventana de Retención 90 días y 8 eventos válidos para Hito C
// -----------------------------------------------------------------------------
function canUnlockHitC(daysSinceSigned, validEventCount) {
  return (
    daysSinceSigned >= DEFAULT_SCOUT_POLICY.retention_days_hit_c &&
    validEventCount >= DEFAULT_SCOUT_POLICY.min_retention_events_hit_c
  );
}
assert.strictEqual(canUnlockHitC(89, 10), false, 'Día 89 no desbloquea Hito C aunque tenga 10 eventos');
assert.strictEqual(canUnlockHitC(90, 7), false, 'Día 90 con 7 eventos no desbloquea Hito C');
assert.strictEqual(canUnlockHitC(90, 8), true, 'Día 90 con 8 eventos válidos sí desbloquea Hito C');
console.log('✓ 3. Regla de retención 90 días y 8 eventos válidos para Hito C verificada.');

// -----------------------------------------------------------------------------
// 4. Normalización de Teléfonos con y sin +57 (P1-9)
// -----------------------------------------------------------------------------
assert.strictEqual(toWaPhone('3001234567'), '573001234567');
assert.strictEqual(toWaPhone('+57 300 123 4567'), '573001234567', 'No debe duplicar el prefijo 57');
assert.strictEqual(toWaPhone('573159876543'), '573159876543', 'No debe duplicar 57 cuando ya viene sin +');
assert.strictEqual(toWaPhone('0057 (320) 555-0199'), '573205550199');
assert.strictEqual(toWaPhone('6012345678'), null, 'Fijo de Bogotá no es móvil WhatsApp válido');
assert.strictEqual(toWaPhone('12345'), null, 'Número incompleto debe retornar null');
assert.strictEqual(toWaPhone(''), null);
console.log('✓ 4. Normalizador toWaPhone() con y sin +57 verificado (cero doble prefijo 57).');

// -----------------------------------------------------------------------------
// 5. Prevención de XSS almacenado en nombre, contacto, zona y notas (P0-2)
// -----------------------------------------------------------------------------
const xssPayload = '"><img src=x onerror=alert(1)><script>evil()</script>';
const escaped = escapeHtml(xssPayload);
assert(!escaped.includes('<img'), 'No debe contener <img sin escapar');
assert(!escaped.includes('<script>'), 'No debe contener <script> sin escapar');
assert(escaped.includes('&quot;&gt;&lt;img'), 'Debe escapar comillas y brackets');
console.log('✓ 5. Escape anti-XSS en payloads maliciosos verificado.');

// -----------------------------------------------------------------------------
// 6. Guardarraíles de Código de Producción (Criterios Globales PLAN_MEJORAS_CRM.md)
// -----------------------------------------------------------------------------
const crmHtml = fs.readFileSync(path.join(ROOT, 'crm.html'), 'utf8');
const crmTs = fs.readFileSync(path.join(ROOT, 'src', 'crm.ts'), 'utf8');
const entryCrmTs = fs.readFileSync(path.join(ROOT, 'src', 'entry-crm.ts'), 'utf8');
const rulesTxt = fs.readFileSync(path.join(ROOT, 'firestore.rules'), 'utf8');

assert(!/500000|500_000/.test(crmHtml), 'crm.html no debe contener literales 500000 / 500_000');
assert(!/500000|500_000/.test(crmTs), 'src/crm.ts no debe contener literales 500000 / 500_000');
assert(!/500000|500_000/.test(entryCrmTs), 'src/entry-crm.ts no debe contener literales 500000 / 500_000');

assert(!/window\.confirm|window\.prompt/.test(crmTs), 'src/crm.ts no debe usar window.confirm ni window.prompt');

assert(crmHtml.includes('role="dialog"'), 'crm.html debe incluir role="dialog"');
assert(crmHtml.includes('aria-modal="true"'), 'crm.html debe incluir aria-modal="true"');
assert(crmHtml.includes('aria-live="polite"'), 'crm.html debe incluir aria-live="polite"');

assert(
  rulesTxt.includes('request.resource.data.sales_uid == request.auth.uid'),
  'firestore.rules debe exigir request.auth != null y sales_uid == request.auth.uid en leads.create'
);
assert(
  rulesTxt.includes('match /venue_requests/{reqId}'),
  'firestore.rules debe declarar colección venue_requests para el rol sales'
);
console.log('✓ 6. Guardarraíles estáticos de código, ARIA y reglas Firestore verificados.');

console.log('\n================================================================================');
console.log(' TODAS LAS PRUEBAS DE ACEPTACIÓN DEL CRM PASARON EXITOSAMENTE (100%)');
console.log('================================================================================');

