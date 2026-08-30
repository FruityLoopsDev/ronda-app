import { RondaConfig } from './firebase-config.js';
import { DB, User } from './db.js';
import { RondaDialog } from './dialog.js';

/**
 * Pago con Nequi (código QR de cobro).
 *
 * Reemplaza la pasarela Wompi (que en producción usaría la llave de sandbox).
 * Flujo: el cliente ve el QR de Nequi, lo escanea con su app (Recibir > QR,
 * o "Subir imagen" desde la galería), paga, confirma, y su pase queda
 * "pendiente de verificación" — el anfitrión lo confirma en el evento
 * (verificación manual; no hay webhook ni Cloud Functions sin plan Blaze).
 */

export interface PaymentCheckoutOptions {
  eventId: string;
  venueName: string;
  amountInCents: number; // e.g. 6500000 = $65.000 COP
  user: User;
  onSuccess?: (payment: any) => void;
  onError?: (err: any) => void;
}

// QR de cobro Nequi. Coloca la imagen en public/nequi-qr.png o define
// VITE_NEQUI_QR_URL con la URL de la imagen.
const DEFAULT_QR_URL = '/nequi-qr.png';

class PaymentService {
  private qrUrl: string =
    (import.meta as any).env?.VITE_NEQUI_QR_URL || DEFAULT_QR_URL;

  async openCheckout(options: PaymentCheckoutOptions): Promise<boolean> {
    const { eventId, venueName, amountInCents, user, onSuccess, onError } = options;
    const price = `$${(amountInCents / 100).toLocaleString('es-CO')} COP`;

    console.log(`[Pago] Nequi QR — evento ${eventId}, monto: ${price}`);

    if (RondaConfig.isDemo) {
      // Modo Demo / Sandbox interactivo (sin dinero real).
      const confirmed = await RondaDialog.confirm({
        title: 'Pago con Nequi (Demo)',
        message: `Estás a punto de adquirir tu pase oficial de 90 min + Cóctel de autor en ${venueName} por ${price}.\n\nEn producción se mostraría el QR de cobro de Nequi.`,
        icon: '💚',
        confirmText: '✓ Pagar (Demo)',
        cancelText: '✕ Cancelar'
      });

      if (confirmed) {
        user.hasTicket = true;
        user.activeEventId = eventId;
        await DB.saveUser(user);
        if (onSuccess) {
          onSuccess({ id: 'demo_tx_' + Date.now(), status: 'APPROVED', reference: `TICKET-${user.uid}-${eventId}` });
        }
        return true;
      }
      return false;
    }

    // --- Producción: pago escaneando el QR de Nequi (verificación manual) ---
    const confirmed = await RondaDialog.confirm({
      title: 'Pago con Nequi',
      message: `Tu pase de 90 min + cóctel en ${venueName} cuesta ${price}.\n\n1️⃣ Escanea el QR con tu app Nequi (puedes usar "Subir imagen" desde la galería).\n2️⃣ Confirma el pago desde Nequi.\n3️⃣ Vuelve aquí y pulsa "Ya pagué".\n\nEl anfitrión verificará tu pago al llegar al evento.`,
      icon: '💚',
      imageUrl: this.qrUrl,
      confirmText: '✅ Ya pagué',
      cancelText: '✕ Cancelar'
    });

    if (!confirmed) {
      if (onError) onError(new Error('Pago cancelado'));
      return false;
    }

    // SEGURIDAD: el ticket (hasTicket) NO se otorga desde el cliente; las reglas
    // de Firestore lo impiden. Solo se marca el pago como pendiente de
    // verificación manual (paymentPending) y el anfitrión confirma en el evento.
    user.paymentPending = true;
    user.paymentMethod = 'nequi';
    user.activeEventId = eventId;

    if (onSuccess) {
      onSuccess({
        id: 'nequi_' + Date.now(),
        status: 'PENDING_VERIFICATION',
        reference: `TICKET-${user.uid}-${eventId}`,
        amount_in_cents: amountInCents
      });
    }
    return true;
  }
}

export const Payment = new PaymentService();
