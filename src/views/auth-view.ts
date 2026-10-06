// src/views/auth-view.ts — Controlador de la vista de autenticación
//
// Extraído de app.ts (líneas ~463–902): login, registro multi-paso,
// generador de contraseñas, PIN modal, waitlist, hash routing.

import { Auth } from '../auth.js';
import { RondaDialog } from '../dialog.js';
import { Verification } from '../verification.js';
import { calculateAge, getZodiacSign } from '../utils.js';
import { DB } from '../db.js';

export interface AuthViewCallbacks {
  onLoginSuccess: () => void;
  onRegisterSuccess: () => void;
}

export class AuthView {
  private loginForm = document.getElementById('login-form');
  private registerForm = document.getElementById('register-form');
  private regStep1 = document.getElementById('reg-step-1');
  private regStep2 = document.getElementById('reg-step-2');
  private waitlistContainer = document.getElementById('waitlist-container');

  constructor(private cb: AuthViewCallbacks) {}

  init() {
    this.setupLogin();
    this.setupRegistrationToggle();
    this.setupPasswordTools();
    this.setupRegistrationSteps();
    this.setupZodiacPreview();
    this.setupRegistrationSubmit();
    this.setupPinModal();
    this.setupWaitlist();
    this.handleHashRouting();
  }

  // ── Login ──────────────────────────────────────────────────

  private setupLogin() {
    const btnRealLogin = document.getElementById('btn-real-login');
    if (!btnRealLogin) return;

    btnRealLogin.addEventListener('click', () => {
      const email = (document.getElementById('login-email') as HTMLInputElement).value;
      const password = (document.getElementById('login-password') as HTMLInputElement).value;
      if (email && password) {
        btnRealLogin.textContent = 'Cargando...';
        (btnRealLogin as HTMLButtonElement).disabled = true;
        Auth.loginWithEmail(email, password).then(() => {
          this.cb.onLoginSuccess();
        }).catch(async (err: any) => {
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

  // ── Registro: toggle login ↔ registro ─────────────────────

  private showRegisterView() {
    if (this.loginForm && this.registerForm) {
      this.loginForm.style.display = 'none';
      this.registerForm.style.display = 'flex';
      if (this.regStep1) this.regStep1.style.display = 'block';
      if (this.regStep2) this.regStep2.style.display = 'none';
    }
  }

  private showLoginView() {
    if (this.loginForm && this.registerForm) {
      this.registerForm.style.display = 'none';
      this.loginForm.style.display = 'flex';
    }
  }

  private setupRegistrationToggle() {
    document.getElementById('btn-show-register')?.addEventListener('click', () => this.showRegisterView());
    document.getElementById('btn-show-login')?.addEventListener('click', () => this.showLoginView());
  }

  // ── Generador de contraseñas + toggle visibilidad ─────────

  private setupPasswordTools() {
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
  }

  // ── Registro multi-paso ────────────────────────────────────

  private setupRegistrationSteps() {
    document.getElementById('btn-next-step')?.addEventListener('click', () => {
      const email = (document.getElementById('reg-email') as HTMLInputElement).value;
      const password = (document.getElementById('reg-password') as HTMLInputElement).value;
      if (email && password) {
        if (this.regStep1 && this.regStep2) {
          this.regStep1.style.display = 'none';
          this.regStep2.style.display = 'block';
        }
      } else {
        alert("Ingresa email y contraseña para continuar.");
      }
    });
  }

  // ── Preview zodiacal en vivo ───────────────────────────────

  private setupZodiacPreview() {
    const regBirthInput = document.getElementById('reg-birthdate') as HTMLInputElement;
    const regZodiacPreview = document.getElementById('reg-zodiac-preview');

    if (!regBirthInput || !regZodiacPreview) return;

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

  // ── Submit de registro ─────────────────────────────────────

  private setupRegistrationSubmit() {
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
          message: 'Por favor completa todos tus datos personales. (Opcional: añade tu LinkedIn para recibir una bebida de cortesía 🍺)',
          icon: '⚠️'
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

      let normalizedUrl = '';
      let slug = '';
      if (linkedinUrl) {
        const linkedinValidation = Verification.validateLinkedInUrl(linkedinUrl);
        if (!linkedinValidation.valid) {
          await RondaDialog.alert({
            title: 'Perfil de LinkedIn No Válido',
            message: linkedinValidation.error || 'Ingresa una URL válida de LinkedIn (ej. https://linkedin.com/in/tu-perfil).',
            icon: '💼',
            type: 'alert'
          });
          return;
        }
        normalizedUrl = linkedinValidation.normalizedUrl;
        slug = linkedinValidation.slug;
      }

      const zodiac = getZodiacSign(birthDate);

      const btn = document.getElementById('btn-real-register') as HTMLButtonElement;
      btn.textContent = 'Creando cuenta...';
      btn.disabled = true;

      if (linkedinUrl) {
        btn.textContent = 'Enlazando perfil y creando cuenta...';
        await Verification.verifyLinkedInProfile(linkedinUrl, { name, email });
      }

      Auth.registerWithEmail(email, password, {
        name,
        birthDate,
        zodiacSign: zodiac.emoji,
        age,
        gender,
        orientation,
        linkedinUrl: normalizedUrl,
        linkedinSlug: slug
      }).then(() => {
        this.cb.onRegisterSuccess();
      }).catch(async (err: any) => {
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
  }

  // ── PIN Modal (acceso staff) ───────────────────────────────

  private setupPinModal() {
    const modalPin = document.getElementById('modal-pin-access');
    const pinDigits = Array.from(document.querySelectorAll<HTMLInputElement>('.pin-digit'));
    const pinErrorMsg = document.getElementById('pin-error-msg');
    const btnPinCancel = document.getElementById('btn-pin-cancel');
    const btnPinSubmit = document.getElementById('btn-pin-submit');
    const pinContainer = document.getElementById('pin-inputs-container');
    const btnToggleAdminLogin = document.getElementById('btn-toggle-admin-login');
    const btnBackToWaitlist = document.getElementById('btn-back-to-waitlist');

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
          if (this.waitlistContainer) this.waitlistContainer.style.display = 'none';
          if (this.loginForm) {
            this.loginForm.style.display = 'flex';
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
      if (this.loginForm) this.loginForm.style.display = 'none';
      if (this.waitlistContainer) this.waitlistContainer.style.display = 'block';
    });
  }

  // ── Lista de Espera ────────────────────────────────────────

  private setupWaitlist() {
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
  }

  // ── Hash routing (#register / #login) ─────────────────────

  private handleHashRouting() {
    // Auto-open register form if arriving from landing with #register or #registro
    if (window.location.hash === '#register' || window.location.hash === '#registro' || window.location.search.includes('register')) {
      this.showRegisterView();
    }
    window.addEventListener('hashchange', () => {
      if (window.location.hash === '#register' || window.location.hash === '#registro') {
        this.showRegisterView();
      } else if (window.location.hash === '#login') {
        this.showLoginView();
      }
    });
  }
}
