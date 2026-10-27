#!/usr/bin/env node
/**
 * create-real-event.cjs — Crea un evento real en la base de datos (Firestore)
 * para que aparezca en el Discovery Feed de la app.
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
  const gtoken = getGcloudToken();

  if (!gtoken) {
    console.error(`❌ No se pudo obtener el token de gcloud. Asegúrate de haber ejecutado 'gcloud auth login' primero.`);
    process.exit(1);
  }

  const eventId = 'rnd-vintrash-oct-real';
  const docUrl = `${FIRESTORE_API}/events?documentId=${eventId}`;

  const eventPayload = {
    fields: {
      id: { stringValue: eventId },
      name: { stringValue: 'RONDA Secreta' },
      venueName: { stringValue: 'Vintrash Bar' },
      dayDate: { stringValue: 'Sábado 24 de Octubre · 20:00' },
      status: { stringValue: 'upcoming' },
      tables: { integerValue: '10' },
      price: { integerValue: '55000' }
    }
  };

  console.log(`⏳ Creando evento realista en la colección 'events'...`);
  const docRes = await fetch(docUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${gtoken}`
    },
    body: JSON.stringify(eventPayload)
  });

  const docData = await docRes.json();
  if (docData.error) {
    // If it exists, patch it
    if (docData.error.status === 'ALREADY_EXISTS') {
        const patchUrl = `${FIRESTORE_API}/events/${eventId}`;
        await fetch(patchUrl, {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${gtoken}`
            },
            body: JSON.stringify(eventPayload)
        });
        console.log(`✅ Evento actualizado.`);
    } else {
        console.error(`❌ Error actualizando Firestore:`, docData.error.message || JSON.stringify(docData));
        process.exit(1);
    }
  } else {
    console.log(`🎉 ¡Evento creado con éxito!`);
  }
}

main().catch(console.error);
