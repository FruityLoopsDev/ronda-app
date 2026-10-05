import { DB, User } from './db.js';
import { RondaDialog } from './dialog.js';
import { Auth } from './auth.js';
import { collection, query, where, getDocs, doc, getDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import { RondaServices } from './firebase-config.js';

export interface KycReviewCase {
  reviewId: string;
  userId: string;
  userName: string;
  userEmail: string;
  registeredBirthDate: string;
  createdAt: string;
  status: 'pending' | 'approved' | 'rejected';
  reasonsForManual: string[];
  metrics: { faceDistance: number; livenessScore: number; ocrExtractedName?: string; ocrExtractedNumber?: string };
  imageUrls: { selfie: string; docFront: string; docBack?: string };
  reviewedBy?: string;
  reviewedAt?: string;
  adminNotes?: string;
}

export class SuperAdminController {
  constructor() {}

  async init() {
    console.log('[SuperAdminController] Inicializando Super Admin Dashboard...');
    this.render();
    this.setupListeners();
  }

  render() {
    const container = document.getElementById('superadmin-content');
    if (!container) return;

    const venuesCount = Object.keys(DB.memoryDb?.venues || {}).length || 6;

    container.innerHTML = `
      <div style="display: flex; flex-direction: column; gap: 24px;">
        
        <!-- Header & Quick Metrics -->
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 14px;">
          <div style="background: rgba(243,237,226,0.05); border: 1px solid var(--linea); border-radius: 14px; padding: 18px;">
            <span style="font-size: 11px; color: var(--humo); font-family: var(--font-mono); text-transform: uppercase;">🎟️ Línea 1: Tickets B2C</span>
            <b style="font-size: 26px; color: var(--papel); font-family: var(--font-display); display: block; margin-top: 4px;">$12.450.000</b>
            <span style="font-size: 10px; color: var(--botella); font-family: var(--font-mono);">+18% vs semana anterior</span>
          </div>

          <div style="background: rgba(243,237,226,0.05); border: 1px solid var(--linea); border-radius: 14px; padding: 18px;">
            <span style="font-size: 11px; color: var(--humo); font-family: var(--font-mono); text-transform: uppercase;">🏢 Línea 2: SaaS Bares B2B</span>
            <b style="font-size: 26px; color: var(--luz); font-family: var(--font-display); display: block; margin-top: 4px;">$3.800.000</b>
            <span style="font-size: 10px; color: var(--humo); font-family: var(--font-mono);">${venuesCount} locales bajo suscripción</span>
          </div>

          <div style="background: rgba(243,237,226,0.05); border: 1px solid var(--linea); border-radius: 14px; padding: 18px;">
            <span style="font-size: 11px; color: var(--humo); font-family: var(--font-mono); text-transform: uppercase;">📊 Línea 3: Data Insights</span>
            <b style="font-size: 26px; color: var(--papel); font-family: var(--font-display); display: block; margin-top: 4px;">$2.100.000</b>
            <span style="font-size: 10px; color: var(--luz); font-family: var(--font-mono);">Reportes B2B & Maridajes</span>
          </div>

          <div style="background: rgba(243,237,226,0.05); border: 1px solid var(--linea); border-radius: 14px; padding: 18px;">
            <span style="font-size: 11px; color: var(--humo); font-family: var(--font-mono); text-transform: uppercase;">🍸 Línea 4: Segunda Cita</span>
            <b style="font-size: 26px; color: #ff8ca8; font-family: var(--font-display); display: block; margin-top: 4px;">$1.650.000</b>
            <span style="font-size: 10px; color: var(--humo); font-family: var(--font-mono);">Comisión por reservas -25%</span>
          </div>
        </div>

        <!-- Infrastructure & Security Health Status -->
        <div style="background: rgba(0,0,0,0.3); border: 1px solid var(--linea); border-radius: 16px; padding: 20px;">
          <h4 style="font-family: var(--font-display); font-size: 18px; color: var(--papel); margin: 0 0 14px;">⚡ Estado del Ecosistema RONDA</h4>
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 12px;">
            <div style="display: flex; align-items: center; gap: 10px; background: rgba(243,237,226,0.03); padding: 12px; border-radius: 10px; border: 1px solid var(--linea);">
              <span style="font-size: 20px;">🔥</span>
              <div>
                <b style="font-size: 12px; color: var(--papel); display: block;">Firebase Firestore</b>
                <span style="font-size: 10px; color: var(--botella); font-family: var(--font-mono);">● Operativo (v10)</span>
              </div>
            </div>

            <div style="display: flex; align-items: center; gap: 10px; background: rgba(243,237,226,0.03); padding: 12px; border-radius: 10px; border: 1px solid var(--linea);">
              <span style="font-size: 20px;">💚</span>
              <div>
                <b style="font-size: 12px; color: var(--papel); display: block;">Pagos Nequi</b>
                <span style="font-size: 10px; color: var(--botella); font-family: var(--font-mono);">● Enlace de cobro · verificación manual</span>
              </div>
            </div>

            <div style="display: flex; align-items: center; gap: 10px; background: rgba(243,237,226,0.03); padding: 12px; border-radius: 10px; border: 1px solid var(--linea);">
              <span style="font-size: 20px;">🛡️</span>
              <div>
                <b style="font-size: 12px; color: var(--papel); display: block;">Biometría & OCR</b>
                <span style="font-size: 10px; color: var(--botella); font-family: var(--font-mono);">● MediaPipe + Tesseract</span>
              </div>
            </div>

            <div style="display: flex; align-items: center; gap: 10px; background: rgba(243,237,226,0.03); padding: 12px; border-radius: 10px; border: 1px solid var(--linea);">
              <span style="font-size: 20px;">🔄</span>
              <div>
                <b style="font-size: 12px; color: var(--papel); display: block;">Motor Round-Robin</b>
                <span style="font-size: 10px; color: var(--botella); font-family: var(--font-mono);">● Algoritmo MEM-RR</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Role Administration & Fast Simulator -->
        <div style="background: rgba(240,168,48,0.08); border: 1px dashed rgba(240,168,48,0.35); border-radius: 16px; padding: 20px;">
          <h4 style="font-family: var(--font-display); font-size: 18px; color: var(--papel); margin: 0 0 6px;">👑 Simulador y Asignación de Roles</h4>
          <p style="font-size: 12px; color: var(--humo); margin: 0 0 16px;">
            Cambia el rol del usuario activo en memoria para probar de inmediato la experiencia de cualquier perfil sin reiniciar sesión:
          </p>
          <div style="display: flex; gap: 10px; flex-wrap: wrap;">
            <button class="btn ambar sa-set-role" data-role="superadmin" style="font-size: 11px; padding: 10px 16px; font-weight: 700;">👑 Rol: Super Admin</button>
            <button class="btn sa-set-role" data-role="sales" style="font-size: 11px; padding: 10px 16px; background: rgba(0,0,0,0.3); border-color: var(--luz); color: var(--luz);">💼 Rol: Vendedor (Sales)</button>
            <button class="btn sa-set-role" data-role="admin" style="font-size: 11px; padding: 10px 16px; background: rgba(0,0,0,0.3); border-color: var(--linea);">🏢 Rol: Anfitrión Bar</button>
            <button class="btn sa-set-role" data-role="client" style="font-size: 11px; padding: 10px 16px; background: rgba(0,0,0,0.3); border-color: var(--linea);">🍸 Rol: Cliente / Usuario</button>
          </div>
        </div>

        <!-- [C-4] Revisión KYC Pendiente (Administrador Central) -->
        <div style="background: rgba(0,0,0,0.35); border: 1px solid var(--linea); border-radius: 16px; padding: 20px;">
          <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:12px;">
            <h4 style="font-family: var(--font-display); font-size: 18px; color: var(--papel); margin: 0;">🛡️ Revisión KYC Pendiente</h4>
            <button class="btn" id="sa-kyc-refresh" style="font-size: 11px; padding: 8px 14px;">↻ Actualizar cola</button>
          </div>
          <p style="font-size: 12px; color: var(--humo); margin: 0 0 14px;">Casos <b>kycReviews / status == 'pending'</b>. Compara selfie vs documento, revisa la métrica facial y aprueba Tier 2 o rechaza con motivo.</p>
          <div id="sa-kyc-list" style="display: flex; flex-direction: column; gap: 14px;">
            <p style="font-size: 12px; color: var(--humo);">Cargando cola…</p>
          </div>
        </div>
      </div>
    `;

    this.attachListeners();
  }

  private escapeKyc(s: unknown): string {
    return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));
  }

  private async loadKycQueue(): Promise<void> {
    const list = document.getElementById('sa-kyc-list');
    if (!list) return;
    try {
      const q = query(collection(RondaServices.db, 'kycReviews'), where('status', '==', 'pending'));
      const snap = await getDocs(q);
      const cases: KycReviewCase[] = [];
      snap.forEach((d) => cases.push({ ...(d.data() as Omit<KycReviewCase, 'reviewId'>), reviewId: d.id }));
      if (cases.length === 0) {
        list.innerHTML = `<p style="font-size:12px;color:var(--botella);">✅ Sin casos pendientes.</p>`;
        return;
      }
      list.innerHTML = cases.map((c) => this.renderKycCard(c)).join('');
      list.querySelectorAll('.sa-kyc-approve').forEach((b) => b.addEventListener('click', (e) => {
        const btn = e.currentTarget as HTMLElement;
        void this.approveKycCase(btn.getAttribute('data-review') || '', btn.getAttribute('data-user') || '');
      }));
      list.querySelectorAll('.sa-kyc-reject').forEach((b) => b.addEventListener('click', (e) => {
        const btn = e.currentTarget as HTMLElement;
        void this.rejectKycCase(btn.getAttribute('data-review') || '');
      }));
    } catch (err) {
      console.error('[SuperAdmin] Error cargando kycReviews:', err);
      list.innerHTML = `<p style="font-size:12px;color:var(--vino);">⚠️ No se pudo cargar la cola KYC.</p>`;
    }
  }

  private renderKycCard(c: KycReviewCase): string {
    const dist = typeof c.metrics?.faceDistance === 'number' ? c.metrics.faceDistance : null;
    const sim = dist === null ? '—' : Math.max(0, Math.min(100, Math.round((1 - Math.min(dist, 1)) * 100))) + '%';
    const reasons = (c.reasonsForManual || []).map((r) => this.escapeKyc(r)).join(', ') || '—';
    const back = c.imageUrls?.docBack
      ? `<figure style="margin:0;"><figcaption style="font-size:10px;color:var(--humo);">DOC REVERSO</figcaption><img src="${c.imageUrls.docBack}" alt="reverso" style="width:100%;border-radius:8px;border:1px solid var(--linea);"/></figure>` : '';
    return `<article style="border:1px solid var(--linea);border-radius:12px;padding:14px;background:rgba(243,237,226,.03);">
      <div style="display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap;margin-bottom:10px;">
        <div><b style="color:var(--papel);font-size:13px;">${this.escapeKyc(c.userName || c.userId)}</b>
        <div style="font-size:11px;color:var(--humo);font-family:var(--font-mono);">${this.escapeKyc(c.userEmail || '')} · ${this.escapeKyc(c.createdAt || '')}</div>
        <div style="font-size:11px;color:var(--humo);">Motivos: ${reasons}</div></div>
        <div style="font-size:11px;color:var(--luz);font-family:var(--font-mono);text-align:right;">distancia: <b>${dist ?? '—'}</b><br/>similitud: <b>${sim}</b><br/>liveness: <b>${c.metrics?.livenessScore ?? '—'}</b></div>
      </div>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:10px;margin-bottom:10px;">
        <figure style="margin:0;"><figcaption style="font-size:10px;color:var(--humo);">SELFIE</figcaption><img src="${c.imageUrls?.selfie || ''}" alt="selfie" style="width:100%;border-radius:8px;border:1px solid var(--linea);"/></figure>
        <figure style="margin:0;"><figcaption style="font-size:10px;color:var(--humo);">DOC FRENTE</figcaption><img src="${c.imageUrls?.docFront || ''}" alt="frente" style="width:100%;border-radius:8px;border:1px solid var(--linea);"/></figure>
        ${back}
      </div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;">
        <button class="btn ambar sa-kyc-approve" data-review="${this.escapeKyc(c.reviewId)}" data-user="${this.escapeKyc(c.userId)}" style="font-size:11px;padding:9px 14px;font-weight:700;">✅ Aprobar Tier 2</button>
        <button class="btn sa-kyc-reject" data-review="${this.escapeKyc(c.reviewId)}" style="font-size:11px;padding:9px 14px;border-color:var(--vino);">✕ Rechazar</button>
      </div>
    </article>`;
  }

  private async approveKycCase(reviewId: string, userId: string): Promise<void> {
    if (!reviewId || !userId) return;
    try {
      const reviewer = Auth.currentUser?.uid || 'superadmin';
      const now = new Date().toISOString();
      const userRef = doc(RondaServices.db, 'users', userId);
      const snap = await getDoc(userRef);
      const prev = snap.exists() ? (snap.data() as User).verifications : undefined;
      await updateDoc(userRef, {
        trustTier: 2, isVerified: true,
        verifications: { ...(prev as object | undefined), identity: { method: 'manual_admin', verifiedAt: now, reviewerUid: reviewer } },
      });
      await updateDoc(doc(RondaServices.db, 'kycReviews', reviewId), { status: 'approved', reviewedBy: reviewer, reviewedAt: now });
      await deleteDoc(doc(RondaServices.db, 'kycReviews', reviewId)).catch(() => undefined);
      await RondaDialog.alert({ title: 'KYC Aprobado', message: `Usuario elevado a Tier 2.`, icon: '✅' });
      await this.loadKycQueue();
    } catch (err) {
      console.error('[SuperAdmin] Error aprobando KYC:', err);
      await RondaDialog.alert({ title: 'Error', message: 'No se pudo aprobar el caso.', icon: '⚠️', type: 'danger' });
    }
  }

  private async rejectKycCase(reviewId: string): Promise<void> {
    if (!reviewId) return;
    const reason = window.prompt('Motivo del rechazo (opcional):', 'documento_no_reconocido') ?? '';
    try {
      const reviewer = Auth.currentUser?.uid || 'superadmin';
      await updateDoc(doc(RondaServices.db, 'kycReviews', reviewId), {
        status: 'rejected', reviewedBy: reviewer, reviewedAt: new Date().toISOString(), adminNotes: reason,
      });
      await RondaDialog.alert({ title: 'KYC Rechazado', message: 'Caso marcado como rechazado.', icon: '✕' });
      await this.loadKycQueue();
    } catch (err) {
      console.error('[SuperAdmin] Error rechazando KYC:', err);
      await RondaDialog.alert({ title: 'Error', message: 'No se pudo rechazar el caso.', icon: '⚠️', type: 'danger' });
    }
  }

  private setupListeners() {}

  private attachListeners() {
    document.querySelectorAll('.sa-set-role').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const role = (e.currentTarget as HTMLElement).getAttribute('data-role');
        if (!role) return;

        const user = Auth.currentUser;
        if (user) {
          user.role = role;
          await DB.saveUser(user);
        }

        // Sync dropdown if exists
        const select = document.getElementById('switcher-role-select') as HTMLSelectElement;
        if (select) select.value = role;

        await RondaDialog.alert({
          title: 'Rol Asignado',
          message: `Tu usuario actual ahora tiene el rol: ${role.toUpperCase()}.\nPuedes usar el Master Panel Switcher arriba para navegar a cualquier sección.`,
          icon: '✨'
        });
      });
    });
    document.getElementById('sa-kyc-refresh')?.addEventListener('click', () => void this.loadKycQueue());
    void this.loadKycQueue();
  }
}

export const SuperAdmin = new SuperAdminController();
