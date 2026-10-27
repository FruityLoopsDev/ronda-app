/**
 * Test automatizado de integridad y seguridad ($0 sin Cloud Functions)
 */
const assert = require('assert');
const crypto = require('crypto');

console.log("=== Ejecutando pruebas automatizadas de seguridad e integridad ($0) ===");

// 1. Prueba de lógica de matching mutuo (reemplazo de Cloud Function processEventMatches)
function findMutualMatchesFromLikes(likesList) {
  const likeMap = new Map();
  for (const item of likesList) {
    if (item.like === true && item.from && item.to) {
      likeMap.set(`${item.from}_${item.to}`, true);
    }
  }

  const matches = [];
  likeMap.forEach((_, key) => {
    const [from, to] = key.split('_');
    if (likeMap.has(`${to}_${from}`)) {
      if (from < to) {
        matches.push({ user1: from, user2: to });
      }
    }
  });

  return matches;
}

const mockLikes = [
  { from: 'u1', to: 'u2', like: true },
  { from: 'u2', to: 'u1', like: true },  // Match 1: u1 y u2
  { from: 'u1', to: 'u3', like: true },
  { from: 'u3', to: 'u1', like: false }, // No match: u3 dijo false
  { from: 'u4', to: 'u5', like: true },
  { from: 'u5', to: 'u4', like: true },  // Match 2: u4 y u5
  { from: 'u2', to: 'u4', like: true }   // No match: u4 no le dio like a u2
];

const matchesFound = findMutualMatchesFromLikes(mockLikes);
assert.strictEqual(matchesFound.length, 2, "Deben encontrarse exactamente 2 matches mutuos");
assert.deepStrictEqual(matchesFound[0], { user1: 'u1', user2: 'u2' });
assert.deepStrictEqual(matchesFound[1], { user1: 'u4', user2: 'u5' });
console.log("✓ Prueba 1 superada: Cálculo de matches mutuos autónomo ($0) correcto y deduplicado.");

// 2. Prueba de regla de expiración lógica de Chat (72 horas)
function isChatAccessible(requestTime, expiresAt, participants, authUid, isStaff) {
  if (isStaff) return true;
  const isParticipant = participants.includes(authUid);
  const isNotExpired = requestTime < expiresAt;
  return isParticipant && isNotExpired;
}

const now = Date.now();
const expiresAt = now + (72 * 60 * 60 * 1000);
const participants = ['user_alpha', 'user_beta'];

// Caso A: participante dentro de 72 horas
assert.strictEqual(isChatAccessible(now + 1000, expiresAt, participants, 'user_alpha', false), true, "Participante activo debe tener acceso");
// Caso B: tercero no participante
assert.strictEqual(isChatAccessible(now + 1000, expiresAt, participants, 'user_gamma', false), false, "Tercero debe ser rechazado");
// Caso C: después de 72 horas y 1 segundo
assert.strictEqual(isChatAccessible(expiresAt + 1000, expiresAt, participants, 'user_alpha', false), false, "Chat vencido (72h) debe ser bloqueado");
// Caso D: staff de soporte en caso de auditoría
assert.strictEqual(isChatAccessible(expiresAt + 1000, expiresAt, participants, 'staff_admin', true), true, "Staff debe tener acceso para moderación");
console.log("✓ Prueba 2 superada: Regla de expiración lógica de chat 72h verificada en todos los casos de uso.");

// 3. Prueba de generación de certificados criptográficos Proof-of-Attendance
function generateAttendanceCertificate(eventId, uid, eventName, venueName) {
  const timestamp = Date.now();
  const randomBytes = crypto.randomBytes(16);
  const proofHash = "0x" + randomBytes.toString('hex');
  return {
    tokenId: `POAP-${eventId.substring(0, 6)}-${timestamp.toString().slice(-4)}`,
    evento_nombre: eventName,
    fecha: new Date().toLocaleDateString('es-CO'),
    image_url: '/assets/ronda-token-badge.png',
    proofHash,
    venue: venueName,
    issuedAt: timestamp
  };
}

const cert = generateAttendanceCertificate('event_bogota_01', 'user_test_99', 'Ronda #1 Zona G', 'CARONTE Gastrobar');
assert(cert.tokenId.startsWith('POAP-event_'));
assert(cert.proofHash.startsWith('0x') && cert.proofHash.length === 34);
assert.strictEqual(cert.venue, 'CARONTE Gastrobar');
console.log("✓ Prueba 3 superada: Emisión de certificados digitales locales Proof-of-Attendance generados sin gas.");

