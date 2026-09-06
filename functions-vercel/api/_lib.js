// _lib.js — Utilidades compartidas de la API RONDA en Vercel.
// (Los archivos que empiezan con _ NO se convierten en rutas HTTP en Vercel.)

const admin = require('firebase-admin');

// ---------------------------------------------------------------------------
// Inicialización de firebase-admin desde una service account (env var JSON).
// En Vercel no existe metadata de GCE, por eso la credencial va explícita.
// Env requerida: FIREBASE_SERVICE_ACCOUNT (contenido JSON de la service account
// de ronda-uno — la misma que ya está como secret FIREBASE_SERVICE_ACCOUNT_RONDA_UNO en GitHub).
// ---------------------------------------------------------------------------
function initAdmin() {
  if (admin.apps.length) return admin;
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) {
    throw new Error('FIREBASE_SERVICE_ACCOUNT no configurada en las env vars de Vercel.');
  }
  let sa;
  try {
    sa = JSON.parse(raw);
  } catch (e) {
    throw new Error('FIREBASE_SERVICE_ACCOUNT no es un JSON válido.');
  }
  admin.initializeApp({
    credential: admin.credential.cert(sa),
    projectId: sa.project_id || 'ronda-uno'
  });
  return admin;
}

// ---------------------------------------------------------------------------
// Verifica el ID token de Firebase Auth (equivale a context.auth de onCall).
// Devuelve el token decodificado o null tras responder 401.
// ---------------------------------------------------------------------------
async function requireAuth(req, res) {
  const header = req.headers.authorization || '';
  if (!header.startsWith('Bearer ')) {
    res.status(401).json({ error: { message: 'Debes estar autenticado.', code: 'unauthenticated' } });
    return null;
  }
  try {
    const db = initAdmin().firestore();
    const auth = initAdmin().auth();
    const token = await auth.verifyIdToken(header.slice(7));
    // Verificar que el usuario existe en Firestore y su rol (como hacía onCall).
    const userDoc = await db.collection('users').doc(token.uid).get();
    if (!userDoc.exists) {
      res.status(403).json({ error: { message: 'Usuario sin perfil.', code: 'permission-denied' } });
      return null;
    }
    return { token, user: userDoc.data() };
  } catch (err) {
    res.status(401).json({ error: { message: 'Token inválido.', code: 'unauthenticated' } });
    return null;
  }
}

function requireRole(authCtx, roles) {
  const role = authCtx && authCtx.user && authCtx.user.role;
  if (!role || !roles.includes(role)) {
    const err = new Error('Solo personal autorizado puede ejecutar esta acción.');
    err.statusCode = 403;
    throw err;
  }
}

function ok(res, data) {
  res.status(200).json(data);
}

// Manejo de errores uniforme.
function fail(res, err) {
  const status = err.statusCode || 500;
  if (status >= 500) console.error('[API] Error:', err);
  res.status(status).json({ error: { message: err.message || 'Internal Server Error', code: 'internal' } });
}

// CORS simple para llamadas desde el navegador (callables). El webhook de Wompi
// es server-to-server y no necesita CORS.
function cors(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return true;
  }
  return false;
}

module.exports = { initAdmin, requireAuth, requireRole, ok, fail, cors };
