import { User } from './db.js';
import { RondaDialog } from './dialog.js';

export interface PaymentCheckoutOptions {
  eventId: string;
  venueName: string;
  amountInCents: number; // e.g. 6500000 = $65.000 COP
  user: User;
  onSuccess?: (payment: any) => void;
  onError?: (err: any) => void;
}

// QR y datos de cobro Nequi. Coloca la imagen en public/nequi-qr.png o define
// VITE_NEQUI_QR_URL y VITE_NEQUI_PHONE con los valores correspondientes.
const DEFAULT_QR_URL = '/nequi-qr.png';
const DEFAULT_NEQUI_PHONE = '316 974 9677';

class PaymentService {
  private qrUrl: string =
    (import.meta as any).env?.VITE_NEQUI_QR_URL || DEFAULT_QR_URL;

  private nequiPhone: string =
    (import.meta as any).env?.VITE_NEQUI_PHONE || DEFAULT_NEQUI_PHONE;
    
  private get wompiPublicKey(): string {
    return (import.meta as any).env?.VITE_WOMPI_PUBLIC_KEY || '';
  }

  private async loadWompiWidget(): Promise<any> {
    if ((window as any).WidgetCheckout) {
      return (window as any).WidgetCheckout;
    }
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://checkout.wompi.co/widget.js';
      script.onload = () => resolve((window as any).WidgetCheckout);
      script.onerror = () => reject(new Error('Error cargando el widget de Wompi'));
      document.body.appendChild(script);
    });
  }

  async openCheckout(options: PaymentCheckoutOptions): Promise<boolean> {
    const { eventId, venueName, amountInCents, user, onSuccess, onError } = options;
    const price = `$${(amountInCents / 100).toLocaleString('es-CO')} COP`;

    console.log(`[Pago] Iniciando checkout — evento ${eventId}, monto: ${price}`);

    // Generar referencia única de pago
    const reference = `TICKET-${user.uid}-${eventId}-${Date.now()}`;

    // Si hay llave pública de Wompi configurada, usar el Widget de Wompi
    if (this.wompiPublicKey) {
      try {
        const WidgetCheckout = await this.loadWompiWidget();
        return new Promise<boolean>((resolve) => {
          const checkout = new WidgetCheckout({
            currency: 'COP',
            amountInCents: amountInCents,
            reference: reference,
            publicKey: this.wompiPublicKey,
            customerData: {
              email: user.email || '',
              fullName: user.name || 'Usuario RONDA'
            }
          });

          checkout.open((result: any) => {
            const tx = result.transaction;
            console.log('[Pago] Resultado de Wompi:', tx);

            if (tx.status === 'APPROVED' || tx.status === 'PENDING') {
              // El Webhook en Vercel se encarga de confirmar el pago de forma segura
              // Aquí en el frontend lo marcamos temporalmente como pendiente
              user.paymentPending = true;
              user.paymentMethod = 'wompi';
              user.activeEventId = eventId;

              if (onSuccess) {
                onSuccess({
                  id: tx.id,
                  status: tx.status,
                  reference: tx.reference,
                  amount_in_cents: tx.amountInCents
                });
              }
              resolve(true);
            } else {
              if (onError) onError(new Error(`Transacción Wompi: ${tx.status}`));
              resolve(false);
            }
          });
        });
      } catch (err) {
        console.error('[Pago] Error con Wompi, cayendo en Nequi fallback:', err);
        // Fallback a Nequi si falla la carga del script
      }
    }

    // --- Fallback de Producción: pago escaneando el QR de Nequi (verificación manual) ---
    const confirmed = await RondaDialog.confirm({
      title: 'Pago con Nequi',
      message: `Tu pase de 90 min + cóctel en ${venueName} cuesta ${price}.\n\n1️⃣ Envía a Nequi al número ${this.nequiPhone} (o escanea el QR).\n2️⃣ Confirma la transferencia desde Nequi.\n3️⃣ Vuelve aquí y pulsa "Ya pagué".\n\nEl anfitrión verificará tu pago al llegar al evento.`,
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
        reference: reference,
        amount_in_cents: amountInCents
      });
    }
    return true;
  }
}

export const Payment = new PaymentService();
