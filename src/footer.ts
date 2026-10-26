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
import {
  APP_VERSION,
  APP_COPYRIGHT,
  APP_MADE_IN,
  APP_COMMIT_COUNT,
  APP_UNIQUE_DEV_DAYS,
  APP_DEV_HOURS,
  APP_FIRST_COMMIT,
  APP_LAST_COMMIT
} from './version.js';

function applyEngineeringMetrics(root: ParentNode, hours: number, commits: number, days: number): void {
  root.querySelectorAll('[data-ronda-hours]').forEach((el) => {
    el.textContent = `${hours}`;
  });
  root.querySelectorAll('[data-ronda-commits]').forEach((el) => {
    el.textContent = `${commits}`;
  });
  root.querySelectorAll('[data-ronda-calendar-days]').forEach((el) => {
    el.textContent = `${days}`;
  });
  root.querySelectorAll('[data-ronda-engineering-badge]').forEach((el) => {
    el.textContent = `⚡ +${hours}h de ingeniería · ${commits} deploys · Motor mem-rr-v2`;
  });
}

/** Consulta asíncrona no bloqueante a GitHub API con fallback en cache y reloj estocástico */
async function syncLiveGitMetrics(root: ParentNode): Promise<void> {
  const cacheKey = 'ronda_git_metrics_v2';
  const now = Date.now();

  try {
    const cached = localStorage.getItem(cacheKey);
    if (cached) {
      const parsed = JSON.parse(cached);
      // Revalida cada 4 horas
      if (now - parsed.timestamp < 4 * 60 * 60 * 1000 && parsed.hours) {
        applyEngineeringMetrics(root, parsed.hours, parsed.commits, parsed.days);
        return;
      }
    }

    const res = await fetch('https://api.github.com/repos/FruityLoopsDev/ronda-app/commits?per_page=1', {
      headers: { 'Accept': 'application/vnd.github.v3+json' }
    });

    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        const latestCommitDateStr = data[0]?.commit?.committer?.date || data[0]?.commit?.author?.date || APP_LAST_COMMIT;
        const latestCommitDate = new Date(latestCommitDateStr);
        
        let liveCommitCount = APP_COMMIT_COUNT || 88;
        const linkHeader = res.headers.get('link');
        if (linkHeader) {
          const match = linkHeader.match(/&page=(\d+)>; rel="last"/);
          if (match && match[1]) {
            liveCommitCount = parseInt(match[1], 10);
          }
        }

        const firstTime = new Date(APP_FIRST_COMMIT || '2026-08-23').getTime();
        const liveDays = Math.max(1, Math.floor((now - firstTime) / (1000 * 60 * 60 * 24)));
        const daysSinceLast = Math.max(0, Math.floor((now - latestCommitDate.getTime()) / (1000 * 60 * 60 * 24)));
        const liveHours = Math.round(((APP_UNIQUE_DEV_DAYS || 15) * 7.5) + (liveCommitCount * 1.25) + (daysSinceLast * 2));

        localStorage.setItem(cacheKey, JSON.stringify({
          timestamp: now,
          hours: liveHours,
          commits: liveCommitCount,
          days: liveDays
        }));

        applyEngineeringMetrics(root, liveHours, liveCommitCount, liveDays);
      }
    }
  } catch {
    // Si falla o no hay conexión, se mantiene el cálculo local ininterrumpido
  }
}

