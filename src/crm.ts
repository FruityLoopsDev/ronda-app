import {
  DB,
  Lead,
  Venue,
  VenueRequest,
  LedgerEntry,
  Scout,
  UserRole,
  LeadsSyncMeta,
  LeadHistoryEvent
} from './db.js';
import { RondaDialog } from './dialog.js';
import { escapeHtml } from './utils.js';
import { Unsubscribe } from 'firebase/firestore';
import {
  bounty,
  accrued,
  toWaPhone,
  calculatePipelineSummary
} from './commissions.js';
import { BOGOTA_ZONES, normalizeSearchText } from './config/zones.js';
import { openSheet, SheetController } from './ui/sheet.js';
import { showCrmNotification } from './entry-crm.js';

type PipelineScope = 'all' | 'mine';
type SortMode = 'next_action' | 'recent' | 'accrued' | 'name';

export class CRMController {
  private leads: Lead[] = [];
  private currentSalesUid: string = 'sales1';
  private currentUserRole: UserRole = 'sales';
  private currentUserName: string = 'Scout';
  private scope: PipelineScope = 'mine';
  private filterZone: string = 'all';
  private filterDay: string = 'all';
  private sortMode: SortMode = 'next_action';
  private searchQuery: string = '';
  private isLoading: boolean = true;
  private subscriptionError: string | null = null;

  // --- Mi Estado de Cuenta (ledger propio del scout, solo lectura) ---
  private myLedger: LedgerEntry[] = [];
  private myProfile: Scout | null = null;
  private accountOpen = false;

  // --- Suscripciones y controladores de ciclo de vida (P2-15) ---
  private unsubscribeLeads: Unsubscribe | null = null;
  private domBound = false;
  private searchDebounceTimer: ReturnType<typeof setTimeout> | null = null;
  private activeSheet: SheetController | null = null;
  private domCleanups: Array<() => void> = [];

  constructor() {}

  async init(salesUid?: string, role: UserRole = 'sales', userName?: string) {
    console.log('[CRMController] Inicializando CRM de Ventas...');
    this.currentSalesUid = salesUid || 'sales1';
    this.currentUserRole = role;
    this.currentUserName = userName || this.currentSalesUid;

    // P1-6: Si el rol es superadmin/network/admin, por defecto ve todo el pipeline del equipo
    const canSeeAll = role === 'superadmin' || role === 'network' || role === 'admin';
    this.scope = canSeeAll ? 'all' : 'mine';

    const scopeSelect = document.getElementById('crm-scope-filter') as HTMLSelectElement | null;
    if (scopeSelect) {
      scopeSelect.style.display = canSeeAll ? 'inline-block' : 'none';
      scopeSelect.value = this.scope;
    }

    this.bindStaticDomListenersOnce();

    this.isLoading = true;
    this.subscriptionError = null;
    this.render();

    await this.loadMyAccount();
    await this.refreshLeads();
    this.renderMyAccount();

    this.setupLiveSubscription();
  }

  private setupLiveSubscription(): void {
    if (this.unsubscribeLeads) {
      this.unsubscribeLeads();
      this.unsubscribeLeads = null;
    }

    const filterUid = this.scope === 'mine' ? this.currentSalesUid : undefined;
    this.unsubscribeLeads = DB.subscribeToLeads(
      (liveLeads, meta) => {
        this.isLoading = false;
        this.subscriptionError = null;
        this.leads = liveLeads || [];
        this.updateSyncBadge(meta);
        this.syncZoneFilterOptions();
        this.render();
        // P1-10: Re-renderizar Estado de Cuenta en cada snapshot en vivo
        this.renderMyAccount();
      },
      filterUid,
      (err) => {
        this.isLoading = false;
        this.subscriptionError = err?.message || 'Permiso denegado o fallo de red al suscribirse a leads.';
        this.updateSyncBadge({ fromCache: true, hasPendingWrites: false });
        showCrmNotification('No se pudo sincronizar el pipeline en tiempo real: ' + this.subscriptionError, 'error');
        this.render();
      }
    );
  }

  destroy(): void {
    if (this.unsubscribeLeads) {
      this.unsubscribeLeads();
      this.unsubscribeLeads = null;
    }
    if (this.searchDebounceTimer) {
      clearTimeout(this.searchDebounceTimer);
      this.searchDebounceTimer = null;
    }
    if (this.activeSheet) {
      this.activeSheet.close();
      this.activeSheet = null;
    }
    for (const fn of this.domCleanups) {
      try {
        fn();
      } catch {
        /* ignore */
      }
    }
    this.domCleanups = [];
    this.domBound = false;
  }

  private bindStaticDomListenersOnce(): void {
    if (this.domBound) return;
    this.domBound = true;

    const on = <K extends keyof HTMLElementEventMap>(
      el: HTMLElement | null,
      type: K,
      handler: (ev: HTMLElementEventMap[K]) => void
    ) => {
      if (!el) return;
      el.addEventListener(type, handler);
      this.domCleanups.push(() => el.removeEventListener(type, handler));
    };

    const btnAdd = document.getElementById('btn-crm-add-lead-btn');
    on(btnAdd, 'click', (e) => {
      this.openNewLeadModal(e.currentTarget as HTMLElement);
    });

    // P2-16: Buscador con debounce de 150ms
    const searchInput = document.getElementById('crm-search-input') as HTMLInputElement | null;
    on(searchInput, 'input', () => {
      if (this.searchDebounceTimer) clearTimeout(this.searchDebounceTimer);
      this.searchDebounceTimer = setTimeout(() => {
        this.searchQuery = searchInput?.value.trim() || '';
        this.render();
      }, 150);
    });

    const zoneSelect = document.getElementById('crm-zone-filter') as HTMLSelectElement | null;
    on(zoneSelect, 'change', () => {
      this.filterZone = zoneSelect?.value || 'all';
      this.render();
    });

    const daySelect = document.getElementById('crm-day-filter') as HTMLSelectElement | null;
    on(daySelect, 'change', () => {
      this.filterDay = daySelect?.value || 'all';
      this.render();
    });

    const sortSelect = document.getElementById('crm-sort-select') as HTMLSelectElement | null;
    on(sortSelect, 'change', () => {
      this.sortMode = (sortSelect?.value as SortMode) || 'next_action';
      this.render();
    });

    const scopeSelect = document.getElementById('crm-scope-filter') as HTMLSelectElement | null;
    on(scopeSelect, 'change', () => {
      this.scope = (scopeSelect?.value as PipelineScope) || 'all';
      void this.refreshLeads();
      this.setupLiveSubscription();
    });

    const btnCsv = document.getElementById('btn-crm-export-csv');
    on(btnCsv, 'click', () => {
      this.exportCsv();
    });

    const drawerOverlay = document.getElementById('crm-lead-drawer-overlay');
    on(drawerOverlay, 'click', (e) => {
      if (e.target === drawerOverlay) this.closeLeadDetailModal();
    });

    // P2-16 + P3-27: Delegación única de eventos sobre el tablero Kanban y la tira "Hoy"
    const kanbanWrapper = document.getElementById('crm-kanban-wrapper');
    on(kanbanWrapper, 'click', (e) => this.handleDelegatedClick(e));
    on(kanbanWrapper, 'dragstart', (e) => this.handleDelegatedDragStart(e));
    on(kanbanWrapper, 'dragend', (e) => this.handleDelegatedDragEnd(e));

    const todayStrip = document.getElementById('crm-today-strip');
    on(todayStrip, 'click', (e) => this.handleDelegatedClick(e));

    this.bindColumnDropZonesOnce();
  }

  private bindColumnDropZonesOnce(): void {
    const columns: Array<{ id: string; status: 'lead' | 'negotiating' | 'signed' }> = [
      { id: 'kanban-lead', status: 'lead' },
      { id: 'kanban-negotiating', status: 'negotiating' },
      { id: 'kanban-signed', status: 'signed' }
    ];

    for (const col of columns) {
      const zone = document.getElementById(col.id);
      if (!zone || zone.dataset.dropBound === '1') continue;
      zone.dataset.dropBound = '1';

      zone.addEventListener('dragover', (e) => {
        e.preventDefault();
        zone.classList.add('drag-over');
      });
      zone.addEventListener('dragleave', () => {
        zone.classList.remove('drag-over');
      });
      zone.addEventListener('drop', async (e) => {
        e.preventDefault();
        zone.classList.remove('drag-over');
        const leadId = e.dataTransfer?.getData('text/plain');
        if (leadId) {
          await this.moveLead(leadId, col.status);
        }
      });
    }
  }

  private handleDelegatedDragStart(e: DragEvent): void {
    const card = (e.target as HTMLElement | null)?.closest<HTMLElement>('.kanban-lead-card');
    if (!card) return;
    const leadId = card.dataset.leadId;
    if (leadId && e.dataTransfer) {
      e.dataTransfer.setData('text/plain', leadId);
      card.classList.add('dragging');
    }
  }

  private handleDelegatedDragEnd(e: DragEvent): void {
    const card = (e.target as HTMLElement | null)?.closest<HTMLElement>('.kanban-lead-card');
    card?.classList.remove('dragging');
  }

  private handleDelegatedClick(e: MouseEvent): void {
    const target = e.target as HTMLElement | null;
    if (!target) return;

    const actionEl = target.closest<HTMLElement>('[data-action]');
    if (!actionEl) return;

    const action = actionEl.dataset.action;
    const leadId = actionEl.dataset.id;

    if (action === 'empty-add-lead') {
      this.openNewLeadModal(actionEl);
      return;
    }

    if (!leadId) return;

    switch (action) {
      case 'open-detail':
        this.openLeadDetailModal(leadId, actionEl);
        break;
      case 'move-lead': {
        const to = actionEl.dataset.to as 'lead' | 'negotiating' | 'signed' | undefined;
        if (to) void this.moveLead(leadId, to);
        break;
      }
      case 'delete-lead':
        void this.deleteLead(leadId);
        break;
      case 'agreement':
        void this.generateBarAgreement(leadId);
        break;
      case 'convert-venue':
        this.openConvertVenueModal(leadId, actionEl);
        break;
      case 'log-contact':
        void this.logLeadContact(leadId);
        break;
    }
  }

