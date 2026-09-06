# Tareas Realizadas para Cline

- [x] **1. Limpieza de CDNs Redundantes en `index.html`:** 
  - Eliminar el bloque `<script type="module">` que carga Firebase desde CDN externo (`https://www.gstatic.com/firebasejs/10.8.1/...`).
  - La app usa Vite y ya importa Firebase de forma segura desde `node_modules` en `src/firebase-config.ts`.

- [x] **2. Persistencia Offline en `src/firebase-config.ts`:** 
  - Importar `initializeFirestore`, `persistentLocalCache` y `persistentMultipleTabManager` desde `firebase/firestore`.
  - Reemplazar `getFirestore(app)` por `initializeFirestore(app, { localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }) })` (o `enableIndexedDbPersistence`) para habilitar carga instantánea desde IndexedDB en segundo plano.

- [x] **3. AbortController con Timeout en `src/api-client.ts`:** 
  - En la clase `ApiClient` método `post()`, agregar un timeout de 4 segundos usando `AbortSignal.timeout(4000)` o `AbortController`.
  - Evita que peticiones suspendidas o frías hacia Vercel congelen la interfaz antes de activar el fallback local.

- [x] **4. Optimización de Fuentes en `index.html`:** 
  - Verificar y asegurar que las URLs de Google Fonts tengan `&display=swap` activado para evitar el texto invisible (FOIT) durante la carga inicial.

- [x] **5. Verificación de Compilación:** 
  - Ejecutar `npx tsc --noEmit` en la terminal.
  - Ejecutar `npm run build` para confirmar que el bundle de producción empaqueta correctamente sin errores.
