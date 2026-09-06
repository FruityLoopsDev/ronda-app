import { DB } from './db.js';
import { RondaDialog } from './dialog.js';
import { Auth } from './auth.js';

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
      </div>
    `;

    this.attachListeners();
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
  }
}

export const SuperAdmin = new SuperAdminController();
