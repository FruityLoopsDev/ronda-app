/**
 * kyc-panel.ts — Módulo independiente "Verificación KYC" del panel SuperAdmin.
 *
 * Antes vivía embebido en el Resumen como una tarjeta de dos columnas; ahora es
 * una sección propia (`data-section="kyc"`) montada por el shell.
 *
 * Responsabilidades:
 *  - Paginar la cola `kycReviews` (status = pending) de 10 en 10 con cursor.
 *  - Servir las fotos Base64 **solo** al expandir la tarjeta (memoria, no DOM).
 *  - Aprobar (Tier 2) o rechazar un caso y refrescar la cola.
 *
 * El shell solo necesita: `render(stage)` y `refresh()`.
 */
import {
  collection,
  query,
  where,
  getDocs,
  getDoc,
  doc,
  updateDoc,
  deleteDoc,
  limit,
  startAfter,
  getCountFromServer,
  type QueryDocumentSnapshot,
} from 'firebase/firestore';
import { RondaServices } from '../firebase-config.js';
import type { User } from '../db.js';
import { RondaDialog } from '../dialog.js';
import { Auth } from '../auth.js';
import { escapeHtml } from '../utils.js';
import type { SuperAdminPanel } from './context.js';

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

type KycPhotos = { selfie: string; docFront: string; docBack?: string };

export class KycPanel implements SuperAdminPanel {
  // --- Estado de paginación de la cola KYC (cursor de Firestore) ---
  private lastDoc: QueryDocumentSnapshot | null = null;
  private shown = 0;
  private total: number | null = null;
  private lastPageSize = 0;
  private loading = false;
  private readonly pageSize = 10;

  // Fotos Base64 fuera del DOM: se sirven solo bajo demanda.
  private readonly photos = new Map<string, KycPhotos>();

  async render(stage: HTMLElement): Promise<void> {
    stage.innerHTML = this.shell();
    this.bindQueueEvents();
    await this.loadQueue();
  }

  async refresh(): Promise<void> {
    await this.loadQueue();
  }

  // ==========================================================================
  // Plantilla del módulo
  // ==========================================================================
  private shell(): string {
    return `
      <div class="sa-module-grid">

        <!-- Cola de revisión -->
        <section class="sa-panel-card" style="display:flex; flex-direction:column; gap:16px; min-height:420px;">
          <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:12px; flex-wrap:wrap;">
            <div>
              <h4 style="font-family:var(--font-display); font-size:17px; color:var(--papel); margin:0;">🛡️ Cola de verificación manual</h4>
              <p style="font-size:12px; color:var(--humo); margin:4px 0 0;">
                Casos escalados por el motor biométrico que requieren una decisión humana antes de habilitar la reserva.
              </p>
            </div>
            <span id="sa-kyc-total" style="font-size:10.5px; font-family:var(--font-mono); color:#79D3AC; background:rgba(121,211,172,0.1); border:1px solid rgba(121,211,172,0.3); border-radius:999px; padding:4px 10px; white-space:nowrap;">Escaneando…</span>
          </div>

          <div id="sa-kyc-list" style="display:flex; flex-direction:column; gap:12px; flex:1;">
            <p style="font-size:12px; color:var(--humo);">Cargando cola KYC…</p>
          </div>

          <div style="display:flex; justify-content:space-between; align-items:center; gap:10px; padding-top:12px; border-top:1px dashed var(--linea); flex-wrap:wrap;">
            <span id="sa-kyc-count" style="font-size:11px; color:var(--humo); font-family:var(--font-mono);">Mostrando 0 de 0 casos pendientes</span>
            <button class="btn" id="sa-kyc-more" style="font-size:11px; padding:6px 12px; display:none; flex:0 0 auto; width:auto;">➕ Cargar más casos (10 más)</button>
          </div>
        </section>

        <!-- Protocolo de revisión -->
        <aside class="sa-panel-card" style="display:flex; flex-direction:column; gap:14px;">
          <h4 style="font-family:var(--font-display); font-size:15px; color:var(--papel); margin:0;">📋 Protocolo de revisión</h4>
          <ol style="margin:0; padding-left:18px; font-size:12px; color:var(--humo); line-height:1.75;">
            <li>La selfie y la cédula deben corresponder a la misma persona.</li>
            <li>La fecha de nacimiento registrada debe coincidir con el documento.</li>
            <li>Rechaza documentos vencidos, recortados o ilegibles.</li>
          </ol>
          <div style="border:1px dashed rgba(240,168,48,0.35); background:rgba(240,168,48,0.06); border-radius:10px; padding:12px; font-size:11.5px; color:var(--humo); line-height:1.6;">
            <b style="color:var(--luz);">Aprobar</b> eleva al usuario a <b style="color:var(--papel);">Tier 2</b> y desbloquea reservas.
            <b style="color:#ff8ca8;">Rechazar</b> archiva el caso con el motivo indicado y conserva la auditoría.
          </div>
          <div style="font-size:10.5px; color:var(--humo); font-family:var(--font-mono); border-top:1px dashed var(--linea); padding-top:12px; line-height:1.6;">
            La cola se pagina de 10 en 10 para cuidar la cuota de Firestore.
          </div>
        </aside>

      </div>
    `;
  }

