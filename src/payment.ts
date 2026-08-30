import { RondaConfig } from './firebase-config.js';
import { DB, User } from './db.js';
import { RondaDialog } from './dialog.js';

/**
 * Pago con Nequi (enlace de cobro).
 *
 * Reemplaza la pasarela Wompi (que en producción usaría la llave de sandbox).
 * Flujo: el cliente abre el enlace de Nequi, paga, confirma, y su pase queda
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

// TODO: reemplazar con el enlace de cobro real de Nequi, o definir
// VITE_NEQUI_PAYMENT_LINK en el build de producción (ver .github/workflows).
const DEFAULT_NEQUI_LINK = 'https://app.nequi.com.co/pagos/';

class PaymentService {
  // Enlace de pago Nequi. Configurable vía VITE_NEQUI_PAYMENT_LINK.
  private nequiLink: string =
    (import.meta as any).env?.VITE_NEQUI_PAYMENT_LINK || DEFAULT_NEQUI_LINK;

  async openCheckout(options: PaymentCheckoutOptions): Promise<boolean> {
    const { eventId, venueName, amountInCents, user, onSuccess, onError } = options;
    const price = `$${(amountInCents / 100).toLocaleString('es-CO')} COP`;

    console.log(`[Pago] Nequi — evento ${eventId}, monto: ${price}`);

    if (RondaConfig.isDemo) {
      // Modo Demo / Sandbox interactivo (sin dinero real).
      const confirmed = await RondaDialog.confirm({
        title: 'Pago con Nequi (Demo)',
        message: `Estás a punto de adquirir tu pase oficial de 90 min + Cóctel de autor en ${venueName} por ${price}.\n\nEn producción se abriría el enlace de cobro de Nequi.`,
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

    // --- Producción: pago vía enlace de Nequi (verificación manual) ---
    const firstStep = await RondaDialog.confirm({
      title: 'Pago con Nequi',
      message: `Tu pase de 90 min + cóctel en ${venueName} cuesta ${price}.\n\n1️⃣ Se abrirá el enlace de Nequi para que pagues.\n2️⃣ Completa el pago desde tu app Nequi.\n3️⃣ Regresa y pulsa "Sí, ya pagué".\n\nEl anfitrión verificará tu pago al llegar al evento.`,
      icon: '💚',
      confirmText: '📲 Abrir Nequi y pagar',
      cancelText: '✕ Cancelar'
    });

    if (!firstStep) {
      if (onError) onError(new Error('Pago cancelado'));
      return false;
    }

    if (this.nequiLink === DEFAULT_NEQUI_LINK) {
      console.warn('[Pago] Usando enlace Nequi por defecto. Define VITE_NEQUI_PAYMENT_LINK con el enlace real de cobro.');
    }
    window.open(this.nequiLink, '_blank', 'noopener');

    const secondStep = await RondaDialog.confirm({
      title: '¿Ya completaste el pago?',
      message: `Si ya realizaste el pago en Nequi (${price}), confirma para guardar tu reserva.\n\n📌 Estado: pendiente de verificación por el anfitrión.`,
      icon: '✅',
      confirmText: 'Sí, ya pagué',
      cancelText: 'Todavía no'
    });

    if (!secondStep) {
      if (onError) onError(new Error('Pago pendiente'));
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
