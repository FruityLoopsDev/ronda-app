const fs = require('fs');
const path = require('path');

const htmlPath = path.join(__dirname, 'index.html');
let content = fs.readFileSync(htmlPath, 'utf8');

const newAuthLobbyHTML = `
  <!-- Vista: Login / Auth -->
  <section id="view-auth" class="panel on">
    <div class="fila" style="justify-content: center; margin-top: 40px;">
      <div class="tel">
        <div class="tel-in" style="min-height: auto; padding-bottom: 20px;">
          <div class="status"><span>RONDA</span><span>Auth</span></div>
          <div class="pant text-center" style="text-align: center;">
            <div class="cab-pant" style="justify-content: center;">
              <h3>Bienvenido</h3>
            </div>
            <p class="detalle" style="margin-bottom: 20px;">Inicia sesión o crea una cuenta.</p>
            
            <!-- FORM LOGIN -->
            <div id="login-form" class="acciones" style="flex-direction: column;">
              <input type="email" id="login-email" placeholder="Correo electrónico" class="ronda-input">
              <input type="password" id="login-password" placeholder="Contraseña" class="ronda-input">
              <button id="btn-real-login" class="btn ambar">Ingresar</button>
              <button id="btn-show-register" class="btn" style="background: transparent; margin-top: 10px; font-size: 12px;">¿No tienes cuenta? Regístrate</button>
            </div>

            <!-- FORM REGISTRO SUTIL (2 PASOS) -->
            <div id="register-form" class="acciones" style="flex-direction: column; display: none;">
              
              <!-- Paso 1 -->
              <div id="reg-step-1">
                <input type="email" id="reg-email" placeholder="Correo electrónico" class="ronda-input">
                <input type="password" id="reg-password" placeholder="Crea una contraseña" class="ronda-input">
                <button id="btn-next-step" class="btn ambar">Continuar</button>
              </div>

              <!-- Paso 2 -->
              <div id="reg-step-2" style="display: none; text-align: left;">
                <p style="font-size: 11px; margin-bottom: 10px; color: var(--humo);">Último paso para completar tu perfil</p>
                <input type="text" id="reg-name" placeholder="Tu Nombre (Ej. Juan)" class="ronda-input">
                <div style="display: flex; gap: 10px;">
                  <input type="number" id="reg-age" placeholder="Edad" class="ronda-input" style="flex: 1;">
                  <select id="reg-gender" class="ronda-input" style="flex: 1;">
                    <option value="" disabled selected>Género</option>
                    <option value="Hombre">Hombre</option>
                    <option value="Mujer">Mujer</option>
                    <option value="Otro">Otro</option>
                  </select>
                </div>
                <select id="reg-interest" class="ronda-input" style="margin-top: 10px; width: 100%;">
                  <option value="" disabled selected>Me interesa conocer...</option>
                  <option value="Mujeres">Mujeres</option>
                  <option value="Hombres">Hombres</option>
                  <option value="Ambos">Ambos</option>
                </select>
                <button id="btn-real-register" class="btn ambar" style="margin-top: 15px; width: 100%;">Crear Cuenta y Entrar</button>
              </div>

              <button id="btn-show-login" class="btn" style="background: transparent; margin-top: 10px; font-size: 12px;">Volver al Login</button>
            </div>

          </div>
        </div>
      </div>
    </div>
  </section>

  <!-- Vista: Lobby / Discovery (Esta Semana) -->
  <section id="view-lobby" class="panel">
    <div style="display: flex; justify-content: space-between; align-items: baseline;">
      <h2 class="h2" style="font-size: 42px; line-height: 1.1; margin-bottom: 20px;">Esta<br>semana</h2>
      <div style="text-align: right; color: var(--humo); font-family: var(--font-mono); font-size: 10px; text-transform: uppercase;">
        25-34 - Zona G
      </div>
    </div>
    
    <div class="fila" style="justify-content: center;">
      <div class="tel" style="width: 100%; max-width: 400px; padding: 0;">
        <div class="tel-in" style="min-height: auto; padding: 15px 10px; background: transparent; border: none; box-shadow: none;">
          
          <div id="discovery-feed" style="display: flex; flex-direction: column; gap: 15px;">
            <!-- Renderizado dinámicamente desde client.ts -->
          </div>

          <div style="border: 1px dashed var(--ambar); border-radius: 12px; padding: 15px; margin-top: 20px; font-size: 11px; color: var(--humo); line-height: 1.4;">
            <p style="margin: 0;">Si el jueves no se equilibra antes de las <b>20:00 del martes</b>, se cancela y te devolvemos el importe + $20.000 de saldo.</p>
          </div>
          
          <div style="text-align: center; margin-top: 20px; font-family: var(--font-mono); font-size: 9px; color: var(--humo); letter-spacing: 0.1em;">
            DESCUBRIR - PRECIO POR ESCASEZ DE LADO
          </div>
        </div>
      </div>
    </div>
  </section>
`;

// Extract between <!-- Vista: Login / Auth --> and <!-- Vista: Cliente -->
const startMarker = '<!-- Vista: Login / Auth -->';
const endMarker = '<!-- Vista: Cliente -->';

const startIndex = content.indexOf(startMarker);
const endIndex = content.indexOf(endMarker);

if (startIndex !== -1 && endIndex !== -1) {
  content = content.substring(0, startIndex) + newAuthLobbyHTML + '\n  ' + content.substring(endIndex);
  
  // Also add some CSS for ronda-input
  if (!content.includes('.ronda-input')) {
    const css = `
    <style>
      .ronda-input {
        margin-bottom: 10px; padding: 12px; border-radius: 8px; border: 1px solid var(--linea); 
        background: rgba(243,237,226,.06); color: var(--papel); outline: none; 
        font-family: 'Space Grotesk', sans-serif; width: 100%; box-sizing: border-box;
      }
      .ronda-input:focus { border-color: var(--ambar); }
      .noche-card.lobby-card { border: 1px solid var(--linea); padding: 15px; text-align: left; }
      .noche-card.lobby-card.escaso { border-color: var(--ambar); }
      .noche-card.lobby-card.ok { border-color: var(--botella); }
      .noche-card.lobby-card h4 { font-family: var(--font-display); font-size: 20px; margin: 4px 0 8px; }
      .noche-card.lobby-card .meta { font-family: var(--font-mono); font-size: 10px; color: var(--humo); text-transform: uppercase; letter-spacing: 0.05em; }
      .noche-card.lobby-card .price { font-size: 22px; font-weight: 700; margin-top: 10px; color: var(--luz); }
      .btn-outline { background: transparent; border: 1px solid var(--ambar); color: var(--ambar); border-radius: 20px; padding: 4px 12px; font-size: 10px; font-family: var(--font-mono); text-transform: uppercase; letter-spacing: 0.05em; cursor: pointer;}
      .btn-outline.verde { border-color: var(--botella); color: var(--botella); }
      .btn-outline.gris { border-color: var(--linea); color: var(--humo); }
    </style>
    `;
    content = content.replace('</head>', css + '</head>');
  }

  fs.writeFileSync(htmlPath, content);
  console.log("HTML successfully updated.");
} else {
  console.log("Markers not found.");
}