  // ============ Utilidades de Fechas en America/Bogota ============
  private currentBogotaDate(): string {
    try {
      return new Date().toLocaleDateString('en-CA', {
        timeZone: 'America/Bogota',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      });
    } catch {
      return new Date().toISOString().slice(0, 10);
    }
  }

  private currentBogotaMonth(): string {
    return this.currentBogotaDate().slice(0, 7);
  }

  private addDaysIso(days: number): string {
    const d = new Date(Date.now() + days * 86400000);
    try {
      return d.toLocaleDateString('en-CA', {
        timeZone: 'America/Bogota',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      });
    } catch {
      return d.toISOString().slice(0, 10);
    }
  }

  private updateSyncBadge(meta?: LeadsSyncMeta): void {
    const badge = document.getElementById('crm-sync-badge');
    if (!badge) return;

    if (!navigator.onLine || (meta?.fromCache && !meta?.hasPendingWrites)) {
      badge.className = 'crm-sync-badge cache';
      badge.textContent = '🟠 Caché local (Offline)';
    } else if (meta?.hasPendingWrites) {
      badge.className = 'crm-sync-badge pending';
      badge.textContent = '🟡 Sincronizando cambios…';
    } else {
      badge.className = 'crm-sync-badge online';
      badge.textContent = '🟢 En línea · Sincronizado';
    }
  }

  // P1-8: Poblar el selector de zonas con el catálogo oficial + cualquier zona presente en los leads
  private syncZoneFilterOptions(): void {
    const select = document.getElementById('crm-zone-filter') as HTMLSelectElement | null;
    if (!select) return;

    const currentVal = this.filterZone;
    const allZones = new Set<string>(BOGOTA_ZONES);
    for (const l of this.leads) {
      if (l.status !== 'archived' && l.zone && l.zone.trim()) {
        allZones.add(l.zone.trim());
      }
    }

    const optionsHtml = [
      `<option value="all">🌍 Todas las Zonas de Bogotá</option>`,
      ...Array.from(allZones).map(
        (z) => `<option value="${escapeHtml(z)}" ${z === currentVal ? 'selected' : ''}>📍 ${escapeHtml(z)}</option>`
      )
    ].join('');

    select.innerHTML = optionsHtml;
    select.value = allZones.has(currentVal) ? currentVal : 'all';
    this.filterZone = select.value;
  }

  // ============ T3: Mi Estado de Cuenta (solo lectura, ledger propio) ============
  private async loadMyAccount(): Promise<void> {
    try {
      this.myLedger = await DB.getLedgerEntries(this.currentSalesUid);
    } catch (err) {
      console.error('[CRM] Error cargando mi ledger:', err);
      this.myLedger = [];
    }
    try {
      this.myProfile = await DB.getScout(this.currentSalesUid);
    } catch (err) {
      console.warn('[CRM] No se pudo leer perfil de scout:', err);
      this.myProfile = null;
    }
  }

  private renderMyAccount(): void {
    let host = document.getElementById('crm-my-account');
    const kanban = document.getElementById('crm-kanban-wrapper');
    if (!host && kanban?.parentElement) {
      host = document.createElement('section');
      host.id = 'crm-my-account';
      host.setAttribute('aria-label', 'Mi Estado de Cuenta B2B');
      host.style.marginTop = '22px';
      kanban.parentElement.insertBefore(host, kanban.nextSibling);
    }
    if (!host) return;

    const pilaOk = !!this.myProfile?.pilaVerified && this.myProfile?.pilaPeriod === this.currentBogotaMonth();
    const rutOk = !!this.myProfile?.rutVerified;

    const myLeads = this.leads.filter(
      (l) =>
        l.status === 'signed' &&
        (this.scope === 'all' || (l.scout_uid || l.sales_uid) === this.currentSalesUid)
    );

    const summary = calculatePipelineSummary(myLeads, this.myLedger);
    const dev = summary.totalAccruedCommissionsCop;
    const pag = summary.totalPaidCommissionsCop;
    const proy = summary.totalProjectedCommissionsCop;
    const fmt = (n: number) => '$' + Number(n || 0).toLocaleString('es-CO');

    const cards =
      myLeads.length === 0
        ? `<p style="font-size:11.5px;color:var(--humo);">Sin bares firmados en este alcance todavía.</p>`
        : myLeads.map((l) => this.renderAccountLeadCard(l)).join('');

    host.innerHTML = `<div style="background:rgba(0,0,0,.35);border:1px solid var(--linea);border-radius:16px;padding:20px;">
      <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:6px;">
        <h3 style="font-family:var(--font-display);font-size:18px;color:var(--papel);margin:0;">💰 Mi Estado de Cuenta (Política v5.1 · Hitos A/B/C)</h3>
        <button type="button" id="crm-account-toggle" class="btn" style="font-size:11px;padding:8px 14px;" aria-expanded="${this.accountOpen}">${this.accountOpen ? 'Ocultar detalle' : 'Ver desglose por hitos'}</button>
      </div>
      ${(!rutOk || !pilaOk) ? `<div style="font-size:11.5px;color:#ff8ca8;background:rgba(142,36,58,.15);border:1px solid var(--vino);border-radius:10px;padding:10px 14px;margin-bottom:12px;">⚠️ Recuerda mantener tu RUT y planilla PILA del mes (${escapeHtml(this.currentBogotaMonth())}) vigentes para autorizar desembolsos.</div>` : ''}
      ${this.accountOpen ? `<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:10px;margin-bottom:14px;">
        <div style="border:1px solid var(--linea);border-radius:10px;padding:12px;"><span style="font-size:10px;color:var(--humo);font-family:var(--font-mono);">PROYECTADO (FIRMAS)</span><b style="display:block;color:var(--papel);font-size:18px;">${fmt(proy)}</b></div>
        <div style="border:1px solid var(--linea);border-radius:10px;padding:12px;"><span style="font-size:10px;color:var(--humo);font-family:var(--font-mono);">DEVENGADO (HITOS)</span><b style="display:block;color:var(--luz);font-size:20px;">${fmt(dev)}</b></div>
        <div style="border:1px solid var(--linea);border-radius:10px;padding:12px;"><span style="font-size:10px;color:var(--humo);font-family:var(--font-mono);">PAGADO</span><b style="display:block;color:#79D3AC;font-size:20px;">${fmt(pag)}</b></div>
        <div style="border:1px solid var(--linea);border-radius:10px;padding:12px;"><span style="font-size:10px;color:var(--humo);font-family:var(--font-mono);">RUT / PILA</span><b style="display:block;font-size:15px;color:var(--papel);">${rutOk ? '✓' : '✕'} / ${pilaOk ? '✓' : '✕'}</b></div>
      </div>
      <b style="font-size:12px;color:var(--papel);display:block;margin-bottom:8px;">Embudo de hitos por bar firmado ($100k Firma + $250k Activación + $100k Retención)</b>
      <div style="display:flex;flex-direction:column;gap:10px;">${cards}</div>`
      : `<p style="font-size:11.5px;color:var(--humo);margin:0;">Proyectado en firmados: <b style="color:var(--papel);">${fmt(proy)}</b> · Devengado: <b style="color:var(--luz);">${fmt(dev)}</b> · Pagado: <b style="color:#79D3AC;">${fmt(pag)}</b></p>`}
    </div>`;

    document.getElementById('crm-account-toggle')?.addEventListener('click', () => {
      this.accountOpen = !this.accountOpen;
      this.renderMyAccount();
    });
  }

  private renderAccountLeadCard(l: Lead): string {
    const ms = l.milestone_status || { A: 'accrued', B: 'not_eligible', C: 'not_eligible' };
    const valid = l.valid_event_count || 0;
    const hits = bounty(undefined, l.cohort_tier || 1);
    const chip = (tag: string, amount: number, s?: string) => {
      const color =
        s === 'paid' || s === 'payable'
          ? '#79D3AC'
          : s === 'accrued' || s === 'review'
            ? 'var(--luz)'
            : 'var(--humo)';
      const amountK = Math.round(amount / 1000) + 'k';
      return `<span style="font-size:9.5px;font-family:var(--font-mono);color:${color};border:1px solid var(--linea);border-radius:999px;padding:2px 8px;">${tag} ($${amountK}): ${escapeHtml(s || 'pendiente')}</span>`;
    };
    let cAlert = '';
    if (l.retention_window_ends_at && ms.C !== 'paid') {
      const daysLeft = Math.ceil((new Date(l.retention_window_ends_at).getTime() - Date.now()) / 86400000);
      const elapsed = 90 - daysLeft;
      if (daysLeft >= 0) {
        if (elapsed >= 75 && valid < 7) {
          cAlert = `<div style="font-size:10.5px;color:#ff8ca8;margin-top:6px;">🔴 Día ${elapsed}/90: ${valid}/8 eventos — riesgo alto de perder el Hito C.</div>`;
        } else if (elapsed >= 60 && valid < 5) {
          cAlert = `<div style="font-size:10.5px;color:var(--luz);margin-top:6px;">🟡 Día ${elapsed}/90: ${valid}/8 eventos — acelera la activación.</div>`;
        }
      }
    }
    const pct = Math.min(100, Math.round((valid / 8) * 100));
    return `<div style="border:1px solid var(--linea);border-radius:10px;padding:12px;background:rgba(243,237,226,.03);">
      <div style="display:flex;justify-content:space-between;gap:8px;align-items:center;flex-wrap:wrap;">
        <b style="color:var(--papel);font-size:12.5px;">${escapeHtml(l.name)}</b>
        <span style="display:inline-flex;gap:6px;flex-wrap:wrap;">${chip('A', hits.A, ms.A)}${chip('B', hits.B, ms.B)}${chip('C', hits.C, ms.C)}</span>
      </div>
      <div style="font-size:10.5px;color:var(--humo);font-family:var(--font-mono);margin-top:4px;">Firma (A) → Activación ≥16 pax (B) → Retención 90d / 8 eventos (C)</div>
      <div style="margin-top:8px;background:rgba(0,0,0,.35);border-radius:999px;height:8px;overflow:hidden;"><div style="width:${pct}%;height:100%;background:var(--luz);"></div></div>
      <div style="font-size:10.5px;color:var(--humo);font-family:var(--font-mono);margin-top:4px;">Hito C: ${valid}/8 eventos${l.retention_window_ends_at ? ` · cierra ${escapeHtml(String(l.retention_window_ends_at).slice(0, 10))}` : ''}</div>
      ${cAlert}
    </div>`;
  }

