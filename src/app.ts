import { DB } from './db.js';
import { Auth } from './auth.js';
import { RondaConfig } from './firebase-config.js';
import { ClientApp } from './client.js';
import { Verification } from './verification.js';
import { Profile } from './profile.js';

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

  // Funciones de Vista
  function switchView(viewId) {
    document.querySelectorAll('.panel').forEach(el => el.classList.remove('on'));
    
    const activeView = document.getElementById(viewId);
    if(activeView) {
      activeView.classList.add('on');
    }
  }

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

    // Inicializar servicio de perfil
    Profile.init();

    // Event listener para volver a eventos desde el perfil
    document.getElementById('btn-back-to-events')?.addEventListener('click', () => {
      const user = Auth.currentUser;
      if (user?.activeEventId) {
        switchView('view-client');
      } else {
        switchView('view-lobby');
      }
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
        <div class="user-badge" id="btn-open-profile" title="Ver mi perfil">
          <div class="user-badge-avatar">
            ${avatarContent}
          </div>
          <span class="user-badge-name">${displayName}</span>
          <span class="user-badge-chevron">❯</span>
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

      // Mostrar vista según el rol
      if (user.role === 'client') {
        if (user.activeEventId) {
          switchView('view-client');
        } else {
          switchView('view-lobby');
        }
      } else if (user.role === 'admin') {
        switchView('view-admin');
      }
    } else {
      userMenu.innerHTML = ``;
      switchView('view-auth');
    }
  }

  // Control del modal de perfil
  const modalProfile = document.getElementById('modal-profile');
  addEventListener('auth:needsProfile', (e) => {
    modalProfile.classList.add('active');
    const user = e.detail;
    document.getElementById('profile-name').value = user.name || '';
    document.getElementById('profile-age').value = user.age || '';
    document.getElementById('profile-gender').value = user.gender || '';
    document.getElementById('profile-orientation').value = user.orientation || '';
  });

  const btnSaveProfile = document.getElementById('btn-save-profile');
  if (btnSaveProfile) {
    btnSaveProfile.addEventListener('click', async () => {
      const name = document.getElementById('profile-name').value.trim();
      const age = parseInt(document.getElementById('profile-age').value, 10);
      const gender = document.getElementById('profile-gender').value;
      const orientation = document.getElementById('profile-orientation').value;

      if (!name || !age || !gender || !orientation) {
        alert("Por favor completa todos los campos del perfil.");
        return;
      }

      btnSaveProfile.textContent = "Guardando...";
      btnSaveProfile.disabled = true;

      try {
        const user = Auth.currentUser;
        user.name = name;
        user.age = age;
        user.gender = gender;
        user.orientation = orientation;

        await DB.saveUser(user);
        modalProfile.classList.remove('active');
        
        dispatchEvent(new CustomEvent('auth:login', { detail: user }));
      } catch (err) {
        console.error("Error al guardar perfil:", err);
        alert("Error al guardar: " + err.message);
      } finally {
        btnSaveProfile.textContent = "Guardar Perfil";
        btnSaveProfile.disabled = false;
      }
    });
  }

  const btnStartKyc = document.getElementById('btn-start-kyc');
  if (btnStartKyc) {
    btnStartKyc.addEventListener('click', async () => {
      btnStartKyc.textContent = "Cargando...";
      try {
        const kycVideo = document.getElementById('kyc-video');
        const kycCanvas = document.getElementById('kyc-canvas');
        kycVideo.style.display = 'block';
        kycCanvas.style.display = 'block';
        document.getElementById('kyc-status').textContent = "Cámara activa. Analizando rostro e ID...";
        
        // Esperar a que la promesa de startVerification se resuelva con éxito real
        const isVerified = await Verification.startVerification('kyc-video', 'kyc-canvas');
        
        if (isVerified) {
           document.getElementById('kyc-status').textContent = "✓ Biometría y OCR verificados (Cédula de Colombia válida)";
           document.getElementById('kyc-status').style.color = "var(--botella)";
           btnSaveProfile.disabled = false;
        }
      } catch (err) {
        console.error("KYC Error:", err);
        alert("Error activando cámara.");
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

  document.getElementById('btn-real-register')?.addEventListener('click', () => {
    const email = (document.getElementById('reg-email') as HTMLInputElement).value;
    const password = (document.getElementById('reg-password') as HTMLInputElement).value;
    const name = (document.getElementById('reg-name') as HTMLInputElement).value;
    const age = parseInt((document.getElementById('reg-age') as HTMLInputElement).value, 10);
    const gender = (document.getElementById('reg-gender') as HTMLSelectElement).value;
    const orientation = (document.getElementById('reg-interest') as HTMLSelectElement).value;

    if (!name || !age || !gender || !orientation) {
      alert("Completa todos los datos para crear tu perfil.");
      return;
    }

    const btn = document.getElementById('btn-real-register') as HTMLButtonElement;
    btn.textContent = 'Creando cuenta...';
    btn.disabled = true;

    Auth.registerWithEmail(email, password, { name, age, gender, orientation }).then((user) => {
      // Successfully registered.
      triggerLoginAnimation();
    }).catch(err => {
      alert("Error en registro: " + err.message);
    }).finally(() => {
      btn.textContent = 'Crear Cuenta y Entrar';
      btn.disabled = false;
    });
  });

  // Event Listeners Auth State
  addEventListener('auth:login', updateNavbar);
  addEventListener('auth:logout', updateNavbar);

  // Navegación (para demostración de multi-rol, aunque idealmente están separados por permisos)
  document.getElementById('nav-client').addEventListener('click', () => {
    const user = Auth.currentUser;
    if (user) {
      if (user.activeEventId) {
        switchView('view-client');
      } else {
        switchView('view-lobby');
      }
    }
  });
  document.getElementById('nav-admin').addEventListener('click', () => switchView('view-admin'));
}
