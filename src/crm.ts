import { DB, Lead, Venue, LedgerEntry, Scout } from './db.js';
import { RondaDialog } from './dialog.js';
import { escapeHtml } from './utils.js';

export class CRMController {
  private leads: Lead[] = [];
  private currentSalesUid: string = 'sales1';
  private filterZone: string = 'all';
  private searchQuery: string = '';
  // --- T3: Mi Estado de Cuenta (ledger propio del scout, solo lectura) ---
  private myLedger: LedgerEntry[] = [];
  private myProfile: Scout | null = null;
  private accountOpen = false;

  constructor() {}

  async init(salesUid?: string) {
    console.log('[CRMController] Inicializando CRM de Ventas...');
    this.currentSalesUid = salesUid || 'sales1';
    
    // Conectar botón Nuevo Lead
    const btnAdd = document.getElementById('btn-crm-add-lead-btn');
    if (btnAdd) {
      btnAdd.onclick = () => this.openNewLeadModal();
    }

    // Tarea 1: buscador y filtro de zonas en tiempo real
    const searchInput = document.getElementById('crm-search-input') as HTMLInputElement | null;
    searchInput?.addEventListener('input', () => {
      this.searchQuery = searchInput.value.trim().toLowerCase();
      this.render();
    });
    const zoneSelect = document.getElementById('crm-zone-filter') as HTMLSelectElement | null;
    zoneSelect?.addEventListener('change', () => {
      this.filterZone = zoneSelect.value;
      this.render();
    });

    // Tarea 2: cierre del drawer de ficha técnica
    const drawerOverlay = document.getElementById('crm-lead-drawer-overlay');
    drawerOverlay?.addEventListener('click', (e) => {
      if (e.target === drawerOverlay) this.closeLeadDetailModal();
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') this.closeLeadDetailModal();
    });

    await this.refreshLeads();
    await this.loadMyAccount();
    this.renderMyAccount();
  }

  // ============ T3: Mi Estado de Cuenta (solo lectura, ledger propio) ============
  private currentBogotaMonth(): string {
    try {
      const iso = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Bogota', year: 'numeric', month: '2-digit', day: '2-digit' });
      return String(iso).slice(0, 7);
    } catch {
      const d = new Date();
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    }
  }

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

