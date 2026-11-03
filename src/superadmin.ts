import { DB, User, Scout, Host, Reservation } from './db.js';
import { RondaDialog } from './dialog.js';
import { Auth } from './auth.js';
import { escapeHtml } from './utils.js';
import { collection, query, where, getDocs, doc, setDoc, updateDoc, deleteDoc, limit, getCountFromServer } from 'firebase/firestore';
import { RondaServices } from './firebase-config.js';
import { renderRondaFooter } from './footer.js';
import { APP_VERSION } from './version.js';
import { KycPanel } from './panels/kyc-panel.js';
import { TreasuryPanel } from './panels/treasury-panel.js';
import { VenuesPanel } from './panels/venues-panel.js';
import type { SuperAdminSection } from './panels/context.js';

// El shell solo conoce identificadores de sección: cada módulo los declara en
// `src/panels/context.ts` para poder montarse sin depender de este archivo.
export type AdminSection = SuperAdminSection;

// Re-export por compatibilidad: el tipo del caso KYC ahora vive con su módulo.
export type { KycReviewCase } from './panels/kyc-panel.js';

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
  // --- Estado de Navegación del Shell Global ---
  public currentSection: AdminSection = 'summary';
  private currentUser: any = null;

  // --- Módulos independientes montados en #admin-stage ---
  private readonly kyc = new KycPanel();
  private readonly treasury = new TreasuryPanel({ navigate: (section) => void this.switchSection(section) });
  private readonly venues = new VenuesPanel();

  // --- T-8.2: Tokens de inversión Pista Privada FFF ---
  private tokens: InvestToken[] = [];
  private tokensLoading = false;

  constructor() {}

  async init(user?: any) {
    console.log('[SuperAdminController] Inicializando Super Admin Global...');
    this.currentUser = user || Auth.currentUser;
    this.setupShellNavigation();
    renderRondaFooter();
    await this.switchSection('summary');
  }

  // Configura navegación lateral, menú móvil, selector de portal y logout único
  private setupShellNavigation() {
    // 1. Manejo del cajón (drawer) en móvil
    const openBtn = document.getElementById('admin-btn-menu-open');
    const closeBtn = document.getElementById('admin-btn-menu-close');
    const sidebar = document.getElementById('admin-sidebar');
    const overlay = document.getElementById('admin-sidebar-overlay');

    const toggleDrawer = (open: boolean) => {
      if (sidebar) sidebar.classList.toggle('open', open);
      if (overlay) overlay.style.display = open ? 'block' : 'none';
    };

    openBtn?.addEventListener('click', () => toggleDrawer(true));
    closeBtn?.addEventListener('click', () => toggleDrawer(false));
    overlay?.addEventListener('click', () => toggleDrawer(false));

    // 2. Navegación entre secciones
    document.querySelectorAll<HTMLElement>('.admin-nav-item').forEach((item) => {
      item.addEventListener('click', () => {
        const sec = item.getAttribute('data-section') as AdminSection;
        if (sec) {
          void this.switchSection(sec);
          toggleDrawer(false);
        }
      });
    });

    // 3. Selector de saltar a portal
    const portalSelect = document.getElementById('admin-portal-switch') as HTMLSelectElement | null;
    portalSelect?.addEventListener('change', () => {
      if (portalSelect.value) {
        window.location.href = portalSelect.value;
      }
    });

    // 4. Logout único en el pie del sidebar
    const logoutBtn = document.getElementById('admin-btn-logout');
    logoutBtn?.addEventListener('click', async () => {
      const confirmLogout = await RondaDialog.confirm({
        title: 'Cerrar Sesión',
        message: '¿Estás seguro de que deseas salir del panel SuperAdmin?',
        confirmText: 'Cerrar Sesión',
        cancelText: 'Cancelar',
        icon: '🚪'
      });
      if (confirmLogout) {
        await Auth.logout();
        window.location.href = '/index.html';
      }
    });

    // 5. Cargar perfil de usuario en el sidebar
    this.updateUserSidebarProfile();
  }

  private updateUserSidebarProfile() {
    const user = this.currentUser || Auth.currentUser;
    const nameEl = document.getElementById('admin-user-name');
    const roleEl = document.getElementById('admin-user-role');
    const avatarEl = document.getElementById('admin-user-avatar');

    const displayName = user?.name || user?.displayName || user?.email?.split('@')[0] || 'César Dela Croix';
    const initial = displayName.charAt(0).toUpperCase();

    if (nameEl) nameEl.textContent = displayName;
    if (roleEl) roleEl.textContent = user?.role ? user.role.toUpperCase() : 'SUPERADMIN';
    if (avatarEl) avatarEl.textContent = initial;
  }

  // Cambia la vista activa del SuperAdmin
  public async switchSection(section: AdminSection): Promise<void> {
    this.currentSection = section;

    // Actualizar clase activa en el menú lateral
    document.querySelectorAll<HTMLElement>('.admin-nav-item').forEach((item) => {
      const isTarget = item.getAttribute('data-section') === section;
      item.classList.toggle('active', isTarget);
    });

    // Renderizar cabecera modular
    this.renderHeader(section);

    // Renderizar cuerpo del escenario
    await this.renderSectionContent(section);
  }

  // Renderiza la cabecera dinámica de cada vista
  private renderHeader(section: AdminSection) {
    const titleEl = document.getElementById('admin-view-title');
    const subtitleEl = document.getElementById('admin-view-subtitle');
    const actionsEl = document.getElementById('admin-header-actions');
    const filtersEl = document.getElementById('admin-header-filters');

    if (!titleEl || !subtitleEl || !actionsEl || !filtersEl) return;

    switch (section) {
      case 'summary':
        titleEl.textContent = 'Resumen General';
        subtitleEl.textContent = 'Indicadores clave del ecosistema y accesos directos a los módulos operativos.';
        actionsEl.innerHTML = `
          <button class="btn ambar" id="sa-header-refresh-summary" style="font-size: 11.5px; padding: 8px 16px; font-weight: 700;">
            ↻ Actualizar
          </button>
        `;
        filtersEl.innerHTML = `
          <span style="font-size: 10.5px; color: #79D3AC; font-family: var(--font-mono); background: rgba(121,211,172,0.1); border: 1px solid rgba(121,211,172,0.3); padding: 4px 10px; border-radius: 999px;">
            ● Ecosistema Operativo
          </span>
          <span style="font-size: 10.5px; color: var(--humo); font-family: var(--font-mono);">
            Bogotá D.C. · Versión ${APP_VERSION}
          </span>
        `;
        document.getElementById('sa-header-refresh-summary')?.addEventListener('click', () => {
          void this.loadRealMetrics();
        });
        break;

      case 'kyc':
        titleEl.textContent = 'Verificación KYC';
        subtitleEl.textContent = 'Cola prioritaria de verificación manual: selfie vs documento y validación del umbral biométrico.';
        actionsEl.innerHTML = `
          <button class="btn" id="sa-kyc-refresh" style="font-size: 11.5px; padding: 8px 16px; background: rgba(243,237,226,0.06); border: 1px solid var(--linea); color: var(--papel);">
            ↻ Actualizar cola
          </button>
        `;
        filtersEl.innerHTML = `
          <span style="font-size: 10.5px; color: var(--luz); font-family: var(--font-mono); background: rgba(240,168,48,0.1); border: 1px solid rgba(240,168,48,0.3); padding: 4px 10px; border-radius: 999px;">
            ● Revisión manual · Tier 2
          </span>
          <span style="font-size: 10.5px; color: var(--humo); font-family: var(--font-mono);">
            Aprobar eleva al usuario a Tier 2 y desbloquea reservas
          </span>
        `;
        document.getElementById('sa-kyc-refresh')?.addEventListener('click', () => void this.kyc.refresh());
        break;

      case 'treasury':
        titleEl.textContent = 'Liquidaciones B2B & Tesorería';
        subtitleEl.textContent = 'Gestión de comisiones para Scouts de expansión y Hosters de sala, con bloqueo fiscal por RUT y PILA.';
        actionsEl.innerHTML = `
          <button class="btn" id="sa-liq-refresh" style="font-size: 11.5px; padding: 8px 16px; background: rgba(243,237,226,0.06); border: 1px solid var(--linea); color: var(--papel);">
            ↻ Actualizar
          </button>
        `;
        filtersEl.innerHTML = `
          <span style="font-size: 10.5px; color: var(--humo); font-family: var(--font-mono); border: 1px dashed rgba(240,168,48,0.35); background: rgba(240,168,48,0.06); padding: 4px 10px; border-radius: 999px;">
            🛡️ Validación obligatoria: RUT activo + PILA del mes
          </span>
          <span style="font-size: 10.5px; color: var(--humo); font-family: var(--font-mono);">
            Desembolso exclusivamente manual aprobado por SuperAdmin
          </span>
        `;
        document.getElementById('sa-liq-refresh')?.addEventListener('click', () => void this.treasury.refresh());
        break;

      case 'venues':
        titleEl.textContent = 'Bares y Anfitriones';
        subtitleEl.textContent = 'Alta, ficha comercial y estado operativo de los locales aliados, con exclusividad territorial de 500 m.';
        actionsEl.innerHTML = `
          <button class="btn" id="sa-venues-refresh" style="font-size: 11.5px; padding: 8px 16px; background: rgba(243,237,226,0.06); border: 1px solid var(--linea); color: var(--papel); white-space: nowrap; width: auto; flex: 0 0 auto;">
            ↻ Actualizar
          </button>
          <button class="btn ambar" id="sa-btn-new-venue" style="font-size: 11.5px; padding: 8px 16px; font-weight: 700; white-space: nowrap; width: auto; flex: 0 0 auto;">
            + Registrar Local
          </button>
        `;
        filtersEl.innerHTML = `
          <input type="text" id="sa-venues-search" class="ronda-input" placeholder="🔍 Buscar por nombre, zona o NIT…" style="margin-bottom:0; max-width:260px; font-size:11.5px; padding:6px 12px;">
          <select id="sa-venues-filter" class="ronda-input" style="margin-bottom:0; max-width:180px; font-size:11.5px; padding:6px 10px;">
            <option value="all">Todos los locales</option>
            <option value="active">Activos en red</option>
            <option value="paused">Pausados</option>
          </select>
        `;
        document.getElementById('sa-venues-refresh')?.addEventListener('click', () => void this.venues.refresh());
        document.getElementById('sa-btn-new-venue')?.addEventListener('click', () => this.venues.openCreate());
        break;

      case 'events':
        titleEl.textContent = 'Noches y Eventos';
        subtitleEl.textContent = 'Programación de citas Speed Dating, aforos vendidos y orquestación del motor MEM-RR.';
        actionsEl.innerHTML = `
          <button class="btn ambar" id="sa-btn-new-event" style="font-size: 11.5px; padding: 8px 16px; font-weight: 700;">
            + Programar Noche
          </button>
        `;
        filtersEl.innerHTML = `
          <select class="ronda-input" style="margin-bottom:0; max-width:190px; font-size:11.5px; padding:6px 10px;">
            <option value="upcoming">Próximas noches</option>
            <option value="live">En curso ahora</option>
            <option value="past">Finalizadas</option>
          </select>
          <span style="font-size:11px; color:var(--humo); font-family:var(--font-mono);">Rotación: Rondas de 6 minutos</span>
        `;
        break;

      case 'bookings':
        titleEl.textContent = 'Reservas y Asistentes';
        subtitleEl.textContent = 'Comprobantes de pago Nequi, estado de verificación de identidad y control de acceso.';
        actionsEl.innerHTML = `
          <button class="btn" id="sa-btn-export-bookings" style="font-size: 11.5px; padding: 8px 16px; background: rgba(243,237,226,0.06); border: 1px solid var(--linea); color: var(--papel);">
            📥 Exportar Asistentes
          </button>
        `;
        filtersEl.innerHTML = `
          <input type="text" id="sa-search-booking" class="ronda-input" placeholder="🔍 Buscar por nombre, cédula o UID…" style="margin-bottom:0; max-width:280px; font-size:11.5px; padding:6px 12px;">
          <select id="sa-filter-booking" class="ronda-input" style="margin-bottom:0; max-width:180px; font-size:11.5px; padding:6px 10px;">
            <option value="all">Todas las reservas</option>
            <option value="confirmed">Confirmadas</option>
            <option value="pending">Pendientes de pago</option>
          </select>
        `;
        break;

      case 'waitlist':
        titleEl.textContent = 'Lista de Espera';
        subtitleEl.textContent = 'Demanda acumulada por zonas para apertura y balanceo de nuevas fechas.';
        actionsEl.innerHTML = `
          <button class="btn ambar" id="sa-btn-notify-waitlist" style="font-size: 11.5px; padding: 8px 16px; font-weight: 700;">
            📢 Notificar Nueva Fecha
          </button>
        `;
        filtersEl.innerHTML = `
          <span style="font-size: 11px; color: #F0A830; font-family: var(--font-mono);">
            🔥 389 personas activas en lista de espera
          </span>
        `;
        break;

      case 'users':
        titleEl.textContent = 'Usuarios y Permisos';
        subtitleEl.textContent = 'Simulador de roles, permisos de staff, red de Scouts/Hosters y Pista Privada FFF.';
        actionsEl.innerHTML = ``;
        filtersEl.innerHTML = `
          <span style="font-size: 11px; color: var(--humo); font-family: var(--font-mono);">
            Control administrativo central y emisión de credenciales
          </span>
        `;
        break;

      case 'metrics':
        titleEl.textContent = 'Métricas y Finanzas';
        subtitleEl.textContent = 'Desglose analítico de las 4 líneas de ingresos, márgenes de liquidación y retención.';
        actionsEl.innerHTML = `
          <button class="btn ambar" id="sa-btn-download-report" style="font-size: 11.5px; padding: 8px 16px; font-weight: 700;">
            📊 Descargar Reporte
          </button>
        `;
        filtersEl.innerHTML = `
          <select class="ronda-input" style="margin-bottom:0; max-width:180px; font-size:11.5px; padding:6px 10px;">
            <option value="month">Mes en curso (Octubre)</option>
            <option value="q4">Q4 2026</option>
            <option value="all">Histórico completo</option>
          </select>
        `;
        break;

      case 'settings':
        titleEl.textContent = 'Configuración del Sistema';
        subtitleEl.textContent = 'Parámetros del motor MEM-RR, reglas de acceso KYC y pasarela de pago.';
        actionsEl.innerHTML = `
          <button class="btn ambar" id="sa-btn-save-settings" style="font-size: 11.5px; padding: 8px 18px; font-weight: 700;">
            💾 Guardar Cambios
          </button>
        `;
        filtersEl.innerHTML = `
          <span style="font-size: 11px; color: var(--humo); font-family: var(--font-mono);">
            Modo de alta seguridad · Cambios auditados en Firebase
          </span>
        `;
        break;
    }
  }

  // Renderiza el contenido del contenedor `#admin-stage`
  private async renderSectionContent(section: AdminSection): Promise<void> {
    const stage = document.getElementById('admin-stage');
    if (!stage) return;

    switch (section) {
      case 'summary':
        this.renderSummarySection(stage);
        break;
      case 'venues':
        await this.venues.render(stage);
        break;
      case 'events':
        await this.renderEventsSection(stage);
        break;
      case 'bookings':
        await this.renderBookingsSection(stage);
        break;
      case 'waitlist':
        await this.renderWaitlistSection(stage);
        break;
      case 'users':
        this.renderUsersSection(stage);
        break;
      case 'metrics':
        this.renderMetricsSection(stage);
        break;
      case 'settings':
        this.renderSettingsSection(stage);
        break;
      // Módulos independientes: cada uno se pinta a sí mismo en el escenario.
      case 'kyc':
        await this.kyc.render(stage);
        break;
      case 'treasury':
        await this.treasury.render(stage);
        break;
    }
  }

  // --- SECCIÓN 1: RESUMEN GENERAL ---
  private renderSummarySection(stage: HTMLElement) {
    const venuesCount = Object.keys(DB.memoryDb?.venues || {}).length || 6;

    stage.innerHTML = `
      <div style="display: flex; flex-direction: column; gap: 24px;">
        
        <!-- 4 Líneas de Negocio (KPIs Principales) -->
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 14px;">
          <div id="sa-card-b2c" style="background: rgba(243,237,226,0.04); border: 1px solid var(--linea); border-radius: 14px; padding: 20px;">
            <div style="display:flex; justify-content:space-between; align-items:center;">
              <span style="font-size: 11px; color: var(--humo); font-family: var(--font-mono); text-transform: uppercase;">🎟️ Línea 1: Tickets B2C</span>
              <span style="font-size: 9.5px; font-family: var(--font-mono); color: #79D3AC; background: rgba(121,211,172,0.12); padding: 2px 6px; border-radius: 4px;">Activo</span>
            </div>
            <b id="sa-metric-b2c-value" style="font-size: 28px; color: var(--papel); font-family: var(--font-display); display: block; margin-top: 6px;">$12.450.000</b>
            <span id="sa-metric-b2c-badge" style="display:none; font-size:10px; font-family: var(--font-mono); color: #f0a830; border: 1px dashed rgba(240,168,48,0.5); border-radius: 6px; padding: 2px 6px; margin-top: 4px;">📈 Estimado / Proyectado</span>
            <span id="sa-metric-b2c-sub" style="font-size: 10.5px; color: var(--botella); font-family: var(--font-mono); display:block; margin-top: 6px;">+18% vs semana anterior</span>
          </div>

          <div style="background: rgba(243,237,226,0.04); border: 1px solid var(--linea); border-radius: 14px; padding: 20px;">
            <div style="display:flex; justify-content:space-between; align-items:center;">
              <span style="font-size: 11px; color: var(--humo); font-family: var(--font-mono); text-transform: uppercase;">🏢 Línea 2: SaaS Bares B2B</span>
              <span style="font-size: 9.5px; font-family: var(--font-mono); color: var(--luz); background: rgba(240,168,48,0.12); padding: 2px 6px; border-radius: 4px;">Recurrente</span>
            </div>
            <b style="font-size: 28px; color: var(--luz); font-family: var(--font-display); display: block; margin-top: 6px;">$3.800.000</b>
            <span id="sa-metric-venues-sub" style="font-size: 10.5px; color: var(--humo); font-family: var(--font-mono); display:block; margin-top:6px;">${venuesCount} locales bajo suscripción</span>
          </div>

          <div style="background: rgba(243,237,226,0.04); border: 1px solid var(--linea); border-radius: 14px; padding: 20px;">
            <div style="display:flex; justify-content:space-between; align-items:center;">
              <span style="font-size: 11px; color: var(--humo); font-family: var(--font-mono); text-transform: uppercase;">📊 Línea 3: Data Insights</span>
              <span style="font-size: 9.5px; font-family: var(--font-mono); color: #79D3AC; background: rgba(121,211,172,0.12); padding: 2px 6px; border-radius: 4px;">B2B</span>
            </div>
            <b style="font-size: 28px; color: var(--papel); font-family: var(--font-display); display: block; margin-top: 6px;">$2.100.000</b>
            <span style="font-size: 10.5px; color: var(--humo); font-family: var(--font-mono); display:block; margin-top:6px;">Reportes de Maridaje & Consumo</span>
          </div>

          <div style="background: rgba(243,237,226,0.04); border: 1px solid var(--linea); border-radius: 14px; padding: 20px;">
            <div style="display:flex; justify-content:space-between; align-items:center;">
              <span style="font-size: 11px; color: var(--humo); font-family: var(--font-mono); text-transform: uppercase;">🍸 Línea 4: Segunda Cita</span>
              <span style="font-size: 9.5px; font-family: var(--font-mono); color: #ff8ca8; background: rgba(255,140,168,0.12); padding: 2px 6px; border-radius: 4px;">Comisión 25%</span>
            </div>
            <b style="font-size: 28px; color: #ff8ca8; font-family: var(--font-display); display: block; margin-top: 6px;">$1.650.000</b>
            <span style="font-size: 10.5px; color: var(--humo); font-family: var(--font-mono); display:block; margin-top:6px;">Monetización de Match Exitoso</span>
          </div>
        </div>

        <!-- Infrastructure & Security Health Status -->
        <div style="background: rgba(20, 15, 26, 0.6); border: 1px solid var(--linea); border-radius: 16px; padding: 20px;">
          <h4 style="font-family: var(--font-display); font-size: 16px; color: var(--papel); margin: 0 0 14px;">⚡ Estado del Ecosistema RONDA</h4>
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 12px;">
            <div style="display: flex; align-items: center; gap: 12px; background: rgba(243,237,226,0.03); padding: 12px 14px; border-radius: 10px; border: 1px solid rgba(243,237,226,0.08);">
              <span style="font-size: 20px;">🔥</span>
              <div>
                <b style="font-size: 12px; color: var(--papel); display: block;">Firebase Firestore</b>
                <span style="font-size: 10px; color: #79D3AC; font-family: var(--font-mono);">● Operativo (v10)</span>
              </div>
            </div>

            <div style="display: flex; align-items: center; gap: 12px; background: rgba(243,237,226,0.03); padding: 12px 14px; border-radius: 10px; border: 1px solid rgba(243,237,226,0.08);">
              <span style="font-size: 20px;">💚</span>
              <div>
                <b style="font-size: 12px; color: var(--papel); display: block;">Pagos Nequi</b>
                <span style="font-size: 10px; color: #79D3AC; font-family: var(--font-mono);">● Cobro Manual Activo</span>
              </div>
            </div>

            <div style="display: flex; align-items: center; gap: 12px; background: rgba(243,237,226,0.03); padding: 12px 14px; border-radius: 10px; border: 1px solid rgba(243,237,226,0.08);">
              <span style="font-size: 20px;">🛡️</span>
              <div>
                <b style="font-size: 12px; color: var(--papel); display: block;">Biometría & OCR</b>
                <span style="font-size: 10px; color: #79D3AC; font-family: var(--font-mono);">● MediaPipe + Tesseract</span>
              </div>
            </div>

            <div style="display: flex; align-items: center; gap: 12px; background: rgba(243,237,226,0.03); padding: 12px 14px; border-radius: 10px; border: 1px solid rgba(243,237,226,0.08);">
              <span style="font-size: 20px;">🔄</span>
              <div>
                <b style="font-size: 12px; color: var(--papel); display: block;">Motor Round-Robin</b>
                <span style="font-size: 10px; color: #79D3AC; font-family: var(--font-mono);">● Algoritmo MEM-RR</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Accesos rápidos: cada bloque vive ahora en su propia sección del menú -->
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 16px;">
          <button id="sa-goto-kyc" class="sa-quick-link">
            <span style="font-size:22px;">🛡️</span>
            <span style="display:flex; flex-direction:column; gap:3px; flex:1;">
              <b style="font-family:var(--font-display); font-size:14px; color:var(--papel);">Verificación KYC</b>
              <span style="font-size:11.5px; color:var(--humo);">Cola prioritaria de verificación manual de identidad.</span>
            </span>
            <span style="font-size:15px; color:var(--luz);">→</span>
          </button>

          <button id="sa-goto-treasury" class="sa-quick-link">
            <span style="font-size:22px;">💸</span>
            <span style="display:flex; flex-direction:column; gap:3px; flex:1;">
              <b style="font-family:var(--font-display); font-size:14px; color:var(--papel);">Liquidaciones B2B & Tesorería</b>
              <span style="font-size:11.5px; color:var(--humo);">Comisiones de Scouts y Hosters, desembolsos y validación RUT/PILA.</span>
            </span>
            <span style="font-size:15px; color:var(--luz);">→</span>
          </button>
        </div>

      </div>
    `;

    this.attachSummaryListeners();
    void this.loadRealMetrics();
  }

  private attachSummaryListeners() {
    // Cada módulo vive ahora en su propia sección: el Resumen solo enlaza.
    document.getElementById('sa-goto-kyc')?.addEventListener('click', () => void this.switchSection('kyc'));
    document.getElementById('sa-goto-treasury')?.addEventListener('click', () => void this.switchSection('treasury'));
  }

  // --- SECCIÓN 2: BARES Y ANFITRIONES ---
  // --- SECCIÓN 3: NOCHES Y EVENTOS ---
  private async renderEventsSection(stage: HTMLElement) {
    const events = await DB.getAllEvents();
    const upcomingEvents = events.filter(e => e.status !== 'completed' && e.status !== 'cancelled');
    const nextEvent = upcomingEvents[0];
    const totalSold = events.reduce((acc, e) => acc + (e.participants?.length || 0), 0);
    const totalCapacity = events.reduce((acc, e) => acc + (e.capacity || (e.tables ? e.tables * 2 : 24)), 0);

    stage.innerHTML = `
      <div style="display:flex; flex-direction:column; gap:20px;">
        <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap:14px;">
          <div style="background:rgba(243,237,226,0.04); border:1px solid var(--linea); border-radius:14px; padding:18px;">
            <span style="font-size:11px; color:var(--humo); font-family:var(--font-mono); text-transform:uppercase;">Próxima Noche Speed Dating</span>
            <b style="font-size:24px; color:var(--papel); font-family:var(--font-display); display:block; margin-top:4px;">${nextEvent?.dayDate || 'Por programar'}</b>
            <span style="font-size:11px; color:#79D3AC; font-family:var(--font-mono);">${nextEvent?.venueName || 'Local por asignar'}</span>
          </div>
          <div style="background:rgba(243,237,226,0.04); border:1px solid var(--linea); border-radius:14px; padding:18px;">
            <span style="font-size:11px; color:var(--humo); font-family:var(--font-mono); text-transform:uppercase;">Boletos Vendidos Global</span>
            <b style="font-size:24px; color:var(--luz); font-family:var(--font-display); display:block; margin-top:4px;">${totalSold} / ${totalCapacity || 24} Cupos</b>
            <span style="font-size:11px; color:var(--humo); font-family:var(--font-mono);">${totalCapacity > 0 ? Math.round((totalSold / totalCapacity) * 100) : 0}% aforo cubierto</span>
          </div>
          <div style="background:rgba(243,237,226,0.04); border:1px solid var(--linea); border-radius:14px; padding:18px;">
            <span style="font-size:11px; color:var(--humo); font-family:var(--font-mono); text-transform:uppercase;">Algoritmo en Puerta</span>
            <b style="font-size:24px; color:var(--papel); font-family:var(--font-display); display:block; margin-top:4px;">MEM-RR v2.4</b>
            <span style="font-size:11px; color:#79D3AC; font-family:var(--font-mono);">M2 (Mesas 1 a 1) + M4</span>
          </div>
        </div>

        <div style="background:rgba(20,15,26,0.8); border:1px solid var(--linea); border-radius:16px; padding:22px;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px; flex-wrap:wrap; gap:10px;">
            <h4 style="font-family:var(--font-display); font-size:16px; color:var(--papel); margin:0;">Calendario de Noches Programadas (${events.length})</h4>
            <button id="sa-btn-new-event" class="btn ambar" style="font-size:11px; font-weight:700; padding:6px 14px;">+ Nueva Noche</button>
          </div>
          
          <div style="display:flex; flex-direction:column; gap:12px;">
            ${events.length === 0 ? `
              <div style="background:rgba(243,237,226,0.02); border:1px dashed var(--linea); border-radius:12px; padding:36px; text-align:center;">
                <span style="font-size:28px; display:block; margin-bottom:8px;">📅</span>
                <b style="color:var(--papel); font-size:14px; display:block; margin-bottom:4px;">Sin Noches Registradas</b>
                <p style="color:var(--humo); font-size:12px; margin:0;">Usa el botón "+ Nueva Noche" o ejecuta el script de siembra para habilitar la primera convocatoria oficial.</p>
              </div>
            ` : events.map(e => `
              <div style="display:flex; justify-content:space-between; align-items:center; background:rgba(243,237,226,0.03); border:1px solid var(--linea); border-radius:12px; padding:16px; flex-wrap:wrap; gap:12px;">
                <div style="display:flex; align-items:center; gap:16px;">
                  <div style="font-family:var(--font-mono); text-align:center; padding:8px 12px; background:rgba(240,168,48,0.1); border-radius:8px; border:1px solid rgba(240,168,48,0.25);">
                    <span style="font-size:10px; color:var(--humo); display:block; text-transform:uppercase;">${escapeHtml(e.dayDate?.slice(0,3)) || 'EVE'}</span>
                    <b style="font-size:18px; color:var(--luz);">${e.id.slice(-2)}</b>
                  </div>
                  <div>
                    <b style="font-size:14px; color:var(--papel); display:block;">${escapeHtml(e.name || 'Speed Dating · Noche Clásica')}</b>
                    <span style="font-size:11.5px; color:var(--humo);">${escapeHtml(e.dayDate || 'Fecha por confirmar')} · ${escapeHtml(e.venueName || 'Local asignado')} · ${e.participants?.length || 0} confirmados</span>
                  </div>
                </div>
                <div style="display:flex; align-items:center; gap:10px;">
                  <span style="font-size:10.5px; font-family:var(--font-mono); color:#79D3AC; background:rgba(121,211,172,0.1); padding:4px 10px; border-radius:999px;">${e.status || 'Activa'}</span>
                  <a href="/admin.html" class="btn ambar" style="font-size:11px; padding:7px 14px; text-decoration:none; font-weight:700;">Control en Sala</a>
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      </div>
    `;

    document.getElementById('sa-btn-new-event')?.addEventListener('click', async () => {
      await RondaDialog.alert({
        title: 'Nueva Noche Speed Dating',
        message: 'Para habilitar una nueva noche, selecciona el venue aliado y confirma la disponibilidad de las 12 mesas.',
        icon: '🍸'
      });
    });
  }

  // --- SECCIÓN 4: RESERVAS Y ASISTENTES ---
  private async renderBookingsSection(stage: HTMLElement) {
    const events = await DB.getAllEvents();
    const bookingLists = await Promise.all(events.map(ev => DB.getBookingsForEvent(ev.id)));
    const allBookings: { user: User; reservation: Reservation }[] = bookingLists.flat();

    stage.innerHTML = `
      <div style="display:flex; flex-direction:column; gap:20px;">
        <div style="background:rgba(20,15,26,0.8); border:1px solid var(--linea); border-radius:16px; overflow:hidden;">
          <div style="padding:16px 20px; border-bottom:1px solid var(--linea); display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px;">
            <h4 style="font-family:var(--font-display); font-size:16px; color:var(--papel); margin:0;">Monitor de Asistentes & Check-in (${allBookings.length})</h4>
            <span style="font-size:11px; color:var(--humo); font-family:var(--font-mono);">Sincronización en tiempo real</span>
          </div>
          <div style="overflow-x:auto;">
            <table style="width:100%; border-collapse:collapse; text-align:left;">
              <thead>
                <tr style="border-bottom:1px solid var(--linea); background:rgba(243,237,226,0.02);">
                  <th style="padding:12px 16px; font-size:11px; font-family:var(--font-mono); color:var(--humo); font-weight:600;">ASISTENTE</th>
                  <th style="padding:12px 16px; font-size:11px; font-family:var(--font-mono); color:var(--humo); font-weight:600;">CONTACTO</th>
                  <th style="padding:12px 16px; font-size:11px; font-family:var(--font-mono); color:var(--humo); font-weight:600;">SEDE & NOCHE</th>
                  <th style="padding:12px 16px; font-size:11px; font-family:var(--font-mono); color:var(--humo); font-weight:600;">ESTADO PAGO</th>
                  <th style="padding:12px 16px; font-size:11px; font-family:var(--font-mono); color:var(--humo); font-weight:600;">TIER KYC</th>
                  <th style="padding:12px 16px; font-size:11px; font-family:var(--font-mono); color:var(--humo); font-weight:600; text-align:right;">CHECK-IN</th>
                </tr>
              </thead>
              <tbody id="sa-bookings-table-body">
                ${allBookings.length === 0 ? `
                  <tr>
                    <td colspan="6" style="padding:36px; text-align:center; color:var(--humo);">
                      <span style="font-size:24px; display:block; margin-bottom:6px;">🎟️</span>
                      No hay reservas confirmadas registradas en el sistema aún.
                    </td>
                  </tr>
                ` : allBookings.map(b => `
                  <tr style="border-bottom:1px solid rgba(243,237,226,0.06);">
                    <td style="padding:14px 16px;">
                      <div style="display:flex; align-items:center; gap:10px;">
                        <div style="width:32px; height:32px; border-radius:50%; background:var(--barra-alta); border:1px solid var(--luz); display:flex; align-items:center; justify-content:center; font-size:12px; color:var(--luz); font-weight:700;">${escapeHtml(b.user.name || 'I')[0].toUpperCase()}</div>
                        <div>
                          <b style="color:var(--papel); font-size:13px; display:block;">${escapeHtml(b.user.name || 'Invitado RONDA')}</b>
                          <span style="font-size:10.5px; color:var(--humo); font-family:var(--font-mono);">${escapeHtml(b.user.email || 'Confidencial')}</span>
                        </div>
                      </div>
                    </td>
                    <td style="padding:14px 16px; font-family:var(--font-mono); font-size:11.5px; color:var(--papel);">
                      ${escapeHtml(b.user.phoneNumber || 'N/A')}
                    </td>
                    <td style="padding:14px 16px; font-size:12px; color:var(--papel);">
                      ${escapeHtml(b.reservation.venueName)} · ${escapeHtml(b.reservation.dayDate)}
                    </td>
                    <td style="padding:14px 16px;">
                      <span style="font-size:10.5px; font-family:var(--font-mono); color:#79D3AC; background:rgba(121,211,172,0.1); padding:2px 8px; border-radius:999px;">${b.user.paymentPending ? '⚠️ Pendiente Puerta' : '✅ Pagado Wompi'}</span>
                    </td>
                    <td style="padding:14px 16px;">
                      <span style="font-size:10.5px; font-family:var(--font-mono); color:var(--luz); background:rgba(240,168,48,0.1); padding:2px 8px; border-radius:999px;">🛡️ Tier ${b.user.trustTier || 1}</span>
                    </td>
                    <td style="padding:14px 16px; text-align:right;">
                      <span style="font-size:10.5px; font-family:var(--font-mono); color:${b.user.checkedIn ? '#79D3AC' : 'var(--humo)'};">${b.user.checkedIn ? '✅ En Sala' : '⏳ Esperando'}</span>
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;

    document.getElementById('sa-btn-export-bookings')?.addEventListener('click', () => {
      alert('Generando archivo CSV para personal en puerta...');
    });
  }

  // --- SECCIÓN 5: LISTA DE ESPERA ---
  private renderWaitlistSection(stage: HTMLElement) {
    stage.innerHTML = `
      <div style="display:flex; flex-direction:column; gap:20px;">
        <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap:14px;">
          <div style="background:rgba(243,237,226,0.04); border:1px solid var(--linea); border-radius:14px; padding:18px;">
            <span style="font-size:11px; color:var(--humo); font-family:var(--font-mono); text-transform:uppercase;">Total en Espera</span>
            <b style="font-size:26px; color:var(--papel); font-family:var(--font-display); display:block; margin-top:4px;">389 Usuarios</b>
            <span style="font-size:11px; color:var(--luz); font-family:var(--font-mono);">Demanda no satisfecha</span>
          </div>
          <div style="background:rgba(243,237,226,0.04); border:1px solid var(--linea); border-radius:14px; padding:18px;">
            <span style="font-size:11px; color:var(--humo); font-family:var(--font-mono); text-transform:uppercase;">Zona Más Solicitada</span>
            <b style="font-size:24px; color:var(--papel); font-family:var(--font-display); display:block; margin-top:4px;">Chapinero Alto</b>
            <span style="font-size:11px; color:#79D3AC; font-family:var(--font-mono);">142 registrados (36%)</span>
          </div>
          <div style="background:rgba(243,237,226,0.04); border:1px solid var(--linea); border-radius:14px; padding:18px;">
            <span style="font-size:11px; color:var(--humo); font-family:var(--font-mono); text-transform:uppercase;">Tiempo Promedio</span>
            <b style="font-size:26px; color:var(--papel); font-family:var(--font-display); display:block; margin-top:4px;">4.2 días</b>
            <span style="font-size:11px; color:var(--humo); font-family:var(--font-mono);">Antes de asignar cupo</span>
          </div>
        </div>

        <div style="background:rgba(20,15,26,0.8); border:1px solid var(--linea); border-radius:16px; padding:22px;">
          <h4 style="font-family:var(--font-display); font-size:16px; color:var(--papel); margin:0 0 16px;">Demanda Geográfica para Apertura de Fechas</h4>
          
          <div style="display:flex; flex-direction:column; gap:14px;">
            <div>
              <div style="display:flex; justify-content:space-between; font-size:12px; margin-bottom:6px;">
                <b style="color:var(--papel);">Chapinero Alto & Zona G</b>
                <span style="font-family:var(--font-mono); color:var(--luz);">142 personas · Sugerida fecha Viernes</span>
              </div>
              <div style="width:100%; height:8px; background:rgba(243,237,226,0.06); border-radius:999px; overflow:hidden;">
                <div style="width:85%; height:100%; background:var(--luz); border-radius:999px;"></div>
              </div>
            </div>

            <div>
              <div style="display:flex; justify-content:space-between; font-size:12px; margin-bottom:6px;">
                <b style="color:var(--papel);">Usaquén & Santa Bárbara</b>
                <span style="font-family:var(--font-mono); color:var(--luz);">98 personas · Sugerida fecha Sábado</span>
              </div>
              <div style="width:100%; height:8px; background:rgba(243,237,226,0.06); border-radius:999px; overflow:hidden;">
                <div style="width:62%; height:100%; background:#79D3AC; border-radius:999px;"></div>
              </div>
            </div>

            <div>
              <div style="display:flex; justify-content:space-between; font-size:12px; margin-bottom:6px;">
                <b style="color:var(--papel);">Parque de la 93 & Zona Rosa</b>
                <span style="font-family:var(--font-mono); color:var(--luz);">85 personas</span>
              </div>
              <div style="width:100%; height:8px; background:rgba(243,237,226,0.06); border-radius:999px; overflow:hidden;">
                <div style="width:54%; height:100%; background:#ff8ca8; border-radius:999px;"></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  // --- SECCIÓN 6: USUARIOS Y PERMISOS ---
  private renderUsersSection(stage: HTMLElement) {
    stage.innerHTML = `
      <div style="display:flex; flex-direction:column; gap:24px;">
        
        <!-- Simulador Rápido de Roles (Permite alternar sin desloguearse) -->
        <div style="background: rgba(240,168,48,0.06); border: 1px dashed rgba(240,168,48,0.35); border-radius: 16px; padding: 22px;">
          <h4 style="font-family: var(--font-display); font-size: 17px; color: var(--papel); margin: 0 0 6px;">👑 Simulador y Asignación de Roles</h4>
          <p style="font-size: 12px; color: var(--humo); margin: 0 0 16px;">
            Cambia el rol del usuario activo en memoria para auditar y verificar cualquier perfil sin reiniciar la sesión:
          </p>
          <div style="display: flex; gap: 10px; flex-wrap: wrap;">
            <button class="btn ambar sa-set-role" data-role="superadmin" style="font-size: 11px; padding: 10px 16px; font-weight: 700;">👑 Rol: Super Admin</button>
            <button class="btn sa-set-role" data-role="sales" style="font-size: 11px; padding: 10px 16px; background: rgba(0,0,0,0.3); border-color: var(--luz); color: var(--luz);">💼 Rol: Vendedor (Sales)</button>
            <button class="btn sa-set-role" data-role="admin" style="font-size: 11px; padding: 10px 16px; background: rgba(0,0,0,0.3); border-color: var(--linea);">🏢 Rol: Anfitrión Bar</button>
            <button class="btn sa-set-role" data-role="client" style="font-size: 11px; padding: 10px 16px; background: rgba(0,0,0,0.3); border-color: var(--linea);">🍸 Rol: Cliente / Usuario</button>
          </div>
        </div>

        <!-- T2: Gestión de Scouts y Hosters B2B -->
        <div style="background: rgba(20,15,26,0.8); border: 1px solid var(--linea); border-radius: 16px; padding: 22px;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:14px;">
            <div>
              <h4 style="font-family: var(--font-display); font-size: 17px; color: var(--papel); margin: 0;">👥 Scouts y Hosters B2B</h4>
              <p style="font-size: 12px; color: var(--humo); margin: 4px 0 0;">Alta de personal comercial y coordinadores de sala con validación tributaria.</p>
            </div>
            <button class="btn" id="sa-people-toggle" style="font-size: 11px; padding: 8px 14px; background:rgba(243,237,226,0.06); border-color:var(--linea);">+ Nuevo Agente</button>
          </div>

          <div id="sa-people-panel" style="display:none; margin-bottom: 20px; padding: 16px; background:rgba(0,0,0,0.3); border: 1px dashed var(--linea); border-radius:12px;">
            <b style="font-family: var(--font-display); font-size: 14px; color: var(--papel); display:block; margin-bottom:10px;">Formulario de Registro</b>
            <form id="sa-people-form" style="display:grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap:10px; margin-bottom:14px;">
              <select id="sa-people-type" class="ronda-input" style="margin-bottom:0;">
                <option value="scout">Scout (Comercial)</option>
                <option value="host">Hoster (Anfitrión Sala)</option>
              </select>
              <input id="sa-people-uid" class="ronda-input" placeholder="UID (requerido)" required style="margin-bottom:0;">
              <input id="sa-people-name" class="ronda-input" placeholder="Nombre Completo" style="margin-bottom:0;">
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
                <input type="checkbox" id="sa-people-pila"> PILA vigente
              </label>
              <button type="submit" class="btn ambar" style="font-size:11px; padding:10px; font-weight:700;">Guardar Agente</button>
            </form>
          </div>

          <div id="sa-people-list" style="display:flex; flex-direction:column; gap:8px;">
            <p style="font-size:12px; color:var(--humo);">Cargando lista de agentes…</p>
          </div>
        </div>

        <!-- T-8.2: Tokens de inversión Pista Privada FFF (/invest) -->
        <div style="background: rgba(20,15,26,0.8); border: 1px solid var(--linea); border-radius: 16px; padding: 22px;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 12px;">
            <div>
              <h4 style="font-family: var(--font-display); font-size: 17px; color: var(--papel); margin: 0;">🎟️ Pista Privada FFF: Tokens de Inversión (/invest)</h4>
              <p style="font-size: 12px; color: var(--humo); margin: 4px 0 0;">Emisión de tokens para inversionistas ángeles y acceso a la ronda Friends & Family.</p>
            </div>
            <span id="sa-tokens-count" style="font-size:10.5px; color:var(--humo); font-family:var(--font-mono);"></span>
          </div>

          <form id="sa-token-form" style="display:grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap:10px; margin-bottom:16px; align-items:end;">
            <input id="sa-token-name" class="ronda-input" placeholder="Nombre del Invitado" required style="margin-bottom:0;">
            <select id="sa-token-ring" class="ronda-input" style="margin-bottom:0;">
              <option value="A1">A1: Núcleo</option>
              <option value="A2">A2: Amigos</option>
              <option value="A3">A3: Red Profesional</option>
              <option value="A4">A4: Mentores</option>
              <option value="GEN">GEN: General</option>
            </select>
            <input id="sa-token-token" class="ronda-input" placeholder="Slug/Token (rnd-…)" required style="margin-bottom:0;">
            <input id="sa-token-phone" class="ronda-input" placeholder="WhatsApp (opcional)" style="margin-bottom:0;">
            <input id="sa-token-notes" class="ronda-input" placeholder="Notas (opcional)" style="margin-bottom:0;">
            <button type="submit" class="btn ambar" style="font-size:11px; padding:10px 16px; font-weight:700;">➕ Emitir Token</button>
          </form>

          <p id="sa-tokens-empty" style="font-size:12px; color:var(--humo); display:none;">Sin tokens emitidos.</p>
          <div id="sa-tokens-list" style="display:flex; flex-direction:column; gap:8px;"></div>
        </div>

      </div>
    `;

    this.attachUsersListeners();
    void this.loadPeople();
    void this.loadTokens();
  }

  private attachUsersListeners() {
    // Simulador de roles
    document.querySelectorAll('.sa-set-role').forEach((btn) => {
      btn.addEventListener('click', async (e) => {
        const role = (e.currentTarget as HTMLElement).getAttribute('data-role');
        if (!role) return;

        const user = Auth.currentUser;
        if (user) {
          user.role = role;
          await DB.saveUser(user);
        }

        const select = document.getElementById('admin-portal-switch') as HTMLSelectElement | null;
        if (select) {
          if (role === 'admin') select.value = '/admin.html';
          else if (role === 'sales') select.value = '/crm.html';
        }

        this.updateUserSidebarProfile();

        await RondaDialog.alert({
          title: 'Rol Asignado en Memoria',
          message: `Tu usuario actual ahora tiene el rol: ${role.toUpperCase()}.\nPuedes usar el menú lateral para probar los permisos de la plataforma.`,
          icon: '✨'
        });
      });
    });

    // Toggle panel personas
    document.getElementById('sa-people-toggle')?.addEventListener('click', () => {
      const panel = document.getElementById('sa-people-panel');
      if (panel) panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
    });

    // Formulario personas
    document.getElementById('sa-people-form')?.addEventListener('submit', (e) => {
      e.preventDefault();
      void this.savePerson();
    });

    // Formulario tokens FFF
    document.getElementById('sa-token-form')?.addEventListener('submit', (e) => {
      e.preventDefault();
      void this.emitToken();
    });
  }

  // --- SECCIÓN 7: MÉTRICAS Y FINANZAS ---
  private renderMetricsSection(stage: HTMLElement) {
    stage.innerHTML = `
      <div style="display:flex; flex-direction:column; gap:20px;">
        <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap:14px;">
          <div style="background:rgba(243,237,226,0.04); border:1px solid var(--linea); border-radius:14px; padding:18px;">
            <span style="font-size:11px; color:var(--humo); font-family:var(--font-mono); text-transform:uppercase;">Facturación Bruta (Run-Rate)</span>
            <b style="font-size:26px; color:var(--papel); font-family:var(--font-display); display:block; margin-top:4px;">$20.000.000 COP</b>
            <span style="font-size:11px; color:#79D3AC; font-family:var(--font-mono);">Meta Q4: $35.000.000</span>
          </div>
          <div style="background:rgba(243,237,226,0.04); border:1px solid var(--linea); border-radius:14px; padding:18px;">
            <span style="font-size:11px; color:var(--humo); font-family:var(--font-mono); text-transform:uppercase;">Tasa de Match Mutuo</span>
            <b style="font-size:26px; color:var(--luz); font-family:var(--font-display); display:block; margin-top:4px;">74.2%</b>
            <span style="font-size:11px; color:var(--humo); font-family:var(--font-mono);">Matches recíprocos en app</span>
          </div>
          <div style="background:rgba(243,237,226,0.04); border:1px solid var(--linea); border-radius:14px; padding:18px;">
            <span style="font-size:11px; color:var(--humo); font-family:var(--font-mono); text-transform:uppercase;">CAC vs LTV</span>
            <b style="font-size:26px; color:#79D3AC; font-family:var(--font-display); display:block; margin-top:4px;">1 : 4.8</b>
            <span style="font-size:11px; color:var(--humo); font-family:var(--font-mono);">Retorno altamente saludable</span>
          </div>
        </div>

        <div style="background:rgba(20,15,26,0.8); border:1px solid var(--linea); border-radius:16px; padding:22px;">
          <h4 style="font-family:var(--font-display); font-size:16px; color:var(--papel); margin:0 0 16px;">Desglose de Rentabilidad por Línea de Negocio</h4>
          
          <div style="display:flex; flex-direction:column; gap:14px;">
            <div style="display:flex; justify-content:space-between; align-items:center; padding:12px 14px; background:rgba(243,237,226,0.02); border-radius:10px; border:1px solid var(--linea);">
              <div>
                <b style="color:var(--papel); font-size:13px; display:block;">🎟️ Tickets B2C (Boletos Speed Dating)</b>
                <span style="font-size:11px; color:var(--humo);">$45.000 COP por asistente · 276 tickets emitidos</span>
              </div>
              <div style="text-align:right;">
                <b style="color:var(--papel); font-family:var(--font-display); font-size:15px;">$12.450.000 COP</b>
                <span style="font-size:10.5px; color:#79D3AC; font-family:var(--font-mono); display:block;">Margen Bruto: 82%</span>
              </div>
            </div>

            <div style="display:flex; justify-content:space-between; align-items:center; padding:12px 14px; background:rgba(243,237,226,0.02); border-radius:10px; border:1px solid var(--linea);">
              <div>
                <b style="color:var(--papel); font-size:13px; display:block;">🏢 SaaS Bares B2B (Suscripción recurrente mensual)</b>
                <span style="font-size:11px; color:var(--humo);">$650.000 COP / mes por local · Exclusividad de 500m</span>
              </div>
              <div style="text-align:right;">
                <b style="color:var(--luz); font-family:var(--font-display); font-size:15px;">$3.800.000 COP</b>
                <span style="font-size:10.5px; color:#79D3AC; font-family:var(--font-mono); display:block;">Margen Bruto: 95%</span>
              </div>
            </div>

            <div style="display:flex; justify-content:space-between; align-items:center; padding:12px 14px; background:rgba(243,237,226,0.02); border-radius:10px; border:1px solid var(--linea);">
              <div>
                <b style="color:var(--papel); font-size:13px; display:block;">🍸 Segunda Cita (Comisión sobre consumo posterior)</b>
                <span style="font-size:11px; color:var(--humo);">25% comisión de RONDA sobre cuentas en citas agendadas</span>
              </div>
              <div style="text-align:right;">
                <b style="color:#ff8ca8; font-family:var(--font-display); font-size:15px;">$1.650.000 COP</b>
                <span style="font-size:10.5px; color:#79D3AC; font-family:var(--font-mono); display:block;">Margen Bruto: 90%</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;

    document.getElementById('sa-btn-download-report')?.addEventListener('click', () => {
      alert('Descargando informe consolidado en formato PDF/Excel...');
    });
  }

  // --- SECCIÓN 8: CONFIGURACIÓN GLOBAL ---
  private renderSettingsSection(stage: HTMLElement) {
    stage.innerHTML = `
      <div style="display:flex; flex-direction:column; gap:20px;">
        <div style="background:rgba(20,15,26,0.8); border:1px solid var(--linea); border-radius:16px; padding:24px;">
          <h4 style="font-family:var(--font-display); font-size:17px; color:var(--papel); margin:0 0 16px;">Parámetros del Motor Algorítmico (MEM-RR)</h4>
          
          <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap:16px;">
            <div>
              <label style="display:block; font-size:12px; font-family:var(--font-mono); color:var(--humo); margin-bottom:6px;">DURACIÓN DE RONDAS (MINUTOS)</label>
              <input type="number" id="sa-setting-duration" class="ronda-input" value="6" min="3" max="15" style="margin-bottom:0;">
              <span style="font-size:10.5px; color:var(--humo); display:block; margin-top:4px;">Tiempo de conversación 1 a 1 por mesa.</span>
            </div>

            <div>
              <label style="display:block; font-size:12px; font-family:var(--font-mono); color:var(--humo); margin-bottom:6px;">DELTA DE AFINIDAD MÍNIMA</label>
              <input type="number" id="sa-setting-delta" class="ronda-input" value="0.15" step="0.05" min="0" max="1" style="margin-bottom:0;">
              <span style="font-size:10.5px; color:var(--humo); display:block; margin-top:4px;">Tolerancia de compatibilidad en el grafo.</span>
            </div>

            <div>
              <label style="display:block; font-size:12px; font-family:var(--font-mono); color:var(--humo); margin-bottom:6px;">FORMATO DE MESA POR DEFECTO</label>
              <select id="sa-setting-tablesize" class="ronda-input" style="margin-bottom:0;">
                <option value="2" selected>Mesas de 2 (Cita clásica 1 a 1)</option>
                <option value="4">Mesas de 4 (Formato Grupal / Coctel)</option>
              </select>
              <span style="font-size:10.5px; color:var(--humo); display:block; margin-top:4px;">Distribución espacial en el local.</span>
            </div>
          </div>
        </div>

        <div style="background:rgba(20,15,26,0.8); border:1px solid var(--linea); border-radius:16px; padding:24px;">
          <h4 style="font-family:var(--font-display); font-size:17px; color:var(--papel); margin:0 0 16px;">Políticas de Acceso & Modelo de Confianza</h4>
          
          <div style="display:flex; flex-direction:column; gap:12px;">
            <label style="display:flex; align-items:center; gap:10px; font-size:13px; color:var(--papel); cursor:pointer;">
              <input type="checkbox" id="sa-setting-kyc-req" checked disabled>
              <span>Exigir KYC Tier 1 (Selfie + Cédula) para visualizar sedes aliadas y reservar (Acuerdo de Negocio Vigente).</span>
            </label>

            <label style="display:flex; align-items:center; gap:10px; font-size:13px; color:var(--papel); cursor:pointer;">
              <input type="checkbox" id="sa-setting-biometry" checked>
              <span>Validar prueba de vida (Liveness) con MediaPipe antes de permitir envío a cola de revisión.</span>
            </label>
          </div>
        </div>

        <div style="background:rgba(20,15,26,0.8); border:1px solid var(--linea); border-radius:16px; padding:24px;">
          <h4 style="font-family:var(--font-display); font-size:17px; color:var(--papel); margin:0 0 16px;">Pasarela de Pago</h4>
          
          <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap:16px;">
            <div>
              <label style="display:block; font-size:12px; font-family:var(--font-mono); color:var(--humo); margin-bottom:6px;">MÉTODO ACTIVO</label>
              <select class="ronda-input" style="margin-bottom:0;">
                <option value="nequi" selected>Nequi (Verificación Manual de Comprobante)</option>
                <option value="wompi_test">Wompi Sandbox (Pruebas)</option>
                <option value="wompi_live">Wompi Producción (Tarjetas / PSE / Bancolombia)</option>
              </select>
            </div>
          </div>
        </div>
      </div>
    `;

    document.getElementById('sa-btn-save-settings')?.addEventListener('click', async () => {
      await RondaDialog.alert({
        title: 'Configuración Guardada',
        message: 'Los parámetros del sistema han sido actualizados en Firestore y propagados a la red de salas.',
        icon: '✅'
      });
    });
  }

  private escapeKyc(s: unknown): string {
    return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));
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

  // ============ Perfil fiscal (compartido con Usuarios y permisos) ============
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
      await RondaDialog.alert({ title: 'Guardado ✅', message: `Colaborador <b>${this.escapeKyc(uid)}</b> (${type}) guardado con RUT ${rut ? '✓' : '✕'} y PILA ${pila ? `✓ ${this.currentBogotaMonth()}` : '✕'}.`, icon: '✅', html: true });
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
        const baseOrigin = window.location.hostname.includes('localhost') || window.location.hostname.includes('127.0.0.1')
          ? window.location.origin
          : 'https://ronda.uno';
        if (action === 'copy') {
          await navigator.clipboard.writeText(`${baseOrigin}/invest?token=${token}`);
          const prev = target.textContent;
          target.textContent = '✅ Copiado';
          setTimeout(() => { target.textContent = prev; }, 1500);
        } else if (action === 'wa') {
          const name = target.getAttribute('data-name') || '';
          const text = `Hola ${name}, este es tu enlace de acceso privado a la Pista Privada FFF de RONDA:\n${baseOrigin}/invest?token=${token}`;
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
            html: true,
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