export function getRondaFooterHtml(): string {
  return `
    <footer class="ronda-footer site-footer" data-ronda-footer style="border-top: 1px solid var(--linea, rgba(243,237,226,0.12)); padding: 40px 24px 28px; margin-top: 48px; font-family: var(--font-sans, -apple-system, sans-serif); font-size: 12px; color: var(--humo, #8c8378); background: rgba(10, 7, 14, 0.65); backdrop-filter: blur(12px);">
      <div style="max-width: 1100px; margin: 0 auto;">
        
        <!-- Nivel Superior: Marca, Legal & Soporte -->
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 32px; align-items: flex-start; padding-bottom: 28px;">
          
          <!-- Col 1: Marca & Misión -->
          <div>
            <div style="font-family: var(--font-serif, 'Playfair Display', serif); font-size: 22px; font-weight: 700; letter-spacing: 0.08em; color: var(--papel, #f3ede2); margin-bottom: 6px;">
              R<em style="color: var(--luz, #F0A830); font-style: italic;">O</em>NDA
            </div>
            <div style="font-family: var(--font-mono, monospace); font-size: 10.5px; text-transform: uppercase; letter-spacing: 0.08em; color: var(--luz, #F0A830); margin-bottom: 8px; font-weight: 700;">
              Citas Presenciales · Bogotá, Colombia
            </div>
            <p style="font-size: 12px; line-height: 1.5; color: var(--humo, #8c8378); margin: 0 0 12px; max-width: 320px;">
              Experiencias curadas de citas presenciales de alto valor en ubicaciones secretas. Sin pantallas ni pérdida de tiempo.
            </p>
            <span data-ronda-engineering-badge style="display: inline-block; font-size: 10px; font-family: var(--font-mono, monospace); color: var(--luz, #F0A830); background: rgba(240,168,48,0.08); border: 1px solid rgba(240,168,48,0.22); padding: 3px 8px; border-radius: 4px; letter-spacing: 0.04em;">
              ⚡ <span data-ronda-hours>${APP_DEV_HOURS}</span>h de ingeniería · <span data-ronda-commits>${APP_COMMIT_COUNT}</span> deploys · Motor mem-rr-v2
            </span>
          </div>

          <!-- Col 2: Navegación & Marco Legal -->
          <div>
            <div style="font-family: var(--font-mono, monospace); font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.12em; color: var(--papel, #f3ede2); margin-bottom: 12px;">
              Explora & Marco Legal
            </div>
            <div style="display: flex; flex-direction: column; gap: 8px; font-size: 12px;">
              <a href="/" style="color: var(--humo, #8c8378); text-decoration: none; transition: color 0.2s;">✦ Portal Principal (Solteros)</a>
              <a href="/partners" style="color: var(--humo, #8c8378); text-decoration: none; transition: color 0.2s;">Para Bares Aliados (Partners)</a>
              <a href="/invest" style="color: var(--humo, #8c8378); text-decoration: none; transition: color 0.2s;">Pista Inversionistas FFF</a>
              <a href="index.html#legal-terminos" style="color: var(--humo, #8c8378); text-decoration: none; transition: color 0.2s;">Términos y Condiciones</a>
              <a href="index.html#legal-privacidad" style="color: var(--humo, #8c8378); text-decoration: none; transition: color 0.2s;">Política de Privacidad (Ley 1581)</a>
            </div>
          </div>

          <!-- Col 3: Contacto & Canales -->
          <div style="display: flex; flex-direction: column; gap: 12px;">
            <div style="font-family: var(--font-mono, monospace); font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.12em; color: var(--papel, #f3ede2);">
              Soporte & Comunidad
            </div>
            <a href="https://wa.me/573026543854?text=Hola%20RONDA,%20necesito%20soporte%20en%20el%20portal" target="_blank" rel="noopener noreferrer" style="display: inline-flex; align-items: center; gap: 8px; padding: 8px 12px; border-radius: 6px; background: rgba(46, 107, 84, 0.15); border: 1px solid rgba(46, 107, 84, 0.4); color: #8ce4be; text-decoration: none; font-size: 11.5px; font-weight: 600; width: fit-content;">
              <span style="display:inline-block; width:7px; height:7px; border-radius:50%; background:#25d366; box-shadow:0 0 6px #25d366;"></span>
              <span>WhatsApp Soporte (+57 302 654 3854)</span>
            </a>
            <div style="font-size: 10.5px; color: var(--humo, #8c8378); font-family: var(--font-mono, monospace);">
              Redes Oficiales:
            </div>
            <div style="display: flex; align-items: center; gap: 8px;">
              <a href="#" target="_blank" rel="noopener noreferrer" title="Instagram de RONDA" aria-label="Instagram" style="color:var(--humo, #8c8378); display:inline-flex; align-items:center; justify-content:center; width:28px; height:28px; border-radius:50%; background:rgba(255,255,255,0.04); border:1px solid var(--linea, rgba(243,237,226,0.12));">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="20" height="20" x="2" y="2" rx="5" ry="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" x2="17.51" y1="6.5" y2="6.5"/></svg>
              </a>
              <a href="#" target="_blank" rel="noopener noreferrer" title="LinkedIn de RONDA" aria-label="LinkedIn" style="color:var(--humo, #8c8378); display:inline-flex; align-items:center; justify-content:center; width:28px; height:28px; border-radius:50%; background:rgba(255,255,255,0.04); border:1px solid var(--linea, rgba(243,237,226,0.12));">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z"/><rect width="4" height="12" x="2" y="9"/><circle cx="4" cy="4" r="2"/></svg>
              </a>
              <a href="#" target="_blank" rel="noopener noreferrer" title="GitHub de RONDA" aria-label="GitHub" style="color:var(--humo, #8c8378); display:inline-flex; align-items:center; justify-content:center; width:28px; height:28px; border-radius:50%; background:rgba(255,255,255,0.04); border:1px solid var(--linea, rgba(243,237,226,0.12));">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4"/><path d="M9 18c-4.51 2-5-2-7-2"/></svg>
              </a>
            </div>
          </div>
        </div>

        <!-- Nivel Inferior: Meta & Copyright con Padding Anti-Solapamiento -->
        <div style="border-top: 1px solid rgba(243,237,226,0.08); padding-top: 18px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px; font-size: 11px; font-family: var(--font-mono, monospace);">
          <div style="display: flex; align-items: center; gap: 10px; flex-wrap: wrap;">
            <span style="font-weight: 600; color: var(--papel, #f3ede2);" data-ronda-copyright>${APP_COPYRIGHT}</span>
            <span style="opacity: 0.3;">·</span>
            <span style="display: inline-flex; align-items: center; gap: 6px; color: var(--humo, #8c8378);" data-ronda-madein>
              ${APP_MADE_IN} 
              <img src="https://flagcdn.com/16x12/co.png" alt="Colombia" style="height: 10px; width: 14px; object-fit: cover; border-radius: 2px; vertical-align: middle;">
            </span>
            <span style="opacity: 0.3;">·</span>
            <span class="chip gris" data-ronda-version style="font-size: 10px; padding: 2px 8px; border-radius: 999px; background: rgba(243,237,226,0.06); border: 1px solid var(--linea, rgba(243,237,226,0.12)); color: var(--papel, #f3ede2);">
              ${APP_VERSION}
            </span>
          </div>

          <div style="display: flex; align-items: center; gap: 12px; padding-right: 70px;">
            <span style="color: var(--humo, #8c8378); opacity: 0.8;">Bogotá D.C.</span>
          </div>
        </div>
      </div>
    </footer>
  `;
}