  // ==========================================================================
  // Carga y paginación
  // ==========================================================================
  private bindQueueEvents(): void {
    document.getElementById('sa-kyc-more')?.addEventListener('click', () => void this.loadQueue({ append: true }));
    // Delegación estable: sobrevive a los re-renders de paginación.
    const list = document.getElementById('sa-kyc-list');
    if (list) this.bindCardActions(list);
  }

  private async loadQueue(opts: { append?: boolean } = {}): Promise<void> {
    const list = document.getElementById('sa-kyc-list');
    if (!list) return;
    // Guard anti-spam: una sola lectura en vuelo para no quemar cuota Spark.
    if (this.loading) return;
    const append = opts.append === true && this.lastDoc !== null;
    this.loading = true;
    this.setRefreshState(true);
    try {
      if (!append) {
        this.lastDoc = null;
        this.shown = 0;
        list.innerHTML = `<p style="font-size:12px; color:var(--humo);">Cargando cola…</p>`;
        // Conteo total de pendientes (lectura agregada barata) para el contador.
        try {
          const agg = await getCountFromServer(query(collection(RondaServices.db, 'kycReviews'), where('status', '==', 'pending')));
          this.total = agg.data().count;
        } catch (e) {
          console.warn('[KycPanel] No se pudo contar la cola KYC:', e);
          this.total = null;
        }
      }

      const base = query(collection(RondaServices.db, 'kycReviews'), where('status', '==', 'pending'), limit(this.pageSize));
      const q = append && this.lastDoc ? query(base, startAfter(this.lastDoc)) : base;
      const snap = await getDocs(q);

      const cases: KycReviewCase[] = [];
      snap.forEach((d) => cases.push({ ...(d.data() as Omit<KycReviewCase, 'reviewId'>), reviewId: d.id }));

      // Cursor para la siguiente página.
      this.lastDoc = snap.docs.length > 0 ? snap.docs[snap.docs.length - 1] : this.lastDoc;
      this.lastPageSize = cases.length;

      // Fotos Base64 fuera del DOM: solo se guardan en memoria.
      cases.forEach((c) => {
        if (c.imageUrls) this.photos.set(c.reviewId, c.imageUrls);
      });

      if (cases.length === 0 && !append) {
        list.innerHTML = `
          <div style="text-align:center; padding:32px 16px; background:rgba(243,237,226,0.02); border:1px solid rgba(121,211,172,0.18); border-radius:12px;">
            <span style="font-size:26px; display:block; margin-bottom:6px;">✅</span>
            <b style="color:var(--papel); font-size:13px; display:block;">Sin casos pendientes</b>
            <span style="font-size:11px; color:var(--humo); display:block; margin-top:2px;">No hay verificaciones manuales esperando revisión.</span>
          </div>
        `;
      } else if (cases.length > 0) {
        const html = cases.map((c) => this.renderCard(c)).join('');
        if (append) list.insertAdjacentHTML('beforeend', html);
        else list.innerHTML = html;
        this.bindCardActions(list);
      }

      this.shown += cases.length;
      this.updateFooter();
    } catch (err) {
      console.error('[KycPanel] Error cargando kycReviews:', err);
      if (!append) list.innerHTML = `<p style="font-size:12px; color:var(--vino);">⚠️ No se pudo cargar la cola KYC.</p>`;
    } finally {
      this.loading = false;
      this.setRefreshState(false);
    }
  }

