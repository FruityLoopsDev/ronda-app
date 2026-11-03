// dialog.ts: Sistema de Diálogos y Confirmaciones Elegantes de RONDA (Reemplazo de alert() y confirm() nativos)
//
// ── Contrato de seguridad ────────────────────────────────────────────────────
// `message` se ESCAPA por defecto. El HTML propio del producto se habilita de
// forma explícita con `html: true` y pasa por una allowlist (`sanitizeHtml`).
// Cualquier dato dinámico (nombres, correos, ids) DEBE envolverse con
// `escapeHtml()` en el punto de llamada, incluso cuando `html: true`.
//
// Este archivo es la ÚNICA fuente de verdad del modal de diálogo: se construye
// aquí para todos los portales (app, admin, crm, superadmin, network). Antes
// existía además un markup estático en index.html que se desincronizaba
// (por ejemplo, le faltaba el input de `prompt()`).

import { escapeHtml } from './utils.js';

export interface DialogOptions {
  title?: string;
  message: string;
  icon?: string;
  imageUrl?: string;   // Imagen opcional (ej. QR de pago Nequi)
  placeholder?: string; // Placeholder para el input de tipo prompt
  defaultValue?: string; // Valor inicial del input de tipo prompt
  inputType?: 'text' | 'number' | 'email' | 'tel';
  confirmText?: string;
  cancelText?: string;
  type?: 'confirm' | 'alert' | 'danger';
  /** Interpreta `message` como HTML propio, saneado con allowlist. */
  html?: boolean;
}

interface InternalDialogOptions extends DialogOptions {
  asPrompt?: boolean;
}

/* ────────────────────────────── Sanitizador HTML ───────────────────────────── */

const ALLOWED_TAGS = new Set([
  'B', 'STRONG', 'I', 'EM', 'U', 'S', 'SMALL', 'MARK', 'BR', 'HR',
  'P', 'DIV', 'SPAN', 'UL', 'OL', 'LI', 'A', 'CODE', 'PRE',
  'TABLE', 'THEAD', 'TBODY', 'TR', 'TH', 'TD', 'IMG', 'BLOCKQUOTE'
]);

// Se eliminan junto con todo su contenido: nunca aportan nada a un diálogo.
const DROP_WITH_CONTENT = new Set([
  'SCRIPT', 'STYLE', 'IFRAME', 'FRAME', 'OBJECT', 'EMBED', 'FORM', 'INPUT',
  'TEXTAREA', 'SELECT', 'OPTION', 'BUTTON', 'SVG', 'MATH', 'TEMPLATE', 'LINK',
  'META', 'BASE', 'NOSCRIPT', 'AUDIO', 'VIDEO', 'CANVAS'
]);

const GLOBAL_ATTRS = new Set(['class', 'style']);
const TAG_ATTRS: Record<string, Set<string>> = {
  A: new Set(['href', 'title', 'target', 'rel']),
  IMG: new Set(['src', 'alt', 'width', 'height'])
};

