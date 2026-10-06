import { Auth } from './auth.js';
import { User } from './db.js';
import { RondaDialog } from './dialog.js';
import { renderRondaFooter } from './footer.js';
import { APP_VERSION } from './version.js';

export interface PortalConfig {
  id: 'superadmin' | 'admin' | 'crm' | 'network';
  title: string;
  subtitle: string;
  badge: string;
  icon: string;
  allowedRoles: ('superadmin' | 'admin' | 'sales' | 'network' | 'client')[];
  viewSectionId: string;
  roleDescription: string;
}

export const PORTALS: Record<string, PortalConfig> = {
  superadmin: {
    id: 'superadmin',
    title: 'Super Admin Global',
    subtitle: 'Consola Maestra de Operaciones, Ingresos Multi-Línea y Control de Permisos',
    badge: '👑 Portal SuperAdmin',
    icon: '👑',
    allowedRoles: ['superadmin'],
    viewSectionId: 'view-superadmin',
    roleDescription: 'Acceso reservado exclusivamente para la dirección y administradores generales de RONDA.'
  },
  admin: {
    id: 'admin',
    title: 'Anfitrión de Bar & Sala',
    subtitle: 'Control de Acceso en Puerta, Escaneo de QR, Liveness y Orquestación de Rondas',
    badge: '🏢 Portal Anfitrión',
    icon: '🏢',
    allowedRoles: ['admin', 'superadmin'],
    viewSectionId: 'view-admin',
    roleDescription: 'Acceso para anfitriones y personal en puerta encargado de coordinar la noche de citas.'
  },
  crm: {
    id: 'crm',
    title: 'CRM de Ventas & Expansión',
    subtitle: 'Pipeline de Afiliación de Bares · Gestión de Leads y Comisiones Fijas',
    badge: '💼 Portal Comercial',
    icon: '💼',
    allowedRoles: ['sales', 'superadmin'],
    viewSectionId: 'view-crm',
    roleDescription: 'Acceso para el equipo comercial, adquisición de sedes y comisiones por local cerrado.'
  },
  network: {
    id: 'network',
    title: 'Red de Bares Aliados',
    subtitle: 'Gestión de Cobertura y Verificación de Exclusividad Territorial (500m)',
    badge: '🗺️ Portal Red de Aliados',
    icon: '🗺️',
    allowedRoles: ['network', 'admin', 'superadmin'],
    viewSectionId: 'view-network',
    roleDescription: 'Acceso para gerentes y propietarios de venues aliados a la red RONDA.'
  }
};

/**
 * Configura la autenticación y control de acceso estricto para un portal independiente.
 */
export function setupIndependentPortal(config: PortalConfig, onReady: (user: User) => void) {
  console.log(`[PortalAuth] Configurando portal independiente: ${config.id}`);

  const authSection = document.getElementById('view-auth');
  const portalSection = document.getElementById(config.viewSectionId);

  // Inyectar el formulario de inicio de sesión dedicado al portal
  renderPortalLoginForm(config);

  Auth.onAuthStateChanged(async (user) => {
    if (!user) {
      // Sesión no iniciada: mostrar formulario de login del portal
      portalSection?.classList.remove('on');
      authSection?.classList.add('on');
      renderPortalLoginForm(config);
      return;
    }

    // Comprobar criterios de acceso / roles permitidos
    const hasAccess = config.allowedRoles.includes(user.role as any);

    if (!hasAccess) {
      console.warn(`[PortalAuth] Acceso denegado: Usuario ${user.email} con rol ${user.role} no tiene acceso a ${config.id}`);
      portalSection?.classList.remove('on');
      authSection?.classList.add('on');
      renderAccessDenied(config, user);
      return;
    }

    // Usuario autorizado
    console.log(`[PortalAuth] Usuario ${user.email} autorizado para ${config.id} (rol: ${user.role})`);
    authSection?.classList.remove('on');
    portalSection?.classList.add('on');

    // Inyectar barra superior de sesión del portal
    injectPortalHeaderBar(config, user);

    // Inyectar o actualizar footer estándar con versión
    renderRondaFooter(portalSection);

    // Inicializar controlador del panel
    onReady(user);
  });
}

