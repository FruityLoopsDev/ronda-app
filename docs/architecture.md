# Arquitectura del Sistema (RONDA)

## Visión General
RONDA es una Single Page Application (SPA) orientada al ecosistema B2B2C (Business to Business to Consumer), diseñada para la industria del entretenimiento nocturno (Bares/Discotecas).

El proyecto está diseñado bajo una arquitectura sin servidor (Serverless) haciendo uso de Firebase, con un diseño modular en Vanilla JS para maximizar el rendimiento y mantener la independencia de frameworks pesados en su fase inicial (MVP).

## Patrón de Diseño
Se emplea un patrón MVC (Modelo-Vista-Controlador) simplificado en el cliente:
- **Modelo**: `db.js` (Abstracción de la base de datos).
- **Controlador**: `app.js` (Orquestador y Router), `auth.js` (Sesiones), `ronda-core.js` (Algoritmo).
- **Vista**: `index.html` (Manejo de DOM dinámico con clases `.hidden` y `.active`).

## Estructura de Entornos (Dual-Mode)
La arquitectura está diseñada para funcionar en dos entornos intercambiables a través del flag `DEMO_MODE` en `firebase-config.js`:
1. **Modo Demo (In-Memory)**: Utilizado para pruebas sin conexión, QA, y rondas de inversión. Todo el estado (usuarios, eventos, colisiones) vive en la memoria RAM y se puebla mediante `seed.js`.
2. **Modo Producción (Firebase)**: Conecta nativamente con Firestore (Realtime DB/Document DB) y Firebase Auth.

## Módulos Core
- **`app.js` / `config.js`**: Orquestación e inyección asíncrona de dependencias.
- **`bar.js`**: Consola en tiempo real del anfitrión (Admin). Permite controlar el flujo del evento (estado de sala, rondas).
- **`client.js`**: Dashboard reactivo para el cliente final (Participante). Maneja notificaciones en tiempo real, temporizadores de mesa y alertas de seguridad.
- **`verification.js`**: Capa de seguridad y Onboarding (Geolocalización + KYC OCR/Biometría).
- **`matches.js`**: Lógica asíncrona Post-Evento para descubrir matches mutuos y manejar recompensas (Cupones) y salas temporales de chat (TTL de 72h).
