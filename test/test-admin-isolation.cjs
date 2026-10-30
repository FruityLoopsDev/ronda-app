/**
 * RONDA /admin — Test Suite Automatizado de Autorización por Establecimiento y Aislamiento (Paso 3)
 * Ejecución: node test/test-admin-isolation.cjs
 */

const assert = require('assert');

console.log("================================================================================");
console.log(" RONDA /admin — SUITE DE PRUEBAS DE AISLAMIENTO Y AUTORIZACIÓN POR LOCAL (PASO 3)");
console.log("================================================================================\n");

// --- 1. Simulación de la regla helper isVenueStaff(venueId) de firestore.rules ---
function evaluateIsVenueStaff(auth, userDoc, targetVenueId) {
  if (!auth) return false;
  const isSuperAdmin = userDoc && userDoc.role === 'superadmin';
  if (isSuperAdmin) return true;

  const isAdmin = userDoc && userDoc.role === 'admin';
  if (!isAdmin) return false;

  const directVenue = userDoc.venueId || '';
  const venueList = Array.isArray(userDoc.venueIds) ? userDoc.venueIds : [];

  return directVenue === targetVenueId || venueList.includes(targetVenueId);
}

// CASO 1: SuperAdmin accede a cualquier local
assert.strictEqual(
  evaluateIsVenueStaff({ uid: 'super-1' }, { role: 'superadmin' }, 'caronte'),
  true,
  "SuperAdmin debe tener acceso al local 'caronte'"
);
assert.strictEqual(
  evaluateIsVenueStaff({ uid: 'super-1' }, { role: 'superadmin' }, 'salto-del-angel'),
  true,
  "SuperAdmin debe tener acceso al local 'salto-del-angel'"
);
console.log("✓ Prueba 1 superada: SuperAdmin posee autorización global e irrestricta.");

// CASO 2: Anfitrión asignado a Caronte
const hostCaronte = {
  uid: 'host-caronte-01',
  role: 'admin',
  venueId: 'caronte',
  venueCapabilities: ['read', 'reception', 'operation']
};

assert.strictEqual(
  evaluateIsVenueStaff({ uid: hostCaronte.uid }, hostCaronte, 'caronte'),
  true,
  "Anfitrión de Caronte debe tener acceso a 'caronte'"
);
assert.strictEqual(
  evaluateIsVenueStaff({ uid: hostCaronte.uid }, hostCaronte, 'salto-del-angel'),
  false,
  "Anfitrión de Caronte NO debe tener acceso a 'salto-del-angel'"
);
console.log("✓ Prueba 2 superada: Anfitrión de Caronte aislado. Rechaza accesos a Salto del Ángel.");

// CASO 3: Anfitrión multi-sede (red o cadena con venueIds)
const hostMulti = {
  uid: 'host-multi-01',
  role: 'admin',
  venueId: 'caronte',
  venueIds: ['caronte', 'zona-g-bar']
};

assert.strictEqual(
  evaluateIsVenueStaff({ uid: hostMulti.uid }, hostMulti, 'caronte'),
  true,
  "Anfitrión multi-sede accede a local primario"
);
assert.strictEqual(
  evaluateIsVenueStaff({ uid: hostMulti.uid }, hostMulti, 'zona-g-bar'),
  true,
  "Anfitrión multi-sede accede a local secundario autorizado"
);
assert.strictEqual(
  evaluateIsVenueStaff({ uid: hostMulti.uid }, hostMulti, 'otro-bar'),
  false,
  "Anfitrión multi-sede es bloqueado en locales no autorizados"
);
console.log("✓ Prueba 3 superada: Matriz multi-sede respeta whitelist estricta.");

// --- 2. Validación de Inmutabilidad de Campos Fiscales y Contractuales en Venues ---
function validateVenueUpdatePermitted(userDoc, targetVenueId, originalVenue, updatedVenue) {
  const isStaffOfVenue = evaluateIsVenueStaff({ uid: userDoc.uid }, userDoc, targetVenueId);
  if (!isStaffOfVenue) return false;

  if (userDoc.role === 'superadmin') return true;

  // Si es admin del local, se prohíbe alterar campos sensibles
  const protectedFields = [
    'nit', 'origin_scout_uid', 'affiliation_status',
    'contract_id', 'territorial_terms', 'bar_package_price_cop'
  ];

  for (const field of protectedFields) {
    if (updatedVenue[field] !== undefined && updatedVenue[field] !== originalVenue[field]) {
      return false; // Intento de violación
    }
  }

  return true;
}

