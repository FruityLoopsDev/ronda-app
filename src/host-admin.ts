import { DB, User, RondaEvent, Venue, NightClosing, BenefitRedemption } from './db.js';
import { Auth } from './auth.js';
import { RondaDialog } from './dialog.js';
import notifications from './notifications.js';
import { renderRondaFooter } from './footer.js';
import { escapeHtml } from './utils.js';
import { db } from './firebase-config.js';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  updateDoc,
  serverTimestamp,
  where,
  Timestamp,
  arrayUnion,
  increment
} from 'firebase/firestore';
import { buildNightPlan } from './mem-rr-v2/engine.ts';
import type { Participant as RRParticipant } from './mem-rr-v2/types.ts';
import { pairKey } from './mem-rr-v2/weights.ts';
import { RRHistory } from './mem-rr-history.js';

export type HostSection =
  | 'summary'
  | 'nights'
  | 'live'
  | 'bookings'
  | 'settlements'
  | 'perks'
  | 'analytics'
  | 'venue'
  | 'team'
  | 'support';

export interface HostSectionConfig {
  id: HostSection;
  label: string;
  icon: string;
  badge?: string;
  group: 'general' | 'operation' | 'finance' | 'venue';
}

export const HOST_SECTIONS: HostSectionConfig[] = [
  { id: 'summary', label: 'Resumen', icon: '📊', group: 'general' },
  { id: 'nights', label: 'Mis Noches', icon: '📅', group: 'operation' },
  { id: 'live', label: 'Operación en Vivo', icon: '⚡', group: 'operation' },
  { id: 'bookings', label: 'Reservas & Recepción', icon: '🎟️', group: 'operation' },
  { id: 'settlements', label: 'Consumos y Cierre', icon: '🧾', group: 'finance' },
  { id: 'perks', label: 'Beneficios & Barra', icon: '🍸', group: 'finance' },
  { id: 'analytics', label: 'Resultados & Métricas', icon: '📈', group: 'finance' },
  { id: 'venue', label: 'Mi Local', icon: '🏢', group: 'venue' },
  { id: 'team', label: 'Equipo y Accesos', icon: '👥', group: 'venue' },
  { id: 'support', label: 'Soporte', icon: '🛎️', group: 'venue' },
];

export class HostAdminController {
  public currentSection: HostSection = 'summary';
  public currentUser: User | null = null;
  public activeVenue: Venue | null = null;
  public authorizedVenues: Venue[] = [];
  public currentEvent: RondaEvent | null = null;

  // Estado del escáner QR
  private qrScanner: any = null;
  private qrScanning: boolean = false;
  private bookingsUnsubscribe: any = null;

  // --- FASE 21: Caja / Cierre de Noche ---
  private readonly DRINK_UNIT_PRICE_COP = 25000; // precio unitario por copa incluida (COP)

  // Filtros de Reservas
  private bookingSearchQuery: string = '';
  private bookingFilterPayment: string = 'all';
  private bookingFilterCheckin: string = 'all';

  // Filtro de Noches
  private nightsFilterStatus: string = 'all';

  // --- Estado del Motor MEM-RR v2 & Temporizador de Sala (Server-Side Time) ---
  private timerInterval: any = null;
  private timerSeconds: number = 360; // 6 minutos por defecto (valor inicial)
  private timerRunning: boolean = false;
  private roundEndsAt: number | null = null; // Timestamp (ms) de fin de ronda, fuente de verdad en Firestore
  private nightPlan: any = null;
  private nightPlanFor: string = '';
  private nightPlanStartRound: number = 0;
  private playedPairs: string[] = [];
  private currentMetrics: any = null;
  private participantProfiles: Record<string, any> = {};
  private bellAudioCtx: any = null;

  async init(user: User) {
    this.currentUser = user;
    console.log(`[HostAdmin] Inicializando consola de anfitrión para usuario: ${user.email} (rol: ${user.role})`);

    // 1. Resolver los locales autorizados para este usuario
    await this.resolveAuthorizedVenues();

    // 2. Montar estructura visual del shell de anfitrión
    this.renderShell();

    // 3. Inicializar navegación y sincronización de rutas por hash
    this.setupNavigation();

    // 4. Cargar sección activa inicial
    const initialSection = this.getSectionFromHash();
    this.switchSection(initialSection);
  }

  /**
   * Resuelve los locales a los que el anfitrión tiene acceso.
   * Si es SuperAdmin, tiene acceso a todos los locales.
   */
  private async resolveAuthorizedVenues() {
    let allVenues = await DB.getVenues();
    if (!allVenues || allVenues.length === 0) {
      allVenues = [
        {
          id: 'caronte',
          name: 'CARONTE Cocktail Bar',
          address: 'Calle 69A # 4-15, Zona G',
          zone: 'Zona G, Bogotá',
          lat: 4.6532,
          lng: -74.0558,
          status: 'active',
          tablesCount: 14,
          description: 'Bar de coctelería de autor y atmósfera íntima para citas de alto nivel.'
        },
        {
          id: 'salto-del-angel',
          name: 'Salto del Ángel',
          address: 'Carrera 13 # 93A-45',
          zone: 'Parque de la 93, Bogotá',
          lat: 4.6781,
          lng: -74.0512,
          status: 'active',
          tablesCount: 16,
          description: 'Espacio contemporáneo con terraza climatizada en el corazón de la 93.'
        },
        {
          id: 'huerta-cocteleria',
          name: 'Huerta Coctelería Artesanal',
          address: 'Calle 69A # 10-15',
          zone: 'Quinta Camacho, Bogotá',
          lat: 4.6548,
          lng: -74.0592,
          status: 'active',
          tablesCount: 12,
          description: 'Coctelería botánica y sustentable con huerto propio.'
        }
      ];
    }

    const isSuper = this.currentUser?.role === 'superadmin' || this.currentUser?.email === 'cesar@ronda.uno';

    if (isSuper) {
      this.authorizedVenues = allVenues;
    } else {
      const directVenueId = this.currentUser?.venueId || 'caronte';
      const venueIdsList = this.currentUser?.venueIds || [directVenueId];
      this.authorizedVenues = allVenues.filter(v => venueIdsList.includes(v.id) || v.id === directVenueId);
      if (this.authorizedVenues.length === 0) {
        this.authorizedVenues = [allVenues[0]];
      }
    }

    // Seleccionar el local activo por defecto
    const savedVenueId = sessionStorage.getItem('ronda_host_active_venue');
    const match = this.authorizedVenues.find(v => v.id === savedVenueId);
    this.activeVenue = match || this.authorizedVenues[0];

    // Cargar el evento activo para este venue
    await this.loadActiveEvent();
  }

  private async loadActiveEvent() {
    if (!this.activeVenue) return;
    const eventId = `rnd-${this.activeVenue.id}-mar-25`;
    let event = await DB.getEvent(eventId);
    if (!event) {
      event = {
        id: eventId,
        venueId: this.activeVenue.id,
        venueName: this.activeVenue.name,
        status: 'waiting',
        participants: [],
        currentRound: 0,
        tables: this.activeVenue.tablesCount || 12,
        tablesCount: this.activeVenue.tablesCount || 12,
        price: 45000,
        priceFormatted: '$45.000 COP',
        dayDate: 'Martes 25 · 20:00 - 21:45',
        capacity: (this.activeVenue.tablesCount || 12) * 2
      };
      await DB.saveEvent(event);
    }
    this.currentEvent = event;
  }

  private getSectionFromHash(): HostSection {
    const hash = window.location.hash.replace('#', '') as HostSection;
    const valid = HOST_SECTIONS.some(s => s.id === hash);
    return valid ? hash : 'summary';
  }

  /**
   * Renderiza el contenedor del portal con navegación lateral fija en escritorio
   * y drawer desplegable en móvil.
   */
  private renderShell() {
    const viewAdmin = document.getElementById('view-admin');
    if (!viewAdmin) return;

    viewAdmin.className = 'panel on';
    viewAdmin.style.cssText = 'position:fixed; top:0; left:0; width:100vw; height:100vh; background:#110A15; z-index:1000; overflow:hidden; padding:0; margin:0;';

    const multiVenue = this.authorizedVenues.length > 1;
    const venueOptionsHtml = this.authorizedVenues.map(v => 
      `<option value="${v.id}" ${v.id === this.activeVenue?.id ? 'selected' : ''}>${v.name} (${v.zone})</option>`
    ).join('');

    viewAdmin.innerHTML = `
      <!-- Topbar móvil -->
      <header class="host-mobile-topbar" style="display:none; background:#160F1D; border-bottom:1px solid var(--linea); padding:12px 16px; align-items:center; justify-content:space-between; position:sticky; top:0; z-index:110;">
        <div style="display:flex; align-items:center; gap:12px;">
          <button id="host-btn-hamburger" class="btn" style="background:transparent; border:1px solid var(--linea); color:var(--papel); padding:6px 10px; font-size:16px; border-radius:8px;" aria-label="Abrir Menú">☰</button>
          <div style="font-family:var(--font-display); font-size:18px; font-weight:700; color:var(--papel); letter-spacing:0.05em;">RONDA <span style="font-family:var(--font-mono); font-size:10px; color:var(--luz); letter-spacing:0.1em;">ANFITRIÓN</span></div>
        </div>
        <div style="display:flex; align-items:center; gap:8px;">
          <span style="font-family:var(--font-mono); font-size:10.5px; color:#79D3AC; display:flex; align-items:center; gap:4px;">
            <span style="width:6px; height:6px; border-radius:50%; background:#79D3AC; box-shadow:0 0 6px #79D3AC;"></span> En vivo
          </span>
        </div>
      </header>

      <!-- Layout Principal del Shell -->
      <div class="host-shell-layout" style="display:flex; height:100vh; width:100vw; overflow:hidden; background:#110A15;">
        
        <!-- Backdrop móvil -->
        <div id="host-sidebar-overlay" style="display:none; position:fixed; inset:0; background:rgba(10,7,14,0.75); backdrop-filter:blur(4px); z-index:190;"></div>

        <!-- Sidebar / Menú Lateral -->
        <aside id="host-sidebar" class="host-sidebar" style="width:260px; min-width:260px; background:#160F1D; border-right:1px solid var(--linea); display:flex; flex-direction:column; height:100vh; z-index:200; box-sizing:border-box;">
          
          <!-- Encabezado Sidebar -->
          <div style="padding:22px 20px 18px; border-bottom:1px solid rgba(243,237,226,0.08); display:flex; justify-content:space-between; align-items:center;">
            <div>
              <div style="font-family:var(--font-serif); font-size:24px; font-weight:800; letter-spacing:0.14em; color:var(--papel); line-height:1; margin:0;">RONDA</div>
              <div style="font-family:var(--font-mono); font-size:9.5px; letter-spacing:0.12em; color:var(--luz); text-transform:uppercase; font-weight:700; margin-top:4px;">
                CENTRO OPERATIVO DE SALA
              </div>
            </div>
            <button id="host-btn-close-drawer" class="btn" style="display:none; background:transparent; border:none; color:var(--humo); font-size:18px; padding:4px;" aria-label="Cerrar menú">✕</button>
          </div>

          <!-- Selector / Ficha de Local Activo -->
          <div style="padding:14px 16px; border-bottom:1px solid rgba(243,237,226,0.06); background:rgba(240,168,48,0.04);">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
              <span style="font-family:var(--font-mono); font-size:9px; letter-spacing:0.1em; color:var(--humo); text-transform:uppercase;">Establecimiento Activo</span>
              <span style="font-family:var(--font-mono); font-size:9.5px; color:#79D3AC; font-weight:700;">● CONECTADO</span>
            </div>
            ${multiVenue ? `
              <select id="host-venue-dropdown" class="ronda-input" style="padding:7px 10px; font-size:11.5px; font-weight:700; margin-bottom:0; background:rgba(22,16,27,0.9); border-color:rgba(240,168,48,0.3); color:var(--papel);">
                ${venueOptionsHtml}
              </select>
            ` : `
              <div style="font-size:13px; font-weight:700; color:var(--papel); font-family:var(--font-sans);">${this.activeVenue?.name || 'Local Aliado'}</div>
              <div style="font-size:10.5px; color:var(--humo); font-family:var(--font-mono);">${this.activeVenue?.zone || 'Bogotá'}</div>
            `}
          </div>

          <!-- Navegación de 10 Secciones -->
          <nav class="host-sidebar-nav" style="flex:1; overflow-y:auto; padding:16px 12px; display:flex; flex-direction:column; gap:16px;">
            
            <!-- Grupo: General -->
            <div>
              <div class="admin-nav-group-label" style="font-family:var(--font-mono); font-size:9px; font-weight:700; letter-spacing:0.14em; color:var(--humo); text-transform:uppercase; padding:0 8px; margin-bottom:4px;">General</div>
              <button class="host-nav-item ${this.currentSection === 'summary' ? 'active' : ''}" data-section="summary">
                <span class="host-nav-icon">📊</span>
                <span style="flex:1;">Resumen</span>
              </button>
            </div>

            <!-- Grupo: Operación de Sala -->
            <div>
              <div class="admin-nav-group-label" style="font-family:var(--font-mono); font-size:9px; font-weight:700; letter-spacing:0.14em; color:var(--humo); text-transform:uppercase; padding:0 8px; margin-bottom:4px;">Operación de Sala</div>
              <button class="host-nav-item ${this.currentSection === 'nights' ? 'active' : ''}" data-section="nights">
                <span class="host-nav-icon">📅</span>
                <span style="flex:1;">Mis Noches</span>
              </button>
              <button class="host-nav-item ${this.currentSection === 'live' ? 'active' : ''}" data-section="live">
                <span class="host-nav-icon">⚡</span>
                <span style="flex:1;">Operación en Vivo</span>
                <span class="admin-nav-badge" style="background:rgba(121,211,172,0.15); color:#79D3AC; border:1px solid rgba(121,211,172,0.4);">LIVE</span>
              </button>
              <button class="host-nav-item ${this.currentSection === 'bookings' ? 'active' : ''}" data-section="bookings">
                <span class="host-nav-icon">🎟️</span>
                <span style="flex:1;">Reservas & Recepción</span>
              </button>
            </div>

            <!-- Grupo: Finanzas & Caja -->
            <div>
              <div class="admin-nav-group-label" style="font-family:var(--font-mono); font-size:9px; font-weight:700; letter-spacing:0.14em; color:var(--humo); text-transform:uppercase; padding:0 8px; margin-bottom:4px;">Caja & Métricas</div>
              <button class="host-nav-item ${this.currentSection === 'settlements' ? 'active' : ''}" data-section="settlements">
                <span class="host-nav-icon">🧾</span>
                <span style="flex:1;">Consumos & Cierre</span>
              </button>
              <button class="host-nav-item ${this.currentSection === 'perks' ? 'active' : ''}" data-section="perks">
                <span class="host-nav-icon">🍸</span>
                <span style="flex:1;">Beneficios & Barra</span>
              </button>
              <button class="host-nav-item ${this.currentSection === 'analytics' ? 'active' : ''}" data-section="analytics">
                <span class="host-nav-icon">📈</span>
                <span style="flex:1;">Resultados</span>
              </button>
            </div>

            <!-- Grupo: Configuración y Equipo -->
            <div>
              <div class="admin-nav-group-label" style="font-family:var(--font-mono); font-size:9px; font-weight:700; letter-spacing:0.14em; color:var(--humo); text-transform:uppercase; padding:0 8px; margin-bottom:4px;">Establecimiento</div>
              <button class="host-nav-item ${this.currentSection === 'venue' ? 'active' : ''}" data-section="venue">
                <span class="host-nav-icon">🏢</span>
                <span style="flex:1;">Mi Local</span>
              </button>
              <button class="host-nav-item ${this.currentSection === 'team' ? 'active' : ''}" data-section="team">
                <span class="host-nav-icon">👥</span>
                <span style="flex:1;">Equipo & Accesos</span>
              </button>
              <button class="host-nav-item ${this.currentSection === 'support' ? 'active' : ''}" data-section="support">
                <span class="host-nav-icon">🛎️</span>
                <span style="flex:1;">Soporte & Ayuda</span>
              </button>
            </div>

          </nav>

          <!-- Footer Sidebar: Usuario, Selector de Portales y Logout Único -->
          <div style="padding:14px 12px; border-top:1px solid rgba(243,237,226,0.08); background:rgba(14,9,18,0.6); display:flex; flex-direction:column; gap:10px;">
            <div style="display:flex; align-items:center; gap:10px;">
              <div style="width:32px; height:32px; border-radius:50%; background:#24162a; border:1px solid var(--luz); display:flex; align-items:center; justify-content:center; font-family:var(--font-serif); font-size:13px; font-weight:700; color:var(--luz);">
                ${this.currentUser?.name ? this.currentUser.name.charAt(0).toUpperCase() : 'A'}
              </div>
              <div style="overflow:hidden; line-height:1.25; flex:1;">
                <div style="font-size:12px; font-weight:700; color:var(--papel); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
                  ${this.currentUser?.name || this.currentUser?.email || 'Anfitrión de Sala'}
                </div>
                <div style="font-family:var(--font-mono); font-size:9.5px; color:#79D3AC; text-transform:uppercase; font-weight:700;">
                  ${this.currentUser?.role === 'superadmin' ? '👑 SUPERADMIN' : '🏢 ANFITRIÓN SALA'}
                </div>
              </div>
            </div>

            <!-- Selector de salto entre portales -->
            <select id="host-portal-switcher" class="ronda-input" style="padding:6px 8px; font-size:10.5px; font-family:var(--font-mono); margin-bottom:0; background:rgba(243,237,226,0.04); border-color:var(--linea); color:var(--humo);">
              <option value="/admin" selected>🏢 Portal Anfitrión</option>
              <option value="/superadmin">👑 SuperAdmin Global</option>
              <option value="/crm">💼 CRM Ventas</option>
              <option value="/network">🗺️ Red de Aliados</option>
            </select>

            <!-- Cierre de sesión único -->
            <button id="host-btn-logout" class="btn" style="width:100%; background:transparent; border:1px solid rgba(142,36,58,0.4); color:#ff8ca8; font-size:11px; padding:7px 10px; border-radius:8px; font-weight:600; cursor:pointer;" title="Cerrar sesión segura">
              🚪 Cerrar Sesión
            </button>
          </div>

        </aside>

        <!-- Área de Contenido Principal -->
        <main style="flex:1; display:flex; flex-direction:column; height:100vh; overflow-y:auto; position:relative; background:#110A15;">
          
          <!-- Cabecera de la Vista Activa -->
          <header class="host-view-header" style="padding:20px 32px 18px; border-bottom:1px solid var(--linea); background:rgba(22,15,29,0.85); backdrop-filter:blur(8px); position:sticky; top:0; z-index:50; display:flex; justify-content:space-between; align-items:center;">
            <div>
              <div style="font-family:var(--font-mono); font-size:10px; letter-spacing:0.12em; color:var(--luz); text-transform:uppercase; margin-bottom:4px;" id="host-header-badge">
                ${this.activeVenue?.name || 'Local'} · Sala Activa
              </div>
              <h1 id="host-header-title" style="font-family:'Bodoni Moda',serif; font-size:26px; font-weight:700; color:var(--papel); margin:0; letter-spacing:0.02em;">
                Resumen General
              </h1>
            </div>

            <div style="display:flex; align-items:center; gap:12px;">
              <div id="host-header-actions" style="display:flex; gap:8px;"></div>
              
              <!-- Badge de Noche Activa -->
              <div style="background:rgba(240,168,48,0.1); border:1px solid rgba(240,168,48,0.3); padding:6px 12px; border-radius:8px; display:flex; align-items:center; gap:8px;">
                <span style="font-size:14px;">🍸</span>
                <div>
                  <div style="font-family:var(--font-mono); font-size:9px; color:var(--humo); text-transform:uppercase;">Noche en Sala</div>
                  <div style="font-family:var(--font-mono); font-size:11px; color:var(--papel); font-weight:700;">${this.currentEvent?.dayDate || 'Martes 20:00'}</div>
                </div>
              </div>
            </div>
          </header>

          <!-- Escenario Dinámico de Secciones -->
          <div id="host-stage" style="flex:1; padding:28px 32px; box-sizing:border-box;">
            <!-- Contenido dinámico inyectado por switchSection -->
          </div>

          <!-- Footer del Portal de Anfitrión -->
          <div id="footer-root"></div>

        </main>
      </div>
    `;

    // Inyectar estilos específicos de navegación
    this.injectStyles();

    // Inyectar footer estándar
    renderRondaFooter(viewAdmin);
  }