  async refreshLeads() {
    const filterUid = this.scope === 'mine' ? this.currentSalesUid : undefined;
    this.leads = await DB.getLeads(filterUid);
    if (this.leads.length === 0 && DB.memoryDb?.leads) {
      const memLeads = Object.values(DB.memoryDb.leads) as Lead[];
      this.leads = filterUid ? memLeads.filter((l) => l.sales_uid === filterUid) : memLeads;
    }
    this.isLoading = false;
    this.syncZoneFilterOptions();
    this.render();
  }

  // ============ P1-12: Vista Prioritaria "Hoy & Vencidos" ============
  private renderTodayStrip(activeLeads: Lead[]): void {
    const strip = document.getElementById('crm-today-strip');
    if (!strip) return;

    const today = this.currentBogotaDate();
    const nowMs = Date.now();

    const urgentLeads = activeLeads
      .filter((l) => {
        if (l.status === 'signed') return false;
        if (l.next_action_at && l.next_action_at <= today) return true;
        const lastTouch = l.last_contact_at || l.stage_updated_at || l.createdAt;
        if (lastTouch) {
          const daysSince = Math.floor((nowMs - new Date(lastTouch).getTime()) / 86400000);
          if (daysSince >= 5) return true;
        }
        return false;
      })
      .sort((a, b) => String(a.next_action_at || '9999').localeCompare(String(b.next_action_at || '9999')));

    if (urgentLeads.length === 0) {
      strip.style.display = 'none';
      strip.innerHTML = '';
      return;
    }

    strip.style.display = 'block';
    const itemsHtml = urgentLeads
      .slice(0, 8)
      .map((l) => {
        const isOverdue = !!(l.next_action_at && l.next_action_at < today);
        const badgeText = isOverdue
          ? `⏰ Vencido (${escapeHtml(l.next_action_at)})`
          : l.next_action_at === today
            ? `📅 Para hoy`
            : `❄️ Sin contacto reciente`;
        const waPhone = toWaPhone(l.phone);
        const waHref = waPhone
          ? `https://wa.me/${waPhone}?text=${encodeURIComponent(`Hola ${l.contactName || ''}, te escribo de RONDA sobre la noche piloto en ${l.name}.`)}`
          : '';

        return `<div class="crm-today-item ${isOverdue ? 'overdue' : ''}">
          <div style="display:flex;justify-content:space-between;align-items:center;gap:6px;">
            <button type="button" class="crm-lead-name" data-action="open-detail" data-id="${escapeHtml(l.id)}" style="font-size:13.5px;">${escapeHtml(l.name)}</button>
            <span class="chip ${isOverdue ? 'vino' : 'ambar'}" style="font-size:9px;padding:2px 6px;">${badgeText}</span>
          </div>
          <div style="font-size:11px;color:var(--humo);font-family:var(--font-mono);">
            👤 ${escapeHtml(l.contactName || 'Sin contacto')}${l.zone ? ` · ${escapeHtml(l.zone)}` : ''}
          </div>
          ${l.next_action_note ? `<div style="font-size:10.5px;color:var(--papel);">📌 ${escapeHtml(l.next_action_note)}</div>` : ''}
          <div style="display:flex;gap:6px;margin-top:4px;">
            <button type="button" class="btn ambar" data-action="log-contact" data-id="${escapeHtml(l.id)}" style="font-size:10px;padding:4px 8px;font-weight:700;">✓ Registrar contacto</button>
            ${waHref ? `<a href="${waHref}" target="_blank" rel="noopener noreferrer" class="kanban-wa-link" style="font-size:10px;padding:3px 7px;">💬 WhatsApp</a>` : ''}
          </div>
        </div>`;
      })
      .join('');

    strip.innerHTML = `
      <div class="crm-today-header">
        <h3 class="crm-today-title">🎯 Prioridades de Hoy & Seguimientos Vencidos (${urgentLeads.length})</h3>
        <span style="font-size:11px;color:var(--humo);font-family:var(--font-mono);">Contacta hoy para no enfriar la negociación</span>
      </div>
      <div class="crm-today-list">${itemsHtml}</div>
    `;
  }

  // ============ Renderizado Principal con DocumentFragment (P2-16, P3-27) ============
  render() {
    const activeLeads = this.leads.filter((l) => l.status !== 'archived');
    const summary = calculatePipelineSummary(activeLeads, this.myLedger);
    const fmt = (n: number) => `$${Number(n || 0).toLocaleString('es-CO')} COP`;

    const projectedEl = document.getElementById('crm-comm-projected');
    const commissionsEl = document.getElementById('crm-commissions');
    const paidEl = document.getElementById('crm-comm-paid');
    const totalLeadsEl = document.getElementById('crm-total-leads');
    const closedCountEl = document.getElementById('crm-closed-count');

    if (projectedEl) projectedEl.textContent = fmt(summary.totalProjectedCommissionsCop);
    if (commissionsEl) commissionsEl.textContent = fmt(summary.totalAccruedCommissionsCop);
    if (paidEl) paidEl.textContent = fmt(summary.totalPaidCommissionsCop);
    if (totalLeadsEl) totalLeadsEl.textContent = String(summary.totalLeads);
    if (closedCountEl) closedCountEl.textContent = String(summary.signedCount);

    // Banner de error de suscripción (P2-21)
    const errBanner = document.getElementById('crm-error-banner');
    if (errBanner) {
      if (this.subscriptionError) {
        errBanner.style.display = 'block';
        errBanner.innerHTML = `<div style="background:rgba(155,39,72,0.18);border:1px solid var(--vino);color:#ff8ca8;padding:12px 16px;border-radius:12px;font-size:12px;display:flex;justify-content:space-between;align-items:center;gap:12px;">
          <span>🛑 <b>Error de sincronización:</b> ${escapeHtml(this.subscriptionError)}</span>
          <button type="button" id="btn-crm-retry-sub" class="btn" style="font-size:11px;padding:5px 10px;">Reintentar</button>
        </div>`;
        document.getElementById('btn-crm-retry-sub')?.addEventListener('click', () => {
          this.setupLiveSubscription();
        });
      } else {
        errBanner.style.display = 'none';
        errBanner.innerHTML = '';
      }
    }

    this.renderTodayStrip(activeLeads);

    const colLead = document.getElementById('kanban-lead');
    const colNeg = document.getElementById('kanban-negotiating');
    const colSigned = document.getElementById('kanban-signed');
    if (!colLead || !colNeg || !colSigned) return;

    colLead.innerHTML = '';
    colNeg.innerHTML = '';
    colSigned.innerHTML = '';

    // Estado de carga inicial (Skeleton P2-21)
    if (this.isLoading) {
      for (const col of [colLead, colNeg, colSigned]) {
        col.innerHTML = `<div class="crm-skeleton-card"></div><div class="crm-skeleton-card"></div>`;
      }
      return;
    }

    // Filtrar leads (P1-7: incluye zona, notas, teléfono y contacto sin tildes)
    const qNorm = normalizeSearchText(this.searchQuery);
    const qDigits = this.searchQuery.replace(/\D/g, '');
    const zoneNorm = normalizeSearchText(this.filterZone);

    const filteredLeads = activeLeads.filter((lead) => {
      const matchZone =
        this.filterZone === 'all' || normalizeSearchText(lead.zone) === zoneNorm;
      const matchDay =
        this.filterDay === 'all' || (lead.preferredDay || '') === this.filterDay;

      if (!matchZone || !matchDay) return false;
      if (!qNorm) return true;

      const haystack = normalizeSearchText(
        `${lead.name || ''} ${lead.contactName || ''} ${lead.zone || ''} ${lead.notes || ''} ${lead.next_action_note || ''} ${lead.phone || ''}`
      );
      if (haystack.includes(qNorm)) return true;
      if (qDigits && (lead.phone || '').replace(/\D/g, '').includes(qDigits)) return true;
      return false;
    });

    // Ordenar leads (P3-28)
    this.sortLeads(filteredLeads);

    // Contadores de barra y columnas
    const filterCountEl = document.getElementById('crm-filter-count');
    if (filterCountEl) {
      const filtering =
        this.filterZone !== 'all' || this.filterDay !== 'all' || !!this.searchQuery;
      filterCountEl.textContent = filtering
        ? `${filteredLeads.length} de ${activeLeads.length} leads`
        : `${activeLeads.length} leads en pipeline`;
    }

    // Empty state cuando el pipeline está vacío (P2-21)
    if (activeLeads.length === 0) {
      colLead.innerHTML = `
        <div class="crm-empty-banner">
          <div style="font-size:28px;margin-bottom:8px;">🍸</div>
          <b style="font-family:var(--font-display);font-size:16px;color:var(--papel);display:block;margin-bottom:4px;">Tu pipeline está vacío</b>
          <p style="font-size:11.5px;color:var(--humo);margin:0 0 12px;">Registra tu primer gastrobar prospecto para iniciar el seguimiento de los 3 hitos ($450k COP).</p>
          <button type="button" class="btn ambar" data-action="empty-add-lead" style="font-size:11.5px;padding:8px 14px;font-weight:700;">➕ Registrar Primer Lead</button>
        </div>
      `;
      return;
    }

    if (filteredLeads.length === 0 && activeLeads.length > 0) {
      const empty = document.createElement('p');
      empty.style.cssText =
        'font-size:12px;color:var(--humo);text-align:center;width:100%;padding:20px 0;margin:0;';
      empty.textContent = '🔍 Sin resultados para los filtros seleccionados.';
      colLead.appendChild(empty);
    }

    const fragLead = document.createDocumentFragment();
    const fragNeg = document.createDocumentFragment();
    const fragSigned = document.createDocumentFragment();

    let countLead = 0;
    let countNeg = 0;
    let countSigned = 0;

    const today = this.currentBogotaDate();

    for (const lead of filteredLeads) {
      const card = this.buildLeadCardElement(lead, today);
      if (lead.status === 'lead') {
        fragLead.appendChild(card);
        countLead++;
      } else if (lead.status === 'negotiating') {
        fragNeg.appendChild(card);
        countNeg++;
      } else if (lead.status === 'signed') {
        fragSigned.appendChild(card);
        countSigned++;
      }
    }

    colLead.appendChild(fragLead);
    colNeg.appendChild(fragNeg);
    colSigned.appendChild(fragSigned);

    const cLeadEl = document.getElementById('crm-count-lead');
    const cNegEl = document.getElementById('crm-count-negotiating');
    const cSignedEl = document.getElementById('crm-count-signed');
    if (cLeadEl) cLeadEl.textContent = `${countLead} Prospecto${countLead === 1 ? '' : 's'}`;
    if (cNegEl) cNegEl.textContent = `${countNeg} En Curso`;
    if (cSignedEl) cSignedEl.textContent = `${countSigned} Ganado${countSigned === 1 ? '' : 's'}`;
  }