  private esc(s: unknown): string {
    return String(s ?? '').replace(/[<>&"']/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&#39;' }[c] as string));
  }

  private renderMyAccount(): void {
    let host = document.getElementById('crm-my-account');
    const kanban = document.getElementById('crm-kanban-wrapper');
    if (!host && kanban?.parentElement) {
      host = document.createElement('div');
      host.id = 'crm-my-account';
      host.style.marginTop = '18px';
      kanban.parentElement.insertBefore(host, kanban.nextSibling);
    }
    if (!host) return;
    const pilaOk = !!this.myProfile?.pilaVerified && this.myProfile?.pilaPeriod === this.currentBogotaMonth();
    const rutOk = !!this.myProfile?.rutVerified;
    const gross = (ss: string[]) => this.myLedger.filter((e) => ss.includes(e.status)).reduce((s, e) => s + (e.amount_gross_cop || 0), 0);
    const dev = gross(['accrued', 'review', 'payable']);
    const pag = gross(['paid']);
    const fmt = (n: number) => '$' + Number(n || 0).toLocaleString('es-CO');
    const myLeads = this.leads.filter((l) => (l.scout_uid || l.sales_uid) === this.currentSalesUid && l.status === 'signed');
    const cards = myLeads.length === 0
      ? `<p style="font-size:11.5px;color:var(--humo);">Sin bares firmados a tu nombre todavía.</p>`
      : myLeads.map((l) => this.renderAccountLeadCard(l)).join('');
    host.innerHTML = `<div style="background:rgba(0,0,0,.35);border:1px solid var(--linea);border-radius:16px;padding:20px;">
      <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:6px;">
        <h3 style="font-family:var(--font-display);font-size:18px;color:var(--papel);margin:0;">💰 Mi Estado de Cuenta</h3>
        <button id="crm-account-toggle" class="btn" style="font-size:11px;padding:8px 14px;">${this.accountOpen ? 'Ocultar' : 'Ver mi cuenta'}</button>
      </div>
      ${(!rutOk || !pilaOk) ? `<div style="font-size:11.5px;color:#ff8ca8;background:rgba(142,36,58,.15);border:1px solid var(--vino);border-radius:10px;padding:10px 14px;margin-bottom:12px;">⚠️ Sin RUT/PILA vigentes no podemos aprobar tu pago.</div>` : ''}
      ${this.accountOpen ? `<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:10px;margin-bottom:14px;">
        <div style="border:1px solid var(--linea);border-radius:10px;padding:12px;"><span style="font-size:10px;color:var(--humo);font-family:var(--font-mono);">DEVENGADO</span><b style="display:block;color:var(--luz);font-size:20px;">${fmt(dev)}</b></div>
        <div style="border:1px solid var(--linea);border-radius:10px;padding:12px;"><span style="font-size:10px;color:var(--humo);font-family:var(--font-mono);">PAGADO</span><b style="display:block;color:var(--botella);font-size:20px;">${fmt(pag)}</b></div>
        <div style="border:1px solid var(--linea);border-radius:10px;padding:12px;"><span style="font-size:10px;color:var(--humo);font-family:var(--font-mono);">RUT / PILA</span><b style="display:block;font-size:15px;color:var(--papel);">${rutOk ? '✓' : '✕'} / ${pilaOk ? '✓' : '✕'}</b></div>
      </div>
      <b style="font-size:12px;color:var(--papel);display:block;margin-bottom:8px;">Embudo por bar firmado</b>
      <div style="display:flex;flex-direction:column;gap:10px;">${cards}</div>`
      : `<p style="font-size:11.5px;color:var(--humo);margin:0;">Devengado: <b style="color:var(--luz);">${fmt(dev)}</b> · Pagado: <b style="color:var(--botella);">${fmt(pag)}</b></p>`}
    </div>`;
    document.getElementById('crm-account-toggle')?.addEventListener('click', () => {
      this.accountOpen = !this.accountOpen;
      this.renderMyAccount();
    });
  }

  private renderAccountLeadCard(l: Lead): string {
    const ms = l.milestone_status;
    const valid = l.valid_event_count || 0;
    const chip = (tag: string, s?: string) => {
      const color = s === 'paid' || s === 'payable' ? 'var(--botella)' : s === 'accrued' || s === 'review' ? 'var(--luz)' : 'var(--humo)';
      return `<span style="font-size:9.5px;font-family:var(--font-mono);color:${color};border:1px solid var(--linea);border-radius:999px;padding:1px 8px;">${tag}:${s || '—'}</span>`;
    };
    let cAlert = '';
    if (l.retention_window_ends_at && ms?.C !== 'paid') {
      const daysLeft = Math.ceil((new Date(l.retention_window_ends_at).getTime() - Date.now()) / 86400000);
      const elapsed = 90 - daysLeft;
      if (daysLeft >= 0) {
        if (elapsed >= 75 && valid < 7) cAlert = `<div style="font-size:10.5px;color:#ff8ca8;margin-top:6px;">🔴 Día ${elapsed}/90: ${valid}/8 eventos — riesgo alto de perder el Hito C.</div>`;
        else if (elapsed >= 60 && valid < 5) cAlert = `<div style="font-size:10.5px;color:var(--luz);margin-top:6px;">🟡 Día ${elapsed}/90: ${valid}/8 eventos — acelera la activación.</div>`;
      }
    }
    const pct = Math.min(100, Math.round((valid / 8) * 100));
    return `<div style="border:1px solid var(--linea);border-radius:10px;padding:12px;background:rgba(243,237,226,.03);">
      <div style="display:flex;justify-content:space-between;gap:8px;align-items:center;flex-wrap:wrap;">
        <b style="color:var(--papel);font-size:12.5px;">${this.esc(l.name)}</b>
        <span style="display:inline-flex;gap:6px;">${chip('A', ms?.A)}${chip('B', ms?.B)}${chip('C', ms?.C)}</span>
      </div>
      <div style="font-size:10.5px;color:var(--humo);font-family:var(--font-mono);margin-top:4px;">Firma (A) → Activación ≥16 pax (B) → Retención 90d / 8 eventos (C)</div>
      <div style="margin-top:8px;background:rgba(0,0,0,.35);border-radius:999px;height:8px;overflow:hidden;"><div style="width:${pct}%;height:100%;background:var(--luz);"></div></div>
      <div style="font-size:10.5px;color:var(--humo);font-family:var(--font-mono);margin-top:4px;">Hito C: ${valid}/8 eventos${l.retention_window_ends_at ? ` · cierra ${this.esc(String(l.retention_window_ends_at).slice(0, 10))}` : ''}</div>
      ${cAlert}
    </div>`;
  }

  async refreshLeads() {
    this.leads = await DB.getLeads();
    if (this.leads.length === 0 && DB.memoryDb?.leads) {
      this.leads = Object.values(DB.memoryDb.leads);
    }
    this.render();
  }

  render() {
    const commissionsEl = document.getElementById('crm-commissions');
    const totalLeadsEl = document.getElementById('crm-total-leads');
    const closedCountEl = document.getElementById('crm-closed-count');

    // Calculate metrics
    const signedLeads = this.leads.filter(l => l.status === 'signed');
    const totalCommissions = signedLeads.reduce((sum, l) => sum + (l.commission || 500000), 0);

    if (commissionsEl) {
      commissionsEl.innerText = `$${totalCommissions.toLocaleString('es-CO')} COP`;
    }
    if (totalLeadsEl) {
      totalLeadsEl.innerText = this.leads.length.toString();
    }
    if (closedCountEl) {
      closedCountEl.innerText = signedLeads.length.toString();
    }

    const colLead = document.getElementById('kanban-lead');
    const colNeg = document.getElementById('kanban-negotiating');
    const colSigned = document.getElementById('kanban-signed');

    if (!colLead || !colNeg || !colSigned) return;

    colLead.innerHTML = '';
    colNeg.innerHTML = '';
    colSigned.innerHTML = '';

    // Filtrar leads
    const filteredLeads = this.leads.filter(lead => {
      const matchZone = this.filterZone === 'all' || (lead.zone && lead.zone.toLowerCase() === this.filterZone.toLowerCase());
      const matchSearch = !this.searchQuery || 
        lead.name.toLowerCase().includes(this.searchQuery.toLowerCase()) || 
        (lead.contactName || '').toLowerCase().includes(this.searchQuery.toLowerCase()) ||
        (lead.phone || '').includes(this.searchQuery);
      return matchZone && matchSearch;
    });

    // Hint de resultados del toolbar (Tarea 1)
    const filterCountEl = document.getElementById('crm-filter-count');
    if (filterCountEl) {
      const filtering = this.filterZone !== 'all' || !!this.searchQuery;
      filterCountEl.textContent = filtering
        ? `${filteredLeads.length} de ${this.leads.length} leads`
        : `${this.leads.length} leads en pipeline`;
    }

    if (filteredLeads.length === 0 && this.leads.length > 0) {
      const empty = document.createElement('p');
      empty.style.cssText = 'font-size:12px;color:var(--humo);text-align:center;width:100%;padding:20px 0;margin:0;';
      empty.textContent = '🔍 Sin resultados para la búsqueda / zona seleccionada.';
      colLead.appendChild(empty);
    }

    filteredLeads.forEach(lead => {
      const card = document.createElement('div');
      card.className = 'kanban-lead-card';
      card.style.background = 'rgba(243,237,226,0.06)';
      card.style.border = '1px solid var(--linea)';
      card.style.borderRadius = '12px';
      card.style.padding = '14px';
      card.style.marginBottom = '12px';
      card.style.cursor = 'grab';
      card.draggable = true;

      const commFormatted = (lead.commission || 500000).toLocaleString('es-CO');
      const cleanPhone = lead.phone ? lead.phone.replace(/\D/g, '') : '';
      const waLink = cleanPhone ? `https://wa.me/57${cleanPhone}?text=Hola%20${encodeURIComponent(lead.contactName || '')},%20te%20escribo%20de%20RONDA%20para%20la%20noche%20piloto%20en%20${encodeURIComponent(lead.name)}.` : '';

      card.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 6px;">
          <div>
            <b class="crm-lead-name" data-id="${lead.id}" title="Abrir ficha técnica del local" style="font-family: var(--font-display); font-size: 15px; color: var(--papel); cursor: pointer; border-bottom: 1px dashed rgba(240,168,48,0.6);">${escapeHtml(lead.name)}</b>
            ${lead.zone ? `<span class="chip" style="font-size: 9px; padding: 2px 6px; margin-left: 6px; background: rgba(243,237,226,0.1);">${escapeHtml(lead.zone)}</span>` : ''}
          </div>
          <span class="chip ambar" style="font-size: 9px; padding: 2px 6px;">+$${commFormatted}</span>
        </div>

        <p style="font-size: 11.5px; color: var(--humo); font-family: var(--font-mono); margin: 0 0 6px;">
          👤 ${escapeHtml(lead.contactName || 'Sin contacto')}
        </p>

        ${lead.phone ? `
          <div style="margin-bottom: 8px;">
            <a href="${waLink}" target="_blank" rel="noopener noreferrer" style="display: inline-flex; align-items: center; gap: 4px; font-size: 11px; color: #79D3AC; font-family: var(--font-mono); text-decoration: none; background: rgba(46,107,84,0.15); border: 1px solid rgba(46,107,84,0.4); padding: 3px 8px; border-radius: 6px;">
              💬 WhatsApp (${escapeHtml(lead.phone)})
            </a>
          </div>
        ` : ''}

        ${lead.notes ? `
          <p style="font-size: 10.5px; color: var(--humo); background: rgba(0,0,0,0.25); padding: 6px 8px; border-radius: 6px; margin: 0 0 8px; border-left: 2px solid var(--luz);">
            📝 ${escapeHtml(lead.notes)}
          </p>
        ` : ''}

        <!-- Tarea 4: Generador de Acuerdo de Barra Cerrada + Tarea 3: Conversión a Venue -->
        <div style="display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 8px;">
          <button class="btn btn-agreement" data-id="${lead.id}" style="font-size: 10px; padding: 4px 8px; background: rgba(0,0,0,0.3); border-color: var(--linea);" title="Generar acuerdo de barra cerrada">
            📄 Acuerdo
          </button>
          ${lead.status === 'signed' ? (lead.venueId
            ? `<span class="chip verde" style="font-size: 9px; padding: 3px 7px;">✓ En Red RONDA</span>`
            : `<button class="btn verde btn-convert-venue" data-id="${lead.id}" style="font-size: 10px; padding: 4px 8px; font-weight: 700;">🗺️ Dar de Alta en Red</button>`) : ''}
        </div>
        
        
        <!-- Acciones rápidas de movimiento -->
        <div style="display: flex; gap: 6px; justify-content: space-between; align-items: center; border-top: 1px dashed var(--linea); padding-top: 8px;">
          <button class="btn btn-delete-lead" data-id="${lead.id}" style="font-size: 10px; padding: 3px 6px; background: none; border: none; color: var(--humo); opacity: 0.6;" title="Eliminar lead">
            🗑️
          </button>
          <div style="display: flex; gap: 6px;">
            ${lead.status !== 'lead' ? `
              <button class="btn btn-move-lead" data-id="${lead.id}" data-to="${lead.status === 'signed' ? 'negotiating' : 'lead'}" style="font-size: 10px; padding: 4px 8px; background: rgba(0,0,0,0.3); border-color: var(--linea);">
                ← Regresar
              </button>
            ` : ''}
            ${lead.status !== 'signed' ? `
              <button class="btn ambar btn-move-lead" data-id="${lead.id}" data-to="${lead.status === 'lead' ? 'negotiating' : 'signed'}" style="font-size: 10px; padding: 4px 8px; font-weight: 700;">
                Avanzar →
              </button>
            ` : `
              <span style="font-size: 10px; color: var(--botella); font-family: var(--font-mono); font-weight: 700;">✓ Firmado</span>
            `}
          </div>
        </div>
      `;

      // Drag & Drop
      card.addEventListener('dragstart', (e) => {
        if (e.dataTransfer) {
          e.dataTransfer.setData('text/plain', lead.id);
        }
      });

      if (lead.status === 'lead') colLead.appendChild(card);
      else if (lead.status === 'negotiating') colNeg.appendChild(card);
      else if (lead.status === 'signed') colSigned.appendChild(card);
    });

    const setupDropZone = (zone: HTMLElement, targetStatus: 'lead' | 'negotiating' | 'signed') => {
      // Guard: render() se dispara en cada tecla del buscador; no re-acumular listeners.
      if (zone.dataset.dropBound === '1') return;
      zone.dataset.dropBound = '1';
      zone.addEventListener('dragover', (e) => {
        e.preventDefault();
        zone.style.background = 'rgba(240,168,48,0.08)';
      });
      zone.addEventListener('dragleave', () => {
        zone.style.background = 'var(--barra)';
      });
      zone.addEventListener('drop', async (e) => {
        e.preventDefault();
        zone.style.background = 'var(--barra)';
        const leadId = e.dataTransfer?.getData('text/plain');
        if (leadId) {
          await this.moveLead(leadId, targetStatus);
        }
      });
    };

    setupDropZone(colLead, 'lead');
    setupDropZone(colNeg, 'negotiating');
    setupDropZone(colSigned, 'signed');

    // Click handler for move buttons
    document.querySelectorAll('.btn-move-lead').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const id = (e.currentTarget as HTMLElement).getAttribute('data-id');
        const to = (e.currentTarget as HTMLElement).getAttribute('data-to') as any;
        if (id && to) {
          await this.moveLead(id, to);
        }
      });
    });

    // Click handler for delete buttons
    document.querySelectorAll('.btn-delete-lead').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const id = (e.currentTarget as HTMLElement).getAttribute('data-id');
        if (id) {
          const confirm = window.confirm('¿Seguro que deseas eliminar este prospecto?');
          if (confirm) {
            await this.deleteLead(id);
          }
        }
      });
    });

    // Tarea 2: clic en el nombre -> ficha técnica
    document.querySelectorAll('.crm-lead-name').forEach(el => {
      el.addEventListener('click', (e) => {
        const id = (e.currentTarget as HTMLElement).getAttribute('data-id');
        if (id) this.openLeadDetailModal(id);
      });
    });

    // Tarea 4: generador de acuerdo de barra cerrada
    document.querySelectorAll('.btn-agreement').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = (e.currentTarget as HTMLElement).getAttribute('data-id');
        if (id) void this.generateBarAgreement(id);
      });
    });

    // Tarea 3: conversión de lead a venue oficial
    document.querySelectorAll('.btn-convert-venue').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = (e.currentTarget as HTMLElement).getAttribute('data-id');
        if (id) void this.convertLeadToVenue(id);
      });
    });
  }

  async moveLead(leadId: string, newStatus: 'lead' | 'negotiating' | 'signed') {
    const lead = this.leads.find(l => l.id === leadId);
    if (!lead) return;

    lead.status = newStatus;
    await DB.updateLeadStatus(leadId, newStatus);
    this.render();

    if (newStatus === 'signed') {
      await RondaDialog.alert({
        title: '¡Venta Cerrada! 🎉',
        message: `¡Felicitaciones! Has afiliado exitosamente a <b>${lead.name}</b> a la red RONDA.<br><br>Comisión fija asegurada: <b>+$${(lead.commission || 500000).toLocaleString('es-CO')} COP</b>.`,
        icon: '💵'
      });
    }
  }

  async deleteLead(leadId: string) {
    this.leads = this.leads.filter(l => l.id !== leadId);
    await DB.deleteLead(leadId);
    this.render();
  }

  // --- Tarea 2: Ficha técnica del local (drawer) ---
  openLeadDetailModal(leadId: string) {
    const lead = this.leads.find(l => l.id === leadId);
    const overlay = document.getElementById('crm-lead-drawer-overlay');
    const drawer = document.getElementById('crm-lead-drawer');
    if (!lead || !overlay || !drawer) return;

    const statusChip = lead.status === 'signed'
      ? '<span class="chip verde" style="font-size:9px;">Firmado</span>'
      : lead.status === 'negotiating'
        ? '<span class="chip ambar" style="font-size:9px;">Negociando</span>'
        : '<span class="chip gris" style="font-size:9px;">Prospecto</span>';

    drawer.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:16px; gap:10px;">
        <div>
          <h3 style="font-family:var(--font-display); font-size:20px; color:var(--papel); margin:0;">📋 ${lead.name}</h3>
          <p style="font-size:11px; color:var(--humo); margin:4px 0 0;">${lead.contactName || 'Sin contacto'}${lead.zone ? ` · ${lead.zone}` : ''}</p>
        </div>
        <button id="btn-close-lead-drawer" style="background:none; border:none; color:var(--humo); font-size:20px; cursor:pointer; padding:4px;" title="Cerrar">✕</button>
      </div>
      <div style="margin-bottom:14px;">${statusChip}</div>

      <form id="form-lead-detail" style="display:flex; flex-direction:column; gap:12px;">
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px;">
          <div>
            <label style="display:block; font-size:11px; font-family:var(--font-mono); color:var(--humo); margin-bottom:4px;">Mesas del local</label>
            <input type="number" id="ld-tables" min="0" step="1" value="${lead.tablesCount ?? ''}" placeholder="Ej. 14" class="ronda-input" style="margin-bottom:0;">
          </div>
          <div>
            <label style="display:block; font-size:11px; font-family:var(--font-mono); color:var(--humo); margin-bottom:4px;">Día preferido</label>
            <select id="ld-day" class="ronda-input" style="margin-bottom:0;">
              <option value="" ${!lead.preferredDay ? 'selected' : ''}>Sin definir</option>
              <option value="martes" ${lead.preferredDay === 'martes' ? 'selected' : ''}>martes</option>
              <option value="miércoles" ${lead.preferredDay === 'miércoles' ? 'selected' : ''}>miércoles</option>
              <option value="jueves" ${lead.preferredDay === 'jueves' ? 'selected' : ''}>jueves</option>
            </select>
          </div>
        </div>

        <div>
          <label style="display:block; font-size:11px; font-family:var(--font-mono); color:var(--humo); margin-bottom:4px;">Notas de prospección / Ficha técnica</label>
          <textarea id="ld-notes" rows="4" placeholder="Ej. Capacidad 14 mesas. Administrador abierto a miércoles. Fachada con terraza." class="ronda-input" style="margin-bottom:0; resize:vertical; font-size:12px;">${(lead.notes || '').replace(/</g, '&lt;')}</textarea>
        </div>

        <div style="display:flex; gap:10px;">
          <button type="button" id="btn-cancel-lead-drawer" class="btn" style="flex:1; padding:10px; font-size:12px; background:rgba(243,237,226,0.05); border-color:var(--linea);">Cancelar</button>
          <button type="submit" id="btn-save-lead-drawer" class="btn ambar" style="flex:1; padding:10px; font-size:12px; font-weight:700;">Guardar Cambios</button>
        </div>
      </form>
    `;

    overlay.classList.add('active');

    const close = () => this.closeLeadDetailModal();
    document.getElementById('btn-close-lead-drawer')?.addEventListener('click', close);
    document.getElementById('btn-cancel-lead-drawer')?.addEventListener('click', close);

    document.getElementById('form-lead-detail')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const saveBtn = document.getElementById('btn-save-lead-drawer') as HTMLButtonElement | null;
      if (saveBtn) { saveBtn.disabled = true; saveBtn.textContent = 'Guardando…'; }
      try {
        const tablesRaw = (document.getElementById('ld-tables') as HTMLInputElement)?.value ?? '';
        const day = (document.getElementById('ld-day') as HTMLSelectElement)?.value ?? '';
        const notes = (document.getElementById('ld-notes') as HTMLTextAreaElement)?.value.trim() ?? '';

        // Firestore rechaza `undefined` en setDoc: borrar la clave en vez de asignarla.
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
        if (notes) {
          lead.notes = notes;
        } else {
          delete lead.notes;
        }

        await DB.saveLead(lead);
        this.render();
        this.closeLeadDetailModal();
        await RondaDialog.alert({
          title: 'Ficha Actualizada 📋',
          message: `La ficha técnica de <b>${lead.name}</b> fue guardada en Firestore.`,
          icon: '✅'
        });
      } catch (err: any) {
        console.error('[CRM] Error guardando ficha del lead:', err);
        if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = 'Guardar Cambios'; }
        await RondaDialog.alert({
          title: 'Error',
          message: 'No se pudieron guardar los cambios: ' + (err?.message || err),
          icon: '⚠️',
          type: 'danger'
        });
      }
    });
  }

  closeLeadDetailModal() {
    document.getElementById('crm-lead-drawer-overlay')?.classList.remove('active');
  }

  // --- Tarea 3: Conversión de Lead a Venue oficial ---
  async convertLeadToVenue(leadId: string) {
    const lead = this.leads.find(l => l.id === leadId);
    if (!lead || lead.status !== 'signed') return;

    const address = window.prompt(`Dirección de ${lead.name} (Ej: Calle 69 # 5-30):`, '');
    if (!address || !address.trim()) return;
    const latRaw = window.prompt('Latitud (Ej: 4.6540):', '4.6540');
    if (latRaw === null) return;
    const lngRaw = window.prompt('Longitud (Ej: -74.0560):', '-74.0560');
    if (lngRaw === null) return;

    const lat = Number(latRaw.replace(',', '.'));
    const lng = Number(lngRaw.replace(',', '.'));
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
      await RondaDialog.alert({
        title: 'Coordenadas Inválidas',
        message: 'Ingresa lat y lng válidos (decimales, ej: 4.6540 / -74.0560).',
        icon: '⚠️',
        type: 'danger'
      });
      return;
    }

    const venue: Venue = {
      id: 'v_' + Date.now(),
      name: lead.name,
      address: address.trim(),
      zone: lead.zone || 'Bogotá',
      lat,
      lng,
      status: 'active'
    };

    try {
      await DB.saveVenue(venue);
      // Sincronizar caché local de la Red si existe
      if (DB.memoryDb?.venues) {
        DB.memoryDb.venues[venue.id] = venue;
      }
      lead.venueId = venue.id;
      await DB.saveLead(lead);
      this.render();
      await RondaDialog.alert({
        title: 'Bar en la Red 🗺️',
        message: `<b>${venue.name}</b> fue dado de alta como venue oficial en la Red RONDA (exclusividad de 500m activa).`,
        icon: '🗺️'
      });
    } catch (err: any) {
      console.error('[CRM] Error dando de alta venue:', err);
      const isPerm = String(err?.code || err?.message || '').includes('permission');
      await RondaDialog.alert({
        title: 'No se pudo dar de alta',
        message: isPerm
          ? 'Firestore denegó la escritura en <b>venues</b>: tu rol (<b>sales</b>) solo tiene lectura. Un superadmin debe completar el alta o actualizar las reglas.'
          : 'Error al guardar el venue: ' + (err?.message || err),
        icon: '⚠️',
        type: 'danger'
      });
    }
  }

