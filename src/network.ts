import { DB, Venue } from './db.js';
import { RondaDialog } from './dialog.js';
import { escapeHtml } from './utils.js';
import { 
  checkTerritorialExclusivity, 
  detectAllNetworkCollisions, 
  EXCLUSIVITY_CONFIG 
} from './entry-network.js';
import { Unsubscribe } from 'firebase/firestore';

export class NetworkController {
  private venues: Venue[] = [];
  private selectedZone: string = 'all';
  private unsubscribeVenues: Unsubscribe | null = null;

  constructor() {}

  async init() {
    console.log('[NetworkController] Inicializando Panel de Red y Grafo Territorial...');
    
    // Carga inicial
    this.venues = await DB.getVenues();
    this.render();
    this.setupEventListeners();

    // Suscripción reactiva en tiempo real a cambios en venues
    if (this.unsubscribeVenues) {
      this.unsubscribeVenues();
    }
    this.unsubscribeVenues = DB.subscribeToVenues((liveVenues) => {
      this.venues = liveVenues;
      this.render();
    }, (err) => {
      console.warn('[NetworkController] Error en sincronización en vivo de venues:', err);
    });
  }

  destroy() {
    if (this.unsubscribeVenues) {
      this.unsubscribeVenues();
      this.unsubscribeVenues = null;
    }
  }

