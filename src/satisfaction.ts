import { DB } from './db.js';
import { Auth } from './auth.js';
import { RondaDialog } from './dialog.js';

export interface SatisfactionData {
  vibe: string;
  vibeLabel: string;
  tags: string[];
  comment?: string;
  timestamp: number;
}

export class Satisfaction {
  private static modal: HTMLElement | null = null;
  private static selectedVibe: { id: string; label: string } | null = null;
  private static selectedTags: Set<string> = new Set();

  static init() {
    this.modal = document.getElementById('modal-satisfaction');
    if (!this.modal) return;

    // Close button & overlay click
    document.getElementById('btn-close-satisfaction')?.addEventListener('click', () => this.close());
    this.modal.addEventListener('click', (e) => {
      if (e.target === this.modal) this.close();
    });

    // Vibe buttons
    const vibeBtns = this.modal.querySelectorAll('.vibe-btn');
    vibeBtns.forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const target = e.currentTarget as HTMLElement;
        const vibe = target.dataset.vibe || '';
        const label = target.querySelector('span:last-child')?.textContent || vibe;

        vibeBtns.forEach((b) => b.classList.remove('active'));
        target.classList.add('active');
        this.selectedVibe = { id: vibe, label };
      });
    });

    // Highlights / Tags
    const tags = this.modal.querySelectorAll('.sat-tag');
    tags.forEach((tag) => {
      tag.addEventListener('click', (e) => {
        const target = e.currentTarget as HTMLElement;
        const tagId = target.dataset.tag || '';
        if (target.classList.contains('selected')) {
          target.classList.remove('selected');
          this.selectedTags.delete(tagId);
        } else {
          target.classList.add('selected');
          this.selectedTags.add(tagId);
        }
      });
    });

    // Submit button
    document.getElementById('btn-submit-satisfaction')?.addEventListener('click', () => this.handleSubmit());

    // Listen to global open triggers
    window.addEventListener('satisfaction:open', () => this.open());
  }

  static open() {
    if (!this.modal) this.modal = document.getElementById('modal-satisfaction');
    if (!this.modal) return;

    // Reset UI state
    this.selectedVibe = null;
    this.selectedTags.clear();

    const vibeBtns = this.modal.querySelectorAll('.vibe-btn');
    vibeBtns.forEach((b) => b.classList.remove('active'));

    const tags = this.modal.querySelectorAll('.sat-tag');
    tags.forEach((t) => t.classList.remove('selected'));

    const commentInput = document.getElementById('satisfaction-comment') as HTMLTextAreaElement;
    if (commentInput) commentInput.value = '';

    // Auto-select 'magical' as pleasant initial state
    const defaultBtn = this.modal.querySelector('.vibe-btn[data-vibe="magical"]') as HTMLElement;
    if (defaultBtn) {
      defaultBtn.classList.add('active');
      this.selectedVibe = { id: 'magical', label: 'Mágica' };
    }

    this.modal.classList.add('active');
  }

  static close() {
    if (this.modal) this.modal.classList.remove('active');
  }

  private static async handleSubmit() {
    if (!this.selectedVibe) {
      await RondaDialog.alert({
        title: 'Elige tu vibra',
        message: 'Por favor selecciona cómo sentiste la energía de la noche.',
        icon: '🥂'
      });
      return;
    }

    const commentInput = document.getElementById('satisfaction-comment') as HTMLTextAreaElement;
    const comment = commentInput ? commentInput.value.trim() : '';

    const feedbackData: SatisfactionData = {
      vibe: this.selectedVibe.id,
      vibeLabel: this.selectedVibe.label,
      tags: Array.from(this.selectedTags),
      comment: comment || undefined,
      timestamp: Date.now()
    };

    const submitBtn = document.getElementById('btn-submit-satisfaction') as HTMLButtonElement;
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = 'Sellando brindis...';
    }

    try {
      const user = Auth.currentUser;
      if (user && user.uid !== 'guest') {
        const updatedUser = {
          ...user,
          satisfactionFeedback: feedbackData
        };
        await DB.saveUser(updatedUser);
        Auth.currentUser = updatedUser;
      }

      this.close();

      await RondaDialog.alert({
        title: '¡Brindis Registrado!',
        message: '✨ Gracias por transmitirnos tu entusiasmo. Tu testimonio ayuda a que cada noche RONDA en Bogotá sea memorable.',
        icon: '🥂'
      });

      // Dispatch event for UI updates if any
      window.dispatchEvent(new CustomEvent('satisfaction:submitted', { detail: feedbackData }));
    } catch (err: any) {
      console.error('Error guardando satisfacción:', err);
      this.close();
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = '🥂 Sellar mi Experiencia';
      }
    }
  }
}
