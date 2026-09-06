// api/process-matches.js — Puerto de processEventMatches (antes exports.processEventMatches, onCall).
// Ruta: POST https://<proyecto>.vercel.app/api/process-matches
//
// Equivale a un https.onCall: requiere header "Authorization: Bearer <idToken>"
// y rol 'admin'. Body: { data: { eventId } } (o body plano { eventId }).

const { initAdmin, requireAuth, requireRole, ok, fail, cors } = require('./_lib');

module.exports = async function handler(req, res) {
  try {
    if (cors(req, res)) return;

    const authCtx = await requireAuth(req, res);
    if (!authCtx) return;
    requireRole(authCtx, ['admin', 'superadmin']);

    const payload = req.body && req.body.data ? req.body.data : (req.body || {});
    const { eventId } = payload;
    if (!eventId) {
      return fail(Object.assign(new Error('Debe enviar un eventId válido.'), { statusCode: 400 }));
    }

    const db = initAdmin().firestore();

    // 1. Leer todos los likes de events/{eventId}/likes
    const likesSnapshot = await db.collection('events').doc(eventId).collection('likes').get();
    const likes = [];
    likesSnapshot.forEach((doc) => likes.push(doc.data()));

    // 2. Encontrar likes recíprocos
    const likeMap = new Map();
    likes.forEach((item) => {
      if (item.like === true && item.from && item.to) {
        likeMap.set(`${item.from}_${item.to}`, true);
      }
    });

    const matches = [];
    likeMap.forEach((value, key) => {
      const [from, to] = key.split('_');
      if (likeMap.has(`${to}_${from}`)) {
        if (from < to) {
          matches.push({ user1: from, user2: to });
        }
      }
    });

    // 3. Actualizar matches en los documentos de ambos usuarios
    const batch = db.batch();
    for (const match of matches) {
      const user1Ref = db.collection('users').doc(match.user1);
      const user2Ref = db.collection('users').doc(match.user2);

      batch.update(user1Ref, {
        matches: require('firebase-admin').firestore.FieldValue.arrayUnion(match.user2)
      });
      batch.update(user2Ref, {
        matches: require('firebase-admin').firestore.FieldValue.arrayUnion(match.user1)
      });
    }

    if (matches.length > 0) {
      await batch.commit();
    }

    return ok(res, {
      success: true,
      message: `Se procesaron los matches del evento ${eventId}. Pairs: ${matches.length}.`
    });
  } catch (err) {
    console.error('Error in process-matches:', err);
    return fail(res, err);
  }
};
