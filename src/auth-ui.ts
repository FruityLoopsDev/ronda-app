import { Auth } from './auth.js';
import { RondaDialog } from './dialog.js';

export function initAuthForm(onSuccess: () => void) {
  const btnToggle = document.getElementById('btn-toggle-admin-login');
  if (btnToggle) {
    btnToggle.addEventListener('click', () => {
      document.getElementById('waitlist-container')!.style.display = 'none';
      document.getElementById('login-container')!.style.display = 'block';
    });
  }

  const btnRealLogin = document.getElementById('btn-real-login');
  if (btnRealLogin) {
    btnRealLogin.addEventListener('click', async (e) => {
      e.preventDefault();
      const email = (document.getElementById('login-email') as HTMLInputElement).value;
      const password = (document.getElementById('login-password') as HTMLInputElement).value;
      if (email && password) {
        btnRealLogin.textContent = 'Cargando...';
        (btnRealLogin as HTMLButtonElement).disabled = true;
        try {
          await Auth.loginWithEmail(email, password);
          onSuccess();
        } catch (err: any) {
          await RondaDialog.alert({
            title: 'Error de Acceso',
            message: err.message || 'No se pudo iniciar sesión. Verifica tus credenciales.',
            icon: '❌',
            type: 'danger'
          });
        } finally {
          btnRealLogin.textContent = 'Ingresar';
          (btnRealLogin as HTMLButtonElement).disabled = false;
        }
      }
    });
  }
}
