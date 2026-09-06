// api/wompi-webhook.js — Puerto del webhook de Wompi (antes exports.wompiWebhook).
// Ruta: POST https://<proyecto>.vercel.app/api/wompi-webhook
//
// En el panel de Wompi (cuando exista cuenta de producción) registrar esta URL
// como "Events URL" y configurar WOMPI_EVENTS_SECRET igual en ambos lados.
//
// Env requerida: WOMPI_EVENTS_SECRET (+ FIREBASE_SERVICE_ACCOUNT).

const crypto = require('crypto');
const { initAdmin, fail } = require('./_lib');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).send('Method Not Allowed');
  }

  try {
    const data = req.body || {};
    // No registrar el payload completo: puede contener datos sensibles del titular.
    console.log('Wompi Webhook received (evento):', data && data.event);

    if (data && data.event === 'transaction.updated' && data.data && data.data.transaction) {
      const tx = data.data.transaction;
      const status = tx.status;
      const reference = tx.reference; // Formato: TICKET-UID-EVENTID o TICKET-UID-EVENTID-TIMESTAMP

      // SEGURIDAD (fail-closed): sin firma válida NO se procesa el pago.
      const eventsSecret = process.env.WOMPI_EVENTS_SECRET;
      if (!eventsSecret) {
        console.error('WOMPI_EVENTS_SECRET no configurado; rechazando webhook.');
        return res.status(500).send('Webhook misconfigured');
      }
      if (!data.signature || !data.signature.checksum) {
        console.warning('Firma de webhook ausente; rechazando.');
        return res.status(401).send('Invalid Signature');
      }

      const properties = data.signature.properties || [];
      let concatenated = '';
      for (const prop of properties) {
        const parts = prop.split('.');
        let val = data.data;
        for (const p of parts) {
          val = val ? val[p] : undefined;
        }
        concatenated += val !== undefined ? val : '';
      }
      concatenated += data.timestamp + eventsSecret;
      const calculatedChecksum = crypto.createHash('sha256').update(concatenated).digest('hex');
      if (calculatedChecksum !== data.signature.checksum) {
        console.warning('Wompi signature mismatch.');
        return res.status(401).send('Invalid Signature');
      }

      const db = initAdmin().firestore();

      if (status === 'APPROVED') {
        const parts = reference.split('-');
        if (parts.length >= 3) {
          const uid = parts[1];
          const eventId = parts[2];

          // Validación de integridad del importe (belt-and-suspenders sobre la firma):
          // se rechaza el aprobado si el monto/divisa no son consistentes.
          // NOTA: la autoridad real es la firma SHA-256 (que debe cubrir amount_in_cents
          // y currency en `properties` desde Wompi). Este check es un cortafuegos adicional.
          const amount = Number(tx.amount_in_cents);
          if (!Number.isFinite(amount) || amount <= 0 || tx.currency !== 'COP') {
            console.error(`Wompi: importe/divisa inconsistentes para ${reference}; rechazado.`);
            return res.status(409).send('Invalid Amount');
          }

          // 1. Guardar registro de transacción
          await db.collection('transactions').doc(tx.id).set({
            transactionId: tx.id,
            uid,
            eventId,
            reference,
            amountInCents: tx.amount_in_cents,
            currency: tx.currency,
            status: tx.status,
            paymentMethodType: tx.payment_method_type,
            processedAt: adminFirestoreTimestamp(db)
          });

          // 2. Marcar al usuario con ticket
          await db.collection('users').doc(uid).update({
            hasTicket: true,
            activeEventId: eventId,
            paymentMethod: 'wompi',
            paymentPending: false
          });

          // 3. Añadirlo a los participantes del evento
          const eventRef = db.collection('events').doc(eventId);
          await db.runTransaction(async (t) => {
            const doc = await t.get(eventRef);
            if (doc.exists) {
              const participants = doc.data().participants || [];
              if (!participants.includes(uid)) {
                participants.push(uid);
                t.update(eventRef, { participants });
              }
            }
          });

          console.log(`✓ User ${uid} approved and activated for event ${eventId}`);
        }
      }
    }

    return res.status(200).send('OK');
  } catch (error) {
    console.error('Error processing Wompi webhook:', error);
    return fail(res, error);
  }
};

// serverTimestamp vía FieldValue (se obtiene tras initAdmin).
function adminFirestoreTimestamp(db) {
  return require('firebase-admin').firestore.FieldValue.serverTimestamp();
}
