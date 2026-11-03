/**
 * scripts/rotate-password.cjs
 * Rotación segura de claves Firebase Auth (modo CLI, sin texto plano en repo)
 *
 * Uso:
 *   node scripts/rotate-password.cjs <newPassword> [email]
 */

const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
const newPassword = args[0];
const targetEmail = args[1] || 'cesar@ronda.uno';

if (!newPassword) {
  console.error('❌ Uso: node scripts/rotate-password.cjs <nueva-contraseña> [email]');
  console.error('   Ejemplo: node scripts/rotate-password.cjs MiContraseñaSegura123!');
  process.exit(1);
}

if (newPassword.length < 6) {
  console.error('❌ La contraseña debe tener al menos 6 caracteres.');
  process.exit(1);
}

function getFirebaseCliToken() {
  try {
    const configPath = path.join(process.env.USERPROFILE || process.env.HOME, '.config', 'configstore', 'firebase-tools.json');
    if (fs.existsSync(configPath)) {
      const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      if (config.tokens && config.tokens.access_token) {
        return config.tokens.access_token;
      }
    }
  } catch (e) {
    // Fallback a gcloud si falla lectura
  }
  return null;
}

async function rotatePassword() {
  const token = getFirebaseCliToken();
  if (!token) {
    console.error('❌ No se encontró token activo de Firebase CLI en firebase-tools.json.');
    console.error('   Ejecuta `npx firebase login` primero.');
    process.exit(1);
  }

  const endpoint = 'https://identitytoolkit.googleapis.com/v1/projects/ronda-uno/accounts:update';

  const body = {
    localId: 'hVX2RL2xJhRFurJJsAgdyVIaDT53',
    password: newPassword,
    returnSecureToken: true
  };

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });

    const data = await response.json();

    if (data.error) {
      console.error('❌ Error de Firebase:', data.error.message || data.error);
      process.exit(1);
    }

    console.log('✅ Contraseña actualizada exitosamente en Firebase Producción para:', targetEmail);
    console.log('🔑 UID:', data.localId);
  } catch (err) {
    console.error('❌ Error de red al rotar contraseña:', err.message);
    process.exit(1);
  }
}

rotatePassword();
