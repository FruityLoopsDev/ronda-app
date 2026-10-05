#!/usr/bin/env node
/**
 * migrate-users-to-t0.cjs — Restablece el estado de verificación de usuarios existentes en Firestore (ronda-uno).
 *
 * Propósito (Fase 0):
 * Dado que la verificación anterior de LinkedIn era una simulación con titulares
 * inventados, este script actualiza los documentos de la colección 'users' para:
 *   - Establecer `trustTier: 0`
 *   - Establecer `isVerified: false`
 *   - Establecer `linkedinVerified: false`
 *   - Limpiar `linkedinHeadline` simulado
 *
 * Uso:
 *   node scripts/migrate-users-to-t0.cjs [--dry-run] [--project ronda-uno]
 */
const { spawnSync } = require('child_process');

const arg = (name, dflt) => {
  const i = process.argv.indexOf(name);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : dflt;
};
const DRY_RUN = process.argv.includes('--dry-run');
const PROJECT = arg('--project', 'ronda-uno');
const API = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents`;

function getToken() {
  if (process.env.GCLOUD_TOKEN) return process.env.GCLOUD_TOKEN;
  const r = spawnSync('gcloud auth print-access-token', { shell: true, encoding: 'utf8' });
  if (r.status !== 0 || !r.stdout) {
    throw new Error('gcloud no encontrado o sin sesión. Ejecuta `gcloud auth login` o define GCLOUD_TOKEN.');
  }
  return r.stdout.trim();
}

async function listUsers(headers) {
  const docs = [];
  let pageToken = '';
  do {
    const qs = `pageSize=300${pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : ''}`;
    const res = await fetch(`${API}/users?${qs}`, { headers });
    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Error listando usuarios: HTTP ${res.status}: ${errText}`);
    }
    const data = await res.json();
    if (data.documents) docs.push(...data.documents);
    pageToken = data.nextPageToken || '';
  } while (pageToken);
  return docs;
}

async function main() {
  console.log(`[Migración] Iniciando saneamiento de usuarios en ${PROJECT}...`);
  if (DRY_RUN) console.log(`[DRY RUN] No se escribirán cambios en la base de datos.`);

  const token = getToken();
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

  const users = await listUsers(headers);
  console.log(`[Migración] Se encontraron ${users.length} usuarios.`);

  let updatedCount = 0;
  for (const doc of users) {
    const docName = doc.name;
    const uid = docName.split('/').pop();
    const fields = doc.fields || {};

    const isVerified = fields.isVerified && fields.isVerified.booleanValue;
    const linkedinVerified = fields.linkedinVerified && fields.linkedinVerified.booleanValue;
    const currentTier = fields.trustTier ? fields.trustTier.integerValue : null;

    if (isVerified || linkedinVerified || currentTier !== '0') {
      console.log(`[Usuario ${uid}] Restableciendo a T0 (isVerified=${isVerified}, linkedinVerified=${linkedinVerified})`);
      if (!DRY_RUN) {
        const patchUrl = `${API}/users/${uid}?updateMask.fieldPaths=trustTier&updateMask.fieldPaths=isVerified&updateMask.fieldPaths=linkedinVerified&updateMask.fieldPaths=linkedinHeadline`;
        const patchRes = await fetch(patchUrl, {
          method: 'PATCH',
          headers,
          body: JSON.stringify({
            fields: {
              ...fields,
              trustTier: { integerValue: '0' },
              isVerified: { booleanValue: false },
              linkedinVerified: { booleanValue: false },
              linkedinHeadline: { stringValue: '' }
            }
          })
        });
        if (!patchRes.ok) {
          console.error(`Error actualizando usuario ${uid}:`, await patchRes.text());
        } else {
          updatedCount++;
        }
      } else {
        updatedCount++;
      }
    }
  }

  console.log(`[Migración] Finalizado. Total de usuarios restablecidos a T0: ${updatedCount}`);
}

main().catch(err => {
  console.error('[Migración] Error fatal:', err);
  process.exit(1);
});