// 4. Prueba de matriz RBAC en navegación
function validateAccess(viewId, role) {
  if (viewId === 'view-admin' && role !== 'admin' && role !== 'superadmin') return false;
  if (viewId === 'view-superadmin' && role !== 'superadmin') return false;
  if (viewId === 'view-crm' && role !== 'sales' && role !== 'superadmin') return false;
  if (viewId === 'view-network' && role !== 'network' && role !== 'superadmin') return false;
  return true;
}

assert.strictEqual(validateAccess('view-admin', 'client'), false);
assert.strictEqual(validateAccess('view-admin', 'admin'), true);
assert.strictEqual(validateAccess('view-superadmin', 'admin'), false);
assert.strictEqual(validateAccess('view-superadmin', 'superadmin'), true);
assert.strictEqual(validateAccess('view-crm', 'sales'), true);
assert.strictEqual(validateAccess('view-crm', 'client'), false);
assert.strictEqual(validateAccess('view-network', 'network'), true);
assert.strictEqual(validateAccess('view-network', 'client'), false);
assert.strictEqual(validateAccess('view-lobby', 'client'), true);
console.log("✓ Prueba 4 superada: Matriz RBAC restringe vistas sensibles y permite vistas públicas/cliente.");

console.log("\n✅ TODAS LAS PRUEBAS AUTOMATIZADAS DE SEGURIDAD E INTEGRIDAD PASARON CON ÉXITO.");

// 5. Prueba de actualización parcial de perfil (updateUserProfile) y reglas de seguridad Firestore
const CLIENT_ALLOWED_USER_FIELDS = [
  'name', 'username', 'age', 'birthDate', 'zodiacSign', 'bio', 'gender',
  'orientation', 'favoriteCocktail', 'preferredZones', 'ageRangePreference',
  'linkedinUrl', 'linkedinSlug', 'linkedinHeadline', 'linkedinVerified',
  'linkedinVerifiedAt', 'isVerified', 'profession', 'safeword',
  'emergencyContact', 'phoneNumber', 'privacySettings', 'photoURL',
  'serviceRequests', 'icebreakers', 'satisfactionFeedback', 'activeEventId',
  'activeWaitlist', 'activeReservation', 'reservationsHistory',
  'postEventState', 'paymentPending', 'paymentMethod'
];

const SENSITIVE_BLOCKED_FIELDS = [
  'trustTier', 'verifications', 'nfts', 'wallet_address', 'matches'
];

function buildProfilePatch(fields) {
  const patch = {};
  for (const k of CLIENT_ALLOWED_USER_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(fields, k) && fields[k] !== undefined) {
      patch[k] = fields[k];
    }
  }
  return patch;
}

const dirtyClientMemoryUser = {
  uid: 'user_123',
  role: 'superadmin', // intento de escalada
  hasTicket: true,    // intento de auto-ticket
  trustTier: 0,       // default en memoria que antes disparaba PERMISSION_DENIED
  nfts: [],           // default en memoria que antes disparaba PERMISSION_DENIED
  wallet_address: '', // default en memoria que antes disparaba PERMISSION_DENIED
  matches: ['u99'],   // sensible
  name: 'Valentina Gómez',
  age: 29,
  bio: 'Amante del diseño y el buen gin tonic.',
  favoriteCocktail: 'Negroni Ahumado',
  preferredZones: ['Zona G', 'Parque de la 93'],
  safeword: 'Martini Azul'
};

const safePatch = buildProfilePatch(dirtyClientMemoryUser);
const patchKeys = Object.keys(safePatch);

for (const blocked of [...SENSITIVE_BLOCKED_FIELDS, 'role', 'hasTicket']) {
  assert.strictEqual(patchKeys.includes(blocked), false, `El campo sensible '${blocked}' NO debe entrar en el patch de cliente`);
}
assert.strictEqual(safePatch.name, 'Valentina Gómez');
assert.strictEqual(safePatch.safeword, 'Martini Azul');
assert.deepStrictEqual(safePatch.preferredZones, ['Zona G', 'Parque de la 93']);
console.log("✓ Prueba 5 superada: updateUserProfile filtra atributos sensibles (trustTier, nfts, wallet_address, matches, role, hasTicket) y persiste perfil y safeword.");
