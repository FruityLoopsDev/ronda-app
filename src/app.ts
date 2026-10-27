import { DB, User } from './db.js';
import { Auth } from './auth.js';
import { ClientApp } from './client.js';
import { Verification } from './verification.js';
import { Profile } from './profile.js';
import { calculateAge, getZodiacSign } from './utils.js';
import { RondaDialog } from './dialog.js';
import { Icebreakers } from './icebreakers.js';
import { Satisfaction } from './satisfaction.js';
import notifications from './notifications.js';
import { renderRondaFooter } from './footer.js';
// app.js: Orquestador principal de la vista y eventos de RONDA
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}

function initApp() {
  console.log("Inicializando App RONDA...");
  notifications.init();
  renderRondaFooter();
  
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
  const userMenu = document.getElementById('user-menu');

  // Mapeo de Rutas URL para Paneles Autónomos
  function getPathViewMapping(path: string): string | null {
    const cleanPath = path.toLowerCase().replace(/\/$/, '');
    switch (cleanPath) {
      
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
        try {
          window.history.pushState({ viewId }, '', targetPath);
        } catch(e) {
          console.warn('history.pushState falló (entorno local probable)', e);
        }
      }
    }

    if (viewId === 'view-client') {
      ClientApp.init();
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

  // Escuchar evento de login para persistencia
  window.addEventListener('auth:login', () => {
    updateNavbar();
  });

  // Refrescar avatar/iniciales en navbar cuando el perfil se edita sin cambiar la vista activa
  window.addEventListener('profile:updated', () => {
    renderNavbarBadgeOnly();
  });

  // Inicializar servicio de perfil
  Profile.init();
  Icebreakers.init();
  Satisfaction.init();

  // Event listener para volver a eventos desde el perfil
  document.getElementById('btn-back-to-events')?.addEventListener('click', () => {
    switchView('view-lobby');
    ClientApp.renderDiscoveryFeed();
  });

  function renderNavbarBadgeOnly() {
    const user = Auth.currentUser;
    if (user && userMenu) {
      const displayName = user.name ? user.name.split(' ')[0] : (user.email ? user.email.split('@')[0] : 'Usuario');
      const initials = (user.name ? user.name.substring(0, 2) : (displayName ? displayName.substring(0, 2) : 'R')).toUpperCase();
      const avatarContent = user.photoURL 
        ? `<img src="${user.photoURL}" alt="${displayName}">`
        : `<span>${initials}</span>`;

      userMenu.innerHTML = `
        <div class="notification-bell" id="btn-notifications" title="Notificaciones">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path><path d="M13.73 21a2 2 0 0 1-3.46 0"></path></svg>
          <span class="notification-badge" id="notification-badge" style="display:none;">0</span>
        </div>
        <div class="user-badge" id="btn-open-profile" title="Mi perfil" aria-label="Abrir perfil">
          <div class="user-badge-avatar">
            ${avatarContent}
          </div>
        </div>
      `;
      document.getElementById('btn-notifications')?.addEventListener('click', () => {
        if((window as any).Notifications) (window as any).Notifications.togglePanel();
      });
      document.getElementById('btn-open-profile')?.addEventListener('click', () => {
        if (Auth.currentUser) {
          Profile.setCurrentUser(Auth.currentUser);
          switchView('view-profile');
        }
      });
    }
  }

  function updateNavbar() {
    const user = Auth.currentUser;
    if (user && userMenu) {
      renderNavbarBadgeOnly();
      
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
      if (userMenu) userMenu.innerHTML = ``;
      if (!handleUrlRouting()) {
        switchView('view-auth');
      }
    }
  }

  // Inicializar estado visual de navbar y vistas
  updateNavbar();
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
    // No mostrar el modal automáticamente si view-auth está activo (sesión de Firebase previa con perfil incompleto).
    // El usuario debe pasar por login/registro primero.
    if (viewAuth && viewAuth.classList.contains('on')) {
      return;
    }
    if (modalProfile) modalProfile.classList.add('active');
    const user = e.detail;
    if (user) {
      const nameInput = document.getElementById('profile-name') as HTMLInputElement;
      const ageInput = document.getElementById('profile-age') as HTMLInputElement;
      const genderInput = document.getElementById('profile-gender') as HTMLSelectElement;
      const orientationInput = document.getElementById('profile-orientation') as HTMLSelectElement;
      const linkedinInput = document.getElementById('profile-linkedin') as HTMLInputElement;

      if (nameInput) nameInput.value = user.name || '';
      if (ageInput) ageInput.value = user.age || '';
      if (genderInput) genderInput.value = user.gender || '';
      if (orientationInput) orientationInput.value = user.orientation || '';
      if (linkedinInput) linkedinInput.value = user.linkedinUrl || '';

      const saveBtn = document.getElementById('btn-save-profile') as HTMLButtonElement | null;
      if (saveBtn) saveBtn.disabled = false;
    }
  });

  // Verificación de LinkedIn en modal de perfil
  const btnVerifyProfileLinkedin = document.getElementById('btn-verify-profile-linkedin') as HTMLButtonElement | null;
  const linkedinStatus = document.getElementById('linkedin-verify-status');
  btnVerifyProfileLinkedin?.addEventListener('click', async () => {
    const linkedinInput = document.getElementById('profile-linkedin') as HTMLInputElement;
    const url = (linkedinInput?.value || '').trim();
    if (!url) {
      if (linkedinStatus) {
        linkedinStatus.textContent = '⚠️ Ingresa tu URL de LinkedIn para validar tu perfil.';
        linkedinStatus.style.color = 'var(--vino)';
      }
      return;
    }

    if (linkedinStatus) {
      linkedinStatus.textContent = '⏳ Verificando perfil profesional con LinkedIn...';
      linkedinStatus.style.color = 'var(--luz)';
    }
    btnVerifyProfileLinkedin.disabled = true;

    const user = Auth.currentUser;
    const result = await Verification.verifyLinkedInProfile(url, { name: user?.name, email: user?.email });
    btnVerifyProfileLinkedin.disabled = false;

    if (result.success && result.data) {
      linkedinInput.value = result.data.url;
      if (linkedinStatus) {
        linkedinStatus.textContent = `✓ ${result.data.badge} · ${result.data.headline}`;
        linkedinStatus.style.color = 'var(--botella)';
      }
      const saveBtn = document.getElementById('btn-save-profile') as HTMLButtonElement | null;
      if (saveBtn) saveBtn.disabled = false;
      if (user) {
        user.linkedinUrl = result.data.url;
        user.linkedinVerified = true;
        user.linkedinSlug = result.data.slug;
        user.linkedinHeadline = result.data.headline;
      }
    } else {
      if (linkedinStatus) {
        linkedinStatus.textContent = `✕ ${result.error || 'No se pudo verificar el perfil.'}`;
        linkedinStatus.style.color = 'var(--vino)';
      }
    }
  });

  const btnSaveProfile = document.getElementById('btn-save-profile') as HTMLButtonElement;
  if (btnSaveProfile) {
    btnSaveProfile.addEventListener('click', async () => {
      const nameInput = document.getElementById('profile-name') as HTMLInputElement;
      const ageInput = document.getElementById('profile-age') as HTMLInputElement;
      const genderInput = document.getElementById('profile-gender') as HTMLSelectElement;
      const orientationInput = document.getElementById('profile-orientation') as HTMLSelectElement;
      const linkedinInput = document.getElementById('profile-linkedin') as HTMLInputElement;

      const name = nameInput ? nameInput.value.trim() : 'Usuario RONDA';
      const age = ageInput ? (parseInt(ageInput.value, 10) || 25) : 25;
      const gender = genderInput ? genderInput.value || 'X' : 'X';
      const orientation = orientationInput ? orientationInput.value || 'A' : 'A';
      const linkedinUrl = linkedinInput ? linkedinInput.value.trim() : '';

      btnSaveProfile.textContent = "Guardando...";

      try {
        const user = Auth.currentUser || { uid: 'guest', role: 'client' };
        const patch: Partial<User> = {
          name: name || 'Usuario RONDA',
          age,
          gender,
          orientation
        };

        if (linkedinUrl) {
          const val = Verification.validateLinkedInUrl(linkedinUrl);
          patch.linkedinUrl = val.valid ? val.normalizedUrl : linkedinUrl;
          if (val.valid) {
            patch.linkedinVerified = true;
            patch.linkedinSlug = val.slug;
            if (user.linkedinHeadline) patch.linkedinHeadline = user.linkedinHeadline;
          }
        }

        // Persistir el estado de verificación biométrica de identidad si fue completado.
        if (Verification.isVerified) {
          patch.isVerified = true;
        }

        Object.assign(user, patch);

        if (Auth.currentUser) {
          await DB.updateUserProfile(user.uid, patch);
          Object.assign(Auth.currentUser, patch);
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
  const btnJoinEvent = document.getElementById('btn-join-event') as HTMLButtonElement;
  if (btnJoinEvent) {
    btnJoinEvent.addEventListener('click', async () => {
      const codeInput = document.getElementById('event-code') as HTMLInputElement;
      const code = codeInput ? codeInput.value.trim().toLowerCase() : '';
      if (!code) {
        await RondaDialog.alert({ title: 'Código requerido', message: 'Por favor ingresa un código de evento.', icon: '🏷️' });
        return;
      }

      btnJoinEvent.textContent = "Uniendo...";
      btnJoinEvent.disabled = true;

      try {
        const user = Auth.currentUser;
        if (!user) {
          await RondaDialog.alert({ title: 'Sesión requerida', message: 'Debes iniciar sesión para unirte a una ronda.', icon: '🔒' });
          return;
        }
        const eventDoc = await DB.getEvent(code);
        if (!eventDoc) {
          await RondaDialog.alert({ title: 'Evento no encontrado', message: `El evento con código "${code}" no existe. Pídelo al anfitrión.`, icon: '🔍' });
          return;
        }

        if (!user.hasTicket && !user.paymentPending) {
          // Sin pase: bloquear el ingreso hasta pagar con Nequi (verificación manual)
          btnJoinEvent.style.display = 'none';
          const codeInput = document.getElementById('event-code') as HTMLInputElement;
          if (codeInput) codeInput.disabled = true;
          await RondaDialog.alert({ title: 'Pase requerido', message: 'Debes adquirir tu pase para ingresar a esta sala. Realiza el pago con Nequi desde la cartelera de eventos.', icon: '🎟️' });
          return;
        }

        user.activeEventId = code;
        await DB.updateUserProfile(user.uid, { activeEventId: code });

        updateNavbar();
        
        if (ClientApp) {
          ClientApp.initClientDashboard(user);
        }
      } catch (err) {
        console.error("Error uniéndose al evento:", err);
        await RondaDialog.alert({ title: 'Error al unirse', message: ((err as Error).message || String(err)), icon: '⚠️', type: 'danger' });
      } finally {
        btnJoinEvent.textContent = "Unirse a la Ronda";
        btnJoinEvent.disabled = false;
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
          updateNavbar();
          switchView('view-lobby');
          ClientApp.renderDiscoveryFeed();
        }).catch(async (err) => {
          await RondaDialog.alert({
            title: 'Error de Acceso',
            message: err.message || 'No se pudo iniciar sesión. Verifica tus credenciales.',
            icon: '🔒',
            type: 'danger'
          });
        }).finally(() => {
          btnRealLogin.textContent = 'Ingresar';
          (btnRealLogin as HTMLButtonElement).disabled = false;
        });
      } else {
        RondaDialog.alert({
          title: 'Campos Requeridos',
          message: 'Por favor, ingresa correo y contraseña.',
          icon: '📝'
        });
      }
    });
  }

  // Registration UI Toggles
  const showRegisterView = () => {
    if (loginForm && registerForm) {
      loginForm.style.display = 'none';
      registerForm.style.display = 'flex';
      if (regStep1) regStep1.style.display = 'block';
      if (regStep2) regStep2.style.display = 'none';
    }
  };

  const showLoginView = () => {
    if (loginForm && registerForm) {
      registerForm.style.display = 'none';
      loginForm.style.display = 'flex';
    }
  };

  document.getElementById('btn-show-register')?.addEventListener('click', showRegisterView);
  document.getElementById('btn-show-login')?.addEventListener('click', showLoginView);

  // Auto-open register form if arriving from landing with #register or #registro
  if (window.location.hash === '#register' || window.location.hash === '#registro' || window.location.search.includes('register')) {
    showRegisterView();
  }
  window.addEventListener('hashchange', () => {
    if (window.location.hash === '#register' || window.location.hash === '#registro') {
      showRegisterView();
    } else if (window.location.hash === '#login') {
      showLoginView();
    }
  });

  // Generador de contraseñas seguras y toggle de visibilidad
  const regPasswordInput = document.getElementById('reg-password') as HTMLInputElement;
  const btnToggleRegPwd = document.getElementById('btn-toggle-reg-password');
  const btnGenSecurePwd = document.getElementById('btn-generate-secure-password');
  const pwdCopiedBadge = document.getElementById('reg-pwd-copied');

  btnToggleRegPwd?.addEventListener('click', () => {
    if (!regPasswordInput) return;
    const isPassword = regPasswordInput.type === 'password';
    regPasswordInput.type = isPassword ? 'text' : 'password';
    btnToggleRegPwd.textContent = isPassword ? '🙈' : '👁️';
  });

  btnGenSecurePwd?.addEventListener('click', async () => {
    if (!regPasswordInput) return;
    
    // Generar contraseña de alta entropía (14 caracteres)
    const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
    const lower = 'abcdefghijkmnopqrstuvwxyz';
    const numbers = '23456789';
    const symbols = '!@#$%&*';
    const all = upper + lower + numbers + symbols;

    const getRandomChar = (charset: string) => charset[Math.floor(Math.random() * charset.length)];

    let generated = [
      getRandomChar(upper),
      getRandomChar(lower),
      getRandomChar(numbers),
      getRandomChar(symbols)
    ];

    for (let i = 4; i < 14; i++) {
      generated.push(getRandomChar(all));
    }

    // Mezclar caracteres aleatoriamente
    const securePassword = generated.sort(() => 0.5 - Math.random()).join('');

    regPasswordInput.value = securePassword;
    regPasswordInput.type = 'text'; // Mostrar para que el usuario la vea claramente
    if (btnToggleRegPwd) btnToggleRegPwd.textContent = '🙈';

    // Copiar al portapapeles
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(securePassword);
      }
      if (pwdCopiedBadge) {
        pwdCopiedBadge.style.display = 'inline';
        setTimeout(() => { pwdCopiedBadge.style.display = 'none'; }, 3500);
      }
    } catch {
      // Fallback si el portapapeles no tiene permisos
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
      RondaDialog.alert({ title: 'Credenciales incompletas', message: 'Ingresa email y contraseña para continuar con tu registro.', icon: '🔐' });
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
    const linkedinUrl = ((document.getElementById('reg-linkedin') as HTMLInputElement)?.value || '').trim();

    if (!name || !birthDate || !gender || !orientation) {
      await RondaDialog.alert({
        title: 'Datos Incompletos',
        message: 'Por favor completa tu nombre, fecha de nacimiento, género y a quién buscas conocer para crear tu cuenta.',
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

    let profilePayload: Partial<User> = {
      name,
      birthDate,
      zodiacSign: zodiac.emoji,
      age,
      gender,
      orientation
    };

    if (linkedinUrl) {
      const linkedinValidation = Verification.validateLinkedInUrl(linkedinUrl);
      if (!linkedinValidation.valid) {
        btn.textContent = 'Crear Cuenta y Entrar';
        btn.disabled = false;
        await RondaDialog.alert({
          title: 'Perfil de LinkedIn No Válido',
          message: linkedinValidation.error || 'Ingresa una URL válida de LinkedIn (ej. https://linkedin.com/in/tu-perfil) o deja el campo vacío.',
          icon: '💼',
          type: 'alert'
        });
        return;
      }
      btn.textContent = 'Verificando LinkedIn y creando cuenta...';
      const linkedinResult = await Verification.verifyLinkedInProfile(linkedinUrl, { name, email });
      profilePayload = {
        ...profilePayload,
        linkedinUrl: linkedinValidation.normalizedUrl,
        linkedinVerified: true,
        linkedinSlug: linkedinValidation.slug,
        linkedinHeadline: linkedinResult.data?.headline
      };
    }

    Auth.registerWithEmail(email, password, profilePayload).then(() => {
      // Successfully registered.
      triggerLoginAnimation();
      updateNavbar();
      switchView('view-lobby');
      ClientApp.renderDiscoveryFeed();
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

  // Toggle entre Lista de Espera y Login Interno protegido por PIN
  const waitlistContainer = document.getElementById('waitlist-container');
  const btnToggleAdminLogin = document.getElementById('btn-toggle-admin-login');
  const btnBackToWaitlist = document.getElementById('btn-back-to-waitlist');
  const modalPin = document.getElementById('modal-pin-access');
  const pinDigits = Array.from(document.querySelectorAll<HTMLInputElement>('.pin-digit'));
  const pinErrorMsg = document.getElementById('pin-error-msg');
  const btnPinCancel = document.getElementById('btn-pin-cancel');
  const btnPinSubmit = document.getElementById('btn-pin-submit');
  const pinContainer = document.getElementById('pin-inputs-container');

  const openPinModal = () => {
    if (!modalPin) return;
    modalPin.classList.add('active');
    if (pinErrorMsg) pinErrorMsg.style.display = 'none';
    pinDigits.forEach(input => {
      input.value = '';
      input.classList.remove('pin-error', 'pin-success');
    });
    setTimeout(() => pinDigits[0]?.focus(), 60);
  };

  const closePinModal = () => {
    if (!modalPin) return;
    modalPin.classList.remove('active');
    pinDigits.forEach(input => input.value = '');
    if (pinErrorMsg) pinErrorMsg.style.display = 'none';
  };

  const verifyPin = () => {
    const enteredPin = pinDigits.map(input => input.value).join('');
    if (enteredPin.length < 4) {
      if (pinErrorMsg) {
        pinErrorMsg.textContent = 'Ingresa los 4 dígitos del PIN';
        pinErrorMsg.style.display = 'block';
      }
      return;
    }

    // PINs autorizados: 2026 (año de lanzamiento / por defecto) o 1234 o personalizado
    const customPin = localStorage.getItem('ronda_staff_pin') || '2026';
    const isAuthorized = enteredPin === '2026' || enteredPin === '1234' || enteredPin === customPin;

    if (isAuthorized) {
      pinDigits.forEach(input => input.classList.add('pin-success'));
      if (pinErrorMsg) pinErrorMsg.style.display = 'none';
      setTimeout(() => {
        closePinModal();
        if (waitlistContainer) waitlistContainer.style.display = 'none';
        if (loginForm) {
          loginForm.style.display = 'flex';
          const loginEmail = document.getElementById('login-email') as HTMLInputElement;
          loginEmail?.focus();
        }
      }, 220);
    } else {
      if (pinContainer) {
        pinContainer.classList.remove('pin-shake');
        void pinContainer.offsetWidth; // Forzar reflow para re-disparar animación
        pinContainer.classList.add('pin-shake');
      }
      pinDigits.forEach(input => {
        input.classList.add('pin-error');
        input.value = '';
      });
      if (pinErrorMsg) {
        pinErrorMsg.textContent = 'PIN incorrecto. Intenta nuevamente.';
        pinErrorMsg.style.display = 'block';
      }
      setTimeout(() => {
        pinDigits.forEach(input => input.classList.remove('pin-error'));
        pinDigits[0]?.focus();
      }, 350);
    }
  };

  btnToggleAdminLogin?.addEventListener('click', (e) => {
    e.preventDefault();
    openPinModal();
  });

  btnPinCancel?.addEventListener('click', closePinModal);
  btnPinSubmit?.addEventListener('click', verifyPin);

  modalPin?.addEventListener('click', (e) => {
    if (e.target === modalPin) closePinModal();
  });

  // Manejo de eventos en inputs de PIN (auto-avance, retroceso, pegado)
  pinDigits.forEach((input, idx) => {
    input.addEventListener('input', (e) => {
      const target = e.target as HTMLInputElement;
      const cleanVal = target.value.replace(/\D/g, '').slice(-1);
      target.value = cleanVal;
      if (cleanVal) {
        if (idx < pinDigits.length - 1) {
          pinDigits[idx + 1].focus();
        } else {
          verifyPin();
        }
      }
    });

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Backspace' && !input.value && idx > 0) {
        pinDigits[idx - 1].focus();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        verifyPin();
      } else if (e.key === 'Escape') {
        closePinModal();
      }
    });

    input.addEventListener('paste', (e) => {
      e.preventDefault();
      const pastedData = e.clipboardData?.getData('text') || '';
      const numbers = pastedData.replace(/\D/g, '').slice(0, 4);
      if (numbers) {
        numbers.split('').forEach((num, i) => {
          if (pinDigits[i]) pinDigits[i].value = num;
        });
        if (numbers.length === 4) {
          verifyPin();
        } else if (pinDigits[numbers.length]) {
          pinDigits[numbers.length].focus();
        }
      }
    });
  });

  btnBackToWaitlist?.addEventListener('click', () => {
    if (loginForm) loginForm.style.display = 'none';
    if (waitlistContainer) waitlistContainer.style.display = 'block';
  });

  // Envío de Lista de Espera desde app
  const btnSubmitAuthWl = document.getElementById('btn-submit-auth-waitlist');
  btnSubmitAuthWl?.addEventListener('click', async () => {
    const name = (document.getElementById('auth-wl-name') as HTMLInputElement)?.value.trim();
    const linkedin = (document.getElementById('auth-wl-linkedin') as HTMLInputElement)?.value.trim();
    const phone = (document.getElementById('auth-wl-phone') as HTMLInputElement)?.value.trim();
    const email = (document.getElementById('auth-wl-email') as HTMLInputElement)?.value.trim();

    if (!name || !linkedin || !phone || !email) {
      await RondaDialog.alert({
        title: 'Datos Requeridos',
        message: 'Por favor completa todos los campos para ingresar a la lista de espera.',
        icon: '📝'
      });
      return;
    }

    const btn = btnSubmitAuthWl as HTMLButtonElement;
    btn.textContent = 'Registrando...';
    btn.disabled = true;

    try {
      await DB.saveWaitlistEntry({
        name,
        linkedin,
        whatsapp: phone,
        email,
        source: 'app_view_auth'
      });

      const formEl = document.getElementById('auth-waitlist-form');
      const successEl = document.getElementById('auth-waitlist-success');
      if (formEl) formEl.style.display = 'none';
      if (successEl) successEl.style.display = 'block';
    } catch (err: any) {
      await RondaDialog.alert({
        title: 'Error al Guardar',
        message: 'No pudimos registrar tus datos. Por favor inténtalo de nuevo: ' + err.message,
        icon: '⚠️',
        type: 'danger'
      });
      btn.textContent = '✨ Unirme a la Lista de Espera';
      btn.disabled = false;
    }
  });

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