function renderPortalLoginForm(config: PortalConfig) {
  const authSection = document.getElementById('view-auth');
  if (!authSection) return;

  authSection.innerHTML = `
    <div style="min-height: 80vh; display: flex; align-items: center; justify-content: center; padding: 24px 16px;">
      <div style="max-width: 440px; width: 100%; background: rgba(22, 16, 27, 0.92); border: 1px solid var(--linea); border-radius: 20px; padding: 32px 28px; box-shadow: 0 12px 40px rgba(0,0,0,0.6); backdrop-filter: blur(12px);">
        
        <!-- Header -->
        <div style="text-align: center; margin-bottom: 24px;">
          <div style="font-size: 38px; margin-bottom: 8px;">${config.icon}</div>
          <span style="display: inline-block; font-size: 10.5px; font-family: var(--font-mono); color: var(--luz); background: rgba(240,168,48,0.12); border: 1px solid rgba(240,168,48,0.3); padding: 4px 12px; border-radius: 999px; text-transform: uppercase; margin-bottom: 12px; letter-spacing: 0.08em;">
            ${config.badge}
          </span>
          <h2 style="font-family: var(--font-display); font-size: 26px; color: var(--papel); margin: 0 0 6px;">${config.title}</h2>
          <p style="font-size: 12.5px; color: var(--humo); line-height: 1.45; margin: 0;">
            ${config.roleDescription}
          </p>
        </div>

        <!-- Alerta de Roles Permitidos -->
        <div style="background: rgba(243,237,226,0.03); border: 1px dashed var(--linea); border-radius: 10px; padding: 10px 14px; margin-bottom: 20px; font-size: 11px; color: var(--humo); display: flex; align-items: center; gap: 8px;">
          <span>🔒</span>
          <span>Roles admitidos: <b style="color: var(--papel); font-family: var(--font-mono);">${config.allowedRoles.join(', ').toUpperCase()}</b></span>
        </div>

        <!-- Formulario -->
        <form id="portal-login-form" style="display: flex; flex-direction: column; gap: 14px;" onsubmit="event.preventDefault();">
          <div>
            <label style="display: block; font-size: 11px; font-family: var(--font-mono); color: var(--humo); margin-bottom: 5px;">Correo electrónico</label>
            <input type="email" id="portal-email" required placeholder="tu@correo.com" class="ronda-input" style="width: 100%; box-sizing: border-box; margin-bottom: 0;">
          </div>

          <div>
            <label style="display: block; font-size: 11px; font-family: var(--font-mono); color: var(--humo); margin-bottom: 5px;">Contraseña</label>
            <input type="password" id="portal-password" required placeholder="••••••••" class="ronda-input" style="width: 100%; box-sizing: border-box; margin-bottom: 0;">
          </div>

          <div id="portal-login-error" style="display: none; background: rgba(142,36,58,0.2); border: 1px solid var(--vino); border-radius: 8px; padding: 10px; font-size: 11.5px; color: #ff8ca8; text-align: center;"></div>

          <button type="submit" id="btn-portal-login" class="btn ambar" style="width: 100%; padding: 12px; font-size: 13px; font-weight: 700; margin-top: 6px;">
            Ingresar al Panel
          </button>
        </form>

        <!-- Enlaces inferiores -->
        <div style="margin-top: 24px; padding-top: 16px; border-top: 1px solid var(--linea); display: flex; justify-content: space-between; align-items: center; font-size: 11.5px;">
          <a href="/" style="color: var(--humo); text-decoration: none; display: flex; align-items: center; gap: 4px;">
            ← Ir a ronda.uno
          </a>
          <span style="color: rgba(243,237,226,0.4); font-family: var(--font-mono); font-size: 10px;">RONDA ${APP_VERSION}</span>
        </div>

      </div>
    </div>
  `;

  renderRondaFooter(authSection);

  const form = document.getElementById('portal-login-form');
  const btn = document.getElementById('btn-portal-login') as HTMLButtonElement;
  const errorBox = document.getElementById('portal-login-error');

  form?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = (document.getElementById('portal-email') as HTMLInputElement)?.value?.trim();
    const password = (document.getElementById('portal-password') as HTMLInputElement)?.value;

    if (!email || !password) return;

    if (errorBox) errorBox.style.display = 'none';
    if (btn) {
      btn.disabled = true;
      btn.textContent = 'Verificando credenciales…';
    }

    try {
      await Auth.loginWithEmail(email, password);
      // onAuthStateChanged se encargará de comprobar los roles
    } catch (err: any) {
      if (btn) {
        btn.disabled = false;
        btn.textContent = 'Ingresar al Panel';
      }
      if (errorBox) {
        errorBox.textContent = err.message || 'Credenciales incorrectas.';
        errorBox.style.display = 'block';
      }
    }
  });
}

