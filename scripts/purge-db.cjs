#!/usr/bin/env node
/**
 * purge-db.cjs — Purga total de Firestore + Auth (ronda-uno).
 *
 * ⚠️ DESTRUCTIVO: borra TODOS los documentos de las colecciones y TODOS los
 * usuarios de Firebase Auth. Ejecutar SOLO tras backup verificado (Fase 1).
 *
 * Uso:
 *   node scripts/purge-db.cjs --dry-run          # imprime lo que se borraría (por defecto)
 *   node scripts/purge-db.cjs --yes              # ejecuta la purga completa (Firestore + Auth)
 *   node scripts/purge-db.cjs --yes --keep-auth  # purga Firestore pero conserva Auth users
 *   env: GCLOUD_TOKEN (opcional, evita ejecutar gcloud)
 *
 * Mecánica: Firestore REST API (list + delete por documento, incluye
 * subcolecciones encounters/likes) e Identity Toolkit accounts:batchDelete.
 */
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const DRY_RUN = !process.argv.includes('--yes');
const KEEP_AUTH = process.argv.includes('--keep-auth');
const PROJECT = 'ronda-uno';
const API = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents`;
const AUTH_BASE = `https://identitytoolkit.googleapis.com/v1/projects/${PROJECT}`;
const AUTH_API = `${AUTH_BASE}/accounts:batchDelete`;

function getToken() {
  if (process.env.GCLOUD_TOKEN) return process.env.GCLOUD_TOKEN;
  // shell:true con comando en string: resuelve gcloud(.cmd) vía PATH en ambas plataformas.
  const r = spawnSync('gcloud auth print-access-token', { shell: true, encoding: 'utf8' });
  if (r.status !== 0 || !r.stdout) {
    throw new Error('gcloud no encontrado o sin sesión. Ejecuta `gcloud auth login` o define GCLOUD_TOKEN.');
  }
  return r.stdout.trim();
}
const HEADERS = { Authorization: `Bearer ${getToken()}`, 'Content-Type': 'application/json' };

async function listAll(collectionPath) {
  const docs = [];
  let pageToken = '';
  do {
    const qs = `pageSize=300${pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : ''}`;
    const res = await fetch(`${API}/${collectionPath}?${qs}`, { headers: HEADERS });
    if (!res.ok) {
      const t = await res.text();
      if (res.status === 404) return [];
      throw new Error(`GET ${collectionPath} -> ${res.status}: ${t.slice(0, 200)}`);
    }
    const j = await res.json();
    if (j.documents) docs.push(...j.documents.map((d) => d.name.split('/').pop()));
    pageToken = j.nextPageToken || '';
  } while (pageToken);
  return docs;
}

async function deleteDoc(path) {
  const res = await fetch(`${API}/${path}?currentDocument.exists=true`, {
    method: 'DELETE',
    headers: HEADERS,
  });
  if (!res.ok && res.status !== 404) {
    const t = await res.text();
    throw new Error(`DELETE ${path} -> ${res.status}: ${t.slice(0, 200)}`);
  }
}

async function purgeCollection(col) {
  const rootIds = await listAll(col);
  let total = rootIds.length;
  const subByParent = {};
  // Subcolecciones conocidas por reglas/código.
  const subMap = { users: 'encounters', events: 'likes' };
  const sub = subMap[col];
  if (sub) {
    for (const id of rootIds) {
      const subIds = await listAll(`${col}/${id}/${sub}`);
      if (subIds.length) {
        subByParent[id] = subIds.length;
        total += subIds.length;
        if (!DRY_RUN) {
          for (const sid of subIds) await deleteDoc(`${col}/${id}/${sub}/${sid}`);
        }
      }
    }
  }
  if (!DRY_RUN) {
    for (const id of rootIds) await deleteDoc(`${col}/${id}`);
  }
  console.log(`${DRY_RUN ? '[DRY]' : '[OK] '} ${col}: ${rootIds.length} docs` +
    (Object.keys(subByParent).length ? ` + sub: ${JSON.stringify(subByParent)}` : ''));
  return total;
}

async function purgeAuth() {
  // UIDs provienen de backups/auth-users.json (generado por firebase auth:export).
  const authFile = path.join(__dirname, '..', 'backups', 'auth-users.json');
  let uids = [];
  if (fs.existsSync(authFile)) {
    const j = JSON.parse(fs.readFileSync(authFile, 'utf8'));
    uids = (j.users || []).map((u) => u.localId).filter(Boolean);
  } else {
    console.warn('⚠ No se encontró backups/auth-users.json; Auth no se puede purgar sin la lista de UIDs.');
    return 0;
  }
  if (DRY_RUN) {
    console.log(`[DRY] auth: ${uids.length} users se deshabilitarían y eliminarían`);
    return uids.length;
  }
  // 1. Deshabilitar primero (requisito de accounts:batchDelete: NOT_DISABLED).
  for (const uid of uids) {
    const d = await fetch(`${AUTH_BASE}/accounts:update`, {
      method: 'POST',
      headers: { ...HEADERS, 'X-Goog-User-Project': PROJECT },
      body: JSON.stringify({ localId: uid, disableUser: true }),
    });
    if (!d.ok) {
      const t = await d.text();
      console.warn(`⚠ disable ${uid} -> ${d.status}: ${t.slice(0, 150)}`);
    }
  }
  // 2. Borrar en lotes de 1000.
  for (let i = 0; i < uids.length; i += 1000) {
    const batch = uids.slice(i, i + 1000);
    const res = await fetch(AUTH_API, {
      method: 'POST',
      headers: { ...HEADERS, 'X-Goog-User-Project': PROJECT },
      body: JSON.stringify({ localIds: batch }),
    });
    if (!res.ok) {
      const t = await res.text();
      if (res.status >= 500) throw new Error(`batchDelete -> ${res.status}: ${t.slice(0, 300)}`);
      console.warn(`⚠ batchDelete parcial: ${res.status} ${t.slice(0, 200)}`);
    } else {
      const body = await res.json().catch(() => ({}));
      if (body.errors && body.errors.length) {
        console.warn(`⚠ batchDelete errores: ${JSON.stringify(body.errors)}`);
      }
    }
  }
  console.log(`[OK] auth: ${uids.length} users eliminados`);
  return uids.length;
}

async function main() {
  console.log(`▶ ${DRY_RUN ? 'MODO DRY-RUN (nada se borra)' : 'MODO EJECUCIÓN'} — proyecto ${PROJECT}`);
  const collections = ['users', 'events', 'venues', 'leads', 'transactions', 'waitlist'];
  let total = 0;
  for (const c of collections) total += await purgeCollection(c);
  if (!KEEP_AUTH) total += await purgeAuth();
  console.log(`\n${DRY_RUN ? '[DRY] Total a eliminar' : '[OK] Total eliminado'}: ${total} documentos/cuentas`);
  if (DRY_RUN) {
    console.log('\nPara ejecutar la purga: node scripts/purge-db.cjs --yes');
    console.log('Para conservar Auth users: node scripts/purge-db.cjs --yes --keep-auth');
  }
}

main().catch((e) => { console.error('❌', e); process.exit(1); });
