import { DB, User, Reservation } from './db.js';
import { Auth } from './auth.js';
import { OfflineSync } from './offline-sync.js';
import { downloadICSFile, generateCalendarEventUrl } from './utils.js';
import { RondaDialog } from './dialog.js';

// client.ts: Lógica del Cliente, Eventos, Mapas, Cócteles, Anfitrión, Bloqueo de Salas y Revelación de Matches 10 AM

export interface RondaEvent {
  id: string;
  venueName: string;
  venueAddress: string;
  mapsUrl: string;
  dayDate: string;
  startIso: string;
  endIso: string;
  timeRange: string;
  roundsInfo: string;
  ageRange: string;
  cocktailIncluded: string;
  cocktailDesc: string;
  cocktailImg: string;
  hostTips: string[];
  price: number;
  priceFormatted: string;
  priceSub: string;
  status: 'escaso' | 'ok' | 'lleno';
  statusLabel: string;
  chipClass: string;
  balanceTag: string;
  balancePercent1: number;
  balancePercent2: number;
  registeredText: string;
  neededText: string;
  tableNumber: string;
  bookingCode: string;
}

export const RONDA_EVENTS: RondaEvent[] = [
  {
    id: 'rnd-caronte-mar-25',
    venueName: 'CARONTE Cocktail Bar',
    venueAddress: 'Cra. 4A #66-22 · Zona G, Bogotá',
    mapsUrl: 'https://www.google.com/maps/search/?api=1&query=Cra+4A+66-22+Zona+G+Bogota',
    dayDate: 'Martes 25 de marzo · 20:00',
    startIso: '2026-03-25T20:00:00-05:00',
    endIso: '2026-03-25T21:45:00-05:00',
    timeRange: '20:00 a 21:45',
    roundsInfo: '9 rondas de 6 min · 1 campanada',
    ageRange: '25–34 años',
    cocktailIncluded: 'Negroni Ahumado de Autor',
    cocktailDesc: 'Campari infusionado en madera de roble ahumado, Vermut Rosso artesanal y Gin botánico con piel de naranja caramelizada al fuego. Opción mocktail disponible.',
    cocktailImg: '/assets/coctel-negroni.svg',
    hostTips: [
      '👔 Dress Code: Smart Casual elegante (no ropa deportiva).',
      '⏰ Puntualidad: Llega a las 19:50 para recibir tu cóctel en barra antes de la 1ª campanada.',
      '🔔 Dinámica: 6 minutos por mesa. Al sonar la campana, el Lado B rota en sentido horario.',
      '🛡️ Seguridad: Si requieres asistencia discreta, usa tu palabra clave con el bartender o anfitrión.'
    ],
    price: 45000,
    priceFormatted: '$45.000',
    priceSub: 'Sube a $55.000 al equilibrarse',
    status: 'escaso',
    statusLabel: 'Por confirmar',
    chipClass: 'ambar',
    balanceTag: 'Tu lado por confirmar',
    balancePercent1: 62,
    balancePercent2: 38,
    registeredText: '12 apuntadas',
    neededText: 'faltan 3 · Lado B',
    tableNumber: '07',
    bookingCode: '#RND-4471'
  },
  {
    id: 'rnd-lamaria-mie-26',
    venueName: 'La María Quinta Camacho',
    venueAddress: 'Calle 70A #9-44 · Quinta Camacho, Bogotá',
    mapsUrl: 'https://www.google.com/maps/search/?api=1&query=Calle+70A+9-44+Quinta+Camacho+Bogota',
    dayDate: 'Miércoles 26 de marzo · 20:00',
    startIso: '2026-03-26T20:00:00-05:00',
    endIso: '2026-03-26T21:45:00-05:00',
    timeRange: '20:00 a 21:45',
    roundsInfo: '9 rondas de 6 min · Noche de tapas y vino',
    ageRange: '35–49 años',
    cocktailIncluded: 'Tinto de Verano Especiado',
    cocktailDesc: 'Reducción de vino tinto reserva con frutos rojos silvestres, soda cítrica, canela en rama y rodaja de pomelo rosado.',
    cocktailImg: '/assets/coctel-vino.svg',
    hostTips: [
      '👔 Dress Code: Casual sofisticado.',
      '⏰ Llegada: Barra abierta desde las 19:45.',
      '🍷 Maridaje: Incluye degustación de tapas de la casa.',
      '🎫 Beneficio: -25% de descuento en carta para citas posteriores.'
    ],
    price: 55000,
    priceFormatted: '$55.000',
    priceSub: 'Incluye 1er Cóctel de Autor',
    status: 'ok',
    statusLabel: 'Confirmado',
    chipClass: 'verde',
    balanceTag: 'Sala equilibrada',
    balancePercent1: 50,
    balancePercent2: 50,
    registeredText: '12 apuntadas',
    neededText: '12 confirmados (100%)',
    tableNumber: '04',
    bookingCode: '#RND-8923'
  },
  {
    id: 'rnd-patio-jue-27',
    venueName: 'Patio Poca Prisa',
    venueAddress: 'Cra. 5 #69-26 · Chapinero Alto, Bogotá',
    mapsUrl: 'https://www.google.com/maps/search/?api=1&query=Cra+5+69-26+Chapinero+Alto+Bogota',
    dayDate: 'Jueves 27 de marzo · 20:30',
    startIso: '2026-03-27T20:30:00-05:00',
    endIso: '2026-03-27T22:15:00-05:00',
    timeRange: '20:30 a 22:15',
    roundsInfo: '9 rondas de 6 min · Temática: Cine & Arte',
    ageRange: '28–38 años',
    cocktailIncluded: 'Gin Tonic Botánico',
    cocktailDesc: 'Gin artesanal colombiano con bayas de enebro, listón de pepino macerado, agua tónica premium y flor de saúco.',
    cocktailImg: '/assets/coctel-gintonic.svg',
    hostTips: [
      '👔 Dress Code: Bohemia urbana / Creativo.',
      '🎨 Temática: Noche con preguntas rompehielos de cine y cultura.',
      '⏳ Lista de Espera: Si alguien cancela o se abre mesa impar, se notifica por orden de turno.'
    ],
    price: 65000,
    priceFormatted: '$65.000',
    priceSub: 'Jueves, tarifa alta',
    status: 'lleno',
    statusLabel: 'Lista de espera',
    chipClass: 'gris',
    balanceTag: 'Últimos cupos en rotación',
    balancePercent1: 90,
    balancePercent2: 10,
    registeredText: '18 apuntados',
    neededText: 'Lista de espera abierta',
    tableNumber: '02',
    bookingCode: '#RND-9104'
  }
];

class ClientAppService {
  currentEvent: any = null;
  selectedEvent: RondaEvent | null = null;
  unsubscribe: any = null;
  timerInterval: any = null;
  countdownInterval: any = null;

  constructor() {
    // Escuchar el login para montar la vista
    addEventListener('auth:login', (e: any) => {
      if (e.detail.role === 'client') {
        this.initClientDashboard(e.detail);
      }
    });
    
    addEventListener('auth:logout', () => {
      if (this.unsubscribe) this.unsubscribe();
      this.stopTimer();
      this.stopCountdown();
      this.selectedEvent = null;
    });

    this.setupModalListeners();
  }

  setupModalListeners() {
    // Cerrar modal de detalle de evento
    document.getElementById('btn-event-detail-close')?.addEventListener('click', () => {
      this.closeEventModal();
    });

    // Cerrar modal de gestión de reservas
    document.getElementById('btn-manage-reservations-close')?.addEventListener('click', () => {
      this.closeManageReservationsModal();
    });

    // Confirmar reserva desde el modal
    document.getElementById('btn-confirm-event-booking')?.addEventListener('click', async () => {
      await this.confirmBooking();
    });

    // Volver a la cartelera desde la reserva del cliente
    document.getElementById('btn-client-back-feed')?.addEventListener('click', () => {
      window.dispatchEvent(new CustomEvent('view:switch', { detail: 'view-lobby' }));
    });
  }

