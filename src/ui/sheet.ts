/**
 * RONDA UI — Accesibilidad de Hojas Laterales (Drawers) y Modales de Formulario
 *
 * Provee:
 * - Atributos ARIA (`role="dialog"`, `aria-modal="true"`, `aria-labelledby`)
 * - Trampa de foco (Tab / Shift+Tab ciclan dentro del diálogo)
 * - Cierre con tecla `Escape` (respetando diálogos anidados como RondaDialog)
 * - Bloqueo de scroll en `document.body` mientras está abierto
 * - Retorno de foco al elemento que disparó la apertura
 */

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])'
].join(', ');

export interface SheetController {
  close: () => void;
}

const activeStack: Array<{ overlay: HTMLElement; close: () => void }> = [];

export function openSheet(options: {
  overlay: HTMLElement;
  dialog: HTMLElement;
  labelledBy?: string;
  triggerEl?: HTMLElement | null;
  onClose?: () => void;
}): SheetController {
  const { overlay, dialog, labelledBy, triggerEl, onClose } = options;
  const previousActive = (triggerEl || (document.activeElement as HTMLElement | null)) ?? null;
  const previousOverflow = document.body.style.overflow;

  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-hidden', 'false');
  if (labelledBy) {
    overlay.setAttribute('aria-labelledby', labelledBy);
  }
  dialog.setAttribute('tabindex', '-1');

  overlay.classList.add('active');
  overlay.style.display = 'flex';
  document.body.style.overflow = 'hidden';

  const getFocusables = (): HTMLElement[] =>
    Array.from(dialog.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
      (el) => el.offsetParent !== null || el === document.activeElement
    );

  const onKeyDown = (e: KeyboardEvent) => {
    // Si hay otro sheet más arriba en la pila o un RondaDialog abierto, no interceptar
    const topEntry = activeStack[activeStack.length - 1];
    if (topEntry && topEntry.overlay !== overlay) return;
    const rondaModal = document.getElementById('ronda-custom-dialog');
    if (rondaModal && rondaModal.style.display === 'flex') return;

    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      close();
      return;
    }

    if (e.key === 'Tab') {
      const focusables = getFocusables();
      if (focusables.length === 0) {
        e.preventDefault();
        dialog.focus();
        return;
      }
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement as HTMLElement | null;

      if (e.shiftKey) {
        if (!active || active === first || !dialog.contains(active)) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (!active || active === last || !dialog.contains(active)) {
          e.preventDefault();
          first.focus();
        }
      }
    }
  };

  let closed = false;
  const close = () => {
    if (closed) return;
    closed = true;
    document.removeEventListener('keydown', onKeyDown, true);
    const idx = activeStack.findIndex((item) => item.overlay === overlay);
    if (idx !== -1) activeStack.splice(idx, 1);

    overlay.classList.remove('active');
    overlay.style.display = 'none';
    overlay.setAttribute('aria-hidden', 'true');

    if (activeStack.length === 0) {
      document.body.style.overflow = previousOverflow;
    }

    onClose?.();

    if (previousActive && typeof previousActive.focus === 'function' && document.contains(previousActive)) {
      try {
        previousActive.focus();
      } catch {
        /* ignore focus errors */
      }
    }
  };

  activeStack.push({ overlay, close });
  document.addEventListener('keydown', onKeyDown, true);

  // Enfocar el primer input/botón interactivo del diálogo
  queueMicrotask(() => {
    const focusables = getFocusables();
    const firstInput = focusables.find((el) => el.tagName === 'INPUT' || el.tagName === 'SELECT' || el.tagName === 'TEXTAREA');
    (firstInput || focusables[0] || dialog).focus();
  });

  return { close };
}