  private updateFooter(): void {
    const countEl = document.getElementById('sa-kyc-count');
    const totalEl = document.getElementById('sa-kyc-total');
    const moreBtn = document.getElementById('sa-kyc-more') as HTMLButtonElement | null;

    if (countEl) {
      countEl.textContent = this.total === null
        ? `Mostrando ${this.shown} casos pendientes`
        : `Mostrando ${this.shown} de ${this.total} casos pendientes`;
    }
    if (totalEl) {
      totalEl.textContent = this.total === null ? `${this.shown} en pantalla` : `${this.total} pendientes`;
    }
    if (moreBtn) {
      const hasMore = this.lastDoc !== null
        && this.lastPageSize >= this.pageSize
        && (this.total === null || this.shown < this.total);
      moreBtn.style.display = hasMore ? '' : 'none';
      moreBtn.disabled = false;
      moreBtn.textContent = '➕ Cargar más casos (10 más)';
    }
  }

  /** El botón de refresco vive en la cabecera del shell (`#sa-kyc-refresh`). */
  private setRefreshState(loading: boolean): void {
    const btn = document.getElementById('sa-kyc-refresh') as HTMLButtonElement | null;
    if (!btn) return;
    btn.disabled = loading;
    btn.innerHTML = loading ? '<span class="sa-spin">↻</span> Cargando…' : '↻ Actualizar cola';
  }

  // ==========================================================================
  // Tarjetas de caso
  // ==========================================================================
  private bindCardActions(list: HTMLElement): void {
    if (list.dataset.bound === '1') return;
    list.dataset.bound = '1';

    list.addEventListener('click', (e) => {
      const target = (e.target as HTMLElement).closest('.sa-kyc-approve, .sa-kyc-reject, .sa-kyc-photos-toggle') as HTMLElement | null;
      if (!target || !list.contains(target)) return;

      if (target.classList.contains('sa-kyc-photos-toggle')) {
        this.togglePhotos(target);
        return;
      }

      const card = target.closest('article');
      if (!card || target.dataset.busy === '1') return;
      const approveBtn = card.querySelector('.sa-kyc-approve') as HTMLButtonElement | null;
      const rejectBtn = card.querySelector('.sa-kyc-reject') as HTMLButtonElement | null;
      // Bloquear doble clic inmediatamente (ambos botones de la tarjeta).
      if (approveBtn && rejectBtn) {
        approveBtn.dataset.busy = '1';
        rejectBtn.dataset.busy = '1';
        approveBtn.disabled = true;
        rejectBtn.disabled = true;
        approveBtn.textContent = 'Procesando…';
        rejectBtn.textContent = 'Procesando…';
      }

      const reviewId = target.getAttribute('data-review') || '';
      if (target.classList.contains('sa-kyc-approve')) {
        void this.approveCase(reviewId, target.getAttribute('data-user') || '', card);
      } else {
        void this.rejectCase(reviewId, card);
      }
    });
  }

