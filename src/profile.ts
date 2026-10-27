import { DB, User } from './db.js';
import { Auth } from './auth.js';
import { ClientApp } from './client.js';
import notifications from './notifications.js';
import { RondaDialog } from './dialog.js';
import { Verification } from './verification.js';
import { PrivacyPolicy } from './privacy-policy.js';
import { escapeHtml } from './utils.js';

export class ProfileService {
  private currentUser: User | null = null;

  init() {
    this.setupEventListeners();
  }

  setCurrentUser(user: User) {
    this.currentUser = user;
    this.render();
  }

  /**
   * Persiste únicamente los campos modificados del perfil en Firestore
   * mediante `DB.updateUserProfile` y sincroniza atómicamente `this.currentUser`
   * y `Auth.currentUser` en memoria para evitar que `app.ts` sobreescriba
   * los cambios al reabrir la vista.
   */
  private async persistProfilePatch(fields: Partial<User>): Promise<void> {
    if (!this.currentUser) return;

    await DB.updateUserProfile(this.currentUser.uid, fields);

    Object.assign(this.currentUser, fields);
    if (Auth.currentUser && Auth.currentUser.uid === this.currentUser.uid) {
      Object.assign(Auth.currentUser, fields);
    }

    window.dispatchEvent(new CustomEvent('profile:updated', { detail: this.currentUser }));
  }