  private sortLeads(list: Lead[]): void {
    list.sort((a, b) => {
      if (this.sortMode === 'name') {
        return String(a.name || '').localeCompare(String(b.name || ''), 'es-CO');
      }
      if (this.sortMode === 'accrued') {
        const accA = accrued(a, this.myLedger).devengado;
        const accB = accrued(b, this.myLedger).devengado;
        return accB - accA;
      }
      if (this.sortMode === 'recent') {
        return String(b.createdAt || '').localeCompare(String(a.createdAt || ''));
      }
      // Por defecto: próxima acción más urgente primero
      const nextA = a.next_action_at || '9999-12-31';
      const nextB = b.next_action_at || '9999-12-31';
      if (nextA !== nextB) return nextA.localeCompare(nextB);
      return String(b.createdAt || '').localeCompare(String(a.createdAt || ''));
    });
  }

  private buildLeadCardElement(lead: Lead, today: string): HTMLElement {
    const card = document.createElement('div');
    card.className = 'kanban-lead-card';
    card.dataset.leadId = lead.id;
    card.draggable = true;

    const hits = bounty(undefined, lead.cohort_tier || 1);
    const acc = accrued(lead, this.myLedger);
    const commBadgeText =
      lead.status === 'signed'
        ? `Dev: $${(acc.devengado / 1000).toFixed(0)}k / $${(hits.total / 1000).toFixed(0)}k`
        : `Bounty $${(hits.total / 1000).toFixed(0)}k`;

    // P1-9: Normalizador único de WhatsApp sin doble prefijo 57
    const waPhone = toWaPhone(lead.phone);
    const waLink = waPhone
      ? `https://wa.me/${waPhone}?text=Hola%20${encodeURIComponent(lead.contactName || '')},%20te%20escribo%20de%20RONDA%20para%20la%20noche%20piloto%20en%20${encodeURIComponent(lead.name)}.`
      : '';

    // Antigüedad en la etapa actual (P1-12)
    const stageRef = lead.stage_updated_at || lead.createdAt;
    const stageDays = stageRef
      ? Math.max(0, Math.floor((Date.now() - new Date(stageRef).getTime()) / 86400000))
      : 0;
    const ageLabel = stageDays === 0 ? 'Hoy' : `Hace ${stageDays}d`;

    // Próxima acción (P1-12)
    let nextActionHtml = '';
    if (lead.status !== 'signed') {
      const isOverdue = !!(lead.next_action_at && lead.next_action_at < today);
      const isToday = lead.next_action_at === today;
      const cls = isOverdue ? 'overdue' : isToday ? 'today' : '';
      const label = lead.next_action_at
        ? isOverdue
          ? `⏰ Vencido: ${escapeHtml(lead.next_action_at)}`
          : isToday
            ? `📅 Llamar HOY`
            : `📅 Próx: ${escapeHtml(lead.next_action_at)}`
        : `📅 Sin fecha asignada`;
      nextActionHtml = `
        <div class="kanban-next-action ${cls}">
          <span>${label}${lead.next_action_note ? ` · ${escapeHtml(lead.next_action_note)}` : ''}</span>
          <button type="button" class="btn" data-action="log-contact" data-id="${escapeHtml(lead.id)}" style="font-size:9.5px;padding:2px 6px;" title="Registrar contacto hoy y programar seguimiento">📞 Contacté</button>
        </div>
      `;
    }

    // Seguimiento de hitos A/B/C en la tarjeta cuando está firmado (Sección 8)
    let milestonesHtml = '';
    if (lead.status === 'signed') {
      const ms = lead.milestone_status || { A: 'accrued', B: 'not_eligible', C: 'not_eligible' };
      const dot = (tag: string, state: string) => {
        const bg =
          state === 'paid'
            ? 'rgba(46,107,84,0.3)'
            : state === 'accrued' || state === 'payable' || state === 'review'
              ? 'rgba(240,168,48,0.22)'
              : 'rgba(243,237,226,0.06)';
        const col =
          state === 'paid'
            ? '#79D3AC'
            : state === 'accrued' || state === 'payable' || state === 'review'
              ? 'var(--luz)'
              : 'var(--humo)';
        return `<span style="font-size:9px;font-family:var(--font-mono);padding:2px 6px;border-radius:6px;background:${bg};color:${col};border:1px solid var(--linea);">${tag}: ${escapeHtml(state)}</span>`;
      };
      milestonesHtml = `<div style="display:flex;gap:4px;flex-wrap:wrap;margin-bottom:8px;">${dot('Hito A $100k', ms.A)}${dot('Hito B $250k', ms.B)}${dot('Hito C $100k', ms.C)}</div>`;
    }

    // Estado de alta en Red (P1-11)
    let venueActionHtml = '';
    if (lead.status === 'signed') {
      if (lead.venueId || lead.venue_id) {
        venueActionHtml = `<span class="chip verde" style="font-size: 9px; padding: 3px 7px;">✓ En Red RONDA</span>`;
      } else if (lead.venue_request_id) {
        venueActionHtml = `<span class="chip ambar" style="font-size: 9px; padding: 3px 7px;">⏳ Alta Solicitada</span>`;
      } else {
        const label =
          this.currentUserRole === 'sales' ? '🗺️ Solicitar Alta en Red' : '🗺️ Dar de Alta en Red';
        venueActionHtml = `<button type="button" class="btn verde" data-action="convert-venue" data-id="${escapeHtml(lead.id)}" style="font-size: 10px; padding: 4px 8px; font-weight: 700;">${label}</button>`;
      }
    }

    card.innerHTML = `
      <div class="kanban-card-top">
        <div>
          <button type="button" class="crm-lead-name" data-action="open-detail" data-id="${escapeHtml(lead.id)}" title="Abrir ficha técnica e historial del local">${escapeHtml(lead.name)}</button>
          ${lead.zone ? `<span class="chip" style="font-size: 9px; padding: 2px 6px; margin-left: 6px; background: rgba(243,237,226,0.1);">${escapeHtml(lead.zone)}</span>` : ''}
        </div>
        <span class="chip ambar" style="font-size: 9px; padding: 2px 6px;" title="Política v5.1: $100k (A) + $250k (B) + $100k (C)">${escapeHtml(commBadgeText)}</span>
      </div>

      <div class="kanban-meta-row">
        <span>👤 ${escapeHtml(lead.contactName || 'Sin contacto')}</span>
        <span>· ⏱ ${escapeHtml(ageLabel)}</span>
        ${lead.preferredDay ? `<span>· 📅 ${escapeHtml(lead.preferredDay)}</span>` : ''}
        ${lead.tablesCount ? `<span>· 🪑 ${Number(lead.tablesCount)} mesas</span>` : ''}
      </div>

      ${lead.phone ? `
        <div style="margin-bottom: 8px;">
          ${waLink
            ? `<a href="${waLink}" target="_blank" rel="noopener noreferrer" class="kanban-wa-link">💬 WhatsApp (${escapeHtml(lead.phone)})</a>`
            : `<span style="font-size:10.5px;color:var(--humo);font-family:var(--font-mono);">📞 Tel: ${escapeHtml(lead.phone)}</span>`}
        </div>
      ` : ''}

      ${nextActionHtml}
      ${milestonesHtml}

      ${lead.notes ? `
        <p class="kanban-notes">📝 ${escapeHtml(lead.notes)}</p>
      ` : ''}

      <div class="kanban-actions-row">
        <button type="button" class="btn" data-action="agreement" data-id="${escapeHtml(lead.id)}" style="font-size: 10px; padding: 4px 8px; background: rgba(0,0,0,0.3); border-color: var(--linea);" title="Generar acuerdo de barra cerrada">
          📄 Acuerdo
        </button>
        ${venueActionHtml}
      </div>

      <div class="kanban-footer-row">
        <button type="button" class="btn" data-action="delete-lead" data-id="${escapeHtml(lead.id)}" style="font-size: 10px; padding: 3px 6px; background: none; border: none; color: var(--humo); opacity: 0.7;" title="Archivar y quitar del pipeline" aria-label="Quitar ${escapeHtml(lead.name)} del pipeline">
          🗑️
        </button>
        <div style="display: flex; gap: 6px; align-items: center;">
          ${lead.status !== 'lead' ? `
            <button type="button" class="btn" data-action="move-lead" data-id="${escapeHtml(lead.id)}" data-to="${lead.status === 'signed' ? 'negotiating' : 'lead'}" style="font-size: 10px; padding: 4px 8px; background: rgba(0,0,0,0.3); border-color: var(--linea);">
              ← Regresar
            </button>
          ` : ''}
          ${lead.status !== 'signed' ? `
            <button type="button" class="btn ambar" data-action="move-lead" data-id="${escapeHtml(lead.id)}" data-to="${lead.status === 'lead' ? 'negotiating' : 'signed'}" style="font-size: 10px; padding: 4px 8px; font-weight: 700;">
              Avanzar →
            </button>
          ` : `
            <span style="font-size: 10px; color: #79D3AC; font-family: var(--font-mono); font-weight: 700;">✓ Firmado</span>
          `}
        </div>
      </div>
    `;

    return card;
  }

