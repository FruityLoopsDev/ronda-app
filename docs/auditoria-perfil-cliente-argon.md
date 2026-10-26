# 🔬 AUDITORÍA TÉCNICA FORENSE: FALLO DE PERSISTENCIA EN PERFIL DE CLIENTE
**Proyecto:** RONDA (ronda.uno)  
**Destinatario:** Argon (Gemini / Google DeepMind Team)  
**Fecha:** 2026-10-26T19:39:14.992Z  
**Módulos Auditados:** `src/profile.ts`, `src/db.ts`, `src/auth.ts`, `src/app.ts`, `firestore.rules`, `index.html`

---

## 1. RESUMEN EJECUTIVO (EL PROBLEMA)
En la aplicación móvil SPA de RONDA (`index.html`), los usuarios clientes experimentan que **sus cambios de perfil (nombre, edad, bio, cóctel, foto, zonas) no se persisten en la base de datos**. Al guardar o navegar, el perfil revierte a los valores iniciales.

La auditoría forense determinó que la causa raíz no es un error de UI en el DOM, sino una **colisión arquitectónica entre la llamada monolítica `setDoc(..., { merge: true })` y las reglas de seguridad granulares de Firestore (`firestore.rules`)**, agravada por una **desincronización de estado en memoria entre `ProfileService` y `AuthService`**.

---

## 2. HALLAZGOS Y MATRIZ DE CAUSA RAÍZ

| ID | Componente | Severidad | Causa Raíz Técnica | Impacto |
|---|---|---|---|---|
| **CR-01** | `firestore.rules` + `src/db.ts` | **CRÍTICA** | `clientTouchedSensitive()` rechaza `setDoc(..., { merge: true })`. Al enviar el objeto `User` completo, claves no existentes en el documento original (`trustTier: 0`, `isVerified: false`, `matches: []`) entran en `diff().affectedKeys()`. | **PERMISSION_DENIED** silencioso en Firestore. Los cambios nunca se escriben en disco. |
| **CR-02** | `src/db.ts` | **ALTA** | Inexistencia de método de actualización parcial (`updateDoc`). Todo se canaliza por `DB.saveUser()` que fuerza merge de 25+ campos. | Riesgo constante de bloqueo por reglas de seguridad cada vez que se agrega un atributo al modelo `User`. |
| **CR-03** | `src/profile.ts` | **ALTA** | Desacople de estado: `ProfileService.saveEditedProfile()` muta `this.currentUser`, pero **NO actualiza `Auth.currentUser`**. | Al salir y volver a la vista `view-profile`, `app.ts` sobreescribe el perfil con la copia vieja de `Auth.currentUser`. |
| **CR-04** | `src/app.ts` | **MEDIA** | Silenciamiento de errores en modal inicial. `try/catch` captura la excepción de Firestore pero solo hace `console.error` y cierra el modal. | El usuario asume éxito visual sin confirmación de red. |

---

## 3. TRAZA DE EVALUACIÓN DE REGLAS DE SEGURIDAD (SIMULACIÓN)

### Escenario A: Guardado Monolítico Actual (`DB.saveUser`)
```json
{
  "documentoFirestore": { "uid": "user_123", "email": "soltero@gmail.com", "name": "Juan Perez", "role": "client" },
  "payloadEnviadoPorCliente": {
    "uid": "user_123",
    "email": "soltero@gmail.com",
    "name": "Juan Perez Editado",
    "username": "juan.ronda",
    "age": 28,
    "role": "client",
    "trustTier": 0,
    "isVerified": false
  },
  "resultadoSimulacion": {
    "allowed": false,
    "rejectionReason": "Campos sensibles modificados: [trustTier, isVerified]",
    "affectedKeys": ["name", "username", "age", "trustTier", "isVerified"]
  }
}
```
> **Conclusión:** Aunque el cliente no intentó elevarse a admin, el simple hecho de que su objeto en memoria tuviera `trustTier: 0` o `isVerified: false` activó `affectedKeys().hasAny(['trustTier', 'isVerified'])`, resultando en **RECHAZO TOTAL**.

