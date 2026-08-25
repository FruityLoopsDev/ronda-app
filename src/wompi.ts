import { RondaConfig } from './firebase-config.js';
import { DB, User } from './db.js';
import { RondaDialog } from './dialog.js';

declare var WidgetCheckout: any;

export interface WompiCheckoutOptions {
  eventId: string;
  venueName: string;
  amountInCents: number; // e.g. 6500000 = $65.000 COP
  user: User;
  onSuccess?: (transaction: any) => void;
  onError?: (err: any) => void;
}

class WompiService {
  private scriptLoaded: boolean = false;
  private publicKey: string = 'pub_test_Q5yDA9xoKdePzhSGeVe9HAvtNuewqqZ0'; // Clave pública de prueba Wompi Sandbox

  async loadScript(): Promise<void> {
    if (this.scriptLoaded || (window as any).WidgetCheckout) {
      this.scriptLoaded = true;
      return;
    }

    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://checkout.wompi.co/widget.js';
      script.type = 'text/javascript';
      script.onload = () => {
        this.scriptLoaded = true;
        console.log('✓ Wompi Checkout Widget cargado con éxito.');
        resolve();
      };
      script.onerror = () => {
        reject(new Error('No se pudo cargar el widget de pago de Wompi. Verifica tu conexión.'));
      };
      document.head.appendChild(script);
    });
  }

  async openCheckout(options: WompiCheckoutOptions): Promise<boolean> {
    const { eventId, venueName, amountInCents, user, onSuccess, onError } = options;
    const reference = `TICKET-${user.uid}-${eventId}-${Date.now()}`;

    console.log(`[Wompi] Iniciando checkout para evento ${eventId}, monto: $${amountInCents / 100} COP, ref: ${reference}`);

    if (RondaConfig.isDemo) {
      // Modo Demo / Sandbox Interactivo
      const confirmed = await RondaDialog.confirm({
        title: 'Checkout Seguro Wompi (Sandbox)',
        message: `Estás a punto de adquirir tu pase oficial de 90 min + Cóctel de autor en ${venueName} por $${(amountInCents / 100).toLocaleString('es-CO')} COP.\n\nMedios aceptados: PSE, Nequi, Daviplata, Tarjetas Visa/Mastercard.`,
        icon: '💳',
        confirmText: '✓ Pagar $65.000 COP (Wompi)',
        cancelText: '✕ Cancelar'
      });

      if (confirmed) {
        user.hasTicket = true;
        user.activeEventId = eventId;
        await DB.saveUser(user);

        if (onSuccess) {
          onSuccess({
            id: 'demo_tx_' + Date.now(),
            status: 'APPROVED',
            reference,
            amount_in_cents: amountInCents
          });
        }
        return true;
      }
      return false;
    }

    try {
      await this.loadScript();

      return new Promise((resolve) => {
        const checkout = new WidgetCheckout({
          currency: 'COP',
          amountInCents: amountInCents || 6500000,
          reference: reference,
          publicKey: this.publicKey,
          redirectUrl: window.location.origin,
          customerData: {
            email: user.email || 'usuario@ronda.club',
            fullName: user.name || 'Invitado RONDA',
            phoneNumber: user.phoneNumber || '3001234567',
            phoneNumberPrefix: '+57'
          }
        });

        checkout.open(async (result: any) => {
          const transaction = result?.transaction;
          console.log('[Wompi] Resultado de transacción:', transaction);

          if (transaction?.status === 'APPROVED') {
            user.hasTicket = true;
            user.activeEventId = eventId;
            await DB.saveUser(user);

            if (onSuccess) onSuccess(transaction);
            resolve(true);
          } else if (transaction?.status === 'DECLINED') {
            await RondaDialog.alert({
              title: 'Pago Declinado',
              message: 'La transacción fue rechazada por tu entidad bancaria. Por favor intenta con otro medio de pago (Nequi/PSE).',
              icon: '❌',
              type: 'danger'
            });
            if (onError) onError(new Error('Pago declinado'));
            resolve(false);
          } else {
            // Estado pendiente o cancelado
            if (onError) onError(new Error('Transacción no completada'));
            resolve(false);
          }
        });
      });
    } catch (err: any) {
      console.error('[Wompi] Error al inicializar widget:', err);
      await RondaDialog.alert({
        title: 'Error de Pasarela',
        message: 'No fue posible abrir el checkout de Wompi: ' + err.message,
        icon: '⚠️',
        type: 'danger'
      });
      if (onError) onError(err);
      return false;
    }
  }
}

export const Wompi = new WompiService();