  // ============ Acciones Operativas del Pipeline ============

  async logLeadContact(leadId: string) {
    const lead = this.leads.find((l) => l.id === leadId);
    if (!lead) return;

    const nowIso = new Date().toISOString();
    const nextDate = this.addDaysIso(3);
    const prevContact = lead.last_contact_at;
    const prevNext = lead.next_action_at;

    lead.last_contact_at = nowIso;
    lead.next_action_at = nextDate;
    this.render();

    try {
      await DB.saveLead(lead);
      await DB.appendLeadEvent(leadId, {
        type: 'contact_logged',
        byUid: this.currentSalesUid,
        byName: this.currentUserName,
        note: `Contacto registrado. Próximo seguimiento programado para ${nextDate}.`
      });
      showCrmNotification(`Contacto registrado en «${lead.name}». Próximo toque: ${nextDate}.`, 'success');
    } catch (err) {
      lead.last_contact_at = prevContact;
      lead.next_action_at = prevNext;
      this.render();
      showCrmNotification('No se pudo registrar el contacto en Firestore.', 'error');
    }
  }

  async moveLead(leadId: string, newStatus: 'lead' | 'negotiating' | 'signed') {
    const lead = this.leads.find((l) => l.id === leadId);
    if (!lead || lead.status === newStatus) return;

    const prevStatus = lead.status;
    const prevMilestone = lead.milestone_status ? { ...lead.milestone_status } : undefined;
    const nowIso = new Date().toISOString();

    lead.status = newStatus;
    lead.stage_updated_at = nowIso;

    if (newStatus === 'signed') {
      lead.signed_at = lead.signed_at || nowIso;
      if (!lead.milestone_status) {
        lead.milestone_status = {
          A: 'accrued',
          B: 'not_eligible',
          C: 'not_eligible'
        };
      } else if (lead.milestone_status.A === 'not_eligible') {
        lead.milestone_status.A = 'accrued';
      }
    }

    this.render();
    this.renderMyAccount();

    try {
      await DB.updateLeadStatus(leadId, newStatus, {
        signed_at: lead.signed_at,
        milestone_status: lead.milestone_status
      });
      await DB.appendLeadEvent(leadId, {
        type: 'status_change',
        fromStatus: prevStatus,
        toStatus: newStatus,
        byUid: this.currentSalesUid,
        byName: this.currentUserName,
        note: `Cambio de etapa: ${prevStatus} → ${newStatus}`
      });

      if (newStatus === 'signed') {
        const hits = bounty(undefined, lead.cohort_tier || 1);
        await RondaDialog.alert({
          title: '¡Local Firmado! 🎉',
          message:
            `¡Felicitaciones! Has afiliado a <b>${escapeHtml(lead.name)}</b> a la red RONDA.<br><br>` +
            `• <b>Hito A devengado (Firma):</b> +$${hits.A.toLocaleString('es-CO')} COP<br>` +
            `• <b>Hito B (1er evento ≥16 pax):</b> +$${hits.B.toLocaleString('es-CO')} COP<br>` +
            `• <b>Hito C (Retención 90d / 8 eventos):</b> +$${hits.C.toLocaleString('es-CO')} COP<br>` +
            `<b>Bounty Total:</b> $${hits.total.toLocaleString('es-CO')} COP`,
          icon: '🍾',
          html: true
        });
      }
    } catch (err) {
      lead.status = prevStatus;
      lead.milestone_status = prevMilestone;
      this.render();
      this.renderMyAccount();
      showCrmNotification('No se pudo actualizar la etapa del lead.', 'error');
    }
  }

  // P0-4 + P2-20: Soft-delete con confirmación RondaDialog, motivo, rollback en fallo y auditoría
  async deleteLead(leadId: string) {
    const lead = this.leads.find((l) => l.id === leadId);
    if (!lead) return;

    const ok = await RondaDialog.confirm({
      title: 'Quitar del pipeline',
      message: `«${escapeHtml(lead.name)}» se archivará y saldrá del tablero activo. El historial de auditoría se conserva.`,
      confirmText: 'Archivar lead',
      cancelText: 'Cancelar',
      icon: '🗂️',
      type: 'danger'
    });
    if (!ok) return;

    const prevStatus = lead.status;
    const nowIso = new Date().toISOString();
    lead.status = 'archived';
    lead.archived_at = nowIso;
    this.render();
    this.renderMyAccount();

    try {
      await DB.updateLeadStatus(leadId, 'archived', {
        archived_at: nowIso,
        lost_reason: lead.lost_reason || 'Archivado desde el tablero CRM'
      });
      await DB.appendLeadEvent(leadId, {
        type: 'status_change',
        fromStatus: prevStatus,
        toStatus: 'archived',
        byUid: this.currentSalesUid,
        byName: this.currentUserName,
        note: 'Archivado del pipeline comercial'
      });
      showCrmNotification(`«${lead.name}» fue archivado del pipeline.`, 'warning');
    } catch (e) {
      console.error('[CRM] Error archivando lead:', e);
      lead.status = prevStatus;
      this.render();
      this.renderMyAccount();
      showCrmNotification('No se pudo quitar el lead por permisos o red.', 'error');
    }
  }

