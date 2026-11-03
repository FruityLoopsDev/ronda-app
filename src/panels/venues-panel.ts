/**
 * venues-panel.ts — Módulo "Bares y anfitriones" del panel SuperAdmin.
 *
 * Antes la sección solo listaba locales y el botón "+ Registrar Local" abría un
 * aviso que enviaba a /network.html. Ahora el SuperAdmin crea, edita y pausa/
 * activa locales sin salir del panel, con la misma regla de exclusividad
 * territorial de 500 m que usa la Red de Bares (`src/territorial.ts`).
 *
 * El shell solo necesita: `render(stage)`, `refresh()` y `openCreate()`.
 */
import { deleteField } from 'firebase/firestore';
import { DB } from '../db.js';
import type { Venue } from '../db.js';
import { RondaDialog } from '../dialog.js';
import { Auth } from '../auth.js';
import { escapeHtml } from '../utils.js';
import { checkTerritorialExclusivity } from '../territorial.js';
import { DEFAULT_ECONOMICS } from '../config/b2b-policies.js';
import type { SuperAdminPanel } from './context.js';

/** Centro de referencia de Bogotá para un local nuevo (editable en el formulario). */
const BOGOTA_CENTER = { lat: 4.654, lng: -74.056 };
const ZONAS_SUGERIDAS = ['Zona G', 'Quinta Camacho', 'Chapinero Alto', 'Parque 93', 'Zona Rosa', 'Usaquén'];
const MESAS_POR_DEFECTO = 12;

function formatCop(n: number): string {
  return '$' + Number(n || 0).toLocaleString('es-CO');
}

function inputValue(id: string): string {
  return (document.getElementById(id) as HTMLInputElement | null)?.value.trim() || '';
}

function inputNumber(id: string): number {
  const raw = inputValue(id).replace(/\./g, '').replace(/,/g, '');
  const n = Number(raw);
  return Number.isFinite(n) ? n : NaN;
}

/** Coordenadas: el punto es separador decimal (a diferencia de los montos en COP). */
function inputDecimal(id: string): number {
  const raw = inputValue(id).replace(',', '.');
  const n = Number(raw);
  return Number.isFinite(n) ? n : NaN;
}

export class VenuesPanel implements SuperAdminPanel {
  private venues: Venue[] = [];
  private editing: Venue | null = null;
  private search = '';
  private filter: 'all' | 'active' | 'paused' = 'all';
  private modalInjected = false;
  private saving = false;

  async render(stage: HTMLElement): Promise<void> {
    this.ensureModal();
    stage.innerHTML = this.shell();
    this.bindHeaderFilters();
    this.bindStage();
    await this.load();
  }

  async refresh(): Promise<void> {
    await this.load();
  }

  /** Abre el alta de un local nuevo (botón de la cabecera del shell). */
  openCreate(): void {
    this.openModal(null);
  }

  // ==========================================================================
  // Plantilla del módulo
  // ==========================================================================
  private shell(): string {
    return `
      <div style="display:flex; flex-direction:column; gap:20px;">

        <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(200px, 1fr)); gap:14px;">
          <div class="sa-kpi-card">
            <span style="font-size:10px; font-family:var(--font-mono); color:var(--humo); text-transform:uppercase; display:block;">Locales en red</span>
            <b id="sa-venue-kpi-active" style="font-size:24px; color:var(--papel); font-family:var(--font-display); display:block; margin-top:4px;">—</b>
            <span id="sa-venue-kpi-active-sub" style="font-size:10.5px; color:var(--humo); font-family:var(--font-mono);">cargando…</span>
          </div>
          <div class="sa-kpi-card" style="border-color:rgba(240,168,48,0.25);">
            <span style="font-size:10px; font-family:var(--font-mono); color:var(--humo); text-transform:uppercase; display:block;">Mesas disponibles</span>
            <b id="sa-venue-kpi-tables" style="font-size:24px; color:var(--luz); font-family:var(--font-display); display:block; margin-top:4px;">—</b>
            <span id="sa-venue-kpi-tables-sub" style="font-size:10.5px; color:var(--humo); font-family:var(--font-mono);">solo locales activos</span>
          </div>
          <div class="sa-kpi-card" style="border-color:rgba(121,211,172,0.25);">
            <span style="font-size:10px; font-family:var(--font-mono); color:var(--humo); text-transform:uppercase; display:block;">Paquete de barra promedio</span>
            <b id="sa-venue-kpi-price" style="font-size:24px; color:#79D3AC; font-family:var(--font-display); display:block; margin-top:4px;">—</b>
            <span id="sa-venue-kpi-price-sub" style="font-size:10.5px; color:var(--humo); font-family:var(--font-mono);">COP por asistente</span>
          </div>
        </div>

        <section class="sa-panel-card" style="padding:0; overflow:hidden;">
          <div style="padding:18px 20px; border-bottom:1px solid var(--linea); display:flex; justify-content:space-between; align-items:center; gap:12px; flex-wrap:wrap;">
            <div>
              <h4 style="font-family:var(--font-display); font-size:16px; color:var(--papel); margin:0;">Red de establecimientos aliados</h4>
              <p style="font-size:11.5px; color:var(--humo); margin:3px 0 0;">Exclusividad de 500 m entre locales activos. Cada alta o cambio queda auditado con tu UID.</p>
            </div>
            <span id="sa-venues-count" style="font-size:11px; color:var(--humo); font-family:var(--font-mono);">—</span>
          </div>

          <div id="sa-venues-list" style="overflow-x:auto;">
            <p style="font-size:12px; color:var(--humo); padding:18px 20px;">Cargando locales…</p>
          </div>
        </section>

      </div>
    `;
  }

