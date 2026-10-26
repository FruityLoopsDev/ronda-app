import { DB, User, LedgerEntry, Payout, Scout, Host, MilestoneState } from './db.js';
import { RondaDialog } from './dialog.js';
import { Auth } from './auth.js';
import { collection, query, where, getDocs, doc, getDoc, setDoc, updateDoc, deleteDoc, limit, startAfter, getCountFromServer, QueryDocumentSnapshot } from 'firebase/firestore';
import { RondaServices } from './firebase-config.js';
import { RondaB2BEngine } from './b2b-engine.ts';

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

export interface InvestToken {
  token: string;
  name: string;
  leadId: string;
  role: 'founder' | 'investor' | 'guest';
  ring: 'A1' | 'A2' | 'A3' | 'A4' | 'GEN';
  phone?: string;
  notes?: string;
  active: boolean;
  createdAt: string;
}

export class SuperAdminController {
  // --- Estado de paginación de la cola KYC (cursor de Firestore) ---
  private kycLastDoc: QueryDocumentSnapshot | null = null;
  private kycShown = 0;
  private kycTotal: number | null = null;
  private kycLastPageSize = 0;
  private kycLoading = false;
  private readonly kycPageSize = 10;
  // --- T-8.2: Tokens de inversión Pista Privada FFF ---
  private tokens: InvestToken[] = [];
  private tokensLoading = false;
  // Fotos Base64 fuera del DOM: se sirven solo bajo demanda (Tarea 2).
  private readonly kycPhotos = new Map<string, { selfie: string; docFront: string; docBack?: string }>();

  // --- T1: Estado de Liquidaciones B2B ---
  private readonly b2bEngine = new RondaB2BEngine();
  private liqEntries: LedgerEntry[] = [];
  private liqPayouts: Payout[] = [];
  private liqPayeeNames = new Map<string, string>();
  private payoutModalEntries: LedgerEntry[] = [];
  private payoutModalPayee = '';
  private reversePayoutTarget: Payout | null = null;

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
          <div id="sa-card-b2c" style="background: rgba(243,237,226,0.05); border: 1px solid var(--linea); border-radius: 14px; padding: 18px;">
            <span style="font-size: 11px; color: var(--humo); font-family: var(--font-mono); text-transform: uppercase;">🎟️ Línea 1: Tickets B2C</span>
            <b id="sa-metric-b2c-value" style="font-size: 26px; color: var(--papel); font-family: var(--font-display); display: block; margin-top: 4px;">$12.450.000</b>
            <span id="sa-metric-b2c-badge" style="display:none; font-size:10px; font-family: var(--font-mono); color: #f0a830; border: 1px dashed rgba(240,168,48,0.5); border-radius: 6px; padding: 2px 6px; margin-top: 4px;">📈 Estimado / Proyectado</span>
            <span id="sa-metric-b2c-sub" style="font-size: 10px; color: var(--botella); font-family: var(--font-mono); display:block; margin-top: 4px;">+18% vs semana anterior</span>
          </div>

          <div style="background: rgba(243,237,226,0.05); border: 1px solid var(--linea); border-radius: 14px; padding: 18px;">
            <span style="font-size: 11px; color: var(--humo); font-family: var(--font-mono); text-transform: uppercase;">🏢 Línea 2: SaaS Bares B2B</span>
            <b style="font-size: 26px; color: var(--luz); font-family: var(--font-display); display: block; margin-top: 4px;">$3.800.000</b>
            <span id="sa-metric-venues-sub" style="font-size: 10px; color: var(--humo); font-family: var(--font-mono);">${venuesCount} locales bajo suscripción</span>
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
          <div style="display:flex; justify-content:space-between; align-items:center; gap:10px; flex-wrap:wrap; margin-top:14px; padding-top:12px; border-top:1px dashed var(--linea);">
            <span id="sa-kyc-count" style="font-size:11px; color:var(--humo); font-family:var(--font-mono);">Mostrando 0 de 0 casos pendientes</span>
            <button class="btn" id="sa-kyc-more" style="font-size: 11px; padding: 8px 14px; display:none;">➕ Cargar más casos (10 más)</button>
          </div>
        </div>

        <!-- T1: Liquidaciones B2B (Ledger de Scouts y Hosters) -->
        <div style="background: rgba(0,0,0,0.35); border: 1px solid var(--linea); border-radius: 16px; padding: 20px;">
          <div style="display:flex; justify-content:space-between; align-items:center; gap:10px; flex-wrap:wrap; margin-bottom:10px;">
            <h4 style="font-family: var(--font-display); font-size: 18px; color: var(--papel); margin: 0;">💸 Liquidaciones B2B</h4>
            <div style="display:flex; gap:8px; flex-wrap:wrap;">
              <button class="btn" id="sa-liq-refresh" style="font-size: 11px; padding: 8px 14px;">↻ Actualizar</button>
              <button class="btn" id="sa-people-toggle" style="font-size: 11px; padding: 8px 14px;">👥 Scouts &amp; Hosters</button>
            </div>
          </div>

          <!-- Banner fijo: modo desembolso manual -->
          <div style="display:flex; align-items:center; gap:8px; background: rgba(240,168,48,0.10); border: 1px dashed rgba(240,168,48,0.45); border-radius: 10px; padding: 10px 14px; margin-bottom: 16px;">
            <span style="font-size: 14px;">🛡️</span>
            <span style="font-size: 11.5px; color: var(--papel); font-family: var(--font-mono);">Modo desembolso manual — no se realizan transferencias automáticas.</span>
          </div>

          <div style="margin-bottom: 18px;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
              <b style="font-family: var(--font-display); font-size: 14px; color: var(--papel);">✅ Pendientes por pagar</b>
              <span id="sa-liq-pending-count" style="font-size:10.5px; color:var(--humo); font-family:var(--font-mono);"></span>
            </div>
            <div id="sa-liq-pending" style="display:flex; flex-direction:column; gap:12px;">
              <p style="font-size:12px; color:var(--humo);">Cargando ledger…</p>
            </div>
          </div>

          <div style="margin-bottom: 18px;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
              <b style="font-family: var(--font-display); font-size: 14px; color: var(--papel);">⏳ En revisión / retenidas</b>
              <span id="sa-liq-held-count" style="font-size:10.5px; color:var(--humo); font-family:var(--font-mono);"></span>
            </div>
            <div id="sa-liq-held" style="display:flex; flex-direction:column; gap:10px;">
              <p style="font-size:12px; color:var(--humo);">Cargando ledger…</p>
            </div>
          </div>

          <div>
            <b style="font-family: var(--font-display); font-size: 14px; color: var(--papel); display:block; margin-bottom:8px;">📜 Historial de desembolsos</b>
            <div id="sa-liq-history" style="display:flex; flex-direction:column; gap:10px;">
              <p style="font-size:12px; color:var(--humo);">Cargando payouts…</p>
            </div>
          </div>

