/**
 * treasury-panel.ts — Módulo independiente "Liquidaciones B2B & Tesorería".
 *
 * Antes vivía embebido en el Resumen como una tarjeta de dos columnas; ahora es
 * una sección propia (`data-section="treasury"`) montada por el shell.
 *
 * Responsabilidades:
 *  - Micro-KPIs de tesorería (por pagar / en espera / desembolsado).
 *  - Pestañas Pendientes · En revisión · Historial con sus paneles.
 *  - Aprobación manual de desembolsos con bloqueo fiscal (RUT + PILA del mes).
 *  - Reverso auditado de un payout (asientos contrarios, nunca borrado).
 *
 * El shell solo necesita: `render(stage)` y `refresh()`.
 */
import { DB } from '../db.js';
import type { LedgerEntry, Payout, Scout, Host } from '../db.js';
import { RondaB2BEngine } from '../b2b-engine.js';
import { RondaDialog } from '../dialog.js';
import { Auth } from '../auth.js';
import { escapeHtml } from '../utils.js';
import type { PanelContext, SuperAdminPanel } from './context.js';

export class TreasuryPanel implements SuperAdminPanel {
  private readonly engine = new RondaB2BEngine();
  private entries: LedgerEntry[] = [];
  private payouts: Payout[] = [];
  private readonly payeeNames = new Map<string, string>();
  private modalEntries: LedgerEntry[] = [];
  private modalPayee = '';
  private reverseTarget: Payout | null = null;
  private modalsInjected = false;

  constructor(private readonly context: PanelContext) {}

  async render(stage: HTMLElement): Promise<void> {
    this.ensureModals();
    stage.innerHTML = this.shell();
    this.bindContent();
    await this.load();
  }

  async refresh(): Promise<void> {
    await this.load();
  }