  /** Re-habilita los botones tras un fallo para permitir reintento. */
  private releaseCard(card: Element): void {
    const approveBtn = card.querySelector('.sa-kyc-approve') as HTMLButtonElement | null;
    const rejectBtn = card.querySelector('.sa-kyc-reject') as HTMLButtonElement | null;
    if (approveBtn) {
      approveBtn.disabled = false;
      delete approveBtn.dataset.busy;
      approveBtn.textContent = '✅ Aprobar Tier 2';
    }
    if (rejectBtn) {
      rejectBtn.disabled = false;
      delete rejectBtn.dataset.busy;
      rejectBtn.textContent = '✕ Rechazar';
    }
  }

  /** Las fotos Base64 se sirven solo al expandir la tarjeta. */
  private togglePhotos(btn: HTMLElement): void {
    const card = btn.closest('article');
    if (!card) return;
    const reviewId = btn.getAttribute('data-review') || '';
    const holder = card.querySelector('.sa-kyc-photos') as HTMLElement | null;
    if (!holder) return;

    if (holder.childElementCount > 0) {
      // Colapsar: liberar nodos de imagen del DOM.
      holder.innerHTML = '';
      holder.style.display = 'none';
      btn.textContent = '[👁️ Ver Fotografías KYC]';
      return;
    }

    const imgs = this.photos.get(reviewId);
    if (!imgs) {
      btn.textContent = '[⚠️ Fotos no disponibles]';
      return;
    }
    const fig = (label: string, src?: string) => src
      ? `<figure style="margin:0; contain:content;"><figcaption style="font-size:10px; color:var(--humo);">${label}</figcaption><img src="${escapeHtml(src)}" alt="${label}" loading="lazy" style="width:100%; border-radius:8px; border:1px solid var(--linea);"/></figure>`
      : '';
    holder.innerHTML =
      fig('SELFIE', imgs.selfie) + fig('DOC FRENTE', imgs.docFront) + fig('DOC REVERSO', imgs.docBack);
    holder.style.display = 'grid';
    btn.textContent = '[🙈 Ocultar Fotografías]';
  }

  private renderCard(c: KycReviewCase): string {
    const dist = typeof c.metrics?.faceDistance === 'number' ? c.metrics.faceDistance : null;
    const sim = dist === null ? '—' : Math.max(0, Math.min(100, Math.round((1 - Math.min(dist, 1)) * 100))) + '%';
    const reasons = (c.reasonsForManual || []).map((r) => escapeHtml(r)).join(', ') || '—';
    const photoCount = [c.imageUrls?.selfie, c.imageUrls?.docFront, c.imageUrls?.docBack].filter(Boolean).length;

    return `<article style="border:1px solid var(--linea); border-radius:12px; padding:14px; background:rgba(243,237,226,.03);">
      <div style="display:flex; justify-content:space-between; gap:8px; flex-wrap:wrap; margin-bottom:10px;">
        <div>
          <b style="color:var(--papel); font-size:13px;">${escapeHtml(c.userName || c.userId)}</b>
          <div style="font-size:11px; color:var(--humo); font-family:var(--font-mono);">${escapeHtml(c.userEmail || '')} · ${escapeHtml(c.createdAt || '')}</div>
          <div style="font-size:11px; color:var(--humo);">Motivos: ${reasons}</div>
        </div>
        <div style="font-size:11px; color:var(--luz); font-family:var(--font-mono); text-align:right;">
          distancia: <b>${dist ?? '—'}</b><br/>similitud: <b>${sim}</b><br/>liveness: <b>${c.metrics?.livenessScore ?? '—'}</b>
        </div>
      </div>
      <button type="button" class="btn sa-kyc-photos-toggle" data-review="${escapeHtml(c.reviewId)}" style="font-size:11px; padding:8px 12px; margin-bottom:10px; flex:0 0 auto; width:auto;">[👁️ Ver Fotografías KYC${photoCount ? ` (${photoCount})` : ''}]</button>
      <div class="sa-kyc-photos" style="display:none; grid-template-columns:repeat(auto-fit,minmax(140px,1fr)); gap:10px; margin-bottom:10px; contain:content;"></div>
      <div style="display:flex; gap:8px; flex-wrap:wrap;">
        <button class="btn ambar sa-kyc-approve" data-review="${escapeHtml(c.reviewId)}" data-user="${escapeHtml(c.userId)}" style="font-size:11px; padding:9px 14px; font-weight:700; flex:0 0 auto; width:auto;">✅ Aprobar Tier 2</button>
        <button class="btn sa-kyc-reject" data-review="${escapeHtml(c.reviewId)}" style="font-size:11px; padding:9px 14px; border-color:var(--vino); flex:0 0 auto; width:auto;">✕ Rechazar</button>
      </div>
    </article>`;
  }

