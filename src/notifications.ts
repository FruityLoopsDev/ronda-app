import { db, auth, messaging } from './firebase-config';
import { collection, query, orderBy, onSnapshot, updateDoc, doc, writeBatch, Timestamp, setDoc } from 'firebase/firestore';
import { getToken } from 'firebase/messaging';
import { escapeHtml } from './utils.js';

export interface AppNotification {
  id: string;
  title: string;
  body: string;
  type: 'match' | 'reservation' | 'system' | 'alert';
  read: boolean;
  actionUrl?: string;
  createdAt: Timestamp;
}

class NotificationSystem {
  private panel: HTMLElement | null = null;
  private badge: HTMLElement | null = null;
  private list: HTMLElement | null = null;
  private container: HTMLElement | null = null;
  
  private notifications: AppNotification[] = [];
  private unsubscribe: (() => void) | null = null;

  init() {
    this.panel = document.getElementById('notification-panel');
    this.badge = document.getElementById('notification-badge');
    this.list = document.getElementById('notification-list');
    this.container = document.getElementById('toast-container');

    // Cerrar panel al hacer clic fuera
    document.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      if (this.panel?.classList.contains('active')) {
        if (!this.panel.contains(target) && !target.closest('#btn-notifications')) {
          this.panel.classList.remove('active');
        }
      }
    });

    // Escuchar cambios de auth
    auth.onAuthStateChanged((user) => {
      if (user) {
        this.subscribeToNotifications(user.uid);
        this.requestPushPermission(user.uid);
      } else {
        if (this.unsubscribe) this.unsubscribe();
        this.notifications = [];
        this.updateUI();
      }
    });
  }

  private async requestPushPermission(uid: string) {
    if (!messaging || !('Notification' in window)) return;

    try {
      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
        const swReg = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
        const currentToken = await getToken(messaging, { 
          serviceWorkerRegistration: swReg
        });
        
        if (currentToken) {
          await setDoc(doc(db, 'users', uid, 'pushTokens', currentToken), {
            token: currentToken,
            createdAt: Timestamp.now(),
            device: navigator.userAgent
          });
        }
      }
    } catch (error) {
      console.warn('Error configuring Push Notifications', error);
    }
  }

  togglePanel() {
    if (!this.panel) return;
    this.panel.classList.toggle('active');
  }

  private subscribeToNotifications(uid: string) {
    const q = query(collection(db, 'users', uid, 'notifications'), orderBy('createdAt', 'desc'));
    
    this.unsubscribe = onSnapshot(q, (snapshot) => {
      snapshot.docChanges().forEach((change) => {
        if (change.type === 'added') {
          const data = change.doc.data() as AppNotification;
          if (!data.read && Date.now() - data.createdAt.toMillis() < 10000) {
            this.showToast(data);
          }
        }
      });

      this.notifications = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AppNotification));
      this.updateUI();
    }, (error) => {
      console.warn('No se pudo suscribir a notificaciones:', error.message);
    });
  }

  private updateUI() {
    if (!this.badge || !this.list) return;

    const unreadCount = this.notifications.filter(n => !n.read).length;
    
    // Update Badge
    if (unreadCount > 0) {
      this.badge.style.display = 'flex';
      this.badge.textContent = unreadCount > 9 ? '9+' : unreadCount.toString();
    } else {
      this.badge.style.display = 'none';
    }

    // Update List
    if (this.notifications.length === 0) {
      this.list.innerHTML = '<div class="notif-empty">No hay notificaciones recientes</div>';
      return;
    }

    this.list.innerHTML = this.notifications.map(n => `
      <div class="notif-item ${n.read ? '' : 'unread'}" onclick="window.Notifications.handleNotifClick('${n.id}', '${n.actionUrl || ''}')">
        <div class="notif-icon">${this.getIconForType(n.type)}</div>
        <div class="notif-content">
          <h5>${escapeHtml(n.title)}</h5>
          <p>${escapeHtml(n.body)}</p>
          <span class="notif-time">${this.formatTime(n.createdAt)}</span>
        </div>
      </div>
    `).join('');
  }

  async handleNotifClick(id: string, actionUrl: string) {
    const user = auth.currentUser;
    if (!user) return;
    
    // Mark as read
    await updateDoc(doc(db, 'users', user.uid, 'notifications', id), { read: true });
    
    if (actionUrl && actionUrl !== 'undefined') {
      console.log('Redirecting to:', actionUrl);
      this.togglePanel();
    }
  }

  async markAllRead() {
    const user = auth.currentUser;
    if (!user) return;

    const unread = this.notifications.filter(n => !n.read);
    if (unread.length === 0) return;

    const batch = writeBatch(db);
    unread.forEach(n => {
      batch.update(doc(db, 'users', user.uid, 'notifications', n.id), { read: true });
    });
    await batch.commit();
  }

  showToast(notif: AppNotification | { title: string, body: string, type: 'match' | 'reservation' | 'system' | 'alert' }) {
    if (!this.container) return;

    const toast = document.createElement('div');
    toast.className = `toast-v2 ${notif.type}`;
    
    toast.innerHTML = `
      <div class="toast-icon">${this.getIconForType(notif.type)}</div>
      <div class="toast-text">
        <h4>${notif.title}</h4>
        <p>${notif.body}</p>
      </div>
      <button class="toast-close">&times;</button>
    `;

    this.container.appendChild(toast);
    
    // Animar entrada
    requestAnimationFrame(() => toast.classList.add('show'));

    // Cerrar
    const closeBtn = toast.querySelector('.toast-close');
    const closeToast = () => {
      toast.classList.remove('show');
      setTimeout(() => toast.remove(), 400);
    };
    closeBtn?.addEventListener('click', closeToast);
    
    // Auto-close after 5s
    setTimeout(closeToast, 5000);
  }

  // Compatibilidad con el viejo showToast(string)
  showLegacyToast(message: string) {
    this.showToast({
      title: 'Notificación',
      body: message,
      type: 'system'
    });
  }

  private getIconForType(type: string) {
    switch (type) {
      case 'match': return '✨';
      case 'reservation': return '📅';
      case 'alert': return '⚠️';
      default: return '🔔';
    }
  }

  private formatTime(timestamp: Timestamp) {
    if (!timestamp) return '';
    const date = timestamp.toDate();
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    
    if (diff < 60000) return 'Hace un momento';
    if (diff < 3600000) return `Hace ${Math.floor(diff/60000)} min`;
    if (diff < 86400000) return `Hace ${Math.floor(diff/3600000)} h`;
    return date.toLocaleDateString();
  }
}

const notifications = new NotificationSystem();

// Expose to window for inline onclick handlers
(window as any).Notifications = notifications;

export default notifications;
