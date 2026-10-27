import { DB } from './db.js';
import { Auth } from './auth.js';
import { Profile } from './profile.js';

export interface IcebreakerQuestion {
  id: string;
  title: string;
  options: { label: string; icon: string; value: string }[];
}

export const ICEBREAKER_QUESTIONS: IcebreakerQuestion[] = [
  {
    id: 'pets',
    title: 'El eterno debate',
    options: [
      { label: 'Perros', icon: '🐶', value: 'dogs' },
      { label: 'Gatos', icon: '🐱', value: 'cats' }
    ]
  },
  {
    id: 'drink',
    title: 'En la barra pides...',
    options: [
      { label: 'Vino Tinto', icon: '🍷', value: 'wine' },
      { label: 'Cerveza', icon: '🍺', value: 'beer' }
    ]
  },
  {
    id: 'vacation',
    title: 'Para desconectar',
    options: [
      { label: 'Playa', icon: '🏖️', value: 'beach' },
      { label: 'Montaña', icon: '🏔️', value: 'mountain' }
    ]
  },
  {
    id: 'food',
    title: 'Antojo de medianoche',
    options: [
      { label: 'Pizza', icon: '🍕', value: 'pizza' },
      { label: 'Sushi', icon: '🍣', value: 'sushi' },
      { label: 'Burger', icon: '🍔', value: 'burger' },
      { label: 'Tacos', icon: '🌮', value: 'tacos' }
    ]
  },
  {
    id: 'kids',
    title: '¿Hijos a futuro?',
    options: [
      { label: 'Sí', icon: '👶', value: 'yes' },
      { label: 'No', icon: '🚫', value: 'no' },
      { label: 'Tal vez', icon: '🤷', value: 'maybe' }
    ]
  }
];

export class Icebreakers {
  static answers: Record<string, string> = {};
  static currentIdx = 0;
  static container: HTMLElement | null = null;
  static modal: HTMLElement | null = null;

  static init() {
    this.modal = document.getElementById('modal-icebreakers');
    this.container = document.getElementById('icebreaker-deck');

    document.getElementById('btn-start-icebreakers')?.addEventListener('click', () => this.open());
    document.getElementById('btn-close-icebreakers')?.addEventListener('click', () => this.close());
  }

  static open() {
    if (!this.modal || !this.container) return;
    this.answers = {};
    this.currentIdx = 0;
    this.renderDeck();
    this.modal.classList.add('active');
  }

  static close() {
    if (this.modal) this.modal.classList.remove('active');
  }

  static renderDeck() {
    if (!this.container) return;
    this.container.innerHTML = '';
    
    // Render cards backwards so first is on top
    for (let i = ICEBREAKER_QUESTIONS.length - 1; i >= 0; i--) {
      const q = ICEBREAKER_QUESTIONS[i];
      const card = document.createElement('div');
      card.className = 'coaster-card';
      card.dataset.index = i.toString();
      card.dataset.id = q.id;
      
      // Styling for stack effect
      const offset = i * 4;
      card.style.transform = `translateY(${offset}px) scale(${1 - i * 0.05})`;
      card.style.zIndex = (100 - i).toString();

      let optionsHtml = '';
      q.options.forEach(opt => {
        optionsHtml += `
          <button class="coaster-btn" data-value="${opt.value}">
            <span class="c-icon">${opt.icon}</span>
            <span class="c-label">${opt.label}</span>
          </button>
        `;
      });

      card.innerHTML = `
        <div class="coaster-inner">
          <p class="coaster-count">${i + 1} / ${ICEBREAKER_QUESTIONS.length}</p>
          <h3 class="coaster-title">${q.title}</h3>
          <div class="coaster-options layout-${q.options.length}">
            ${optionsHtml}
          </div>
        </div>
      `;

      // Add event listeners to buttons
      const btns = card.querySelectorAll('.coaster-btn');
      btns.forEach(btn => {
        btn.addEventListener('click', (e) => {
          const val = (e.currentTarget as HTMLElement).dataset.value;
          this.handleAnswer(q.id, val || '', card);
        });
      });

      this.container.appendChild(card);
    }
  }

  static handleAnswer(questionId: string, answer: string, cardEl: HTMLElement) {
    this.answers[questionId] = answer;
    
    // Swipe out animation
    cardEl.classList.add('swipe-out');
    
    setTimeout(() => {
      cardEl.remove();
      this.currentIdx++;
      this.updateStackVisuals();

      if (this.currentIdx >= ICEBREAKER_QUESTIONS.length) {
        this.finish();
      }
    }, 400);
  }

  static updateStackVisuals() {
    if (!this.container) return;
    const cards = Array.from(this.container.querySelectorAll('.coaster-card')) as HTMLElement[];
    cards.forEach((card, idx) => {
      // Re-calculate visual stack based on remaining cards
      const reverseIdx = cards.length - 1 - idx;
      const offset = reverseIdx * 4;
      card.style.transform = `translateY(${offset}px) scale(${1 - reverseIdx * 0.05})`;
    });
  }

  static async finish() {
    if (!this.container) return;
    this.container.innerHTML = `
      <div class="coaster-success">
        <div class="c-icon" style="font-size:48px; margin-bottom:16px;">🍸</div>
        <h3>¡Trago listo!</h3>
        <p>Tus rompehielos han sido guardados. Serán un gran inicio de conversación en tu próxima ronda.</p>
        <button id="btn-done-icebreakers" class="btn luz mt-2">Excelente</button>
      </div>
    `;

    document.getElementById('btn-done-icebreakers')?.addEventListener('click', () => {
      this.close();
    });

    // Save to user profile
    const user = Auth.currentUser;
    if (user && user.uid !== 'guest') {
      try {
        await DB.updateUserProfile(user.uid, { icebreakers: this.answers });
        const updatedUser = { ...user, icebreakers: this.answers };
        Auth.currentUser = updatedUser;
        Profile.setCurrentUser(updatedUser);
      } catch (err) {
        console.error("Error guardando preferencias:", err);
      }
    }
  }
}
