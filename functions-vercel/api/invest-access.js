// POST /api/invest-access — validates invite tokens server-side and serves the protected portal.
// The portal HTML is stored only in Firestore (invest_portal_content/current), never in the public build.
const crypto = require('crypto');
const { initAdmin } = require('./_lib');

const ALLOWED_ORIGINS = new Set([
  'https://ronda.uno',
  'https://www.ronda.uno',
  'http://localhost:5001',
  'http://localhost:5173'
]);
const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 8;

function sendError(res, status, message) {
  res.setHeader('Cache-Control', 'no-store, private, max-age=0');
  res.setHeader('X-Robots-Tag', 'noindex, nofollow, noarchive, nosnippet');
  return res.status(status).json({ error: message });
}

function sanitizePortalHtml(html, guest) {
  let output = String(html || '');
  const mapStart = output.indexOf('    const AUTHORIZED_GUESTS = {');
  if (mapStart !== -1) {
    const mapEnd = output.indexOf('    };', mapStart);
    if (mapEnd === -1) throw new Error('Legacy guest map could not be safely removed.');
    output = output.slice(0, mapStart) + '    const AUTHORIZED_GUESTS = Object.freeze({});' + output.slice(mapEnd + 6);
  }
  const authStart = output.indexOf('    function unlockWithGuest(code, guest) {');
  const authEnd = output.indexOf('    // Inicialización automática', authStart);
  if (authStart === -1 || authEnd === -1) throw new Error('Legacy client authorization block not found.');
  const safeAuth = `    function unlockWithGuest(_code, guest) {
      if (!guest || !guest.leadId) return;
      applyUnlockedUI(guest);
    }
    async function checkUrlAuth() {
      const guest = window.RONDA_INVEST_GUEST;
      if (!guest || !guest.leadId) return;
      applyUnlockedUI(guest);
      if (typeof RondaTracker !== 'undefined') {
        RondaTracker.track('investor_portal_unlocked', {
          lead_id: guest.leadId, guest_name: guest.name, role: guest.role
        });
      }
    }
    async function verifyDataRoomPin() {
      const errorMsg = document.getElementById('dataroom-pin-error');
      if (errorMsg) errorMsg.style.display = 'block';
    }

`;
  output = output.slice(0, authStart) + safeAuth + output.slice(authEnd);
  const resolverStart = output.indexOf('  function resolveGuest() {');
  const resolverEnd = output.indexOf('  let closed = false;', resolverStart);
  if (resolverStart !== -1 && resolverEnd !== -1) {
    output = output.slice(0, resolverStart) +
      '  function resolveGuest() { return window.RONDA_INVEST_GUEST || null; }\n\n' +
      output.slice(resolverEnd);
  }
  const guestJson = JSON.stringify(guest).replace(/</g, '\\u003c');
  const context = '<script>window.RONDA_INVEST_GUEST=' + guestJson + ';</script>';
  if (!output.includes('</head>')) throw new Error('Portal template has no head close tag.');
  return output.replace('</head>', context + '</head>');
}

module.exports = async function handler(req, res) {
  const origin = req.headers.origin || '';
  if (origin && !ALLOWED_ORIGINS.has(origin)) return sendError(res, 403, 'origin_not_allowed');
  if (origin) res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'no-store, private, max-age=0');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('X-Robots-Tag', 'noindex, nofollow, noarchive, nosnippet');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' });

  try {
    const body = req.body || {};
    const token = typeof body.token === 'string' ? body.token : '';
    if (!/^rnd-[a-f0-9]{64}$/.test(token)) return sendError(res, 401, 'invalid_invitation');

    const forwarded = String(req.headers['x-forwarded-for'] || req.headers['x-real-ip'] || 'unknown').split(',')[0].trim();
    const ipHash = crypto.createHash('sha256').update(forwarded).digest('hex');
    const admin = initAdmin();
    const db = admin.firestore();
    const now = Date.now();
    const rateRef = db.collection('invest_access_rate_limits').doc(ipHash);

    const allowed = await db.runTransaction(async (tx) => {
      const snap = await tx.get(rateRef);
      const data = snap.exists ? snap.data() : {};
      const start = Number(data.windowStartMs || 0);
      const attempts = start > 0 && now - start < WINDOW_MS ? Number(data.attempts || 0) : 0;
      if (attempts >= MAX_ATTEMPTS) return false;
      tx.set(rateRef, {
        windowStartMs: attempts === 0 ? now : start,
        attempts: attempts + 1,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
      return true;
    });
    if (!allowed) return sendError(res, 429, 'too_many_attempts');

    const tokenSnap = await db.collection('invest_tokens').doc(token).get();
    if (!tokenSnap.exists) return sendError(res, 401, 'invalid_invitation');
    const record = tokenSnap.data() || {};
    if (record.active !== true || typeof record.name !== 'string' || !record.name.trim() ||
        typeof record.leadId !== 'string' || !record.leadId.trim() ||
        !['founder', 'investor', 'guest'].includes(record.role)) {
      return sendError(res, 401, 'invalid_invitation');
    }
    if (record.expiresAt && Date.parse(record.expiresAt) <= now) {
      return sendError(res, 401, 'invalid_invitation');
    }

    const contentSnap = await db.collection('invest_portal_content').doc('current').get();
    if (!contentSnap.exists || typeof contentSnap.data().html !== 'string') {
      return sendError(res, 503, 'portal_not_configured');
    }
    const guest = {
      name: record.name.slice(0, 100),
      leadId: record.leadId.slice(0, 80),
      role: record.role,
      ring: typeof record.ring === 'string' ? record.ring : ''
    };
    const html = sanitizePortalHtml(contentSnap.data().html, guest);
    await db.collection('invest_access_audit').add({
      leadId: guest.leadId,
      role: guest.role,
      event: 'portal_access_granted',
      ipHash,
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.status(200).send(html);
  } catch (err) {
    console.error('[invest-access] Request failed:', err && err.message ? err.message : 'unknown');
    return sendError(res, 500, 'access_service_unavailable');
  }
};