  // ==========================================================================
  // Plantilla del módulo
  // ==========================================================================
  private shell(): string {
    return `
      <div style="display:flex; flex-direction:column; gap:18px;">

        <!-- Micro-KPIs de tesorería -->
        <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(200px, 1fr)); gap:12px;">
          <div class="sa-kpi-card" style="border-color:rgba(121,211,172,0.25);">
            <span style="font-size:10px; font-family:var(--font-mono); color:var(--humo); text-transform:uppercase; display:block;">Por Pagar</span>
            <b id="sa-kpi-liq-pending" style="font-size:22px; color:#79D3AC; font-family:var(--font-display); display:block; margin-top:4px;">$0</b>
            <span id="sa-badge-liq-pending" style="font-size:10.5px; color:var(--humo); font-family:var(--font-mono);">0 asientos</span>
          </div>
          <div class="sa-kpi-card" style="border-color:rgba(240,168,48,0.25);">
            <span style="font-size:10px; font-family:var(--font-mono); color:var(--humo); text-transform:uppercase; display:block;">En Espera</span>
            <b id="sa-kpi-liq-held" style="font-size:22px; color:var(--luz); font-family:var(--font-display); display:block; margin-top:4px;">$0</b>
            <span id="sa-badge-liq-held" style="font-size:10.5px; color:var(--humo); font-family:var(--font-mono);">0 en revisión</span>
          </div>
          <div class="sa-kpi-card">
            <span style="font-size:10px; font-family:var(--font-mono); color:var(--humo); text-transform:uppercase; display:block;">Desembolsado</span>
            <b id="sa-kpi-liq-paid" style="font-size:22px; color:var(--papel); font-family:var(--font-display); display:block; margin-top:4px;">$0</b>
            <span id="sa-badge-liq-paid" style="font-size:10.5px; color:var(--humo); font-family:var(--font-mono);">0 giros</span>
          </div>
        </div>

        <!-- Consola de liquidaciones -->
        <section class="sa-panel-card" style="display:flex; flex-direction:column; gap:16px;">
          <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:12px; flex-wrap:wrap;">
            <div>
              <h4 style="font-family:var(--font-display); font-size:17px; color:var(--papel); margin:0;">💸 Comisiones y desembolsos</h4>
              <p style="font-size:12px; color:var(--humo); margin:4px 0 0;">Comisiones devengadas para Scouts de expansión y Hosters de sala.</p>
            </div>
            <span style="font-size:10px; font-family:var(--font-mono); color:var(--humo); border:1px solid var(--linea); border-radius:999px; padding:4px 10px; white-space:nowrap;">
              Ledger MEM-RR
            </span>
          </div>

          <!-- Pestañas -->
          <div style="display:flex; background:rgba(0,0,0,0.35); border:1px solid var(--linea); border-radius:10px; padding:3px; gap:4px;">
            <button class="sa-liq-tab-btn active" data-tab="pending" style="flex:1; background:rgba(240,168,48,0.18); border:1px solid rgba(240,168,48,0.35); color:var(--papel); font-size:11px; font-weight:700; padding:6px 8px; border-radius:7px; cursor:pointer; font-family:var(--font-body); transition:all 0.2s;">
              📥 Pendientes (<span id="sa-tab-cnt-pending">0</span>)
            </button>
            <button class="sa-liq-tab-btn" data-tab="held" style="flex:1; background:transparent; border:1px solid transparent; color:var(--humo); font-size:11px; font-weight:500; padding:6px 8px; border-radius:7px; cursor:pointer; font-family:var(--font-body); transition:all 0.2s;">
              ⏳ En Revisión (<span id="sa-tab-cnt-held">0</span>)
            </button>
            <button class="sa-liq-tab-btn" data-tab="history" style="flex:1; background:transparent; border:1px solid transparent; color:var(--humo); font-size:11px; font-weight:500; padding:6px 8px; border-radius:7px; cursor:pointer; font-family:var(--font-body); transition:all 0.2s;">
              📜 Historial (<span id="sa-tab-cnt-history">0</span>)
            </button>
          </div>

          <!-- Paneles -->
          <div id="sa-liq-pane-pending" class="sa-liq-pane" style="display:flex; flex-direction:column; gap:10px; min-height:150px;">
            <div id="sa-liq-pending" style="display:flex; flex-direction:column; gap:10px;">
              <p style="font-size:12px; color:var(--humo);">Cargando ledger…</p>
            </div>
          </div>

          <div id="sa-liq-pane-held" class="sa-liq-pane" style="display:none; flex-direction:column; gap:10px; min-height:150px;">
            <div id="sa-liq-held" style="display:flex; flex-direction:column; gap:8px;">
              <p style="font-size:12px; color:var(--humo);">Cargando ledger…</p>
            </div>
          </div>

          <div id="sa-liq-pane-history" class="sa-liq-pane" style="display:none; flex-direction:column; gap:10px; min-height:150px;">
            <div id="sa-liq-history" style="display:flex; flex-direction:column; gap:8px;">
              <p style="font-size:12px; color:var(--humo);">Cargando historial…</p>
            </div>
          </div>

          <!-- Cumplimiento fiscal -->
          <div style="display:flex; justify-content:space-between; align-items:center; gap:10px; background:rgba(240,168,48,0.05); border:1px dashed rgba(240,168,48,0.25); border-radius:10px; padding:10px 14px; flex-wrap:wrap;">
            <div style="display:flex; align-items:center; gap:8px;">
              <span style="font-size:13px;">🛡️</span>
              <span style="font-size:10.5px; color:var(--humo); font-family:var(--font-mono);">
                Validación obligatoria: <b>RUT activo</b> + <b>PILA del mes</b>.
              </span>
            </div>
            <button class="btn" id="sa-btn-goto-people" style="font-size:10px; padding:4px 10px; background:rgba(243,237,226,0.06); border-color:var(--linea); color:var(--papel); white-space:nowrap; flex:0 0 auto; width:auto;">
              👥 Ver Agentes
            </button>
          </div>
        </section>

      </div>
    `;
  }

