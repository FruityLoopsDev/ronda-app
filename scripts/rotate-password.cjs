/**
 * scripts/rotate-password.cjs
 * Rotación segura de claves Firebase Auth (modo CLI, sin texto plano en repo)
 *
 * Uso:
 *   node scripts/rotate-password.cjs <newPassword>
 *
 * La nueva contraseña se envía directamente vía ambiente constante al endpoint
 * Identity Toolkit, manteniendo la clave fuera del repo (ningún texto plano
 * queda almacenado en ningún archivo).
 *
 * Requiere:
 *   - VITE_FIREBASE_API_KEY o --api-key (opcional)
 *   - Reiniciar sesión del usuario en la app después de la rotación
 */

const apiKey = process.env.VITE_FIREBASE_API_KEY || 'AIzaSyA55U4CwLAv5tlNPGvO-OkRBB0qJHbTNKQ';

const args = process.argv.slice(2);
const newPassword = args[0];

if (!newPassword) {
  console.error('❌ Uso: node scripts/rotate-password.cjs <nueva-contraseña>');
  console.error('   Ejemplo: node scripts/rotate-password.cjs MiContraseñaSegura123!');
  process.exit(1);
}

// Validación básica de longitud
if (newPassword.length < 6) {
  console.error('❌ La contraseña debe tener al menos 6 caracteres.');
  process.exit(1);
}

const userId = 'cesar@ronda.uno';
const endpoint = `https://identitytoolkit.googleapis.com/v1/accounts:update?key=${apiKey}`;

const body = {
  identifier: userId,
  password: newPassword,
  returnSecureToken: true,
};

async function rotatePassword() {
  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    const data = await response.json();

    if (data.error) {
      console.error('❌ Error de Firebase:', data.error.message || data.error);
      process.exit(1);
    }

    console.log('✅ Contraseña rotada exitosamente para:', userId);
    console.log('🔑 ID Token:', data.idToken ? data.idToken.substring(0, 20) + '...' : 'no disponible');
    console.log('⚠️  El usuario DEBE reiniciar sesión después de la rotación.');
  } catch (err) {
    console.error('❌ Error de red al rotar contraseña:', err.message);
    process.exit(1);
  }
}

rotatePassword();
