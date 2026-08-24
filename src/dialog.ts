// dialog.ts: Sistema de Diálogos y Confirmaciones Elegantes de RONDA (Reemplazo de alert() y confirm() nativos)

export interface DialogOptions {
  title?: string;
  message: string;
  icon?: string;
  confirmText?: string;
  cancelText?: string;
  type?: 'confirm' | 'alert' | 'danger';
}

export class RondaDialog {
  private static modalEl: HTMLElement | null = null;
  private static resolvePromise: ((value: boolean) => void) | null = null;

  static init() {
    this.modalEl = document.getElementById('modal-ronda-dialog');
    
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
    if (msgEl) msgEl.textContent = opts.message;
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