// Solo esquemas inocuos. `data:` queda restringido a imágenes embebidas.
const SAFE_URL = /^(?:https?:|mailto:|tel:|#|\/(?!\/)|data:image\/(?:png|jpe?g|gif|webp);base64,)/i;
const UNSAFE_STYLE = /(?:expression|javascript:|vbscript:|behavior|@import|url\s*\()/i;

/**
 * Limpia HTML propio permitiendo solo etiquetas/atributos de presentación.
 *
 * No se usa `innerHTML` sobre el documento vivo: `DOMParser` produce un
 * documento inerte (los `<script>` no se ejecutan y las imágenes no se cargan
 * hasta insertarlas), por lo que devolver el markup saneado es seguro.
 */
export function sanitizeHtml(html: string): string {
  if (typeof DOMParser === 'undefined') return escapeHtml(html);

  const doc = new DOMParser().parseFromString(
    `<div id="ronda-sanitize-root">${html}</div>`,
    'text/html'
  );
  const root = doc.getElementById('ronda-sanitize-root');
  if (!root) return escapeHtml(html);

  const walk = (node: Element) => {
    for (const child of Array.from(node.childNodes)) {
      const nodeType = child.nodeType;
      if (nodeType === 3 /* TEXT_NODE */) continue;
      if (nodeType !== 1 /* ELEMENT_NODE */) { child.remove(); continue; }

      const el = child as Element;
      const tag = el.tagName.toUpperCase();

      if (DROP_WITH_CONTENT.has(tag)) { el.remove(); continue; }

      if (!ALLOWED_TAGS.has(tag)) {
        // Etiqueta desconocida: se conserva su texto, nunca su markup.
        walk(el);
        el.replaceWith(...Array.from(el.childNodes));
        continue;
      }

      for (const attr of Array.from(el.attributes)) {
        const name = attr.name.toLowerCase();
        const allowed = GLOBAL_ATTRS.has(name) || TAG_ATTRS[tag]?.has(name);
        if (!allowed || name.startsWith('on')) {
          el.removeAttribute(attr.name);
          continue;
        }
        if (name === 'style' && UNSAFE_STYLE.test(attr.value)) {
          el.removeAttribute(attr.name);
        }
        if ((name === 'href' || name === 'src') && !SAFE_URL.test(attr.value.trim())) {
          el.removeAttribute(attr.name);
        }
      }

      if (tag === 'A') {
        el.setAttribute('target', '_blank');
        el.setAttribute('rel', 'noopener noreferrer');
      }

      walk(el);
    }
  };

  walk(root);
  return root.innerHTML;
}

/* ───────────────────────────────── Diálogo ─────────────────────────────────── */

export class RondaDialog {
  private static modalEl: HTMLElement | null = null;
  private static resolvePromise: ((value: boolean) => void) | null = null;
  private static wired = false;
  private static asPrompt = false;
  private static promptValue: string | null = null;
  private static lastFocused: HTMLElement | null = null;

  private static baseOptions(options: DialogOptions | string): DialogOptions {
    return typeof options === 'string' ? { message: options } : options;
  }

  /** Monta el modal canónico una sola vez por documento. */
  static init() {
    if (this.wired && this.modalEl?.isConnected) return;

    // Markup heredado (index.html u otro portal): se descarta para que exista
    // una sola implementación y no queden ids duplicados.
    document.getElementById('modal-ronda-dialog')?.remove();

    if (!document.getElementById('ronda-dialog-styles')) {
      const style = document.createElement('style');
      style.id = 'ronda-dialog-styles';
      style.textContent = `
        .ronda-dialog-overlay{position:fixed;inset:0;z-index:10100;display:none;align-items:center;justify-content:center;background:rgba(10,7,14,.88);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);padding:16px;font-family:var(--font-body,'Space Grotesk',sans-serif);}
        .ronda-dialog-overlay.active{display:flex;}
        .ronda-dialog-card{width:100%;max-width:400px;max-height:calc(100vh - 32px);max-height:calc(100dvh - 32px);display:flex;flex-direction:column;box-sizing:border-box;background:#1a1120;border:1px solid rgba(240,168,48,.35);border-radius:24px;box-shadow:0 30px 70px rgba(0,0,0,.85);padding:24px 20px 20px;text-align:center;overflow:hidden;}
        .ronda-dialog-icon{width:56px;height:56px;margin:0 auto 14px;border-radius:50%;background:rgba(240,168,48,.12);border:1.5px solid rgba(240,168,48,.4);display:flex;align-items:center;justify-content:center;font-size:25px;flex-shrink:0;}
        .ronda-dialog-title{font-family:var(--font-display,'Bodoni Moda',serif);font-size:20px;font-weight:700;color:var(--papel,#f3ede2);margin:0 0 8px;letter-spacing:-.01em;}
        .ronda-dialog-message{font-size:13px;color:var(--humo,#8c8378);line-height:1.5;margin:0 0 18px;max-height:min(46vh,300px);overflow-y:auto;overscroll-behavior:contain;text-align:center;padding-right:2px;}
        .ronda-dialog-message::-webkit-scrollbar{width:4px;}
        .ronda-dialog-message::-webkit-scrollbar-thumb{background:rgba(243,237,226,.22);border-radius:99px;}
        .ronda-dialog-message img{max-width:100%;height:auto;}
        .ronda-dialog-input{display:none;width:100%;box-sizing:border-box;margin:0 0 18px;padding:11px 12px;border:1px solid var(--linea,rgba(243,237,226,.12));border-radius:10px;background:#0e0a12;color:var(--papel,#f3ede2);font-family:inherit;font-size:14px;}
        .ronda-dialog-input:focus{outline:none;border-color:var(--luz,#f0a830);}
        .ronda-dialog-actions{display:flex;gap:10px;justify-content:center;flex-shrink:0;}
        .ronda-dialog-actions .btn{flex:1;min-width:0;font-size:12px;padding:11px;border-radius:999px;font-weight:700;cursor:pointer;background:rgba(243,237,226,.06);border:1px solid var(--linea,rgba(243,237,226,.12));color:var(--humo,#8c8378);}
        .ronda-dialog-actions .btn.ambar{background:var(--luz,#f0a830);border-color:var(--luz,#f0a830);color:#14101a;}
        .ronda-dialog-actions .btn.danger{background:var(--vino,#9B2748);border-color:var(--vino,#9B2748);color:#fff;}
      `;
      document.head.appendChild(style);
    }

    const overlay = document.createElement('div');
    overlay.id = 'modal-ronda-dialog';
    overlay.className = 'ronda-dialog-overlay';
    overlay.setAttribute('role', 'presentation');
    overlay.innerHTML = `
      <div class="ronda-dialog-card" role="dialog" aria-modal="true" aria-labelledby="dialog-title" aria-describedby="dialog-message">
        <div class="ronda-dialog-icon" id="dialog-icon-container"><span id="dialog-icon">🍸</span></div>
        <h3 class="ronda-dialog-title" id="dialog-title">Confirmar Acción</h3>
        <div class="ronda-dialog-message" id="dialog-message"></div>
        <input class="ronda-dialog-input" id="dialog-prompt-input" type="text" autocomplete="off">
        <div class="ronda-dialog-actions">
          <button type="button" id="btn-dialog-cancel" class="btn">✕ Cancelar</button>
          <button type="button" id="btn-dialog-confirm" class="btn ambar">✓ Aceptar</button>
        </div>
      </div>`;
    (document.body || document.documentElement).appendChild(overlay);
    this.modalEl = overlay;

    // Un único juego de listeners, delegado en el propio overlay.
    overlay.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      if (target === overlay) { this.close(false); return; }        // click en el fondo
      if (target.closest('#btn-dialog-confirm')) { this.close(true); return; }
      if (target.closest('#btn-dialog-cancel')) { this.close(false); }
    });

    document.addEventListener('keydown', (e) => {
      if (!this.modalEl?.classList.contains('active')) return;
      if (e.key === 'Escape') { e.preventDefault(); this.close(false); return; }
      if (e.key === 'Enter') {
        const target = e.target as HTMLElement | null;
        if (target?.tagName === 'TEXTAREA') return;
        // En "Cancelar" se deja actuar al click nativo del botón (resuelve false).
        if (target?.id === 'btn-dialog-cancel') return;
        e.preventDefault();
        this.close(true);
      }
    });

    this.wired = true;
  }

  static confirm(options: DialogOptions | string): Promise<boolean> {
    const opts = this.baseOptions(options);
    return this.show({
      ...opts,
      title: opts.title || 'Confirmación',
      icon: opts.icon || '🔄',
      confirmText: opts.confirmText || '✓ Aceptar',
      cancelText: opts.cancelText || '✕ Cancelar',
      type: opts.type || 'confirm'
    });
  }

  static alert(options: DialogOptions | string): Promise<void> {
    const opts = this.baseOptions(options);
    return this.show({
      ...opts,
      title: opts.title || 'Aviso RONDA',
      icon: opts.icon || '🍸',
      confirmText: opts.confirmText || '✓ Entendido',
      type: 'alert'
    }).then(() => undefined);
  }

  static prompt(options: DialogOptions | string): Promise<string | null> {
    const opts = this.baseOptions(options);
    return this.show({
      ...opts,
      title: opts.title || 'Entrada requerida',
      icon: opts.icon || '✏️',
      confirmText: opts.confirmText || '✓ Aceptar',
      cancelText: opts.cancelText || '✕ Cancelar',
      type: 'confirm',
      asPrompt: true
    }).then((confirmed) => {
      if (!confirmed) return null;
      return this.promptValue ?? '';
    });
  }

  private static show(rawOpts: InternalDialogOptions): Promise<boolean> {
    if (!this.modalEl) this.init();
    if (!this.modalEl) return Promise.resolve(false);

    const opts: InternalDialogOptions = rawOpts;

    // Si quedó un diálogo abierto, se resuelve antes de reutilizar el nodo.
    if (this.resolvePromise) {
      const previous = this.resolvePromise;
      this.resolvePromise = null;
      previous(false);
    }

    const titleEl = document.getElementById('dialog-title');
    const msgEl = document.getElementById('dialog-message');
    const iconEl = document.getElementById('dialog-icon');
    const iconContainer = document.getElementById('dialog-icon-container');
    const btnCancel = document.getElementById('btn-dialog-cancel') as HTMLButtonElement | null;
    const btnConfirm = document.getElementById('btn-dialog-confirm') as HTMLButtonElement | null;
    const inputEl = document.getElementById('dialog-prompt-input') as HTMLInputElement | null;

    // El título se asigna como texto: los call sites NO deben pre-escaparlo.
    if (titleEl) titleEl.textContent = opts.title || 'Confirmación';

    const bodyHtml = opts.html ? sanitizeHtml(opts.message) : escapeHtml(opts.message);
    const qrImg = opts.imageUrl
      ? `<img src="${escapeHtml(opts.imageUrl)}" alt="QR de pago" style="width:190px;height:190px;border-radius:12px;margin-top:12px;background:#fff;padding:10px;display:block;margin-left:auto;margin-right:auto;box-shadow:0 4px 18px rgba(0,0,0,.35);">`
      : '';
    if (msgEl) msgEl.innerHTML = bodyHtml + qrImg;

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
      btnCancel.style.display = opts.type === 'alert' ? 'none' : '';
      btnCancel.textContent = opts.cancelText || '✕ Cancelar';
    }

    if (btnConfirm) {
      btnConfirm.textContent = opts.confirmText || '✓ Aceptar';
      btnConfirm.classList.toggle('danger', opts.type === 'danger');
      btnConfirm.classList.toggle('ambar', opts.type !== 'danger');
    }

    // Input de prompt: se muestra solo cuando el diálogo lo pide.
    this.asPrompt = !!opts.asPrompt;
    this.promptValue = null;
    if (inputEl) {
      if (opts.asPrompt) {
        inputEl.style.display = 'block';
        inputEl.type = opts.inputType || 'text';
        inputEl.placeholder = opts.placeholder || '';
        inputEl.value = opts.defaultValue ?? '';
      } else {
        inputEl.style.display = 'none';
        inputEl.value = '';
      }
    }

    this.lastFocused = (document.activeElement as HTMLElement) ?? null;
    if (this.modalEl) this.modalEl.classList.add('active');

    // Foco: input en prompts, botón de confirmación en el resto.
    window.requestAnimationFrame(() => {
      if (opts.asPrompt && inputEl) {
        inputEl.focus();
        inputEl.select();
      } else {
        btnConfirm?.focus();
      }
    });

    return new Promise<boolean>((resolve) => {
      this.resolvePromise = resolve;
    });
  }

  private static close(result: boolean) {
    if (this.asPrompt) {
      const inputEl = document.getElementById('dialog-prompt-input') as HTMLInputElement | null;
      this.promptValue = inputEl ? inputEl.value.trim() : null;
      this.asPrompt = false;
    }

    if (this.modalEl) this.modalEl.classList.remove('active');

    const resolve = this.resolvePromise;
    this.resolvePromise = null;

    // El foco regresa a quien abrió el diálogo (si sigue en el documento).
    const previous = this.lastFocused;
    this.lastFocused = null;
    if (previous?.isConnected) previous.focus();

    resolve?.(result);
  }
}

if (typeof window !== 'undefined') {
  (window as any).RondaDialog = RondaDialog;
  // Fallback seguro: intercepta llamadas nativas alert() para mostrarlas con la estética Night & Amber
  const nativeAlert = window.alert;
  window.alert = (msg?: any) => {
    if (document.body) {
      void RondaDialog.alert(String(msg ?? ''));
    } else {
      nativeAlert(msg);
    }
  };
}