  openManageReservationsModal() {
    this.renderManageReservationsModal();
    const modal = document.getElementById('modal-manage-reservations');
    if (modal) modal.classList.add('active');
  }

  closeManageReservationsModal() {
    const modal = document.getElementById('modal-manage-reservations');
    if (modal) modal.classList.remove('active');
  }

  renderManageReservationsModal() {
    const container = document.getElementById('manage-reservations-content');
    if (!container) return;

    const user = Auth.currentUser;
    if (!user) {
      container.innerHTML = `<p style="text-align: center; color: var(--humo); font-size: 13px;">Inicia sesión para ver tus reservas.</p>`;
      return;
    }

    const res = user.activeReservation;
    const waitlist = user.activeWaitlist;

    let html = '';

    if (res) {
      html += `
        <div style="margin-bottom: 20px;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
            <p style="font-size: 11px; font-family: var(--font-mono); color: var(--luz); text-transform: uppercase; font-weight: 700; margin: 0; letter-spacing: 0.08em;">
              🎟️ RESERVA PRÓXIMA ACTIVA
            </p>
            <span class="chip ${res.status === 'checked_in' ? 'verde' : 'ambar'}" style="font-size: 9.5px; padding: 2px 8px;">
              ${res.status === 'checked_in' ? 'En Barra' : 'Confirmada'}
            </span>
          </div>

          <div style="background: rgba(243,237,226,.05); border: 1px solid var(--linea); border-radius: 16px; padding: 16px; margin-bottom: 14px;">
            <h4 style="font-family: var(--font-display); font-size: 20px; color: var(--papel); margin: 0 0 4px;">${res.venueName}</h4>
            <p style="font-family: var(--font-mono); font-size: 11px; color: var(--luz); margin: 0 0 8px;">${res.dayDate}</p>
            <p style="font-size: 11.5px; color: var(--humo); margin: 0 0 12px;">📍 ${res.venueAddress}</p>
            
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; font-size: 11.5px; margin-bottom: 14px; background: rgba(0,0,0,0.25); padding: 10px 12px; border-radius: 10px;">
              <div><span style="color: var(--humo);">Mesa:</span> <b style="color: var(--papel);">${res.tableNumber}</b></div>
              <div><span style="color: var(--humo);">Código:</span> <b style="color: var(--luz);">${res.bookingCode}</b></div>
            </div>

            <!-- Acciones de Gestión -->
            <div style="display: flex; flex-direction: column; gap: 8px;">
              <button id="btn-mgr-view-ticket" class="btn ambar" style="font-size: 12px; font-weight: 700; padding: 10px; display: flex; align-items: center; justify-content: center; gap: 6px;">
                🎟️ Ver Pasaporte QR / Ticket
              </button>
              
              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
                <a href="${res.mapsUrl || '#'}" target="_blank" class="btn" style="text-decoration: none; text-align: center; font-size: 11px; padding: 9px; background: rgba(243,237,226,.06); border-color: var(--linea);">
                  📍 Maps / Waze
                </a>
                <button id="btn-mgr-calendar" class="btn" style="font-size: 11px; padding: 9px; background: rgba(243,237,226,.06); border-color: var(--linea);">
                  📅 Calendario
                </button>
              </div>

              <!-- Cambiar Sala / Fecha -->
              <div id="box-change-venue" style="margin-top: 6px; border-top: 1px dashed var(--linea); padding-top: 10px;">
                <label style="font-size: 11px; color: var(--humo); font-family: var(--font-mono); display: block; margin-bottom: 6px;">🔄 Cambiar de Sala o Fecha (Sin costo):</label>
                <div style="display: flex; gap: 8px;">
                  <select id="select-change-event" class="ronda-input-premium" style="margin-bottom: 0; font-size: 11.5px; padding: 8px 10px; flex: 1;">
                    ${RONDA_EVENTS.filter(e => e.id !== res.eventId && e.status !== 'lleno').map(e => `
                      <option value="${e.id}">${e.venueName} (${e.dayDate.split('·')[0].trim()})</option>
                    `).join('')}
                  </select>
                  <button id="btn-submit-change-event" class="btn" style="font-size: 11px; padding: 8px 12px; font-weight: 700; border-color: var(--luz); color: var(--luz); white-space: nowrap;">
                    Cambiar
                  </button>
                </div>
              </div>

              <!-- Cancelar Reserva -->
              <button id="btn-mgr-cancel-res" class="btn" style="font-size: 11px; color: #f08ca8; background: rgba(155,39,72,.12); border-color: var(--vino); padding: 9px; margin-top: 4px; font-weight: 600;">
                ❌ Cancelar Reserva (Sin Strike)
              </button>
            </div>
          </div>
        </div>
      `;
    } else if (waitlist) {
      html += `
        <div style="background: rgba(240,168,48,.08); border: 1px dashed rgba(240,168,48,.35); border-radius: 16px; padding: 16px; margin-bottom: 16px; text-align: center;">
          <div style="font-size: 32px; margin-bottom: 6px;">⏳</div>
          <h4 style="font-family: var(--font-display); font-size: 18px; margin: 0 0 4px; color: var(--papel);">${waitlist.venueName}</h4>
          <span class="chip ambar" style="font-size: 10px; margin-bottom: 10px;">Turno #${waitlist.position} en Lista de Espera</span>
          <p style="font-size: 12px; color: var(--humo); line-height: 1.4; margin: 8px 0 14px;">Te notificaremos en cuanto se abra una mesa en la sala.</p>
          <button id="btn-mgr-leave-wl" class="btn" style="font-size: 11px; color: var(--humo); border-color: var(--linea); padding: 8px 14px;">
            Salir de la Lista
          </button>
        </div>
      `;
    } else {
      html += `
        <div style="text-align: center; padding: 30px 16px; background: rgba(243,237,226,.04); border-radius: 16px; border: 1px solid var(--linea); margin-bottom: 16px;">
          <div style="font-size: 36px; margin-bottom: 8px;">🎟️</div>
          <h4 style="font-family: var(--font-display); font-size: 20px; margin: 0 0 6px; color: var(--papel);">No tienes reservas activas</h4>
          <p style="font-size: 12px; color: var(--humo); margin: 0 0 18px; line-height: 1.45;">
            Explora las noches de speed dating programadas de esta semana en Bogotá.
          </p>
          <button id="btn-mgr-go-discovery" class="btn ambar" style="font-size: 12px; font-weight: 700; padding: 12px 20px;">
            Explorar Cartelera de Eventos
          </button>
        </div>
      `;
    }

    // Historial de Citas Pasadas
    html += `
      <div style="border-top: 1px solid var(--linea); padding-top: 14px; margin-top: 14px;">
        <p style="font-size: 11px; font-family: var(--font-mono); color: var(--humo); text-transform: uppercase; font-weight: 700; margin: 0 0 10px; letter-spacing: 0.08em;">
          🏛️ HISTORIAL DE CITAS PASADAS
        </p>
        <div style="background: rgba(243,237,226,.03); border: 1px solid var(--linea); border-radius: 12px; padding: 12px; display: flex; justify-content: space-between; align-items: center;">
          <div>
            <b style="font-size: 12px; color: var(--papel); display: block;">La María Quinta Camacho</b>
            <span style="font-size: 10.5px; color: var(--humo);">12 de marzo · 9 rondas · 3 matches ✨</span>
          </div>
          <span class="chip verde" style="font-size: 9px; padding: 2px 6px;">Completada</span>
        </div>
      </div>
    `;

    container.innerHTML = html;

    // Vincular Eventos dentro del Modal de Gestión
    document.getElementById('btn-mgr-view-ticket')?.addEventListener('click', () => {
      this.closeManageReservationsModal();
      window.dispatchEvent(new CustomEvent('view:switch', { detail: 'view-client' }));
      this.renderClientView();
    });

    document.getElementById('btn-mgr-calendar')?.addEventListener('click', () => {
      if (!res) return;
      const start = new Date(Date.now() + 86400000);
      const end = new Date(start.getTime() + 105 * 60000);
      downloadICSFile(
        `Cita RONDA en ${res.venueName}`,
        `Tu reserva confirmada (${res.bookingCode}). Mesa de salida: ${res.tableNumber}. Cóctel: ${res.cocktailName}.`,
        res.venueAddress,
        start,
        end
      );
      this.showToast('📅 Archivo de calendario descargado');
    });

    document.getElementById('btn-submit-change-event')?.addEventListener('click', async () => {
      const select = document.getElementById('select-change-event') as HTMLSelectElement;
      if (!select || !select.value) return;
      const newEvt = RONDA_EVENTS.find(e => e.id === select.value);
      if (!newEvt) return;

      const confirmed = await RondaDialog.confirm({
        title: 'Cambiar de Sala o Fecha',
        message: `¿Deseas transferir tu reserva a ${newEvt.venueName} (${newEvt.dayDate}) sin ningún costo adicional?`,
        icon: '🔄',
        confirmText: '✓ Transferir Reserva',
        cancelText: '✕ Mantener Actual'
      });

      if (confirmed) {
        user.activeEventId = newEvt.id;
        user.activeReservation = {
          eventId: newEvt.id,
          venueName: newEvt.venueName,
          venueAddress: newEvt.venueAddress,
          mapsUrl: newEvt.mapsUrl,
          dayDate: newEvt.dayDate,
          tableNumber: newEvt.tableNumber,
          cocktailName: newEvt.cocktailIncluded,
          cocktailDesc: newEvt.cocktailDesc,
          cocktailImg: newEvt.cocktailImg,
          bookingCode: newEvt.bookingCode,
          priceFormatted: newEvt.priceFormatted,
          hostTips: newEvt.hostTips,
          status: 'confirmed'
        };
        await DB.saveUser(user);
        this.showToast(`¡Reserva cambiada con éxito a ${newEvt.venueName}!`);
        this.renderManageReservationsModal();
        this.renderDiscoveryFeed();
      }
    });

    document.getElementById('btn-mgr-cancel-res')?.addEventListener('click', async () => {
      const confirmed = await RondaDialog.confirm({
        title: 'Cancelar Reserva',
        message: '¿Estás seguro de cancelar tu reserva? Tu cupo se liberará para la lista de espera y tu crédito quedará guardado 100% para tu siguiente cita sin ningún strike.',
        icon: '⚠️',
        type: 'danger',
        confirmText: '✓ Cancelar Reserva',
        cancelText: '✕ No Cancelar'
      });

      if (confirmed) {
        delete user.activeReservation;
        delete user.activeEventId;
        await DB.saveUser(user);
        this.showToast('Reserva cancelada. Crédito disponible para tu siguiente cita.');
        this.renderManageReservationsModal();
        this.renderDiscoveryFeed();
      }
    });

    document.getElementById('btn-mgr-leave-wl')?.addEventListener('click', async () => {
      delete user.activeWaitlist;
      await DB.saveUser(user);
      this.showToast('Has salido de la lista de espera.');
      this.renderManageReservationsModal();
      this.renderDiscoveryFeed();
    });

    document.getElementById('btn-mgr-go-discovery')?.addEventListener('click', () => {
      this.closeManageReservationsModal();
      window.dispatchEvent(new CustomEvent('view:switch', { detail: 'view-lobby' }));
    });
  }