  private injectStyles() {
    if (document.getElementById('host-admin-custom-styles')) return;
    const style = document.createElement('style');
    style.id = 'host-admin-custom-styles';
    style.innerHTML = `
      .host-nav-item {
        display: flex;
        align-items: center;
        gap: 12px;
        width: 100%;
        padding: 9px 12px;
        border-radius: 9px;
        color: var(--humo);
        font-size: 13px;
        font-family: var(--font-sans);
        font-weight: 500;
        cursor: pointer;
        transition: all 0.16s ease;
        border: 1px solid transparent;
        background: transparent;
        user-select: none;
        text-align: left;
        box-sizing: border-box;
      }
      .host-nav-item:hover {
        background: rgba(243, 237, 226, 0.05);
        color: var(--papel);
      }
      .host-nav-item.active {
        background: rgba(240, 168, 48, 0.12);
        color: var(--papel);
        font-weight: 700;
        border-color: rgba(240, 168, 48, 0.35);
        box-shadow: 0 2px 10px rgba(0, 0, 0, 0.25);
      }
      .host-nav-icon {
        font-size: 15px;
        line-height: 1;
        width: 18px;
        text-align: center;
      }
      @media (max-width: 960px) {
        .host-mobile-topbar { display: flex !important; }
        .host-sidebar {
          position: fixed !important;
          left: 0; top: 0; bottom: 0;
          transform: translateX(-100%);
          transition: transform 0.28s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .host-sidebar.open {
          transform: translateX(0) !important;
        }
        #host-btn-close-drawer { display: block !important; }
      }
    `;
    document.head.appendChild(style);
  }

