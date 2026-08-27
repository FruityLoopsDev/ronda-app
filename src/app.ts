import { DB } from './db.js';
import { Auth } from './auth.js';
import { RondaConfig } from './firebase-config.js';
import { ClientApp } from './client.js';
import { Verification } from './verification.js';
import { Profile } from './profile.js';
import { calculateAge, getZodiacSign } from './utils.js';
import { RondaDialog } from './dialog.js';
import { Admin } from './bar.js';
import { Network } from './network.js';
import { CRM } from './crm.js';
import { SuperAdmin } from './superadmin.js';

// app.js: Orquestador principal de la vista y eventos de RONDA

document.addEventListener('DOMContentLoaded', () => {
  // Esperar a que config.js cargue los scripts
  setTimeout(initApp, 500); 
});

function initApp() {
  console.log("Inicializando App RONDA...");
  
  // Connection Indicator Logic
  const offlineInd = document.getElementById('offline-indicator');
  const updateOnlineStatus = () => {
    if (offlineInd) {
      if (navigator.onLine) {
        offlineInd.style.display = 'none';
      } else {
        offlineInd.style.display = 'inline';
        offlineInd.textContent = '🔴 Local';
        offlineInd.style.color = '#ff5252';
      }
    }
  };
  window.addEventListener('online', () => {
    if (offlineInd) {
      offlineInd.style.display = 'inline';
      offlineInd.textContent = '🟡 Sync...';
      offlineInd.style.color = '#ffb300';
      setTimeout(() => updateOnlineStatus(), 2000);
    }
  });
  window.addEventListener('offline', updateOnlineStatus);
  updateOnlineStatus();

  // Elementos UI
  const viewAuth = document.getElementById('view-auth');
  const viewClient = document.getElementById('view-client');
  const viewAdmin = document.getElementById('view-admin');
  const userMenu = document.getElementById('user-menu');

  // Mapeo de Rutas URL para Paneles Autónomos
  function getPathViewMapping(path: string): string | null {
    const cleanPath = path.toLowerCase().replace(/\/$/, '');
    switch (cleanPath) {
      case '/admin':
        return 'view-admin';
      case '/net':
      case '/network':
        return 'view-network';
      case '/superadmin':
        return 'view-superadmin';
      case '/sales':
      case '/crm':
        return 'view-crm';
      case '/client':
      case '/ronda':
        return 'view-client';
      case '/lobby':
        return 'view-lobby';
      default:
        return null;
    }
  }

  function getViewPathMapping(viewId: string): string {
    switch (viewId) {
      case 'view-admin': return '/admin';
      case 'view-network': return '/net';
      case 'view-superadmin': return '/superadmin';
      case 'view-crm': return '/sales';
      case 'view-client': return '/client';
      case 'view-lobby': return '/';
      default: return '/';
    }
  }

  function handleUrlRouting(): boolean {
    const viewId = getPathViewMapping(window.location.pathname);
    if (viewId) {
      switchView(viewId, false);
      return true;
    }
    return false;
  }

  // Funciones de Vista
  function switchView(viewId: string, updateUrl: boolean = true) {
    document.querySelectorAll('.panel').forEach(el => el.classList.remove('on'));
    
    const activeView = document.getElementById(viewId);
    if(activeView) {
      activeView.classList.add('on');
    }

    if (updateUrl) {
      const targetPath = getViewPathMapping(viewId);
      if (window.location.pathname !== targetPath) {
        window.history.pushState({ viewId }, '', targetPath);
      }
    }

    if (viewId === 'view-admin') {
      Admin.init();
    } else if (viewId === 'view-client') {
      ClientApp.init();
    } else if (viewId === 'view-network') {
      Network.init();
    } else if (viewId === 'view-crm') {
      const user = Profile.getCurrentUser();
      CRM.init(user?.uid || 'sales1');
    } else if (viewId === 'view-superadmin') {
      SuperAdmin.init();
    } else if (viewId === 'view-lobby') {
      ClientApp.renderDiscoveryFeed();
    }
  }

  // Evento para botones atrás/adelante del navegador
  window.addEventListener('popstate', () => {
    if (!handleUrlRouting()) {
      if (Auth.currentUser) {
        updateNavbar();
      } else {
        switchView('view-auth');
      }
    }
  });

  function triggerLoginAnimation() {
    const flash = document.getElementById('login-flash');
    const wrap = document.querySelector('.wrap');
    if (flash) {
      flash.style.opacity = '1';
      setTimeout(() => {
        flash.style.opacity = '0';
      }, 500);
    }
    if (wrap) {
      wrap.classList.remove('login-anim');
      // Forzar reflow para reiniciar la animación
      void (wrap as HTMLElement).offsetWidth;
      wrap.classList.add('login-anim');
    }
  }

  // Escuchar cambio de vista dinámico
  window.addEventListener('view:switch', (e: any) => {
    switchView(e.detail);
    if (e.detail === 'view-lobby') {
      ClientApp.renderDiscoveryFeed();
    }
  });

  // Inicializar servicio de perfil
  Profile.init();

  // Event listener para volver a eventos desde el perfil
  document.getElementById('btn-back-to-events')?.addEventListener('click', () => {
    switchView('view-lobby');
    ClientApp.renderDiscoveryFeed();
  });

  function updateNavbar() {
    const user = Auth.currentUser;
    if (user && userMenu) {
      const displayName = user.name ? user.name.split(' ')[0] : (user.email ? user.email.split('@')[0] : 'Usuario');
      const initials = (user.name ? user.name.substring(0, 2) : (displayName ? displayName.substring(0, 2) : 'R')).toUpperCase();
      const avatarContent = user.photoURL 
        ? `<img src="${user.photoURL}" alt="${displayName}">`
        : `<span>${initials}</span>`;

      userMenu.innerHTML = `
        <div class="user-badge" id="btn-open-profile" title="Mi perfil" aria-label="Abrir perfil">
          <div class="user-badge-avatar">
            ${avatarContent}
          </div>
        </div>
      `;
      document.getElementById('btn-open-profile')?.addEventListener('click', () => {
        if (Auth.currentUser) {
          Profile.setCurrentUser(Auth.currentUser);
          switchView('view-profile');
        }
      });
      
      // Sincronizar datos del perfil
      Profile.setCurrentUser(user);

      // Si hay una ruta específica autónoma solicitada por URL, se respeta
      if (handleUrlRouting()) {
        return;
      }

      // Mostrar vista según el rol por defecto en '/'
      if (user.role === 'client') {
        if (user.activeEventId) {
          switchView('view-client');
        } else {
          switchView('view-lobby');
        }
      } else if (user.role === 'admin') {
        switchView('view-admin');
      } else if (user.role === 'sales') {
        switchView('view-crm');
      } else if (user.role === 'superadmin') {
        switchView('view-superadmin');
      }
    } else {
      userMenu.innerHTML = ``;
      if (!handleUrlRouting()) {
        switchView('view-auth');
      }
    }
  }

  // Ejecutar ruteo directo inicial por si el usuario entra directo a /admin, /net, /superadmin, /sales
  handleUrlRouting();

  // Control del modal de perfil
  const modalProfile = document.getElementById('modal-profile');
  
  // Botones para cerrar u omitir el modal de perfil
  document.getElementById('btn-close-modal-profile')?.addEventListener('click', () => {
    if (modalProfile) modalProfile.classList.remove('active');
  });

  document.getElementById('btn-skip-profile')?.addEventListener('click', () => {
    if (modalProfile) modalProfile.classList.remove('active');
    if (Auth.currentUser) {
      switchView('view-lobby');
    }
  });

  addEventListener('auth:needsProfile', (e: any) => {
    // Si el usuario está accediendo a un panel autónomo directo (/admin, /net, /superadmin, /sales), no mostrar el modal
    if (getPathViewMapping(window.location.pathname)) {
      return;
    }
    if (modalProfile) modalProfile.classList.add('active');
    const user = e.detail;
    if (user) {
      const nameInput = document.getElementById('profile-name') as HTMLInputElement;
      const ageInput = document.getElementById('profile-age') as HTMLInputElement;
      const genderInput = document.getElementById('profile-gender') as HTMLSelectElement;
      const orientationInput = document.getElementById('profile-orientation') as HTMLSelectElement;

      if (nameInput) nameInput.value = user.name || '';
      if (ageInput) ageInput.value = user.age || '';
      if (genderInput) genderInput.value = user.gender || '';
      if (orientationInput) orientationInput.value = user.orientation || '';
    }
  });

  const btnSaveProfile = document.getElementById('btn-save-profile');
  if (btnSaveProfile) {
    btnSaveProfile.addEventListener('click', async () => {
      const nameInput = document.getElementById('profile-name') as HTMLInputElement;
      const ageInput = document.getElementById('profile-age') as HTMLInputElement;
      const genderInput = document.getElementById('profile-gender') as HTMLSelectElement;
      const orientationInput = document.getElementById('profile-orientation') as HTMLSelectElement;

      const name = nameInput ? nameInput.value.trim() : 'Usuario RONDA';
      const age = ageInput ? (parseInt(ageInput.value, 10) || 25) : 25;
      const gender = genderInput ? genderInput.value || 'X' : 'X';
      const orientation = orientationInput ? orientationInput.value || 'A' : 'A';

      btnSaveProfile.textContent = "Guardando...";

      try {
        const user = Auth.currentUser || { uid: 'guest', role: 'client' } as any;
        user.name = name || 'Usuario RONDA';
        user.age = age;
        user.gender = gender;
        user.orientation = orientation;

        if (Auth.currentUser) {
          await DB.saveUser(user);
        }
        if (modalProfile) modalProfile.classList.remove('active');
        
        dispatchEvent(new CustomEvent('auth:login', { detail: user }));
      } catch (err: any) {
        console.error("Error al guardar perfil:", err);
        if (modalProfile) modalProfile.classList.remove('active');
      } finally {
        btnSaveProfile.textContent = "Guardar Perfil";
      }
    });
  }

  const btnStartKyc = document.getElementById('btn-start-kyc');
  if (btnStartKyc) {
    btnStartKyc.addEventListener('click', async () => {
      const kycVideo = document.getElementById('kyc-video');
      const kycCanvas = document.getElementById('kyc-canvas');
      if (kycVideo) kycVideo.style.display = 'block';
      if (kycCanvas) kycCanvas.style.display = 'block';
      const kycStatus = document.getElementById('kyc-status');
      (btnStartKyc as HTMLButtonElement).disabled = true;
      btnStartKyc.textContent = "Verificando...";
      try {
        // startVerification es robusto: maneja el flujo, muestra el estado en kyc-status
        // y devuelve boolean sin lanzar (salvo fallo imprevisto).
        const isVerified = await Verification.startVerification('kyc-video', 'kyc-canvas');
        if (isVerified) {
          if (kycStatus) {
            kycStatus.textContent = "✓ Identidad verificada. Ya puedes guardar tu perfil.";
            kycStatus.style.color = "var(--botella)";
          }
          btnSaveProfile.disabled = false;
        }
      } catch (err) {
        console.error("KYC Error inesperado:", err);
        if (kycStatus) {
          kycStatus.textContent = "Ocurrió un error inesperado. Inténtalo de nuevo.";
          kycStatus.style.color = "var(--vino)";
        }
      } finally {
        (btnStartKyc as HTMLButtonElement).disabled = false;
        btnStartKyc.textContent = "Iniciar Verificación KYC";
      }
    });
  }

  // Control del check-in (unirse a un evento)
  const btnJoinEvent = document.getElementById('btn-join-event');
  if (btnJoinEvent) {
    btnJoinEvent.addEventListener('click', async () => {
      const code = document.getElementById('event-code').value.trim().toLowerCase();
      if (!code) {
        alert("Por favor ingresa un código de evento.");
        return;
      }

      btnJoinEvent.textContent = "Uniendo...";
      btnJoinEvent.disabled = true;

      try {
        const user = Auth.currentUser;
        const eventDoc = await DB.getEvent(code);
        if (!eventDoc) {
          alert(`El evento con código "${code}" no existe. Pídelo al anfitrión.`);
          return;
        }

        if (!user.hasTicket && !RondaConfig.isDemo) {
          // Mostrar widget de pago Wompi si no tiene ticket
          document.getElementById('wompi-container').style.display = 'block';
          btnJoinEvent.style.display = 'none';
          document.getElementById('event-code').disabled = true;
          alert("Debes adquirir tu pase para ingresar a esta sala. Procesa el pago con Wompi abajo.");
          return;
        }

        await DB.joinEvent(code, user.uid);
        user.activeEventId = code;
        
        updateNavbar();
        
        if (ClientApp) {
          ClientApp.initClientDashboard(user);
        }
      } catch (err) {
        console.error("Error uniéndose al evento:", err);
        alert("Error al unirse: " + err.message);
      } finally {
        if (!document.getElementById('wompi-container') || document.getElementById('wompi-container').style.display !== 'block') {
          btnJoinEvent.textContent = "Unirse a la Ronda";
          btnJoinEvent.disabled = false;
        }
      }
    });
  }

  // Event Listeners UI Login
  // Event Listeners UI Login & Auth
  const loginForm = document.getElementById('login-form');
  const registerForm = document.getElementById('register-form');
  const regStep1 = document.getElementById('reg-step-1');
  const regStep2 = document.getElementById('reg-step-2');

  const btnRealLogin = document.getElementById('btn-real-login');
  if (btnRealLogin) {
    btnRealLogin.addEventListener('click', () => {
      const email = (document.getElementById('login-email') as HTMLInputElement).value;
      const password = (document.getElementById('login-password') as HTMLInputElement).value;
      if (email && password) {
        btnRealLogin.textContent = 'Cargando...';
        (btnRealLogin as HTMLButtonElement).disabled = true;
        Auth.loginWithEmail(email, password).then(() => {
          triggerLoginAnimation();
        }).catch(err => {
          alert("Error: " + err.message);
        }).finally(() => {
          btnRealLogin.textContent = 'Ingresar';
          (btnRealLogin as HTMLButtonElement).disabled = false;
        });
      } else {
        alert("Por favor, ingresa correo y contraseña.");
      }
    });
  }

  // Registration UI Toggles
  document.getElementById('btn-show-register')?.addEventListener('click', () => {
    if (loginForm && registerForm) {
      loginForm.style.display = 'none';
      registerForm.style.display = 'flex';
      if (regStep1) regStep1.style.display = 'block';
      if (regStep2) regStep2.style.display = 'none';
    }
  });

  document.getElementById('btn-show-login')?.addEventListener('click', () => {
    if (loginForm && registerForm) {
      registerForm.style.display = 'none';
      loginForm.style.display = 'flex';
    }
  });

  document.getElementById('btn-next-step')?.addEventListener('click', () => {
    const email = (document.getElementById('reg-email') as HTMLInputElement).value;
    const password = (document.getElementById('reg-password') as HTMLInputElement).value;
    if (email && password) {
      if (regStep1 && regStep2) {
        regStep1.style.display = 'none';
        regStep2.style.display = 'block';
      }
    } else {
      alert("Ingresa email y contraseña para continuar.");
    }
  });

  // Cálculo en vivo de edad y signo zodiacal en el registro
  const regBirthInput = document.getElementById('reg-birthdate') as HTMLInputElement;
  const regZodiacPreview = document.getElementById('reg-zodiac-preview');

  if (regBirthInput && regZodiacPreview) {
    const updateZodiacBadge = () => {
      const birthDate = regBirthInput.value;
      if (!birthDate) {
        regZodiacPreview.style.display = 'none';
        return;
      }
      const age = calculateAge(birthDate);
      const zodiac = getZodiacSign(birthDate);

      if (age < 18) {
        regZodiacPreview.style.display = 'flex';
        regZodiacPreview.style.color = 'var(--vino)';
        regZodiacPreview.style.background = 'rgba(155,39,72,.15)';
        regZodiacPreview.style.borderColor = 'rgba(155,39,72,.4)';
        regZodiacPreview.innerHTML = `⚠️ Edad: ${age} años (Debes tener al menos 18 años para ingresar a RONDA)`;
      } else {
        regZodiacPreview.style.display = 'flex';
        regZodiacPreview.style.color = 'var(--luz)';
        regZodiacPreview.style.background = 'rgba(240,168,48,0.12)';
        regZodiacPreview.style.borderColor = 'rgba(240,168,48,0.3)';
        regZodiacPreview.innerHTML = `🎂 <b>${age} años</b> &nbsp;·&nbsp; ${zodiac.emoji}`;
      }
    };

    regBirthInput.addEventListener('input', updateZodiacBadge);
    regBirthInput.addEventListener('change', updateZodiacBadge);
  }

  document.getElementById('btn-real-register')?.addEventListener('click', async () => {
    const email = (document.getElementById('reg-email') as HTMLInputElement).value;
    const password = (document.getElementById('reg-password') as HTMLInputElement).value;
    const name = (document.getElementById('reg-name') as HTMLInputElement).value.trim();
    const birthDate = (document.getElementById('reg-birthdate') as HTMLInputElement).value;
    const gender = (document.getElementById('reg-gender') as HTMLSelectElement).value;
    const orientation = (document.getElementById('reg-interest') as HTMLSelectElement).value;

    if (!name || !birthDate || !gender || !orientation) {
      await RondaDialog.alert({
        title: 'Datos Requeridos',
        message: 'Por favor completa todos los datos para crear tu perfil de citas.',
        icon: '📝'
      });
      return;
    }

    const age = calculateAge(birthDate);
    if (age < 18) {
      await RondaDialog.alert({
        title: 'Edad Mínima',
        message: 'Debes tener al menos 18 años para crear una cuenta y participar en las noches RONDA.',
        icon: '🔞',
        type: 'danger'
      });
      return;
    }

    const zodiac = getZodiacSign(birthDate);

    const btn = document.getElementById('btn-real-register') as HTMLButtonElement;
    btn.textContent = 'Creando cuenta...';
    btn.disabled = true;

    Auth.registerWithEmail(email, password, { 
      name, 
      birthDate,
      zodiacSign: zodiac.emoji,
      age, 
      gender, 
      orientation 
    }).then((user) => {
      // Successfully registered.
      triggerLoginAnimation();
    }).catch(async (err) => {
      await RondaDialog.alert({
        title: 'Error de Registro',
        message: 'No se pudo crear la cuenta: ' + err.message,
        icon: '⚠️',
        type: 'danger'
      });
    }).finally(() => {
      btn.textContent = 'Crear Cuenta y Entrar';
      btn.disabled = false;
    });
  });

  // Event Listeners Auth State
  addEventListener('auth:login', updateNavbar);
  addEventListener('auth:logout', updateNavbar);

  // Navegación (para demostración de multi-rol, aunque idealmente están separados por permisos)
  document.getElementById('nav-client')?.addEventListener('click', () => {
    const user = Auth.currentUser;
    if (user) {
      if (user.activeEventId) {
        switchView('view-client');
      } else {
        switchView('view-lobby');
      }
    }
  });
  document.getElementById('nav-admin')?.addEventListener('click', () => switchView('view-admin'));
}