  render() {
    if (!this.currentUser) return;
    const user = this.currentUser;

    // Header & Identity
    const avatarImg = document.getElementById('profile-avatar-img') as HTMLImageElement;
    const avatarPlaceholder = document.getElementById('profile-avatar-placeholder');
    const profileName = document.getElementById('profile-display-name');
    const profileHandle = document.getElementById('profile-display-handle');
    const profileBio = document.getElementById('profile-display-bio');
    const profileMeta = document.getElementById('profile-display-meta');
    const kycBadge = document.getElementById('profile-kyc-badge');

    // Stats
    const statRounds = document.getElementById('stat-rounds');
    const statVenues = document.getElementById('stat-venues');
    const statMatches = document.getElementById('stat-matches');

    const rounds = user.stats?.roundsPlayed || 0;
    const venues = user.stats?.venuesVisited || 0;
    const matches = user.stats?.matchesCount || 0;

    if (statRounds) statRounds.textContent = rounds.toString();
    if (statVenues) statVenues.textContent = venues.toString();
    if (statMatches) statMatches.textContent = matches.toString();

    // Username / Handle
    const username = user.username || (user.email ? user.email.split('@')[0].toLowerCase() : '');
    if (profileHandle) profileHandle.textContent = username ? `@${username}` : '';

    // Name & Age
    const ageStr = user.age ? ` (${user.age})` : '';
    if (profileName) profileName.textContent = user.name ? `${user.name}${ageStr}` : 'Mi Perfil';

    // KYC Badge & LinkedIn Badge
    if (kycBadge) {
      if (user.isVerified) {
        kycBadge.style.display = 'inline-flex';
      } else {
        kycBadge.style.display = 'none'; // solo mostrar si está verificado
      }
    }

    const kycSettingsStatus = document.getElementById('kyc-settings-status');
    if (kycSettingsStatus) {
      if (user.isVerified) {
        kycSettingsStatus.textContent = 'Verificado ✓';
        kycSettingsStatus.className = 'chip verde';
        kycSettingsStatus.style.fontSize = '9.5px';
        kycSettingsStatus.style.padding = '3px 8px';
      } else {
        kycSettingsStatus.textContent = 'Pendiente';
        kycSettingsStatus.className = 'chip ambar';
        kycSettingsStatus.style.fontSize = '9.5px';
        kycSettingsStatus.style.padding = '3px 8px';
      }
    }

    const linkedinBadge = document.getElementById('profile-linkedin-badge');
    if (linkedinBadge) {
      if (user.linkedinVerified || user.linkedinUrl) {
        linkedinBadge.style.display = 'inline-flex';
      } else {
        linkedinBadge.style.display = 'none';
      }
    }

    const rowLinkedin = document.getElementById('profile-row-linkedin');
    const linkLinkedin = document.getElementById('profile-linkedin-link') as HTMLAnchorElement | null;
    if (rowLinkedin && linkLinkedin) {
      if (user.linkedinUrl) {
        rowLinkedin.style.display = 'flex';
        const val = Verification.validateLinkedInUrl(user.linkedinUrl);
        linkLinkedin.href = val.valid ? val.normalizedUrl : user.linkedinUrl;
        linkLinkedin.textContent = val.valid ? `in/${val.slug} ↗` : 'Ver Perfil ↗';
      } else {
        rowLinkedin.style.display = 'none';
      }
    }

    // Bio
    const bioText = user.bio || '';
    if (profileBio) {
      profileBio.textContent = bioText;
      profileBio.style.display = bioText ? 'block' : 'none';
    }

    // Meta details
    const cocktail = user.favoriteCocktail || '';
    const zone = (user.preferredZones && user.preferredZones.length > 0) ? user.preferredZones.join(', ') : '';
    const zodiac = user.zodiacSign || '';
    if (profileMeta) {
      const parts: string[] = [];
      if (cocktail) parts.push(`🍸 <b>${escapeHtml(cocktail)}</b>`);
      if (zone) parts.push(`📍 <b>${escapeHtml(zone)}</b>`);
      if (zodiac) parts.push(`<b>${escapeHtml(zodiac)}</b>`);
      if (parts.length > 0) {
        profileMeta.innerHTML = parts.join(' · ');
        profileMeta.style.display = 'block';
      } else {
        profileMeta.innerHTML = '';
        profileMeta.style.display = 'none';
      }
    }

    // Avatar image
    if (user.photoURL) {
      if (avatarImg) {
        avatarImg.src = user.photoURL;
        avatarImg.style.display = 'block';
      }
      if (avatarPlaceholder) avatarPlaceholder.style.display = 'none';
    } else {
      if (avatarImg) avatarImg.style.display = 'none';
      if (avatarPlaceholder) {
        avatarPlaceholder.style.display = 'flex';
        const initials = user.name ? user.name.substring(0, 2).toUpperCase() : 'R';
        avatarPlaceholder.textContent = initials;
      }
    }

    // Highlights bubbles
    const hlCocktail = document.getElementById('hl-cocktail-val');
    const hlZone = document.getElementById('hl-zone-val');
    if (hlCocktail) hlCocktail.textContent = cocktail || '-';
    if (hlZone) hlZone.textContent = zone || '-';

    // Populate Tab 1: Sobre Mí
    const aboutGender = document.getElementById('about-gender');
    const aboutOrientation = document.getElementById('about-orientation');
    const aboutZodiac = document.getElementById('about-zodiac');
    const aboutZones = document.getElementById('about-zones');
    const aboutCocktail = document.getElementById('about-cocktail');

    if (aboutGender) aboutGender.textContent = user.gender === 'M' ? 'Hombre' : (user.gender === 'F' ? 'Mujer' : (user.gender || 'No especificado'));
    if (aboutOrientation) aboutOrientation.textContent = user.orientation === 'F' ? 'Mujeres' : (user.orientation === 'M' ? 'Hombres' : (user.orientation || 'No especificado'));
    if (aboutZodiac) aboutZodiac.textContent = zodiac || 'No especificado';
    if (aboutZones) aboutZones.textContent = zone || 'No especificado';
    if (aboutCocktail) aboutCocktail.textContent = cocktail || 'No especificado';

    // Populate Tab 3: Ajustes & Seguridad
    const inputSafeword = document.getElementById('setting-safeword') as HTMLInputElement;
    const inputEmergency = document.getElementById('setting-emergency') as HTMLInputElement;
    const chkDrinkStats = document.getElementById('setting-share-drinks') as HTMLInputElement;
    const chkMarketing = document.getElementById('setting-marketing') as HTMLInputElement;

    if (inputSafeword) inputSafeword.value = user.safeword || '';
    if (inputEmergency) inputEmergency.value = user.emergencyContact || '';
    if (chkDrinkStats) chkDrinkStats.checked = user.privacySettings?.shareDrinkStats !== false;
    if (chkMarketing) chkMarketing.checked = user.privacySettings?.marketingConsent !== false;
  }