  async initClientDashboard(user: any) {
    console.log("Iniciando Dashboard Cliente...", user);
    
    // Si el usuario tiene estado de post-evento (revelación de correspondencia) o reserva activa
    if (user.postEventState || user.activeReservation || user.activeEventId) {
      this.renderClientView();
      return;
    }

    // Si el usuario está en lista de espera
    if (user.activeWaitlist) {
      this.renderWaitlistView(user.activeWaitlist);
      return;
    }

    // Si no tiene reserva, renderizar la cartelera
    this.renderDiscoveryFeed();
  }

  renderDiscoveryFeed() {
    const feed = document.getElementById('discovery-feed');
    if (!feed) return;

    let html = '';
    const user = Auth.currentUser;
    const hasActiveBooking = Boolean(user?.activeReservation);

    if (hasActiveBooking) {
      const r = user!.activeReservation!;
      html += `
        <div style="background: rgba(240,168,48,0.1); border: 1px solid rgba(240,168,48,0.35); border-radius: 16px; padding: 14px 16px; margin-bottom: 16px; display: flex; justify-content: space-between; align-items: center; gap: 10px;">
          <div>
            <span style="font-size: 10.5px; font-family: var(--font-mono); color: var(--luz); font-weight: 700; text-transform: uppercase; display: block;">🎟️ RESERVA CONFIRMADA</span>
            <b style="font-family: var(--font-display); font-size: 16px; color: var(--papel); display: block; margin: 2px 0;">${r.venueName}</b>
            <span style="font-size: 11px; color: var(--humo); font-family: var(--font-mono);">${r.dayDate.split('·')[0].trim()} · Mesa ${r.tableNumber}</span>
          </div>
          <button id="btn-feed-manage-res" class="btn ambar" style="font-size: 11.5px; padding: 8px 14px; font-weight: 700; white-space: nowrap; border-radius: 999px;">
            Gestionar
          </button>
        </div>
      `;
    }

    RONDA_EVENTS.forEach((evt) => {
      const isThisBooked = user?.activeReservation?.eventId === evt.id;
      const isLocked = hasActiveBooking && !isThisBooked;

      const balanceHtml = evt.status !== 'lleno' ? `
        <div class="barra-balance">
          <i style="width:${evt.balancePercent1}%;background:${evt.status === 'ok' ? 'var(--botella)' : 'var(--luz)'}"></i>
          <i style="width:${evt.balancePercent2}%;background:rgba(243,237,226,.22)"></i>
        </div>
        <div class="leyenda">
          <span>${evt.registeredText}</span>
          <span>${evt.neededText}</span>
        </div>
      ` : `
        <div style="background: rgba(243,237,226,.05); border-radius: 8px; padding: 6px 10px; margin-top: 8px; font-size: 11px; color: var(--humo); font-family: var(--font-mono); display: flex; justify-content: space-between;">
          <span>⏳ Lista de espera activa</span>
          <span style="color: var(--luz);">Prioridad de acceso</span>
        </div>
      `;

      const statusBadge = isLocked 
        ? `<span class="chip gris" style="background: rgba(243,237,226,.08); color: var(--humo);">🔒 Bloqueado</span>`
        : `<span class="chip ${evt.chipClass}">${isThisBooked ? '✓ Tu Reserva' : evt.statusLabel}</span>`;

      html += `
        <article class="noche-card ${evt.status} ${isLocked ? 'bloqueada' : ''}" data-event-id="${evt.id}" data-locked="${isLocked}" style="cursor: ${isLocked ? 'not-allowed' : 'pointer'};">
          <div class="dia">${evt.dayDate}</div>
          <div class="local">${evt.venueName}</div>
          <div class="detalle">${evt.roundsInfo} · ${evt.ageRange}</div>
          ${balanceHtml}
          <div class="linea-precio">
            <div class="precio">
              ${evt.priceFormatted}
              <small>${evt.priceSub}</small>
            </div>
            ${statusBadge}
          </div>
        </article>
      `;
    });

    feed.innerHTML = html;

    // Vincular botón de gestión en el feed
    document.getElementById('btn-feed-manage-res')?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.openManageReservationsModal();
    });

    // Vincular click en cada tarjeta de evento
    feed.querySelectorAll('.noche-card').forEach((card) => {
      card.addEventListener('click', (e) => {
        const isLocked = (e.currentTarget as HTMLElement).getAttribute('data-locked') === 'true';
        const target = (e.currentTarget as HTMLElement).getAttribute('data-event-id');
        
        if (isLocked) {
          this.showToast(`🔒 Ya tienes 1 reserva activa en ${user?.activeReservation?.venueName}. Gestiona tu reserva si deseas cambiar de fecha.`);
          return;
        }

        if (target) {
          this.openEventModal(target);
        }
      });
    });
  }

  openEventModal(eventId: string) {
    const event = RONDA_EVENTS.find(e => e.id === eventId);
    if (!event) return;

    this.selectedEvent = event;
    const modal = document.getElementById('modal-event-detail');
    if (!modal) return;

    // Poblar campos del modal
    const elDate = document.getElementById('modal-event-date');
    const elVenue = document.getElementById('modal-event-venue');
    const elAddress = document.getElementById('modal-event-address');
    const elMapsLink = document.getElementById('modal-event-maps-link') as HTMLAnchorElement;
    const elRounds = document.getElementById('modal-event-rounds');
    const elAge = document.getElementById('modal-event-age');
    const elTime = document.getElementById('modal-event-time');
    const elBadge = document.getElementById('modal-event-status-badge');
    const elBalanceTag = document.getElementById('modal-event-balance-tag');
    const elBarFill = document.getElementById('modal-event-bar-fill');
    const elBarEmpty = document.getElementById('modal-event-bar-empty');
    const elReg = document.getElementById('modal-event-registered');
    const elNeed = document.getElementById('modal-event-needed');
    
    // Cocktail
    const elCocktail = document.getElementById('modal-event-cocktail');
    const elCocktailDesc = document.getElementById('modal-event-cocktail-desc');
    const elCocktailImg = document.getElementById('modal-event-cocktail-img') as HTMLImageElement;
    
    // Host Tips
    const elHostTips = document.getElementById('modal-event-host-tips');

    // Price & Action Button
    const elPrice = document.getElementById('modal-event-price');
    const elPriceSub = document.getElementById('modal-event-price-sub');
    const btnBook = document.getElementById('btn-confirm-event-booking') as HTMLButtonElement;

    if (elDate) elDate.textContent = event.dayDate;
    if (elVenue) elVenue.textContent = event.venueName;
    if (elAddress) elAddress.textContent = `📍 ${event.venueAddress}`;
    if (elMapsLink) {
      elMapsLink.href = event.mapsUrl;
      elMapsLink.target = '_blank';
    }
    if (elRounds) elRounds.textContent = event.roundsInfo;
    if (elAge) elAge.textContent = event.ageRange;
    if (elTime) elTime.textContent = event.timeRange;

    if (elBadge) {
      elBadge.textContent = event.statusLabel;
      elBadge.className = `chip ${event.chipClass}`;
    }

    if (elBalanceTag) elBalanceTag.textContent = event.balanceTag;
    if (elBarFill) {
      elBarFill.style.width = `${event.balancePercent1}%`;
      elBarFill.style.background = event.status === 'ok' ? 'var(--botella)' : 'var(--luz)';
    }
    if (elBarEmpty) elBarEmpty.style.width = `${event.balancePercent2}%`;
    if (elReg) elReg.textContent = event.registeredText;
    if (elNeed) elNeed.textContent = event.neededText;
    
    if (elCocktail) elCocktail.textContent = event.cocktailIncluded;
    if (elCocktailDesc) elCocktailDesc.textContent = event.cocktailDesc;
    if (elCocktailImg) {
      elCocktailImg.src = event.cocktailImg;
      elCocktailImg.alt = event.cocktailIncluded;
    }

    // Render Host Tips
    if (elHostTips) {
      elHostTips.innerHTML = event.hostTips.map(tip => `
        <li style="margin-bottom: 6px; color: var(--humo); font-size: 11.5px; line-height: 1.4;">${tip}</li>
      `).join('');
    }

    if (elPrice) {
      elPrice.innerHTML = `${event.priceFormatted} <small style="display: inline; font-size: 11px; color: var(--humo);">COP</small>`;
    }
    if (elPriceSub) elPriceSub.textContent = event.priceSub;

    if (btnBook) {
      if (event.status === 'lleno') {
        btnBook.innerHTML = `⏳ Unirme a Lista de Espera (Prioridad)`;
        btnBook.className = 'btn ambar';
      } else {
        btnBook.innerHTML = `🎟️ Reservar Cóctel de Autor (${event.priceFormatted} COP)`;
        btnBook.className = 'btn ambar';
      }
      btnBook.disabled = false;
    }

    modal.classList.add('active');
  }

  closeEventModal() {
    const modal = document.getElementById('modal-event-detail');
    if (modal) modal.classList.remove('active');
  }

  async confirmBooking() {
    if (!this.selectedEvent) return;
    const user = Auth.currentUser;
    if (!user) {
      await RondaDialog.alert({
        title: 'Iniciar Sesión',
        message: 'Por favor inicia sesión o regístrate para completar tu reserva.',
        icon: '🔒'
      });
      return;
    }

    const btn = document.getElementById('btn-confirm-event-booking') as HTMLButtonElement;
    const evt = this.selectedEvent;

    // Si es lista de espera
    if (evt.status === 'lleno') {
      if (btn) { btn.textContent = 'Anotándote en lista...'; btn.disabled = true; }
      try {
        user.activeWaitlist = {
          eventId: evt.id,
          venueName: evt.venueName,
          dayDate: evt.dayDate,
          position: 2,
          joinedAt: new Date().toISOString(),
          status: 'waiting'
        };
        await DB.saveUser(user);
        this.closeEventModal();
        this.showToast(`¡Anotado en la lista de espera para ${evt.venueName}!`);
        window.dispatchEvent(new CustomEvent('view:switch', { detail: 'view-client' }));
        this.renderWaitlistView(user.activeWaitlist);
      } catch (err: any) {
        await RondaDialog.alert({
          title: 'Error de Registro',
          message: 'No se pudo completar la solicitud: ' + err.message,
          icon: '⚠️',
          type: 'danger'
        });
      } finally {
        if (btn) { btn.textContent = '⏳ Unirme a Lista de Espera'; btn.disabled = false; }
      }
      return;
    }

    // Reserva regular confirmada
    if (btn) {
      btn.textContent = 'Generando tu Pasaporte QR...';
      btn.disabled = true;
    }

    try {
      user.activeEventId = evt.id;
      delete user.activeWaitlist;
      user.activeReservation = {
        eventId: evt.id,
        venueName: evt.venueName,
        venueAddress: evt.venueAddress,
        mapsUrl: evt.mapsUrl,
        dayDate: evt.dayDate,
        tableNumber: evt.tableNumber,
        cocktailName: evt.cocktailIncluded,
        cocktailDesc: evt.cocktailDesc,
        cocktailImg: evt.cocktailImg,
        bookingCode: evt.bookingCode,
        priceFormatted: evt.priceFormatted,
        hostTips: evt.hostTips,
        status: 'confirmed'
      };

      await DB.saveUser(user);
      this.closeEventModal();
      
      // Feedback Toast
      this.showToast(`¡Reserva confirmada en ${evt.venueName}!`);

      // Cambiar a la vista del cliente
      window.dispatchEvent(new CustomEvent('view:switch', { detail: 'view-client' }));
      this.renderClientView();
      this.renderDiscoveryFeed();
    } catch (err: any) {
      console.error('Error al confirmar reserva:', err);
      alert('Hubo un error al procesar tu reserva: ' + err.message);
    } finally {
      if (btn) {
        btn.textContent = `🎟️ Reservar Cóctel de Autor`;
        btn.disabled = false;
      }
    }
  }

  // Vista cuando el usuario está en lista de espera
  renderWaitlistView(waitlist: any) {
    const container = document.getElementById('client-content');
    if (!container) return;

    container.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center; margin: 0 0 16px;">
        <h3 style="font-family: var(--font-display); font-size: 26px; font-weight: 700; color: var(--papel); margin: 0;">Lista de Espera</h3>
        <span class="chip ambar">Turno #${waitlist.position}</span>
      </div>

      <div class="auth-card" style="text-align: center; padding: 26px 20px;">
        <div style="font-size: 40px; margin-bottom: 8px;">⏳</div>
        <h4 style="font-family: var(--font-display); font-size: 22px; margin: 0 0 6px; color: var(--papel);">${waitlist.venueName}</h4>
        <p style="font-size: 11.5px; color: var(--luz); font-family: var(--font-mono); margin: 0 0 14px;">${waitlist.dayDate}</p>
        
        <p style="font-size: 12.5px; color: var(--humo); line-height: 1.45; margin: 0 0 18px;">
          Estás en la <b>posición #${waitlist.position}</b>. Te avisaremos por notificación en cuanto se equilibre la sala o se libere una mesa.
        </p>

        <div style="display: flex; flex-direction: column; gap: 10px;">
          <button id="btn-simulate-spot" class="btn ambar" style="font-size: 12.5px; font-weight: 700; padding: 12px;">
            ✨ Simular Cupo Liberado (Demo)
          </button>
          <button id="btn-leave-waitlist" class="btn" style="font-size: 11.5px; color: var(--humo); border-color: var(--linea); padding: 10px;">
            Salir de la Lista de Espera
          </button>
        </div>
      </div>
    `;

    document.getElementById('btn-simulate-spot')?.addEventListener('click', async () => {
      const user = Auth.currentUser;
      if (!user) return;
      const evt = RONDA_EVENTS.find(e => e.id === waitlist.eventId) || RONDA_EVENTS[2];
      user.activeEventId = evt.id;
      delete user.activeWaitlist;
      user.activeReservation = {
        eventId: evt.id,
        venueName: evt.venueName,
        venueAddress: evt.venueAddress,
        mapsUrl: evt.mapsUrl,
        dayDate: evt.dayDate,
        tableNumber: '02',
        cocktailName: evt.cocktailIncluded,
        cocktailDesc: evt.cocktailDesc,
        cocktailImg: evt.cocktailImg,
        bookingCode: '#RND-9104',
        priceFormatted: evt.priceFormatted,
        hostTips: evt.hostTips,
        status: 'confirmed'
      };
      await DB.saveUser(user);
      this.showToast('🎉 ¡Cupo asignado en Patio Poca Prisa!');
      this.renderClientView();
      this.renderDiscoveryFeed();
    });

    document.getElementById('btn-leave-waitlist')?.addEventListener('click', async () => {
      const user = Auth.currentUser;
      if (!user) return;
      delete user.activeWaitlist;
      await DB.saveUser(user);
      this.showToast('Has salido de la lista de espera.');
      window.dispatchEvent(new CustomEvent('view:switch', { detail: 'view-lobby' }));
      this.renderDiscoveryFeed();
    });
  }

  // Verifica si el cliente actual está en alguna mesa activa
  getMyCurrentMatch() {
    if (!this.currentEvent || !this.currentEvent.activeMatches) return null;
    const myUid = Auth.currentUser?.uid;
    return this.currentEvent.activeMatches.find((m: any) => m.p1.uid === myUid || m.p2.uid === myUid);
  }

  triggerSafeWord() {
    console.warn("¡Safe-word activado! Notificando a seguridad y anfitrión...");
    RondaDialog.alert({
      title: 'Asistencia en Camino',
      message: 'Hemos notificado discretamente al anfitrión de sala con tu palabra clave de seguridad. Un miembro del equipo se acercará a tu mesa de inmediato.',
      icon: '🛡️'
    });
  }

  startTimer(durationSeconds: number) {
    this.stopTimer();
    let timeLeft = durationSeconds;
    const el = document.getElementById('match-timer');
    
    this.timerInterval = setInterval(() => {
      if (timeLeft <= 0) {
        this.stopTimer();
        if (el) {
          el.innerText = "¡Ronda finalizada!";
        }
      } else {
        if(el) {
          const mins = Math.floor(timeLeft / 60);
          const secs = timeLeft % 60;
          el.innerText = `${mins}:${secs.toString().padStart(2, '0')}`;
          if (timeLeft < 60) {
            el.style.color = "var(--vino)";
          } else {
            el.style.color = "var(--luz)";
          }
        }
        timeLeft--;
      }
    }, 1000);
  }

  stopTimer() {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
  }

  stopCountdown() {
    if (this.countdownInterval) {
      clearInterval(this.countdownInterval);
      this.countdownInterval = null;
    }
  }

  async handleVote(targetUid: string, isYes: boolean) {
    const myUid = Auth.currentUser?.uid;
    const eventId = this.currentEvent?.id || 'ronda-demo';
    
    try {
      await OfflineSync.pushVote(myUid, targetUid, isYes, eventId);
      this.showToast(isYes ? '¡Preferencia mutua guardada! 😉' : 'Voto registrado.');

      const btnYes = document.getElementById('btn-vote-yes') as HTMLButtonElement;
      const btnNo = document.getElementById('btn-vote-no') as HTMLButtonElement;
      if (btnYes) btnYes.disabled = true;
      if (btnNo) btnNo.disabled = true;
    } catch (e) {
      console.error("Error guardando voto:", e);
      alert("Error guardando tu voto.");
    }
  }

  // Experiencia "El Día Después": Revelación de Matches a las 10:00 AM
  renderDayAfterMatchesView(postState: any) {
    const container = document.getElementById('client-content');
    if (!container) return;

    const user = Auth.currentUser;
    if (!user) return;

    this.stopCountdown();

    const isRevealed = postState.isRevealed;

    container.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center; margin: 0 0 16px;">
        <h3 style="font-family: var(--font-display); font-size: 26px; font-weight: 700; color: var(--papel); margin: 0;">El Día Después</h3>
        <span class="chip ${isRevealed ? 'verde' : 'ambar'}">${isRevealed ? 'Correspondencia Abierta' : '10:00 AM'}</span>
      </div>

      <!-- SOBRE CERRADO CON SELLO DE LACRE ROJO -->
      <div id="envelope-section" style="${isRevealed ? 'display: none;' : 'display: block;'}">
        <div style="text-align: center; margin-bottom: 18px;">
          <span style="font-size: 11px; font-family: var(--font-mono); color: var(--luz); text-transform: uppercase; letter-spacing: 0.12em; font-weight: 700;">
            ⏳ REVELACIÓN DE AFINIDADES MUTUAS
          </span>
          <h2 id="countdown-reveal" style="font-family: var(--font-mono); font-size: 36px; font-weight: 800; color: var(--papel); margin: 6px 0; font-variant-numeric: tabular-nums;">
            04h : 18m : 32s
          </h2>
          <p style="font-size: 12px; color: var(--humo); margin: 0; line-height: 1.45; max-width: 320px; margin: 0 auto;">
            El anfitrión ha sellado los resultados de anoche en <b>${postState.venueName}</b>. Toca el sello de cera para descubrir si hubo match.
          </p>
        </div>

        <div class="envelope-wrapper">
          <div class="vintage-envelope">
            <div id="envelope-flap" class="envelope-flap"></div>
            <div id="wax-seal-btn" class="wax-seal" title="Toca para romper el sello y abrir correspondencia">
              <span class="wax-seal-inner">R</span>
            </div>
            <div class="envelope-pocket"></div>
          </div>
        </div>

        <button id="btn-simulate-10am" class="btn ambar" style="width: 100%; font-size: 12.5px; font-weight: 700; padding: 12px; display: flex; align-items: center; justify-content: center; gap: 8px;">
          ✨ Romper Sello de Cera (Abrir Correspondencia)
        </button>
      </div>

      <!-- CARTA ANTIGUA DESPLEGADA -->
      <div id="letter-parchment" class="vintage-letter-parchment ${isRevealed ? 'revealed' : ''}">
        <div style="text-align: center; border-bottom: 1px dashed rgba(26,18,11,0.25); padding-bottom: 12px; margin-bottom: 16px;">
          <p style="font-family: var(--font-display); font-size: 20px; font-weight: 800; letter-spacing: 0.2em; color: #1a120b; margin: 0 0 3px;">R O N D A</p>
          <span style="font-family: var(--font-mono); font-size: 10px; text-transform: uppercase; color: #73675a; letter-spacing: 0.1em;">Correspondencia Confidencial · 10:00 AM</span>
        </div>

        <p style="font-family: var(--font-display); font-style: italic; font-size: 14.5px; color: #2b1c18; margin: 0 0 14px; line-height: 1.5;">
          Apreciado/a <b>${user.name || 'Invitado/a'}</b>, tras el cruce de votaciones anoche en <b>${postState.venueName}</b>, nos complace presentarte tu correspondencia de afinidad mutua:
        </p>

        <!-- Match Card Destacado -->
        ${postState.matches.map((m: any) => `
          <div style="background: rgba(240,168,48,0.12); border: 1.5px solid #d4af37; border-radius: 14px; padding: 14px 16px; margin-bottom: 16px; box-shadow: 0 4px 14px rgba(0,0,0,0.06);">
            <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 6px;">
              <div>
                <b style="font-family: var(--font-display); font-size: 18px; color: #1a120b;">${m.name} (${m.age})</b>
                <span style="font-size: 11px; color: #73675a; display: block; font-family: var(--font-mono);">${m.profession} · ${m.zone}</span>
              </div>
              <span class="chip verde" style="font-size: 9.5px; padding: 3px 8px; background: #2e6b54; color: #fff;">Match Mutuo ✓</span>
            </div>

            <p style="font-size: 12px; color: #3d2b1f; margin: 6px 0 12px; line-height: 1.4; font-style: italic;">
              "${m.icebreakerSummary}"
            </p>

            <div style="display: flex; flex-direction: column; gap: 8px;">
              <a href="https://wa.me/${m.whatsappPhone}?text=${encodeURIComponent('¡Hola ' + m.name.split(' ')[0] + '! Tuvimos match en RONDA ' + postState.venueName + ' 🍸')}" target="_blank" class="btn" style="text-decoration: none; text-align: center; background: #25d366; color: #fff; font-weight: 700; font-size: 12px; padding: 11px; border: none; border-radius: 10px; display: flex; align-items: center; justify-content: center; gap: 6px; box-shadow: 0 4px 10px rgba(37,211,102,0.3);">
                💬 Escribirle por WhatsApp (${m.name.split(' ')[0]})
              </a>
              
              <button class="btn btn-voucher-2nd-date" style="background: rgba(26,18,11,0.06); color: #1a120b; border: 1px solid rgba(26,18,11,0.2); font-size: 11px; padding: 9px; font-weight: 600;" data-venue="${postState.venueName}">
                🍸 Invitar a 2ª Cita (-25% en ${postState.venueName})
              </button>
            </div>
          </div>
        `).join('')}

        <div style="border-top: 1px dashed rgba(26,18,11,0.25); padding-top: 12px; margin-top: 16px; text-align: right;">
          <p style="font-family: var(--font-display); font-size: 13.5px; font-style: italic; margin: 0; color: #5a4a3a;">
            Afectuosamente,<br>
            <b>El Anfitrión de Sala</b><br>
            <small style="font-family: var(--font-mono); font-size: 10px; color: #8c7b6b;">RONDA System · Bogotá</small>
          </p>
        </div>

        <button id="btn-done-matches" class="btn ambar" style="width: 100%; margin-top: 18px; font-size: 12px; font-weight: 700; padding: 12px;">
          Explorar Próxima Cartelera de Eventos
        </button>
      </div>
    `;

    // Vincular botón de voucher de segunda cita
    container.querySelectorAll('.btn-voucher-2nd-date').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const venue = (e.currentTarget as HTMLElement).getAttribute('data-venue') || 'el local';
        RondaDialog.alert({
          title: 'Cupón de 2ª Cita Activado',
          message: `¡Disfruta un -25% de descuento en tu cuenta en ${venue} para tu próxima visita de a dos! Presenta tu pasaporte digital en el local.`,
          icon: '🍸'
        });
      });
    });

    // Iniciar reloj hacia las 10:00 AM si aún no está revelado
    if (!isRevealed) {
      let secondsLeft = 4 * 3600 + 18 * 60 + 32;
      const elCount = document.getElementById('countdown-reveal');
      this.countdownInterval = setInterval(() => {
        if (secondsLeft <= 0) {
          this.stopCountdown();
          this.triggerOpenLetterAnimation(postState);
        } else {
          secondsLeft--;
          const hrs = Math.floor(secondsLeft / 3600);
          const mins = Math.floor((secondsLeft % 3600) / 60);
          const secs = secondsLeft % 60;
          if (elCount) {
            elCount.textContent = `${hrs.toString().padStart(2, '0')}h : ${mins.toString().padStart(2, '0')}m : ${secs.toString().padStart(2, '0')}s`;
          }
        }
      }, 1000);

      document.getElementById('wax-seal-btn')?.addEventListener('click', () => {
        this.triggerOpenLetterAnimation(postState);
      });

      document.getElementById('btn-simulate-10am')?.addEventListener('click', () => {
        this.triggerOpenLetterAnimation(postState);
      });
    }

    document.getElementById('btn-done-matches')?.addEventListener('click', async () => {
      delete user.postEventState;
      delete user.activeReservation;
      delete user.activeEventId;
      await DB.saveUser(user);
      window.dispatchEvent(new CustomEvent('view:switch', { detail: 'view-lobby' }));
      this.renderDiscoveryFeed();
    });
  }

  triggerOpenLetterAnimation(postState: any) {
    const waxSeal = document.getElementById('wax-seal-btn');
    const flap = document.getElementById('envelope-flap');
    const letter = document.getElementById('letter-parchment');
    const envelopeSection = document.getElementById('envelope-section');

    if (waxSeal) waxSeal.classList.add('cracking');

    setTimeout(() => {
      if (flap) flap.classList.add('open');
    }, 350);

    setTimeout(async () => {
      if (envelopeSection) envelopeSection.style.display = 'none';
      if (letter) {
        letter.classList.add('revealed');
      }

      const user = Auth.currentUser;
      if (user && user.postEventState) {
        user.postEventState.isRevealed = true;
        await DB.saveUser(user);
      }

      this.showToast('💌 ¡Correspondencia abierta! Has tenido match mutuo ✨');
    }, 700);
  }

  renderClientView() {
    const container = document.getElementById('client-content');
    if (!container) return;

    const user = Auth.currentUser;
    if (!user) return;

    // Si tiene correspondencia del día después
    if (user.postEventState) {
      this.renderDayAfterMatchesView(user.postEventState);
      return;
    }

    const res = user.activeReservation || {
      eventId: 'rnd-caronte-mar-25',
      venueName: 'CARONTE Cocktail Bar',
      venueAddress: 'Cra. 4A #66-22 · Zona G, Bogotá',
      mapsUrl: 'https://www.google.com/maps/search/?api=1&query=Cra+4A+66-22+Zona+G+Bogota',
      dayDate: 'Martes 25 de marzo · 20:00',
      tableNumber: '07',
      cocktailName: 'Negroni Ahumado de Autor',
      cocktailDesc: 'Campari ahumado en roble, Vermut Rosso y Gin botánico con cáscara de naranja caramelizada.',
      cocktailImg: '/assets/coctel-negroni.svg',
      bookingCode: '#RND-4471',
      priceFormatted: '$45.000',
      status: 'confirmed'
    };

    const match = this.getMyCurrentMatch();

    if (match) {
      const partner = match.p1.uid === user.uid ? match.p2 : match.p1;
      container.innerHTML = `
        <div class="noche-card ok">
          <div class="ronda-head" style="margin-bottom: 15px;">
            <div style="display: flex; align-items: center; gap: 8px;">
              <svg class="icon-svg" style="color: var(--luz);"><use href="#icon-mesa"></use></svg>
              <span class="ronda-n">Ronda ${this.currentEvent?.currentRound || 1} de 9</span>
            </div>
            <span class="chip ambar">Cita en Marcha</span>
          </div>
          
          <div class="frente" style="margin: 10px 0;">
            <h4 style="font-family: var(--font-display); font-size: 28px; margin: 0 0 4px;">${partner.name}</h4>
            <p style="margin: 0; color: var(--humo); font-size: 13px;">Te espera en la <b>MESA ${match.tableId}</b></p>
          </div>
          
          <div style="margin: 20px 0; text-align: center;">
            <span style="font-size: 11px; text-transform: uppercase; color: var(--humo); letter-spacing: 0.1em;">Tiempo restante</span>
            <h1 id="match-timer" style="font-family: var(--font-mono); font-size: 48px; color: var(--luz); margin: 0; font-variant-numeric: tabular-nums;">05:00</h1>
          </div>
          
          <div class="acciones" style="flex-direction: column; gap: 10px;">
            <div style="display: flex; gap: 10px; width: 100%;">
              <button id="btn-vote-no" class="btn" style="flex: 1; border-color: var(--vino); color: var(--vino);" data-target="${partner.uid}">No</button>
              <button id="btn-vote-yes" class="btn si" style="flex: 1;" data-target="${partner.uid}">Sí</button>
            </div>
            <button id="btn-safeword" class="btn" style="border-color: var(--vino); color: #f08ca8; background: rgba(155,39,72,.14); width: 100%; font-weight: 700; font-size: 11px;">⚠️ Solicitar Asistencia Discreta</button>
          </div>

          <button id="btn-sim-finish-event" class="btn" style="margin-top: 14px; font-size: 11px; color: var(--luz); border-color: var(--linea); width: 100%;">
            ✨ Simular Fin de Evento (Pasar a las 10:00 AM)
          </button>
        </div>
      `;
      setTimeout(() => this.startTimer(300), 100);

      document.getElementById('btn-sim-finish-event')?.addEventListener('click', async () => {
        this.stopTimer();
        this.currentEvent = null;
        user.postEventState = {
          eventId: res.eventId,
          venueName: res.venueName,
          dayDate: res.dayDate,
          revealTimeIso: new Date(Date.now() + 14 * 3600000).toISOString(),
          isRevealed: false,
          matches: [
            {
              id: 'match_camila',
              name: 'Camila Ospina',
              age: 28,
              profession: 'Arquitecta de Interiores',
              zone: 'Zona G',
              cocktail: 'Negroni Ahumado',
              icebreakerSummary: 'Ambos coincidieron en pasión por los viajes, cócteles de autor y arquitectura.',
              whatsappPhone: '573124567890'
            }
          ]
        };
        await DB.saveUser(user);
        this.showToast('🔔 ¡Evento concluido! Resultados sellados para las 10:00 AM.');
        this.renderClientView();
      });
    } else {
      // Estado de la Reserva (Confirmada / En Barra / En Ronda)
      const isCheckedIn = res.status === 'checked_in';

      const checkInBanner = isCheckedIn ? `
        <div style="background: rgba(46,107,84,0.18); border: 1px solid var(--botella); border-radius: 14px; padding: 12px 14px; margin-bottom: 16px; text-align: center;">
          <b style="color: #79D3AC; font-size: 12.5px; display: block;">🍸 Cóctel Canjeado · ¡Estás en Barra!</b>
          <span style="font-size: 11px; color: var(--humo);">Prepárate para la 1ª campanada y toma asiento en la <b>Mesa ${res.tableNumber}</b></span>
        </div>
      ` : '';

      // Mostrar ticket de Reserva / Pasaporte QR Oficial
      container.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin: 0 0 16px;">
          <h3 style="font-family: var(--font-display); font-size: 26px; font-weight: 700; color: var(--papel); margin: 0; letter-spacing: -0.01em;">Tu reserva</h3>
          <span style="font-family: var(--font-mono); font-size: 11px; color: var(--luz); background: rgba(240,168,48,0.12); border: 1px solid rgba(240,168,48,0.35); padding: 4px 10px; border-radius: 999px; font-weight: 700; letter-spacing: 0.04em;">${res.bookingCode}</span>
        </div>

        ${checkInBanner}
        
        <div class="reserva-pass">
          <div class="reserva-pass-notch-left"></div>
          <div class="reserva-pass-notch-right"></div>

          <div style="text-align: center; margin-bottom: 14px;">
            <p style="font-family: var(--font-display); font-size: 22px; font-weight: 800; letter-spacing: 0.22em; margin: 0 0 3px; color: #17101d;">R O N D A</p>
            <p style="font-family: var(--font-mono); font-size: 10px; letter-spacing: 0.12em; text-transform: uppercase; color: #73675a; margin: 0;">${res.dayDate}</p>
          </div>
          
          <div style="font-size: 12px; margin-bottom: 6px; display: flex; justify-content: space-between; gap: 8px; align-items: baseline;">
            <span style="color: #73675a; font-family: var(--font-mono); font-size: 11px;">Local</span>
            <b style="color: #17101d; font-family: var(--font-display); font-size: 14.5px;">${res.venueName}</b>
          </div>
          <div style="font-size: 11.5px; display: flex; justify-content: space-between; gap: 8px; align-items: baseline;">
            <span style="color: #73675a; font-family: var(--font-mono); font-size: 11px;">Dirección</span>
            <a href="${res.mapsUrl || '#'}" target="_blank" style="color: #1b4332; text-decoration: underline; font-family: var(--font-mono); font-size: 11px; font-weight: 600; display: inline-flex; align-items: center; gap: 3px;">
              📍 ${res.venueAddress}
            </a>
          </div>
          
          <div class="reserva-pass-divider"></div>
          
          <div style="text-align: center; margin: 8px 0 14px;">
            <p style="font-family: var(--font-display); font-size: 48px; font-weight: 800; color: #17101d; margin: 0; line-height: 0.95;">${res.tableNumber}</p>
            <p style="font-family: var(--font-mono); font-size: 10px; text-transform: uppercase; color: #73675a; letter-spacing: 0.16em; margin: 4px 0 0;">Tu mesa de salida</p>
          </div>
          
          <!-- Cóctel Destacado con Imagen Sin Fondo -->
          <div style="background: rgba(46,107,84,0.1); border: 1px solid rgba(46,107,84,0.25); border-radius: 14px; padding: 12px 14px; margin-bottom: 16px; display: flex; align-items: center; gap: 12px;">
            <img src="${res.cocktailImg || '/assets/coctel-negroni.svg'}" alt="${res.cocktailName}" style="width: 48px; height: 56px; object-fit: contain; flex-shrink: 0;">
            <div>
              <p style="font-size: 11.5px; color: var(--botella); font-weight: 700; margin: 0 0 2px;">🍸 Incluye: Cóctel de Autor</p>
              <b style="font-size: 12px; color: #17101d; display: block;">${res.cocktailName}</b>
              <span style="font-size: 10px; color: #555; line-height: 1.3; display: block; margin-top: 2px;">${res.cocktailDesc || ''}</span>
            </div>
          </div>

          <div id="qr-client" aria-label="Código de acceso" style="margin: 0 auto 10px; width: 136px; height: 136px; display: grid; grid-template-columns: repeat(11, 1fr); gap: 2.5px; padding: 8px; background: #fff; border-radius: 8px; box-shadow: 0 4px 14px rgba(0,0,0,0.08);"></div>
          
          <p style="font-family: var(--font-mono); font-size: 10.5px; text-align: center; color: #73675a; margin: 6px 0 0; letter-spacing: 0.04em;">Enséñalo en barra al llegar para tu cóctel</p>
        </div>

        <!-- Acciones Post-Reserva (Mapas, Calendario, Gestionar, Check-in Demo) -->
        <div style="display: flex; flex-direction: column; gap: 8px; margin-top: 18px;">
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
            <a href="${res.mapsUrl || '#'}" target="_blank" class="btn" style="text-decoration: none; text-align: center; background: rgba(243,237,226,.06); border-color: var(--linea); font-size: 11.5px; padding: 10px; display: flex; align-items: center; justify-content: center; gap: 4px;">
              📍 Maps / Waze
            </a>
            
            <button id="btn-add-calendar" class="btn" style="background: rgba(243,237,226,.06); border-color: var(--linea); font-size: 11.5px; padding: 10px; display: flex; align-items: center; justify-content: center; gap: 4px;">
              📅 Calendario
            </button>
          </div>

          <button id="btn-open-manage-from-ticket" class="btn" style="background: rgba(243,237,226,.06); border-color: var(--linea); font-size: 12px; padding: 11px; display: flex; align-items: center; justify-content: center; gap: 6px;">
            ⚙️ Gestionar / Cambiar Sala o Cancelar
          </button>

          <button id="btn-simulate-checkin" class="btn ambar" style="font-size: 12px; font-weight: 700; padding: 12px; margin-top: 2px; display: flex; align-items: center; justify-content: center; gap: 6px;">
            ${isCheckedIn ? '🔔 Iniciar Ronda 1 (Demo)' : '🍸 Simular Llegada al Bar (Canjear Cóctel)'}
          </button>

          <button id="btn-sim-direct-10am" class="btn" style="font-size: 11px; color: var(--luz); border-color: rgba(240,168,48,.3); background: rgba(240,168,48,.06); padding: 9px; margin-top: 4px;">
            💌 Simular Día Siguiente (Sobre de Matches 10:00 AM)
          </button>
        </div>

        <div class="aviso" style="margin-top: 18px; font-size: 11.5px; padding: 12px 14px; border-radius: 14px;">
          ⚠️ <b>Compromiso RONDA:</b> No aparecer sin avisar: pierdes la entrada y <b>1 strike</b>.
        </div>
      `;

      this.renderQRCode('qr-client');

      // Gestión de Reserva desde Ticket
      document.getElementById('btn-open-manage-from-ticket')?.addEventListener('click', () => {
        this.openManageReservationsModal();
      });

      // Acciones de Calendario y Check-in
      document.getElementById('btn-add-calendar')?.addEventListener('click', () => {
        const start = new Date(Date.now() + 86400000);
        const end = new Date(start.getTime() + 105 * 60000);
        downloadICSFile(
          `Cita RONDA en ${res.venueName}`,
          `Tu reserva confirmada (${res.bookingCode}). Mesa de salida: ${res.tableNumber}. Incluye cóctel de autor: ${res.cocktailName}.`,
          res.venueAddress,
          start,
          end
        );
        this.showToast('📅 Archivo de calendario descargado');
      });

      document.getElementById('btn-simulate-checkin')?.addEventListener('click', async () => {
        if (!isCheckedIn) {
          res.status = 'checked_in';
          user.activeReservation = res;
          await DB.saveUser(user);
          this.showToast('🍸 ¡Cóctel canjeado en barra! Disfruta la previa.');
          this.renderClientView();
        } else {
          // Simular el inicio del evento en sala
          this.currentEvent = {
            id: res.eventId,
            currentRound: 1,
            activeMatches: [
              {
                tableId: res.tableNumber,
                p1: { uid: user.uid, name: user.name || 'Tú' },
                p2: { uid: 'user_camila_demo', name: 'Camila (28) · Arquitecta' }
              }
            ]
          };
          this.showToast('🔔 ¡Campanada! Toma asiento en la mesa ' + res.tableNumber);
          this.renderClientView();
        }
      });

      document.getElementById('btn-sim-direct-10am')?.addEventListener('click', async () => {
        user.postEventState = {
          eventId: res.eventId,
          venueName: res.venueName,
          dayDate: res.dayDate,
          revealTimeIso: new Date(Date.now() + 14 * 3600000).toISOString(),
          isRevealed: false,
          matches: [
            {
              id: 'match_camila',
              name: 'Camila Ospina',
              age: 28,
              profession: 'Arquitecta de Interiores',
              zone: 'Zona G',
              cocktail: 'Negroni Ahumado',
              icebreakerSummary: 'Ambos coincidieron en gusto por el Negroni Ahumado, diseño urbano y viajes por Colombia.',
              whatsappPhone: '573124567890'
            }
          ]
        };
        await DB.saveUser(user);
        this.showToast('⏳ ¡Correspondencia sellada! Abriendo cuenta atrás a las 10:00 AM.');
        this.renderClientView();
      });
    }

    const safeWordBtn = document.getElementById('btn-safeword');
    if (safeWordBtn) {
      safeWordBtn.addEventListener('click', () => this.triggerSafeWord());
    }

    const btnVoteYes = document.getElementById('btn-vote-yes');
    const btnVoteNo = document.getElementById('btn-vote-no');
    if (btnVoteYes && btnVoteNo) {
      btnVoteYes.addEventListener('click', () => this.handleVote(btnVoteYes.getAttribute('data-target') || '', true));
      btnVoteNo.addEventListener('click', () => this.handleVote(btnVoteNo.getAttribute('data-target') || '', false));
    }
  }

  renderQRCode(elementId: string) {
    const qr = document.getElementById(elementId);
    if (!qr) return;
    qr.innerHTML = '';
    let s = 103;
    const rnd = () => (s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
    for (let i = 0; i < 121; i++) {
      const c = document.createElement('i');
      const r = Math.floor(i / 11);
      const co = i % 11;
      const esquina = (r < 3 && co < 3) || (r < 3 && co > 7) || (r > 7 && co < 3);
      c.style.background = (esquina || rnd() > 0.48) ? 'var(--tinta)' : 'transparent';
      c.style.borderRadius = '1px';
      qr.appendChild(c);
    }
  }

  showToast(message: string) {
    const toast = document.createElement('div');
    toast.style.cssText = `
      position: fixed;
      bottom: 30px;
      left: 50%;
      transform: translateX(-50%);
      background: var(--barra-alta);
      color: var(--luz);
      font-family: var(--font-mono);
      font-size: 12px;
      padding: 10px 18px;
      border-radius: 999px;
      border: 1px solid var(--luz);
      box-shadow: 0 10px 30px rgba(0,0,0,0.8);
      z-index: 9999;
      pointer-events: none;
      animation: fadeIn 0.3s ease;
      white-space: nowrap;
    `;
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transition = 'opacity 0.4s ease';
      setTimeout(() => toast.remove(), 400);
    }, 2800);
  }
}

export const ClientApp = new ClientAppService();
