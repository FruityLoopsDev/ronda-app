import { DB, Venue } from './db.js';
import { RondaDialog } from './dialog.js';

export class NetworkController {
  private venues: Venue[] = [];
  private selectedZone: string = 'all';

  constructor() {}

  async init() {
    console.log('[NetworkController] Inicializando Panel de Red...');
    this.venues = await DB.getVenues();
    this.render();
    this.setupEventListeners();
  }

  private getDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371e3; // metres
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lon2 - lon1) * Math.PI / 180;

    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return Math.round(R * c); // in metres
  }

  render() {
    const container = document.getElementById('network-container');
    if (!container) return;

    // Detect collisions (< 500m)
    const collisions = new Map<string, { otherName: string; distance: number }>();
    for (let i = 0; i < this.venues.length; i++) {
      for (let j = i + 1; j < this.venues.length; j++) {
        const d = this.getDistance(this.venues[i].lat, this.venues[i].lng, this.venues[j].lat, this.venues[j].lng);
        if (d < 500) {
          collisions.set(this.venues[i].id, { otherName: this.venues[j].name, distance: d });
          collisions.set(this.venues[j].id, { otherName: this.venues[i].name, distance: d });
        }
      }
    }

    const filtered = this.selectedZone === 'all' 
      ? this.venues 
      : this.venues.filter(v => v.zone.toLowerCase().includes(this.selectedZone.toLowerCase()));

    const activeCount = this.venues.filter(v => v.status === 'active').length;
    const conflictCount = collisions.size / 2;

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
          <div style="display: flex; gap: 8px; align-items: center;">
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
            const collision = collisions.get(v.id);
            return `
              <div style="background: ${collision ? 'rgba(155,39,72,0.12)' : 'rgba(243,237,226,0.04)'}; border: 1px solid ${collision ? 'rgba(155,39,72,0.4)' : 'var(--linea)'}; border-radius: 14px; padding: 16px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px;">
                <div>
                  <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
                    <b style="font-family: var(--font-display); font-size: 17px; color: var(--papel);">${v.name}</b>
                    <span class="chip ${v.status === 'active' ? 'verde' : 'gris'}" style="font-size: 9px; padding: 2px 7px;">${v.status === 'active' ? '● En Red' : 'Inactivo'}</span>
                    <span class="chip ambar" style="font-size: 9px; padding: 2px 7px;">📍 ${v.zone}</span>
                  </div>
                  <p style="font-size: 11.5px; color: var(--humo); font-family: var(--font-mono); margin: 0;">${v.address} · Coords: (${v.lat.toFixed(4)}, ${v.lng.toFixed(4)})</p>
                  ${collision ? `
                    <div style="margin-top: 8px; font-size: 11px; color: #ff8ca8; font-family: var(--font-mono); display: flex; align-items: center; gap: 6px;">
                      ⚠️ <b>Alerta de colisión:</b> A solo ${collision.distance}m de <u>${collision.otherName}</u> (Violación de exclusividad <500m)
                    </div>
                  ` : `
                    <div style="margin-top: 6px; font-size: 10.5px; color: var(--botella); font-family: var(--font-mono);">
                      ✓ Exclusividad territorial garantizada (> 500m)
                    </div>
                  `}
                </div>
                <div style="display: flex; gap: 8px;">
                  <button class="btn btn-toggle-venue-status" data-id="${v.id}" style="font-size: 10.5px; padding: 7px 12px; background: rgba(0,0,0,0.3); border-color: var(--linea);">
                    ${v.status === 'active' ? 'Pausar' : 'Activar'}
                  </button>
                  <a href="https://www.google.com/maps/search/?api=1&query=${v.lat},${v.lng}" target="_blank" class="btn" style="text-decoration: none; font-size: 10.5px; padding: 7px 12px; background: rgba(0,0,0,0.3); border-color: var(--linea);">
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

  private setupEventListeners() {
    // Escucha de filtros de zona
  }

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
          v.status = v.status === 'active' ? 'inactive' : 'active';
          if (DB.memoryDb?.venues?.[id]) {
            DB.memoryDb.venues[id].status = v.status;
          }
          this.render();
        }
      });
    });

    document.getElementById('btn-net-add-venue')?.addEventListener('click', async () => {
      const name = prompt('Nombre del nuevo bar aliado:');
      if (!name) return;
      const zone = prompt('Zona (Ej: Zona G, Quinta Camacho, Parque 93, Chapinero):', 'Zona G') || 'Zona G';
      const address = prompt('Dirección:', 'Calle 69 # 5-30') || 'Bogotá';
      
      // Coordenadas simuladas en Bogotá
      const newVenue: Venue = {
        id: 'v_' + Date.now(),
        name,
        address,
        zone,
        lat: 4.6540 + (Math.random() - 0.5) * 0.01,
        lng: -74.0560 + (Math.random() - 0.5) * 0.01,
        status: 'active'
      };

      if (DB.memoryDb?.venues) {
        DB.memoryDb.venues[newVenue.id] = newVenue;
      }
      this.venues.push(newVenue);
      this.render();
      await RondaDialog.alert({
        title: 'Bar Afiliado',
        message: `¡${name} ha sido agregado a la Red RONDA con control de exclusividad de 500m activado!`,
        icon: '🗺️'
      });
    });
  }
}

export const Network = new NetworkController();
