// dialog.ts: Sistema de Diálogos y Confirmaciones Elegantes de RONDA (Reemplazo de alert() y confirm() nativos)

export interface DialogOptions {
  title?: string;
  message: string;
  icon?: string;
  imageUrl?: string;   // Imagen opcional (ej. QR de pago Nequi)
  confirmText?: string;
  cancelText?: string;
  type?: 'confirm' | 'alert' | 'danger';
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));
}

export class RondaDialog {
  private static modalEl: HTMLElement | null = null;
  private static resolvePromise: ((value: boolean) => void) | null = null;
  private static bound = false;

  static init() {
    this.modalEl = document.getElementById('modal-ronda-dialog');

    // Portales (crm/admin/superadmin/network) no incluyen el modal en su HTML:
    // se crea dinámicamente para que RondaDialog no quede colgado (el promise
    // nunca resolvería sin botones) — esto rompía el botón "Nuevo Lead" del CRM.
    if (!this.modalEl) {
      const style = document.createElement('style');
      style.textContent = `
        .ronda-dialog-overlay{position:fixed;inset:0;z-index:10100;display:none;align-items:center;justify-content:center;background:rgba(10,7,14,0.88);backdrop-filter:blur(8px);padding:16px;font-family:var(--font-body,'Space Grotesk',sans-serif);}
        .ronda-dialog-overlay.active{display:flex;}
      `;
      document.head.appendChild(style);

      const overlay = document.createElement('div');
      overlay.id = 'modal-ronda-dialog';
      overlay.className = 'ronda-dialog-overlay';
      overlay.innerHTML = `
        <div style="width:100%;max-width:360px;background:#1a1120;border:1px solid rgba(240,168,48,0.35);border-radius:24px;box-shadow:0 30px 70px rgba(0,0,0,0.85);">
          <div style="padding:26px 20px 22px;text-align:center;">
            <div id="dialog-icon-container" style="width:58px;height:58px;margin:0 auto 16px;border-radius:50%;background:rgba(240,168,48,0.12);border:1.5px solid rgba(240,168,48,0.4);display:flex;align-items:center;justify-content:center;font-size:26px;">
              <span id="dialog-icon">🍸</span>
            </div>
            <h3 id="dialog-title" style="font-family:var(--font-display,'Bodoni Moda',serif);font-size:21px;color:var(--papel,#f3ede2);margin:0 0 8px;">Confirmar Acción</h3>
            <p id="dialog-message" style="font-size:13px;color:var(--humo,#8c8378);line-height:1.48;margin:0 0 22px;"></p>
            <div style="display:flex;gap:10px;justify-content:center;">
              <button id="btn-dialog-cancel" class="btn" style="flex:1;font-size:12px;padding:11px;border-radius:999px;background:rgba(243,237,226,.06);border:1px solid var(--linea,rgba(243,237,226,0.12));color:var(--humo,#8c8378);font-weight:600;cursor:pointer;">✕ Cancelar</button>
              <button id="btn-dialog-confirm" class="btn ambar" style="flex:1;font-size:12px;padding:11px;border-radius:999px;background:var(--luz,#f0a830);border:1px solid var(--luz,#f0a830);color:#14101a;font-weight:700;cursor:pointer;">✓ Aceptar</button>
            </div>
          </div>
        </div>`;
      document.body.appendChild(overlay);
      this.modalEl = overlay;
    }

    if (RondaDialog.bound) return;
    RondaDialog.bound = true;

    document.getElementById('btn-dialog-cancel')?.addEventListener('click', () => {
      this.close(false);
    });

    document.getElementById('btn-dialog-confirm')?.addEventListener('click', () => {
      this.close(true);
    });
  }

  static confirm(options: DialogOptions | string): Promise<boolean> {
    const opts: DialogOptions = typeof options === 'string' ? { message: options } : options;
    return this.show({
      title: opts.title || 'Confirmación',
      message: opts.message,
      icon: opts.icon || '🔄',
      confirmText: opts.confirmText || '✓ Aceptar',
      cancelText: opts.cancelText || '✕ Cancelar',
      type: opts.type || 'confirm'
    });
  }

  static alert(options: DialogOptions | string): Promise<void> {
    const opts: DialogOptions = typeof options === 'string' ? { message: options } : options;
    return new Promise((resolve) => {
      this.show({
        title: opts.title || 'Aviso RONDA',
        message: opts.message,
        icon: opts.icon || '🍸',
        confirmText: opts.confirmText || '✓ Entendido',
        type: 'alert'
      }).then(() => resolve());
    });
  }

  private static show(opts: DialogOptions): Promise<boolean> {
    if (!this.modalEl) this.init();

    const titleEl = document.getElementById('dialog-title');
    const msgEl = document.getElementById('dialog-message');
    const iconEl = document.getElementById('dialog-icon');
    const iconContainer = document.getElementById('dialog-icon-container');
    const btnCancel = document.getElementById('btn-dialog-cancel');
    const btnConfirm = document.getElementById('btn-dialog-confirm');

    if (titleEl) titleEl.textContent = opts.title || 'Confirmación';
    const qrImg = opts.imageUrl
      ? `<br/><img src="${escapeHtml(opts.imageUrl)}" alt="QR de pago" style="width:190px;height:190px;border-radius:12px;margin-top:12px;background:#fff;padding:10px;display:block;margin-left:auto;margin-right:auto;box-shadow:0 4px 18px rgba(0,0,0,.35);">`
      : '';
    if (msgEl) msgEl.innerHTML = escapeHtml(opts.message) + qrImg;
    if (iconEl) iconEl.textContent = opts.icon || (opts.type === 'danger' ? '⚠️' : '🍸');

    if (iconContainer) {
      if (opts.type === 'danger') {
        iconContainer.style.background = 'rgba(155,39,72,0.2)';
        iconContainer.style.borderColor = 'var(--vino)';
        iconContainer.style.boxShadow = '0 0 20px rgba(155,39,72,0.35)';
      } else {
        iconContainer.style.background = 'rgba(240,168,48,0.12)';
        iconContainer.style.borderColor = 'rgba(240,168,48,0.4)';
        iconContainer.style.boxShadow = '0 0 20px rgba(240,168,48,0.2)';
      }
    }

    if (btnCancel) {
      if (opts.type === 'alert') {
        btnCancel.style.display = 'none';
      } else {
        btnCancel.style.display = 'block';
        btnCancel.textContent = opts.cancelText || '✕ Cancelar';
      }
    }

    if (btnConfirm) {
      btnConfirm.textContent = opts.confirmText || '✓ Aceptar';
      if (opts.type === 'danger') {
        btnConfirm.className = 'btn';
        btnConfirm.style.background = 'var(--vino)';
        btnConfirm.style.borderColor = 'var(--vino)';
        btnConfirm.style.color = '#fff';
      } else {
        btnConfirm.className = 'btn ambar';
        btnConfirm.style.background = '';
        btnConfirm.style.borderColor = '';
        btnConfirm.style.color = '';
      }
    }

    if (this.modalEl) this.modalEl.classList.add('active');

    return new Promise((resolve) => {
      this.resolvePromise = resolve;
    });
  }

  private static close(result: boolean) {
    if (this.modalEl) this.modalEl.classList.remove('active');
    if (this.resolvePromise) {
      this.resolvePromise(result);
      this.resolvePromise = null;
    }
  }
}