/** Actualiza los ganchos de versión/copyright ya presentes en el DOM (no destruye layout ni contadores). */
export function hydrateRondaFooter(root: ParentNode = document): void {
  // Cálculo dinámico día a día cruzando la información del control de versiones
  const now = new Date();
  const lastCommitDate = new Date(APP_LAST_COMMIT || '2026-10-26');
  const daysSinceLast = Math.max(0, Math.floor((now.getTime() - lastCommitDate.getTime()) / (1000 * 60 * 60 * 24)));
  // Suma 2 horas diarias de ingeniería/ops continuas por cada día calendario transcurrido
  const liveHours = (APP_DEV_HOURS || 223) + (daysSinceLast * 2);
  const liveDays = Math.max(1, Math.floor((now.getTime() - new Date(APP_FIRST_COMMIT || '2026-08-23').getTime()) / (1000 * 60 * 60 * 24)));

  // 1. Aplicación instantánea basada en el reloj local + constantes verificadas de Git
  applyEngineeringMetrics(root, liveHours, APP_COMMIT_COUNT || 88, liveDays);

  // 2. Disparo asíncrono no invasivo para cruzar en caliente con el repo de GitHub (si hay red)
  if (typeof window !== 'undefined') {
    setTimeout(() => {
      syncLiveGitMetrics(root);
    }, 1200);

    // 3. Ticker cada 30 min para avanzar automáticamente el contador si cambia el día en vivo
    const timerKey = '__ronda_footer_ticker__';
    if (!(window as any)[timerKey]) {
      (window as any)[timerKey] = setInterval(() => {
        hydrateRondaFooter(document);
      }, 30 * 60 * 1000);
    }
  }

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
