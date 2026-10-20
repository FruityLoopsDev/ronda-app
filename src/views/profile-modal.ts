// src/views/profile-modal.ts — Controlador del modal de completar perfil
//
// Extraído de app.ts (líneas ~236–411): modal de perfil, verificación LinkedIn
// en modal, guardado de perfil, y KYC biométrico.

import { Auth } from '../auth.js';
import { DB } from '../db.js';
import { Verification } from '../verification.js';
import { Router } from '../router.js';

export interface ProfileModalCallbacks {
  onSaved: (user: any) => void;
  onSkipped: () => void;
}

export class ProfileModal {
  private modal = document.getElementById('modal-profile');

  constructor(private cb: ProfileModalCallbacks) {}

  init() {
    this.setupCloseButtons();
    this.setupNeedsProfileListener();
    this.setupLinkedInVerification();
    this.setupSaveProfile();
    this.setupKYC();
  }

  // ── Cerrar / Omitir modal ──────────────────────────────────

  private setupCloseButtons() {
    document.getElementById('btn-close-modal-profile')?.addEventListener('click', () => {
      if (this.modal) this.modal.classList.remove('active');
    });

    document.getElementById('btn-skip-profile')?.addEventListener('click', () => {
      if (this.modal) this.modal.classList.remove('active');
      this.cb.onSkipped();
    });
  }

  // ── Escuchar auth:needsProfile ─────────────────────────────

  private setupNeedsProfileListener() {
    addEventListener('auth:needsProfile', (e: any) => {
      // Si el usuario está accediendo a un panel autónomo directo, no mostrar el modal
      if (Router.matchesAutonomousRoute()) {
        return;
      }
      // No mostrar el modal automáticamente si view-auth está activo
      // (sesión de Firebase previa con perfil incompleto — el usuario debe pasar por login primero).
      if (Router.current === 'view-auth') {
        return;
      }
      if (this.modal) this.modal.classList.add('active');
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

        // Badge Club Fundador 100 en modal (T-6.2)
        if (user.isFoundingMember) {
          const pant = document.querySelector('#modal-profile .pant');
          if (pant && !document.getElementById('modal-profile-founder-badge')) {
            const badge = document.createElement('span');
            badge.id = 'modal-profile-founder-badge';
            badge.textContent = `⭐ Miembro Fundador #${user.founderNumber || 1}`;
            badge.style.cssText =
              'display:inline-flex;align-items:center;gap:6px;background:rgba(240,168,48,0.18);color:var(--luz-brillo);border:1px solid rgba(240,168,48,0.45);border-radius:999px;padding:4px 12px;font-size:12px;font-weight:700;margin:8px auto 0 auto;';
            pant.insertAdjacentElement('afterend', badge);
          }
        }

        // El perfil de LinkedIn es opcional en esta etapa
        const saveBtn = document.getElementById('btn-save-profile') as HTMLButtonElement | null;
        if (saveBtn) saveBtn.disabled = false;
      }
    });
  }

  // ── Verificación LinkedIn en modal ─────────────────────────

  private setupLinkedInVerification() {
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
          linkedinStatus.textContent = `✓ ${result.data.badge}`;
          linkedinStatus.style.color = 'var(--botella)';
        }
        const saveBtn = document.getElementById('btn-save-profile') as HTMLButtonElement | null;
        if (saveBtn) saveBtn.disabled = false;
        if (user) {
          user.linkedinUrl = result.data.url;
          user.linkedinSlug = result.data.slug;
        }
      } else {
        if (linkedinStatus) {
          linkedinStatus.textContent = `✕ ${result.error || 'No se pudo verificar el perfil.'}`;
          linkedinStatus.style.color = 'var(--vino)';
        }
      }
    });
  }

  // ── Guardar perfil ─────────────────────────────────────────

  private setupSaveProfile() {
    const btnSaveProfile = document.getElementById('btn-save-profile') as HTMLButtonElement;
    if (!btnSaveProfile) return;

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
        user.name = name || 'Usuario RONDA';
        user.age = age;
        user.gender = gender;
        user.orientation = orientation;
        if (linkedinUrl) {
          const val = Verification.validateLinkedInUrl(linkedinUrl);
          user.linkedinUrl = val.valid ? val.normalizedUrl : linkedinUrl;
          if (val.valid) {
            user.linkedinSlug = val.slug;
          }
        }

        if (Auth.currentUser) {
          await DB.saveUser(user);
        }
        if (this.modal) this.modal.classList.remove('active');

        this.cb.onSaved(user);
      } catch (err: any) {
        console.error("Error al guardar perfil:", err);
        if (this.modal) this.modal.classList.remove('active');
      } finally {
        btnSaveProfile.textContent = "Guardar Perfil";
      }
    });
  }

  // ── KYC Biométrico ─────────────────────────────────────────

  private setupKYC() {
    const btnStartKyc = document.getElementById('btn-start-kyc');
    const btnSaveProfile = document.getElementById('btn-save-profile') as HTMLButtonElement;
    if (!btnStartKyc) return;

    btnStartKyc.addEventListener('click', async () => {
      const kycWrapper = document.getElementById('kyc-camera-wrapper');
      if (kycWrapper) kycWrapper.style.display = 'flex';
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
          if (btnSaveProfile) btnSaveProfile.disabled = false;
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
}