  // ==========================================================================
  // Decisiones
  // ==========================================================================
  private async approveCase(reviewId: string, userId: string, card?: Element): Promise<void> {
    if (!reviewId || !userId) { if (card) this.releaseCard(card); return; }
    try {
      const reviewer = Auth.currentUser?.uid || 'superadmin';
      const now = new Date().toISOString();
      const userRef = doc(RondaServices.db, 'users', userId);
      const snap = await getDoc(userRef);
      const prev = snap.exists() ? (snap.data() as User).verifications : undefined;
      await updateDoc(userRef, {
        trustTier: 2,
        isVerified: true,
        verifications: { ...(prev as object | undefined), identity: { method: 'manual_admin', verifiedAt: now, reviewerUid: reviewer } },
      });
      await updateDoc(doc(RondaServices.db, 'kycReviews', reviewId), { status: 'approved', reviewedBy: reviewer, reviewedAt: now });
      await deleteDoc(doc(RondaServices.db, 'kycReviews', reviewId)).catch(() => undefined);
      if (this.total !== null) this.total = Math.max(0, this.total - 1);
      await RondaDialog.alert({ title: 'KYC Aprobado', message: 'Usuario elevado a Tier 2.', icon: '✅' });
      await this.loadQueue();
    } catch (err) {
      console.error('[KycPanel] Error aprobando KYC:', err);
      if (card) this.releaseCard(card);
      await RondaDialog.alert({ title: 'Error', message: 'No se pudo aprobar el caso.', icon: '⚠️', type: 'danger' });
    }
  }

  private async rejectCase(reviewId: string, card?: Element): Promise<void> {
    if (!reviewId) { if (card) this.releaseCard(card); return; }
    const rawReason = await RondaDialog.prompt({
      title: 'Rechazar caso KYC',
      message: 'Motivo del rechazo (opcional):',
      placeholder: 'documento_no_reconocido',
      defaultValue: 'documento_no_reconocido',
      confirmText: 'Rechazar',
      cancelText: 'Cancelar',
      type: 'danger',
    });
    if (rawReason === null) {
      // Cancelado por el usuario: abortar y re-habilitar para permitir reintento.
      if (card) this.releaseCard(card);
      return;
    }
    try {
      const reviewer = Auth.currentUser?.uid || 'superadmin';
      await updateDoc(doc(RondaServices.db, 'kycReviews', reviewId), {
        status: 'rejected',
        reviewedBy: reviewer,
        reviewedAt: new Date().toISOString(),
        adminNotes: rawReason,
      });
      if (this.total !== null) this.total = Math.max(0, this.total - 1);
      await RondaDialog.alert({ title: 'KYC Rechazado', message: 'Caso marcado como rechazado.', icon: '✕' });
      await this.loadQueue();
    } catch (err) {
      console.error('[KycPanel] Error rechazando KYC:', err);
      if (card) this.releaseCard(card);
      await RondaDialog.alert({ title: 'Error', message: 'No se pudo rechazar el caso.', icon: '⚠️', type: 'danger' });
    }
  }
}