  // ==========================================================================
  // Filtros de la cabecera (los pinta el shell)
  // ==========================================================================
  private bindHeaderFilters(): void {
    const search = document.getElementById('sa-venues-search') as HTMLInputElement | null;
    const filter = document.getElementById('sa-venues-filter') as HTMLSelectElement | null;

    if (search) {
      search.value = this.search;
      search.addEventListener('input', () => {
        this.search = search.value.trim().toLowerCase();
        this.renderRows();
      });
    }
    if (filter) {
      filter.value = this.filter;
      filter.addEventListener('change', () => {
        const value = filter.value;
        this.filter = value === 'active' || value === 'paused' ? value : 'all';
        this.renderRows();
      });
    }
  }

  private bindStage(): void {
    const list = document.getElementById('sa-venues-list');
    if (!list) return;
    list.addEventListener('click', (e) => {
      const target = (e.target as HTMLElement).closest('.sa-venue-edit, .sa-venue-toggle, .sa-venue-new') as HTMLElement | null;
      if (!target || !list.contains(target)) return;

      if (target.classList.contains('sa-venue-new')) {
        this.openCreate();
        return;
      }
      const id = target.getAttribute('data-id') || '';
      if (!id) return;
      if (target.classList.contains('sa-venue-edit')) this.openModal(this.venues.find((v) => v.id === id) || null);
      else void this.toggleStatus(id);
    });
  }

  // ==========================================================================
  // Datos
  // ==========================================================================
  private async load(): Promise<void> {
    const list = document.getElementById('sa-venues-list');
    if (list && this.venues.length === 0) {
      list.innerHTML = `<p style="font-size:12px; color:var(--humo); padding:18px 20px;">Cargando locales…</p>`;
    }
    try {
      this.venues = (await DB.getVenues()) || [];
    } catch (err) {
      console.error('[VenuesPanel] Error cargando locales:', err);
      this.venues = [];
    }
    this.renderKpis();
    this.renderRows();
  }

  private tablesOf(v: Venue): number {
    if (typeof v.tablesCount === 'number' && v.tablesCount > 0) return v.tablesCount;
    // Compatibilidad con registros legados que solo guardaban `capacity`.
    const legacy = Number((v as Venue & { capacity?: number }).capacity);
    return Number.isFinite(legacy) && legacy > 0 ? Math.floor(legacy / 2) : 0;
  }

  private renderKpis(): void {
    const active = this.venues.filter((v) => v.status === 'active');
    const tables = active.reduce((sum, v) => sum + this.tablesOf(v), 0);

    const priced = this.venues.filter((v) => typeof v.bar_package_price_cop === 'number' && v.bar_package_price_cop > 0);
    const avgPrice = priced.length > 0
      ? Math.round(priced.reduce((sum, v) => sum + (v.bar_package_price_cop || 0), 0) / priced.length)
      : null;

    const activeEl = document.getElementById('sa-venue-kpi-active');
    const activeSub = document.getElementById('sa-venue-kpi-active-sub');
    if (activeEl) activeEl.textContent = `${active.length} / ${this.venues.length}`;
    if (activeSub) activeSub.textContent = `${this.venues.length - active.length} en pausa · exclusividad 500 m`;

    const tablesEl = document.getElementById('sa-venue-kpi-tables');
    if (tablesEl) {
      tablesEl.innerHTML = `${tables} <span style="font-size:12px; color:var(--humo); font-family:var(--font-mono); letter-spacing:0;">mesas</span>`;
    }
    const tablesSub = document.getElementById('sa-venue-kpi-tables-sub');
    if (tablesSub) tablesSub.textContent = `${tables * 2} plazas en noches activas`;

    const priceEl = document.getElementById('sa-venue-kpi-price');
    if (priceEl) priceEl.textContent = avgPrice === null ? '—' : formatCop(avgPrice);
    const priceSub = document.getElementById('sa-venue-kpi-price-sub');
    if (priceSub) {
      priceSub.textContent = avgPrice === null
        ? 'sin precios definidos'
        : `${priced.length} de ${this.venues.length} con precio`;
    }
  }

