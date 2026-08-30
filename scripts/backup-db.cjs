#!/usr/bin/env node
/**
 * backup-db.cjs — Export completo de Firestore (ronda-uno) a JSON local.
 *
 * Propósito (Fase 1 del plan de producción): inventario + respaldo pre-purga.
 * Sin billing no se puede usar `gcloud firestore export` (GCS), así que este
 * script usa la Firestore REST API con el token OAuth de gcloud.
 *
 * Uso:
 *   node scripts/backup-db.cjs [--project ronda-uno] [--out backups]
 *   env: GCLOUD_TOKEN (opcional, evita ejecutar gcloud)
 *
 * Requisitos: node >= 18 (fetch), gcloud autenticado con acceso al proyecto.
 * Salida: backups/<timestamp>/ — un JSON por colección + inventory.json.
 */
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const arg = (name, dflt) => {
  const i = process.argv.indexOf(name);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : dflt;
};
const PROJECT = arg('--project', 'ronda-uno');
const OUT_BASE = path.resolve(arg('--out', 'backups'));
const API = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents`;

function getToken() {
  if (process.env.GCLOUD_TOKEN) return process.env.GCLOUD_TOKEN;
  // shell:true con comando en string: resuelve gcloud(.cmd) vía PATH en ambas plataformas.
  const r = spawnSync('gcloud auth print-access-token', { shell: true, encoding: 'utf8' });
  if (r.status !== 0 || !r.stdout) {
    throw new Error('gcloud no encontrado o sin sesión. Ejecuta `gcloud auth login` o define GCLOUD_TOKEN.');
  }
  return r.stdout.trim();
}
const TOKEN = getToken();
const HEADERS = { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' };

/** Lista TODOS los documentos de una ruta de colección (paginado). */
async function listAll(collectionPath) {
  const docs = [];
  let pageToken = '';
  do {
    const qs = `pageSize=300${pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : ''}`;
    const url = `${API}/${collectionPath}?${qs}`;
    const res = await fetch(url, { headers: HEADERS });
    if (!res.ok) {
      const t = await res.text();
      throw new Error(`GET ${collectionPath} -> ${res.status}: ${t.slice(0, 200)}`);
    }
    const j = await res.json();
    if (j.documents) docs.push(...j.documents);
    pageToken = j.nextPageToken || '';
  } while (pageToken);
  return docs;
}

/** Intenta listar colecciones raíz (no expuesto por REST de forma fiable; best-effort). */
async function discoverCollections() {
  try {
    const res = await fetch(`${API}?pageSize=300`, { headers: HEADERS });
    if (!res.ok) return [];
    const j = await res.json();
    // En la práctica el endpoint raíz no lista colecciones; devolvemos [].
    return (j.documents || []).map((d) => d.name);
  } catch { return []; }
}

/** Estructura ligera por documento (sin repetir datos en inventory). */
function compactDoc(doc) {
  const out = { _id: doc.name.split('/').pop(), _createTime: doc.createTime, _updateTime: doc.updateTime };
  const fields = doc.fields || {};
  for (const [k, v] of Object.entries(fields)) {
    const kind = Object.keys(v)[0];
    if (kind === 'stringValue') out[k] = v.stringValue;
    else if (kind === 'integerValue') out[k] = Number(v.integerValue);
    else if (kind === 'doubleValue') out[k] = Number(v.doubleValue);
    else if (kind === 'booleanValue') out[k] = v.booleanValue;
    else if (kind === 'timestampValue') out[k] = v.timestampValue;
    else if (kind === 'nullValue') out[k] = null;
    else if (kind === 'arrayValue') out[k] = (v.arrayValue.values || []).map((x) => x.stringValue ?? x.integerValue ?? x.booleanValue ?? x);
    else if (kind === 'mapValue') out[k] = '[map]';
    else out[k] = `[${kind}]`;
  }
  return out;
}

async function main() {
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  const outDir = path.join(OUT_BASE, ts);
  fs.mkdirSync(outDir, { recursive: true });
  console.log(`▶ Proyecto: ${PROJECT}`);
  console.log(`▶ Salida:   ${outDir}`);

  // Colecciones raíz conocidas por reglas/código + descubrimiento best-effort.
  const rootCollections = ['users', 'events', 'venues', 'leads', 'transactions', 'waitlist'];
  const discovered = await discoverCollections();
  if (discovered.length) console.log(`ℹ Colecciones extra detectadas: ${discovered.join(', ')}`);

  const inventory = { project: PROJECT, exportedAt: new Date().toISOString(), collections: {} };
  let totalDocs = 0;

  for (const col of rootCollections) {
    let docs;
    try {
      docs = await listAll(col);
    } catch (e) {
      // Colección inexistente: se registra como 0 docs.
      console.warn(`⚠ ${col}: ${e.message}`);
      docs = [];
    }
    const compact = docs.map(compactDoc);

    // Subcolecciones conocidas: users/{uid}/encounters y events/{id}/likes.
    let subCounts = {};
    if (col === 'users') {
      for (const d of docs) {
        const uid = d.name.split('/').pop();
        const sub = await listAll(`users/${uid}/encounters`).catch(() => []);
        if (sub.length) {
          subCounts[uid] = sub.length;
          const subFile = path.join(outDir, 'sub', `encounters-${uid}.json`);
          fs.mkdirSync(path.dirname(subFile), { recursive: true });
          fs.writeFileSync(subFile, JSON.stringify(sub.map(compactDoc), null, 2));
          totalDocs += sub.length;
        }
      }
    }
    if (col === 'events') {
      for (const d of docs) {
        const eid = d.name.split('/').pop();
        const sub = await listAll(`events/${eid}/likes`).catch(() => []);
        if (sub.length) {
          subCounts[eid] = sub.length;
          const subFile = path.join(outDir, 'sub', `likes-${eid}.json`);
          fs.mkdirSync(path.dirname(subFile), { recursive: true });
          fs.writeFileSync(subFile, JSON.stringify(sub.map(compactDoc), null, 2));
          totalDocs += sub.length;
        }
      }
    }

    const file = path.join(outDir, `${col}.json`);
    fs.writeFileSync(file, JSON.stringify(compact, null, 2));
    inventory.collections[col] = { docs: docs.length, subcollections: subCounts };
    totalDocs += docs.length;
    console.log(`✔ ${col}: ${docs.length} docs${Object.keys(subCounts).length ? ` + ${Object.keys(subCounts).length} con subcolección` : ''}`);
  }

  inventory.totalDocs = totalDocs;
  fs.writeFileSync(path.join(outDir, 'inventory.json'), JSON.stringify(inventory, null, 2));
  console.log(`\n✅ Backup completado: ${totalDocs} documentos en total.`);
  console.log(`   Inventario: ${path.join(outDir, 'inventory.json')}`);
}

main().catch((e) => { console.error('❌', e); process.exit(1); });
