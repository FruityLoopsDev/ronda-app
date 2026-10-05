// api/verify-kyc.js — Base A-2 (Antigravity): resolución server-side de KYC.
// Ruta: POST https://<proyecto>.vercel.app/api/verify-kyc
//
// Contrato (fail-closed):
// - Requiere `Authorization: Bearer <idToken>` (Firebase Auth).
// - Solo roles staff (`superadmin`/`admin`) pueden aprobar Tier 2.
// - Nonce de un solo uso por reviewId (colección `kycNonces/{reviewId}`).
// - Purga el documento `kycReviews/{reviewId}` tras aprobar/rechazar (72h / $0 Spark).
//
// Env requeridas: FIREBASE_SERVICE_ACCOUNT.

const { initAdmin, requireAuth, requireRole, ok, fail, cors } = require('./_lib');

function requireNonceShape(body) {
  if (!body || typeof body.reviewId !== 'string' || !body.reviewId) {
    const err = new Error('reviewId requerido.');
    err.statusCode = 400;
    throw err;
  }
  if (body.decision !== 'approved' && body.decision !== 'rejected') {
    const err = new Error("decision debe ser 'approved' o 'rejected'.");
    err.statusCode = 400;
    throw err;
  }
  if (typeof body.nonce !== 'string' || body.nonce.length < 8) {
    const err = new Error('nonce requerido (mínimo 8 caracteres).');
    err.statusCode = 400;
    throw err;
  }
}

module.exports = async function handler(req, res) {
  if (cors(req, res)) return;
  if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');
  try {
    const authCtx = await requireAuth(req, res);
    if (!authCtx) return;
    requireRole(authCtx, ['superadmin', 'admin']);

    const body = req.body || {};
    requireNonceShape(body);
    const { reviewId, decision, nonce } = body;

    const db = initAdmin().firestore();
    const nonceRef = db.collection('kycNonces').doc(reviewId);
    const reviewRef = db.collection('kycReviews').doc(reviewId);

    await db.runTransaction(async (tx) => {
      const nonceSnap = await tx.get(nonceRef);
      if (nonceSnap.exists) {
        const err = new Error('nonce ya consumido (replay bloqueado).');
        err.statusCode = 409;
        throw err;
      }
      const reviewSnap = await tx.get(reviewRef);
      if (!reviewSnap.exists) {
        const err = new Error('caso KYC no encontrado.');
        err.statusCode = 404;
        throw err;
      }
      const review = reviewSnap.data();
      if (review.status !== 'pending') {
        const err = new Error('caso KYC ya resuelto.');
        err.statusCode = 409;
        throw err;
      }
      const now = new Date().toISOString();
      const reviewerUid = authCtx.token.uid;

      if (decision === 'approved') {
        const userRef = db.collection('users').doc(review.userId);
        tx.update(userRef, {
          trustTier: 2,
          isVerified: true,
          verifications: {
            ...((await tx.get(userRef)).data() || {}).verifications,
            identity: { method: 'manual_admin', verifiedAt: now, reviewerUid },
          },
        });
      }
      // Purga inmediata tras resolución (las fotos Base64 desaparecen).
      tx.set(nonceRef, { nonce, decision, reviewerUid, usedAt: now });
      tx.delete(reviewRef);
    });

    return ok(res, { reviewId, decision, purged: true });
  } catch (err) {
    return fail(res, err);
  }
};