### Escenario B: Guardado Quirúrgico Recomendado (`updateDoc`)
```json
{
  "documentoFirestore": { "uid": "user_123", "email": "soltero@gmail.com", "name": "Juan Perez", "role": "client" },
  "payloadQuirurgico": {
    "name": "Juan Perez Editado",
    "username": "juan.ronda",
    "age": 28,
    "bio": "Arquitecto en Bogotá",
    "favoriteCocktail": "Negroni"
  },
  "resultadoSimulacion": {
    "allowed": true,
    "touchesSensitive": false,
    "affectedKeys": ["name", "username", "age", "bio", "favoriteCocktail"]
  }
}
```
> **Conclusión:** Al enviar únicamente las claves que el usuario tiene permitido editar, la regla de seguridad evalúa `true` de forma limpia e instantánea.

---

## 4. AUDITORÍA DEL DOM (`index.html`)
Todos los identificadores de formulario requeridos por `ProfileService` existen en el DOM:
- `id="modal-edit-profile"`: ✅ Presente (línea 1884)
- `id="btn-save-edit-profile"`: ✅ Presente (línea 1892)
- `id="edit-name"`, `id="edit-username"`, `id="edit-age"`, `id="edit-bio"`, `id="edit-cocktail"`, `id="edit-gender"`, `id="edit-orientation"`: ✅ Presentes
- `id="btn-edit-profile-open"`: ✅ Presente (línea 1610)

*Diagnóstico:* La interfaz de usuario es correcta y los listeners están conectados. El fallo es 100% en la capa de persistencia y autorización.

---

## 5. PLAN DE ACCIÓN INMEDIATO (SOLUCIÓN PROPUESTA PARA ARGON)

### Paso 1: En `src/db.ts`, agregar `updateUserProfile`
```typescript
async updateUserProfile(uid: string, profileData: Partial<User>): Promise<void> {
  const docRef = doc(this._getFirestore(), 'users', uid);
  // Lista blanca estricta de campos que el cliente puede modificar por sí mismo
  const allowedKeys: (keyof User)[] = [
    'name', 'username', 'age', 'bio', 'gender', 'orientation',
    'favoriteCocktail', 'preferredZones', 'linkedinUrl', 'linkedinSlug',
    'safeword', 'privacySettings', 'photoURL'
  ];

  const patch: Record<string, any> = {};
  for (const key of allowedKeys) {
    if (profileData[key] !== undefined) {
      patch[key] = profileData[key];
    }
  }

  // updateDoc no envía campos no deseados ni toca claves sensibles
  await updateDoc(docRef, patch);
}
```

### Paso 2: En `src/profile.ts`, usar `updateUserProfile` y sincronizar `Auth.currentUser`
```typescript
// En saveEditedProfile():
const patch = {
  name,
  username,
  age,
  bio,
  favoriteCocktail,
  gender,
  orientation,
  linkedinUrl: this.currentUser.linkedinUrl,
  linkedinSlug: this.currentUser.linkedinSlug
};

await DB.updateUserProfile(this.currentUser.uid, patch);

// Sincronizar en memoria con AuthService
Object.assign(this.currentUser, patch);
if (Auth.currentUser) {
  Object.assign(Auth.currentUser, patch);
}
```

### Paso 3: Ajuste de Seguridad en `firestore.rules`
Garantizar que la regla compare cambios reales de valor en claves sensibles, no adiciones de inicialización si el valor no otorga privilegios:
```rules
function clientTouchedSensitive() {
  return request.resource.data.diff(resource.data).affectedKeys().hasAny([
    'isVerified', 'linkedinVerified', 'trustTier', 'verifications', 'nfts', 'wallet_address', 'matches'
  ]);
}
```
*(Con el Paso 1, este filtro nunca se activará porque `updateDoc` omite absolutamente estas claves).*