  private visibleVenues(): Venue[] {
    return this.venues.filter((v) => {
      if (this.filter === 'active' && v.status !== 'active') return false;
      if (this.filter === 'paused' && v.status === 'active') return false;
      if (!this.search) return true;
      const haystack = [v.name, v.zone, v.address, v.id, v.nit].filter(Boolean).join(' ').toLowerCase();
      return haystack.includes(this.search);
    });
  }

  private statusBadge(v: Venue): string {
    return v.status === 'active'
      ? '<span style="font-size:9.5px; font-family:var(--font-mono); font-weight:700; color:#79D3AC; border:1px solid rgba(121,211,172,0.45); background:rgba(46,107,84,0.12); border-radius:999px; padding:2px 8px;">● En red</span>'
      : '<span style="font-size:9.5px; font-family:var(--font-mono); font-weight:700; color:var(--luz); border:1px solid rgba(240,168,48,0.45); background:rgba(240,168,48,0.1); border-radius:999px; padding:2px 8px;">⏸ Pausado</span>';
  }

  private renderRows(): void {
    const list = document.getElementById('sa-venues-list');
    const countEl = document.getElementById('sa-venues-count');
    if (!list) return;

    const rows = this.visibleVenues();
    if (countEl) {
      countEl.textContent = this.venues.length === 0
        ? '0 locales'
        : `${rows.length} de ${this.venues.length} locales`;
    }

    if (this.venues.length === 0) {
      list.innerHTML = `
        <div style="text-align:center; padding:40px 20px;">
          <span style="font-size:28px; display:block; margin-bottom:8px;">🏢</span>
          <b style="color:var(--papel); font-size:14px; display:block;">Aún no hay locales aliados</b>
          <span style="font-size:11.5px; color:var(--humo); display:block; margin-top:4px;">Registra el primer bar para abrir la red y validar su radio de exclusividad.</span>
          <button class="btn ambar sa-venue-new" style="font-size:11.5px; padding:9px 16px; font-weight:700; margin-top:16px; width:auto; flex:0 0 auto;">+ Registrar el primer local</button>
        </div>
      `;
      return;
    }

    if (rows.length === 0) {
      list.innerHTML = `<p style="font-size:12px; color:var(--humo); padding:22px 20px;">Sin locales que coincidan con el filtro actual.</p>`;
      return;
    }

    const body = rows.map((v) => {
      const tables = this.tablesOf(v);
      const price = typeof v.bar_package_price_cop === 'number' && v.bar_package_price_cop > 0
        ? `${formatCop(v.bar_package_price_cop)} <span style="color:var(--humo); font-size:10px;">/ asistente</span>`
        : '<span style="color:var(--humo);">—</span>';
      const owner = v.ownerUid
        ? `<span style="font-family:var(--font-mono); font-size:10.5px; color:var(--papel);" title="${escapeHtml(v.ownerUid)}">${escapeHtml(v.ownerUid.length > 12 ? v.ownerUid.slice(0, 12) + '…' : v.ownerUid)}</span>`
        : '<span style="color:var(--humo);">Sin asignar</span>';

      return `
        <tr style="border-bottom:1px solid rgba(243,237,226,0.06);">
          <td style="padding:14px 16px;">
            <div style="display:flex; align-items:center; gap:12px;">
              <div style="width:36px; height:36px; border-radius:8px; background:rgba(240,168,48,0.12); border:1px solid rgba(240,168,48,0.3); display:flex; align-items:center; justify-content:center; font-size:16px;">🍸</div>
              <div>
                <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
                  <b style="color:var(--papel); font-size:13.5px;">${escapeHtml(v.name || 'Bar aliado')}</b>
                  ${this.statusBadge(v)}
                </div>
                <span style="font-size:11px; color:var(--humo); font-family:var(--font-mono);">${escapeHtml(v.id)}${v.nit ? ` · NIT ${escapeHtml(v.nit)}` : ''}</span>
              </div>
            </div>
          </td>
          <td style="padding:14px 16px;">
            <span style="color:var(--papel); font-size:12.5px; display:block;">${escapeHtml(v.zone || 'Bogotá D.C.')}</span>
            <span style="font-size:11px; color:var(--humo);">${escapeHtml(v.address || 'Sin dirección')}</span>
          </td>
          <td style="padding:14px 16px; font-family:var(--font-mono); font-size:12px; color:var(--papel);">
            ${tables} mesas
            <span style="display:block; font-size:10.5px; color:var(--humo);">${tables * 2} personas</span>
          </td>
          <td style="padding:14px 16px;">${owner}</td>
          <td style="padding:14px 16px; font-family:var(--font-mono); font-size:11.5px; color:var(--papel);">${price}</td>
          <td style="padding:14px 16px; text-align:right;">
            <div style="display:inline-flex; gap:6px; flex-wrap:wrap; justify-content:flex-end;">
              <button class="btn sa-venue-edit" data-id="${escapeHtml(v.id)}" style="font-size:10.5px; padding:6px 10px; width:auto; flex:0 0 auto; background:rgba(243,237,226,0.06); border-color:var(--linea); color:var(--papel);">✏️ Editar</button>
              <button class="btn sa-venue-toggle" data-id="${escapeHtml(v.id)}" data-status="${v.status}" style="font-size:10.5px; padding:6px 10px; width:auto; flex:0 0 auto; background:rgba(243,237,226,0.06); border-color:var(--linea); color:var(--papel);">${v.status === 'active' ? '⏸ Pausar' : '▶ Activar'}</button>
              <a href="/admin.html?venueId=${encodeURIComponent(v.id)}" target="_blank" rel="noopener" class="btn" style="font-size:10.5px; padding:6px 10px; width:auto; flex:0 0 auto; text-decoration:none; background:rgba(243,237,226,0.06); border-color:var(--linea); color:var(--papel); display:inline-flex; align-items:center; gap:4px;">🚪 Sala</a>
            </div>
          </td>
        </tr>
      `;
    }).join('');

    list.innerHTML = `
      <table style="width:100%; border-collapse:collapse; text-align:left;">
        <thead>
          <tr style="border-bottom:1px solid var(--linea); background:rgba(243,237,226,0.02);">
            <th style="padding:12px 16px; font-size:11px; font-family:var(--font-mono); color:var(--humo); font-weight:600;">ESTABLECIMIENTO</th>
            <th style="padding:12px 16px; font-size:11px; font-family:var(--font-mono); color:var(--humo); font-weight:600;">ZONA</th>
            <th style="padding:12px 16px; font-size:11px; font-family:var(--font-mono); color:var(--humo); font-weight:600;">CAPACIDAD</th>
            <th style="padding:12px 16px; font-size:11px; font-family:var(--font-mono); color:var(--humo); font-weight:600;">DUEÑO / RESPONSABLE</th>
            <th style="padding:12px 16px; font-size:11px; font-family:var(--font-mono); color:var(--humo); font-weight:600;">PAQUETE BARRA</th>
            <th style="padding:12px 16px; font-size:11px; font-family:var(--font-mono); color:var(--humo); font-weight:600; text-align:right;">ACCIONES</th>
          </tr>
        </thead>
        <tbody>${body}</tbody>
      </table>
    `;
  }

