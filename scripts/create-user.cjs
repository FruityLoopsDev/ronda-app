#!/usr/bin/env node
/**
 * create-user.cjs — Crea un usuario en Firebase Auth y su perfil en Firestore.
 *
 * Uso:
 *   node scripts/create-user.cjs <email> <password> <nombre> [role: superadmin|admin|sales|network|client]
 *
 * Ejemplo:
 *   node scripts/create-user.cjs admin@ronda.uno Ronda2026* "Admin Principal" superadmin
 */
const { spawnSync } = require('child_process');

const PROJECT = 'ronda-uno';
const API_KEY = 'AIzaSyA55U4CwLAv5tlNPGvO-OkRBB0qJHbTNKQ';
const FIRESTORE_API = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents`;

function getGcloudToken() {
  if (process.env.GCLOUD_TOKEN) return process.env.GCLOUD_TOKEN;
  const r = spawnSync('gcloud auth print-access-token', { shell: true, encoding: 'utf8' });
  if (r.status !== 0 || !r.stdout) {
    return null;
  }
  return r.stdout.trim();
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length < 2) {
    console.log(`\nUso: node scripts/create-user.cjs <email> <password> <nombre> [role]`);
    console.log(`Roles disponibles: superadmin, admin, sales, network, client (default: superadmin)\n`);
    process.exit(1);
  }

  const email = args[0].trim();
  const password = args[1];
  const name = args[2] || email.split('@')[0];
  const role = args[3] || 'superadmin';

  console.log(`\n👤 Creando usuario en Firebase Auth...`);
  console.log(`   Email: ${email}`);
  console.log(`   Nombre: ${name}`);
  console.log(`   Rol: ${role.toUpperCase()}`);

  // 1. Crear usuario en Firebase Auth vía Identity Toolkit REST API
  const authUrl = `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${API_KEY}`;
  const authRes = await fetch(authUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email,
      password,
      displayName: name,
      returnSecureToken: true
    })
  });

  const authData = await authRes.json();
  let uid = '';
  let idToken = '';

  if (!authRes.ok) {
    if (authData.error?.message === 'EMAIL_EXISTS') {
      console.log(`⚠️ El correo ${email} ya existe en Firebase Auth. Intentando actualizar su perfil en Firestore...`);
      // Si ya existe, podemos buscar el UID por email en Firestore
      const gtoken = getGcloudToken();
      if (!gtoken) {
        console.error(`❌ El usuario ya existe y no se pudo obtener token de gcloud para actualizarlo.`);
        process.exit(1);
      }
      const listRes = await fetch(`${FIRESTORE_API}/users?pageSize=300`, {
        headers: { Authorization: `Bearer ${gtoken}` }
      });
      const listData = await listRes.json();
      const match = (listData.documents || []).find((d) => d.fields?.email?.stringValue?.toLowerCase() === email.toLowerCase());
      if (match) {
        uid = match.name.split('/').pop();
      } else {
        console.error(`❌ El usuario existe en Auth pero no se encontró en Firestore.`);
        process.exit(1);
      }
    } else {
      console.error(`❌ Error en Firebase Auth: ${authData.error?.message || JSON.stringify(authData)}`);
      process.exit(1);
    }
  } else {
    uid = authData.localId;
    idToken = authData.idToken;
    console.log(`✅ Cuenta de autenticación creada. UID: ${uid}`);
  }

  // 2. Crear / actualizar documento en Firestore
  const gtoken = getGcloudToken();
  const tokenToUse = gtoken || idToken;

  const docUrl = `${FIRESTORE_API}/users/${uid}`;
  const userPayload = {
    fields: {
      uid: { stringValue: uid },
      email: { stringValue: email },
      name: { stringValue: name },
      role: { stringValue: role },
      trustTier: { integerValue: role === 'superadmin' ? '3' : '2' },
      isVerified: { booleanValue: true },
      gender: { stringValue: 'Otro' },
      orientation: { stringValue: 'Ambos' },
      wallet_address: { stringValue: '' },
      createdAt: { stringValue: new Date().toISOString() }
    }
  };

  const fsRes = await fetch(docUrl, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${tokenToUse}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(userPayload)
  });

  if (!fsRes.ok) {
    const errText = await fsRes.text();
    console.error(`❌ Error guardando perfil en Firestore: HTTP ${fsRes.status}: ${errText}`);
    process.exit(1);
  }

  console.log(`✅ Perfil en Firestore guardado con rol '${role.toUpperCase()}'.`);
  console.log(`\n🎉 ¡Listo! Ya puedes iniciar sesión con:`);
  console.log(`   Portal: ${role === 'superadmin' ? '/superadmin.html' : role === 'admin' ? '/admin.html' : role === 'sales' ? '/crm.html' : '/'}`);
  console.log(`   Email: ${email}`);
  console.log(`   Password: ${password}\n`);
}

main().catch((err) => {
  console.error('Error fatal:', err.message);
  process.exit(1);
});