  private bindContent(): void {
    // Pestañas interactivas
    document.querySelectorAll<HTMLElement>('.sa-liq-tab-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const targetTab = btn.getAttribute('data-tab');
        document.querySelectorAll<HTMLElement>('.sa-liq-tab-btn').forEach((b) => {
          const isActive = b.getAttribute('data-tab') === targetTab;
          b.classList.toggle('active', isActive);
          b.style.background = isActive ? 'rgba(240,168,48,0.18)' : 'transparent';
          b.style.borderColor = isActive ? 'rgba(240,168,48,0.35)' : 'transparent';
          b.style.color = isActive ? 'var(--papel)' : 'var(--humo)';
          b.style.fontWeight = isActive ? '700' : '500';
        });

        const panes: Record<string, HTMLElement | null> = {
          pending: document.getElementById('sa-liq-pane-pending'),
          held: document.getElementById('sa-liq-pane-held'),
          history: document.getElementById('sa-liq-pane-history'),
        };
        Object.entries(panes).forEach(([key, el]) => {
          if (el) el.style.display = key === targetTab ? 'flex' : 'none';
        });
      });
    });

    // Acceso directo a gestión de Scouts & Hosters
    document.getElementById('sa-btn-goto-people')?.addEventListener('click', () => {
      this.context.navigate('users');
      // El shell monta la sección en el siguiente tick: abrimos el alta de agentes.
      setTimeout(() => {
        const panel = document.getElementById('sa-people-panel');
        if (panel) panel.style.display = 'block';
      }, 100);
    });
  }

  // ==========================================================================
  // Carga de datos
  // ==========================================================================
  private formatCop(n: number): string {
    return '$' + Number(n || 0).toLocaleString('es-CO');
  }

  private currentBogotaMonth(): string {
    try {
      const iso = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Bogota', year: 'numeric', month: '2-digit', day: '2-digit' });
      return String(iso).slice(0, 7);
    } catch {
      const d = new Date();
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    }
  }

  private isPilaCurrent(pilaVerified?: boolean, pilaPeriod?: string): boolean {
    return !!pilaVerified && pilaPeriod === this.currentBogotaMonth();
  }

  private liqCountdown(iso?: string): string {
    if (!iso) return 'sin fecha de liberación';
    const diff = new Date(iso).getTime() - Date.now();
    if (!Number.isFinite(diff)) return 'fecha inválida';
    if (diff <= 0) return 'liberable ahora';
    const d = Math.floor(diff / 86400000);
    const h = Math.floor((diff % 86400000) / 3600000);
    return d > 0 ? `disponible en ${d}d ${h}h` : `disponible en ${h}h`;
  }

  private async load(): Promise<void> {
    const btn = document.getElementById('sa-liq-refresh') as HTMLButtonElement | null;
    if (btn) { btn.disabled = true; btn.textContent = '↻ Cargando…'; }
    try {
      const [entries, payouts, scouts, hosts] = await Promise.all([
        DB.getLedgerEntries(),
        DB.getPayouts(),
        DB.getScouts().catch(() => [] as Scout[]),
        DB.getHosts().catch(() => [] as Host[]),
      ]);
      this.entries = entries || [];
      this.payouts = (payouts || []).slice().sort((a, b) =>
        String(b.reconciled_at || b.createdAt || '').localeCompare(String(a.reconciled_at || a.createdAt || '')));
      this.payeeNames.clear();
      for (const s of scouts) this.payeeNames.set(s.uid, s.name || s.email || s.uid);
      for (const h of hosts) if (!this.payeeNames.has(h.uid)) this.payeeNames.set(h.uid, h.name || h.email || h.uid);
      this.renderLiquidations();
    } catch (err) {
      console.error('[TreasuryPanel] Error cargando liquidaciones:', err);
      const pend = document.getElementById('sa-liq-pending');
      if (pend) pend.innerHTML = `<p style="font-size:12px; color:var(--vino);">⚠️ No se pudo cargar el ledger.</p>`;
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = '↻ Actualizar'; }
    }
  }

  private emptyState(icon: string, title: string, hint: string, borderColor: string): string {
    return `
      <div style="text-align:center; padding:26px 16px; background:rgba(243,237,226,0.02); border:1px solid ${borderColor}; border-radius:12px;">
        <span style="font-size:24px; display:block; margin-bottom:6px;">${icon}</span>
        <b style="color:var(--papel); font-size:13px; display:block;">${title}</b>
        <span style="font-size:11px; color:var(--humo); display:block; margin-top:2px;">${hint}</span>
      </div>
    `;
  }

  private renderLiquidations(): void {
    const pendEl = document.getElementById('sa-liq-pending');
    const heldEl = document.getElementById('sa-liq-held');
    const histEl = document.getElementById('sa-liq-history');
    if (!pendEl || !heldEl || !histEl) return;

    const pending = this.entries.filter((e) => e.status === 'payable');
    const held = this.entries.filter((e) => e.status === 'accrued' || e.status === 'review');
    const totalPend = pending.reduce((s, e) => s + (e.amount_gross_cop || 0), 0);
    const totalHeld = held.reduce((s, e) => s + (e.amount_gross_cop || 0), 0);
    const totalPaid = this.payouts.reduce((s, p) => s + (p.gross_cop || 0), 0);

    // Micro-KPIs superiores
    const kpiPend = document.getElementById('sa-kpi-liq-pending');
    const badgePend = document.getElementById('sa-badge-liq-pending');
    const kpiHeld = document.getElementById('sa-kpi-liq-held');
    const badgeHeld = document.getElementById('sa-badge-liq-held');
    const kpiPaid = document.getElementById('sa-kpi-liq-paid');
    const badgePaid = document.getElementById('sa-badge-liq-paid');

    if (kpiPend) kpiPend.textContent = this.formatCop(totalPend);
    if (badgePend) badgePend.textContent = `${pending.length} asiento${pending.length === 1 ? '' : 's'}`;
    if (kpiHeld) kpiHeld.textContent = this.formatCop(totalHeld);
    if (badgeHeld) badgeHeld.textContent = `${held.length} en espera`;
    if (kpiPaid) kpiPaid.textContent = this.formatCop(totalPaid);
    if (badgePaid) badgePaid.textContent = `${this.payouts.length} giro${this.payouts.length === 1 ? '' : 's'}`;

    // Contadores de las pestañas
    const tabCntPend = document.getElementById('sa-tab-cnt-pending');
    const tabCntHeld = document.getElementById('sa-tab-cnt-held');
    const tabCntHist = document.getElementById('sa-tab-cnt-history');
    if (tabCntPend) tabCntPend.textContent = String(pending.length);
    if (tabCntHeld) tabCntHeld.textContent = String(held.length);
    if (tabCntHist) tabCntHist.textContent = String(this.payouts.length);

    // 1. Pendientes por pagar (agrupados por payee)
    if (pending.length === 0) {
      pendEl.innerHTML = this.emptyState('✨', 'Tesorería al Día', 'No hay comisiones pendientes de desembolso en este momento.', 'rgba(121,211,172,0.18)');
    } else {
      const byPayee = new Map<string, LedgerEntry[]>();
      for (const e of pending) {
        const arr = byPayee.get(e.payee_uid) || [];
        arr.push(e);
        byPayee.set(e.payee_uid, arr);
      }
      pendEl.innerHTML = [...byPayee.entries()].map(([uid, arr]) => {
        const total = arr.reduce((s, e) => s + (e.amount_gross_cop || 0), 0);
        const name = escapeHtml(this.payeeNames.get(uid) || uid);
        const tipo = arr[0]?.payee_type === 'host' ? 'hoster' : 'scout';
        const rows = arr.map((e) => `<div style="border-top:1px dashed var(--linea); padding:6px 0;">
          <div style="display:flex; justify-content:space-between; gap:8px; font-size:11px; font-family:var(--font-mono); color:var(--humo);">
            <span>${escapeHtml(e.milestone)} · ${escapeHtml(e.lead_id || e.venue_id || e.id)}</span>
            <span style="color:var(--papel); font-weight:700;">${this.formatCop(e.amount_gross_cop)}</span>
          </div>
          <div style="font-size:10.5px; color:var(--humo);">${escapeHtml(e.reason || '')}${e.payable_after ? ` · ⏳ ${escapeHtml(this.liqCountdown(e.payable_after))}` : ''}</div>
        </div>`).join('');
        return `<div style="border:1px solid var(--linea); border-radius:12px; padding:14px; background:rgba(243,237,226,.03);">
          <div style="display:flex; justify-content:space-between; align-items:center; gap:8px; flex-wrap:wrap; margin-bottom:6px;">
            <div>
              <b style="color:var(--papel); font-size:13px;">${name}</b>
              <span style="font-size:10px; color:var(--humo); font-family:var(--font-mono); margin-left:8px;">${tipo} · ${arr.length} asientos</span>
            </div>
            <b style="color:var(--luz); font-family:var(--font-mono);">${this.formatCop(total)}</b>
          </div>${rows}
          <button class="btn ambar sa-liq-approve" data-payee="${escapeHtml(uid)}" style="font-size:11px; padding:9px 14px; font-weight:700; margin-top:10px; flex:0 0 auto; width:auto;">💸 Aprobar desembolso</button>
        </div>`;
      }).join('');
      pendEl.querySelectorAll('.sa-liq-approve').forEach((b) =>
        b.addEventListener('click', () => void this.openPayoutModal((b as HTMLElement).getAttribute('data-payee') || '')));
    }

    // 2. En revisión / custodia
    if (held.length === 0) {
      heldEl.innerHTML = this.emptyState('⏳', 'Sin Asientos en Custodia', 'Todas las comisiones devengadas han completado su maduración.', 'var(--linea)');
    } else {
      heldEl.innerHTML = held.map((e) => {
        const name = escapeHtml(this.payeeNames.get(e.payee_uid) || e.payee_uid);
        return `<div style="display:flex; justify-content:space-between; gap:8px; font-size:11.5px; color:var(--humo); border:1px dashed var(--linea); border-radius:10px; padding:10px 12px;">
          <span><b style="color:var(--papel);">${name}</b> · ${escapeHtml(e.milestone)} · ${escapeHtml(e.status)}<br/>
          <span style="font-family:var(--font-mono); font-size:10.5px;">⏳ ${escapeHtml(this.liqCountdown(e.payable_after))}${e.payable_after ? ` (${escapeHtml(e.payable_after)})` : ''}</span></span>
          <b style="color:var(--papel); font-family:var(--font-mono); white-space:nowrap;">${this.formatCop(e.amount_gross_cop)}</b>
        </div>`;
      }).join('');
    }

    // 3. Historial de desembolsos
    if (this.payouts.length === 0) {
      histEl.innerHTML = this.emptyState('📜', 'Sin Giros Registrados', 'Los desembolsos aprobados aparecerán aquí con su referencia bancaria.', 'var(--linea)');
    } else {
      histEl.innerHTML = this.payouts.map((p) => {
        const name = escapeHtml(this.payeeNames.get(p.payee_uid) || p.payee_uid);
        return `<div style="display:flex; justify-content:space-between; align-items:center; gap:8px; font-size:11.5px; color:var(--humo); border:1px solid var(--linea); border-radius:10px; padding:10px 12px; background:rgba(46,107,84,.07);">
          <span><b style="color:var(--papel);">${name}</b> · ${this.formatCop(p.gross_cop)} · ref <b style="font-family:var(--font-mono);">${escapeHtml(p.transfer_reference || '—')}</b><br/>
          <span style="font-family:var(--font-mono); font-size:10.5px;">${escapeHtml(p.reconciled_at || p.createdAt || '')} · ${p.ledger_entry_ids.length} asientos</span></span>
          <button class="btn sa-liq-reverse" data-payout="${escapeHtml(p.id)}" style="font-size:10.5px; padding:7px 12px; border-color:var(--vino); white-space:nowrap;">↩️ Reversar</button>
        </div>`;
      }).join('');
      histEl.querySelectorAll('.sa-liq-reverse').forEach((b) =>
        b.addEventListener('click', () => this.openReverseModal((b as HTMLElement).getAttribute('data-payout') || '')));
    }
  }

  // ==========================================================================
  // Modales (desembolso y reverso)
  // ==========================================================================
  private ensureModals(): void {
    if (this.modalsInjected) return;
    this.modalsInjected = true;

    if (!document.getElementById('sa-payout-overlay')) {
      const wrapper = document.createElement('div');
      wrapper.innerHTML = `
        <!-- Modal Aprobar Desembolso B2B -->
        <div id="sa-payout-overlay" style="display:none; position:fixed; inset:0; z-index:10001; background:rgba(10,7,14,0.88); backdrop-filter:blur(8px); padding:16px; align-items:center; justify-content:center;">
          <div style="background: rgba(22,16,27,0.98); border: 1px solid var(--linea); border-radius: 18px; width:100%; max-width:480px; max-height:88vh; overflow-y:auto; padding: 24px 22px;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:14px;">
              <h4 style="font-family: var(--font-display); font-size:18px; color:var(--papel); margin:0;">💸 Aprobar desembolso</h4>
              <button id="sa-payout-close" style="background:none; border:none; color:var(--humo); font-size:20px; cursor:pointer;" title="Cerrar">✕</button>
            </div>
            <div id="sa-payout-summary" style="font-size:12.5px; color:var(--humo); line-height:1.55; margin-bottom:16px;"></div>
            <div style="display:flex; flex-direction:column; gap:10px; margin-bottom:16px; background:rgba(243,237,226,0.04); border:1px dashed var(--linea); border-radius:10px; padding:14px;">
              <label style="display:flex; align-items:center; gap:8px; font-size:12px; color:var(--papel); cursor:pointer;">
                <input type="checkbox" id="sa-payout-rut"> RUT verificado
              </label>
              <label style="display:flex; align-items:center; gap:8px; font-size:12px; color:var(--papel); cursor:pointer;">
                <input type="checkbox" id="sa-payout-pila"> PILA del mes vigente verificada
              </label>
              <label style="display:flex; align-items:center; gap:8px; font-size:12px; color:var(--papel); cursor:pointer;">
                <input type="checkbox" id="sa-payout-bank"> Cuenta bancaria / Nequi a nombre del titular
              </label>
            </div>
            <input id="sa-payout-ref" class="ronda-input" placeholder="Referencia de transferencia (requerida)" style="width:100%; box-sizing:border-box; margin-bottom:14px;">
            <p id="sa-payout-taxwarn" style="display:none; font-size:11px; color:#ff8ca8; margin:-8px 0 12px;"></p>
            <button id="sa-payout-confirm" class="btn ambar" disabled style="width:100%; padding:12px; font-size:13px; font-weight:700; opacity:0.5; cursor:not-allowed;">Aprobar desembolso</button>
          </div>
        </div>

        <!-- Modal Motivo de Reverso -->
        <div id="sa-reverse-overlay" style="display:none; position:fixed; inset:0; z-index:10001; background:rgba(10,7,14,0.88); backdrop-filter:blur(8px); padding:16px; align-items:center; justify-content:center;">
          <div style="background: rgba(22,16,27,0.98); border: 1px solid var(--vino); border-radius: 18px; width:100%; max-width:440px; padding: 24px 22px;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
              <h4 style="font-family: var(--font-display); font-size:18px; color:var(--papel); margin:0;">↩️ Reversar desembolso</h4>
              <button id="sa-reverse-close" style="background:none; border:none; color:var(--humo); font-size:20px; cursor:pointer;">✕</button>
            </div>
            <p id="sa-reverse-info" style="font-size:12px; color:var(--humo); margin-bottom:12px;"></p>
            <textarea id="sa-reverse-reason" class="ronda-input" placeholder="Motivo del reverso (obligatorio)…" rows="3" style="width:100%; box-sizing:border-box; margin-bottom:14px; resize:vertical;"></textarea>
            <div style="display:flex; gap:10px;">
              <button id="sa-reverse-cancel" class="btn" style="flex:1; padding:10px; font-size:12px; background:rgba(243,237,226,0.05); border-color:var(--linea);">Cancelar</button>
              <button id="sa-reverse-confirm" class="btn" disabled style="flex:1; padding:10px; font-size:12px; background:var(--vino); border-color:var(--vino); color:#fff; opacity:0.5; cursor:not-allowed;">Generar reverso</button>
            </div>
          </div>
        </div>
      `;
      document.body.appendChild(wrapper);
    }

    // Listeners del modal de desembolso
    document.getElementById('sa-payout-close')?.addEventListener('click', () => this.closePayoutModal());
    ['sa-payout-rut', 'sa-payout-pila', 'sa-payout-bank'].forEach((id) =>
      document.getElementById(id)?.addEventListener('change', () => this.validatePayoutForm()));
    document.getElementById('sa-payout-ref')?.addEventListener('input', () => this.validatePayoutForm());
    document.getElementById('sa-payout-confirm')?.addEventListener('click', () => void this.confirmPayout());

    // Listeners del modal de reverso
    document.getElementById('sa-reverse-close')?.addEventListener('click', () => this.closeReverseModal());
    document.getElementById('sa-reverse-cancel')?.addEventListener('click', () => this.closeReverseModal());
    document.getElementById('sa-reverse-reason')?.addEventListener('input', () => this.validateReverseForm());
    document.getElementById('sa-reverse-confirm')?.addEventListener('click', () => void this.confirmReverse());
  }

  private async openPayoutModal(payeeUid: string): Promise<void> {
    this.modalPayee = payeeUid;
    this.modalEntries = this.entries.filter((e) => e.payee_uid === payeeUid && e.status === 'payable');
    const overlay = document.getElementById('sa-payout-overlay');
    const summary = document.getElementById('sa-payout-summary');
    if (!overlay || !summary) return;
    const total = this.modalEntries.reduce((s, e) => s + (e.amount_gross_cop || 0), 0);
    const name = this.payeeNames.get(payeeUid) || payeeUid;
    const tipo = this.modalEntries[0]?.payee_type === 'host' ? 'hoster' : 'scout';
    summary.innerHTML = `<b style="color:var(--papel);">${escapeHtml(name)}</b> <span style="font-family:var(--font-mono); font-size:11px;">(${tipo})</span><br/>
      Total bruto: <b style="color:var(--luz); font-family:var(--font-mono);">${this.formatCop(total)}</b> · ${this.modalEntries.length} asientos incluidos.`;
    for (const id of ['sa-payout-rut', 'sa-payout-pila', 'sa-payout-bank']) {
      const input = document.getElementById(id) as HTMLInputElement | null;
      if (input) input.checked = false;
    }
    const refInput = document.getElementById('sa-payout-ref') as HTMLInputElement | null;
    if (refInput) refInput.value = '';
    const warn = document.getElementById('sa-payout-taxwarn');
    if (warn) warn.style.display = 'none';
    overlay.style.display = 'flex';
    this.validatePayoutForm();
    overlay.scrollTop = 0;
  }

  private closePayoutModal(): void {
    const overlay = document.getElementById('sa-payout-overlay');
    if (overlay) overlay.style.display = 'none';
    this.modalEntries = [];
    this.modalPayee = '';
  }

  private validatePayoutForm(): void {
    const rut = (document.getElementById('sa-payout-rut') as HTMLInputElement | null)?.checked === true;
    const pila = (document.getElementById('sa-payout-pila') as HTMLInputElement | null)?.checked === true;
    const bank = (document.getElementById('sa-payout-bank') as HTMLInputElement | null)?.checked === true;
    const ref = ((document.getElementById('sa-payout-ref') as HTMLInputElement | null)?.value || '').trim();
    const btn = document.getElementById('sa-payout-confirm') as HTMLButtonElement | null;
    const ok = rut && pila && bank && ref.length > 0 && this.modalEntries.length > 0;
    if (btn) {
      btn.disabled = !ok;
      btn.style.opacity = ok ? '1' : '0.5';
      btn.style.cursor = ok ? 'pointer' : 'not-allowed';
    }
  }

  private async resolveTaxProfile(payeeUid: string, payeeType?: string): Promise<{ rutVerified: boolean; pilaVerified: boolean; pilaPeriod?: string }> {
    try {
      const profile = payeeType === 'host' ? await DB.getHost(payeeUid) : await DB.getScout(payeeUid);
      if (profile) return { rutVerified: !!profile.rutVerified, pilaVerified: !!profile.pilaVerified, pilaPeriod: profile.pilaPeriod };
      const other = payeeType === 'host' ? await DB.getScout(payeeUid) : await DB.getHost(payeeUid);
      if (other) return { rutVerified: !!other.rutVerified, pilaVerified: !!other.pilaVerified, pilaPeriod: other.pilaPeriod };
    } catch (e) {
      console.warn('[TreasuryPanel] No se pudo leer perfil fiscal:', e);
    }
    return { rutVerified: false, pilaVerified: false };
  }

  private async confirmPayout(): Promise<void> {
    const btn = document.getElementById('sa-payout-confirm') as HTMLButtonElement | null;
    const ref = ((document.getElementById('sa-payout-ref') as HTMLInputElement | null)?.value || '').trim();
    const warn = document.getElementById('sa-payout-taxwarn');
    if (this.modalEntries.length === 0 || !ref) return;
    const approverUid = Auth.currentUser?.uid || 'superadmin';
    if (btn) { btn.disabled = true; btn.textContent = 'Procesando…'; }
    try {
      const taxProfile = await this.resolveTaxProfile(this.modalPayee, this.modalEntries[0]?.payee_type);
      if (warn) warn.style.display = 'none';
      if (!taxProfile.rutVerified || !this.isPilaCurrent(taxProfile.pilaVerified, taxProfile.pilaPeriod)) {
        if (warn) {
          warn.textContent = '⛔ Sin RUT/PILA vigentes no podemos aprobar este pago. Actualiza el perfil fiscal en Usuarios y permisos.';
          warn.style.display = 'block';
        }
        await RondaDialog.alert({ title: 'Bloqueo fiscal', message: 'Sin RUT/PILA vigentes no podemos aprobar este pago.', icon: '⛔', type: 'danger' });
        return;
      }
      const alreadyPaid = this.modalEntries.some((e) => e.status === 'paid' || !!e.payout_id);
      if (alreadyPaid) {
        await RondaDialog.alert({ title: 'Ya liquidado', message: 'Uno o más asientos ya fueron pagados. Recargando el ledger…', icon: 'ℹ️' });
        this.closePayoutModal();
        await this.load();
        return;
      }
      const { payout, updatedEntries } = this.engine.approvePayout(
        this.modalEntries, approverUid, 'superadmin', ref, true,
        { rutVerified: taxProfile.rutVerified, pilaVerified: this.isPilaCurrent(taxProfile.pilaVerified, taxProfile.pilaPeriod) });
      await DB.savePayout(payout);
      for (const u of updatedEntries) await DB.saveLedgerEntry(u);
      await DB.logAudit({
        actor_uid: approverUid, actor_type: 'superadmin', entity_type: 'payout',
        entity_id: payout.id, action: 'payout_approved_reconciled',
        new_state: { payout_id: payout.id, gross_cop: payout.gross_cop, entries: payout.ledger_entry_ids, transfer_reference: ref },
        reason: 'Desembolso manual aprobado por superadmin', timestamp: new Date().toISOString(),
      });
      this.closePayoutModal();
      await this.load();
      await RondaDialog.alert({ title: 'Desembolso registrado 💸', message: `Payout <b>${escapeHtml(payout.id)}</b> conciliado por <b>${this.formatCop(payout.gross_cop)}</b> con ref <b>${escapeHtml(ref)}</b>.`, icon: '✅', html: true });
    } catch (err: any) {
      console.error('[TreasuryPanel] Error aprobando desembolso:', err);
      await RondaDialog.alert({ title: 'No se pudo aprobar', message: err?.message || String(err), icon: '⚠️', type: 'danger' });
    } finally {
      if (btn) { btn.textContent = 'Aprobar desembolso'; this.validatePayoutForm(); }
    }
  }

  private openReverseModal(payoutId: string): void {
    const p = this.payouts.find((x) => x.id === payoutId) || null;
    this.reverseTarget = p;
    const overlay = document.getElementById('sa-reverse-overlay');
    const info = document.getElementById('sa-reverse-info');
    const reason = document.getElementById('sa-reverse-reason') as HTMLTextAreaElement | null;
    if (!overlay || !p) return;
    if (info) info.innerHTML = `Payout <b style="font-family:var(--font-mono);">${escapeHtml(p.id)}</b> · ${this.formatCop(p.gross_cop)} · ${p.ledger_entry_ids.length} asientos. Se generará un asiento contrario <b>sin borrar</b> el original.`;
    if (reason) reason.value = '';
    overlay.style.display = 'flex';
    this.validateReverseForm();
  }

  private closeReverseModal(): void {
    const overlay = document.getElementById('sa-reverse-overlay');
    if (overlay) overlay.style.display = 'none';
    this.reverseTarget = null;
  }

  private validateReverseForm(): void {
    const reason = ((document.getElementById('sa-reverse-reason') as HTMLTextAreaElement | null)?.value || '').trim();
    const btn = document.getElementById('sa-reverse-confirm') as HTMLButtonElement | null;
    const ok = !!this.reverseTarget && reason.length >= 5;
    if (btn) {
      btn.disabled = !ok;
      btn.style.opacity = ok ? '1' : '0.5';
      btn.style.cursor = ok ? 'pointer' : 'not-allowed';
    }
  }

  private async confirmReverse(): Promise<void> {
    const reason = ((document.getElementById('sa-reverse-reason') as HTMLTextAreaElement | null)?.value || '').trim();
    const btn = document.getElementById('sa-reverse-confirm') as HTMLButtonElement | null;
    const target = this.reverseTarget;
    if (!target || reason.length < 5) return;
    const authorizer = Auth.currentUser?.uid || 'superadmin';
    if (btn) { btn.disabled = true; btn.textContent = 'Generando…'; }
    try {
      const entriesById = new Map(this.entries.map((e) => [e.id, e]));
      let created = 0;
      for (const entryId of target.ledger_entry_ids) {
        const orig = entriesById.get(entryId);
        if (!orig) continue;
        const reversal = this.engine.processReversal(orig, reason, authorizer);
        const exists = this.entries.some((e) => e.idempotency_key === reversal.idempotency_key);
        if (exists) continue;
        await DB.saveLedgerEntry(reversal);
        created += 1;
      }
      await DB.logAudit({
        actor_uid: authorizer, actor_type: 'superadmin', entity_type: 'payout',
        entity_id: target.id, action: 'payout_reversed',
        new_state: { reversed_entries: created, reason }, timestamp: new Date().toISOString(),
        reason,
      });
      this.closeReverseModal();
      await this.load();
      await RondaDialog.alert({ title: 'Reverso generado ↩️', message: `Se crearon <b>${created}</b> asientos contrarios enlazados al payout. El original se conserva.`, icon: '✅', html: true });
    } catch (err: any) {
      console.error('[TreasuryPanel] Error generando reverso:', err);
      await RondaDialog.alert({ title: 'No se pudo reversar', message: err?.message || String(err), icon: '⚠️', type: 'danger' });
    } finally {
      if (btn) { btn.textContent = 'Generar reverso'; this.validateReverseForm(); }
    }
  }
}