  render() {
    const container = document.getElementById('network-container');
    if (!container) return;

    // Detectar colisiones (< 500m) usando el motor territorial unificado
    const collisionMap = detectAllNetworkCollisions(this.venues, EXCLUSIVITY_CONFIG.MIN_DISTANCE_METERS);

    const filtered = this.selectedZone === 'all' 
      ? this.venues 
      : this.venues.filter(v => (v.zone || '').toLowerCase().includes(this.selectedZone.toLowerCase()));

    const activeCount = this.venues.filter(v => v.status === 'active').length;
    // Cada par se cuenta una vez
    let totalConflicts = 0;
    collisionMap.forEach(conflicts => { totalConflicts += conflicts.length; });
    const conflictCount = Math.floor(totalConflicts / 2);

    container.innerHTML = `
      <div style="display: flex; flex-direction: column; gap: 20px;">
        <!-- Top KPI Bar -->
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 12px;">
          <div style="background: rgba(243,237,226,0.05); border: 1px solid var(--linea); border-radius: 12px; padding: 14px; text-align: center;">
            <span style="font-size: 11px; color: var(--humo); font-family: var(--font-mono); text-transform: uppercase;">Total Bares</span>
            <b style="font-size: 24px; color: var(--papel); font-family: var(--font-display); display: block; margin-top: 4px;">${this.venues.length}</b>
          </div>
          <div style="background: rgba(46,107,84,0.1); border: 1px solid var(--botella); border-radius: 12px; padding: 14px; text-align: center;">
            <span style="font-size: 11px; color: var(--botella); font-family: var(--font-mono); text-transform: uppercase;">Activos en Red</span>
            <b style="font-size: 24px; color: var(--papel); font-family: var(--font-display); display: block; margin-top: 4px;">${activeCount}</b>
          </div>
          <div style="background: rgba(155,39,72,0.1); border: 1px solid var(--vino); border-radius: 12px; padding: 14px; text-align: center;">
            <span style="font-size: 11px; color: #ff8ca8; font-family: var(--font-mono); text-transform: uppercase;">Conflictos (<500m)</span>
            <b style="font-size: 24px; color: #ff8ca8; font-family: var(--font-display); display: block; margin-top: 4px;">${conflictCount}</b>
          </div>
          <div style="background: rgba(240,168,48,0.1); border: 1px solid var(--luz); border-radius: 12px; padding: 14px; text-align: center;">
            <span style="font-size: 11px; color: var(--luz); font-family: var(--font-mono); text-transform: uppercase;">Radio Exclusividad</span>
            <b style="font-size: 24px; color: var(--luz); font-family: var(--font-display); display: block; margin-top: 4px;">500m</b>
          </div>
        </div>

        <!-- Toolbar: Filtro de Zona y Agregar Bar -->
        <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px; background: rgba(0,0,0,0.25); padding: 12px 16px; border-radius: 12px; border: 1px solid var(--linea);">
          <div style="display: flex; gap: 8px; align-items: center; flex-wrap: wrap;">
            <span style="font-size: 11px; font-family: var(--font-mono); color: var(--humo);">ZONA:</span>
            <button class="btn zone-filter-btn ${this.selectedZone === 'all' ? 'ambar' : ''}" data-zone="all" style="font-size: 11px; padding: 6px 12px;">Todas</button>
            <button class="btn zone-filter-btn ${this.selectedZone === 'Zona G' ? 'ambar' : ''}" data-zone="Zona G" style="font-size: 11px; padding: 6px 12px;">Zona G</button>
            <button class="btn zone-filter-btn ${this.selectedZone === 'Quinta Camacho' ? 'ambar' : ''}" data-zone="Quinta Camacho" style="font-size: 11px; padding: 6px 12px;">Quinta Camacho</button>
            <button class="btn zone-filter-btn ${this.selectedZone === 'Chapinero' ? 'ambar' : ''}" data-zone="Chapinero" style="font-size: 11px; padding: 6px 12px;">Chapinero</button>
          </div>
          <button id="btn-net-add-venue" class="btn ambar" style="font-size: 11px; font-weight: 700; padding: 8px 14px;">+ Afiliar Nuevo Bar</button>
        </div>

        <!-- Lista de Locales de la Red -->
        <div style="display: flex; flex-direction: column; gap: 10px;">
          ${filtered.map(v => {
            const conflicts = collisionMap.get(v.id);
            const hasConflict = conflicts && conflicts.length > 0;
            const latVal = typeof v.lat === 'number' ? v.lat.toFixed(4) : 'N/A';
            const lngVal = typeof v.lng === 'number' ? v.lng.toFixed(4) : 'N/A';

            return `
              <div style="background: ${hasConflict ? 'rgba(155,39,72,0.12)' : 'rgba(243,237,226,0.04)'}; border: 1px solid ${hasConflict ? 'rgba(155,39,72,0.4)' : 'var(--linea)'}; border-radius: 14px; padding: 16px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px;">
                <div>
                  <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
                    <b style="font-family: var(--font-display); font-size: 17px; color: var(--papel);">${escapeHtml(v.name)}</b>
                    <span class="chip ${v.status === 'active' ? 'verde' : 'gris'}" style="font-size: 9px; padding: 2px 7px;">${v.status === 'active' ? '● En Red' : 'Inactivo'}</span>
                    <span class="chip ambar" style="font-size: 9px; padding: 2px 7px;">📍 ${escapeHtml(v.zone || 'Bogotá')}</span>
                  </div>
                  <p style="font-size: 11.5px; color: var(--humo); font-family: var(--font-mono); margin: 0;">${escapeHtml(v.address || 'Dirección registrada')} · Coords: (${latVal}, ${lngVal})</p>
                  ${hasConflict ? `
                    <div style="margin-top: 8px; font-size: 11px; color: #ff8ca8; font-family: var(--font-mono); display: flex; align-items: center; gap: 6px;">
                      ⚠️ <b>Alerta de colisión:</b> A solo ${conflicts[0].distanceMeters}m de <u>${escapeHtml(conflicts[0].conflictingVenueName)}</u> (Violación de exclusividad &lt;500m)
                    </div>
                  ` : `
                    <div style="margin-top: 6px; font-size: 10.5px; color: var(--botella); font-family: var(--font-mono);">
                      ✓ Exclusividad territorial garantizada (&gt; 500m)
                    </div>
                  `}
                </div>
                <div style="display: flex; gap: 8px;">
                  <button class="btn btn-toggle-venue-status" data-id="${v.id}" style="font-size: 10.5px; padding: 7px 12px; background: rgba(0,0,0,0.3); border-color: var(--linea);">
                    ${v.status === 'active' ? 'Pausar' : 'Activar'}
                  </button>
                  <a href="https://www.google.com/maps/search/?api=1&query=${v.lat},${v.lng}" target="_blank" rel="noopener noreferrer" class="btn" style="text-decoration: none; font-size: 10.5px; padding: 7px 12px; background: rgba(0,0,0,0.3); border-color: var(--linea);">
                    Ver Mapa ➔
                  </a>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;

    this.attachDynamicListeners();
  }

  private setupEventListeners() {}