  // ==========================================================================
  // Alta / edición
  // ==========================================================================
  private ensureModal(): void {
    if (this.modalInjected) return;
    this.modalInjected = true;

    if (!document.getElementById('sa-venue-overlay')) {
      const wrapper = document.createElement('div');
      wrapper.innerHTML = `
        <div id="sa-venue-overlay" style="display:none; position:fixed; inset:0; z-index:10002; background:rgba(10,7,14,0.88); backdrop-filter:blur(8px); padding:16px; align-items:center; justify-content:center;">
          <div style="background:rgba(22,16,27,0.98); border:1px solid var(--linea); border-radius:18px; width:100%; max-width:620px; max-height:90vh; overflow-y:auto; padding:24px 22px;">
            <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:12px; margin-bottom:6px;">
              <div>
                <h4 id="sa-venue-modal-title" style="font-family:var(--font-display); font-size:18px; color:var(--papel); margin:0;">🏢 Nuevo local aliado</h4>
                <p id="sa-venue-modal-hint" style="font-size:11.5px; color:var(--humo); margin:4px 0 0;">Completa la ficha comercial. El radio de 500 m se valida al guardar.</p>
              </div>
              <button id="sa-venue-close" style="background:none; border:none; color:var(--humo); font-size:20px; cursor:pointer;" title="Cerrar">✕</button>
            </div>

            <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(220px, 1fr)); gap:12px; margin-top:14px;">
              <label style="display:flex; flex-direction:column; gap:5px; font-size:10.5px; color:var(--humo); font-family:var(--font-mono); text-transform:uppercase;">
                Nombre comercial *
                <input id="sa-venue-name" class="ronda-input" style="margin-bottom:0;" placeholder="Ej. Café Quinta Camacho" maxlength="80">
              </label>
              <label style="display:flex; flex-direction:column; gap:5px; font-size:10.5px; color:var(--humo); font-family:var(--font-mono); text-transform:uppercase;">
                Zona *
                <input id="sa-venue-zone" class="ronda-input" style="margin-bottom:0;" list="sa-venue-zones" placeholder="Ej. Zona G" maxlength="60">
                <datalist id="sa-venue-zones">${ZONAS_SUGERIDAS.map((z) => `<option value="${escapeHtml(z)}"></option>`).join('')}</datalist>
              </label>
              <label style="display:flex; flex-direction:column; gap:5px; font-size:10.5px; color:var(--humo); font-family:var(--font-mono); text-transform:uppercase; grid-column:1 / -1;">
                Dirección *
                <input id="sa-venue-address" class="ronda-input" style="margin-bottom:0;" placeholder="Ej. Calle 69 # 5-30" maxlength="120">
              </label>
              <label style="display:flex; flex-direction:column; gap:5px; font-size:10.5px; color:var(--humo); font-family:var(--font-mono); text-transform:uppercase;">
                NIT (opcional)
                <input id="sa-venue-nit" class="ronda-input" style="margin-bottom:0;" placeholder="900.123.456-7" maxlength="20">
              </label>
              <label style="display:flex; flex-direction:column; gap:5px; font-size:10.5px; color:var(--humo); font-family:var(--font-mono); text-transform:uppercase;">
                Mesas por noche
                <input id="sa-venue-tables" class="ronda-input" type="number" min="0" max="120" step="1" style="margin-bottom:0;" placeholder="${MESAS_POR_DEFECTO}">
              </label>
              <label style="display:flex; flex-direction:column; gap:5px; font-size:10.5px; color:var(--humo); font-family:var(--font-mono); text-transform:uppercase;">
                Paquete de barra (COP)
                <input id="sa-venue-price" class="ronda-input" type="number" min="0" step="500" style="margin-bottom:0;" placeholder="Ej. 22500">
                <span id="sa-venue-price-hint" style="font-size:10px; color:var(--humo); font-family:var(--font-mono); text-transform:none; letter-spacing:0;">Tope de política: ${formatCop(DEFAULT_ECONOMICS.bar_package_cap_cop)} COP</span>
              </label>
              <label style="display:flex; flex-direction:column; gap:5px; font-size:10.5px; color:var(--humo); font-family:var(--font-mono); text-transform:uppercase;">
                Estado
                <select id="sa-venue-status" class="ronda-input" style="margin-bottom:0;">
                  <option value="active">Activo en red</option>
                  <option value="inactive">Pausado</option>
                </select>
              </label>
              <label style="display:flex; flex-direction:column; gap:5px; font-size:10.5px; color:var(--humo); font-family:var(--font-mono); text-transform:uppercase;">
                Latitud *
                <input id="sa-venue-lat" class="ronda-input" type="number" step="0.000001" style="margin-bottom:0;" placeholder="4.654000">
              </label>
              <label style="display:flex; flex-direction:column; gap:5px; font-size:10.5px; color:var(--humo); font-family:var(--font-mono); text-transform:uppercase;">
                Longitud *
                <input id="sa-venue-lng" class="ronda-input" type="number" step="0.000001" style="margin-bottom:0;" placeholder="-74.056000">
              </label>
              <label style="display:flex; flex-direction:column; gap:5px; font-size:10.5px; color:var(--humo); font-family:var(--font-mono); text-transform:uppercase; grid-column:1 / -1;">
                UID del dueño (opcional)
                <input id="sa-venue-owner" class="ronda-input" style="margin-bottom:0;" placeholder="Firebase Auth UID del responsable del local" maxlength="128">
              </label>
            </div>

            <div id="sa-venue-exclusivity" style="display:none; margin-top:14px; border-radius:10px; padding:11px 13px; font-size:11.5px; line-height:1.5; font-family:var(--font-mono);"></div>
            <p id="sa-venue-error" style="display:none; margin:12px 0 0; font-size:11.5px; color:#ff8ca8; line-height:1.45;"></p>

            <div style="display:flex; gap:10px; margin-top:18px;">
              <button id="sa-venue-cancel" class="btn" style="flex:1; padding:11px; font-size:12px; background:rgba(243,237,226,0.05); border-color:var(--linea);">Cancelar</button>
              <button id="sa-venue-save" class="btn ambar" style="flex:2; padding:11px; font-size:12.5px; font-weight:700;">Guardar local</button>
            </div>
          </div>
        </div>
      `;
      document.body.appendChild(wrapper);
    }

    document.getElementById('sa-venue-close')?.addEventListener('click', () => this.closeModal());
    document.getElementById('sa-venue-cancel')?.addEventListener('click', () => this.closeModal());
    document.getElementById('sa-venue-save')?.addEventListener('click', () => void this.save());
    document.getElementById('sa-venue-overlay')?.addEventListener('click', (e) => {
      if ((e.target as HTMLElement).id === 'sa-venue-overlay') this.closeModal();
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.isModalOpen()) this.closeModal();
    });

