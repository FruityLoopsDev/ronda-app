// src/router.ts — Router SPA centralizado para RONDA
//
// Reemplaza la lógica de switchView/getPathViewMapping/getViewPathMapping
// que vivía acoplada dentro de initApp() en app.ts.

export interface ViewHandler {
  onEnter?: () => void | Promise<void>;
  onLeave?: () => void;
}

/** Mapeo de rutas URL → viewId */
const PATH_TO_VIEW: Record<string, string> = {
  '/client': 'view-client',
  '/ronda':  'view-client',
  '/lobby':  'view-lobby',
};

/** Mapeo inverso viewId → ruta URL */
const VIEW_TO_PATH: Record<string, string> = {
  'view-client': '/client',
  'view-lobby':  '/',
};

class RouterService {
  private handlers = new Map<string, ViewHandler>();
  private _current: string | null = null;

  /** Registrar listener global para eventos 'view:switch'. */
  init() {
    window.addEventListener('view:switch', ((e: CustomEvent) => {
      this.navigate(e.detail);
    }) as EventListener);
  }

  /** Asociar un handler de ciclo de vida a un viewId. */
  register(viewId: string, handler: ViewHandler) {
    this.handlers.set(viewId, handler);
  }

  /**
   * Navegar a un panel. Desactiva todos los .panel, activa el indicado,
   * actualiza URL (pushState) y dispara onLeave/onEnter de los handlers registrados.
   */
  navigate(viewId: string, updateUrl = true) {
    // onLeave del panel actual (solo si cambia)
    if (this._current && this._current !== viewId) {
      this.handlers.get(this._current)?.onLeave?.();
    }

    // Toggle clases .on en paneles
    document.querySelectorAll('.panel').forEach(el => el.classList.remove('on'));
    document.getElementById(viewId)?.classList.add('on');

    // History API
    if (updateUrl) {
      const targetPath = VIEW_TO_PATH[viewId] || '/';
      if (window.location.pathname !== targetPath) {
        try {
          window.history.pushState({ viewId }, '', targetPath);
        } catch (e) {
          console.warn('history.pushState falló (entorno local probable)', e);
        }
      }
    }

    this._current = viewId;

    // onEnter del nuevo panel
    this.handlers.get(viewId)?.onEnter?.();
  }

  /** Intentar resolver la URL actual a una ruta registrada. Retorna true si hubo match. */
  handleUrl(): boolean {
    const cleanPath = window.location.pathname.toLowerCase().replace(/\/$/, '');
    const viewId = PATH_TO_VIEW[cleanPath];
    if (viewId) {
      this.navigate(viewId, false);
      return true;
    }
    return false;
  }

  /** Verificar si la URL actual corresponde a una ruta autónoma (sin navegar). */
  matchesAutonomousRoute(): boolean {
    const cleanPath = window.location.pathname.toLowerCase().replace(/\/$/, '');
    return cleanPath in PATH_TO_VIEW;
  }

  /** ViewId actualmente activo, o null si ninguno. */
  get current() { return this._current; }
}

export const Router = new RouterService();