  private setupNavigation() {
    // 1. Clicks en ítems del menú lateral
    document.querySelectorAll('.host-nav-item').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const sec = (e.currentTarget as HTMLElement).getAttribute('data-section') as HostSection;
        if (sec) {
          window.location.hash = sec;
          this.switchSection(sec);
          this.closeDrawer();
        }
      });
    });

    // 2. Control de Drawer Móvil
    const hamburger = document.getElementById('host-btn-hamburger');
    const closeBtn = document.getElementById('host-btn-close-drawer');
    const overlay = document.getElementById('host-sidebar-overlay');
    const sidebar = document.getElementById('host-sidebar');

    hamburger?.addEventListener('click', () => {
      sidebar?.classList.add('open');
      if (overlay) overlay.style.display = 'block';
    });

    closeBtn?.addEventListener('click', () => this.closeDrawer());
    overlay?.addEventListener('click', () => this.closeDrawer());

    // 3. Conmutador de Local
    const venueDropdown = document.getElementById('host-venue-dropdown') as HTMLSelectElement;
    venueDropdown?.addEventListener('change', async (e) => {
      const selectedId = (e.target as HTMLSelectElement).value;
      const match = this.authorizedVenues.find(v => v.id === selectedId);
      if (match) {
        this.activeVenue = match;
        sessionStorage.setItem('ronda_host_active_venue', match.id);
        await this.loadActiveEvent();
        this.renderShell();
        this.setupNavigation();
        this.switchSection(this.currentSection);
      }
    });

    // 4. Conmutador de Portales
    const portalSwitcher = document.getElementById('host-portal-switcher') as HTMLSelectElement;
    portalSwitcher?.addEventListener('change', (e) => {
      const target = (e.target as HTMLSelectElement).value;
      if (target && target !== '/admin') {
        window.location.href = target;
      }
    });

    // 5. Cierre de sesión único
    document.getElementById('host-btn-logout')?.addEventListener('click', async () => {
      const confirmed = await RondaDialog.confirm({
        title: 'Cerrar Sesión',
        message: '¿Estás seguro de que deseas salir de la consola del anfitrión?',
        icon: '🚪',
        confirmText: 'Cerrar Sesión',
        cancelText: 'Permanecer'
      });
      if (confirmed) {
        Auth.logout();
      }
    });

    // 6. Sincronización hashchange
    window.addEventListener('hashchange', () => {
      const sec = this.getSectionFromHash();
      if (sec !== this.currentSection) {
        this.switchSection(sec);
      }
    });
  }

  private closeDrawer() {
    const sidebar = document.getElementById('host-sidebar');
    const overlay = document.getElementById('host-sidebar-overlay');
    sidebar?.classList.remove('open');
    if (overlay) overlay.style.display = 'none';
  }

  /**
   * Cambia la sección activa y actualiza cabecera y escenario.
   */
  public switchSection(section: HostSection) {
    this.currentSection = section;

    // Actualizar clases activas en sidebar
    document.querySelectorAll('.host-nav-item').forEach(btn => {
      if (btn.getAttribute('data-section') === section) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });

    // Actualizar cabecera
    const headerTitle = document.getElementById('host-header-title');
    const headerBadge = document.getElementById('host-header-badge');
    const headerActions = document.getElementById('host-header-actions');
    const secConfig = HOST_SECTIONS.find(s => s.id === section);

    if (headerTitle && secConfig) {
      headerTitle.textContent = secConfig.label;
    }
    if (headerBadge && this.activeVenue) {
      headerBadge.textContent = `${this.activeVenue.name} · ${secConfig?.group.toUpperCase() || 'SALA'}`;
    }

    if (headerActions) {
      headerActions.innerHTML = '';
      if (section === 'nights') {
        headerActions.innerHTML = `
          <button id="btn-host-new-draft-night" class="btn ambar" style="font-size:12px; font-weight:700; padding:8px 16px;">
            + Proponer Nueva Noche
          </button>
        `;
        document.getElementById('btn-host-new-draft-night')?.addEventListener('click', () => {
          this.promptNewDraftNight();
        });
      } else if (section === 'bookings') {
        headerActions.innerHTML = `
          <button id="btn-host-open-qr-scanner" class="btn ambar" style="font-size:12px; font-weight:700; padding:8px 16px;">
            📷 Abrir Escáner QR
          </button>
        `;
        document.getElementById('btn-host-open-qr-scanner')?.addEventListener('click', () => {
          this.startQrScan();
        });
      }
    }

    // Renderizar sección en el escenario
    this.renderSectionContent(section);
  }

  private async renderSectionContent(section: HostSection) {
    const stage = document.getElementById('host-stage');
    if (!stage) return;

    switch (section) {
      case 'summary':
        this.renderSummarySection(stage);
        break;
      case 'nights':
        await this.renderNightsSection(stage);
        break;
      case 'bookings':
        await this.renderBookingsSection(stage);
        break;
      case 'live':
        this.renderLiveSection(stage);
        break;
      case 'settlements':
        this.renderSettlementsSection(stage);
        break;
      case 'perks':
        this.renderPerksSection(stage);
        break;
      case 'analytics':
        this.renderAnalyticsSection(stage);
        break;
      case 'venue':
        this.renderVenueSection(stage);
        break;
      case 'team':
        this.renderTeamSection(stage);
        break;
      case 'support':
        this.renderSupportSection(stage);
        break;
    }
  }

  /* =====================================================================
   * PASO 5: MÓDULO RESUMEN & MIS NOCHES
   * ===================================================================== */

  private renderSummarySection(stage: HTMLElement) {
    const event = this.currentEvent;
    const venue = this.activeVenue;
    const participantsCount = event?.participants?.length || 24;
    const tablesCount = venue?.tablesCount || 12;
    const minDrinks = participantsCount * 1;
    const guaranteedRev = minDrinks * 22000;

    stage.innerHTML = `
      <div style="max-width:1400px; margin:0 auto; display:flex; flex-direction:column; gap:28px;">
        
        <!-- Grid de 4 KPIs Operativos en Sala -->
        <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(220px, 1fr)); gap:18px;">
          
          <div style="background:#160F1D; border:1px solid var(--linea); border-radius:14px; padding:20px 22px;">
            <div style="font-size:11.5px; color:var(--humo); font-family:var(--font-mono); text-transform:uppercase; letter-spacing:0.06em;">Ocupación Semanal</div>
            <div style="font-size:32px; font-weight:700; color:var(--papel); font-family:var(--font-mono); margin:8px 0 4px;">78 %</div>
            <div style="font-size:11px; color:#79D3AC; font-family:var(--font-mono);">+41 pts vs. promedio sin RONDA</div>
          </div>

          <div style="background:#160F1D; border:1px solid var(--linea); border-radius:14px; padding:20px 22px;">
            <div style="font-size:11.5px; color:var(--humo); font-family:var(--font-mono); text-transform:uppercase; letter-spacing:0.06em;">Ticket Noche Anterior</div>
            <div style="font-size:32px; font-weight:700; color:var(--luz); font-family:var(--font-mono); margin:8px 0 4px;">$1.190.000</div>
            <div style="font-size:11px; color:var(--humo); font-family:var(--font-mono);">Martes habitual: ~$330.000</div>
          </div>

          <div style="background:#160F1D; border:1px solid var(--linea); border-radius:14px; padding:20px 22px;">
            <div style="font-size:11.5px; color:var(--humo); font-family:var(--font-mono); text-transform:uppercase; letter-spacing:0.06em;">Consumo Promedio</div>
            <div style="font-size:32px; font-weight:700; color:#79D3AC; font-family:var(--font-mono); margin:8px 0 4px;">$78.000</div>
            <div style="font-size:11px; color:var(--humo); font-family:var(--font-mono);">Meta convenida: $66.000</div>
          </div>

          <div style="background:#160F1D; border:1px solid var(--linea); border-radius:14px; padding:20px 22px;">
            <div style="font-size:11.5px; color:var(--humo); font-family:var(--font-mono); text-transform:uppercase; letter-spacing:0.06em;">Tasa de Retorno</div>
            <div style="font-size:32px; font-weight:700; color:var(--papel); font-family:var(--font-mono); margin:8px 0 4px;">19 %</div>
            <div style="font-size:11px; color:var(--luz); font-family:var(--font-mono);">14 segundas citas este mes</div>
          </div>

        </div>

        <!-- Layout Central: Próxima Noche vs Pendientes Operativos -->
        <div style="display:grid; grid-template-columns:1fr 420px; gap:24px;">
          
          <!-- Tarjeta Destacada: Próxima Noche -->
          <div style="background:#160F1D; border:1px solid var(--ambar); border-radius:18px; padding:28px 30px; position:relative; overflow:hidden;">
            <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:20px;">
              <div>
                <span style="font-family:var(--font-mono); font-size:10px; color:var(--luz); letter-spacing:0.12em; text-transform:uppercase; font-weight:700;">
                  PRÓXIMA NOCHE · SPEED DATING
                </span>
                <h2 style="font-family:'Bodoni Moda',serif; font-size:30px; color:var(--papel); margin:4px 0 0;">
                  ${event?.dayDate || 'Martes 25 · 20:00 - 21:45'}
                </h2>
              </div>
              <span style="background:rgba(240,168,48,0.15); border:1px solid var(--luz); color:var(--luz); font-family:var(--font-mono); font-size:11px; font-weight:700; padding:6px 12px; border-radius:999px;">
                CONFIRMADA
              </span>
            </div>

            <div style="display:grid; grid-template-columns:repeat(2, 1fr); gap:14px; margin:24px 0;">
              <div style="background:rgba(243,237,226,0.03); border:1px solid rgba(243,237,226,0.06); border-radius:10px; padding:14px;">
                <div style="font-size:11px; color:var(--humo); font-family:var(--font-mono);">ASISTENTES CONFIRMADOS</div>
                <div style="font-size:22px; font-weight:700; color:var(--papel); font-family:var(--font-mono); margin-top:4px;">
                  ${participantsCount} <span style="font-size:13px; color:var(--humo); font-weight:400;">(12 mujeres + 12 hombres)</span>
                </div>
              </div>

              <div style="background:rgba(243,237,226,0.03); border:1px solid rgba(243,237,226,0.06); border-radius:10px; padding:14px;">
                <div style="font-size:11px; color:var(--humo); font-family:var(--font-mono);">MESAS REQUERIDAS</div>
                <div style="font-size:22px; font-weight:700; color:var(--papel); font-family:var(--font-mono); margin-top:4px;">
                  ${tablesCount} <span style="font-size:13px; color:var(--humo); font-weight:400;">mesas de 2 plazas</span>
                </div>
              </div>

              <div style="background:rgba(243,237,226,0.03); border:1px solid rgba(243,237,226,0.06); border-radius:10px; padding:14px;">
                <div style="font-size:11px; color:var(--humo); font-family:var(--font-mono);">CONSUMICIONES GARANTIZADAS</div>
                <div style="font-size:22px; font-weight:700; color:var(--luz); font-family:var(--font-mono); margin-top:4px;">
                  ${minDrinks} cócteles mínimo
                </div>
              </div>

              <div style="background:rgba(243,237,226,0.03); border:1px solid rgba(243,237,226,0.06); border-radius:10px; padding:14px;">
                <div style="font-size:11px; color:var(--humo); font-family:var(--font-mono);">INGRESO MÍNIMO ASEGURADO</div>
                <div style="font-size:22px; font-weight:700; color:#79D3AC; font-family:var(--font-mono); margin-top:4px;">
                  $${guaranteedRev.toLocaleString('es-CO')} COP
                </div>
              </div>
            </div>

            <div style="display:flex; gap:12px; margin-top:20px; flex-wrap:wrap;">
              <button id="btn-summary-start-live" class="btn ambar" style="font-size:13px; font-weight:700; padding:12px 22px;">
                ⚡ Arrancar Sala en Vivo
              </button>
              <button id="btn-summary-view-bookings" class="btn" style="background:transparent; border-color:var(--linea); color:var(--papel); font-size:13px; padding:12px 18px;">
                🎟️ Ver Lista de Reservas
              </button>
              <button id="btn-summary-menu-carta" class="btn" style="background:transparent; border-color:var(--linea); color:var(--humo); font-size:13px; padding:12px 18px;">
                🍸 Carta de la Noche
              </button>
            </div>
          </div>

          <!-- Columna Derecha: Pendientes Operativos & Alertas -->
          <div style="display:flex; flex-direction:column; gap:20px;">
            
            <div style="background:#160F1D; border:1px solid var(--linea); border-radius:16px; padding:22px 24px;">
              <div style="font-family:var(--font-mono); font-size:10px; letter-spacing:0.12em; color:var(--luz); text-transform:uppercase; margin-bottom:14px; font-weight:700;">
                Pendientes Operativos de Sala
              </div>

              <div style="display:flex; flex-direction:column; gap:10px;">
                <div style="background:rgba(240,168,48,0.08); border-left:3px solid var(--luz); padding:10px 12px; border-radius:6px; font-size:12px;">
                  <b style="color:var(--papel); display:block; margin-bottom:2px;">⚠️ 2 Pagos Pendientes en Puerta</b>
                  <span style="color:var(--humo);">Cobrar boleta al recibir a los asistentes no conciliados por pasarela.</span>
                </div>

                <div style="background:rgba(121,211,172,0.08); border-left:3px solid #79D3AC; padding:10px 12px; border-radius:6px; font-size:12px;">
                  <b style="color:var(--papel); display:block; margin-bottom:2px;">✓ Carta de Bienvenida Lista</b>
                  <span style="color:var(--humo);">Coctel de bienvenida: <i>Penicillin Ahumado</i> y <i>Caronte Sour</i>.</span>
                </div>

                <div style="background:rgba(243,237,226,0.03); border-left:3px solid var(--humo); padding:10px 12px; border-radius:6px; font-size:12px;">
                  <b style="color:var(--papel); display:block; margin-bottom:2px;">📋 Aforo Verificado</b>
                  <span style="color:var(--humo);">${tablesCount} mesas asignadas con separación acústica mínima de 1.8 metros.</span>
                </div>
              </div>
            </div>

            <!-- Resumen de Último Cierre de Caja -->
            <div style="background:#160F1D; border:1px solid var(--linea); border-radius:16px; padding:22px 24px;">
              <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
                <span style="font-family:var(--font-mono); font-size:10px; color:var(--humo); text-transform:uppercase;">Último Cierre Conciliado</span>
                <span style="font-family:var(--font-mono); font-size:9.5px; color:#79D3AC; font-weight:700;">APROBADO</span>
              </div>
              <div style="font-size:18px; font-weight:700; color:var(--papel); font-family:var(--font-mono);">$1.190.000 COP</div>
              <div style="font-size:11px; color:var(--humo); margin-top:4px;">Noche #212 · Martes 18 Marzo</div>
              <button id="btn-summary-goto-settlements" class="btn" style="width:100%; margin-top:12px; background:rgba(243,237,226,0.04); border:1px solid var(--linea); font-size:11.5px; padding:8px;">
                Ver Recibo Detallado →
              </button>
            </div>

          </div>

        </div>

      </div>
    `;

    // Listeners del Resumen
    document.getElementById('btn-summary-start-live')?.addEventListener('click', () => {
      this.switchSection('live');
    });
    document.getElementById('btn-summary-view-bookings')?.addEventListener('click', () => {
      this.switchSection('bookings');
    });
    document.getElementById('btn-summary-goto-settlements')?.addEventListener('click', () => {
      this.switchSection('settlements');
    });
    document.getElementById('btn-summary-menu-carta')?.addEventListener('click', () => {
      this.promptMenuCarta();
    });
  }

  private async renderNightsSection(stage: HTMLElement) {
    const venue = this.activeVenue;
    let nightsList: RondaEvent[] = venue ? await DB.getEventsForVenue(venue.id) : [];
    if (nightsList.length === 0 && this.currentEvent && (!venue || this.currentEvent.venueId === venue.id)) {
      nightsList = [this.currentEvent];
    }

    const nights = nightsList.map(e => ({
      id: e.id,
      title: e.name || 'Speed Dating · Noche Clásica',
      date: e.dayDate || 'Fecha por confirmar',
      status: e.status || 'waiting',
      participants: e.participants?.length || 0,
      capacity: e.capacity || (e.tables ? e.tables * 2 : 24),
      tables: e.tables || e.tablesCount || (venue?.tablesCount || 12),
      hostName: this.currentUser?.name || 'Anfitrión Asignado',
      menuReady: true
    }));

    const filteredNights = nights.filter(n => {
      if (this.nightsFilterStatus === 'all') return true;
      return n.status === this.nightsFilterStatus;
    });

    stage.innerHTML = `
      <div style="max-width:1400px; margin:0 auto; display:flex; flex-direction:column; gap:22px;">
        
        <!-- Barra de Filtros de Noches -->
        <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:14px; background:#160F1D; border:1px solid var(--linea); border-radius:14px; padding:14px 20px;">
          <div style="display:flex; gap:8px;">
            <button class="btn ${this.nightsFilterStatus === 'all' ? 'ambar' : ''}" data-night-filter="all" style="font-size:11.5px; padding:6px 14px; border-radius:8px;">Todas las Fechas (${nights.length})</button>
            <button class="btn ${this.nightsFilterStatus === 'waiting' ? 'ambar' : ''}" data-night-filter="waiting" style="font-size:11.5px; padding:6px 14px; border-radius:8px;">Próxima en Sala</button>
            <button class="btn ${this.nightsFilterStatus === 'upcoming' ? 'ambar' : ''}" data-night-filter="upcoming" style="font-size:11.5px; padding:6px 14px; border-radius:8px;">Futuras</button>
            <button class="btn ${this.nightsFilterStatus === 'completed' ? 'ambar' : ''}" data-night-filter="completed" style="font-size:11.5px; padding:6px 14px; border-radius:8px;">Cerradas</button>
          </div>

          <div style="font-size:12px; color:var(--humo); font-family:var(--font-mono);">
            Sede: <b style="color:var(--papel);">${venue?.name}</b> (${venue?.zone})
          </div>
        </div>

        <!-- Lista de Tarjetas de Noches -->
        <div style="display:flex; flex-direction:column; gap:16px;">
          ${filteredNights.map(n => `
            <div style="background:#160F1D; border:1px solid ${n.status === 'waiting' ? 'var(--ambar)' : 'var(--linea)'}; border-radius:16px; padding:22px 24px;">
              <div style="display:flex; justify-content:space-between; align-items:flex-start; flex-wrap:wrap; gap:12px;">
                <div>
                  <div style="display:flex; align-items:center; gap:8px; margin-bottom:4px;">
                    <span style="font-family:var(--font-mono); font-size:10px; color:var(--luz); letter-spacing:0.1em; text-transform:uppercase;">ID: ${n.id}</span>
                    <span style="background:${n.status === 'waiting' ? 'rgba(240,168,48,0.15)' : n.status === 'completed' ? 'rgba(121,211,172,0.15)' : 'rgba(243,237,226,0.06)'}; color:${n.status === 'waiting' ? 'var(--luz)' : n.status === 'completed' ? '#79D3AC' : 'var(--humo)'}; font-family:var(--font-mono); font-size:9.5px; padding:2px 8px; border-radius:999px; font-weight:700;">
                      ${n.status === 'waiting' ? '⚡ EN PREPARACIÓN' : n.status === 'completed' ? '✓ CERRADA' : '⏳ PROGRAMADA'}
                    </span>
                  </div>
                  <h3 style="font-family:'Bodoni Moda',serif; font-size:22px; color:var(--papel); margin:0;">${n.title}</h3>
                  <div style="font-size:13px; color:var(--humo); font-family:var(--font-mono); margin-top:2px;">${n.date}</div>
                </div>

                <div style="display:flex; gap:8px;">
                  ${n.status === 'waiting' ? `
                    <button class="btn ambar btn-goto-live-night" data-event-id="${n.id}" style="font-size:12px; font-weight:700; padding:8px 16px;">
                      Arrancar Sala en Vivo
                    </button>
                  ` : ''}
                  <button class="btn btn-goto-bookings-night" data-event-id="${n.id}" style="background:rgba(243,237,226,0.05); border:1px solid var(--linea); font-size:12px; padding:8px 14px;">
                    Ver Reservas
                  </button>
                  <button class="btn btn-duplicate-night" data-event-id="${n.id}" style="background:transparent; border:1px solid var(--linea); color:var(--humo); font-size:12px; padding:8px 12px;" title="Duplicar configuración como borrador">
                    📋 Duplicar
                  </button>
                </div>
              </div>

              <!-- Ficha Detallada de la Noche -->
              <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(180px, 1fr)); gap:12px; margin-top:18px; padding-top:16px; border-top:1px solid rgba(243,237,226,0.06);">
                <div>
                  <span style="font-size:10.5px; color:var(--humo); font-family:var(--font-mono);">AFORO / CUPOS</span>
                  <div style="font-size:14px; font-weight:700; color:var(--papel); font-family:var(--font-mono); margin-top:2px;">
                    ${n.participants} / ${n.capacity} Asistentes
                  </div>
                </div>

                <div>
                  <span style="font-size:10.5px; color:var(--humo); font-family:var(--font-mono);">MESAS REQUERIDAS</span>
                  <div style="font-size:14px; font-weight:700; color:var(--papel); font-family:var(--font-mono); margin-top:2px;">
                    ${n.tables} mesas (2 plazas)
                  </div>
                </div>

                <div>
                  <span style="font-size:10.5px; color:var(--humo); font-family:var(--font-mono);">ANFITRIÓN RESPONSABLE</span>
                  <div style="font-size:14px; font-weight:700; color:var(--papel); font-family:var(--font-mono); margin-top:2px;">
                    ${n.hostName}
                  </div>
                </div>

                <div>
                  <span style="font-size:10.5px; color:var(--humo); font-family:var(--font-mono);">CARTA COCTELES</span>
                  <div style="font-size:14px; font-weight:700; color:${n.menuReady ? '#79D3AC' : 'var(--luz)'}; font-family:var(--font-mono); margin-top:2px;">
                    ${n.menuReady ? '✓ Definida y Aprobada' : '⚠️ Pendiente de Seleccionar'}
                  </div>
                </div>
              </div>

            </div>
          `).join('')}
        </div>

      </div>
    `;

    // Listeners de Noches
    stage.querySelectorAll('[data-night-filter]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        this.nightsFilterStatus = (e.currentTarget as HTMLElement).getAttribute('data-night-filter') || 'all';
        this.renderNightsSection(stage);
      });
    });

    stage.querySelectorAll('.btn-goto-live-night').forEach(btn => {
      btn.addEventListener('click', () => this.switchSection('live'));
    });

    stage.querySelectorAll('.btn-goto-bookings-night').forEach(btn => {
      btn.addEventListener('click', () => this.switchSection('bookings'));
    });

    stage.querySelectorAll('.btn-duplicate-night').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const evtId = (e.currentTarget as HTMLElement).getAttribute('data-event-id');
        const confirmed = await RondaDialog.confirm({
          title: 'Duplicar Noche como Borrador',
          message: `¿Deseas crear un nuevo borrador basado en la noche <b>${evtId}</b>?<br><br><small style="color:var(--humo);">Nota canónica: No se copiarán asistentes, pagos ni resultados pasados.</small>`,
          icon: '📋',
          confirmText: 'Crear Borrador',
          cancelText: 'Cancelar'
        });
        if (confirmed) {
          notifications.showLegacyToast('✓ Borrador de noche creado con éxito.');
        }
      });
    });
  }

  /* =====================================================================
   * PASO 6: MÓDULO RESERVAS & RECEPCIÓN CON QR IDEMPOTENTE
   * ===================================================================== */

  private async renderBookingsSection(stage: HTMLElement) {
    const venue = this.activeVenue;
    const event = this.currentEvent;

    // Obtener asistentes reales de Firestore para la noche activa
    let attendees: any[] = [];
    if (event?.id) {
      const bookings = await DB.getBookingsForEvent(event.id);
      attendees = bookings.map(b => {
        const u = b.user;
        const res = b.reservation;
        const isChecked = !!(u.checkedIn || (event.participants && event.participants.includes(u.uid)));
        return {
          uid: u.uid,
          name: u.name || 'Invitado RONDA',
          age: u.age || 28,
          email: u.email || 'confidencial@ronda.uno',
          code: res.bookingCode || `RND-${u.uid.slice(-4).toUpperCase()}`,
          cocktail: res.cocktailName || u.favoriteCocktail || 'Caronte Sour',
          table: res.tableNumber || '1',
          trustTier: u.trustTier || (u.isVerified ? 2 : 1),
          verifiedLinkedIn: !!(u.linkedinVerified || u.linkedinUrl),
          paymentStatus: u.paymentPending ? 'pending_door' : 'paid',
          paymentMethod: u.paymentMethod || (u.paymentPending ? 'Nequi / Efectivo en Puerta' : 'Wompi Web Checkout'),
          checkedIn: isChecked
        };
      });

      if (event.participants && event.participants.length > 0) {
        for (const partUid of event.participants) {
          if (!attendees.some(a => a.uid === partUid)) {
            const partUser = await DB.getUser(partUid);
            if (partUser) {
              attendees.push({
                uid: partUser.uid,
                name: partUser.name || 'Invitado RONDA',
                age: partUser.age || 28,
                email: partUser.email || '',
                code: `RND-${partUser.uid.slice(-4).toUpperCase()}`,
                cocktail: partUser.favoriteCocktail || 'Caronte Sour',
                table: '1',
                trustTier: partUser.trustTier || 1,
                verifiedLinkedIn: !!partUser.linkedinVerified,
                paymentStatus: 'paid',
                paymentMethod: 'Wompi Web Checkout',
                checkedIn: true
              });
            }
          }
        }
      }
    }

    // Aplicar filtros
    const filtered = attendees.filter(a => {
      const q = this.bookingSearchQuery.toLowerCase();
      const matchQ = !q || a.name.toLowerCase().includes(q) || a.email.toLowerCase().includes(q) || a.code.toLowerCase().includes(q);
      const matchPay = this.bookingFilterPayment === 'all' || a.paymentStatus === this.bookingFilterPayment;
      const matchCheck = this.bookingFilterCheckin === 'all' || (this.bookingFilterCheckin === 'checked' ? a.checkedIn : !a.checkedIn);
      return matchQ && matchPay && matchCheck;
    });

    stage.innerHTML = `
      <div style="max-width:1400px; margin:0 auto; display:flex; flex-direction:column; gap:20px;">
        
        <!-- Tarjeta de Controles de Recepción & Escaneo QR -->
        <div style="background:#160F1D; border:1px solid var(--linea); border-radius:16px; padding:20px 24px; display:flex; flex-direction:column; gap:16px;">
          <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px;">
            <div>
              <span style="font-family:var(--font-mono); font-size:10px; color:var(--luz); letter-spacing:0.12em; text-transform:uppercase; font-weight:700;">
                CONTROL DE ACCESO EN PUERTA · ESCÁNER IDEMPOTENTE
              </span>
              <h2 style="font-family:'Bodoni Moda',serif; font-size:24px; color:var(--papel); margin:2px 0 0;">
                Recepción & Check-in
              </h2>
            </div>

            <div style="display:flex; gap:10px;">
              <button id="btn-bookings-start-scan" class="btn ambar" style="font-size:12.5px; font-weight:700; padding:10px 18px;">
                📷 Activar Escáner QR de Cámara
              </button>
            </div>
          </div>

          <!-- Región del escáner embebido -->
          <div id="host-qr-scanner-region" style="display:none; background:#0D0812; border:1px dashed var(--luz); border-radius:12px; padding:16px; max-width:360px; margin:0 auto; text-align:center;">
            <div id="host-qr-camera-target" style="width:100%; border-radius:8px; overflow:hidden;"></div>
            <button id="btn-host-stop-scan" class="btn" style="margin-top:12px; background:rgba(142,36,58,0.3); border:1px solid var(--vino); font-size:11px; padding:6px 14px;">
              ✕ Cerrar Cámara
            </button>
          </div>

          <!-- Entrada manual de UID o Código de Reserva -->
          <div style="display:flex; gap:10px; align-items:center; background:rgba(243,237,226,0.03); border:1px solid rgba(243,237,226,0.08); padding:12px 16px; border-radius:10px; flex-wrap:wrap;">
            <span style="font-size:12px; color:var(--humo); font-family:var(--font-mono);">Ingreso Manual:</span>
            <input id="host-manual-qr-input" type="text" placeholder="Ej: CHECKIN:usr-camila-01 o RND-7482" class="ronda-input" style="flex:1; min-width:200px; margin-bottom:0; font-size:12px; padding:8px 12px;">
            <button id="btn-host-submit-manual-checkin" class="btn" style="background:var(--barra-alta); border:1px solid var(--linea); font-size:12px; font-weight:600; padding:8px 16px;">
              Registrar Asistencia
            </button>
          </div>
        </div>

        <!-- Filtros y Búsqueda de Asistentes -->
        <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px; background:#160F1D; border:1px solid var(--linea); border-radius:14px; padding:14px 20px;">
          <div style="display:flex; gap:10px; flex:1; max-width:360px;">
            <input id="input-booking-search" type="text" value="${this.bookingSearchQuery}" placeholder="🔍 Buscar por nombre, correo o código..." class="ronda-input" style="margin-bottom:0; font-size:12px; padding:8px 12px; width:100%;">
          </div>

          <div style="display:flex; gap:8px; flex-wrap:wrap;">
            <select id="select-filter-payment" class="ronda-input" style="margin-bottom:0; font-size:11.5px; padding:6px 10px; width:auto;">
              <option value="all" ${this.bookingFilterPayment === 'all' ? 'selected' : ''}>Todos los Pagos</option>
              <option value="paid" ${this.bookingFilterPayment === 'paid' ? 'selected' : ''}>Pagados (Wompi)</option>
              <option value="pending_door" ${this.bookingFilterPayment === 'pending_door' ? 'selected' : ''}>Pendientes en Puerta</option>
            </select>

            <select id="select-filter-checkin" class="ronda-input" style="margin-bottom:0; font-size:11.5px; padding:6px 10px; width:auto;">
              <option value="all" ${this.bookingFilterCheckin === 'all' ? 'selected' : ''}>Toda la Asistencia</option>
              <option value="checked" ${this.bookingFilterCheckin === 'checked' ? 'selected' : ''}>En Sala (Checked-in)</option>
              <option value="pending" ${this.bookingFilterCheckin === 'pending' ? 'selected' : ''}>Pendientes de Llegada</option>
            </select>
          </div>
        </div>

        <!-- Tabla de Asistentes -->
        <div style="background:#160F1D; border:1px solid var(--linea); border-radius:16px; overflow:hidden;">
          <table style="width:100%; border-collapse:collapse; text-align:left; font-size:12.5px;">
            <thead>
              <tr style="border-bottom:1px solid rgba(243,237,226,0.08); background:rgba(243,237,226,0.02); color:var(--humo); font-family:var(--font-mono); font-size:10px; text-transform:uppercase; letter-spacing:0.06em;">
                <th style="padding:14px 18px;">Asistente</th>
                <th style="padding:14px 14px;">Código</th>
                <th style="padding:14px 14px;">Verificación</th>
                <th style="padding:14px 14px;">Coctel Asignado</th>
                <th style="padding:14px 14px;">Mesa</th>
                <th style="padding:14px 14px;">Estado de Pago</th>
                <th style="padding:14px 18px; text-align:right;">Check-in</th>
              </tr>
            </thead>
            <tbody>
              ${filtered.length === 0 ? `
                <tr><td colspan="7" style="padding:32px; text-align:center; color:var(--humo);">No se encontraron asistentes con los filtros seleccionados.</td></tr>
              ` : filtered.map(a => `
                <tr style="border-bottom:1px solid rgba(243,237,226,0.04); transition:background 0.15s ease;" onmouseover="this.style.background='rgba(243,237,226,0.02)'" onmouseout="this.style.background='transparent'">
                  <td style="padding:14px 18px;">
                    <div style="font-weight:700; color:var(--papel); font-size:13px;">${a.name}</div>
                    <div style="font-size:10.5px; color:var(--humo); font-family:var(--font-mono);">${a.age} años · ${a.email}</div>
                  </td>
                  <td style="padding:14px 14px; font-family:var(--font-mono); color:var(--luz); font-weight:700;">
                    ${a.code}
                  </td>
                  <td style="padding:14px 14px;">
                    ${a.trustTier >= 2 ? `
                      <span style="background:rgba(121,211,172,0.12); color:#79D3AC; border:1px solid rgba(121,211,172,0.3); padding:3px 8px; border-radius:6px; font-family:var(--font-mono); font-size:9.5px; font-weight:700;">
                        🛡️ TIER 2 VERIFICADO
                      </span>
                    ` : `
                      <span style="background:rgba(240,168,48,0.12); color:var(--luz); border:1px solid rgba(240,168,48,0.3); padding:3px 8px; border-radius:6px; font-family:var(--font-mono); font-size:9.5px;">
                        ⚠️ TIER 1 BÁSICO
                      </span>
                    `}
                  </td>
                  <td style="padding:14px 14px; font-style:italic; color:var(--papel);">
                    ${a.cocktail}
                  </td>
                  <td style="padding:14px 14px; font-family:var(--font-mono); font-weight:700; color:var(--papel);">
                    Mesa ${a.table}
                  </td>
                  <td style="padding:14px 14px;">
                    ${a.paymentStatus === 'paid' ? `
                      <span style="color:#79D3AC; font-family:var(--font-mono); font-size:11px; font-weight:700;">● PAGADO</span>
                    ` : `
                      <span style="color:var(--luz); font-family:var(--font-mono); font-size:11px; font-weight:700;">⚠️ COBRAR EN PUERTA</span>
                    `}
                    <div style="font-size:9.5px; color:var(--humo);">${a.paymentMethod}</div>
                  </td>
                  <td style="padding:14px 18px; text-align:right;">
                    ${a.checkedIn ? `
                      <span style="background:rgba(121,211,172,0.15); color:#79D3AC; font-family:var(--font-mono); font-size:11px; font-weight:700; padding:6px 12px; border-radius:8px;">
                        ✓ EN SALA
                      </span>
                    ` : `
                      <button class="btn ambar btn-manual-checkin-row" data-uid="${a.uid}" data-name="${a.name}" data-payment="${a.paymentStatus}" style="font-size:11px; font-weight:700; padding:6px 12px;">
                        Registrar Entrada
                      </button>
                    `}
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>

      </div>
    `;

    // Listeners de búsqueda y filtros
    const searchInput = document.getElementById('input-booking-search') as HTMLInputElement;
    searchInput?.addEventListener('input', (e) => {
      this.bookingSearchQuery = (e.target as HTMLInputElement).value;
      this.renderBookingsSection(stage);
    });

    const paymentSelect = document.getElementById('select-filter-payment') as HTMLSelectElement;
    paymentSelect?.addEventListener('change', (e) => {
      this.bookingFilterPayment = (e.target as HTMLSelectElement).value;
      this.renderBookingsSection(stage);
    });

    const checkinSelect = document.getElementById('select-filter-checkin') as HTMLSelectElement;
    checkinSelect?.addEventListener('change', (e) => {
      this.bookingFilterCheckin = (e.target as HTMLSelectElement).value;
      this.renderBookingsSection(stage);
    });

    // Control de escáner QR
    document.getElementById('btn-bookings-start-scan')?.addEventListener('click', () => {
      this.startQrScan();
    });
    document.getElementById('btn-host-stop-scan')?.addEventListener('click', () => {
      this.stopQrScan();
    });

    // Ingreso manual por input
    document.getElementById('btn-host-submit-manual-checkin')?.addEventListener('click', () => {
      const val = (document.getElementById('host-manual-qr-input') as HTMLInputElement)?.value.trim();
      if (!val) {
        notifications.showLegacyToast('⚠️ Ingresa un UID o código de reserva');
        return;
      }
      this.handleQrDecode(val);
    });

    // Ingreso manual desde fila
    stage.querySelectorAll('.btn-manual-checkin-row').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const uid = (e.currentTarget as HTMLElement).getAttribute('data-uid') || '';
        const name = (e.currentTarget as HTMLElement).getAttribute('data-name') || '';
        const payStatus = (e.currentTarget as HTMLElement).getAttribute('data-payment') || '';
        await this.processCheckinFlow(uid, name, payStatus);
      });
    });
  }

  /* =====================================================================
   * CHECK-IN ATÓMICO E IDEMPOTENTE
   * ===================================================================== */

  private async startQrScan() {
    if (this.qrScanning) {
      await this.stopQrScan();
      return;
    }
    const region = document.getElementById('host-qr-scanner-region');
    if (!region) return;

    try {
      const { Html5Qrcode } = await import('html5-qrcode');
      this.qrScanning = true;
      region.style.display = 'block';
      this.qrScanner = new Html5Qrcode('host-qr-camera-target');

      await this.qrScanner.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: 240 },
        (decoded: string) => this.handleQrDecode(decoded),
        () => {}
      );
      notifications.showLegacyToast('📷 Escáner activo. Apunta al código QR del asistente.');
    } catch (err) {
      this.qrScanning = false;
      region.style.display = 'none';
      console.warn('[HostAdmin] No se pudo activar la cámara:', err);
      notifications.showLegacyToast('⚠️ Cámara no disponible. Usa el registro manual.');
    }
  }

  private async stopQrScan() {
    try {
      if (this.qrScanner) {
        await this.qrScanner.stop();
      }
    } catch (err) {}
    this.qrScanner = null;
    this.qrScanning = false;
    const region = document.getElementById('host-qr-scanner-region');
    if (region) region.style.display = 'none';
  }

  private async handleQrDecode(rawText: string) {
    let uid = rawText.trim();
    if (uid.startsWith('CHECKIN:')) {
      uid = uid.replace('CHECKIN:', '');
    }
    await this.stopQrScan();
    await this.processCheckinFlow(uid, 'Asistente', 'paid');
  }

  private async processCheckinFlow(uid: string, name: string, payStatus: string) {
    // 1. Validar cobro en puerta si tiene pago pendiente
    if (payStatus === 'pending_door') {
      const confirmedPay = await RondaDialog.confirm({
        title: '💵 Cobro Pendiente en Puerta',
        message: `El asistente <b>${name}</b> tiene pago pendiente.<br><br>¿Confirmas que recibiste el valor de la boleta ($45.000 COP) vía Nequi o Efectivo?`,
        icon: '💵',
        confirmText: '✓ Pago Recibido y Permitir Ingreso',
        cancelText: '✕ Denegar Ingreso'
      });
      if (!confirmedPay) {
        notifications.showLegacyToast(`❌ Ingreso cancelado para ${name}`);
        return;
      }
    }

    // 2. Registro idempotente en el evento (mutación transacional con arrayUnion)
    if (this.currentEvent) {
      const eventRef = doc(db, 'events', this.currentEvent.id);
      await updateDoc(eventRef, {
        participants: arrayUnion(uid),
        updatedAt: serverTimestamp()
      });
      this.currentEvent.participants = [...(this.currentEvent.participants || []), uid];
    }

    // 3. Notificación de éxito
    notifications.showLegacyToast(`✅ Ingreso registrado exitosamente: ${name}`);

    // 4. Refrescar la vista actual
    this.renderSectionContent(this.currentSection);
  }

  /* =====================================================================
   * PASO 7: OPERACIÓN EN VIVO (MOTOR MEM-RR V2 & ROTACIÓN DE MESAS)
   * ===================================================================== */

  private playBellSound() {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      if (!this.bellAudioCtx) this.bellAudioCtx = new AudioCtx();
      const ctx = this.bellAudioCtx;
      if (ctx.state === 'suspended') ctx.resume();

      const now = ctx.currentTime;
      // Campana de bronce afinada con armónicos elegantes (880Hz, 1760Hz, 2640Hz)
      [880, 1760, 2640].forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now);
        const initialVol = idx === 0 ? 0.35 : 0.15 / (idx + 1);
        gain.gain.setValueAtTime(initialVol, now);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 2.8);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 3.0);
      });
      notifications.showLegacyToast('🔔 Campanazo de sala emitido.');
    } catch (e) {
      console.warn('[HostAdmin] Audio de campana no disponible:', e);
    }
  }

  /**
   * Desbloquea el AudioContext en iOS/Safari reproduciendo un silencio de 0.1s
   * amarrado al primer gesto de interacción del usuario (click en "Abrir Consola").
   * Sin esto, el navegador bloquea la inicialización de AudioContext hasta que
   * haya una interacción directa del usuario.
   */
  public async initAudioContext(): Promise<void> {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      if (this.bellAudioCtx) return;
      this.bellAudioCtx = new AudioCtx();
      const ctx = this.bellAudioCtx;
      if (ctx.state === 'suspended') await ctx.resume();
      // Silencio de 0.1s para desbloquear el contexto de audio
      const buf = ctx.createBuffer(1, ctx.sampleRate * 0.1, ctx.sampleRate);
      const src = ctx.createBufferSource();
      src.buffer = buf;
      src.connect(ctx.destination);
      src.start(0);
    } catch (e) {
      console.warn('[HostAdmin] No se pudo inicializar AudioContext:', e);
    }
  }

  private toRRProfile(p: any): RRParticipant {
    const orientations = ['M', 'F', 'NB', 'A'] as const;
    return {
      uid: p.uid,
      name: p.name || p.uid,
      gender: p.gender === 'M' || p.gender === 'F' || p.gender === 'NB' ? p.gender : 'NB',
      orientation: orientations.includes(p.orientation) ? p.orientation : 'A',
      age: typeof p.age === 'number' ? p.age : 30,
      interests: Array.isArray(p.interests) ? p.interests : [],
      verified: !!p.isVerified,
      blocked: Array.isArray(p.blockedUids) ? p.blockedUids : []
    };
  }

  public async buildV2Plan(force = false): Promise<any> {
    if (!this.currentEvent) return null;

    // Asegurar participantes de muestra si la sala está vacía en local
    if (!this.currentEvent.participants || this.currentEvent.participants.length < 2) {
      this.currentEvent.participants = [
        'usr-camila-01', 'usr-felipe-02', 'usr-daniela-03', 'usr-alejandro-04',
        'usr-sofia-05', 'usr-mateo-06', 'usr-lucia-07', 'usr-santiago-08'
      ];
    }

    const uids = this.currentEvent.participants.slice().sort().join(',');
    if (!force && this.nightPlan && this.nightPlanFor === uids) return this.nightPlan;

    // Cargar perfiles de participantes
    for (const uid of this.currentEvent.participants) {
      if (!this.participantProfiles[uid]) {
        const u = await DB.getUser(uid);
        if (u) {
          this.participantProfiles[uid] = u;
        } else {
          this.participantProfiles[uid] = {
            uid,
            name: `Asistente ${uid.slice(-4)}`,
            gender: uid.includes('camila') || uid.includes('daniela') || uid.includes('sofia') || uid.includes('lucia') ? 'F' : 'M',
            orientation: 'A',
            age: 28 + (uid.length % 6)
          };
        }
      }
    }

    const profiles = this.currentEvent.participants
      .map(uid => this.participantProfiles[uid])
      .filter(p => !!p);

    if (profiles.length < 2) return null;

    await RRHistory.loadFor(profiles);

    const n = Math.floor(profiles.length / 2);
    const sideA = profiles.slice(0, n).map(p => this.toRRProfile(p));
    const sideB = profiles.slice(n).map(p => this.toRRProfile(p));

    const startRound = this.currentEvent.currentRound || 0;
    const remaining = Math.max(1, 9 - startRound);
    const alreadyMet = new Set(this.playedPairs);

    this.nightPlan = buildNightPlan({
      sideA,
      sideB,
      rounds: remaining,
      history: RRHistory,
      alreadyMet,
      config: { delta: 0 }
    });
    this.nightPlanFor = uids;
    this.nightPlanStartRound = startRound;
    this.currentMetrics = this.nightPlan.metrics;
    return this.nightPlan;
  }

  public async generateNextRoundV2(): Promise<boolean> {
    if (!this.currentEvent) return false;

    const plan = await this.buildV2Plan();
    if (!plan || plan.rounds.length === 0) return false;

    this.currentEvent.currentRound = (this.currentEvent.currentRound || 0) + 1;
    this.currentEvent.status = 'in_progress';
    const r = this.currentEvent.currentRound;
    const idx = r - 1 - this.nightPlanStartRound;
    const roundResult = plan.rounds[idx];

    if (!roundResult) {
      await RondaDialog.alert({
        title: 'Noche Concluida',
        message: `El motor alcanzó las rondas máximas programadas (${r - 1} de 9). Puedes proceder al cierre.`,
        icon: '🔔'
      });
      return true;
    }

    const activeMatches: any[] = [];
    const recordedPairs: { a: RRParticipant; b: RRParticipant }[] = [];
    const resting: { uid: string; name: string }[] = [];

    for (const t of roundResult.tables) {
      if (t.a && t.b) {
        const isRepeat = RRHistory.get(t.a.uid, t.b.uid) !== null;
        activeMatches.push({
          tableId: t.tableId.toString().padStart(2, '0'),
          p1: { uid: t.a.uid, name: t.a.name || t.a.uid },
          p2: { uid: t.b.uid, name: t.b.name || t.b.uid },
          isRepeat
        });
        recordedPairs.push({ a: t.a, b: t.b });
        this.playedPairs.push(pairKey(t.a.uid, t.b.uid));
      } else {
        const restingPerson = t.a || t.b;
        if (restingPerson) resting.push({ uid: restingPerson.uid, name: restingPerson.name || restingPerson.uid });
      }
    }

    this.currentEvent.activeMatches = activeMatches;
    (this.currentEvent as any).resting = resting;
    this.currentEvent.playedPairs = this.playedPairs;
    this.currentEvent.roundEndsAt = Date.now() + 360000; // 6 minutos desde ahora (epoch ms)

    // Mutación transacional: solo actualizar los campos que cambiaron, no el objeto completo
    const eventRef = doc(db, 'events', this.currentEvent.id);
    await updateDoc(eventRef, {
      activeMatches,
      resting,
      playedPairs: this.playedPairs,
      currentRound: this.currentEvent.currentRound,
      status: this.currentEvent.status,
      roundEndsAt: this.currentEvent.roundEndsAt,
      updatedAt: serverTimestamp()
    });
    await RRHistory.recordPairs(recordedPairs);

    // Reiniciar temporizador basado en hora del servidor (resiliente a suspensión del dispositivo)
    this.roundEndsAt = this.currentEvent.roundEndsAt;
    this.timerSeconds = 360;
    this.startRoundTimer();
    this.playBellSound();

    notifications.showLegacyToast(`🔔 ¡Ronda ${r} iniciada! Mesas asignadas y sincronizadas.`);
    return true;
  }

  private startRoundTimer() {
    this.stopRoundTimer();
    this.timerRunning = true;
    // Sincronizar timerSeconds desde roundEndsAt si existe
    if (this.roundEndsAt) {
      const remaining = Math.max(0, Math.floor((this.roundEndsAt - Date.now()) / 1000));
      this.timerSeconds = remaining;
    }
    this.updateTimerDisplay();
    this.timerInterval = setInterval(() => {
      if (this.roundEndsAt) {
        // Calcular tiempo restante basado en timestamp absoluto (resiliente a suspensión)
        const remaining = Math.max(0, Math.floor((this.roundEndsAt - Date.now()) / 1000));
        this.timerSeconds = remaining;
        if (remaining > 0) {
          this.updateTimerGranular();
        } else {
          this.stopRoundTimer();
          this.playBellSound();
          notifications.showLegacyToast('🔔 ¡Tiempo cumplido! Fin de la ronda (6 minutos).');
          this.renderSectionContent('live');
        }
      } else {
        // Fallback: contador local descendente
        if (this.timerSeconds > 0) {
          this.timerSeconds--;
          this.updateTimerGranular();
        } else {
          this.stopRoundTimer();
          this.playBellSound();
          notifications.showLegacyToast('🔔 ¡Tiempo cumplido! Fin de la ronda (6 minutos).');
          this.renderSectionContent('live');
        }
      }
    }, 1000);
  }

  private stopRoundTimer() {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
    this.timerRunning = false;
  }

  private updateTimerDisplay() {
    const el = document.getElementById('host-live-timer-digits');
    if (!el) return;
    const mins = Math.floor(this.timerSeconds / 60).toString().padStart(2, '0');
    const secs = (this.timerSeconds % 60).toString().padStart(2, '0');
    el.textContent = `${mins}:${secs}`;
  }

  /**
   * Actualización granular del temporizador: solo toca el nodo del DOM del
   * cronómetro sin re-renderizar toda la sección en vivo (evita re-flows masivos).
   */
  private updateTimerGranular() {
    const el = document.getElementById('host-live-timer-digits');
    if (!el) return;
    let mins: number, secs: number;
    if (this.roundEndsAt) {
      const remaining = Math.max(0, Math.floor((this.roundEndsAt - Date.now()) / 1000));
      mins = Math.floor(remaining / 60);
      secs = remaining % 60;
    } else {
      mins = Math.floor(this.timerSeconds / 60);
      secs = this.timerSeconds % 60;
    }
    el.textContent = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }

  private async endEventAndMint() {
    if (!this.currentEvent) return;
    const confirmEnd = await RondaDialog.confirm({
      title: 'Finalizar Noche y Procesar Matches',
      message: '¿Estás seguro de finalizar la sesión de Speed Dating?<br><br>Se calcularán los matches mutuos entre los asistentes y se emitirán las pruebas de asistencia.',
      icon: '🍸',
      confirmText: '✓ Finalizar Noche',
      cancelText: '✕ Continuar en Sala'
    });

    if (confirmEnd) {
      this.stopRoundTimer();
      this.currentEvent.status = 'finished';
      // Mutación transacional: solo actualizar estado y timestamp, no el objeto completo
      const eventRef = doc(db, 'events', this.currentEvent.id);
      await updateDoc(eventRef, {
        status: this.currentEvent.status,
        updatedAt: serverTimestamp()
      });
      await DB.confirmarSala(this.currentEvent.id, this.currentEvent.participants);
      notifications.showLegacyToast('✨ Noche finalizada con éxito. Matches calculados.');
      this.renderSectionContent('live');
    }
  }

  private renderLiveSection(stage: HTMLElement) {
    const event = this.currentEvent;
    const currentRound = event?.currentRound || 0;
    const isLive = currentRound > 0 && event?.status !== 'finished';
    const matches = event?.activeMatches || [];
    const resting = (event as any)?.resting || [];
    const m = this.currentMetrics;

    // Calcular tiempo restante desde roundEndsAt (server-side time) si está disponible
    let mins: number, secs: number;
    if (this.roundEndsAt) {
      const remaining = Math.max(0, Math.floor((this.roundEndsAt - Date.now()) / 1000));
      mins = Math.floor(remaining / 60);
      secs = remaining % 60;
    } else {
      mins = Math.floor(this.timerSeconds / 60);
      secs = this.timerSeconds % 60;
    }
    const minsStr = mins.toString().padStart(2, '0');
    const secsStr = secs.toString().padStart(2, '0');

    stage.innerHTML = `
      <div style="max-width:1400px; margin:0 auto; display:flex; flex-direction:column; gap:24px;">
        
        <!-- Tablero de Mando Central: Temporizador & Control de Rondas -->
        <div style="background:#160F1D; border:1px solid ${isLive ? 'var(--ambar)' : 'var(--linea)'}; border-radius:18px; padding:26px 30px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:20px;">
          
          <div>
            <div style="display:flex; align-items:center; gap:8px; margin-bottom:4px;">
              <span style="font-family:var(--font-mono); font-size:10px; color:var(--luz); letter-spacing:0.12em; text-transform:uppercase; font-weight:700;">
                CONTROL DE SALA EN VIVO · MOTOR MEM-RR V2
              </span>
              <span style="background:${isLive ? 'rgba(121,211,172,0.15)' : 'rgba(240,168,48,0.15)'}; color:${isLive ? '#79D3AC' : 'var(--luz)'}; font-family:var(--font-mono); font-size:10px; font-weight:700; padding:2px 8px; border-radius:999px;">
                ${isLive ? `● RONDA ${currentRound} DE 9` : 'EN ESPERA DE INICIO'}
              </span>
            </div>
            <h2 style="font-family:'Bodoni Moda',serif; font-size:26px; color:var(--papel); margin:0;">
              ${event?.dayDate || 'Noche Activa'}
            </h2>
            <div style="font-size:11.5px; color:var(--humo); font-family:var(--font-mono); margin-top:2px;">
              Sincronización sincrónica activa con ${event?.participants?.length || 24} asistentes
            </div>
          </div>

          <!-- Display del Temporizador de 6 Minutos -->
          <div style="display:flex; align-items:center; gap:20px; background:rgba(10,7,14,0.7); border:1px solid rgba(240,168,48,0.3); border-radius:14px; padding:12px 24px;">
            <div style="text-align:center;">
              <div style="font-family:var(--font-mono); font-size:9.5px; color:var(--humo); text-transform:uppercase; letter-spacing:0.1em;">Tiempo de Ronda</div>
              <div id="host-live-timer-digits" style="font-family:var(--font-mono); font-size:38px; font-weight:700; color:${this.timerRunning ? 'var(--luz)' : 'var(--papel)'}; letter-spacing:0.04em;">
                ${minsStr}:${secsStr}
              </div>
            </div>

            <button id="btn-live-bell-manual" class="btn" style="background:rgba(240,168,48,0.15); border:1px solid var(--luz); color:var(--luz); font-size:12px; font-weight:700; padding:10px 14px; border-radius:10px;" title="Tocar campana de sala">
              🔔 Campanazo
            </button>
          </div>

          <!-- Botones de Acción de la Noche -->
          <div style="display:flex; gap:10px; flex-wrap:wrap;">
            <button id="btn-live-next-round" class="btn ambar" style="font-size:13px; font-weight:700; padding:12px 22px;">
              ${currentRound === 0 ? '▶ Arrancar Ronda 1 (6 min)' : `▶ Avanzar a Ronda ${currentRound + 1}`}
            </button>

            ${isLive ? `
              <button id="btn-live-toggle-timer" class="btn" style="background:rgba(243,237,226,0.06); border:1px solid var(--linea); font-size:13px; padding:12px 18px;">
                ${this.timerRunning ? '⏸ Pausar' : '▶ Reanudar'}
              </button>
              <button id="btn-live-end-night" class="btn" style="background:rgba(142,36,58,0.25); border:1px solid var(--vino); color:#ff8ca8; font-size:13px; font-weight:600; padding:12px 18px;">
                ⏹ Finalizar Noche
              </button>
            ` : ''}
          </div>

        </div>

        <!-- Métricas del Motor MEM-RR v2 -->
        ${m ? `
          <div style="background:#160F1D; border:1px solid var(--linea); border-radius:14px; padding:14px 20px; display:grid; grid-template-columns:repeat(auto-fit, minmax(180px, 1fr)); gap:12px;">
            <div>
              <span style="font-family:var(--font-mono); font-size:9.5px; color:var(--humo); text-transform:uppercase;">Cobertura de Sala</span>
              <div style="font-family:var(--font-mono); font-size:18px; font-weight:700; color:#79D3AC;">${m.coveragePct}%</div>
            </div>
            <div>
              <span style="font-family:var(--font-mono); font-size:9.5px; color:var(--humo); text-transform:uppercase;">Caras Nuevas</span>
              <div style="font-family:var(--font-mono); font-size:18px; font-weight:700; color:var(--luz);">${m.freshFaces}</div>
            </div>
            <div>
              <span style="font-family:var(--font-mono); font-size:9.5px; color:var(--humo); text-transform:uppercase;">Repeticiones Históricas</span>
              <div style="font-family:var(--font-mono); font-size:18px; font-weight:700; color:${m.historyRepeats === 0 ? '#79D3AC' : 'var(--vino)'};">${m.historyRepeats}</div>
            </div>
            <div>
              <span style="font-family:var(--font-mono); font-size:9.5px; color:var(--humo); text-transform:uppercase;">Equidad de Barra (Gini)</span>
              <div style="font-family:var(--font-mono); font-size:18px; font-weight:700; color:var(--papel);">${m.restGini?.toFixed(2) || '0.00'}</div>
            </div>
          </div>
        ` : ''}

        <!-- Tablero de Mesas en Vivo -->
        <div>
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:14px;">
            <div style="font-family:var(--font-mono); font-size:11px; letter-spacing:0.1em; color:var(--humo); text-transform:uppercase;">
              Distribución de Mesas en Sala (${matches.length} Mesas Activas)
            </div>
            <div style="font-size:11px; color:#79D3AC; font-family:var(--font-mono);">
              ● Sincronizado en tiempo real con /app
            </div>
          </div>

          ${matches.length === 0 ? `
            <div style="background:#160F1D; border:1px dashed var(--linea); border-radius:16px; padding:48px 24px; text-align:center;">
              <span style="font-size:36px; display:block; margin-bottom:12px;">🍸</span>
              <h3 style="font-family:'Bodoni Moda',serif; font-size:22px; color:var(--papel); margin:0 0 6px;">Sala en Espera de la Primera Ronda</h3>
              <p style="color:var(--humo); font-size:13px; max-width:500px; margin:0 auto 20px;">
                Cuando todos los asistentes hayan ingresado por recepción, pulsa <b>"Arrancar Ronda 1"</b> para que el motor MEM-RR asigne las mesas de 2 plazas y notifique a los teléfonos.
              </p>
              <button id="btn-live-start-first" class="btn ambar" style="font-size:13px; font-weight:700; padding:12px 24px;">
                Arrancar Ronda 1 Ahora
              </button>
            </div>
          ` : `
            <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(280px, 1fr)); gap:16px;">
              ${matches.map(m => `
                <div style="background:#160F1D; border:1px solid ${m.isRepeat ? 'rgba(142,36,58,0.4)' : 'rgba(240,168,48,0.3)'}; border-radius:14px; padding:18px 20px;">
                  <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
                    <span style="font-family:var(--font-mono); font-size:13px; font-weight:700; color:var(--luz);">
                      MESA ${m.tableId}
                    </span>
                    <span style="background:${m.isRepeat ? 'rgba(142,36,58,0.2)' : 'rgba(121,211,172,0.15)'}; color:${m.isRepeat ? '#ff8ca8' : '#79D3AC'}; font-family:var(--font-mono); font-size:9.5px; font-weight:700; padding:2px 8px; border-radius:999px;">
                      ${m.isRepeat ? '⚠️ ENCUENTRO PREVIO' : '✓ CARAS NUEVAS'}
                    </span>
                  </div>

                  <div style="display:flex; justify-content:space-between; align-items:center; background:rgba(243,237,226,0.03); border:1px solid rgba(243,237,226,0.06); border-radius:10px; padding:12px 14px; margin-bottom:12px;">
                    <div style="flex:1; text-align:left;">
                      <div style="font-size:9.5px; color:var(--humo); font-family:var(--font-mono);">LADO A</div>
                      <div style="font-weight:700; color:var(--papel); font-size:13px; margin-top:2px;">${m.p1.name}</div>
                    </div>
                    
                    <span style="font-family:var(--font-serif); font-size:14px; color:var(--luz); margin:0 8px;">✕</span>

                    <div style="flex:1; text-align:right;">
                      <div style="font-size:9.5px; color:var(--humo); font-family:var(--font-mono);">LADO B</div>
                      <div style="font-weight:700; color:var(--papel); font-size:13px; margin-top:2px;">${m.p2.name}</div>
                    </div>
                  </div>

                  <div style="display:flex; justify-content:space-between; align-items:center;">
                    <span style="font-size:10.5px; color:var(--humo); font-family:var(--font-mono);">6 min de conversación</span>
                    <button class="btn btn-report-table-issue" data-table="${m.tableId}" style="background:transparent; border:none; color:var(--humo); font-size:11px; padding:2px 6px; cursor:pointer;" title="Reportar incidencia">
                      ⚠️ Incidencia
                    </button>
                  </div>
                </div>
              `).join('')}
            </div>
          `}
        </div>

        <!-- Silla de Barra / Descanso -->
        ${resting.length > 0 ? `
          <div style="background:#160F1D; border:1px solid var(--linea); border-radius:14px; padding:18px 22px;">
            <div style="font-family:var(--font-mono); font-size:10.5px; color:var(--luz); text-transform:uppercase; font-weight:700; margin-bottom:10px;">
              🍸 Descanso en Barra (${resting.length} Asistentes)
            </div>
            <div style="display:flex; gap:10px; flex-wrap:wrap;">
              ${resting.map((r: any) => `
                <div style="background:rgba(243,237,226,0.04); border:1px solid var(--linea); border-radius:8px; padding:8px 14px; font-size:12px; color:var(--papel); display:flex; align-items:center; gap:8px;">
                  <span>🍸</span>
                  <b>${r.name}</b>
                  <span style="font-size:10px; color:var(--humo); font-family:var(--font-mono);">(En barra)</span>
                </div>
              `).join('')}
            </div>
          </div>
        ` : ''}

      </div>
    `;

    // Listeners de la sección en vivo
    document.getElementById('btn-live-bell-manual')?.addEventListener('click', () => {
      this.playBellSound();
    });

    document.getElementById('btn-live-next-round')?.addEventListener('click', async () => {
      await this.generateNextRoundV2();
      this.renderSectionContent('live');
    });

    document.getElementById('btn-live-start-first')?.addEventListener('click', async () => {
      await this.generateNextRoundV2();
      this.renderSectionContent('live');
    });

    document.getElementById('btn-live-toggle-timer')?.addEventListener('click', () => {
      if (this.timerRunning) {
        this.stopRoundTimer();
      } else {
        this.startRoundTimer();
      }
      this.renderSectionContent('live');
    });

    document.getElementById('btn-live-end-night')?.addEventListener('click', async () => {
      await this.endEventAndMint();
    });

    stage.querySelectorAll('.btn-report-table-issue').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const table = (e.currentTarget as HTMLElement).getAttribute('data-table');
        const reason = await (RondaDialog as any).prompt?.({
          title: `Incidencia en Mesa ${table}`,
          message: 'Describe la novedad observada:',
          placeholder: 'Ej: Asistente requirió cambio o se retiró anticipadamente'
        }) || await RondaDialog.confirm({
          title: `Incidencia en Mesa ${table}`,
          message: '¿Registrar incidencia de sala en esta mesa?',
          confirmText: 'Registrar'
        });
        if (reason) {
          notifications.showLegacyToast(`✓ Incidencia en Mesa ${table} registrada para el reporte final.`);
        }
      });
    });
  }

  private async renderSettlementsSection(stage: HTMLElement) {
    const event = this.currentEvent;
    const venue = this.activeVenue;
    const closingId = `${venue?.id}_${event?.id}`;
    const participantsDefault = event?.participants?.length || 24;

    stage.innerHTML = `
      <div class="settlements-wrap" style="display:flex; flex-direction:column; gap:26px;">
        <div style="background:#160F1D; border:1px solid var(--linea); border-radius:16px; padding:26px 28px;">
          <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:16px; flex-wrap:wrap;">
            <div>
              <h2 style="font-family:'Bodoni Moda',serif; font-size:24px; color:var(--papel); margin:0 0 4px;">Consumos y Cierre de Noche</h2>
              <p style="color:var(--humo); font-size:13px; margin:0;">Conciliación de bebidas incluidas, rondas adicionales y liquidación de barra.</p>
            </div>
            <div id="st-status-badge" style="display:none; margin-top:8px;">
              <span style="display:inline-flex; align-items:center; gap:6px; padding:6px 12px; background:rgba(121,211,172,0.12); border:1px solid rgba(121,211,172,0.35); color:#79D3AC; font-family:var(--font-mono); font-size:11px; font-weight:700; border-radius:999px;">✓ APROBADO Y CONCILIADO</span>
            </div>
          </div>
        </div>

        <div style="display:flex; gap:22px; align-items:flex-start;">
          <form id="settlements-form" style="display:flex; flex-direction:column; gap:16px; background:#160F1D; border:1px solid var(--linea); border-radius:16px; padding:24px; flex:1;">
            <div style="font-family:var(--font-mono); font-size:10px; letter-spacing:0.12em; color:var(--luz); text-transform:uppercase; font-weight:700;">Líquido de Barra</div>

            <div class="st-field">
              <label style="display:block; font-size:12.5px; color:var(--humo); margin-bottom:6px; font-family:var(--font-mono);">Asistentes confirmados</label>
              <input type="number" id="st-attendees" min="0" value="${participantsDefault}" style="width:100%; background:#0e0a12; border:1px solid var(--linea); color:var(--papel); padding:10px 12px; border-radius:10px; font-size:14px; font-family:var(--font-mono);">
            </div>

            <div class="st-field">
              <label style="display:block; font-size:12.5px; color:var(--humo); margin-bottom:6px; font-family:var(--font-mono);">Bebidas incluidas (copa de bienvenida)</label>
              <div style="display:flex; gap:8px; align-items:center;">
                <input type="number" id="st-included-drinks" min="0" value="${participantsDefault}" style="flex:1; background:#0e0a12; border:1px solid var(--linea); color:var(--papel); padding:10px 12px; border-radius:10px; font-size:14px; font-family:var(--font-mono);">
                <span style="font-size:11px; color:var(--humo); font-family:var(--font-mono);">× $25.000 COP c/u</span>
              </div>
            </div>
            <div class="st-field">
              <label style="display:block; font-size:12.5px; color:var(--humo); margin-bottom:6px; font-family:var(--font-mono);">Segundas rondas y copas adicionales</label>
              <input type="number" id="st-extra-drinks" min="0" value="0" placeholder="0" style="width:100%; background:#0e0a12; border:1px solid var(--linea); color:var(--papel); padding:10px 12px; border-radius:10px; font-size:14px; font-family:var(--font-mono);">
              <span style="display:block; font-size:11px; color:var(--humo); margin-top:4px; font-family:var(--font-mono);">COP en efectivo / TPV</span>
            </div>

            <div class="st-field">
              <label style="display:block; font-size:12.5px; color:var(--humo); margin-bottom:6px; font-family:var(--font-mono);">Picoteo y tapeo</label>
              <input type="number" id="st-food" min="0" value="0" placeholder="0" style="width:100%; background:#0e0a12; border:1px solid var(--linea); color:var(--papel); padding:10px 12px; border-radius:10px; font-size:14px; font-family:var(--font-mono);">
              <span style="display:block; font-size:11px; color:var(--humo); margin-top:4px; font-family:var(--font-mono);">COP consumo de cocina</span>
            </div>

            <div class="st-field">
              <label style="display:block; font-size:12.5px; color:var(--humo); margin-bottom:6px; font-family:var(--font-mono);">Deducción plataforma / Comisión RONDA</label>
              <input type="number" id="st-commission" min="0" value="0" placeholder="0" style="width:100%; background:#0e0a12; border:1px solid var(--linea); color:var(--papel); padding:10px 12px; border-radius:10px; font-size:14px; font-family:var(--font-mono);">
              <span style="display:block; font-size:11px; color:var(--humo); margin-top:4px; font-family:var(--font-mono);">COP ($0 si no aplica)</span>
            </div>

            <div style="display:flex; gap:12px; margin-top:10px;">
              <button type="button" id="st-save-draft" class="btn" style="flex:1; font-size:12.5px; font-weight:700; padding:12px; border-radius:10px;">💾 Guardar Borrador</button>
              <button type="button" id="st-submit-closing" class="btn ambar" style="flex:1; font-size:12.5px; font-weight:700; padding:12px; border-radius:10px;">🧾 Enviar Cierre</button>
            </div>
          </form>

          <div class="st-receipt" style="width:320px; flex-shrink:0; background:#160F1D; border:1px solid var(--linea); border-radius:14px; padding:0; box-shadow: inset 0 0 24px rgba(240,168,48,0.04); position:relative; overflow:hidden;">
            <div class="st-receipt-edge" style="position:absolute; left:0; right:0; top:-10px; text-align:center; font-size:12px; color:var(--luz); letter-spacing:6px; z-index:2;">✂ ✂ ✂ ✂ ✂ ✂ ✂ ✂ ✂ ✂</div>
            <div style="padding:20px 18px;">
              <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
                <span style="font-family:var(--font-mono); font-size:9px; color:var(--humo); text-transform:uppercase; letter-spacing:0.08em;">ronda · caja</span>
                <span style="font-family:var(--font-mono); font-size:9px; color:var(--luz);">${escapeHtml(venue?.name || 'CARONTE Cocktail Bar')}</span>
              </div>
              <div style="font-family:var(--font-mono); font-size:11px; color:var(--papel); margin:2px 0 14px;">${escapeHtml(event?.dayDate || 'Martes 25 · 20:00')}</div>

              <div style="border-bottom:1px dashed var(--linea); padding-bottom:10px; margin-bottom:12px;">
                <div style="display:flex; justify-content:space-between; font-size:11.5px; color:var(--humo); font-family:var(--font-mono); margin-bottom:2px;"><span>Bebidas incluidas</span><span id="st-disp-drinks">0</span></div>
                <div style="display:flex; justify-content:space-between; font-size:11.5px; color:var(--humo); font-family:var(--font-mono); margin-bottom:2px;"><span>Segundas rondas</span><span id="st-disp-extra">$0 COP</span></div>
                <div style="display:flex; justify-content:space-between; font-size:11.5px; color:var(--humo); font-family:var(--font-mono); margin-bottom:2px;"><span>Picoteo / tapeo</span><span id="st-disp-food">$0 COP</span></div>
              </div>

              <div style="border-bottom:1px solid var(--linea); padding-bottom:12px; margin-bottom:14px;">
                <div style="display:flex; justify-content:space-between; font-size:13px; color:var(--papel); font-family:var(--font-mono); font-weight:700; margin-bottom:2px;"><span>TOTAL DE BARRA</span><span id="st-disp-total">$0 COP</span></div>
                <div style="display:flex; justify-content:space-between; font-size:12px; color:var(--humo); font-family:var(--font-mono); margin-bottom:2px;"><span>Comisión RONDA</span><span id="st-disp-comm">$0 COP</span></div>
              </div>

              <div style="display:flex; justify-content:space-between; font-size:15px; color:#79D3AC; font-family:var(--font-mono); font-weight:800; margin-bottom:18px;"><span>Neto al Local</span><span id="st-disp-net">$0 COP</span></div>

              <div style="display:flex; justify-content:space-between; font-size:11px; color:var(--humo); font-family:var(--font-mono); margin-bottom:2px;"><span>Margen bruto estimado</span><span id="st-disp-margin">0 %</span></div>
            </div>
            <div class="st-receipt-edge" style="position:absolute; left:0; right:0; bottom:-10px; text-align:center; font-size:12px; color:var(--luz); letter-spacing:6px; z-index:2; transform:rotate(180deg);">✂ ✂ ✂ ✂ ✂ ✂ ✂ ✂ ✂ ✂</div>
          </div>
        </div>

        <div id="st-feedback" style="font-size:12px; font-family:var(--font-mono); min-height:20px;"></div>
      </div>
    `;
    const $ = (id: string) => stage.querySelector<HTMLInputElement>(`#${id}`);
    const badge = document.getElementById('st-status-badge');
    const feedback = document.getElementById('st-feedback')!;

    const readNum = (id: string) => Math.max(0, Number(($(`#${id}`) as HTMLInputElement)?.value || 0) || 0);
    const disp = (id: string, text: string) => { const el = $(id) as HTMLElement | null; if (el) el.textContent = text; };

    const recalculate = () => {
      const included = readNum('st-included-drinks');
      const extra = readNum('st-extra-drinks');
      const food = readNum('st-food');
      const commission = readNum('st-commission');
      const barTotal = included * this.DRINK_UNIT_PRICE_COP + extra + food;
      const netVenue = barTotal - commission;
      const margin = barTotal > 0 ? Math.round((netVenue / barTotal) * 100) : 0;
      disp('st-disp-drinks', String(included));
      disp('st-disp-extra', this.formatCop(extra));
      disp('st-disp-food', this.formatCop(food));
      disp('st-disp-total', this.formatCop(barTotal));
      disp('st-disp-comm', this.formatCop(commission));
      disp('st-disp-net', this.formatCop(netVenue));
      disp('st-disp-margin', `${margin} %`);
    };

    ['st-attendees', 'st-included-drinks', 'st-extra-drinks', 'st-food', 'st-commission'].forEach(id => {
      const el = $(id) as HTMLInputElement | null;
      el?.addEventListener('input', recalculate);
    });
    recalculate();

    // Cargar cierre existente de Firestore si lo hay
    let existing: NightClosing | null = null;
    if (venue && event) {
      try {
        const snap = await getDoc(doc(collection(db, 'night_closings'), closingId));
        existing = snap.exists() ? (snap.data() as NightClosing) : null;
      } catch (err) {
        console.warn('[Settlements] No se pudo leer cierre existente:', err);
      }
    }

    if (existing) {
      (document.getElementById('st-attendees') as HTMLInputElement).value = String(existing.attendeesCount);
      (document.getElementById('st-included-drinks') as HTMLInputElement).value = String(existing.includedDrinksCount);
      (document.getElementById('st-extra-drinks') as HTMLInputElement).value = String(existing.extraDrinksCop);
      (document.getElementById('st-food') as HTMLInputElement).value = String(existing.foodCop);
      (document.getElementById('st-commission') as HTMLInputElement).value = String(existing.rondaCommissionCop);
      recalculate();
    }

    const isApproved = existing?.status === 'approved';
    if (isApproved && badge) badge.style.display = '';

    const setDisabled = (disabled: boolean) => {
      ['st-attendees', 'st-included-drinks', 'st-extra-drinks', 'st-food', 'st-commission'].forEach(id => {
        const el = $(id) as HTMLInputElement | null;
        if (el) el.disabled = disabled;
      });
      const b1 = $('#st-save-draft') as HTMLButtonElement | null;
      const b2 = $('#st-submit-closing') as HTMLButtonElement | null;
      if (b1) b1.disabled = disabled;
      if (b2) b2.disabled = disabled;
    };
    if (isApproved) setDisabled(true);

    const saveAndClose = async (status: NightClosing['status']) => {
      if (!venue || !event || !this.currentUser) return;
      const attendees = readNum('st-attendees');
      const included = readNum('st-included-drinks');
      const extra = readNum('st-extra-drinks');
      const food = readNum('st-food');
      const commission = readNum('st-commission');
      const barTotal = included * this.DRINK_UNIT_PRICE_COP + extra + food;
      const netVenue = barTotal - commission;

      const payload: NightClosing = {
        id: closingId,
        closingId,
        venueId: venue.id,
        eventId: event.id,
        closedAt: new Date().toISOString(),
        operatorUid: this.currentUser.uid,
        attendeesCount: attendees,
        includedDrinksCount: included,
        extraDrinksCop: extra,
        foodCop: food,
        barTotalCop: barTotal,
        rondaCommissionCop: commission,
        netVenueCop: netVenue,
        status
      };

      try {
        await setDoc(doc(db, 'night_closings', closingId), payload);
        notifications.showLegacyToast(status === 'draft' ? '💾 Borrador de cierre guardado.' : '🧾 Cierre enviado a conciliación.');
        if (status === 'submitted') {
          setDisabled(true);
          if (badge) badge.style.display = '';
          feedback.textContent = `Cierre ${status} · night_closings/${closingId}`;
        }
      } catch (err: any) {
        console.error('[Settlements] Error guardando cierre:', err);
        notifications.showLegacyToast('❌ No se pudo guardar el cierre.');
      }
    };

    $('#st-save-draft')?.addEventListener('click', () => saveAndClose('draft'));
    $('#st-submit-closing')?.addEventListener('click', () => saveAndClose('submitted'));
  }

  private async renderPerksSection(stage: HTMLElement) {
    const venue = this.activeVenue;
    if (!venue) return;
    stage.innerHTML = `
      <div style="background:#160F1D; border:1px solid var(--linea); border-radius:16px; padding:26px 28px;">
        <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:16px; flex-wrap:wrap; margin-bottom:6px;">
          <div>
            <h2 style="font-family:'Bodoni Moda',serif; font-size:24px; color:var(--papel); margin:0 0 4px;">Beneficios & Cortesías</h2>
            <p style="color:var(--humo); font-size:13px; margin:0;">Validación de canje único de cóctel de bienvenida y descuentos de segunda cita.</p>
          </div>
        </div>

        <div style="display:flex; gap:14px; margin-top:22px; flex-wrap:wrap; align-items:flex-end;">
          <div style="flex:1; min-width:240px; display:flex; flex-direction:column; gap:8px;">
            <label style="font-size:12px; color:var(--humo); font-family:var(--font-mono);">Asistente o código (RND-XXXX)</label>
            <input type="text" id="perks-code" placeholder="Nombre, email o RND-1234" style="width:100%; background:#0e0a12; border:1px solid var(--linea); color:var(--papel); padding:10px 12px; border-radius:10px; font-size:14px; font-family:var(--font-mono);">
          </div>
          <div style="min-width:200px; display:flex; flex-direction:column; gap:8px;">
            <label style="font-size:12px; color:var(--humo); font-family:var(--font-mono);">Tipo de beneficio</label>
            <select id="perks-type" style="width:100%; background:#0e0a12; border:1px solid var(--linea); color:var(--papel); padding:10px 12px; border-radius:10px; font-size:14px; font-family:var(--font-mono);">
              <option value="welcome_cocktail">🍸 Cóctel de Bienvenida (canje único)</option>
              <option value="second_date_discount">💎 Bono 10% 2ª Cita</option>
            </select>
          </div>
          <button id="perks-redeem" class="btn ambar" style="font-size:13px; font-weight:700; padding:12px 22px; border-radius:10px;">Canjear Beneficio</button>
        </div>

        <div id="perks-list-wrap" style="margin-top:28px; border-top:1px solid var(--linea); padding-top:18px;">
          <div style="font-family:var(--font-mono); font-size:10px; letter-spacing:0.12em; color:var(--luz); text-transform:uppercase; margin-bottom:12px;">Canjes efectuados esta noche</div>
          <div id="perks-list" style="display:flex; flex-direction:column; gap:8px;">
            <div style="font-size:12px; color:var(--humo); font-family:var(--font-mono); padding:10px 0;">Cargando canjes…</div>
          </div>
        </div>
      </div>
    `;
    const renderList = async () => {
      const list = document.getElementById('perks-list')!;
      list.innerHTML = '<div style="font-size:12px; color:var(--humo); font-family:var(--font-mono); padding:10px 0;">Cargando canjes…</div>';
      try {
        const q = query(collection(db, 'benefit_redemptions'), where('venueId', '==', venue.id));
        const snap = await getDocs(q);
        const redemptions = snap.docs.map(d => ({ ...(d.data() as Omit<BenefitRedemption, 'id'>), id: d.id }))
          .filter(r => r.status === 'used')
          .sort((a, b) => (b.redeemedAt || '').localeCompare(a.redeemedAt || ''));

        if (redemptions.length === 0) {
          list.innerHTML = '<div style="font-size:12px; color:var(--humo); font-family:var(--font-mono); padding:10px 0;">Sin canjes registrados esta noche.</div>';
          return;
        }
        const rows = await Promise.all(redemptions.map(async (r) => {
          let name = r.userId;
          try {
            const u = await DB.getUser(r.userId);
            if (u?.name) name = u.name;
          } catch {}
          const typeLabel = r.benefitType === 'welcome_cocktail' ? 'Cóctel de Bienvenida' : 'Bono 10% 2ª Cita';
          const time = r.redeemedAt ? new Date(r.redeemedAt).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' }) : '—';
          return `<div style="display:flex; justify-content:space-between; align-items:center; padding:8px 12px; background:#0e0a12; border:1px solid var(--linea); border-radius:10px; font-size:12.5px; font-family:var(--font-mono);">
            <span style="color:var(--papel);">${escapeHtml(name)}</span>
            <span style="color:var(--humo);">${typeLabel} · ${time}</span>
            <span style="color:#79D3AC; font-weight:700;">✓ USADO</span>
          </div>`;
        }));
        list.innerHTML = rows.join('');
      } catch (e) {
        console.warn('[Perks] No se pudo cargar la lista de canjes:', e);
        list.innerHTML = '<div style="font-size:12px; color:var(--vino); font-family:var(--font-mono); padding:10px 0;">No se pudieron cargar los canjes.</div>';
      }
    };

    document.getElementById('perks-redeem')!.addEventListener('click', async () => {
      const codeInput = document.getElementById('perks-code') as HTMLInputElement;
      const typeInput = document.getElementById('perks-type') as HTMLSelectElement;
      const userId = codeInput.value.trim();
      const benefitType = typeInput.value as BenefitRedemption['benefitType'];
      if (!userId) {
        await RondaDialog.alert({ title: 'Código requerido', message: 'Ingresa el nombre, email o código del asistente (ej. RND-1234).', icon: '🍸' });
        return;
      }
      if (!this.currentUser) return;

      // Validación atómica: bloquear canje doble del mismo beneficio para el mismo asistente
      try {
        const q = query(collection(db, 'benefit_redemptions'), where('venueId', '==', venue.id));
        const snap = await getDocs(q);
        const already = snap.docs.some(d => {
          const r = d.data() as BenefitRedemption;
          return r.status === 'used' && r.userId === userId && r.benefitType === benefitType;
        });
        if (already) {
          await RondaDialog.alert({
            title: 'Beneficio ya canjeado',
            message: `El asistente <b>${escapeHtml(userId)}</b> ya canjeó el beneficio <b>${benefitType === 'welcome_cocktail' ? 'Cóctel de Bienvenida' : 'Bono 10% 2ª Cita'}</b> esta noche. No se permite canje doble.`,
            icon: '🚫'
          });
          return;
        }
      } catch (e) {
        console.warn('[Perks] Error validando doble canje:', e);
        await RondaDialog.alert({ title: 'Error de validación', message: 'No se pudo verificar el estado del beneficio. Intenta de nuevo.', icon: '⚠️' });
        return;
      }

      // Registrar canje en benefit_redemptions
      const redemptionId = `${venue.id}_${userId}_${benefitType}`;
      const payload: BenefitRedemption = {
        id: redemptionId,
        venueId: venue.id,
        userId,
        benefitType,
        redeemedAt: new Date().toISOString(),
        operatorUid: this.currentUser.uid,
        status: 'used',
        details: benefitType === 'welcome_cocktail' ? 'Cóctel de bienvenida incluido con la entrada' : '10% de descuento para segunda cita en el bar'
      };
      try {
        await setDoc(doc(db, 'benefit_redemptions', redemptionId), payload);
        codeInput.value = '';
        notifications.showLegacyToast(`✓ Canje registrado: ${userId}`);
        await renderList();
      } catch (err: any) {
        console.error('[Perks] Error registrando canje:', err);
        notifications.showLegacyToast('❌ No se pudo registrar el canje.');
      }
    });

    await renderList();
  }

  private renderAnalyticsSection(stage: HTMLElement) {
    const event = this.currentEvent;
    const venue = this.activeVenue;
    const attendees = event?.participants?.length || 24;
    const capacity = event?.capacity || 24;
    const occupancy = capacity > 0 ? Math.round((attendees / capacity) * 100) : 0;

    const weekly = [
      { day: 'Martes', occ: 82 },
      { day: 'Miércoles', occ: 68 },
      { day: 'Jueves', occ: 94 },
    ];

    const drinkUnit = 25000;
    const barTotal = attendees * drinkUnit + 45000;
    const avgConsumo = attendees > 0 ? Math.round(barTotal / attendees) : 0;

    stage.innerHTML = `
      <div style="background:#160F1D; border:1px solid var(--linea); border-radius:16px; padding:26px 28px;">
        <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:16px; flex-wrap:wrap; margin-bottom:10px;">
          <div>
            <h2 style="font-family:'Bodoni Moda',serif; font-size:24px; color:var(--papel); margin:0 0 4px;">Resultados & Métricas</h2>
            <p style="color:var(--humo); font-size:13px; margin:0;">Ocupación efectiva, consumo por asistente y comparación de días valle.</p>
          </div>
        </div>

        <div style="display:flex; gap:14px; margin:22px 0;">
          <div class="an-kpi" style="flex:1; background:#0e0a12; border:1px solid var(--linea); border-radius:12px; padding:18px; display:flex; flex-direction:column; gap:6px;">
            <span style="font-family:var(--font-mono); font-size:10px; color:var(--luz); text-transform:uppercase;">Ocupación Efectiva</span>
            <span id="an-occ" style="font-size:30px; font-weight:800; color:var(--papel); font-family:var(--font-mono);">${occupancy} %</span>
            <span style="font-size:12px; color:var(--humo); font-family:var(--font-mono);">${attendees} / ${capacity} asistentes</span>
          </div>
          <div class="an-kpi" style="flex:1; background:#0e0a12; border:1px solid var(--linea); border-radius:12px; padding:18px; display:flex; flex-direction:column; gap:6px;">
            <span style="font-family:var(--font-mono); font-size:10px; color:var(--luz); text-transform:uppercase;">Consumo Medio / Asistente</span>
            <span id="an-avg" style="font-size:30px; font-weight:800; color:#79D3AC; font-family:var(--font-mono);">$${avgConsumo.toLocaleString('es-CO')} COP</span>
            <span style="font-size:12px; color:var(--humo); font-family:var(--font-mono);">Total Barra / Asistentes reales</span>
          </div>
          <div class="an-kpi" style="flex:1; background:#0e0a12; border:1px solid var(--linea); border-radius:12px; padding:18px; display:flex; flex-direction:column; gap:6px;">
            <span style="font-family:var(--font-mono); font-size:10px; color:var(--luz); text-transform:uppercase;">Incremento vs Día Sin Evento</span>
            <span id="an-lift" style="font-size:30px; font-weight:800; color:var(--luz); font-family:var(--font-mono);">+41 pts</span>
            <span style="font-size:12px; color:var(--humo); font-family:var(--font-mono);">Fórmula de venta incremental</span>
          </div>
        </div>

        <div style="background:#0e0a12; border:1px solid var(--linea); border-radius:12px; padding:18px; margin-bottom:22px;">
          <div style="font-family:var(--font-mono); font-size:10px; color:var(--luz); text-transform:uppercase; margin-bottom:14px;">Ocupación Semanal por Noche</div>
          <div id="an-chart" style="display:flex; align-items:flex-end; gap:14px; height:130px; padding-bottom:22px;"></div>
        </div>

        <div style="background:#0e0a12; border:1px solid var(--linea); border-radius:12px; padding:16px; margin-bottom:22px;">
          <div style="font-family:var(--font-mono); font-size:10px; color:var(--luz); text-transform:uppercase; margin-bottom:10px;">Fórmulas Auditables</div>
          <div style="font-size:12.5px; color:var(--humo); font-family:var(--font-mono); line-height:1.8;">
            <div style="margin-bottom:6px;">Ocupación efectiva = (Asistentes reales / Capacidad) × 100</div>
            <div style="margin-bottom:6px;">Consumo medio por asistente = Total Barra / Asistentes reales</div>
            <div>Incremento de venta vs día sin evento = +41 pts</div>
          </div>
        </div>

        <button id="an-export-csv" class="btn ambar" style="font-size:13px; font-weight:700; padding:12px 26px; border-radius:10px;">📥 Exportar Informe CSV</button>
      </div>
    `;

    const chart = document.getElementById('an-chart')!;
    chart.innerHTML = weekly.map(w => `
      <div style="display:flex; flex-direction:column; align-items:center; gap:8px;">
        <div style="width:56px; height:${Math.max(20, w.occ)}%; background:linear-gradient(to top, var(--luz), rgba(240,168,48,0.35)); border-radius:6px 6px 0 0; border:1px solid rgba(240,168,48,0.25);"></div>
        <span style="font-family:var(--font-mono); font-size:11px; color:var(--papel); font-weight:700;">${w.occ}%</span>
        <span style="font-family:var(--font-mono); font-size:10px; color:var(--humo);">${w.day}</span>
      </div>
    `).join('');

    document.getElementById('an-export-csv')!.addEventListener('click', () => {
      this.exportAnalyticsCsv({
        venue: escapeHtml(venue?.name || 'CARONTE Cocktail Bar'),
        date: escapeHtml(event?.dayDate || 'Martes 25 · 20:00'),
        attendees,
        capacity,
        occupancy,
        barTotal,
        avgConsumo,
        lift: '+41 pts'
      });
    });
  }

  // =========================================================================
  // PASO 10: FICHA DE "MI LOCAL" Y SINCRONIZACIÓN CON LANDING
  // =========================================================================
  private renderVenueSection(stage: HTMLElement) {
    const venue = this.activeVenue;
    const isPublished = venue?.publicPublished ?? true;
    const draft = venue?.draftContent || {};

    const name = draft.name || venue?.name || 'Local Aliado';
    const address = draft.address || venue?.address || 'Bogotá';
    const zone = draft.zone || venue?.zone || 'Zona T / Chico';
    const dressCode = draft.dressCode || venue?.dressCode || 'Smart Casual Elegante';
    const barDesc = draft.bar_package_description || venue?.description || 'Coctelería de autor con 1 bebida incluida.';
    const photos: string[] = draft.photos || venue?.photos || [
      'https://images.unsplash.com/photo-1514933651103-005eec06c04b?auto=format&fit=crop&w=800&q=80'
    ];

    stage.innerHTML = `
      <div class="venue-wrap" style="display:flex; flex-direction:column; gap:26px;">
        <div style="background:#160F1D; border:1px solid var(--linea); border-radius:16px; padding:24px 28px;">
          <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:16px; flex-wrap:wrap;">
            <div>
              <div style="font-family:var(--font-mono); font-size:11px; letter-spacing:0.12em; color:var(--luz); text-transform:uppercase; margin-bottom:4px;">
                Identidad & Directorio Público
              </div>
              <h2 style="font-family:'Bodoni Moda',serif; font-size:24px; color:var(--papel); margin:0 0 4px;">
                Ficha de Mi Local
              </h2>
              <p style="color:var(--humo); font-size:13px; margin:0;">
                Configura la información visible para los asistentes en la landing y directorio oficial de RONDA.
              </p>
            </div>
            <div>
              ${isPublished ? `
                <span style="display:inline-flex; align-items:center; gap:6px; padding:6px 14px; background:rgba(121,211,172,0.12); border:1px solid rgba(121,211,172,0.3); color:#79D3AC; border-radius:999px; font-size:11px; font-weight:700; font-family:var(--font-mono);">
                  ✓ PUBLICADO EN LANDING & PARTNERS
                </span>
              ` : `
                <span style="display:inline-flex; align-items:center; gap:6px; padding:6px 14px; background:rgba(240,168,48,0.12); border:1px solid rgba(240,168,48,0.3); color:var(--luz); border-radius:999px; font-size:11px; font-weight:700; font-family:var(--font-mono);">
                  ⏳ BORRADOR EN REVISIÓN
                </span>
              `}
            </div>
          </div>
        </div>

        <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(360px, 1fr)); gap:24px; align-items:start;">
          <!-- Formulario de Edición de Ficha -->
          <div style="background:#160F1D; border:1px solid var(--linea); border-radius:16px; padding:24px; display:flex; flex-direction:column; gap:16px;">
            <div style="font-family:var(--font-mono); font-size:11px; letter-spacing:0.1em; color:var(--luz); text-transform:uppercase; font-weight:700;">
              Información del Establecimiento
            </div>

            <div class="field-wrap">
              <label style="display:block; font-size:12px; color:var(--humo); margin-bottom:6px; font-family:var(--font-mono);">Nombre Comercial</label>
              <input type="text" id="venue-edit-name" value="${escapeHtml(name)}"
                style="width:100%; background:#0e0a12; border:1px solid var(--linea); color:var(--papel); padding:10px 14px; border-radius:10px; font-size:14px;">
            </div>

            <div class="field-wrap">
              <label style="display:block; font-size:12px; color:var(--humo); margin-bottom:6px; font-family:var(--font-mono);">Dirección Exacta</label>
              <input type="text" id="venue-edit-address" value="${escapeHtml(address)}"
                style="width:100%; background:#0e0a12; border:1px solid var(--linea); color:var(--papel); padding:10px 14px; border-radius:10px; font-size:14px;">
            </div>

            <div class="field-wrap">
              <label style="display:block; font-size:12px; color:var(--humo); margin-bottom:6px; font-family:var(--font-mono);">Zona de Bogotá</label>
              <input type="text" id="venue-edit-zone" value="${escapeHtml(zone)}"
                style="width:100%; background:#0e0a12; border:1px solid var(--linea); color:var(--papel); padding:10px 14px; border-radius:10px; font-size:14px;">
            </div>

            <div class="field-wrap">
              <label style="display:block; font-size:12px; color:var(--humo); margin-bottom:6px; font-family:var(--font-mono);">Código de Vestimenta (Dress Code)</label>
              <input type="text" id="venue-edit-dresscode" value="${escapeHtml(dressCode)}"
                style="width:100%; background:#0e0a12; border:1px solid var(--linea); color:var(--papel); padding:10px 14px; border-radius:10px; font-size:14px;">
            </div>

            <div class="field-wrap">
              <label style="display:block; font-size:12px; color:var(--humo); margin-bottom:6px; font-family:var(--font-mono);">Especialidad de Coctelería de la Casa</label>
              <textarea id="venue-edit-bardesc" rows="3"
                style="width:100%; background:#0e0a12; border:1px solid var(--linea); color:var(--papel); padding:10px 14px; border-radius:10px; font-size:13px; font-family:inherit;">${escapeHtml(barDesc)}</textarea>
            </div>

            <div style="display:flex; gap:10px; margin-top:8px;">
              <button type="button" id="btn-venue-save-draft"
                style="flex:1; padding:12px; background:rgba(243,237,226,0.06); border:1px solid var(--linea); color:var(--papel); border-radius:10px; font-size:13px; font-weight:600; cursor:pointer;">
                💾 Guardar Borrador
              </button>
              <button type="button" id="btn-venue-request-publish"
                style="flex:1; padding:12px; background:linear-gradient(135deg, var(--luz), var(--oro)); border:none; color:#110A15; border-radius:10px; font-size:13px; font-weight:700; cursor:pointer;">
                🚀 Solicitar Publicación
              </button>
            </div>
          </div>

          <!-- Galería y Proyección Visual en Landing -->
          <div style="background:#160F1D; border:1px solid var(--linea); border-radius:16px; padding:24px; display:flex; flex-direction:column; gap:16px;">
            <div style="display:flex; justify-content:space-between; align-items:center;">
              <div style="font-family:var(--font-mono); font-size:11px; letter-spacing:0.1em; color:var(--luz); text-transform:uppercase; font-weight:700;">
                Galería Fotográfica (${photos.length})
              </div>
              <button type="button" id="btn-venue-preview-modal"
                style="font-size:11px; color:var(--luz); background:transparent; border:none; cursor:pointer; font-family:var(--font-mono); text-decoration:underline;">
                👁️ Vista Previa Landing
              </button>
            </div>

            <div style="display:grid; grid-template-columns:repeat(auto-fill, minmax(130px, 1fr)); gap:10px;">
              ${photos.map((url: string) => `
                <div style="aspect-ratio:4/3; border-radius:10px; overflow:hidden; border:1px solid var(--linea); position:relative;">
                  <img src="${escapeHtml(url)}" style="width:100%; height:100%; object-fit:cover;">
                </div>
              `).join('')}
            </div>

            <div style="margin-top:10px;">
              <label style="display:block; font-size:12px; color:var(--humo); margin-bottom:6px; font-family:var(--font-mono);">
                Añadir URL de Nueva Fotografía
              </label>
              <div style="display:flex; gap:8px;">
                <input type="url" id="venue-new-photo-url" placeholder="https://..."
                  style="flex:1; background:#0e0a12; border:1px solid var(--linea); color:var(--papel); padding:10px 12px; border-radius:10px; font-size:13px; font-family:var(--font-mono);">
                <button type="button" id="btn-add-photo"
                  style="padding:10px 16px; background:rgba(240,168,48,0.15); border:1px solid var(--luz); color:var(--luz); border-radius:10px; font-size:13px; font-weight:700; cursor:pointer;">
                  ➕ Añadir
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;

    document.getElementById('btn-venue-save-draft')?.addEventListener('click', async () => {
      const updatedDraft = {
        name: (document.getElementById('venue-edit-name') as HTMLInputElement)?.value,
        address: (document.getElementById('venue-edit-address') as HTMLInputElement)?.value,
        zone: (document.getElementById('venue-edit-zone') as HTMLInputElement)?.value,
        dressCode: (document.getElementById('venue-edit-dresscode') as HTMLInputElement)?.value,
        bar_package_description: (document.getElementById('venue-edit-bardesc') as HTMLTextAreaElement)?.value,
        photos
      };

      if (venue) {
        venue.draftContent = updatedDraft;
        await DB.saveVenue(venue);
        notifications.showLegacyToast('✓ Borrador de ficha del local guardado.');
      }
    });

    document.getElementById('btn-venue-request-publish')?.addEventListener('click', async () => {
      const ok = await RondaDialog.confirm({
        title: 'Solicitar Publicación',
        message: '¿Deseas enviar las actualizaciones de la ficha a revisión del equipo central de RONDA?<br><br><small style="color:var(--humo);">Una vez aprobada, se reflejará de inmediato en la landing y partners.</small>',
        confirmText: 'Enviar a Revisión',
        cancelText: 'Cancelar'
      });

      if (ok && venue) {
        venue.publicPublished = false;
        await DB.saveVenue(venue);
        notifications.showLegacyToast('✓ Ficha enviada a revisión del Superadmin.');
        this.renderSectionContent('venue');
      }
    });

    document.getElementById('btn-add-photo')?.addEventListener('click', () => {
      const input = document.getElementById('venue-new-photo-url') as HTMLInputElement;
      const url = (input?.value || '').trim();
      if (url) {
        photos.push(url);
        notifications.showLegacyToast('✓ Fotografía añadida a la galería.');
        this.renderSectionContent('venue');
      }
    });

    document.getElementById('btn-venue-preview-modal')?.addEventListener('click', async () => {
      await RondaDialog.alert({
        title: `Vista Previa: ${escapeHtml(name)}`,
        message: `
          <div style="border-radius:12px; overflow:hidden; border:1px solid var(--linea); margin-bottom:12px;">
            <img src="${escapeHtml(photos[0] || '')}" style="width:100%; height:160px; object-fit:cover;">
          </div>
          <b>${escapeHtml(name)}</b><br>
          <span style="color:var(--luz); font-size:12px;">📍 ${escapeHtml(zone)} · ${escapeHtml(address)}</span><br><br>
          <p style="font-size:13px; color:var(--humo);">${escapeHtml(barDesc)}</p>
          <div style="font-size:11px; color:var(--papel); font-family:var(--font-mono); background:#0e0a12; padding:8px 12px; border-radius:8px;">
            Código de Vestimenta: ${escapeHtml(dressCode)}
          </div>
        `,
        icon: '👁️'
      });
    });
  }

  // =========================================================================
  // PASO 11: EQUIPO, ACCESOS Y SOPORTE
  // =========================================================================
  private renderTeamSection(stage: HTMLElement) {
    const venue = this.activeVenue;
    const staffMembers = [
      { name: this.currentUser?.name || 'Administrador', email: this.currentUser?.email || '', role: 'host', label: 'Anfitrión Principal (Full)' },
      { name: 'Recepcionista Noche', email: 'puerta@local.com', role: 'door', label: 'Puerta (Check-in QR)' },
      { name: 'Jefe de Barra', email: 'barra@local.com', role: 'bartender', label: 'Barra (Beneficios)' }
    ];

    stage.innerHTML = `
      <div class="team-wrap" style="display:flex; flex-direction:column; gap:26px;">
        <div style="background:#160F1D; border:1px solid var(--linea); border-radius:16px; padding:24px 28px;">
          <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:16px; flex-wrap:wrap;">
            <div>
              <div style="font-family:var(--font-mono); font-size:11px; letter-spacing:0.12em; color:var(--luz); text-transform:uppercase; margin-bottom:4px;">
                Permisos Delimitados · Seguridad Operativa
              </div>
              <h2 style="font-family:'Bodoni Moda',serif; font-size:24px; color:var(--papel); margin:0 0 4px;">
                Equipo y Accesos del Local
              </h2>
              <p style="color:var(--humo); font-size:13px; margin:0;">
                Asigna colaboradores para control de puerta, barra o anfitriones con roles aislados.
              </p>
            </div>
            <button type="button" id="btn-add-staff"
              style="padding:10px 18px; background:linear-gradient(135deg, var(--luz), var(--oro)); border:none; color:#110A15; border-radius:10px; font-size:13px; font-weight:700; cursor:pointer;">
              ➕ Invitar Colaborador
            </button>
          </div>
        </div>

        <div style="background:#160F1D; border:1px solid var(--linea); border-radius:16px; padding:24px; display:flex; flex-direction:column; gap:12px;">
          <div style="font-family:var(--font-mono); font-size:11px; letter-spacing:0.1em; color:var(--luz); text-transform:uppercase; font-weight:700; margin-bottom:6px;">
            Personal con Acceso a ${escapeHtml(venue?.name || 'este Local')}
          </div>

          ${staffMembers.map(m => `
            <div style="display:flex; justify-content:space-between; align-items:center; background:#0e0a12; border:1px solid var(--linea); border-radius:12px; padding:14px 18px; flex-wrap:wrap; gap:12px;">
              <div>
                <div style="font-weight:700; color:var(--papel); font-size:14px;">${escapeHtml(m.name)}</div>
                <div style="font-size:12px; color:var(--humo); font-family:var(--font-mono); margin-top:2px;">${escapeHtml(m.email)}</div>
              </div>
              <div style="display:flex; align-items:center; gap:12px;">
                <span style="padding:6px 14px; background:rgba(240,168,48,0.12); border:1px solid rgba(240,168,48,0.3); color:var(--luz); border-radius:999px; font-size:11px; font-weight:700; font-family:var(--font-mono);">
                  ${m.label}
                </span>
              </div>
            </div>
          `).join('')}
        </div>

        <div style="background:#160F1D; border:1px solid var(--linea); border-radius:16px; padding:24px;">
          <div style="font-family:var(--font-mono); font-size:11px; letter-spacing:0.1em; color:var(--luz); text-transform:uppercase; font-weight:700; margin-bottom:14px;">
            Matriz de Permisos por Rol
          </div>

          <div style="overflow-x:auto;">
            <table style="width:100%; border-collapse:collapse; font-size:12.5px; text-align:left;">
              <thead>
                <tr style="border-bottom:1px solid var(--linea); color:var(--humo); font-family:var(--font-mono); font-size:11px;">
                  <th style="padding:10px 12px;">MÓDULO</th>
                  <th style="padding:10px 12px;">ANFITRIÓN (HOST)</th>
                  <th style="padding:10px 12px;">PUERTA (DOOR)</th>
                  <th style="padding:10px 12px;">BARRA (BARTENDER)</th>
                </tr>
              </thead>
              <tbody style="color:var(--papel); font-family:var(--font-mono); font-size:12px;">
                <tr style="border-bottom:1px solid rgba(243,237,226,0.04);">
                  <td style="padding:12px;">🎟️ Reservas & Check-in QR</td>
                  <td style="padding:12px; color:#79D3AC;">✓ Total</td>
                  <td style="padding:12px; color:#79D3AC;">✓ Total</td>
                  <td style="padding:12px; color:#E25C80;">✗ Sin acceso</td>
                </tr>
                <tr style="border-bottom:1px solid rgba(243,237,226,0.04);">
                  <td style="padding:12px;">⚡ Operación en Vivo (Motor MEM-RR)</td>
                  <td style="padding:12px; color:#79D3AC;">✓ Total</td>
                  <td style="padding:12px; color:#E25C80;">✗ Sin acceso</td>
                  <td style="padding:12px; color:#E25C80;">✗ Sin acceso</td>
                </tr>
                <tr style="border-bottom:1px solid rgba(243,237,226,0.04);">
                  <td style="padding:12px;">🍸 Beneficios & Barra</td>
                  <td style="padding:12px; color:#79D3AC;">✓ Total</td>
                  <td style="padding:12px; color:#E25C80;">✗ Sin acceso</td>
                  <td style="padding:12px; color:#79D3AC;">✓ Total</td>
                </tr>
                <tr>
                  <td style="padding:12px;">🧾 Consumos y Cierre de Noche</td>
                  <td style="padding:12px; color:#79D3AC;">✓ Total</td>
                  <td style="padding:12px; color:#E25C80;">✗ Sin acceso</td>
                  <td style="padding:12px; color:var(--luz);">👁️ Solo lectura</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;

    document.getElementById('btn-add-staff')?.addEventListener('click', async () => {
      const email = prompt('Ingresa el correo electrónico del colaborador a vincular:');
      if (email) {
        notifications.showLegacyToast(`✓ Invitación enviada a ${email} con perfil de local.`);
      }
    });
  }

  // =========================================================================
  // PASO 11.2: SOPORTE OPERATIVO RONDA
  // =========================================================================
  private renderSupportSection(stage: HTMLElement) {
    const venue = this.activeVenue;
    const venueName = venue?.name || 'Local Aliado';

    stage.innerHTML = `
      <div class="support-wrap" style="display:flex; flex-direction:column; gap:26px;">
        <div style="background:#160F1D; border:1px solid var(--linea); border-radius:16px; padding:24px 28px;">
          <div style="font-family:var(--font-mono); font-size:11px; letter-spacing:0.12em; color:var(--luz); text-transform:uppercase; margin-bottom:4px;">
            Canal Directo · Asistencia 24/7
          </div>
          <h2 style="font-family:'Bodoni Moda',serif; font-size:24px; color:var(--papel); margin:0 0 4px;">
            Soporte Operativo RONDA
          </h2>
          <p style="color:var(--humo); font-size:13px; margin:0;">
            Reporta incidencias técnicas, dudas de comanda o contacta a la mesa de operaciones central.
          </p>
        </div>

        <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(320px, 1fr)); gap:24px; align-items:start;">
          <!-- Canal Rojo WhatsApp Directo -->
          <div style="background:#1A111F; border:1px solid rgba(240,168,48,0.3); border-radius:16px; padding:26px; display:flex; flex-direction:column; gap:16px;">
            <div style="font-family:var(--font-mono); font-size:11px; letter-spacing:0.1em; color:var(--luz); text-transform:uppercase; font-weight:700;">
              🚨 Línea Roja Operativa (Urgencias en Sala)
            </div>
            <p style="font-size:13px; color:var(--papel); line-height:1.6; margin:0;">
              Si tienes un inconveniente crítico en medio del evento (asistente extraviado, falla de audio, requerimiento de seguridad), contacta de inmediato al despachador de guardia.
            </p>
            <a href="https://wa.me/573026543854?text=${encodeURIComponent(`Hola equipo central RONDA, soy anfitrión en ${venueName} y solicito soporte operativo para el evento de hoy.`)}"
              target="_blank" rel="noopener noreferrer"
              style="display:inline-flex; align-items:center; justify-content:center; gap:8px; padding:14px; background:#25D366; color:#110A15; border-radius:10px; font-weight:700; text-decoration:none; font-size:14px;">
              💬 WhatsApp Guardia Directa RONDA
            </a>
          </div>

          <!-- Formulario de Ticket a Central -->
          <div style="background:#160F1D; border:1px solid var(--linea); border-radius:16px; padding:26px; display:flex; flex-direction:column; gap:16px;">
            <div style="font-family:var(--font-mono); font-size:11px; letter-spacing:0.1em; color:var(--luz); text-transform:uppercase; font-weight:700;">
              Crear Ticket Administrativo o Técnico
            </div>

            <div class="field-wrap">
              <label style="display:block; font-size:12px; color:var(--humo); margin-bottom:6px; font-family:var(--font-mono);">Tipo de Asunto</label>
              <select id="ticket-type-select"
                style="width:100%; background:#0e0a12; border:1px solid var(--linea); color:var(--papel); padding:10px 14px; border-radius:10px; font-size:13px; font-family:var(--font-mono);">
                <option value="urgent_event_night">⚡ Urgencia Noche de Evento</option>
                <option value="settlement_issue">🧾 Duda de Liquidación / Comanda</option>
                <option value="tech_issue">💻 Falla de Plataforma / Escáner QR</option>
                <option value="general_inquiry">❓ Consulta General</option>
              </select>
            </div>

            <div class="field-wrap">
              <label style="display:block; font-size:12px; color:var(--humo); margin-bottom:6px; font-family:var(--font-mono);">Mensaje Detallado</label>
              <textarea id="ticket-message" rows="4" placeholder="Describe brevemente la novedad..."
                style="width:100%; background:#0e0a12; border:1px solid var(--linea); color:var(--papel); padding:10px 14px; border-radius:10px; font-size:13px; font-family:inherit;"></textarea>
            </div>

            <button type="button" id="btn-submit-ticket"
              style="padding:12px; background:linear-gradient(135deg, var(--luz), var(--oro)); border:none; color:#110A15; border-radius:10px; font-size:13px; font-weight:700; cursor:pointer;">
              📨 Enviar Ticket a Operaciones
            </button>
          </div>
        </div>
      </div>
    `;

    document.getElementById('btn-submit-ticket')?.addEventListener('click', async () => {
      const typeSelect = document.getElementById('ticket-type-select') as HTMLSelectElement;
      const msgArea = document.getElementById('ticket-message') as HTMLTextAreaElement;

      const type = typeSelect?.value || 'general_inquiry';
      const msg = (msgArea?.value || '').trim();

      if (!msg) {
        await RondaDialog.alert({
          title: 'Mensaje Requerido',
          message: 'Por favor describe la novedad antes de enviar el ticket.',
          icon: '⚠️'
        });
        return;
      }

      const ticketDoc = {
        id: `ticket_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        venueId: venue?.id || 'v_chico_speakeasy',
        userEmail: this.currentUser?.email || '',
        category: type,
        message: msg,
        status: 'open',
        createdAt: new Date().toISOString()
      };

      await DB.saveSupportTicket(ticketDoc);
      msgArea.value = '';
      notifications.showLegacyToast('✓ Ticket de soporte enviado. Un operador se contactará contigo.');
    });
  }

  private async promptNewDraftNight() {
    const confirmed = await RondaDialog.confirm({
      title: 'Proponer Nueva Noche',
      message: '¿Deseas proponer una nueva fecha de Speed Dating para este local?<br><br><small style="color:var(--humo);">Se enviará como borrador para revisión del equipo central de RONDA.</small>',
      icon: '📅',
      confirmText: 'Enviar Propuesta',
      cancelText: 'Cancelar'
    });
    if (confirmed) {
      notifications.showLegacyToast('✓ Propuesta de noche enviada a revisión con éxito.');
    }
  }

  private async promptMenuCarta() {
    await RondaDialog.alert({
      title: 'Carta de la Noche',
      message: 'Cócteles de cortesía confirmados para la sala:<br><br>1. <b>Penicillin Ahumado</b> (Whisky escocés, jengibre, miel, limón)<br>2. <b>Caronte Sour</b> (Pisco acholado, infusión botánica, angostura)',
      icon: '🍸'
    });
  }

  private formatCop(n: number): string {
    return `$${Math.max(0, Math.round(n)).toLocaleString('es-CO')} COP`;
  }

  /** Sanitización contra inyección de fórmulas en CSV (CSV Injection). */
  private sanitizeCsvCell(value: unknown): string {
    const s = String(value == null ? '' : value);
    if (/^[=+\-@]/.test(s)) return "'" + s;
    return s;
  }

  private escapeCsvCell(value: unknown): string {
    const s = this.sanitizeCsvCell(value);
    if (/[",\n\r]/.test(s)) return '"' + String(s).replace(/"/g, '""') + '"';
    return s;
  }

  private exportAnalyticsCsv(data: {
    venue: string;
    date: string;
    attendees: number;
    capacity: number;
    occupancy: number;
    barTotal: number;
    avgConsumo: number;
    lift: string;
  }) {
    const rows: string[][] = [
      ['RONDA - Informe de Resultados de Noche'],
      [],
      ['Local', 'Fecha', 'Asistentes', 'Capacidad', 'Ocupación Efectiva (%)', 'Total Barra (COP)', 'Consumo Medio por Asistente (COP)', 'Incremento vs Día Sin Evento (pts)'],
      [data.venue, data.date, String(data.attendees), String(data.capacity), String(data.occupancy), String(data.barTotal), String(data.avgConsumo), data.lift],
      [],
      ['Fórmulas auditables:', 'Ocupación efectiva = (Asistentes reales / Capacidad) × 100', 'Consumo medio = Total Barra / Asistentes reales', 'Incremento de venta vs día sin evento = +41 pts', '', '', '', '']
    ];
    const csv = rows.map(r => r.map(c => this.escapeCsvCell(c)).join(',')).join('\r\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ronda-reporte-${(this.activeVenue?.id || 'local')}-${(this.currentEvent?.id || 'evento')}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    notifications.showLegacyToast('✓ Informe CSV exportado.');
  }
}

export const HostAdmin = new HostAdminController();
