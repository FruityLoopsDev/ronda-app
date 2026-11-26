#!/usr/bin/env node
'use strict';

// One-time migration: copy the current public invest.html into a private Firestore
// document before replacing invest.html with the neutral access shell.
// Run from the repository root: node scripts/migrate-invest-portal-content.js
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const admin = require('../functions-vercel/node_modules/firebase-admin');

(async () => {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) throw new Error('FIREBASE_SERVICE_ACCOUNT is required.');
  const serviceAccount = JSON.parse(raw);
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: serviceAccount.project_id || 'ronda-uno'
  });
  const sourcePath = path.join(__dirname, '..', 'invest.html');
  const html = fs.readFileSync(sourcePath, 'utf8');
  if (!html.includes('CONFIGURACIÓN MAESTRA DE LA MICRO-RONDA')) {
    throw new Error('invest.html does not look like the expected source portal; refusing to migrate.');
  }
  const digest = crypto.createHash('sha256').update(html).digest('hex');
  const ref = admin.firestore().collection('invest_portal_content').doc('current');
  const existing = await ref.get();
  if (existing.exists && existing.data().sha256 === digest) {
    console.log('Private portal content already matches this source. No write needed.');
  } else {
    await ref.set({
      html,
      sha256: digest,
      source: 'invest.html',
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    console.log('Private portal HTML copied to Firestore. SHA-256:', digest);
  }
  await admin.app().delete();
})().catch((error) => {
  console.error('Portal content migration failed:', error.message || error);
  process.exitCode = 1;
});