    ['sa-venue-name', 'sa-venue-zone', 'sa-venue-address', 'sa-venue-nit', 'sa-venue-tables', 'sa-venue-price', 'sa-venue-owner']
      .forEach((id) => document.getElementById(id)?.addEventListener('input', () => this.refreshFormState()));
    ['sa-venue-status', 'sa-venue-lat', 'sa-venue-lng']
      .forEach((id) => {
        document.getElementById(id)?.addEventListener('input', () => this.refreshFormState());
        document.getElementById(id)?.addEventListener('change', () => this.refreshFormState());
      });
  }

  private isModalOpen(): boolean {
    const overlay = document.getElementById('sa-venue-overlay');
    return !!overlay && overlay.style.display === 'flex';
  }

  private openModal(venue: Venue | null): void {
    this.ensureModal();
    this.editing = venue;
    const overlay = document.getElementById('sa-venue-overlay');
    if (!overlay) return;

    const title = document.getElementById('sa-venue-modal-title');
    const hint = document.getElementById('sa-venue-modal-hint');
    if (title) title.textContent = venue ? `🏢 Editar ${venue.name || 'local'}` : '🏢 Nuevo local aliado';
    if (hint) {
      hint.textContent = venue
        ? `ID ${venue.id}. Los cambios quedan auditados con tu UID.`
        : 'Completa la ficha comercial. El radio de 500 m se valida al guardar.';
    }

    this.setField('sa-venue-name', venue?.name || '');
    this.setField('sa-venue-zone', venue?.zone || '');
    this.setField('sa-venue-address', venue?.address || '');
    this.setField('sa-venue-nit', venue?.nit || '');
    this.setField('sa-venue-tables', String(venue ? this.tablesOf(venue) : MESAS_POR_DEFECTO));
    this.setField('sa-venue-price', venue?.bar_package_price_cop ? String(venue.bar_package_price_cop) : '');
    this.setField('sa-venue-owner', venue?.ownerUid || '');
    this.setField('sa-venue-lat', String(venue?.lat ?? BOGOTA_CENTER.lat));
    this.setField('sa-venue-lng', String(venue?.lng ?? BOGOTA_CENTER.lng));

    const status = document.getElementById('sa-venue-status') as HTMLSelectElement | null;
    if (status) status.value = venue?.status === 'inactive' ? 'inactive' : 'active';

    overlay.style.display = 'flex';
    this.refreshFormState();
    overlay.scrollTop = 0;
    (document.getElementById('sa-venue-name') as HTMLInputElement | null)?.focus();
  }

  private closeModal(): void {
    const overlay = document.getElementById('sa-venue-overlay');
    if (overlay) overlay.style.display = 'none';
    this.editing = null;
    this.clearError();
  }

  private setField(id: string, value: string): void {
    const el = document.getElementById(id) as HTMLInputElement | null;
    if (el) el.value = value;
  }

  // ==========================================================================
  // Validación + exclusividad en vivo
  // ==========================================================================
  private readForm(): { ok: boolean; error?: string; lat?: number; lng?: number } {
    const name = inputValue('sa-venue-name');
    const zone = inputValue('sa-venue-zone');
    const address = inputValue('sa-venue-address');
    const lat = inputDecimal('sa-venue-lat');
    const lng = inputDecimal('sa-venue-lng');

    if (!name) return { ok: false, error: 'El nombre comercial es obligatorio.' };
    if (!zone) return { ok: false, error: 'Indica la zona del local.' };
    if (!address) return { ok: false, error: 'La dirección es obligatoria.' };
    if (!Number.isFinite(lat) || lat < -90 || lat > 90) return { ok: false, error: 'La latitud debe ser un número entre -90 y 90.' };
    if (!Number.isFinite(lng) || lng < -180 || lng > 180) return { ok: false, error: 'La longitud debe ser un número entre -180 y 180.' };
    return { ok: true, lat, lng };
  }

  private refreshFormState(): void {
    const parsed = this.readForm();
    const status = (document.getElementById('sa-venue-status') as HTMLSelectElement | null)?.value === 'inactive' ? 'inactive' : 'active';
    const price = inputNumber('sa-venue-price');

    const priceHint = document.getElementById('sa-venue-price-hint');
    if (priceHint) {
      if (Number.isFinite(price) && price > DEFAULT_ECONOMICS.bar_package_cap_cop) {
        priceHint.textContent = `⚠️ Supera el tope de política (${formatCop(DEFAULT_ECONOMICS.bar_package_cap_cop)} COP). El motor B2B rechazará el hito.`;
        priceHint.style.color = '#ff8ca8';
      } else {
        priceHint.textContent = `Tope de política: ${formatCop(DEFAULT_ECONOMICS.bar_package_cap_cop)} COP`;
        priceHint.style.color = 'var(--humo)';
      }
    }

    this.renderExclusivity(parsed, status);

    const saveBtn = document.getElementById('sa-venue-save') as HTMLButtonElement | null;
    if (saveBtn) {
      saveBtn.disabled = !parsed.ok;
      saveBtn.style.opacity = parsed.ok ? '1' : '0.55';
      saveBtn.style.cursor = parsed.ok ? 'pointer' : 'not-allowed';
    }

    // No regañar mientras el formulario está vacío; sí avisar cuando ya parece
    // completo pero un dato es inválido (p. ej. una latitud fuera de rango).
    const looksComplete = inputValue('sa-venue-name') && inputValue('sa-venue-zone') && inputValue('sa-venue-address');
    if (parsed.ok || !looksComplete) this.clearError();
    else this.showError(parsed.error || 'Revisa los datos del local.');
  }

  private renderExclusivity(parsed: { ok: boolean; lat?: number; lng?: number }, status: 'active' | 'inactive'): void {
    const box = document.getElementById('sa-venue-exclusivity');
    if (!box) return;
    if (!parsed.ok || parsed.lat === undefined || parsed.lng === undefined) {
      box.style.display = 'none';
      return;
    }

    const check = checkTerritorialExclusivity(
      { lat: parsed.lat, lng: parsed.lng, id: this.editing?.id },
      this.venues
    );
    const nearest = check.closestDistanceMeters >= 0 ? ` Local activo más cercano a ${check.closestDistanceMeters} m.` : '';

    box.style.display = 'block';
    if (status === 'inactive') {
      box.style.background = 'rgba(243,237,226,0.04)';
      box.style.border = '1px dashed var(--linea)';
      box.style.color = 'var(--humo)';
      box.innerHTML = `⏸ <b style="color:var(--papel);">Pausado:</b> no ocupa el radio de exclusividad.${nearest}`;
      return;
    }

    if (check.isCompliant) {
      box.style.background = 'rgba(46,107,84,0.12)';
      box.style.border = '1px solid rgba(121,211,172,0.35)';
      box.style.color = '#79D3AC';
      box.innerHTML = `✓ <b>Exclusividad territorial garantizada</b> (&gt; 500 m).${nearest || ' Sin locales activos en el radio.'}`;
      return;
    }

    const first = check.conflicts[0];
    const extra = check.conflicts.length > 1 ? ` (+${check.conflicts.length - 1} más)` : '';
    box.style.background = 'rgba(240,168,48,0.08)';
    box.style.border = '1px dashed rgba(240,168,48,0.45)';
    box.style.color = 'var(--luz)';
    box.innerHTML = `⚠️ <b>Conflicto territorial:</b> a ${first.distanceMeters} m de <b>${escapeHtml(first.conflictingVenueName)}</b>${extra}. El radio protegido es de 500 m.`;
  }

  private showError(message: string): void {
    const el = document.getElementById('sa-venue-error');
    if (!el) return;
    el.textContent = message;
    el.style.display = 'block';
  }

  private clearError(): void {
    const el = document.getElementById('sa-venue-error');
    if (!el) return;
    el.textContent = '';
    el.style.display = 'none';
  }

  // ==========================================================================
  // Guardado
  // ==========================================================================
  private async save(): Promise<void> {
    if (this.saving) return;
    const parsed = this.readForm();
    if (!parsed.ok) {
      this.showError(parsed.error || 'Revisa los datos del local.');
      return;
    }

    const isNew = !this.editing;
    const status = (document.getElementById('sa-venue-status') as HTMLSelectElement | null)?.value === 'inactive' ? 'inactive' : 'active';
    const tables = Math.max(0, Math.floor(inputNumber('sa-venue-tables') || 0)) || MESAS_POR_DEFECTO;
    const price = inputNumber('sa-venue-price');
    const nit = inputValue('sa-venue-nit');
    const ownerUid = inputValue('sa-venue-owner');
    const id = isNew ? `v_${Date.now()}` : this.editing!.id;

    // Solo el paso a "activo" exige revisar la exclusividad: un local ya activo
    // con conflictos heredados debe poder editarse sin bloqueos.
    const becomingActive = status === 'active' && (isNew || this.editing?.status !== 'active');
    if (becomingActive) {
      const check = checkTerritorialExclusivity({ lat: parsed.lat!, lng: parsed.lng!, id }, this.venues);
      if (!check.isCompliant) {
        const first = check.conflicts[0];
        const proceed = await RondaDialog.confirm({
          title: '⚠️ Conflicto territorial',
          message: `El local quedaría a <b>${first.distanceMeters} m</b> de <b>${escapeHtml(first.conflictingVenueName)}</b>, dentro del radio protegido de 500 m.<br><br>¿Deseas activarlo de todas formas?`,
          html: true,
          icon: '📍',
          confirmText: 'Activar de todas formas',
          cancelText: 'Cancelar',
        });
        if (!proceed) return;
      }
    }

    const patch: Venue = {
      id,
      name: inputValue('sa-venue-name'),
      address: inputValue('sa-venue-address'),
      zone: inputValue('sa-venue-zone'),
      lat: parsed.lat!,
      lng: parsed.lng!,
      status,
      tablesCount: tables,
      // Compatibilidad: pantallas heredadas leen `capacity` (2 plazas por mesa).
      capacity: tables * 2,
    };
    if (nit) patch.nit = nit;
    else if (!isNew) patch.nit = deleteField() as unknown as string;
    const priceForAudit = Number.isFinite(price) && price > 0 ? price : null;
    if (priceForAudit !== null) patch.bar_package_price_cop = priceForAudit;
    else if (!isNew) patch.bar_package_price_cop = deleteField() as unknown as number;
    if (ownerUid) patch.ownerUid = ownerUid;
    else if (!isNew) patch.ownerUid = deleteField() as unknown as string;

    const saveBtn = document.getElementById('sa-venue-save') as HTMLButtonElement | null;
    this.saving = true;
    if (saveBtn) { saveBtn.disabled = true; saveBtn.textContent = 'Guardando…'; }
    try {
      await DB.saveVenue(patch);
      await DB.logAudit({
        actor_uid: Auth.currentUser?.uid || 'superadmin',
        actor_type: 'superadmin',
        entity_type: 'venue',
        entity_id: id,
        action: isNew ? 'venue_created' : 'venue_updated',
        new_state: { name: patch.name, zone: patch.zone, status, tablesCount: tables, bar_package_price_cop: priceForAudit, lat: patch.lat, lng: patch.lng },
        reason: isNew ? 'Alta manual de local desde SuperAdmin' : 'Edición manual de local desde SuperAdmin',
        timestamp: new Date().toISOString(),
      }).catch((err) => console.warn('[VenuesPanel] No se pudo registrar auditoría:', err));

      this.closeModal();
      await this.load();
      await RondaDialog.alert({
        title: isNew ? 'Local registrado 🏢' : 'Local actualizado 🏢',
        message: `<b>${escapeHtml(patch.name)}</b> · ${escapeHtml(patch.zone)}<br/>Estado: <b>${status === 'active' ? '● En red' : '⏸ Pausado'}</b> · ${tables} mesas.`,
        icon: '✅',
        html: true,
      });
    } catch (err: any) {
      console.error('[VenuesPanel] Error guardando local:', err);
      this.showError(err?.message || 'No se pudo guardar el local en Firestore.');
    } finally {
      this.saving = false;
      if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = 'Guardar local'; this.refreshFormState(); }
    }
  }

  private async toggleStatus(id: string): Promise<void> {
    const venue = this.venues.find((v) => v.id === id);
    if (!venue) return;
    const nextStatus: Venue['status'] = venue.status === 'active' ? 'inactive' : 'active';

    if (nextStatus === 'active') {
      const check = checkTerritorialExclusivity({ lat: venue.lat, lng: venue.lng, id }, this.venues);
      if (!check.isCompliant) {
        const first = check.conflicts[0];
        const proceed = await RondaDialog.confirm({
          title: '⚠️ Conflicto territorial',
          message: `Activar <b>${escapeHtml(venue.name)}</b> genera colisión con <b>${escapeHtml(first.conflictingVenueName)}</b> a ${first.distanceMeters} m.<br><br>¿Deseas activarlo de todas formas?`,
          html: true,
          icon: '📍',
          confirmText: 'Activar de todas formas',
          cancelText: 'Cancelar',
        });
        if (!proceed) return;
      }
    }

    try {
      await DB.saveVenue({ id: venue.id, status: nextStatus } as Venue);
      await DB.logAudit({
        actor_uid: Auth.currentUser?.uid || 'superadmin',
        actor_type: 'superadmin',
        entity_type: 'venue',
        entity_id: venue.id,
        action: nextStatus === 'active' ? 'venue_activated' : 'venue_paused',
        previous_state: { status: venue.status },
        new_state: { status: nextStatus },
        reason: nextStatus === 'active' ? 'Reactivación manual desde SuperAdmin' : 'Pausa manual desde SuperAdmin',
        timestamp: new Date().toISOString(),
      }).catch((err) => console.warn('[VenuesPanel] No se pudo registrar auditoría:', err));

      await this.load();
    } catch (err: any) {
      console.error('[VenuesPanel] Error cambiando estado del local:', err);
      await RondaDialog.alert({ title: 'No se pudo cambiar el estado', message: err?.message || 'Revisa las reglas de Firestore.', icon: '⚠️', type: 'danger' });
    }
  }
}
