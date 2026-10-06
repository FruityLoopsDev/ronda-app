/**
 * src/footer.ts
 * Componente unificado de pie de página (Footer) y control de versión para RONDA.
 * Single Source of Truth: src/version.ts (autogenerado desde package.json).
 *
 * Estrategia SSR / estático / hidratación:
 * - Páginas portal (index, admin, crm, network, superadmin): `renderRondaFooter()`
 *   inyecta el footer estándar (idempotente, sin duplicados).
 * - Páginas públicas estáticas (landing, partners, invest): `hydrateRondaFooter()`
 *   solo actualiza los ganchos [data-ronda-version/copyright/madein] sin destruir
 *   el layout propio ni los contadores de visitas.
 */
import { APP_VERSION, APP_COPYRIGHT, APP_MADE_IN } from './version.js';

export function getRondaFooterHtml(): string {
  return `
    <footer class="ronda-footer" data-ronda-footer style="border-top: 1px solid var(--linea, rgba(243,237,226,0.12)); padding: 22px 24px; margin-top: 48px; font-family: var(--font-mono, monospace); font-size: 11px; color: var(--humo, #8c8378); background: rgba(10, 7, 14, 0.45); backdrop-filter: blur(8px);">
      <div style="max-width: 1100px; margin: 0 auto; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 14px;">
        <div style="display: flex; align-items: center; gap: 10px; flex-wrap: wrap;">
          <span style="font-weight: 600; color: var(--papel, #f3ede2);" data-ronda-copyright>${APP_COPYRIGHT}</span>
          <span style="opacity: 0.3;">|</span>
          <span style="display: inline-flex; align-items: center; gap: 6px; color: var(--humo, #8c8378);" data-ronda-madein>
            ${APP_MADE_IN} 
            <img src="https://flagcdn.com/16x12/co.png" alt="Colombia" style="height: 10px; width: 14px; object-fit: cover; border-radius: 2px; vertical-align: middle;">
          </span>
        </div>
        <div style="display: flex; align-items: center; gap: 14px; flex-wrap: wrap;">
          <span class="chip gris" data-ronda-version style="font-size: 10px; padding: 3px 10px; font-family: var(--font-mono, monospace); letter-spacing: 0.05em; background: rgba(243,237,226,0.06); border: 1px solid var(--linea, rgba(243,237,226,0.12)); border-radius: 999px; color: var(--papel, #f3ede2);">
            ${APP_VERSION}
          </span>
          <span style="font-size: 10px; color: var(--humo, #8c8378); opacity: 0.7;">Bogotá D.C.</span>
        </div>
      </div>
    </footer>
  `;
}

/** Actualiza los ganchos de versión/copyright ya presentes en el DOM (no destruye layout ni contadores). */
export function hydrateRondaFooter(root: ParentNode = document): void {
  root.querySelectorAll('[data-ronda-version]').forEach((el) => {
    if (el.textContent?.trim() !== APP_VERSION) el.textContent = APP_VERSION;
  });
  root.querySelectorAll('[data-ronda-copyright]').forEach((el) => {
    if (el.textContent?.trim() !== APP_COPYRIGHT) el.textContent = APP_COPYRIGHT;
  });
  root.querySelectorAll('[data-ronda-madein]').forEach((el) => {
    // Solo actualiza el nodo de texto inicial, preserva imágenes/hijos (bandera).
    const first = el.firstChild;
    if (first && first.nodeType === Node.TEXT_NODE) {
      const target = `${APP_MADE_IN} `;
      if (first.textContent !== target) first.textContent = target;
    } else if (!el.querySelector('img')) {
      el.textContent = APP_MADE_IN;
    }
  });
}

export function renderRondaFooter(targetContainer?: HTMLElement | string | null): void {
  // 1. Hidratar ganchos existentes primero (cubre footers custom con contadores).
  hydrateRondaFooter(document);

  // 2. Placeholder explícito tiene prioridad (portales sin footer propio).
  const placeholder = document.getElementById('footer-root') ?? document.querySelector('[data-ronda-footer-inject]');
  if (placeholder) {
    if (!placeholder.querySelector('footer.ronda-footer')) {
      placeholder.innerHTML = getRondaFooterHtml();
    } else {
      hydrateRondaFooter(placeholder);
    }
    return;
  }

  let container: HTMLElement | null = null;
  if (typeof targetContainer === 'string') {
    container = document.getElementById(targetContainer);
  } else if (targetContainer instanceof HTMLElement) {
    container = targetContainer;
  }

  // Si no se pasó contenedor específico, buscar el contenedor de vista activa o body
  if (!container) {
    container = document.querySelector('section.panel.on') || document.querySelector('main') || document.body;
  }

  if (!container) return;

  // 3. Si ya existe el footer estándar, solo hidratar (idempotente, preserva todo).
  const existing = container.querySelector('footer.ronda-footer') || document.querySelector('footer.ronda-footer');
  if (existing) {
    hydrateRondaFooter(existing.parentElement ?? document);
    return;
  }

  // 4. Si la página ya tiene un <footer> propio (con ganchos), NO duplicar: ya hidratado en paso 1.
  if (document.querySelector('footer')) return;

  // 5. Sin footer previo: inyectar el estándar al final del contenedor.
  container.insertAdjacentHTML('beforeend', getRondaFooterHtml());
}
