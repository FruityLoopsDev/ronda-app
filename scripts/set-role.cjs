#!/usr/bin/env node
/**
 * set-role.cjs — Asigna roles en Firestore (ronda-uno).
 *
 * Uso:
 *   node scripts/set-role.cjs <email-o-uid> <superadmin|admin|sales|network|client>
 *   node scripts/set-role.cjs --list
 */
const { spawnSync } = require('child_process');

const PROJECT = 'ronda-uno';
const API = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents`;

function getToken() {
  if (process.env.GCLOUD_TOKEN) return process.env.GCLOUD_TOKEN;
  const r = spawnSync('gcloud auth print-access-token', { shell: true, encoding: 'utf8' });
  if (r.status !== 0 || !r.stdout) {
    throw new Error('gcloud no autenticado. Inicia sesión con `gcloud auth login` o exporta GCLOUD_TOKEN.');
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
      const err = await res.text();
      throw new Error(`Error listando usuarios: HTTP ${res.status}: ${err}`);
    }
    const data = await res.json();
    if (data.documents) docs.push(...data.documents);
    pageToken = data.nextPageToken || '';
  } while (pageToken);
  return docs;
}

async function main() {
  const args = process.argv.slice(2);
  const token = getToken();
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

  if (args.includes('--list') || args.length === 0) {
    console.log(`\n📋 Consultando usuarios en Firestore (${PROJECT})...\n`);
    const users = await listUsers(headers);
    console.table(
      users.map((d) => {
        const f = d.fields || {};
        const uid = d.name.split('/').pop();
        return {
          uid,
          name: f.name?.stringValue || '(sin nombre)',
          email: f.email?.stringValue || '(sin email)',
          role: f.role?.stringValue || 'client',
          tier: f.trustTier ? f.trustTier.integerValue : 0
        };
      })
    );
    console.log(`\nPara cambiar rol ejecuta: node scripts/set-role.cjs <email-o-uid> <superadmin|admin|sales|network|client>\n`);
    return;
  }

  const target = args[0];
  const newRole = args[1] || 'superadmin';
  const validRoles = ['superadmin', 'admin', 'sales', 'network', 'client'];

  if (!validRoles.includes(newRole)) {
    console.error(`❌ Rol inválido: ${newRole}. Debe ser uno de: ${validRoles.join(', ')}`);
    process.exit(1);
  }

  const users = await listUsers(headers);
  const match = users.find((d) => {
    const uid = d.name.split('/').pop();
    const email = d.fields?.email?.stringValue?.toLowerCase() || '';
    return uid === target || email === target.toLowerCase();
  });

  if (!match) {
    console.error(`❌ No se encontró ningún usuario con UID o Email: "${target}"`);
    console.log(`Ejecuta 'node scripts/set-role.cjs --list' para ver todos los usuarios.`);
    process.exit(1);
  }

  const uid = match.name.split('/').pop();
  const email = match.fields?.email?.stringValue || '(sin email)';

  // Actualizar documento con updateMask
  const patchUrl = `${API}/users/${uid}?updateMask.fieldPaths=role`;
  const patchRes = await fetch(patchUrl, {
    method: 'PATCH',
    headers,
    body: JSON.stringify({
      fields: {
        role: { stringValue: newRole }
      }
    })
  });

  if (!patchRes.ok) {
    const err = await patchRes.text();
    console.error(`❌ Error actualizando rol: HTTP ${patchRes.status}: ${err}`);
    process.exit(1);
  }

  console.log(`\n✅ ÉXITO: Usuario ${email} (${uid}) actualizado a rol: '${newRole.toUpperCase()}'.`);
  console.log(`Ya puedes iniciar sesión en /superadmin.html con este usuario.\n`);
}

main().catch((err) => {
  console.error('Error:', err.message);
  process.exit(1);
});
