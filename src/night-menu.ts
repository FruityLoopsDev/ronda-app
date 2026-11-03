// night-menu.ts: Carta de la Noche de RONDA
//
// Modelo único de la carta (cócteles de cortesía + precio de la consumición)
// y su render HTML para los diálogos del anfitrión y de la barra.
//
// Regla: este módulo produce HTML propio y escapa TODOS los valores dinámicos
// con `escapeHtml`, porque los diálogos lo insertan con `html: true`.

import type { NightMenu, NightMenuCocktail } from './db.js';
import { escapeHtml } from './utils.js';

/** Carta por defecto de la alianza mientras el local no configure la suya. */
export const DEFAULT_NIGHT_COCKTAILS: NightMenuCocktail[] = [
  { name: 'Penicillin Ahumado', ingredients: 'Whisky escocés, jengibre, miel, limón' },
  { name: 'Caronte Sour', ingredients: 'Pisco acholado, infusión botánica, angostura' }
];

export const DEFAULT_DRINK_PRICE_COP = 45000;

/**
 * Normaliza lo que venga de Firestore (posiblemente ausente o corrupto) a una
 * carta utilizable. Nunca lanza: la UI de sala debe poder abrir siempre.
 */
export function normalizeNightMenu(raw: NightMenu | undefined | null): NightMenu {
  const cocktails = Array.isArray(raw?.cocktails)
    ? raw!.cocktails
        .filter((c): c is NightMenuCocktail => !!c && typeof c.name === 'string' && c.name.trim().length > 0)
        .map((c) => ({ name: c.name.trim(), ingredients: (c.ingredients || '').trim() || undefined }))
    : [];

  return {
    cocktails: cocktails.length > 0 ? cocktails : DEFAULT_NIGHT_COCKTAILS.map((c) => ({ ...c })),
    priceCop: typeof raw?.priceCop === 'number' && raw.priceCop > 0 ? raw.priceCop : undefined,
    updatedAt: raw?.updatedAt,
    updatedBy: raw?.updatedBy
  };
}

/**
 * Construye la ficha visual de la carta para `RondaDialog({ html: true })`.
 *
 * Se usa una lista real (una fila por cóctel) en lugar de concatenar `<br>` y
 * `<b>`, que es lo que producía el desbordamiento y la lectura incómoda.
 */
export function buildNightMenuHtml(menu: NightMenu | undefined | null, priceCop?: number): string {
  const normalized = normalizeNightMenu(menu);
  const price = priceCop ?? normalized.priceCop ?? DEFAULT_DRINK_PRICE_COP;

  const rows = normalized.cocktails
    .map(
      (cocktail, index) => `
        <li style="display:flex;gap:10px;align-items:flex-start;padding:10px 0;border-bottom:1px dashed rgba(243,237,226,.12);text-align:left;list-style:none;">
          <span style="flex:0 0 20px;height:20px;border-radius:50%;background:rgba(240,168,48,.14);border:1px solid rgba(240,168,48,.35);color:var(--luz,#f0a830);font-family:var(--font-mono,'JetBrains Mono',monospace);font-size:10.5px;font-weight:700;line-height:20px;text-align:center;">${index + 1}</span>
          <span style="min-width:0;">
            <span style="display:block;color:var(--papel,#f3ede2);font-size:13.5px;font-weight:700;line-height:1.3;">${escapeHtml(cocktail.name)}</span>
            ${cocktail.ingredients
              ? `<span style="display:block;margin-top:2px;color:var(--humo,#8c8378);font-size:11.5px;line-height:1.45;">${escapeHtml(cocktail.ingredients)}</span>`
              : ''}
          </span>
        </li>`
    )
    .join('');

  return `
    <div style="text-align:left;">
      <p style="margin:0 0 12px;color:var(--humo,#8c8378);font-size:12px;line-height:1.5;">
        Cócteles de cortesía confirmados para la sala:
      </p>
      <ul style="margin:0;padding:0;border-top:1px solid rgba(243,237,226,.08);">${rows}</ul>
      <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;margin-top:14px;padding:10px 12px;border-radius:10px;background:rgba(240,168,48,.08);border:1px solid rgba(240,168,48,.25);">
        <span style="color:var(--humo,#8c8378);font-size:11px;font-family:var(--font-mono,'JetBrains Mono',monospace);text-transform:uppercase;letter-spacing:.08em;">Consumición incluida</span>
        <strong style="color:var(--luz,#f0a830);font-size:13.5px;font-family:var(--font-mono,'JetBrains Mono',monospace;white-space:nowrap;">$${price.toLocaleString('es-CO')} COP</strong>
      </div>
    </div>`;
}
