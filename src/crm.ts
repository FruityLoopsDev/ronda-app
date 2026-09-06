import { DB, Lead } from './db.js';
import { RondaDialog } from './dialog.js';

export class CRMController {
  private leads: Lead[] = [];
  private currentSalesUid: string = 'sales1';

  constructor() {}

  async init(salesUid?: string) {
    console.log('[CRMController] Inicializando CRM de Ventas...');
    this.currentSalesUid = salesUid || 'sales1';
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

    this.leads.forEach(lead => {
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

      card.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 6px;">
          <b style="font-family: var(--font-display); font-size: 15px; color: var(--papel);">${lead.name}</b>
          <span class="chip ambar" style="font-size: 9px; padding: 2px 6px;">+$${commFormatted}</span>
        </div>
        <p style="font-size: 11.5px; color: var(--humo); font-family: var(--font-mono); margin: 0 0 10px;">👤 Contacto: ${lead.contactName}</p>
        
        <!-- Acciones rápidas de movimiento -->
        <div style="display: flex; gap: 6px; justify-content: flex-end; border-top: 1px dashed var(--linea); padding-top: 8px;">
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
            <span style="font-size: 10.5px; color: var(--botella); font-family: var(--font-mono); font-weight: 700;">✓ Comisión Asegurada</span>
          `}
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
        message: `¡Felicitaciones! Has afiliado exitosamente a ${lead.name} a la red RONDA.\nComisión fija acumulada: +$${(lead.commission || 500000).toLocaleString('es-CO')} COP.`,
        icon: '💵'
      });
    }
  }

  addNewLead(name: string, contactName: string, commission: number = 500000) {
    const newLead: Lead = {
      id: 'lead_' + Date.now(),
      name,
      contactName,
      status: 'lead',
      sales_uid: this.currentSalesUid,
      commission
    };

    this.leads.push(newLead);
    if (DB.memoryDb?.leads) {
      DB.memoryDb.leads[newLead.id] = newLead;
    }
    this.render();
  }
}

export const CRM = new CRMController();