  private attachDynamicListeners() {
    document.querySelectorAll('.zone-filter-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const zone = (e.currentTarget as HTMLElement).getAttribute('data-zone') || 'all';
        this.selectedZone = zone;
        this.render();
      });
    });

    document.querySelectorAll('.btn-toggle-venue-status').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const id = (e.currentTarget as HTMLElement).getAttribute('data-id');
        if (!id) return;
        const v = this.venues.find(item => item.id === id);
        if (v) {
          const newStatus = v.status === 'active' ? 'inactive' : 'active';
          
          // Si va a activarse, verificar si genera colisión
          if (newStatus === 'active') {
            const check = checkTerritorialExclusivity(
              { lat: v.lat, lng: v.lng, id: v.id }, 
              this.venues
            );
            if (!check.isCompliant) {
              const proceed = await RondaDialog.confirm({
                title: '⚠️ Conflicto de Exclusividad',
                message: `Activar este bar genera colisión con <b>${escapeHtml(check.conflicts[0].conflictingVenueName)}</b> a solo ${check.conflicts[0].distanceMeters}m.<br><br>¿Deseas activarlo de todas formas?`,
                html: true,
                confirmText: 'Activar con Advertencia',
                cancelText: 'Cancelar'
              });
              if (!proceed) return;
            }
          }

          v.status = newStatus;
          try {
            await DB.saveVenue(v);
          } catch (err) {
            console.error('[NetworkController] Error al guardar estado del bar:', err);
          }
          this.render();
        }
      });
    });

    document.getElementById('btn-net-add-venue')?.addEventListener('click', async () => {
      const name = await RondaDialog.prompt({
        title: 'Nuevo Bar Aliado',
        message: 'Ingresa el nombre comercial del establecimiento:',
        icon: '🍸',
        placeholder: 'Ej: Bar Bogotá 69',
        confirmText: 'Continuar',
        cancelText: 'Cancelar'
      });
      if (!name) return;

      const zone = await RondaDialog.prompt({
        title: 'Zona de Operación',
        message: 'Indica la zona gastronómica o comercial en Bogotá:',
        icon: '📍',
        placeholder: 'Zona G, Quinta Camacho, Parque 93, Chapinero',
        confirmText: 'Continuar',
        cancelText: 'Cancelar'
      }) || 'Zona G';

      const address = await RondaDialog.prompt({
        title: 'Dirección Comercial',
        message: 'Dirección completa del local:',
        icon: '🗺️',
        placeholder: 'Ej: Calle 69 # 5-30',
        confirmText: 'Verificar Exclusividad',
        cancelText: 'Cancelar'
      }) || 'Bogotá';
      
      // Coordenadas simuladas en Bogotá para registro ágil
      const candidateCoords = {
        lat: 4.6540 + (Math.random() - 0.5) * 0.015,
        lng: -74.0560 + (Math.random() - 0.5) * 0.015
      };

      // Evaluación inmediata con el motor de exclusividad territorial (500m)
      const exclusivityCheck = checkTerritorialExclusivity(candidateCoords, this.venues);
      let initialStatus: 'active' | 'inactive' = 'active';

      if (!exclusivityCheck.isCompliant) {
        const proceedWithWarning = await RondaDialog.confirm({
          title: '⚠️ Conflicto Territorial Detectado',
          message: `El bar se ubicaría a <b>${exclusivityCheck.conflicts[0].distanceMeters}m</b> de <b>${escapeHtml(exclusivityCheck.conflicts[0].conflictingVenueName)}</b>.<br><br>Para proteger a la red aliada, se afiliará con estado <b>Inactivo</b> hasta validación por la dirección.`,
          html: true,
          confirmText: 'Afiliar como Inactivo',
          cancelText: 'Cancelar'
        });
        if (!proceedWithWarning) return;
        initialStatus = 'inactive';
      }

      const newVenue: Venue = {
        id: 'v_' + Date.now(),
        name,
        address,
        zone,
        lat: candidateCoords.lat,
        lng: candidateCoords.lng,
        status: initialStatus
      };

      try {
        await DB.saveVenue(newVenue);
        this.venues.push(newVenue);
        this.render();

        await RondaDialog.alert({
          title: 'Bar Registrado en Red',
          message: `¡<b>${escapeHtml(name)}</b> ha sido guardado exitosamente en Firestore!<br><br>Estado: <b>${initialStatus === 'active' ? '● En Red' : 'Pausado (Conflicto territorial)'}</b>.`,
          icon: '✅',
          html: true
        });
      } catch (err: any) {
        await RondaDialog.alert({
          title: 'Error al Guardar',
          message: err?.message || 'No se pudo guardar el bar en la base de datos.',
          icon: '🛑'
        });
      }
    });
  }
}

export const Network = new NetworkController();