function renderAccessDenied(config: PortalConfig, user: User) {
  const authSection = document.getElementById('view-auth');
  if (!authSection) return;

  const targetPanel = getAssignedPanelUrl(user.role);

  authSection.innerHTML = `
    <div style="min-height: 80vh; display: flex; align-items: center; justify-content: center; padding: 24px 16px;">
      <div style="max-width: 460px; width: 100%; background: rgba(22, 16, 27, 0.95); border: 1px solid var(--vino); border-radius: 20px; padding: 32px 28px; text-align: center; box-shadow: 0 12px 40px rgba(0,0,0,0.7);">
        
        <div style="font-size: 44px; margin-bottom: 12px;">⛔</div>
        <h3 style="font-family: var(--font-display); font-size: 24px; color: var(--papel); margin: 0 0 8px;">Acceso Denegado</h3>
        
        <p style="font-size: 13px; color: var(--humo); line-height: 1.5; margin: 0 0 18px;">
          Has iniciado sesión como <b style="color: var(--papel);">${user.email || user.name || user.uid}</b>.
        </p>

        <div style="background: rgba(142,36,58,0.18); border: 1px solid rgba(142,36,58,0.4); border-radius: 12px; padding: 14px; text-align: left; margin-bottom: 20px;">
          <div style="font-size: 11.5px; color: var(--humo); margin-bottom: 6px;">
            Tu rol actual: <span class="chip" style="background: rgba(243,237,226,0.1); color: var(--papel); font-family: var(--font-mono);">${user.role.toUpperCase()}</span>
          </div>
          <div style="font-size: 11.5px; color: var(--humo);">
            Roles requeridos para <b>${config.title}</b>: <span style="color: var(--luz); font-family: var(--font-mono);">${config.allowedRoles.join(', ').toUpperCase()}</span>
          </div>
        </div>

        <div style="display: flex; flex-direction: column; gap: 10px;">
          ${targetPanel ? `
            <a href="${targetPanel.url}" class="btn ambar" style="text-decoration: none; padding: 11px; font-size: 12px; font-weight: 700;">
              Ir a mi panel asignado (${targetPanel.name}) →
            </a>
          ` : ''}

          <button id="btn-portal-logout" class="btn" style="padding: 11px; font-size: 12px; border-color: var(--linea); background: rgba(243,237,226,0.05);">
            Cerrar sesión e ingresar con otra cuenta
          </button>

          <a href="/" style="font-size: 11.5px; color: var(--humo); text-decoration: none; margin-top: 6px;">
            Volver a la portada de RONDA
          </a>
        </div>

      </div>
    </div>
  `;

  renderRondaFooter(authSection);

  document.getElementById('btn-portal-logout')?.addEventListener('click', async () => {
    await Auth.logout();
    window.location.reload();
  });
}

