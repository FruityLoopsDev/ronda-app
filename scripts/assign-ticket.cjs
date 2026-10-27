#!/usr/bin/env node
/**
 * assign-ticket.cjs — Asigna una reserva de evento "realista" a un usuario existente
 *
 * Uso:
 *   node scripts/assign-ticket.cjs <email>
 *
 * Ejemplo:
 *   node scripts/assign-ticket.cjs admin@ronda.uno
 */
const { spawnSync } = require('child_process');

const PROJECT = 'ronda-uno';
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
  if (args.length < 1) {
    console.log(`\nUso: node scripts/assign-ticket.cjs <email>`);
    process.exit(1);
  }

  const email = args[0];
  const gtoken = getGcloudToken();

  if (!gtoken) {
    console.error(`❌ No se pudo obtener el token de gcloud. Asegúrate de haber ejecutado 'gcloud auth login' primero.`);
    process.exit(1);
  }

  // 1. Buscar usuario por email
  console.log(`🔍 Buscando usuario con email: ${email}...`);
  const listRes = await fetch(`${FIRESTORE_API}/users?pageSize=300`, {
    headers: { Authorization: `Bearer ${gtoken}` }
  });
  const listData = await listRes.json();
  const match = (listData.documents || []).find((d) => d.fields?.email?.stringValue?.toLowerCase() === email.toLowerCase());

  if (!match) {
    console.error(`❌ No se encontró ningún usuario con el correo: ${email}`);
    process.exit(1);
  }

  const uid = match.name.split('/').pop();
  console.log(`✅ Usuario encontrado. UID: ${uid}`);

  // 2. Construir la reserva "realista"
  const reservationMap = {
    mapValue: {
      fields: {
        eventId: { stringValue: 'rnd-vintrash-oct' },
        venueName: { stringValue: 'Vintrash Bar' },
        venueAddress: { stringValue: 'Cl. 85 #11-53 · Zona T, Bogotá' },
        mapsUrl: { stringValue: 'https://www.google.com/maps/search/?api=1&query=Cl+85+11-53+Bogota' },
        dayDate: { stringValue: 'Viernes 23 de Octubre · 20:00' },
        tableNumber: { stringValue: '12' },
        cocktailName: { stringValue: 'Gin Tonic de Frutos Rojos' },
        cocktailDesc: { stringValue: 'Ginebra botánica premium con infusión de frutos rojos y tónica.' },
        cocktailImg: { stringValue: '/assets/coctel-negroni.svg' },
        bookingCode: { stringValue: '#RND-8992' },
        priceFormatted: { stringValue: '$55.000' },
        status: { stringValue: 'confirmed' }
      }
    }
  };

  const updatedFields = {
    ...match.fields,
    activeReservation: reservationMap
  };

  // 3. Actualizar documento en Firestore
  const docUrl = `${FIRESTORE_API}/users/${uid}`;
  const userPayload = { fields: updatedFields };

  console.log(`⏳ Asignando entrada y evento realista al usuario...`);
  const docRes = await fetch(`${docUrl}?updateMask.fieldPaths=activeReservation`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${gtoken}`
    },
    body: JSON.stringify(userPayload)
  });

  const docData = await docRes.json();
  if (docData.error) {
    console.error(`❌ Error actualizando Firestore:`, docData.error.message || JSON.stringify(docData));
    process.exit(1);
  }

  console.log(`🎉 ¡Entrada asignada con éxito! Revisa la app para ver el evento.`);
}

main().catch(console.error);