  // --- Tarea 4: Mensaje de "Acuerdo de Barra Cerrada" ---
  async generateBarAgreement(leadId: string) {
    const lead = this.leads.find(l => l.id === leadId);
    if (!lead) return;

    const contact = lead.contactName || 'equipo';
    const message = `Hola ${contact}, de parte de RONDA te enviamos la confirmación del Piloto de 1 Noche para ${lead.name}: garantizamos 24 asistentes a cambio del precio de barra cerrado pactado ($22.000 COP/trago). Cero comisión sobre consumo adicional...`;

    // 1) Copiar al portapapeles (fallback: textarea + execCommand)
    let copied = false;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(message);
        copied = true;
      }
    } catch { /* fallback abaixo */ }
    if (!copied) {
      const ta = document.createElement('textarea');
      ta.value = message;
      ta.style.cssText = 'position:fixed;top:-9999px;';
      document.body.appendChild(ta);
      ta.select();
      try { copied = document.execCommand('copy'); } catch { copied = false; }
      ta.remove();
    }

    // 2) Abrir WhatsApp si hay teléfono registrado
    const cleanPhone = lead.phone ? lead.phone.replace(/\D/g, '') : '';
    const waLink = cleanPhone
      ? `https://wa.me/57${cleanPhone}?text=${encodeURIComponent(message)}`
      : '';
    if (waLink) window.open(waLink, '_blank', 'noopener');

    await RondaDialog.alert({
      title: '📄 Acuerdo de Barra Cerrada',
      message: (copied ? 'Mensaje <b>copiado al portapapeles</b>. ' : '')
        + (waLink
          ? 'Se abrió WhatsApp con el pitch pre-cargado.'
          : 'Sin teléfono registrado: copia el mensaje desde el portapapeles.'),
      icon: '📄'
    });
  }

  openNewLeadModal() {
    let modal = document.getElementById('modal-new-lead');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'modal-new-lead';
      modal.style.cssText = `
        position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
        background: rgba(10, 7, 14, 0.85); backdrop-filter: blur(8px);
        display: flex; align-items: center; justify-content: center;
        z-index: 10000; padding: 16px; box-sizing: border-box;
      `;
      document.body.appendChild(modal);
    }

    modal.innerHTML = `
      <div style="background: rgba(22, 16, 27, 0.96); border: 1px solid var(--linea); border-radius: 20px; max-width: 480px; width: 100%; padding: 28px 24px; box-shadow: 0 16px 40px rgba(0,0,0,0.8);">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
          <div>
            <h3 style="font-family: var(--font-display); font-size: 22px; color: var(--papel); margin: 0;">➕ Nuevo Bar Prospecto</h3>
            <p style="font-size: 11.5px; color: var(--humo); margin: 2px 0 0;">Ingresa los datos para iniciar la prospección comercial.</p>
          </div>
          <button id="btn-close-lead-modal" style="background: none; border: none; color: var(--humo); font-size: 20px; cursor: pointer; padding: 4px;">✕</button>
        </div>

        <form id="form-create-lead" style="display: flex; flex-direction: column; gap: 12px;" onsubmit="event.preventDefault();">
          <div>
            <label style="display: block; font-size: 11px; font-family: var(--font-mono); color: var(--humo); margin-bottom: 4px;">Nombre del Bar / Gastrobar *</label>
            <input type="text" id="nl-name" required placeholder="Ej. Huerta Bar, Caronte Speakeasy" class="ronda-input" style="width: 100%; box-sizing: border-box; margin-bottom: 0;">
          </div>

          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
            <div>
              <label style="display: block; font-size: 11px; font-family: var(--font-mono); color: var(--humo); margin-bottom: 4px;">Contacto (Admin/Gerente)</label>
              <input type="text" id="nl-contact" placeholder="Ej. Carlos Mendoza" class="ronda-input" style="width: 100%; box-sizing: border-box; margin-bottom: 0;">
            </div>
            <div>
              <label style="display: block; font-size: 11px; font-family: var(--font-mono); color: var(--humo); margin-bottom: 4px;">WhatsApp (+57...)</label>
              <input type="tel" id="nl-phone" placeholder="Ej. 3001234567" class="ronda-input" style="width: 100%; box-sizing: border-box; margin-bottom: 0;">
            </div>
          </div>

          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
            <div>
              <label style="display: block; font-size: 11px; font-family: var(--font-mono); color: var(--humo); margin-bottom: 4px;">Zona de Bogotá</label>
              <select id="nl-zone" class="ronda-input" style="width: 100%; box-sizing: border-box; margin-bottom: 0;">
                <option value="Chapinero Alto">Chapinero Alto</option>
                <option value="Quinta Camacho">Quinta Camacho</option>
                <option value="Zona G">Zona G</option>
                <option value="Zona T / El Retiro">Zona T / El Retiro</option>
                <option value="Usaquén">Usaquén</option>
                <option value="Parque 93">Parque 93</option>
                <option value="Teusaquillo">Teusaquillo</option>
              </select>
            </div>
            <div>
              <label style="display: block; font-size: 11px; font-family: var(--font-mono); color: var(--humo); margin-bottom: 4px;">Comisión fija (COP)</label>
              <input type="number" id="nl-commission" value="500000" step="50000" class="ronda-input" style="width: 100%; box-sizing: border-box; margin-bottom: 0;">
            </div>
          </div>

          <div>
            <label style="display: block; font-size: 11px; font-family: var(--font-mono); color: var(--humo); margin-bottom: 4px;">Notas de prospección / Días valle</label>
            <textarea id="nl-notes" rows="2" placeholder="Ej. Administrador abierto a miércoles. Capacidad 14 mesas." class="ronda-input" style="width: 100%; box-sizing: border-box; margin-bottom: 0; resize: vertical; font-family: inherit; font-size: 12px;"></textarea>
          </div>

          <div style="display: flex; gap: 10px; margin-top: 10px;">
            <button type="button" id="btn-cancel-lead" class="btn" style="flex: 1; padding: 10px; font-size: 12px; background: rgba(243,237,226,0.05); border-color: var(--linea);">Cancelar</button>
            <button type="submit" id="btn-submit-lead" class="btn ambar" style="flex: 1; padding: 10px; font-size: 12px; font-weight: 700;">Guardar Lead</button>
          </div>
        </form>
      </div>
    `;

    modal.style.display = 'flex';

    const closeModal = () => {
      if (modal) modal.style.display = 'none';
    };

    document.getElementById('btn-close-lead-modal')?.addEventListener('click', closeModal);
    document.getElementById('btn-cancel-lead')?.addEventListener('click', closeModal);

    const form = document.getElementById('form-create-lead');
    form?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = (document.getElementById('nl-name') as HTMLInputElement)?.value.trim();
      const contactName = (document.getElementById('nl-contact') as HTMLInputElement)?.value.trim() || 'Gerente';
      const phone = (document.getElementById('nl-phone') as HTMLInputElement)?.value.trim();
      const zone = (document.getElementById('nl-zone') as HTMLSelectElement)?.value;
      const commission = Number((document.getElementById('nl-commission') as HTMLInputElement)?.value) || 500000;
      const notes = (document.getElementById('nl-notes') as HTMLTextAreaElement)?.value.trim();

      if (!name) return;

      const submitBtn = document.getElementById('btn-submit-lead') as HTMLButtonElement;
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = 'Guardando…';
      }

      try {
        await this.addNewLead({
          name,
          contactName,
          phone,
          zone,
          commission,
          notes
        });
        closeModal();
      } catch (err: any) {
        await RondaDialog.alert({
          title: 'Error al guardar',
          message: 'No se pudo crear el lead: ' + (err?.message || err),
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

  async addNewLead(data: { name: string; contactName: string; phone?: string; zone?: string; commission: number; notes?: string }) {
    const newLead: Lead = {
      id: 'lead_' + Date.now(),
      name: data.name,
      contactName: data.contactName,
      status: 'lead',
      sales_uid: this.currentSalesUid,
      commission: data.commission,
      phone: data.phone,
      zone: data.zone,
      notes: data.notes,
      createdAt: new Date().toISOString()
    };

    // Guardar en Firestore
    await DB.saveLead(newLead);

    // Agregar a la lista local
    this.leads.unshift(newLead);
    this.render();

    await RondaDialog.alert({
      title: 'Prospecto Registrado 🎯',
      message: `El bar <b>${newLead.name}</b> ha sido agregado a tu pipeline en la columna <b>Lead / Prospección</b>.`,
      icon: '✅'
    });
  }
}

export const CRM = new CRMController();
