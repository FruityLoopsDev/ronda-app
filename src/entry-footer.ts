/**
 * src/entry-footer.ts
 * Entry mínimo para páginas públicas estáticas (landing, partners, invest).
 * Hidrata los ganchos [data-ronda-version/copyright/madein] desde src/version.ts
 * sin destruir el layout propio ni los contadores de visitas.
 */
import { hydrateRondaFooter } from './footer.js';

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => hydrateRondaFooter(document));
} else {
  hydrateRondaFooter(document);
}