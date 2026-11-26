#!/usr/bin/env node
'use strict';

// Migrate legacy phone/notes fields out of publicly get-readable invest_tokens.
// Dry-run is the default. Pass --apply to perform writes.
const admin = require('../functions-vercel/node_modules/firebase-admin');

async function init() {
  if (admin.apps.length) return admin.firestore();
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) throw new Error('Set FIREBASE_SERVICE_ACCOUNT (JSON) before running.');
  const sa = JSON.parse(raw);
  admin.initializeApp({ credential: admin.credential.cert(sa), projectId: sa.project_id || 'ronda-uno' });
  return admin.firestore();
}

(async () => {
  const apply = process.argv.includes('--apply');
  const db = await init();
  const snapshot = await db.collection('invest_tokens').get();
  let found = 0;
  let migrated = 0;

  for (const docSnap of snapshot.docs) {
    const data = docSnap.data();
    const hasPhone = typeof data.phone === 'string' && data.phone.trim() !== '';
    const hasNotes = typeof data.notes === 'string' && data.notes.trim() !== '';
    if (!hasPhone && !hasNotes) continue;
    found++;
    if (!apply) continue;

    const publicRef = docSnap.ref;
    const privateRef = db.collection('invest_token_private').doc(docSnap.id);
    await db.runTransaction(async (tx) => {
      const privateSnap = await tx.get(privateRef);
      const privateData = privateSnap.exists ? privateSnap.data() : {};
      const merged = { ...privateData, updatedAt: new Date().toISOString(), updatedBy: 'migration-script' };
      if (hasPhone && !merged.phone) merged.phone = data.phone;
      if (hasNotes && !merged.notes) merged.notes = data.notes;
      tx.set(privateRef, merged, { merge: true });
      const cleanPatch = {};
      if (hasPhone) cleanPatch.phone = admin.firestore.FieldValue.delete();
      if (hasNotes) cleanPatch.notes = admin.firestore.FieldValue.delete();
      tx.update(publicRef, cleanPatch);
    });
    migrated++;
  }

  console.log(apply
    ? `Migration completed: ${migrated} token records sanitized.`
    : `Dry run: ${found} token records contain legacy private fields. No writes made. Re-run with --apply to migrate.`);
  await admin.app().delete();
})().catch((err) => {
  console.error('Invest token privacy migration failed:', err.message || err);
  process.exitCode = 1;
});