  // ============ P0-2 + P1-12 + P1-13 + P2-19: Drawer Accesible con XSS Escapado e Historial ============
  openLeadDetailModal(leadId: string, triggerEl?: HTMLElement | null) {
    const lead = this.leads.find((l) => l.id === leadId);
    const overlay = document.getElementById('crm-lead-drawer-overlay');
    const drawer = document.getElementById('crm-lead-drawer');
    if (!lead || !overlay || !drawer) return;

    if (this.activeSheet) {
      this.activeSheet.close();
      this.activeSheet = null;
    }

    const statusChip =
      lead.status === 'signed'
        ? '<span class="chip verde" style="font-size:9px;">Firmado</span>'
        : lead.status === 'negotiating'
          ? '<span class="chip ambar" style="font-size:9px;">Negociando</span>'
          : '<span class="chip gris" style="font-size:9px;">Prospecto</span>';

    const hits = bounty(undefined, lead.cohort_tier || 1);
    const acc = accrued(lead, this.myLedger);
    const zoneOptions = Array.from(new Set([...BOGOTA_ZONES, ...(lead.zone ? [lead.zone] : [])]))
      .map(
        (z) =>
          `<option value="${escapeHtml(z)}" ${lead.zone === z ? 'selected' : ''}>${escapeHtml(z)}</option>`
      )
      .join('');

    // P0-2: Todo valor interpolado en el drawer pasa obligatoriamente por escapeHtml(...)
    drawer.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:14px; gap:10px;">
        <div>
          <h3 id="crm-drawer-title" style="font-family:var(--font-display); font-size:21px; color:var(--papel); margin:0;">📋 ${escapeHtml(lead.name)}</h3>
          <p style="font-size:11.5px; color:var(--humo); margin:4px 0 0;">👤 ${escapeHtml(lead.contactName || 'Sin contacto')}${lead.zone ? ` · 📍 ${escapeHtml(lead.zone)}` : ''}</p>
        </div>
        <button type="button" id="btn-close-lead-drawer" aria-label="Cerrar ficha técnica" style="background:none; border:none; color:var(--humo); font-size:20px; cursor:pointer; padding:4px;" title="Cerrar">✕</button>
      </div>

      <div style="display:flex; gap:8px; align-items:center; flex-wrap:wrap; margin-bottom:14px;">
        ${statusChip}
        <span class="chip ambar" style="font-size:9.5px;">Devengado: $${acc.devengado.toLocaleString('es-CO')} / $${hits.total.toLocaleString('es-CO')} COP</span>
        ${lead.last_contact_at ? `<span style="font-size:10px;color:var(--humo);font-family:var(--font-mono);">Últ. contacto: ${escapeHtml(lead.last_contact_at.slice(0, 10))}</span>` : ''}
      </div>

      <form id="form-lead-detail" style="display:flex; flex-direction:column; gap:12px;">
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px;">
          <div>
            <label for="ld-contact" style="display:block; font-size:11px; font-family:var(--font-mono); color:var(--humo); margin-bottom:4px;">Contacto (Gerente/Admin)</label>
            <input type="text" id="ld-contact" value="${escapeHtml(lead.contactName || '')}" class="ronda-input" style="margin-bottom:0;">
          </div>
          <div>
            <label for="ld-phone" style="display:block; font-size:11px; font-family:var(--font-mono); color:var(--humo); margin-bottom:4px;">WhatsApp / Teléfono</label>
            <input type="tel" id="ld-phone" value="${escapeHtml(lead.phone || '')}" placeholder="Ej. 3001234567" class="ronda-input" style="margin-bottom:0;">
          </div>
        </div>

        <div style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:10px;">
          <div>
            <label for="ld-zone" style="display:block; font-size:11px; font-family:var(--font-mono); color:var(--humo); margin-bottom:4px;">Zona</label>
            <select id="ld-zone" class="ronda-input" style="margin-bottom:0;">
              ${zoneOptions}
            </select>
          </div>
          <div>
            <label for="ld-tables" style="display:block; font-size:11px; font-family:var(--font-mono); color:var(--humo); margin-bottom:4px;">Mesas 2 pax</label>
            <input type="number" id="ld-tables" min="0" step="1" value="${lead.tablesCount !== undefined ? Number(lead.tablesCount) : ''}" placeholder="Ej. 14" class="ronda-input" style="margin-bottom:0;">
          </div>
          <div>
            <label for="ld-day" style="display:block; font-size:11px; font-family:var(--font-mono); color:var(--humo); margin-bottom:4px;">Día valle</label>
            <select id="ld-day" class="ronda-input" style="margin-bottom:0;">
              <option value="" ${!lead.preferredDay ? 'selected' : ''}>Sin definir</option>
              <option value="martes" ${lead.preferredDay === 'martes' ? 'selected' : ''}>martes</option>
              <option value="miércoles" ${lead.preferredDay === 'miércoles' ? 'selected' : ''}>miércoles</option>
              <option value="jueves" ${lead.preferredDay === 'jueves' ? 'selected' : ''}>jueves</option>
            </select>
          </div>
        </div>

        <div style="display:grid; grid-template-columns:1fr 1.4fr; gap:10px;">
          <div>
            <label for="ld-next-action-at" style="display:block; font-size:11px; font-family:var(--font-mono); color:var(--humo); margin-bottom:4px;">Próxima acción (Fecha)</label>
            <input type="date" id="ld-next-action-at" value="${escapeHtml(lead.next_action_at || '')}" class="ronda-input" style="margin-bottom:0;">
          </div>
          <div>
            <label for="ld-next-action-note" style="display:block; font-size:11px; font-family:var(--font-mono); color:var(--humo); margin-bottom:4px;">Objetivo del próximo toque</label>
            <input type="text" id="ld-next-action-note" value="${escapeHtml(lead.next_action_note || '')}" placeholder="Ej. Confirmar visita de acústica 20 min" class="ronda-input" style="margin-bottom:0;">
          </div>
        </div>

        <div>
          <label for="ld-notes" style="display:block; font-size:11px; font-family:var(--font-mono); color:var(--humo); margin-bottom:4px;">Notas de prospección / Ficha técnica</label>
          <textarea id="ld-notes" rows="3" placeholder="Ej. Capacidad 14 mesas. Administrador abierto a miércoles. Fachada con terraza." class="ronda-input" style="margin-bottom:0; resize:vertical; font-size:12px;">${escapeHtml(lead.notes || '')}</textarea>
        </div>

        <div style="display:flex; gap:10px;">
          <button type="button" id="btn-cancel-lead-drawer" class="btn" style="flex:1; padding:10px; font-size:12px; background:rgba(243,237,226,0.05); border-color:var(--linea);">Cancelar</button>
          <button type="submit" id="btn-save-lead-drawer" class="btn ambar" style="flex:1; padding:10px; font-size:12px; font-weight:700;">Guardar Cambios</button>
        </div>
      </form>

      <!-- P1-13: Historial de Etapas y Auditoría -->
      <div class="crm-timeline">
        <b style="font-size:11.5px; font-family:var(--font-mono); color:var(--papel); text-transform:uppercase; letter-spacing:0.05em;">📜 Historial de Auditoría</b>
        <ul id="ld-history-timeline" class="crm-timeline-list" aria-live="polite">
          <li class="crm-timeline-item">Cargando historial…</li>
        </ul>
      </div>
    `;

    this.activeSheet = openSheet({
      overlay,
      dialog: drawer,
      labelledBy: 'crm-drawer-title',
      triggerEl,
      onClose: () => {
        this.activeSheet = null;
      }
    });

    const close = () => this.closeLeadDetailModal();
    document.getElementById('btn-close-lead-drawer')?.addEventListener('click', close);
    document.getElementById('btn-cancel-lead-drawer')?.addEventListener('click', close);

    // Cargar historial asíncrono (P1-13)
    void this.populateDrawerHistory(lead.id, lead);

    document.getElementById('form-lead-detail')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const saveBtn = document.getElementById('btn-save-lead-drawer') as HTMLButtonElement | null;
      if (saveBtn) {
        saveBtn.disabled = true;
        saveBtn.textContent = 'Guardando…';
      }
      try {
        const contactRaw = (document.getElementById('ld-contact') as HTMLInputElement)?.value.trim() ?? '';
        const phoneRaw = (document.getElementById('ld-phone') as HTMLInputElement)?.value.trim() ?? '';
        const zoneRaw = (document.getElementById('ld-zone') as HTMLSelectElement)?.value ?? '';
        const tablesRaw = (document.getElementById('ld-tables') as HTMLInputElement)?.value ?? '';
        const day = (document.getElementById('ld-day') as HTMLSelectElement)?.value ?? '';
        const nextAtRaw = (document.getElementById('ld-next-action-at') as HTMLInputElement)?.value.trim() ?? '';
        const nextNoteRaw = (document.getElementById('ld-next-action-note') as HTMLInputElement)?.value.trim() ?? '';
        const notes = (document.getElementById('ld-notes') as HTMLTextAreaElement)?.value.trim() ?? '';

        lead.contactName = contactRaw || 'Gerente';
        if (phoneRaw) lead.phone = phoneRaw;
        else delete lead.phone;

        if (zoneRaw) lead.zone = zoneRaw;

        if (tablesRaw !== '') {
          lead.tablesCount = Math.max(0, Number(tablesRaw) || 0);
        } else {
          delete lead.tablesCount;
        }
        if (day === 'martes' || day === 'miércoles' || day === 'jueves') {
          lead.preferredDay = day;
        } else {
          delete lead.preferredDay;
        }
        if (nextAtRaw) {
          lead.next_action_at = nextAtRaw;
        } else {
          delete lead.next_action_at;
        }
        if (nextNoteRaw) {
          lead.next_action_note = nextNoteRaw;
        } else {
          delete lead.next_action_note;
        }
        if (notes) {
          lead.notes = notes;
        } else {
          delete lead.notes;
        }

        await DB.saveLead(lead);
        await DB.appendLeadEvent(lead.id, {
          type: 'detail_updated',
          byUid: this.currentSalesUid,
          byName: this.currentUserName,
          note: `Ficha técnica actualizada${nextAtRaw ? ` (Próx. acción: ${nextAtRaw})` : ''}`
        });

        this.syncZoneFilterOptions();
        this.render();
        this.closeLeadDetailModal();
        showCrmNotification(`Ficha técnica de «${lead.name}» guardada.`, 'success');
      } catch (err: any) {
        console.error('[CRM] Error guardando ficha del lead:', err);
        if (saveBtn) {
          saveBtn.disabled = false;
          saveBtn.textContent = 'Guardar Cambios';
        }
        await RondaDialog.alert({
          title: 'Error',
          message: 'No se pudieron guardar los cambios: ' + escapeHtml(err?.message || String(err)),
          icon: '⚠️',
          type: 'danger'
        });
      }
    });
  }

  private async populateDrawerHistory(leadId: string, lead: Lead): Promise<void> {
    const listEl = document.getElementById('ld-history-timeline');
    if (!listEl) return;

    const history = await DB.getLeadHistory(leadId);
    if (!document.body.contains(listEl)) return;

    if (history.length === 0) {
      const createdDate = lead.createdAt ? lead.createdAt.slice(0, 16).replace('T', ' ') : 'Registro inicial';
      listEl.innerHTML = `<li class="crm-timeline-item"><b>${escapeHtml(createdDate)}</b> · Lead creado en etapa <b>${escapeHtml(lead.status)}</b> (${escapeHtml(lead.sales_uid || 'scout')}).</li>`;
      return;
    }

    listEl.innerHTML = history
      .map((ev: LeadHistoryEvent) => {
        const ts = ev.at ? ev.at.slice(0, 16).replace('T', ' ') : '';
        const author = ev.byName || ev.byUid || 'Sistema';
        return `<li class="crm-timeline-item">
          <div><b>${escapeHtml(ts)}</b> · <span style="color:var(--luz);">${escapeHtml(author)}</span></div>
          <div>${escapeHtml(ev.note || `${ev.type}: ${ev.fromStatus || ''} → ${ev.toStatus || ''}`)}</div>
        </li>`;
      })
      .join('');
  }

  closeLeadDetailModal() {
    if (this.activeSheet) {
      this.activeSheet.close();
      this.activeSheet = null;
    } else {
      const overlay = document.getElementById('crm-lead-drawer-overlay');
      overlay?.classList.remove('active');
      overlay?.setAttribute('aria-hidden', 'true');
    }
  }

  // ============ P1-11 + P1-14 + P2-20: Alta en Red con formulario accesible y writeBatch / venue_requests ============
  openConvertVenueModal(leadId: string, triggerEl?: HTMLElement | null) {
    const lead = this.leads.find((l) => l.id === leadId);
    const overlay = document.getElementById('crm-lead-drawer-overlay');
    const drawer = document.getElementById('crm-lead-drawer');
    if (!lead || lead.status !== 'signed' || !overlay || !drawer) return;

    if (this.activeSheet) {
      this.activeSheet.close();
      this.activeSheet = null;
    }

    const isDirectAuthorized =
      this.currentUserRole === 'superadmin' || this.currentUserRole === 'network';

    drawer.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:14px; gap:10px;">
        <div>
          <h3 id="crm-drawer-title" style="font-family:var(--font-display); font-size:21px; color:var(--papel); margin:0;">
            🗺️ ${isDirectAuthorized ? 'Dar de Alta en Red RONDA' : 'Solicitar Alta en Red RONDA'}
          </h3>
          <p style="font-size:11.5px; color:var(--humo); margin:4px 0 0;">
            Local firmado: <b>${escapeHtml(lead.name)}</b> (${escapeHtml(lead.zone || 'Bogotá')})
          </p>
        </div>
        <button type="button" id="btn-close-venue-drawer" aria-label="Cerrar formulario de alta" style="background:none; border:none; color:var(--humo); font-size:20px; cursor:pointer; padding:4px;">✕</button>
      </div>

      <p style="font-size:12px; color:var(--humo); line-height:1.45; margin:0 0 14px;">
        ${isDirectAuthorized
          ? 'Registra la dirección y coordenadas GPS para activar la exclusividad territorial de 500m en la Red RONDA.'
          : 'Como Scout comercial, tu solicitud quedará registrada en <b>venue_requests</b> para validación y activación en el mapa por Dirección / Red.'}
      </p>

      <form id="form-convert-venue" style="display:flex; flex-direction:column; gap:12px;">
        <div>
          <label for="cv-address" style="display:block; font-size:11px; font-family:var(--font-mono); color:var(--humo); margin-bottom:4px;">Dirección física en Bogotá *</label>
          <input type="text" id="cv-address" required placeholder="Ej. Calle 69 # 5-30, Chapinero Alto" class="ronda-input" style="margin-bottom:0;">
        </div>

        <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px;">
          <div>
            <label for="cv-lat" style="display:block; font-size:11px; font-family:var(--font-mono); color:var(--humo); margin-bottom:4px;">Latitud (Decimal) *</label>
            <input type="text" id="cv-lat" required value="4.6540" class="ronda-input" style="margin-bottom:0;">
          </div>
          <div>
            <label for="cv-lng" style="display:block; font-size:11px; font-family:var(--font-mono); color:var(--humo); margin-bottom:4px;">Longitud (Decimal) *</label>
            <input type="text" id="cv-lng" required value="-74.0560" class="ronda-input" style="margin-bottom:0;">
          </div>
        </div>

        <button type="button" id="btn-cv-geolocate" class="btn" style="font-size:11.5px; padding:8px 12px; background:rgba(243,237,226,0.06); border-color:var(--linea);">
          📍 Usar mi ubicación GPS actual
        </button>

        <div style="display:flex; gap:10px; margin-top:6px;">
          <button type="button" id="btn-cancel-venue-drawer" class="btn" style="flex:1; padding:10px; font-size:12px; background:rgba(243,237,226,0.05); border-color:var(--linea);">Cancelar</button>
          <button type="submit" id="btn-submit-venue-drawer" class="btn verde" style="flex:1; padding:10px; font-size:12px; font-weight:700;">
            ${isDirectAuthorized ? '✓ Activar en Red' : '📤 Enviar Solicitud'}
          </button>
        </div>
      </form>
    `;

    this.activeSheet = openSheet({
      overlay,
      dialog: drawer,
      labelledBy: 'crm-drawer-title',
      triggerEl,
      onClose: () => {
        this.activeSheet = null;
      }
    });

    const close = () => this.closeLeadDetailModal();
    document.getElementById('btn-close-venue-drawer')?.addEventListener('click', close);
    document.getElementById('btn-cancel-venue-drawer')?.addEventListener('click', close);

    document.getElementById('btn-cv-geolocate')?.addEventListener('click', () => {
      if (!navigator.geolocation) {
        showCrmNotification('Tu navegador no soporta geolocalización.', 'warning');
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const latIn = document.getElementById('cv-lat') as HTMLInputElement | null;
          const lngIn = document.getElementById('cv-lng') as HTMLInputElement | null;
          if (latIn) latIn.value = pos.coords.latitude.toFixed(5);
          if (lngIn) lngIn.value = pos.coords.longitude.toFixed(5);
          showCrmNotification('Coordenadas GPS capturadas.', 'success');
        },
        () => {
          showCrmNotification('No se pudo obtener la ubicación GPS.', 'warning');
        },
        { enableHighAccuracy: true, timeout: 6000 }
      );
    });

