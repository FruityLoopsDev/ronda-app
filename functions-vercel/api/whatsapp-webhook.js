// functions-vercel/api/whatsapp-webhook.js
// Webhook oficial de Meta WhatsApp Cloud API (1.000 conversaciones/mes gratis)

const { initAdmin, ok, fail } = require('./_lib');

module.exports = async function handler(req, res) {
  // 1. Verificación GET de Meta (Al registrar la URL del Webhook en Facebook Developers)
  if (req.method === 'GET') {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    const verifyToken = process.env.WHATSAPP_VERIFY_TOKEN || 'ronda_webhook_secret_2026';

    if (mode && token) {
      if (mode === 'subscribe' && token === verifyToken) {
        console.log('[WhatsApp Webhook] ✅ Webhook verificado exitosamente por Meta.');
        return res.status(200).send(challenge);
      } else {
        console.warn('[WhatsApp Webhook] ❌ Token de verificación inválido.');
        return res.status(403).json({ error: 'Token de verificación incorrecto' });
      }
    }
    return res.status(400).json({ error: 'Faltan parámetros de verificación' });
  }

  // 2. Recepción POST de mensajes entrantes desde WhatsApp
  if (req.method === 'POST') {
    try {
      const body = req.body;

      if (!body || body.object !== 'whatsapp_business_account') {
        return res.status(404).json({ error: 'Evento no reconocido' });
      }

      const entries = body.entry || [];
      for (const entry of entries) {
        const changes = entry.changes || [];
        for (const change of changes) {
          const value = change.value || {};
          const messages = value.messages || [];

          for (const msg of messages) {
            const fromNumber = msg.from; // Número del remitente (+57...)
            const messageText = msg.text ? msg.text.body : '';
            const msgId = msg.id;

            console.log(`[WhatsApp Inbound] 📩 De: ${fromNumber} | Mensaje: "${messageText}"`);

            // Guardar en Firestore para historial del Agente de IA
            try {
              const db = initAdmin().firestore();
              await db.collection('whatsapp_inbound').add({
                from: fromNumber,
                text: messageText,
                msgId: msgId,
                timestamp: new Date().toISOString(),
                status: 'unread'
              });
            } catch (dbErr) {
              console.error('[WhatsApp DB Error]', dbErr);
            }
          }
        }
      }

      // Meta requiere responder 200 OK inmediatamente para no reintentar
      return ok(res, { status: 'EVENT_RECEIVED' });
    } catch (err) {
      return fail(res, err);
    }
  }

  return res.status(405).json({ error: 'Método no permitido' });
};

/**
 * Función auxiliar para enviar un mensaje de texto vía Meta WhatsApp Cloud API
 */
async function sendWhatsAppMessage(toPhone, text) {
  const phoneId = process.env.WHATSAPP_PHONE_ID;
  const token = process.env.WHATSAPP_TOKEN;

  if (!phoneId || !token) {
    console.error('[WhatsApp API] ⚠️ WHATSAPP_PHONE_ID o WHATSAPP_TOKEN no configurados.');
    return false;
  }

  const url = `https://graph.facebook.com/v19.0/${phoneId}/messages`;
  const payload = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: toPhone,
    type: 'text',
    text: { preview_url: true, body: text }
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  const data = await response.json();
  if (!response.ok) {
    console.error('[WhatsApp API Error]', data);
    return false;
  }

  console.log('[WhatsApp Sent] 📤 Enviado con éxito:', data);
  return true;
}
