// RONDA Luxury Global Dialog System (Vanilla, Zero Dependencies)
(function(window) {
  if (window.RondaDialog) return;

  function init() {
    let overlay = document.getElementById('modal-ronda-dialog');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'modal-ronda-dialog';
      overlay.className = 'ronda-dialog-overlay';
      overlay.innerHTML = `
        <div class="ronda-dialog-card" style="width:100%;max-width:390px;background:#1a1120;border:1px solid rgba(240,168,48,0.38);border-radius:24px;box-shadow:0 30px 80px rgba(0,0,0,0.9),0 0 50px rgba(240,168,48,0.16);overflow:hidden;">
          <div style="padding:28px 24px 24px;text-align:center;">
            <div id="dialog-icon-container" style="width:62px;height:62px;margin:0 auto 16px;border-radius:50%;background:rgba(240,168,48,0.12);border:1.5px solid rgba(240,168,48,0.45);display:flex;align-items:center;justify-content:center;font-size:28px;box-shadow:0 0 25px rgba(240,168,48,0.22);">
              <span id="dialog-icon">🍸</span>
            </div>
            <h3 id="dialog-title" style="font-family:'Bodoni Moda',Georgia,serif;font-size:22px;color:#f3ede2;margin:0 0 10px;font-weight:700;">Aviso RONDA</h3>
            <p id="dialog-message" style="font-family:'Space Grotesk',sans-serif;font-size:13.5px;color:#8c8378;line-height:1.5;margin:0 0 24px;word-break:break-word;"></p>
            <div style="display:flex;gap:10px;justify-content:center;">
              <button id="btn-dialog-cancel" type="button" style="flex:1;font-size:12.5px;padding:12px;border-radius:999px;background:rgba(243,237,226,.06);border:1px solid rgba(243,237,226,0.14);color:#8c8378;font-weight:600;cursor:pointer;font-family:'Space Grotesk',sans-serif;">✕ Cancelar</button>
              <button id="btn-dialog-confirm" type="button" style="flex:1;font-size:12.5px;padding:12px;border-radius:999px;background:#f0a830;border:1px solid #f0a830;color:#14101a;font-weight:700;cursor:pointer;font-family:'Space Grotesk',sans-serif;box-shadow:0 0 18px rgba(240,168,48,0.35);">✓ Entendido</button>
            </div>
          </div>
        </div>`;
      document.body.appendChild(overlay);
    }
    return overlay;
  }

  let resolvePromise = null;

  function show(opts) {
    const overlay = init();
    const titleEl = document.getElementById('dialog-title');
    const msgEl = document.getElementById('dialog-message');
    const iconEl = document.getElementById('dialog-icon');
    const iconContainer = document.getElementById('dialog-icon-container');
    const btnCancel = document.getElementById('btn-dialog-cancel');
    const btnConfirm = document.getElementById('btn-dialog-confirm');

    if (titleEl) titleEl.textContent = opts.title || 'Aviso RONDA';
    if (msgEl) msgEl.textContent = opts.message || '';
    if (iconEl) iconEl.textContent = opts.icon || (opts.type === 'danger' ? '⚠️' : '🍸');

    if (iconContainer) {
      if (opts.type === 'danger') {
        iconContainer.style.background = 'rgba(155,39,72,0.2)';
        iconContainer.style.borderColor = '#9B2748';
        iconContainer.style.boxShadow = '0 0 25px rgba(155,39,72,0.35)';
      } else {
        iconContainer.style.background = 'rgba(240,168,48,0.12)';
        iconContainer.style.borderColor = 'rgba(240,168,48,0.45)';
        iconContainer.style.boxShadow = '0 0 25px rgba(240,168,48,0.22)';
      }
    }

    if (btnCancel) {
      btnCancel.style.display = (opts.type === 'alert') ? 'none' : 'block';
      btnCancel.textContent = opts.cancelText || '✕ Cancelar';
      btnCancel.onclick = function() {
        close(false);
      };
    }

    if (btnConfirm) {
      btnConfirm.textContent = opts.confirmText || (opts.type === 'alert' ? '✓ Entendido' : '✓ Aceptar');
      btnConfirm.onclick = function() {
        close(true);
      };
    }

    overlay.classList.add('active');

    return new Promise(function(resolve) {
      resolvePromise = resolve;
    });
  }

  function close(res) {
    const overlay = document.getElementById('modal-ronda-dialog');
    if (overlay) overlay.classList.remove('active');
    if (resolvePromise) {
      resolvePromise(res);
      resolvePromise = null;
    }
  }

  const RondaDialog = {
    init: init,
    alert: function(options) {
      const opts = typeof options === 'string' ? { message: options } : options;
      opts.type = 'alert';
      return show(opts);
    },
    confirm: function(options) {
      const opts = typeof options === 'string' ? { message: options } : options;
      opts.type = opts.type || 'confirm';
      return show(opts);
    }
  };

  window.RondaDialog = RondaDialog;

  // Global override of window.alert to intercept any native alert in standalone pages
  const originalAlert = window.alert;
  window.alert = function(msg) {
    if (document.body) {
      RondaDialog.alert(msg);
    } else {
      originalAlert(msg);
    }
  };
})(window);
