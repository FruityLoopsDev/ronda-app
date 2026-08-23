// app.js: Orquestador principal de la vista y eventos de RONDA

document.addEventListener('DOMContentLoaded', () => {
  // Esperar a que config.js cargue los scripts
  setTimeout(initApp, 500); 
});

function initApp() {
  console.log("Inicializando App RONDA...");
  
  // Elementos UI
  const viewAuth = document.getElementById('view-auth');
  const viewClient = document.getElementById('view-client');
  const viewAdmin = document.getElementById('view-admin');
  const roleNav = document.getElementById('role-nav');
  const btnLogin = document.getElementById('btn-login');
  const btnDemoLogin = document.getElementById('btn-demo-login');
  const btnDemoHost = document.getElementById('btn-demo-host');
  const userMenu = document.getElementById('user-menu');
  const tabs = [...document.querySelectorAll('.tab')];

  // Funciones de Vista
  function switchView(viewId) {
    document.querySelectorAll('.panel').forEach(el => el.classList.remove('on'));
    
    const activeView = document.getElementById(viewId);
    if(activeView) {
      activeView.classList.add('on');
    }

    // Actualizar aria-selected en los tabs
    tabs.forEach(tab => {
      const isMatch = tab.id.replace('nav-', 'view-') === viewId;
      tab.setAttribute('aria-selected', isMatch);
    });
  }

  function updateNavbar() {
    if (window.Auth.currentUser) {
      roleNav.style.display = 'flex';
      userMenu.innerHTML = `<span style="font-family: 'JetBrains Mono', monospace; font-size: 11px; margin-right: 14px; align-self: center; color: var(--humo);">Hola, ${window.Auth.currentUser.name}</span> <button id="btn-logout" class="btn-mini">Salir</button>`;
      document.getElementById('btn-logout').addEventListener('click', () => window.Auth.logout());
      
      // Mostrar vista según el rol
      if (window.Auth.currentUser.role === 'client') {
        switchView('view-client');
      } else if (window.Auth.currentUser.role === 'admin') {
        switchView('view-admin');
      }
    } else {
      roleNav.style.display = 'none';
      userMenu.innerHTML = `<button id="btn-login" class="btn-mini pri">Ingresar</button>`;
      switchView('view-auth');
    }
  }

  // Event Listeners UI Login
  if (btnDemoLogin) btnDemoLogin.addEventListener('click', () => window.Auth.loginDemoUser('client'));
  if (btnDemoHost) btnDemoHost.addEventListener('click', () => window.Auth.loginDemoUser('admin'));

  // Event Listeners Auth State
  window.addEventListener('auth:login', updateNavbar);
  window.addEventListener('auth:logout', updateNavbar);

  // Navegación (para demostración de multi-rol, aunque idealmente están separados por permisos)
  document.getElementById('nav-client').addEventListener('click', () => switchView('view-client'));
  document.getElementById('nav-admin').addEventListener('click', () => switchView('view-admin'));
}