const venueOriginal = {
  id: 'caronte',
  name: 'Caronte Bar',
  nit: '901.888.777-1',
  origin_scout_uid: 'scout-007',
  affiliation_status: 'active',
  contract_id: 'CTR-2026-001',
  bar_package_price_cop: 22500,
  description: 'Bar de coctelería de autor'
};

// Intento legítimo: Anfitrión actualiza descripción y fotos
const venueLegitUpdate = {
  ...venueOriginal,
  description: 'Coctelería de autor y jazz en vivo los martes',
  photos: ['https://ronda.uno/photos/caronte-1.jpg']
};
assert.strictEqual(
  validateVenueUpdatePermitted(hostCaronte, 'caronte', venueOriginal, venueLegitUpdate),
  true,
  "Anfitrión debe poder actualizar descripción y fotos operativas"
);

// Intento malicioso: Anfitrión intenta cambiar su NIT o scout
const venueFraudUpdate = {
  ...venueOriginal,
  nit: '800.000.000-0'
};
assert.strictEqual(
  validateVenueUpdatePermitted(hostCaronte, 'caronte', venueOriginal, venueFraudUpdate),
  false,
  "Anfitrión NO puede alterar NIT fiscal del local"
);

const venueFraudPackage = {
  ...venueOriginal,
  bar_package_price_cop: 999999
};
assert.strictEqual(
  validateVenueUpdatePermitted(hostCaronte, 'caronte', venueOriginal, venueFraudPackage),
  false,
  "Anfitrión NO puede auto-alterar precio del paquete de barra"
);
console.log("✓ Prueba 4 superada: Blindaje fiscal y contractual de venues verificado.");

// --- 3. Prevención de Auto-Elevación de Privilegios en User Document ---
function validateUserUpdateByAdmin(adminDoc, targetUserOriginal, targetUserUpdated) {
  if (adminDoc.role === 'superadmin') return true;

  if (adminDoc.role !== 'admin') return false;

  // Admin solo puede alterar campos de check-in / entrada en puerta
  const forbiddenTouched = [
    'role', 'venueId', 'venueIds', 'venueCapabilities',
    'trustTier', 'verifications', 'nfts', 'wallet_address', 'matches'
  ];

  for (const f of forbiddenTouched) {
    if (targetUserUpdated[f] !== undefined && targetUserUpdated[f] !== targetUserOriginal[f]) {
      return false; // Intento de escalamiento
    }
  }

  return true;
}

// Admin hace check-in a un asistente
const clientOriginal = {
  uid: 'client-1',
  role: 'client',
  checkedIn: false,
  trustTier: 2
};
const clientCheckedIn = {
  ...clientOriginal,
  checkedIn: true
};
assert.strictEqual(
  validateUserUpdateByAdmin(hostCaronte, clientOriginal, clientCheckedIn),
  true,
  "Anfitrión puede registrar check-in de asistente en puerta"
);

// Admin intenta auto-elevarse a superadmin o auto-otorgarse KYC
const adminSelfEscalate = {
  ...hostCaronte,
  role: 'superadmin'
};
assert.strictEqual(
  validateUserUpdateByAdmin(hostCaronte, hostCaronte, adminSelfEscalate),
  false,
  "Anfitrión NO puede auto-escalar su rol a superadmin"
);

const adminReassignVenue = {
  ...hostCaronte,
  venueId: 'salto-del-angel'
};
assert.strictEqual(
  validateUserUpdateByAdmin(hostCaronte, hostCaronte, adminReassignVenue),
  false,
  "Anfitrión NO puede auto-asignarse a otro local"
);
console.log("✓ Prueba 5 superada: Intento de auto-elevación o reasignación de local estrictamente bloqueado.");

// --- 4. Pruebas de Eventos y Salas ---
function validateEventOperation(userDoc, eventDoc) {
  if (userDoc.role === 'superadmin') return true;
  if (userDoc.role !== 'admin') return false;
  return evaluateIsVenueStaff({ uid: userDoc.uid }, userDoc, eventDoc.venueId);
}

const eventCaronte = { id: 'evt-caronte-1', venueId: 'caronte', status: 'waiting' };
const eventSalto = { id: 'evt-salto-1', venueId: 'salto-del-angel', status: 'waiting' };

assert.strictEqual(validateEventOperation(hostCaronte, eventCaronte), true, "Anfitrión opera evento de su local");
assert.strictEqual(validateEventOperation(hostCaronte, eventSalto), false, "Anfitrión NO puede operar evento de local ajeno");
console.log("✓ Prueba 6 superada: Operación en sala aislada por venueId.");

console.log("\n================================================================================");
console.log(" ✅ TODAS LAS PRUEBAS DE AISLAMIENTO POR LOCAL (PASO 3) PASARON CON ÉXITO");
console.log("================================================================================");