          <!-- T2: Gestión de Scouts y Hosters (colapsable) -->
          <div id="sa-people-panel" style="display:none; margin-top: 20px; padding-top: 16px; border-top: 1px dashed var(--linea);">
            <b style="font-family: var(--font-display); font-size: 14px; color: var(--papel); display:block; margin-bottom:10px;">👥 Alta y gestión de Scouts / Hosters</b>
            <form id="sa-people-form" style="display:grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap:10px; margin-bottom:14px;">
              <select id="sa-people-type" class="ronda-input" style="margin-bottom:0;">
                <option value="scout">Scout</option>
                <option value="host">Hoster</option>
              </select>
              <input id="sa-people-uid" class="ronda-input" placeholder="UID (requerido)" required style="margin-bottom:0;">
              <input id="sa-people-name" class="ronda-input" placeholder="Nombre" style="margin-bottom:0;">
              <input id="sa-people-email" class="ronda-input" type="email" placeholder="Email" style="margin-bottom:0;">
              <select id="sa-people-status" class="ronda-input" style="margin-bottom:0;">
                <option value="active">Activo</option>
                <option value="inactive">Inactivo</option>
              </select>
              <input id="sa-people-contract" class="ronda-input" placeholder="contract_id" style="margin-bottom:0;">
              <label style="display:flex; align-items:center; gap:6px; font-size:11.5px; color:var(--papel); font-family:var(--font-mono);">
                <input type="checkbox" id="sa-people-rut"> RUT verificado
              </label>
              <label style="display:flex; align-items:center; gap:6px; font-size:11.5px; color:var(--papel); font-family:var(--font-mono);">
                <input type="checkbox" id="sa-people-pila"> PILA vigente (mes actual)
              </label>
              <button type="submit" class="btn ambar" style="font-size:11px; padding:10px; font-weight:700;">Guardar</button>
            </form>
            <div id="sa-people-list" style="display:flex; flex-direction:column; gap:8px;">
              <p style="font-size:12px; color:var(--humo);">Cargando…</p>
            </div>
          </div>

          <!-- T-8.2: Tokens de inversión Pista Privada FFF (/invest) -->
          <div style="background: rgba(0,0,0,0.3); border: 1px solid var(--linea); border-radius: 16px; padding: 20px;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 12px;">
              <b style="font-family: var(--font-display); font-size: 14px; color: var(--papel);">🎟️ Pista Privada FFF: Tokens & Enlaces de Inversión (/invest)</b>
              <span id="sa-tokens-count" style="font-size:10.5px; color:var(--humo); font-family:var(--font-mono);"></span>
            </div>
            <form id="sa-token-form" style="display:grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap:10px; margin-bottom:14px; align-items:end;">
              <input id="sa-token-name" class="ronda-input" placeholder="Nombre Completo" required>
              <select id="sa-token-ring" class="ronda-input">
                <option value="A1">A1: Núcleo</option>
                <option value="A2">A2: Amigos</option>
                <option value="A3">A3: Red Prof.</option>
                <option value="A4">A4: Mentores</option>
                <option value="GEN">GEN: General</option>
              </select>
              <input id="sa-token-token" class="ronda-input" placeholder="Slug/Token (rnd-…)" required>
              <input id="sa-token-phone" class="ronda-input" placeholder="WhatsApp (opcional)">
              <input id="sa-token-notes" class="ronda-input" placeholder="Notas (opcional)">
              <button type="submit" class="btn ambar" style="font-size:11px; padding:10px 16px; font-weight:700;">➕ Emitir Token</button>
            </form>
            <p id="sa-tokens-empty" style="font-size:12px; color:var(--humo); display:none;">Sin tokens emitidos.</p>
            <div id="sa-tokens-list" style="display:flex; flex-direction:column; gap:8px;"></div>
          </div>
        </div>

        <!-- T1: Modal "Aprobar desembolso" -->
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

