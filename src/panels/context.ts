/**
 * context.ts — Contrato compartido entre el shell SuperAdmin y sus módulos.
 *
 * El shell (`src/superadmin.ts`) es dueño del menú lateral, la cabecera y el
 * escenario `#admin-stage`. Los módulos independientes (KYC, Tesorería) solo
 * declaran qué necesitan del shell: navegar a otra sección o pedir un refresh.
 * Así cada módulo se puede montar, probar y mover sin tocar el resto del panel.
 */

export type SuperAdminSection =
  | 'summary'
  | 'venues'
  | 'events'
  | 'bookings'
  | 'waitlist'
  | 'users'
  | 'metrics'
  | 'settings'
  | 'kyc'
  | 'treasury';

export interface PanelContext {
  /** Saltar a otra sección del panel (el shell re-renderiza cabecera y cuerpo). */
  navigate(section: SuperAdminSection): void;
}

/** Contrato mínimo que cumple todo módulo montable en `#admin-stage`. */
export interface SuperAdminPanel {
  /** Pinta el módulo dentro del escenario y dispara su primera carga. */
  render(stage: HTMLElement): Promise<void>;
  /** Recarga los datos sin desmontar el módulo (botón "Actualizar" de la cabecera). */
  refresh(): Promise<void>;
}