function getAssignedPanelUrl(role: string): { url: string; name: string } | null {
  switch (role) {
    case 'superadmin':
      return { url: '/superadmin.html', name: 'SuperAdmin' };
    case 'admin':
      return { url: '/admin.html', name: 'Anfitrión de Bar' };
    case 'sales':
      return { url: '/crm.html', name: 'CRM Comercial' };
    case 'network':
      return { url: '/network.html', name: 'Red de Bares' };
    case 'client':
      return { url: '/', name: 'Portal de Clientes' };
    default:
      return null;
  }
}

/**
 * Inyecta una barra superior persistente con identidad de usuario y botón de logout
 */
function injectPortalHeaderBar(config: PortalConfig, user: User) {
  let nav = document.getElementById('portal-top-bar');
  if (!nav) {
    nav = document.createElement('div');
    nav.id = 'portal-top-bar';
    nav.style.cssText = `
      position: sticky; top: 0; z-index: 9999;
      background: rgba(14, 9, 18, 0.88);
      backdrop-filter: blur(14px);
      border-bottom: 1px solid var(--linea);
      padding: 10px 20px;
      display: flex; justify-content: space-between; align-items: center;
      flex-wrap: wrap; gap: 10px;
      font-family: var(--font-body);
    `;
    const targetSection = document.getElementById(config.viewSectionId);
    targetSection?.prepend(nav);
  }

  // Si es superadmin, dar acceso a saltar entre paneles
  const switcherHtml = user.role === 'superadmin' ? `
    <select id="portal-quick-switch" style="background: rgba(243,237,226,0.06); border: 1px solid var(--linea); color: var(--papel); padding: 5px 10px; border-radius: 8px; font-size: 11px; font-family: var(--font-mono); outline: none; cursor: pointer;">
      <option value="/superadmin.html" ${config.id === 'superadmin' ? 'selected' : ''}>👑 SuperAdmin</option>
      <option value="/admin.html" ${config.id === 'admin' ? 'selected' : ''}>🏢 Anfitrión Bar</option>
      <option value="/crm.html" ${config.id === 'crm' ? 'selected' : ''}>💼 CRM Ventas</option>
      <option value="/network.html" ${config.id === 'network' ? 'selected' : ''}>🗺️ Red Bares</option>
      <option value="/">🍸 Cliente</option>
    </select>
  ` : '';

  nav.innerHTML = `
    <div style="display: flex; align-items: center; gap: 12px;">
      <a href="/" style="font-family: var(--font-serif); font-size: 16px; font-weight: 700; color: var(--papel); text-decoration: none; letter-spacing: 1px;">RONDA</a>
      <span style="font-size: 11px; color: var(--humo); font-family: var(--font-mono); border-left: 1px solid var(--linea); padding-left: 10px;">
        ${config.badge}
      </span>
      ${switcherHtml}
    </div>

    <div style="display: flex; align-items: center; gap: 12px;">
      <div style="font-size: 11px; text-align: right;">
        <b style="color: var(--papel);">${user.name || user.email || user.uid}</b>
        <span style="display: block; font-size: 9.5px; color: var(--luz); font-family: var(--font-mono); text-transform: uppercase;">ROL: ${user.role}</span>
      </div>
      <button id="btn-top-logout" class="btn" style="font-size: 10.5px; padding: 6px 12px; border-color: var(--linea); background: rgba(243,237,226,0.04);">
        Cerrar sesión ✕
      </button>
    </div>
  `;

  document.getElementById('btn-top-logout')?.addEventListener('click', async () => {
    await Auth.logout();
    window.location.reload();
  });

  const switcher = document.getElementById('portal-quick-switch') as HTMLSelectElement;
  switcher?.addEventListener('change', (e) => {
    const url = (e.target as HTMLSelectElement).value;
    if (url && url !== window.location.pathname) {
      window.location.href = url;
    }
  });
}