        <!-- T1: Modal motivo de reverso -->
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
      </div>
    `;

    this.attachListeners();
    void this.loadLiquidaciones();
    void this.loadPeople();
    void this.loadTokens();
  }

  private escapeKyc(s: unknown): string {
    return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));
  }

  private async loadKycQueue(opts: { append?: boolean } = {}): Promise<void> {
    const list = document.getElementById('sa-kyc-list');
    if (!list) return;
    // Guard anti-spam: una sola lectura en vuelo para no quemar cuota Spark.
    if (this.kycLoading) return;
    const append = opts.append === true && this.kycLastDoc !== null;
    this.kycLoading = true;
    this.setRefreshState(true);
    try {
      if (!append) {
        this.kycLastDoc = null;
        this.kycShown = 0;
        list.innerHTML = `<p style="font-size:12px;color:var(--humo);">Cargando cola…</p>`;
        // Conteo total de pendientes (lectura agregada barata) para el contador.
        try {
          const agg = await getCountFromServer(query(collection(RondaServices.db, 'kycReviews'), where('status', '==', 'pending')));
          this.kycTotal = agg.data().count;
        } catch (e) {
          console.warn('[SuperAdmin] No se pudo contar la cola KYC:', e);
          this.kycTotal = null;
        }
      }

      const base = query(collection(RondaServices.db, 'kycReviews'), where('status', '==', 'pending'), limit(this.kycPageSize));
      const q = append && this.kycLastDoc ? query(base, startAfter(this.kycLastDoc)) : base;
      const snap = await getDocs(q);

      const cases: KycReviewCase[] = [];
      snap.forEach((d) => cases.push({ ...(d.data() as Omit<KycReviewCase, 'reviewId'>), reviewId: d.id }));

      // Cursor para la siguiente página.
      this.kycLastDoc = snap.docs.length > 0 ? snap.docs[snap.docs.length - 1] : this.kycLastDoc;
      this.kycLastPageSize = cases.length;

      // Fotos Base64 fuera del DOM: solo se guardan en memoria (Tarea 2).
      cases.forEach((c) => {
        if (c.imageUrls) this.kycPhotos.set(c.reviewId, c.imageUrls);
      });

      if (cases.length === 0 && !append) {
        list.innerHTML = `<p style="font-size:12px;color:var(--botella);">✅ Sin casos pendientes.</p>`;
      } else if (cases.length > 0) {
        const html = cases.map((c) => this.renderKycCard(c)).join('');
        if (append) list.insertAdjacentHTML('beforeend', html);
        else list.innerHTML = html;
        this.bindKycCardActions(list);
      }

      this.kycShown += cases.length;
      this.updateKycFooter();
    } catch (err) {
      console.error('[SuperAdmin] Error cargando kycReviews:', err);
      if (!append) list.innerHTML = `<p style="font-size:12px;color:var(--vino);">⚠️ No se pudo cargar la cola KYC.</p>`;
    } finally {
      this.kycLoading = false;
      this.setRefreshState(false);
    }
  }

  private updateKycFooter(): void {
    const countEl = document.getElementById('sa-kyc-count');
    const moreBtn = document.getElementById('sa-kyc-more') as HTMLButtonElement | null;
    if (countEl) {
      countEl.textContent = this.kycTotal === null
        ? `Mostrando ${this.kycShown} casos pendientes`
        : `Mostrando ${this.kycShown} de ${this.kycTotal} casos pendientes`;
    }
    if (moreBtn) {
      const hasMore = this.kycLastDoc !== null
        && this.kycLastPageSize >= this.kycPageSize
        && (this.kycTotal === null || this.kycShown < this.kycTotal);
      moreBtn.style.display = hasMore ? '' : 'none';
      moreBtn.disabled = false;
      moreBtn.textContent = '➕ Cargar más casos (10 más)';
    }
  }

  private setRefreshState(loading: boolean): void {
    const btn = document.getElementById('sa-kyc-refresh') as HTMLButtonElement | null;
    if (!btn) return;
    btn.disabled = loading;
    btn.innerHTML = loading
      ? '<span class="sa-spin">↻</span> Cargando...'
      : '↻ Actualizar cola';
  }

  // Delegación de eventos sobre la lista: sobrevive a los re-renders de paginación.
  private bindKycCardActions(list: HTMLElement): void {
    if (list.dataset.bound === '1') return;
    list.dataset.bound = '1';

    list.addEventListener('click', (e) => {
      const target = (e.target as HTMLElement).closest('.sa-kyc-approve, .sa-kyc-reject, .sa-kyc-photos-toggle') as HTMLElement | null;
      if (!target || !list.contains(target)) return;

      if (target.classList.contains('sa-kyc-photos-toggle')) {
        this.toggleKycPhotos(target);
        return;
      }

      const card = target.closest('article');
      if (!card || target.dataset.busy === '1') return;
      const approveBtn = card.querySelector('.sa-kyc-approve') as HTMLButtonElement | null;
      const rejectBtn = card.querySelector('.sa-kyc-reject') as HTMLButtonElement | null;
      // Tarea 3: bloquear doble clic inmediatamente (ambos botones de la tarjeta).
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
        void this.approveKycCase(reviewId, target.getAttribute('data-user') || '', card);
      } else {
        void this.rejectKycCase(reviewId, card);
      }
    });
  }

  // Re-habilita los botones tras un fallo para permitir reintento (Tarea 3).
  private releaseKycCard(card: Element): void {
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

  // Tarea 2: las fotos Base64 se sirven solo al expandir la tarjeta.
  private toggleKycPhotos(btn: HTMLElement): void {
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

    const imgs = this.kycPhotos.get(reviewId);
    if (!imgs) {
      btn.textContent = '[⚠️ Fotos no disponibles]';
      return;
    }
    const fig = (label: string, src?: string) => src
      ? `<figure style="margin:0; contain:content;"><figcaption style="font-size:10px;color:var(--humo);">${label}</figcaption><img src="${this.escapeKyc(src)}" alt="${label}" loading="lazy" style="width:100%;border-radius:8px;border:1px solid var(--linea);"/></figure>`
      : '';
    holder.innerHTML =
      fig('SELFIE', imgs.selfie) + fig('DOC FRENTE', imgs.docFront) + fig('DOC REVERSO', imgs.docBack);
    holder.style.display = 'grid';
    btn.textContent = '[🙈 Ocultar Fotografías]';
  }

  private renderKycCard(c: KycReviewCase): string {
    const dist = typeof c.metrics?.faceDistance === 'number' ? c.metrics.faceDistance : null;
    const sim = dist === null ? '—' : Math.max(0, Math.min(100, Math.round((1 - Math.min(dist, 1)) * 100))) + '%';
    const reasons = (c.reasonsForManual || []).map((r) => this.escapeKyc(r)).join(', ') || '—';
    const photoCount = [c.imageUrls?.selfie, c.imageUrls?.docFront, c.imageUrls?.docBack].filter(Boolean).length;
    return `<article style="border:1px solid var(--linea);border-radius:12px;padding:14px;background:rgba(243,237,226,.03);">
      <div style="display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap;margin-bottom:10px;">
        <div><b style="color:var(--papel);font-size:13px;">${this.escapeKyc(c.userName || c.userId)}</b>
        <div style="font-size:11px;color:var(--humo);font-family:var(--font-mono);">${this.escapeKyc(c.userEmail || '')} · ${this.escapeKyc(c.createdAt || '')}</div>
        <div style="font-size:11px;color:var(--humo);">Motivos: ${reasons}</div></div>
        <div style="font-size:11px;color:var(--luz);font-family:var(--font-mono);text-align:right;">distancia: <b>${dist ?? '—'}</b><br/>similitud: <b>${sim}</b><br/>liveness: <b>${c.metrics?.livenessScore ?? '—'}</b></div>
      </div>
      <button type="button" class="btn sa-kyc-photos-toggle" data-review="${this.escapeKyc(c.reviewId)}" style="font-size:11px;padding:8px 12px;margin-bottom:10px;">[👁️ Ver Fotografías KYC${photoCount ? ` (${photoCount})` : ''}]</button>
      <div class="sa-kyc-photos" style="display:none;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:10px;margin-bottom:10px;contain:content;"></div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;">
        <button class="btn ambar sa-kyc-approve" data-review="${this.escapeKyc(c.reviewId)}" data-user="${this.escapeKyc(c.userId)}" style="font-size:11px;padding:9px 14px;font-weight:700;">✅ Aprobar Tier 2</button>
        <button class="btn sa-kyc-reject" data-review="${this.escapeKyc(c.reviewId)}" style="font-size:11px;padding:9px 14px;border-color:var(--vino);">✕ Rechazar</button>
      </div>
    </article>`;
  }

  private async approveKycCase(reviewId: string, userId: string, card?: Element): Promise<void> {
    if (!reviewId || !userId) { if (card) this.releaseKycCard(card); return; }
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
      if (this.kycTotal !== null) this.kycTotal = Math.max(0, this.kycTotal - 1);
      await RondaDialog.alert({ title: 'KYC Aprobado', message: `Usuario elevado a Tier 2.`, icon: '✅' });
      await this.loadKycQueue();
    } catch (err) {
      console.error('[SuperAdmin] Error aprobando KYC:', err);
      if (card) this.releaseKycCard(card);
      await RondaDialog.alert({ title: 'Error', message: 'No se pudo aprobar el caso.', icon: '⚠️', type: 'danger' });
    }
  }

  private async rejectKycCase(reviewId: string, card?: Element): Promise<void> {
    if (!reviewId) { if (card) this.releaseKycCard(card); return; }
    const rawReason = window.prompt('Motivo del rechazo (opcional):', 'documento_no_reconocido');
    if (rawReason === null) {
      // Cancelado por el usuario: abortar y re-habilitar para permitir reintento.
      if (card) this.releaseKycCard(card);
      return;
    }
    const reason = rawReason;
    try {
      const reviewer = Auth.currentUser?.uid || 'superadmin';
      await updateDoc(doc(RondaServices.db, 'kycReviews', reviewId), {
        status: 'rejected', reviewedBy: reviewer, reviewedAt: new Date().toISOString(), adminNotes: reason,
      });
      if (this.kycTotal !== null) this.kycTotal = Math.max(0, this.kycTotal - 1);
      await RondaDialog.alert({ title: 'KYC Rechazado', message: 'Caso marcado como rechazado.', icon: '✕' });
      await this.loadKycQueue();
    } catch (err) {
      console.error('[SuperAdmin] Error rechazando KYC:', err);
      if (card) this.releaseKycCard(card);
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
    const refreshBtn = document.getElementById('sa-kyc-refresh') as HTMLButtonElement | null;
    refreshBtn?.addEventListener('click', () => void this.loadKycQueue());
    document.getElementById('sa-kyc-more')?.addEventListener('click', () => void this.loadKycQueue({ append: true }));
    void this.loadKycQueue();
    void this.loadRealMetrics();

    // --- T1: Liquidaciones B2B ---
    document.getElementById('sa-liq-refresh')?.addEventListener('click', () => void this.loadLiquidaciones());

    // Modal de aprobación de desembolso
    document.getElementById('sa-payout-close')?.addEventListener('click', () => this.closePayoutModal());
    const payoutChecks = ['sa-payout-rut', 'sa-payout-pila', 'sa-payout-bank'];
    payoutChecks.forEach(id => document.getElementById(id)?.addEventListener('change', () => this.validatePayoutForm()));
    document.getElementById('sa-payout-ref')?.addEventListener('input', () => this.validatePayoutForm());
    document.getElementById('sa-payout-confirm')?.addEventListener('click', () => void this.confirmPayout());

    // Modal de reverso
    document.getElementById('sa-reverse-close')?.addEventListener('click', () => this.closeReverseModal());
    document.getElementById('sa-reverse-cancel')?.addEventListener('click', () => this.closeReverseModal());
    document.getElementById('sa-reverse-reason')?.addEventListener('input', () => this.validateReverseForm());
    document.getElementById('sa-reverse-confirm')?.addEventListener('click', () => void this.confirmReverse());

    // --- T2: Scouts & Hosters ---
    document.getElementById('sa-people-toggle')?.addEventListener('click', () => {
      const panel = document.getElementById('sa-people-panel');
      if (panel) panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
    });
    document.getElementById('sa-people-form')?.addEventListener('submit', (e) => {
      e.preventDefault();
      void this.savePerson();
    });
    document.getElementById('sa-token-form')?.addEventListener('submit', (e) => {
      e.preventDefault();
      void this.emitToken();
    });
  }

  // Tarea 5: métricas reales de venues/tickets desde Firestore (lecturas agregadas baratas).
  private async loadRealMetrics(): Promise<void> {
    const valueEl = document.getElementById('sa-metric-b2c-value');
    const badgeEl = document.getElementById('sa-metric-b2c-badge');
    const subEl = document.getElementById('sa-metric-b2c-sub');
    const venuesSub = document.getElementById('sa-metric-venues-sub');
    try {
      const fs = RondaServices.db;

      // Venues reales (conteo agregado, 1 lectura).
      try {
        const venuesAgg = await getCountFromServer(collection(fs, 'venues'));
        const n = venuesAgg.data().count;
        if (venuesSub && n > 0) venuesSub.textContent = `${n} locales bajo suscripción`;
      } catch (e) {
        console.warn('[SuperAdmin] No se pudo contar venues:', e);
      }

      // Eventos cerrados = eventos con status 'finished' (db.ts).
      const closedAgg = await getCountFromServer(query(collection(fs, 'events'), where('status', '==', 'finished')));
      const closedEvents = closedAgg.data().count;

      // Reservas confirmadas: NO existe colección `confirmedBookings`; viven en
      // users/{uid}.activeReservation.status == 'confirmed' (client.ts:confirmBooking).
      const bookingsAgg = await getCountFromServer(query(collection(fs, 'users'), where('activeReservation.status', '==', 'confirmed')));
      const confirmedBookings = bookingsAgg.data().count;

      const subText = `${closedEvents} eventos cerrados · ${confirmedBookings} reservas confirmadas`;

      if (confirmedBookings === 0) {
        // Sin data histórica suficiente: mantener cifra estática y marcarla como estimada.
        if (badgeEl) badgeEl.style.display = '';
        if (subEl) subEl.textContent = `Estimado · ${subText}`;
        return;
      }

      // Volumen B2C real: suma de priceFormatted de las reservas confirmadas (muestra limitada).
      const snap = await getDocs(query(collection(fs, 'users'),
        where('activeReservation.status', '==', 'confirmed'),
        limit(50)));
      let sum = 0;
      let priced = 0;
      snap.forEach((d) => {
        const res = (d.data() as User).activeReservation;
        const n = this.parseCopAmount(res?.priceFormatted);
        if (n > 0) { sum += n; priced += 1; }
      });

      if (priced > 0 && valueEl) {
        const exact = confirmedBookings <= snap.size;
        const projected = exact ? sum : Math.round((sum / snap.size) * confirmedBookings);
        valueEl.textContent = '$' + projected.toLocaleString('es-CO');
        if (badgeEl) {
          badgeEl.style.display = '';
          badgeEl.textContent = exact ? '✅ Datos reales' : '📈 Estimado / Proyectado';
        }
        if (subEl) subEl.textContent = subText;
      } else {
        if (badgeEl) badgeEl.style.display = '';
        if (subEl) subEl.textContent = `Estimado · ${subText}`;
      }
    } catch (err) {
      console.warn('[SuperAdmin] No se pudieron cargar métricas reales:', err);
      // Fallback silencioso: se conservan las cifras estáticas del template.
      if (badgeEl) badgeEl.style.display = '';
    }
  }

  // ============ T1: Liquidaciones B2B ============
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

  private async loadLiquidaciones(): Promise<void> {
    const btn = document.getElementById('sa-liq-refresh') as HTMLButtonElement | null;
    if (btn) { btn.disabled = true; btn.textContent = '↻ Cargando…'; }
    try {
      const [entries, payouts, scouts, hosts] = await Promise.all([
        DB.getLedgerEntries(),
        DB.getPayouts(),
        DB.getScouts().catch(() => [] as Scout[]),
        DB.getHosts().catch(() => [] as Host[]),
      ]);
      this.liqEntries = entries || [];
      this.liqPayouts = (payouts || []).slice().sort((a, b) =>
        String(b.reconciled_at || b.createdAt || '').localeCompare(String(a.reconciled_at || a.createdAt || '')));
      this.liqPayeeNames.clear();
      for (const s of scouts) this.liqPayeeNames.set(s.uid, s.name || s.email || s.uid);
      for (const h of hosts) if (!this.liqPayeeNames.has(h.uid)) this.liqPayeeNames.set(h.uid, h.name || h.email || h.uid);
      this.renderLiquidations();
    } catch (err) {
      console.error('[SuperAdmin] Error cargando liquidaciones:', err);
      const pend = document.getElementById('sa-liq-pending');
      if (pend) pend.innerHTML = `<p style="font-size:12px;color:var(--vino);">⚠️ No se pudo cargar el ledger.</p>`;
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = '↻ Actualizar'; }
    }
  }

  private renderLiquidations(): void {
    const pendEl = document.getElementById('sa-liq-pending');
    const heldEl = document.getElementById('sa-liq-held');
    const histEl = document.getElementById('sa-liq-history');
    const pendCount = document.getElementById('sa-liq-pending-count');
    const heldCount = document.getElementById('sa-liq-held-count');
    if (!pendEl || !heldEl || !histEl) return;

    const pending = this.liqEntries.filter((e) => e.status === 'payable');
    const held = this.liqEntries.filter((e) => e.status === 'accrued' || e.status === 'review');
    const totalPend = pending.reduce((s, e) => s + (e.amount_gross_cop || 0), 0);
    if (pendCount) pendCount.textContent = pending.length ? `${pending.length} asientos · ${this.formatCop(totalPend)}` : '';
    if (heldCount) heldCount.textContent = held.length ? `${held.length} asientos en espera` : '';

    if (pending.length === 0) {
      pendEl.innerHTML = `<p style="font-size:12px;color:var(--botella);">✅ Sin pendientes por pagar.</p>`;
    } else {
      const byPayee = new Map<string, LedgerEntry[]>();
      for (const e of pending) {
        const arr = byPayee.get(e.payee_uid) || [];
        arr.push(e);
        byPayee.set(e.payee_uid, arr);
      }
      pendEl.innerHTML = [...byPayee.entries()].map(([uid, arr]) => {
        const total = arr.reduce((s, e) => s + (e.amount_gross_cop || 0), 0);
        const name = this.escapeKyc(this.liqPayeeNames.get(uid) || uid);
        const tipo = arr[0]?.payee_type === 'host' ? 'hoster' : 'scout';
        const rows = arr.map((e) => `<div style="border-top:1px dashed var(--linea);padding:6px 0;">
          <div style="display:flex;justify-content:space-between;gap:8px;font-size:11px;font-family:var(--font-mono);color:var(--humo);">
            <span>${this.escapeKyc(e.milestone)} · ${this.escapeKyc(e.lead_id || e.venue_id || e.id)}</span>
            <span style="color:var(--papel);font-weight:700;">${this.formatCop(e.amount_gross_cop)}</span>
          </div>
          <div style="font-size:10.5px;color:var(--humo);">${this.escapeKyc(e.reason || '')}${e.payable_after ? ` · ⏳ ${this.escapeKyc(this.liqCountdown(e.payable_after))}` : ''}</div>
        </div>`).join('');
        return `<div style="border:1px solid var(--linea);border-radius:12px;padding:14px;background:rgba(243,237,226,.03);">
          <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:6px;">
            <div><b style="color:var(--papel);font-size:13px;">${name}</b>
            <span style="font-size:10px;color:var(--humo);font-family:var(--font-mono);margin-left:8px;">${tipo} · ${arr.length} asientos</span></div>
            <b style="color:var(--luz);font-family:var(--font-mono);">${this.formatCop(total)}</b>
          </div>${rows}
          <button class="btn ambar sa-liq-approve" data-payee="${this.escapeKyc(uid)}" style="font-size:11px;padding:9px 14px;font-weight:700;margin-top:10px;">💸 Aprobar desembolso</button>
        </div>`;
      }).join('');
      pendEl.querySelectorAll('.sa-liq-approve').forEach((b) =>
        b.addEventListener('click', () => void this.openPayoutModal((b as HTMLElement).getAttribute('data-payee') || '')));
    }

    if (held.length === 0) {
      heldEl.innerHTML = `<p style="font-size:12px;color:var(--humo);">Sin asientos en revisión.</p>`;
    } else {
      heldEl.innerHTML = held.map((e) => {
        const name = this.escapeKyc(this.liqPayeeNames.get(e.payee_uid) || e.payee_uid);
        return `<div style="display:flex;justify-content:space-between;gap:8px;font-size:11.5px;color:var(--humo);border:1px dashed var(--linea);border-radius:10px;padding:10px 12px;">
          <span><b style="color:var(--papel);">${name}</b> · ${this.escapeKyc(e.milestone)} · ${this.escapeKyc(e.status)}<br/>
          <span style="font-family:var(--font-mono);font-size:10.5px;">⏳ ${this.escapeKyc(this.liqCountdown(e.payable_after))}${e.payable_after ? ` (${this.escapeKyc(e.payable_after)})` : ''}</span></span>
          <b style="color:var(--papel);font-family:var(--font-mono);white-space:nowrap;">${this.formatCop(e.amount_gross_cop)}</b>
        </div>`;
      }).join('');
    }

    if (this.liqPayouts.length === 0) {
      histEl.innerHTML = `<p style="font-size:12px;color:var(--humo);">Sin desembolsos registrados.</p>`;
    } else {
      histEl.innerHTML = this.liqPayouts.map((p) => {
        const name = this.escapeKyc(this.liqPayeeNames.get(p.payee_uid) || p.payee_uid);
        return `<div style="display:flex;justify-content:space-between;align-items:center;gap:8px;font-size:11.5px;color:var(--humo);border:1px solid var(--linea);border-radius:10px;padding:10px 12px;background:rgba(46,107,84,.07);">
          <span><b style="color:var(--papel);">${name}</b> · ${this.formatCop(p.gross_cop)} · ref <b style="font-family:var(--font-mono);">${this.escapeKyc(p.transfer_reference || '—')}</b><br/>
          <span style="font-family:var(--font-mono);font-size:10.5px;">${this.escapeKyc(p.reconciled_at || p.createdAt || '')} · ${p.ledger_entry_ids.length} asientos</span></span>
          <button class="btn sa-liq-reverse" data-payout="${this.escapeKyc(p.id)}" style="font-size:10.5px;padding:7px 12px;border-color:var(--vino);white-space:nowrap;">↩️ Reversar</button>
        </div>`;
      }).join('');
      histEl.querySelectorAll('.sa-liq-reverse').forEach((b) =>
        b.addEventListener('click', () => this.openReverseModal((b as HTMLElement).getAttribute('data-payout') || '')));
    }
  }

  private async openPayoutModal(payeeUid: string): Promise<void> {
    this.payoutModalPayee = payeeUid;
    this.payoutModalEntries = this.liqEntries.filter((e) => e.payee_uid === payeeUid && e.status === 'payable');
    const overlay = document.getElementById('sa-payout-overlay');
    const summary = document.getElementById('sa-payout-summary');
    if (!overlay || !summary) return;
    const total = this.payoutModalEntries.reduce((s, e) => s + (e.amount_gross_cop || 0), 0);
    const name = this.liqPayeeNames.get(payeeUid) || payeeUid;
    const tipo = this.payoutModalEntries[0]?.payee_type === 'host' ? 'hoster' : 'scout';
    summary.innerHTML = `<b style="color:var(--papel);">${this.escapeKyc(name)}</b> <span style="font-family:var(--font-mono);font-size:11px;">(${tipo})</span><br/>
      Total bruto: <b style="color:var(--luz);font-family:var(--font-mono);">${this.formatCop(total)}</b> · ${this.payoutModalEntries.length} asientos incluidos.`;
    (document.getElementById('sa-payout-rut') as HTMLInputElement | null)!.checked = false;
    (document.getElementById('sa-payout-pila') as HTMLInputElement | null)!.checked = false;
    (document.getElementById('sa-payout-bank') as HTMLInputElement | null)!.checked = false;
    (document.getElementById('sa-payout-ref') as HTMLInputElement | null)!.value = '';
    const warn = document.getElementById('sa-payout-taxwarn');
    if (warn) warn.style.display = 'none';
    overlay.style.display = 'flex';
    this.validatePayoutForm();
    const scroll = overlay.querySelector('div');
    if (scroll) scroll.scrollTop = 0;
  }

  private closePayoutModal(): void {
    const overlay = document.getElementById('sa-payout-overlay');
    if (overlay) overlay.style.display = 'none';
    this.payoutModalEntries = [];
    this.payoutModalPayee = '';
  }

  private validatePayoutForm(): void {
    const rut = (document.getElementById('sa-payout-rut') as HTMLInputElement | null)?.checked === true;
    const pila = (document.getElementById('sa-payout-pila') as HTMLInputElement | null)?.checked === true;
    const bank = (document.getElementById('sa-payout-bank') as HTMLInputElement | null)?.checked === true;
    const ref = ((document.getElementById('sa-payout-ref') as HTMLInputElement | null)?.value || '').trim();
    const btn = document.getElementById('sa-payout-confirm') as HTMLButtonElement | null;
    const ok = rut && pila && bank && ref.length > 0 && this.payoutModalEntries.length > 0;
    if (btn) {
      btn.disabled = !ok;
      btn.style.opacity = ok ? '1' : '0.5';
      btn.style.cursor = ok ? 'pointer' : 'not-allowed';
    }
  }

  private async confirmPayout(): Promise<void> {
    const btn = document.getElementById('sa-payout-confirm') as HTMLButtonElement | null;
    const ref = ((document.getElementById('sa-payout-ref') as HTMLInputElement | null)?.value || '').trim();
    const warn = document.getElementById('sa-payout-taxwarn');
    if (this.payoutModalEntries.length === 0 || !ref) return;
    const approverUid = Auth.currentUser?.uid || 'superadmin';
    if (btn) { btn.disabled = true; btn.textContent = 'Procesando…'; }
    try {
      const payeeUid = this.payoutModalPayee;
      const taxProfile = await this.resolveTaxProfile(payeeUid, this.payoutModalEntries[0]?.payee_type);
      if (warn) warn.style.display = 'none';
      if (!taxProfile.rutVerified || !this.isPilaCurrent(taxProfile.pilaVerified, taxProfile.pilaPeriod)) {
        if (warn) {
          warn.textContent = '⛔ Sin RUT/PILA vigentes no podemos aprobar este pago. Actualiza el perfil fiscal en Scouts & Hosters.';
          warn.style.display = 'block';
        }
        await RondaDialog.alert({ title: 'Bloqueo fiscal', message: 'Sin RUT/PILA vigentes no podemos aprobar tu pago.', icon: '⛔', type: 'danger' });
        return;
      }
      const alreadyPaid = this.payoutModalEntries.some((e) => e.status === 'paid' || !!e.payout_id);
      if (alreadyPaid) {
        await RondaDialog.alert({ title: 'Ya liquidado', message: 'Uno o más asientos ya fueron pagados. Recargando el ledger…', icon: 'ℹ️' });
        this.closePayoutModal();
        await this.loadLiquidaciones();
        return;
      }
      const { payout, updatedEntries } = this.b2bEngine.approvePayout(
        this.payoutModalEntries, approverUid, 'superadmin', ref, true,
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
      await this.loadLiquidaciones();
      await RondaDialog.alert({ title: 'Desembolso registrado 💸', message: `Payout <b>${this.escapeKyc(payout.id)}</b> conciliado por <b>${this.formatCop(payout.gross_cop)}</b> con ref <b>${this.escapeKyc(ref)}</b>.`, icon: '✅' });
    } catch (err: any) {
      console.error('[SuperAdmin] Error aprobando desembolso:', err);
      await RondaDialog.alert({ title: 'No se pudo aprobar', message: err?.message || String(err), icon: '⚠️', type: 'danger' });
    } finally {
      if (btn) { btn.textContent = 'Aprobar desembolso'; this.validatePayoutForm(); }
    }
  }

  private async resolveTaxProfile(payeeUid: string, payeeType?: string): Promise<{ rutVerified: boolean; pilaVerified: boolean; pilaPeriod?: string }> {
    try {
      const docProfile = payeeType === 'host' ? await DB.getHost(payeeUid) : await DB.getScout(payeeUid);
      if (docProfile) return { rutVerified: !!docProfile.rutVerified, pilaVerified: !!docProfile.pilaVerified, pilaPeriod: docProfile.pilaPeriod };
      const other = payeeType === 'host' ? await DB.getScout(payeeUid) : await DB.getHost(payeeUid);
      if (other) return { rutVerified: !!other.rutVerified, pilaVerified: !!other.pilaVerified, pilaPeriod: other.pilaPeriod };
    } catch (e) {
      console.warn('[SuperAdmin] No se pudo leer perfil fiscal:', e);
    }
    return { rutVerified: false, pilaVerified: false };
  }

  private openReverseModal(payoutId: string): void {
    const p = this.liqPayouts.find((x) => x.id === payoutId) || null;
    this.reversePayoutTarget = p;
    const overlay = document.getElementById('sa-reverse-overlay');
    const info = document.getElementById('sa-reverse-info');
    const reason = document.getElementById('sa-reverse-reason') as HTMLTextAreaElement | null;
    if (!overlay || !p) return;
    if (info) info.innerHTML = `Payout <b style="font-family:var(--font-mono);">${this.escapeKyc(p.id)}</b> · ${this.formatCop(p.gross_cop)} · ${p.ledger_entry_ids.length} asientos. Se generará un asiento contrario <b>sin borrar</b> el original.`;
    if (reason) reason.value = '';
    overlay.style.display = 'flex';
    this.validateReverseForm();
  }

  private closeReverseModal(): void {
    const overlay = document.getElementById('sa-reverse-overlay');
    if (overlay) overlay.style.display = 'none';
    this.reversePayoutTarget = null;
  }

  private validateReverseForm(): void {
    const reason = ((document.getElementById('sa-reverse-reason') as HTMLTextAreaElement | null)?.value || '').trim();
    const btn = document.getElementById('sa-reverse-confirm') as HTMLButtonElement | null;
    const ok = !!this.reversePayoutTarget && reason.length >= 5;
    if (btn) {
      btn.disabled = !ok;
      btn.style.opacity = ok ? '1' : '0.5';
      btn.style.cursor = ok ? 'pointer' : 'not-allowed';
    }
  }

  private async confirmReverse(): Promise<void> {
    const reason = ((document.getElementById('sa-reverse-reason') as HTMLTextAreaElement | null)?.value || '').trim();
    const btn = document.getElementById('sa-reverse-confirm') as HTMLButtonElement | null;
    const target = this.reversePayoutTarget;
    if (!target || reason.length < 5) return;
    const authorizer = Auth.currentUser?.uid || 'superadmin';
    if (btn) { btn.disabled = true; btn.textContent = 'Generando…'; }
    try {
      const entriesById = new Map(this.liqEntries.map((e) => [e.id, e]));
      let created = 0;
      for (const entryId of target.ledger_entry_ids) {
        const orig = entriesById.get(entryId);
        if (!orig) continue;
        const reversal = this.b2bEngine.processReversal(orig, reason, authorizer);
        const exists = this.liqEntries.some((e) => e.idempotency_key === reversal.idempotency_key);
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
      await this.loadLiquidaciones();
      await RondaDialog.alert({ title: 'Reverso generado ↩️', message: `Se crearon <b>${created}</b> asientos contrarios enlazados al payout. El original se conserva.`, icon: '✅' });
    } catch (err: any) {
      console.error('[SuperAdmin] Error generando reverso:', err);
      await RondaDialog.alert({ title: 'No se pudo reversar', message: err?.message || String(err), icon: '⚠️', type: 'danger' });
    } finally {
      if (btn) { btn.textContent = 'Generar reverso'; this.validateReverseForm(); }
    }
  }

  // ============ T2: Alta/gestión de Scouts y Hosters ============
  private async loadPeople(): Promise<void> {
    const list = document.getElementById('sa-people-list');
    if (!list) return;
    list.innerHTML = `<p style="font-size:12px;color:var(--humo);">Cargando…</p>`;
    try {
      const [scouts, hosts] = await Promise.all([
        DB.getScouts().catch(() => [] as Scout[]),
        DB.getHosts().catch(() => [] as Host[]),
      ]);
      const month = this.currentBogotaMonth();
      const card = (kind: 'scout' | 'hoster', uid: string, name: string, email: string, status: string, rut?: boolean, pila?: boolean, pilaPeriod?: string) => {
        const pilaOk = this.isPilaCurrent(pila, pilaPeriod);
        const badge = (ok: boolean, label: string) =>
          `<span style="font-size:9.5px;font-family:var(--font-mono);padding:2px 8px;border-radius:999px;border:1px solid ${ok ? 'var(--botella)' : 'var(--vino)'};color:${ok ? 'var(--botella)' : '#ff8ca8'};">${ok ? '✓' : '✕'} ${label}</span>`;
        return `<div style="display:flex;justify-content:space-between;align-items:center;gap:8px;font-size:11.5px;color:var(--humo);border:1px solid var(--linea);border-radius:10px;padding:10px 12px;">
          <span><b style="color:var(--papel);">${this.escapeKyc(name || uid)}</b>
          <span style="font-family:var(--font-mono);font-size:10px;"> · ${kind} · ${this.escapeKyc(status)}${email ? ` · ${this.escapeKyc(email)}` : ''}</span><br/>
          <span style="display:inline-flex;gap:6px;margin-top:6px;flex-wrap:wrap;">${badge(!!rut, 'RUT')}${badge(pilaOk, pilaPeriod === month ? `PILA ${month}` : 'PILA vigente')}</span></span>
          <span style="font-family:var(--font-mono);font-size:10px;color:var(--humo);">${this.escapeKyc(uid)}</span>
        </div>`;
      };
      const html = [
        ...scouts.map((s) => card('scout', s.uid, s.name || '', s.email || '', s.status, s.rutVerified, s.pilaVerified, s.pilaPeriod)),
        ...hosts.map((h) => card('hoster', h.uid, h.name || '', h.email || '', h.status, h.rutVerified, h.pilaVerified, h.pilaPeriod)),
      ].join('');
      list.innerHTML = html || `<p style="font-size:12px;color:var(--humo);">Sin scouts ni hosters registrados.</p>`;
    } catch (err) {
      console.error('[SuperAdmin] Error cargando personas:', err);
      list.innerHTML = `<p style="font-size:12px;color:var(--vino);">⚠️ No se pudo cargar la lista.</p>`;
    }
  }

  private async savePerson(): Promise<void> {
    const type = (document.getElementById('sa-people-type') as HTMLSelectElement | null)?.value === 'host' ? 'host' : 'scout';
    const uid = ((document.getElementById('sa-people-uid') as HTMLInputElement | null)?.value || '').trim();
    const name = ((document.getElementById('sa-people-name') as HTMLInputElement | null)?.value || '').trim();
    const email = ((document.getElementById('sa-people-email') as HTMLInputElement | null)?.value || '').trim();
    const status = ((document.getElementById('sa-people-status') as HTMLSelectElement | null)?.value === 'inactive' ? 'inactive' : 'active') as 'active' | 'inactive';
    const contract = ((document.getElementById('sa-people-contract') as HTMLInputElement | null)?.value || '').trim();
    const rut = (document.getElementById('sa-people-rut') as HTMLInputElement | null)?.checked === true;
    const pila = (document.getElementById('sa-people-pila') as HTMLInputElement | null)?.checked === true;
    if (!uid) {
      await RondaDialog.alert({ title: 'UID requerido', message: 'Ingresa el UID de Firebase Auth del colaborador.', icon: '⚠️', type: 'danger' });
      return;
    }
    const by = Auth.currentUser?.uid || 'superadmin';
    const now = new Date().toISOString();
    try {
      if (type === 'host') {
        const prev = await DB.getHost(uid).catch(() => null);
        await DB.saveHost({
          uid, name: name || prev?.name || uid, email: email || prev?.email || '',
          status, contract_id: contract || prev?.contract_id || '',
          rutVerified: rut, pilaVerified: pila, pilaPeriod: pila ? this.currentBogotaMonth() : prev?.pilaPeriod,
          tax_verified_by: by, tax_verified_at: now,
        });
      } else {
        const prev = await DB.getScout(uid).catch(() => null);
        await DB.saveScout({
          uid, name: name || prev?.name || uid, email: email || prev?.email || '',
          status, contract_id: contract || prev?.contract_id || '',
          rutVerified: rut, pilaVerified: pila, pilaPeriod: pila ? this.currentBogotaMonth() : prev?.pilaPeriod,
          tax_verified_by: by, tax_verified_at: now,
        });
      }
      await DB.logAudit({
        actor_uid: by, actor_type: 'superadmin', entity_type: type === 'host' ? 'host' : 'scout',
        entity_id: uid, action: type === 'host' ? 'host_upserted' : 'scout_upserted',
        new_state: { uid, status, rutVerified: rut, pilaVerified: pila }, timestamp: now,
        reason: 'Alta/gestión manual desde SuperAdmin',
      });
      await this.loadPeople();
      await this.loadLiquidaciones();
      await RondaDialog.alert({ title: 'Guardado ✅', message: `Colaborador <b>${this.escapeKyc(uid)}</b> (${type}) guardado con RUT ${rut ? '✓' : '✕'} y PILA ${pila ? `✓ ${this.currentBogotaMonth()}` : '✕'}.`, icon: '✅' });
    } catch (err: any) {
      console.error('[SuperAdmin] Error guardando persona:', err);
      await RondaDialog.alert({ title: 'No se pudo guardar', message: err?.message || String(err), icon: '⚠️', type: 'danger' });
    }
  }

  private parseCopAmount(formatted?: string): number {
    if (!formatted) return 0;
    const digits = String(formatted).replace(/[^\d]/g, '');
    if (!digits) return 0;
    const n = Number(digits);
    return Number.isFinite(n) ? n : 0;
  }

  // =========================================================================
  // T-8.2: Tokens de inversión Pista Privada FFF (colección invest_tokens)
  // =========================================================================

  private async loadTokens(): Promise<void> {
    const list = document.getElementById('sa-tokens-list');
    const empty = document.getElementById('sa-tokens-empty');
    const count = document.getElementById('sa-tokens-count');
    if (!list) return;
    this.tokensLoading = true;
    try {
      const q = query(collection(RondaServices.db, 'invest_tokens'), limit(200));
      const snap = await getDocs(q);
      this.tokens = [];
      snap.forEach((d) => {
        const data = d.data() as Partial<InvestToken>;
        this.tokens.push({
          token: d.id,
          name: data.name || '',
          leadId: data.leadId || '',
          role: (data.role || 'investor') as InvestToken['role'],
          ring: (data.ring || 'GEN') as InvestToken['ring'],
          active: data.active ?? true,
          createdAt: data.createdAt || new Date().toISOString(),
          phone: data.phone || undefined,
          notes: data.notes || undefined,
        });
      });
      this.tokens.sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
      if (count) count.textContent = `${this.tokens.length} token${this.tokens.length === 1 ? '' : 's'} emitido${this.tokens.length === 1 ? '' : 's'}`;
      if (this.tokens.length === 0) {
        list.style.display = 'none';
        if (empty) empty.style.display = '';
      } else {
        list.style.display = '';
        if (empty) empty.style.display = 'none';
        list.innerHTML = this.renderTokens();
        this.bindTokenListeners();
      }
    } catch (err) {
      console.error('[SuperAdmin] Error cargando tokens de inversión:', err);
      if (list) list.innerHTML = `<p style="font-size:12px;color:var(--vino);">⚠️ No se pudo cargar los tokens.</p>`;
    } finally {
      this.tokensLoading = false;
    }
  }

  private renderTokens(): string {
    return this.tokens.map((t) => {
      const active = t.active !== false;
      const badge = active
        ? '<span style="display:inline-block;font-size:10px;font-family:var(--font-mono);font-weight:700;color:#79D3AC;border:1px solid rgba(121,211,172,0.45);border-radius:6px;padding:2px 8px;background:rgba(46,107,84,0.12);">✅ Activo</span>'
        : '<span style="display:inline-block;font-size:10px;font-family:var(--font-mono);font-weight:700;color:#ff5252;border:1px solid rgba(255,82,82,0.45);border-radius:6px;padding:2px 8px;background:rgba(155,39,72,0.12);">🚫 Revocado</span>';
      return `
        <div style="display:flex;justify-content:space-between;gap:10px;align-items:center;border:1px solid var(--linea);border-radius:10px;padding:10px 12px;background:rgba(243,237,226,0.03);font-size:12.5px;color:var(--papel);flex-wrap:wrap;">
          <div style="min-width:170px;">
            <div style="display:flex;align-items:center;gap:8px;"><b style="color:var(--papel);">${this.escapeKyc(t.name)}</b> <span style="font-family:var(--font-mono);font-size:10.5px;color:var(--humo);">${this.escapeKyc(t.token)}</span></div>
            <div style="font-size:10px;color:var(--humo);margin-top:2px;">${this.escapeKyc(t.leadId || t.token)} · ${this.escapeKyc(t.ring)}${t.phone ? ` · ${this.escapeKyc(t.phone)}` : ''}</div>
            ${t.notes ? `<div style="font-size:10px;color:var(--humo);margin-top:2px;">${this.escapeKyc(t.notes)}</div>` : ''}
          </div>
          ${badge}
          <div style="display:flex;gap:6px;">
            <button class="btn-mini" data-action="copy" data-token="${this.escapeKyc(t.token)}" title="Copiar enlace de inversión">📋 Link</button>
            <button class="btn-mini" data-action="wa" data-token="${this.escapeKyc(t.token)}" data-name="${this.escapeKyc(t.name)}" title="Enviar por WhatsApp">💬 WhatsApp</button>
            <button class="btn-mini" data-action="toggle" data-token="${this.escapeKyc(t.token)}" data-active="${active}" title="${active ? 'Revocar token' : 'Activar token'}">${active ? '🚫 Revocar' : '✅ Activar'}</button>
            <button class="btn-mini" data-action="delete" data-token="${this.escapeKyc(t.token)}" title="Eliminar token">🗑️ Eliminar</button>
          </div>
        </div>
      `;
    }).join('');
  }

  private bindTokenListeners(): void {
    const list = document.getElementById('sa-tokens-list');
    if (!list || list.dataset.bound === '1') return;
    list.dataset.bound = '1';
    list.addEventListener('click', async (e) => {
      const target = (e.target as HTMLElement).closest('[data-action]') as HTMLElement | null;
      if (!target || !list.contains(target)) return;
      const action = target.getAttribute('data-action');
      const token = target.getAttribute('data-token') || '';
      if (!token) return;
      try {
        if (action === 'copy') {
          await navigator.clipboard.writeText(`https://ronda-uno.web.app/invest.html?token=${token}`);
          const prev = target.textContent;
          target.textContent = '✅ Copiado';
          setTimeout(() => { target.textContent = prev; }, 1500);
        } else if (action === 'wa') {
          const name = target.getAttribute('data-name') || '';
          const text = `Hola ${name}, este es tu enlace de acceso privado a la Pista Privada FFF de RONDA:\nhttps://ronda-uno.web.app/invest.html?token=${token}`;
          await navigator.clipboard.writeText(text);
          const prev = target.textContent;
          target.textContent = '✅ Copiado';
          setTimeout(() => { target.textContent = prev; }, 1500);
        } else if (action === 'toggle') {
          const active = target.getAttribute('data-active') === 'true';
          await this.toggleToken(token, !active);
        } else if (action === 'delete') {
          const confirmed = await RondaDialog.confirm({
            title: 'Eliminar token',
            message: `¿Seguro que deseas revocar y eliminar el token <b>${this.escapeKyc(token)}</b>? Esta acción no se puede deshacer.`,
            icon: '🗑️',
            type: 'danger',
            confirmText: '✓ Eliminar',
            cancelText: '✕ Cancelar',
          });
          if (confirmed) await this.deleteToken(token);
        }
      } catch (err) {
        console.error('[SuperAdmin] Error en acción de token:', err);
        await RondaDialog.alert({ title: 'Error', message: err instanceof Error ? err.message : String(err), icon: '⚠️', type: 'danger' });
      }
    });
  }

  private async emitToken(): Promise<void> {
    const nameEl = document.getElementById('sa-token-name') as HTMLInputElement | null;
    const ringEl = document.getElementById('sa-token-ring') as HTMLSelectElement | null;
    const tokenEl = document.getElementById('sa-token-token') as HTMLInputElement | null;
    const phoneEl = document.getElementById('sa-token-phone') as HTMLInputElement | null;
    const notesEl = document.getElementById('sa-token-notes') as HTMLInputElement | null;
    if (!nameEl || !ringEl || !tokenEl) return;
    const name = nameEl.value.trim();
    const ring = ringEl.value || 'GEN';
    let token = tokenEl.value.trim().toLowerCase();
    const phone = phoneEl ? phoneEl.value.trim() || undefined : undefined;
    const notes = notesEl ? notesEl.value.trim() || undefined : undefined;
    if (!name) {
      await RondaDialog.alert({ title: 'Nombre requerido', message: 'Ingresa el Nombre Completo del invitado.', icon: '⚠️', type: 'danger' });
      nameEl.focus();
      return;
    }
    if (!token) token = `rnd-${ring.toLowerCase()}-${this.slugify(name)}`;
    if (!/^[a-z0-9-]+$/.test(token)) {
      await RondaDialog.alert({ title: 'Token inválido', message: 'Usa solo minúsculas, números y guiones (ej. rnd-a1-cesar-perez).', icon: '⚠️', type: 'danger' });
      tokenEl.focus();
      return;
    }
    if (!token.startsWith('rnd-')) token = `rnd-${token}`;
    const by = Auth.currentUser?.uid || 'superadmin';
    const now = new Date().toISOString();
    const entry: InvestToken = { token, name, leadId: '', role: 'investor', ring: ring as InvestToken['ring'], active: true, createdAt: now, phone, notes };
    try {
      await setDoc(doc(RondaServices.db, 'invest_tokens', token), entry);
      try {
        await DB.logAudit({
          actor_uid: by, actor_type: 'superadmin', entity_type: 'invest_token', entity_id: token,
          action: 'invest_token_issued', new_state: { token, name, ring, active: true }, timestamp: now,
          reason: 'Emisión de token Pista Privada FFF desde SuperAdmin',
        });
      } catch {}
      tokenEl.value = '';
      await this.loadTokens();
    } catch (err: any) {
      console.error('[SuperAdmin] Error emitiendo token:', err);
      await RondaDialog.alert({ title: 'No se pudo emitir', message: err?.message || String(err), icon: '⚠️', type: 'danger' });
    }
  }

  private async toggleToken(tokenId: string, active: boolean): Promise<void> {
    try {
      await updateDoc(doc(RondaServices.db, 'invest_tokens', tokenId), { active, updatedAt: new Date().toISOString(), updated_by: Auth.currentUser?.uid || 'superadmin' });
      await this.loadTokens();
    } catch (err: any) {
      console.error('[SuperAdmin] Error toggle token:', err);
      await RondaDialog.alert({ title: 'No se pudo actualizar', message: err?.message || String(err), icon: '⚠️', type: 'danger' });
    }
  }

  private async deleteToken(tokenId: string): Promise<void> {
    try {
      await deleteDoc(doc(RondaServices.db, 'invest_tokens', tokenId));
      await this.loadTokens();
    } catch (err: any) {
      console.error('[SuperAdmin] Error eliminando token:', err);
      await RondaDialog.alert({ title: 'No se pudo eliminar', message: err?.message || String(err), icon: '⚠️', type: 'danger' });
    }
  }

  private slugify(name: string): string {
    return String(name)
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60);
  }
}

export const SuperAdmin = new SuperAdminController();
