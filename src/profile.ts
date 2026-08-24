import { DB, User } from './db.js';
import { Auth } from './auth.js';
import { ClientApp } from './client.js';
import { RondaDialog } from './dialog.js';

export class ProfileService {
  private currentUser: User | null = null;

  init() {
    this.setupEventListeners();
  }

  setCurrentUser(user: User) {
    this.currentUser = user;
    this.render();
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

    const rounds = user.stats?.roundsPlayed ?? 12;
    const venues = user.stats?.venuesVisited ?? 3;
    const matches = user.stats?.matchesCount ?? 5;

    if (statRounds) statRounds.textContent = rounds.toString();
    if (statVenues) statVenues.textContent = venues.toString();
    if (statMatches) statMatches.textContent = matches.toString();

    // Username / Handle
    const username = user.username || (user.email ? user.email.split('@')[0].toLowerCase() : 'soltero.ronda');
    if (profileHandle) profileHandle.textContent = `@${username}`;

    // Name & Age
    const ageStr = user.age ? ` (${user.age})` : '';
    if (profileName) profileName.textContent = `${user.name || 'Sin Nombre'}${ageStr}`;

    // KYC Badge
    if (kycBadge) {
      if (user.isVerified) {
        kycBadge.style.display = 'inline-flex';
      } else {
        kycBadge.style.display = 'inline-flex'; // Default verified for MVP demo
      }
    }

    // Bio
    const bioText = user.bio || 'Amante del buen café, cócteles de autor y conversaciones de 6 minutos sin rodeos.';
    if (profileBio) profileBio.textContent = bioText;

    // Meta details
    const cocktail = user.favoriteCocktail || 'Negroni Ahumado';
    const zone = (user.preferredZones && user.preferredZones.length > 0) ? user.preferredZones.join(', ') : 'Zona G';
    const zodiac = user.zodiacSign || '♏ Escorpio';
    if (profileMeta) {
      profileMeta.innerHTML = `🍸 <b>${cocktail}</b> · 📍 <b>${zone}</b> · <b>${zodiac}</b>`;
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
    if (hlCocktail) hlCocktail.textContent = cocktail;
    if (hlZone) hlZone.textContent = zone;

    // Populate Tab 1: Sobre Mí
    const aboutGender = document.getElementById('about-gender');
    const aboutOrientation = document.getElementById('about-orientation');
    const aboutZodiac = document.getElementById('about-zodiac');
    const aboutZones = document.getElementById('about-zones');
    const aboutCocktail = document.getElementById('about-cocktail');

    if (aboutGender) aboutGender.textContent = user.gender === 'M' ? 'Hombre' : (user.gender === 'F' ? 'Mujer' : (user.gender || 'No especificado'));
    if (aboutOrientation) aboutOrientation.textContent = user.orientation === 'F' ? 'Mujeres' : (user.orientation === 'M' ? 'Hombres' : (user.orientation || 'Ambos'));
    if (aboutZodiac) aboutZodiac.textContent = zodiac;
    if (aboutZones) aboutZones.textContent = zone;
    if (aboutCocktail) aboutCocktail.textContent = cocktail;

    // Populate Tab 3: Ajustes & Seguridad
    const inputSafeword = document.getElementById('setting-safeword') as HTMLInputElement;
    const inputEmergency = document.getElementById('setting-emergency') as HTMLInputElement;
    const chkDrinkStats = document.getElementById('setting-share-drinks') as HTMLInputElement;
    const chkMarketing = document.getElementById('setting-marketing') as HTMLInputElement;

    if (inputSafeword) inputSafeword.value = user.safeword || 'Martini Azul';
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
          this.currentUser.photoURL = compressedBase64;
          await DB.saveUser(this.currentUser);
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
        Auth.logout();
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
    (document.getElementById('edit-cocktail') as HTMLInputElement).value = user.favoriteCocktail || 'Negroni Ahumado';
    (document.getElementById('edit-gender') as HTMLSelectElement).value = user.gender || 'Hombre';
    (document.getElementById('edit-orientation') as HTMLSelectElement).value = user.orientation || 'Mujeres';

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
      const gender = (document.getElementById('edit-gender') as HTMLSelectElement).value;
      const orientation = (document.getElementById('edit-orientation') as HTMLSelectElement).value;

      this.currentUser.name = name || this.currentUser.name;
      this.currentUser.username = username || this.currentUser.username;
      this.currentUser.age = !isNaN(age) ? age : this.currentUser.age;
      this.currentUser.bio = bio;
      this.currentUser.favoriteCocktail = favoriteCocktail;
      this.currentUser.gender = gender;
      this.currentUser.orientation = orientation;

      await DB.saveUser(this.currentUser);
      this.render();
      this.closeEditModal();
      this.showToast('Perfil actualizado correctamente');
    } catch (err: any) {
      console.error('Error al guardar perfil:', err);
      alert('Error: ' + err.message);
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

    if (inputSafeword) inputSafeword.value = user.safeword || 'Martini Azul';
    if (chkDrinkStats) chkDrinkStats.checked = user.privacySettings?.shareDrinkStats !== false;
    if (chkMarketing) chkMarketing.checked = user.privacySettings?.marketingConsent !== false;

    // Sincronizar zonas
    const zones = user.preferredZones || ['Zona G', 'Quinta Camacho'];
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

      this.currentUser.safeword = safeword || 'Martini Azul';
      if (selectedZones.length > 0) {
        this.currentUser.preferredZones = selectedZones;
      }
      this.currentUser.privacySettings = {
        shareDrinkStats,
        marketingConsent
      };

      await DB.saveUser(this.currentUser);
      this.render();
      this.closeSettingsModal();
      this.showToast('Ajustes y privacidad guardados');
    } catch (err: any) {
      console.error('Error guardando ajustes:', err);
      alert('Error: ' + err.message);
    } finally {
      if (btn) { btn.textContent = '✓ Guardar Opciones Avanzadas'; btn.disabled = false; }
      if (btnTop) { btnTop.textContent = '✓'; btnTop.style.opacity = '1'; btnTop.disabled = false; }
    }
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
    const toast = document.createElement('div');
    toast.style.cssText = `
      position: fixed;
      bottom: 30px;
      left: 50%;
      transform: translateX(-50%);
      background: var(--barra-alta);
      color: var(--luz);
      padding: 10px 20px;
      border-radius: 999px;
      border: 1px solid var(--luz);
      box-shadow: 0 10px 25px rgba(0,0,0,0.8);
      font-family: var(--font-mono);
      font-size: 12px;
      z-index: 9999;
      animation: fadeInToast 0.3s ease;
    `;
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transition = 'opacity 0.4s ease';
      setTimeout(() => toast.remove(), 400);
    }, 2500);
  }
}

export const Profile = new ProfileService();