    document.getElementById('form-convert-venue')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const address = (document.getElementById('cv-address') as HTMLInputElement)?.value.trim() || '';
      const latRaw = (document.getElementById('cv-lat') as HTMLInputElement)?.value.trim() || '';
      const lngRaw = (document.getElementById('cv-lng') as HTMLInputElement)?.value.trim() || '';

      const lat = Number(latRaw.replace(',', '.'));
      const lng = Number(lngRaw.replace(',', '.'));

      if (!address || !Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
        await RondaDialog.alert({
          title: 'Datos Inválidos',
          message: 'Ingresa una dirección válida y coordenadas decimales (ej: 4.6540 / -74.0560).',
          icon: '⚠️',
          type: 'danger'
        });
        return;
      }

      const submitBtn = document.getElementById('btn-submit-venue-drawer') as HTMLButtonElement | null;
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = 'Procesando…';
      }

      const uidSuffix =
        typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
          ? crypto.randomUUID().slice(0, 8)
          : String(Date.now());

      try {
        if (isDirectAuthorized) {
          // P1-14: writeBatch atómico para Venue + Lead.venueId
          const venue: Venue = {
            id: `v_${uidSuffix}`,
            name: lead.name,
            address,
            zone: lead.zone || 'Bogotá',
            lat,
            lng,
            status: 'active',
            origin_scout_uid: lead.scout_uid || lead.sales_uid
          };
          await DB.convertLeadToVenueBatch(venue, lead);
          if (DB.memoryDb?.venues) {
            DB.memoryDb.venues[venue.id] = venue;
          }
          lead.venueId = venue.id;
          lead.venue_id = venue.id;
          await DB.appendLeadEvent(lead.id, {
            type: 'venue_created',
            byUid: this.currentSalesUid,
            byName: this.currentUserName,
            note: `Local dado de alta en Red RONDA (${venue.id}) en ${address}`
          });
          this.closeLeadDetailModal();
          this.render();
          await RondaDialog.alert({
            title: 'Bar en la Red 🗺️',
            message: `<b>${escapeHtml(venue.name)}</b> fue dado de alta atómicamente como venue oficial en la Red RONDA (exclusividad de 500m activa).`,
            icon: '🗺️',
            html: true
          });
        } else {
          // P1-11: Rol sales crea solicitud en venue_requests sin error de permisos
          const req: VenueRequest = {
            id: `vreq_${uidSuffix}`,
            leadId: lead.id,
            name: lead.name,
            address,
            zone: lead.zone || 'Bogotá',
            lat,
            lng,
            requestedByUid: this.currentSalesUid,
            status: 'pending',
            createdAt: new Date().toISOString()
          };
          await DB.createVenueRequest(req, lead);
          lead.venue_request_id = req.id;
          await DB.appendLeadEvent(lead.id, {
            type: 'venue_requested',
            byUid: this.currentSalesUid,
            byName: this.currentUserName,
            note: `Solicitud de alta en Red enviada (${req.id}) para ${address}`
          });
          this.closeLeadDetailModal();
          this.render();
          await RondaDialog.alert({
            title: 'Solicitud de Alta Enviada 📤',
            message: `La solicitud para activar a <b>${escapeHtml(lead.name)}</b> en el mapa de la Red fue registrada exitosamente y está lista para aprobación de Dirección.`,
            icon: '✅',
            html: true
          });
        }
      } catch (err: any) {
        console.error('[CRM] Error en alta de venue:', err);
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.textContent = isDirectAuthorized ? '✓ Activar en Red' : '📤 Enviar Solicitud';
        }
        await RondaDialog.alert({
          title: 'No se pudo completar el alta',
          message: 'Error al registrar en Firestore: ' + escapeHtml(err?.message || String(err)),
          icon: '⚠️',
          type: 'danger'
        });
      }
    });
  }

  // --- Tarea 4: Mensaje de "Acuerdo de Barra Cerrada" (con toWaPhone P1-9) ---
  async generateBarAgreement(leadId: string) {
    const lead = this.leads.find((l) => l.id === leadId);
    if (!lead) return;

    const contact = lead.contactName || 'equipo';
    const message = `Hola ${contact}, de parte de RONDA te enviamos la confirmación del Piloto de 1 Noche para ${lead.name}: garantizamos 24 asistentes verificados a cambio del precio de barra cerrada pactado ($22.500 COP/cóctel IVA inc.). Cero costo fijo ni comisión sobre el consumo adicional en mesa.`;

    let copied = false;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(message);
        copied = true;
      }
    } catch {
      /* fallback below */
    }
    if (!copied) {
      const ta = document.createElement('textarea');
      ta.value = message;
      ta.style.cssText = 'position:fixed;top:-9999px;';
      document.body.appendChild(ta);
      ta.select();
      try {
        copied = document.execCommand('copy');
      } catch {
        copied = false;
      }
      ta.remove();
    }

    const waPhone = toWaPhone(lead.phone);
    const waLink = waPhone ? `https://wa.me/${waPhone}?text=${encodeURIComponent(message)}` : '';
    if (waLink) window.open(waLink, '_blank', 'noopener');

    await RondaDialog.alert({
      title: '📄 Acuerdo de Barra Cerrada',
      message:
        (copied ? 'Mensaje <b>copiado al portapapeles</b>. ' : '') +
        (waLink
          ? 'Se abrió WhatsApp con el acuerdo pre-cargado.'
          : 'Sin teléfono móvil válido registrado: pega el mensaje desde tu portapapeles.'),
      icon: '📄',
      html: true
    });
  }

  // ============ Modal Accesible de Alta de Nuevo Lead (P0-1, P1-8, P2-19, P3-25) ============
  openNewLeadModal(triggerEl?: HTMLElement | null) {
    const overlay = document.getElementById('crm-lead-drawer-overlay');
    const drawer = document.getElementById('crm-lead-drawer');
    if (!overlay || !drawer) return;

    if (this.activeSheet) {
      this.activeSheet.close();
      this.activeSheet = null;
    }

    const hits = bounty();
    const defaultNextAction = this.addDaysIso(2);
    const zoneOptions = BOGOTA_ZONES.map(
      (z) => `<option value="${escapeHtml(z)}">${escapeHtml(z)}</option>`
    ).join('');

    drawer.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 18px;">
        <div>
          <h3 id="crm-drawer-title" style="font-family: var(--font-display); font-size: 22px; color: var(--papel); margin: 0;">➕ Nuevo Bar Prospecto</h3>
          <p style="font-size: 11.5px; color: var(--humo); margin: 2px 0 0;">
            Política v5.1: Bounty $${hits.total.toLocaleString('es-CO')} COP ($100k Firma + $250k Activación + $100k Retención)
          </p>
        </div>
        <button type="button" id="btn-close-lead-modal" aria-label="Cerrar registro de lead" style="background: none; border: none; color: var(--humo); font-size: 20px; cursor: pointer; padding: 4px;">✕</button>
      </div>

      <form id="form-create-lead" style="display: flex; flex-direction: column; gap: 12px;">
        <div>
          <label for="nl-name" style="display: block; font-size: 11px; font-family: var(--font-mono); color: var(--humo); margin-bottom: 4px;">Nombre del Bar / Gastrobar *</label>
          <input type="text" id="nl-name" required maxlength="100" placeholder="Ej. Huerta Bar, Caronte Speakeasy" class="ronda-input" style="margin-bottom: 0;">
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
          <div>
            <label for="nl-contact" style="display: block; font-size: 11px; font-family: var(--font-mono); color: var(--humo); margin-bottom: 4px;">Contacto (Admin/Gerente)</label>
            <input type="text" id="nl-contact" placeholder="Ej. Carlos Mendoza" class="ronda-input" style="margin-bottom: 0;">
          </div>
          <div>
            <label for="nl-phone" style="display: block; font-size: 11px; font-family: var(--font-mono); color: var(--humo); margin-bottom: 4px;">WhatsApp Móvil CO *</label>
            <input type="tel" id="nl-phone" required placeholder="Ej. 3001234567" class="ronda-input" style="margin-bottom: 0;">
          </div>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
          <div>
            <label for="nl-zone" style="display: block; font-size: 11px; font-family: var(--font-mono); color: var(--humo); margin-bottom: 4px;">Zona de Bogotá</label>
            <select id="nl-zone" class="ronda-input" style="margin-bottom: 0;">
              ${zoneOptions}
            </select>
          </div>
          <div>
            <label for="nl-day" style="display: block; font-size: 11px; font-family: var(--font-mono); color: var(--humo); margin-bottom: 4px;">Día Valle Objetivo</label>
            <select id="nl-day" class="ronda-input" style="margin-bottom: 0;">
              <option value="miércoles">Miércoles</option>
              <option value="martes">Martes</option>
              <option value="jueves">Jueves</option>
            </select>
          </div>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1.3fr; gap: 10px;">
          <div>
            <label for="nl-next-action" style="display: block; font-size: 11px; font-family: var(--font-mono); color: var(--humo); margin-bottom: 4px;">Próxima Acción</label>
            <input type="date" id="nl-next-action" value="${escapeHtml(defaultNextAction)}" class="ronda-input" style="margin-bottom: 0;">
          </div>
          <div>
            <label for="nl-next-note" style="display: block; font-size: 11px; font-family: var(--font-mono); color: var(--humo); margin-bottom: 4px;">Objetivo del Toque</label>
            <input type="text" id="nl-next-note" placeholder="Ej. Visita presencial de 20 min" class="ronda-input" style="margin-bottom: 0;">
          </div>
        </div>

        <div>
          <label for="nl-notes" style="display: block; font-size: 11px; font-family: var(--font-mono); color: var(--humo); margin-bottom: 4px;">Notas de prospección / Aforo</label>
          <textarea id="nl-notes" rows="2" placeholder="Ej. Administrador abierto a miércoles. Capacidad 14 mesas." class="ronda-input" style="margin-bottom: 0; resize: vertical; font-size: 12px;"></textarea>
        </div>

        <div style="display: flex; gap: 10px; margin-top: 8px;">
          <button type="button" id="btn-cancel-lead" class="btn" style="flex: 1; padding: 10px; font-size: 12px; background: rgba(243,237,226,0.05); border-color: var(--linea);">Cancelar</button>
          <button type="submit" id="btn-submit-lead" class="btn ambar" style="flex: 1; padding: 10px; font-size: 12px; font-weight: 700;">Guardar Lead</button>
        </div>
      </form>
    `;

    this.activeSheet = openSheet({
      overlay,
      dialog: drawer,
      labelledBy: 'crm-drawer-title',
      triggerEl,
      onClose: () => {
        this.activeSheet = null;
      }
    });

    const closeModal = () => this.closeLeadDetailModal();
    document.getElementById('btn-close-lead-modal')?.addEventListener('click', closeModal);
    document.getElementById('btn-cancel-lead')?.addEventListener('click', closeModal);

    const form = document.getElementById('form-create-lead');
    form?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = (document.getElementById('nl-name') as HTMLInputElement)?.value.trim();
      const contactName = (document.getElementById('nl-contact') as HTMLInputElement)?.value.trim() || 'Gerente';
      const phone = (document.getElementById('nl-phone') as HTMLInputElement)?.value.trim();
      const zone = (document.getElementById('nl-zone') as HTMLSelectElement)?.value;
      const preferredDay = (document.getElementById('nl-day') as HTMLSelectElement)?.value as 'martes' | 'miércoles' | 'jueves';
      const nextActionAt = (document.getElementById('nl-next-action') as HTMLInputElement)?.value.trim();
      const nextActionNote = (document.getElementById('nl-next-note') as HTMLInputElement)?.value.trim();
      const notes = (document.getElementById('nl-notes') as HTMLTextAreaElement)?.value.trim();

      if (!name || !phone) return;

      const submitBtn = document.getElementById('btn-submit-lead') as HTMLButtonElement | null;
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = 'Guardando…';
      }

      try {
        const created = await this.addNewLead({
          name,
          contactName,
          phone,
          zone,
          preferredDay,
          next_action_at: nextActionAt,
          next_action_note: nextActionNote,
          notes
        });
        if (created) {
          closeModal();
        }
      } catch (err: any) {
        await RondaDialog.alert({
          title: 'Error al guardar',
          message: 'No se pudo crear el lead: ' + escapeHtml(err?.message || String(err)),
          icon: '⚠️',
          type: 'danger'
        });
      } finally {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.textContent = 'Guardar Lead';
        }
      }
    });
  }

  // P3-25: IDs con crypto.randomUUID() + detección de duplicados por teléfono o nombre
  async addNewLead(data: {
    name: string;
    contactName: string;
    phone: string;
    zone?: string;
    preferredDay?: 'martes' | 'miércoles' | 'jueves';
    next_action_at?: string;
    next_action_note?: string;
    notes?: string;
  }): Promise<boolean> {
    const normName = normalizeSearchText(data.name);
    const normWa = toWaPhone(data.phone);

    const duplicate = this.leads.find((l) => {
      if (l.status === 'archived') return false;
      if (normWa && toWaPhone(l.phone) === normWa) return true;
      if (normName && normalizeSearchText(l.name) === normName) return true;
      return false;
    });

    if (duplicate) {
      const proceed = await RondaDialog.confirm({
        title: 'Posible Lead Duplicado ⚠️',
        message: `Ya existe <b>${escapeHtml(duplicate.name)}</b> (${escapeHtml(duplicate.phone || 'sin tel')}) en estado <b>${escapeHtml(duplicate.status)}</b>. ¿Deseas registrarlo de todos modos?`,
        confirmText: 'Registrar igual',
        cancelText: 'Cancelar',
        icon: '⚠️',
        html: true
      });
      if (!proceed) return false;
    }

    const uuid =
      typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    const nowIso = new Date().toISOString();
    const hits = bounty();

    const newLead: Lead = {
      id: `lead_${uuid}`,
      name: data.name,
      contactName: data.contactName,
      status: 'lead',
      sales_uid: this.currentSalesUid,
      scout_uid: this.currentSalesUid,
      commission: hits.total,
      phone: data.phone,
      zone: data.zone,
      preferredDay: data.preferredDay,
      next_action_at: data.next_action_at || this.addDaysIso(2),
      next_action_note: data.next_action_note,
      notes: data.notes,
      createdAt: nowIso,
      stage_updated_at: nowIso,
      updatedAt: nowIso
    };

    await DB.saveLead(newLead);
    await DB.appendLeadEvent(newLead.id, {
      type: 'created',
      toStatus: 'lead',
      byUid: this.currentSalesUid,
      byName: this.currentUserName,
      note: `Prospecto registrado en ${data.zone || 'Bogotá'}`
    });

    if (!this.leads.some((l) => l.id === newLead.id)) {
      this.leads.unshift(newLead);
    }
    this.syncZoneFilterOptions();
    this.render();

    showCrmNotification(`Prospecto «${newLead.name}» agregado al pipeline.`, 'success');
    return true;
  }

  // ============ P3-28: Exportación CSV del Pipeline para Cierre de Mes ============
  exportCsv(): void {
    const active = this.leads.filter((l) => l.status !== 'archived');
    if (active.length === 0) {
      showCrmNotification('No hay leads activos para exportar.', 'warning');
      return;
    }

    const escCsv = (val: unknown): string => {
      const s = String(val ?? '').replace(/"/g, '""');
      return `"${s}"`;
    };

    const headers = [
      'ID',
      'Nombre Bar',
      'Zona',
      'Contacto',
      'Telefono',
      'WhatsApp E164',
      'Etapa',
      'Scout UID',
      'Dia Preferido',
      'Mesas',
      'Hito A',
      'Hito B',
      'Hito C',
      'Proyectado COP',
      'Devengado COP',
      'Pagado COP',
      'Proxima Accion',
      'Ultimo Contacto',
      'Notas'
    ];

    const rows = active.map((l) => {
      const acc = accrued(l, this.myLedger);
      const ms = l.milestone_status || { A: 'not_eligible', B: 'not_eligible', C: 'not_eligible' };
      return [
        l.id,
        l.name,
        l.zone || '',
        l.contactName || '',
        l.phone || '',
        toWaPhone(l.phone) || '',
        l.status,
        l.scout_uid || l.sales_uid || '',
        l.preferredDay || '',
        l.tablesCount ?? '',
        ms.A,
        ms.B,
        ms.C,
        acc.proyectado,
        acc.devengado,
        acc.pagado,
        l.next_action_at || '',
        l.last_contact_at || '',
        l.notes || ''
      ]
        .map(escCsv)
        .join(',');
    });

    const csvContent = '\uFEFF' + [headers.map(escCsv).join(','), ...rows].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ronda-pipeline-crm-${this.currentBogotaDate()}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    showCrmNotification(`CSV exportado (${active.length} leads).`, 'success');
  }
}

export const CRM = new CRMController();