  setupEventListeners() {
    // Tab Switching (Sobre Mí / Pases NFTs / Ajustes)
    document.querySelectorAll('.profile-tab-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const target = (e.currentTarget as HTMLElement).dataset.tab;
        if (!target) return;

        document.querySelectorAll('.profile-tab-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.profile-tab-content').forEach(c => c.classList.remove('active'));

        (e.currentTarget as HTMLElement).classList.add('active');
        const contentEl = document.getElementById(`tab-content-${target}`);
        if (contentEl) contentEl.classList.add('active');
      });
    });

    // Subir Foto de Perfil Directa
    const photoInput = document.getElementById('input-profile-photo') as HTMLInputElement;
    const avatarTrigger = document.getElementById('btn-change-avatar');

    avatarTrigger?.addEventListener('click', () => {
      photoInput?.click();
    });

    photoInput?.addEventListener('change', async (e) => {
      const files = (e.target as HTMLInputElement).files;
      if (!files || files.length === 0) return;
      const file = files[0];
      try {
        const compressedBase64 = await this.compressImage(file, 400, 400, 0.85);
        if (this.currentUser) {
          await this.persistProfilePatch({ photoURL: compressedBase64 });
          this.render();
          this.showToast('¡Foto de perfil actualizada!');
        }
      } catch (err: any) {
        console.error('Error al procesar foto:', err);
        await RondaDialog.alert({
          title: 'Error de Imagen',
          message: 'No se pudo procesar la imagen: ' + err.message,
          icon: '📸',
          type: 'danger'
        });
      }
    });

    // Abrir Gestor de Reservas desde el Perfil
    document.getElementById('btn-profile-qr')?.addEventListener('click', () => {
      ClientApp.openManageReservationsModal();
    });

    // Abrir Modal de Edición de Perfil
    document.getElementById('btn-edit-profile-open')?.addEventListener('click', () => {
      this.openEditModal();
    });

    document.getElementById('btn-edit-profile-close')?.addEventListener('click', () => {
      this.closeEditModal();
    });

    // Guardar cambios en Modal Editar Perfil
    document.getElementById('btn-save-edit-profile')?.addEventListener('click', async () => {
      await this.saveEditedProfile();
    });

    // Abrir Modal de Ajustes (Desde botón superior ⚙️ o pestaña)
    document.getElementById('btn-open-settings-top')?.addEventListener('click', () => {
      this.openSettingsModal();
    });

    document.getElementById('btn-open-settings-tab')?.addEventListener('click', () => {
      this.openSettingsModal();
    });

    document.getElementById('btn-settings-close')?.addEventListener('click', () => {
      this.closeSettingsModal();
    });

    // Guardar Opciones Avanzadas (Botón inferior o botón cabecera)
    document.getElementById('btn-save-advanced-settings')?.addEventListener('click', async () => {
      await this.saveAdvancedSettings();
    });

    document.getElementById('btn-save-settings-top')?.addEventListener('click', async () => {
      await this.saveAdvancedSettings();
    });

    // Abrir Modal de Satisfacción / Veredicto de la Noche
    document.getElementById('btn-settings-open-satisfaction')?.addEventListener('click', () => {
      this.closeSettingsModal();
      window.dispatchEvent(new CustomEvent('satisfaction:open'));
    });

    // Botón de Cerrar Sesión dentro de Mi Perfil / Ajustes
    document.getElementById('btn-profile-logout')?.addEventListener('click', async () => {
      const confirmed = await RondaDialog.confirm({
        title: 'Cerrar Sesión',
        message: '¿Estás seguro de que deseas cerrar sesión de tu cuenta en este dispositivo?',
        icon: '🔒',
        type: 'danger',
        confirmText: '✓ Cerrar Sesión',
        cancelText: '✕ Mantener Abierta'
      });
      if (confirmed) {
        try {
          await Auth.logout();
          // La navegación a view-auth se gestiona desde el listener 'auth:logout'
          // en app.ts (updateNavbar → switchView('view-auth')).
        } catch (err) {
          await RondaDialog.alert({
            title: 'No se pudo cerrar sesión',
            message: 'Hubo un problema al cerrar sesión. Verifica tu conexión a internet e intenta nuevamente.',
            icon: '⚠️',
            type: 'danger'
          });
        }
      }
    });

    // Badge Bubble Click Listeners (opening modals)
    document.getElementById('badge-cocktail')?.addEventListener('click', () => {
      this.openCocktailModal();
    });
    document.getElementById('badge-zone')?.addEventListener('click', () => {
      this.openZoneModal();
    });
    document.getElementById('badge-services')?.addEventListener('click', () => {
      this.openServicesModal();
    });
    document.getElementById('badge-qr')?.addEventListener('click', () => {
      this.openQRModal();
    });
    // Badge Modal Listeners
    document.getElementById('btn-close-cocktail')?.addEventListener('click', () => {
      document.getElementById('modal-select-cocktail')?.classList.remove('active');
    });
    document.getElementById('btn-close-zone')?.addEventListener('click', () => {
      document.getElementById('modal-select-zone')?.classList.remove('active');
    });
    document.getElementById('btn-close-qr')?.addEventListener('click', () => {
      document.getElementById('modal-full-qr')?.classList.remove('active');
    });

    document.getElementById('btn-save-badge-cocktail')?.addEventListener('click', async () => {
      const selected = document.querySelector('input[name="badge-cocktail-choice"]:checked') as HTMLInputElement;
      if (selected && this.currentUser) {
        try {
          await this.persistProfilePatch({ favoriteCocktail: selected.value });
          this.render();
          document.getElementById('modal-select-cocktail')?.classList.remove('active');
          this.showToast('Cóctel actualizado');
        } catch (err: any) {
          console.error('Error al actualizar cóctel:', err);
          await RondaDialog.alert({
            title: 'Error al Guardar',
            message: 'No se pudo actualizar tu cóctel favorito: ' + err.message,
            icon: '🍸',
            type: 'danger'
          });
        }
      }
    });

    document.getElementById('btn-save-badge-zone')?.addEventListener('click', async () => {
      if (this.currentUser) {
        const selectedZones: string[] = [];
        document.querySelectorAll('.badge-zone-checkbox:checked').forEach((chk: any) => {
          selectedZones.push(chk.value);
        });
        if (selectedZones.length > 0) {
          try {
            await this.persistProfilePatch({ preferredZones: selectedZones });
            this.render();
            document.getElementById('modal-select-zone')?.classList.remove('active');
            this.showToast('Zonas actualizadas');
          } catch (err: any) {
            console.error('Error al actualizar zonas:', err);
            await RondaDialog.alert({
              title: 'Error al Guardar',
              message: 'No se pudieron actualizar tus zonas preferidas: ' + err.message,
              icon: '📍',
              type: 'danger'
            });
          }
        }
      }
    });

    // Verificación de LinkedIn en modal de edición
    const btnVerifyEditLinkedin = document.getElementById('btn-verify-edit-linkedin');
    btnVerifyEditLinkedin?.addEventListener('click', async () => {
      const input = document.getElementById('edit-linkedin') as HTMLInputElement | null;
      const status = document.getElementById('edit-linkedin-status');
      if (!input || !status) return;

      const url = input.value.trim();
      if (!url) {
        status.textContent = '⚠️ Ingresa tu URL de LinkedIn antes de validar.';
        status.style.color = 'var(--vino)';
        return;
      }

      status.textContent = '⏳ Verificando credenciales de LinkedIn...';
      status.style.color = 'var(--luz)';
      btnVerifyEditLinkedin.textContent = '...';

      const result = await Verification.verifyLinkedInProfile(url, { name: this.currentUser?.name });
      btnVerifyEditLinkedin.textContent = 'Validar';

      if (result.success && result.data) {
        input.value = result.data.url;
        status.textContent = `✓ ${result.data.badge} (${result.data.headline})`;
        status.style.color = 'var(--botella)';
        if (this.currentUser) {
          this.currentUser.linkedinUrl = result.data.url;
          this.currentUser.linkedinVerified = true;
          this.currentUser.linkedinSlug = result.data.slug;
          this.currentUser.linkedinHeadline = result.data.headline;
        }
      } else {
        status.textContent = `✕ ${result.error || 'No se pudo verificar el perfil.'}`;
        status.style.color = 'var(--vino)';
      }
    });
  }

  openEditModal() {
    if (!this.currentUser) return;
    const user = this.currentUser;

    const modal = document.getElementById('modal-edit-profile');
    if (!modal) return;

    (document.getElementById('edit-name') as HTMLInputElement).value = user.name || '';
    (document.getElementById('edit-username') as HTMLInputElement).value = user.username || (user.email ? user.email.split('@')[0] : '');
    (document.getElementById('edit-age') as HTMLInputElement).value = user.age ? user.age.toString() : '25';
    (document.getElementById('edit-bio') as HTMLTextAreaElement).value = user.bio || '';
    (document.getElementById('edit-cocktail') as HTMLInputElement).value = user.favoriteCocktail || '';
    (document.getElementById('edit-gender') as HTMLSelectElement).value = user.gender || 'Hombre';
    (document.getElementById('edit-orientation') as HTMLSelectElement).value = user.orientation || 'Mujeres';
    const editLinkedin = document.getElementById('edit-linkedin') as HTMLInputElement | null;
    const editLinkedinStatus = document.getElementById('edit-linkedin-status');
    if (editLinkedin) editLinkedin.value = user.linkedinUrl || '';
    if (editLinkedinStatus) {
      if (user.linkedinVerified || user.linkedinUrl) {
        editLinkedinStatus.textContent = `✓ Perfil Profesional Verificado ${user.linkedinHeadline ? '(' + user.linkedinHeadline + ')' : ''}`;
        editLinkedinStatus.style.color = 'var(--botella)';
      } else {
        editLinkedinStatus.textContent = '';
      }
    }

    // Sync Avatar Preview in Modal
    const editImg = document.getElementById('edit-avatar-img') as HTMLImageElement;
    const editPh = document.getElementById('edit-avatar-placeholder');
    if (user.photoURL) {
      if (editImg) {
        editImg.src = user.photoURL;
        editImg.style.display = 'block';
      }
      if (editPh) editPh.style.display = 'none';
    } else {
      if (editImg) editImg.style.display = 'none';
      if (editPh) {
        editPh.style.display = 'flex';
        editPh.textContent = user.name ? user.name.substring(0, 2).toUpperCase() : 'R';
      }
    }

    // Char counter
    const bioEl = document.getElementById('edit-bio') as HTMLTextAreaElement;
    const counter = document.getElementById('bio-char-count');
    if (counter && bioEl) {
      counter.textContent = `${bioEl.value.length}/150`;
      bioEl.oninput = () => {
        counter.textContent = `${bioEl.value.length}/150`;
      };
    }

    modal.classList.add('active');
  }

  closeEditModal() {
    const modal = document.getElementById('modal-edit-profile');
    if (modal) modal.classList.remove('active');
  }

  async saveEditedProfile() {
    if (!this.currentUser) return;

    const btn = document.getElementById('btn-save-edit-profile') as HTMLButtonElement;
    if (btn) {
      btn.style.opacity = '0.5';
      btn.disabled = true;
    }

    try {
      const name = (document.getElementById('edit-name') as HTMLInputElement).value.trim();
      const username = (document.getElementById('edit-username') as HTMLInputElement).value.trim().toLowerCase().replace(/[^a-z0-9_.]/g, '');
      const age = parseInt((document.getElementById('edit-age') as HTMLInputElement).value, 10);
      const bio = (document.getElementById('edit-bio') as HTMLTextAreaElement).value.trim();
      const favoriteCocktail = (document.getElementById('edit-cocktail') as HTMLInputElement).value.trim();

      // Validación estricta anti-contacto en el perfil
      const bioCheck = PrivacyPolicy.detectProhibitedContact(bio);
      const nameCheck = PrivacyPolicy.detectProhibitedContact(name);
      const cocktailCheck = PrivacyPolicy.detectProhibitedContact(favoriteCocktail);

      if (bioCheck.prohibited || nameCheck.prohibited || cocktailCheck.prohibited) {
        if (btn) {
          btn.style.opacity = '1';
          btn.disabled = false;
        }
        await RondaDialog.alert({
          title: 'Violación de Privacidad',
          message: '⚠️ Está estrictamente prohibido incluir números de teléfono, WhatsApp, redes sociales o datos de contacto directo en tu perfil de RONDA.',
          icon: '🛡️',
          type: 'danger'
        });
        return;
      }
      const gender = (document.getElementById('edit-gender') as HTMLSelectElement).value;
      const orientation = (document.getElementById('edit-orientation') as HTMLSelectElement).value;
      const linkedinInput = document.getElementById('edit-linkedin') as HTMLInputElement | null;
      const linkedinUrl = linkedinInput ? linkedinInput.value.trim() : '';

      const patch: Partial<User> = {
        name: name || this.currentUser.name,
        username: username || this.currentUser.username,
        age: !isNaN(age) ? age : this.currentUser.age,
        bio,
        favoriteCocktail,
        gender,
        orientation
      };

      if (linkedinUrl) {
        const val = Verification.validateLinkedInUrl(linkedinUrl);
        patch.linkedinUrl = val.valid ? val.normalizedUrl : linkedinUrl;
        if (val.valid) {
          patch.linkedinVerified = true;
          patch.linkedinSlug = val.slug;
          if (this.currentUser.linkedinHeadline) {
            patch.linkedinHeadline = this.currentUser.linkedinHeadline;
          }
        }
      }

      await this.persistProfilePatch(patch);
      this.render();
      this.closeEditModal();
      this.showToast('Perfil actualizado correctamente');
    } catch (err: any) {
      console.error('Error al guardar perfil:', err);
      await RondaDialog.alert({
        title: 'Error al Guardar Perfil',
        message: 'No se pudieron guardar tus cambios: ' + err.message,
        icon: '⚠️',
        type: 'danger'
      });
    } finally {
      if (btn) {
        btn.textContent = '✓';
        btn.style.opacity = '1';
        btn.disabled = false;
      }
    }
  }

  openSettingsModal() {
    if (!this.currentUser) return;
    const user = this.currentUser;

    const modal = document.getElementById('modal-settings');
    if (!modal) return;

    const inputSafeword = document.getElementById('setting-safeword') as HTMLInputElement;
    const chkDrinkStats = document.getElementById('setting-share-drinks') as HTMLInputElement;
    const chkMarketing = document.getElementById('setting-marketing') as HTMLInputElement;

    if (inputSafeword) inputSafeword.value = user.safeword || '';
    if (chkDrinkStats) chkDrinkStats.checked = user.privacySettings?.shareDrinkStats !== false;
    if (chkMarketing) chkMarketing.checked = user.privacySettings?.marketingConsent !== false;

    // Sincronizar zonas
    const zones = user.preferredZones || [];
    document.querySelectorAll('.zone-checkbox').forEach((chk: any) => {
      chk.checked = zones.includes(chk.value);
    });

    modal.classList.add('active');
  }

  closeSettingsModal() {
    const modal = document.getElementById('modal-settings');
    if (modal) modal.classList.remove('active');
  }

  async saveAdvancedSettings() {
    if (!this.currentUser) return;

    const btn = document.getElementById('btn-save-advanced-settings') as HTMLButtonElement;
    const btnTop = document.getElementById('btn-save-settings-top') as HTMLButtonElement;
    if (btn) { btn.textContent = 'Guardando...'; btn.disabled = true; }
    if (btnTop) { btnTop.style.opacity = '0.5'; btnTop.disabled = true; }

    try {
      const safeword = (document.getElementById('setting-safeword') as HTMLInputElement)?.value.trim();
      const shareDrinkStats = (document.getElementById('setting-share-drinks') as HTMLInputElement)?.checked;
      const marketingConsent = (document.getElementById('setting-marketing') as HTMLInputElement)?.checked;

      // Zonas seleccionadas
      const selectedZones: string[] = [];
      document.querySelectorAll('.zone-checkbox:checked').forEach((chk: any) => {
        selectedZones.push(chk.value);
      });

      const patch: Partial<User> = {
        safeword: safeword || '',
        privacySettings: {
          shareDrinkStats,
          marketingConsent
        }
      };

      if (selectedZones.length > 0) {
        patch.preferredZones = selectedZones;
      }

      await this.persistProfilePatch(patch);
      this.render();
      this.closeSettingsModal();
      this.showToast('Ajustes y privacidad guardados');
    } catch (err: any) {
      console.error('Error guardando ajustes:', err);
      await RondaDialog.alert({
        title: 'Error al Guardar',
        message: 'No se pudieron guardar los ajustes: ' + err.message,
        icon: '⚠️',
        type: 'danger'
      });
    } finally {
      if (btn) { btn.textContent = '✓ Guardar Opciones Avanzadas'; btn.disabled = false; }
      if (btnTop) { btnTop.textContent = '✓'; btnTop.style.opacity = '1'; btnTop.disabled = false; }
    }
  }

  openServicesModal() {
    const modal = document.getElementById('modal-ronda-services');
    if (!modal) return;
    modal.classList.add('active');

    document.getElementById('btn-services-close')?.addEventListener('click', () => {
      this.closeServicesModal();
    });

    modal.querySelectorAll('.btn-book-service').forEach((btn) => {
      btn.addEventListener('click', async (e) => {
        const serviceName = (e.currentTarget as HTMLElement).getAttribute('data-service') || 'Servicio RONDA';
        this.closeServicesModal();
        if (this.currentUser) {
          const updatedRequests = [
            ...(this.currentUser.serviceRequests || []),
            {
              serviceName,
              requestedAt: new Date().toISOString(),
              status: 'pending' as const
            }
          ];
          await this.persistProfilePatch({ serviceRequests: updatedRequests });
        }
        await RondaDialog.alert({
          title: 'Solicitud Recibida',
          message: `Hemos notificado a nuestro equipo de Concierge para agendar tu ${serviceName}. Te contactaremos por el canal seguro de la app con la fecha y hora disponible.`,
          icon: '✨'
        });
      });
    });
  }

  closeServicesModal() {
    const modal = document.getElementById('modal-ronda-services');
    if (modal) modal.classList.remove('active');
  }

  // BADGE SPECIFIC MODALS
  openCocktailModal() {
    if (!this.currentUser) return;
    const modal = document.getElementById('modal-select-cocktail');
    if (!modal) return;
    
    const current = this.currentUser.favoriteCocktail || '';
    const radio = current ? modal.querySelector(`input[value="${current}"]`) as HTMLInputElement : null;
    if (radio) {
      radio.checked = true;
    }
    modal.classList.add('active');
  }

  openZoneModal() {
    if (!this.currentUser) return;
    const modal = document.getElementById('modal-select-zone');
    if (!modal) return;
    
    const zones = this.currentUser.preferredZones || [];
    document.querySelectorAll('.badge-zone-checkbox').forEach((chk: any) => {
      chk.checked = zones.includes(chk.value);
    });
    modal.classList.add('active');
  }

  openQRModal() {
    const modal = document.getElementById('modal-full-qr');
    if (!modal) return;
    
    const qrGrid = document.getElementById('big-qr-grid');
    if (qrGrid && qrGrid.children.length === 0) {
      let s=99;
      const rnd=()=>(s=(s*1103515245+12345)&0x7fffffff)/0x7fffffff;
      for(let i=0;i<144;i++){
        const c=document.createElement('i');
        const r=Math.floor(i/12),co=i%12;
        const esquina=(r<3&&co<3)||(r<3&&co>8)||(r>8&&co<3);
        c.style.background = (esquina||rnd()>.48) ? 'var(--papel)' : 'transparent';
        c.style.width = '16.66px';
        c.style.height = '16.66px';
        qrGrid.appendChild(c);
      }
    }
    
    modal.classList.add('active');
  }

  private compressImage(file: File, maxWidth: number, maxHeight: number, quality: number): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (readerEvent) => {
        const image = new Image();
        image.onload = () => {
          const canvas = document.createElement('canvas');
          let width = image.width;
          let height = image.height;

          if (width > height) {
            if (width > maxWidth) {
              height = Math.round((height * maxWidth) / width);
              width = maxWidth;
            }
          } else {
            if (height > maxHeight) {
              width = Math.round((width * maxHeight) / height);
              height = maxHeight;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            reject(new Error('No se pudo obtener contexto 2D del canvas'));
            return;
          }
          ctx.drawImage(image, 0, 0, width, height);
          const dataUrl = canvas.toDataURL('image/jpeg', quality);
          resolve(dataUrl);
        };
        image.onerror = reject;
        image.src = readerEvent.target?.result as string;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  showToast(message: string) {
    notifications.showLegacyToast(message);
  }
}

export const Profile = new ProfileService();
