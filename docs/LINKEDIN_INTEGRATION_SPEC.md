# RONDA — Especificación de integración segura con LinkedIn

Documento de trabajo para Google Antigravity / programador responsable

Versión: 1.0 · Fecha de investigación: 5 de octubre de 2026
Estado: especificación propuesta; no implica cambios ejecutados ni aprobación de LinkedIn.
Idioma de producto: español de Colombia.
Prioridad: preservar funcionamiento actual, impedir verificaciones falsificadas y mantener costos controlados.

## 0. Instrucción principal para Antigravity

Actúa como arquitecto full-stack, ingeniero de identidad y responsable de seguridad de RONDA. Inspecciona el repositorio real antes de modificarlo. Implementa autenticación oficial de LinkedIn usando OpenID Connect y prepara una integración separada con Verified on LinkedIn Development/Lite. Mantén Firebase Auth como identidad interna si confirma la auditoría que es el sistema actual. No sustituyas toda la autenticación ni migres el framework sin necesidad.

Primero entrega un diagnóstico, un mapa de archivos afectados y un plan. Después realiza cambios locales incrementales, pruebas y documentación. No despliegues, contrates servicios, actives facturación, aceptes términos comerciales ni cambies configuración productiva sin autorización del propietario. Nunca pidas pegar secretos en el chat ni los imprimas en terminal.

Distingue siempre:
- Cuenta autenticada: control de una cuenta de LinkedIn mediante OIDC.
- Identidad verificada por LinkedIn: categoría IDENTITY recibida del servidor oficial.
- Vinculación laboral verificada: categoría WORKPLACE recibida del servidor oficial.
- Identidad verificada por RONDA: procedimiento independiente que no se reemplaza automáticamente.

No presentes OIDC, correo verificado, fotografía, URL de perfil, cargo declarado ni semejanza facial como prueba documental de identidad. No prometas comprobación de edad, antecedentes, ausencia de fraude o seguridad física.

## 1. Objetivos y alcance

### 1.1 Objetivos obligatorios

1. Agregar un medio opcional de inicio de sesión oficial de LinkedIn.
2. Permitir conectar y desconectar LinkedIn de una cuenta RONDA existente.
3. Evitar duplicación y apropiación de cuentas mediante vinculación por correo.
4. Preparar consultas de verificación sin depender de Plus.
5. Mostrar categorías de confianza con textos honestos y origen explícito.
6. Impedir que navegador, usuario o staff ordinario falsifiquen indicadores de confianza.
7. Mantener pagos, tickets, roles, eventos, emparejamientos y onboarding actuales.
8. Ofrecer fallback cuando no exista aprobación Lite, el miembro no sea elegible o LinkedIn falle.
9. Documentar costos de infraestructura por separado del precio de las APIs.
10. Proporcionar pruebas reproducibles y evidencia de funcionamiento.

### 1.2 Fuera de alcance inicial

- Scraping, automatización del sitio, cookies de sesión ajenas o APIs no oficiales.
- Acceso a conexiones, mensajes, historial laboral o datos públicos masivos.
- Integración Plus, datos legales verificados y validación en lote.
- Cambiar pasarela de pagos, lógica de entradas o algoritmo de eventos.
- Reemplazar controles presenciales, selfie/documento o política de edad.
- Crear una arquitectura global nueva para resolver un botón de login.
- Hacer obligatoria la cuenta LinkedIn para asistir, sin decisión expresa de negocio.

## 2. Evidencia del proyecto

Las observaciones siguientes provienen de archivos examinados en el proyecto; Antigravity debe confirmarlas en la rama de trabajo, que puede haber cambiado.

| Archivo | Observación comprobada | Consecuencia |
|---|---|---|
| `ronda-app/package.json` | Usa TypeScript, Vite y SDK Firebase; scripts de desarrollo y build. | Integración incremental; no asumir React, Next.js ni SDK empresarial de identidad. |
| `ronda-app/vite.config.ts` | Build multipágina con entradas HTML; servidor Vite en puerto 5000. | Aunque hay comportamiento de aplicación, no tratar todo el repositorio como SPA pura. |
| `ronda-app/firebase.json` | Hosting estático, reglas Firestore y rewrites hacia HTML; no declara Functions en lo examinado. | No asumir callback backend existente; rutas API deben resolverse antes de fallback HTML. |
| `ronda-app/firestore.rules` | En `users/{uid}`, el propietario puede actualizar si conserva `role` y `hasTicket`; permite creación propia con rol client. | Campos nuevos en users no quedan protegidos automáticamente. Riesgo de autoverificación. |
| `ronda-app/firestore.rules` | Staff puede leer users; roles incluyen client, sales, network, admin y superadmin. | No poner secretos o claims privados en documentos que el staff pueda leer. |
| `ronda-app/.env.template` | Contiene parámetros ajenos a LinkedIn y puertos de emulador. | Extender sin borrar lo existente; revisar discrepancia 8080 en template y 8081 en firebase.json. |
| `ronda-app/README.md` | Describe verificación de identidad con selfie y documento previa al primer evento. | LinkedIn no reemplaza ese procedimiento sin aprobación del negocio. |

No se ha confirmado la implementación concreta de login, custom claims, rutas TypeScript, webhook, backend, despliegue actual ni plan de Firebase. Un comentario en reglas sobre un webhook no prueba que esté desplegado.

### 2.1 Auditoría inicial requerida

Localiza y registra rutas reales de:
- Inicialización Firebase y tratamiento de Auth.
- Registro, inicio de sesión, logout, recuperación y persistencia.
- Creación/actualización de users y asignación de roles.
- Formularios de perfil y estado de verificación actual.
- Emisión de entradas y cualquier autorización asociada a identidad.
- Panel staff y permisos administrativos.
- Uso de localStorage, IndexedDB y service worker.
- Backend, si existe, y configuración de CI/CD.
- Variables de entorno y cualquier secreto accidental en código o historial.

Busca referencias como `verified`, `isVerified`, `identity`, `linkedin`, `hasTicket`, `role`, `signIn`, `onAuthStateChanged` y `updateDoc`. No asumas nombres de archivos ausentes. Entrega hallazgos con ruta y líneas, nunca con valores secretos.

## 3. Base oficial y restricciones

### 3.1 Productos distintos

OIDC utiliza `openid profile email`; devuelve ID token y access token. `/v2/userinfo` ofrece `sub`, nombre, apellido, foto, locale y correo opcional. LinkedIn advierte que no verifica identidad. Fuente: documentación oficial OIDC.

Verified Development solo permite cuentas administradoras de la aplicación. Lite requiere haber probado Development, solicitar upgrade, proporcionar datos empresariales y caso de uso, completar onboarding y recibir aprobación. Lite ofrece `/rest/identityMe` y `/rest/verificationReport`, no educación, cargo ni metadatos detallados. Fuente: guía oficial Upgrade to Lite.

`/rest/verificationReport` devuelve categorías IDENTITY y WORKPLACE. Development/Lite no devuelven fechas originales de verificación ni nombre legal verificado. Fuente: referencia oficial del endpoint.

### 3.2 Discrepancia de scopes que no debe ocultarse

La guía Lite actualizada el 17 de agosto de 2026 usa `r_verify`; la referencia de verificationReport actualizada el 26 de agosto de 2026 indica `r_verify_details` como estándar actual, aceptando también la variante anterior.

Procedimiento obligatorio:
1. Examinar Products y Auth en la aplicación real.
2. Registrar scopes provisionados sin mostrar credenciales.
3. Seleccionar únicamente el scope concedido y probado.
4. Configurarlo en servidor, no en lógica dispersa del frontend.
5. Probar con administrador en Development.
6. Registrar fecha, versión y resultado sanitizado.
7. Si existe conflicto entre permiso del portal y respuesta real, detener ese módulo y documentar el bloqueo.

No solicitar ambos scopes para ocultar errores. No asumir que habilitar OIDC habilita verificación. No utilizar `r_liteprofile` ni `/v2/me` como solución nueva.

### 3.3 Versiones y cuotas

`/rest` requiere `LinkedIn-Version`. Consultar release notes vigentes para el tier concreto y fijar una versión comprobada. No usar literalmente `{LATEST_VERSION}` y no trasladar automáticamente `202607` de ejemplos Plus a Development/Lite.

Cuotas publicadas:
- OIDC: 100.000 solicitudes por aplicación/día y 500 por miembro/día.
- Verification Development/Lite: 5.000 por aplicación/día y 500 por miembro/día.
- Plus: negociadas.

No convertir estas cifras en número garantizado de usuarios. Validar cuotas efectivas en Analytics por endpoint. Diseñar conservadoramente como si los recursos de verificación compartieran presupuesto hasta confirmar su contabilidad real.

## 4. Decisiones arquitectónicas

### 4.1 Recomendación

Conservar Firebase Auth como autoridad de UID interno si ya existe. Usar un backend mínimo para OAuth, validación OIDC, llamadas LinkedIn, vinculación y persistencia segura. La SPA nunca intercambia el código directamente con un secreto de cliente.

Separar dos caminos:
- LOGIN: OIDC demuestra una identidad externa y el backend resuelve un UID RONDA.
- CONNECT/VERIFY: un usuario ya autenticado en RONDA autoriza conectar LinkedIn y/o consultar categorías.

El segundo camino se implementa primero: reduce riesgos de duplicación mientras se comprende el registro existente.

### 4.2 Evaluación de infraestructura

| Alternativa | Evaluación requerida |
|---|---|
| Backend ya existente | Preferir si soporta secretos, HTTPS, transacciones y validación Firebase Admin. |
| Servicio serverless con nivel gratuito | Confirmar cuotas, país/región, limitaciones, facturación, acceso saliente y SDK compatibles en documentación vigente. |
| Firebase Functions/Cloud Run | No asumir costo cero ni plan Spark suficiente; verificar facturación, requisitos y costos antes de escoger. |
| Backend Node local | Válido para pruebas; no equivale a alojamiento productivo gratuito. |
| SPA exclusivamente estática | No utilizar para un flujo que exige secreto confidencial. Si no hay backend seguro, deshabilitar login LinkedIn productivo. |

No seleccionar plataforma de pago por defecto. Presentar alternativa, costo esperado, límite duro y riesgo de sobreconsumo. Un free tier no garantiza factura cero. Presupuesto cero es restricción de implementación, no permiso para degradar seguridad.

### 4.3 Sesiones

Evitar introducir dos sistemas completos de sesiones sin necesidad. Si Firebase Auth gestiona sesión frontend, backend valida ID token Firebase para operaciones protegidas. Para flujo OAuth, usar cookie temporal HttpOnly de vinculación con la transacción. Si ya hay BFF con cookie de sesión, reutilizarlo tras auditoría.

Los tokens LinkedIn y los ID tokens LinkedIn no se guardan en localStorage. Una credencial temporal de Firebase para completar login es distinta; su consumo ocurre una sola vez y no debe viajar en querystring.

## 5. Flujos funcionales

### 5.1 Conectar a usuario existente

1. Usuario inicia sesión en RONDA por método actual.
2. Pulsa “Conectar LinkedIn”.
3. Frontend envía POST de inicio con ID token Firebase válido y `mode=connect`.
4. Backend determina UID desde el token, nunca desde body o query.
5. Backend crea transacción con state aleatorio y cookie temporal de navegador.
6. Devuelve URL de autorización oficial.
7. Navegador navega a LinkedIn; usuario consiente.
8. LinkedIn vuelve a callback backend.
9. Backend valida transacción, state, cookie, caducidad y modo.
10. Intercambia code, valida ID token y consulta userinfo cuando corresponda.
11. Reserva de forma atómica la identidad externa; si está ligada a otro UID, rechaza sin divulgar quién.
12. Guarda conexión y resumen permitido.
13. Redirige a una ruta interna preaprobada sin tokens ni claims.
14. Frontend consulta estado al backend; muestra cuenta conectada, no identidad verificada.

### 5.2 Login con LinkedIn

1. Inicio anónimo autorizado solo para `mode=login`, con protecciones antiabuso.
2. Flujo OAuth y validación OIDC igual de estrictos que connect.
3. Resolver `(issuer, clientId, sub)` en índice de identidades.
4. Si ya está vinculado, resolver UID existente.
5. Si no está vinculado, crear UID solo conforme al registro actual y requisitos de aceptación del servicio.
6. Si correo coincide con usuario previo, no fusionar automáticamente; pedir login del método existente y conexión explícita.
7. Emitir custom token Firebase mediante backend autorizado, únicamente si esa estrategia queda aprobada.
8. Entregar mediante endpoint de canje de un solo uso ligado a cookie de navegador; no querystring, fragmento ni localStorage.
9. Frontend consume el token con `signInWithCustomToken` y completa onboarding.
10. Guardar usuario inicial con rol client mediante lógica server-side compatible con el sistema existente.

Diseñar el canje para que el callback cree una cookie opaca temporal y redirija a una ruta fija. El frontend envía POST al endpoint exchange; servidor consume la transacción y devuelve credencial temporal solo una vez con Cache-Control no-store. Si la aplicación no puede soportar esta entrega de forma segura, implementar BFF de sesión o posponer login y entregar únicamente connect.

### 5.3 Consultar verificación

1. Usuario autenticado solicita revisar estado.
2. Backend comprueba feature flag, tier, permisos, vínculo y token válido.
3. Si hace falta autorización adicional, inicia OAuth incremental explícito y conserva vinculación a UID.
4. Consulta verificationReport con versión configurada.
5. Valida respuesta y normaliza categorías conocidas.
6. Registra checkedAt usando reloj servidor; no lo llama “fecha de verificación de identidad”.
7. Persiste únicamente resultados permitidos.
8. Devuelve resumen sin token, ID externo ni URL sensible.
9. Frontend actualiza estados independientemente de la conexión OIDC.

### 5.4 Iniciar verificación en LinkedIn

1. POST protegido inicia el flujo.
2. Backend pide un reporte nuevo y obtiene verificationUrl si procede.
3. Valida URL como HTTPS y hostname oficial permitido; no usa comparación `includes('linkedin.com')`.
4. Crea state separado del OAuth de login y transacción ligada a usuario/navegador.
5. Construye URL usando URL/URLSearchParams; agrega callback exacto y state según documentación.
6. Responde como navegación/redirect sin persistir ni registrar verificationUrl.
7. Al regresar, exige transacción válida y vuelve a consultar API.
8. El callback no marca éxito por el solo hecho de haber sido visitado.
9. Si hay retraso de propagación, informa pendiente y permite reconsulta limitada.

No almacenar verificationUrl en Firestore, analytics, errores, logs o historial interno. Si un endpoint devuelve una URL al navegador para navegar, usar no-store y evitar herramientas de captura de respuestas. Preferir redirect server-side cuando sea viable.

### 5.5 Desconectar

Exigir autenticación reciente para operación sensible. Confirmar que queda otro método de acceso o configurar uno antes. Eliminar token, conexión y resumen según retención aprobada; liberar o conservar tombstone mínimo del índice únicamente si hay una justificación documentada. Consultar mecanismo oficial de revocación vigente: desconectar localmente no equivale automáticamente a revocar consentimiento en LinkedIn. Nunca anunciar revocación remota si no se ejecutó.

## 6. Contratos HTTP propuestos

Rutas propuestas, no existentes. Antigravity debe adaptarlas a hosting/backend real y documentar los cambios.

| Método / ruta | Autorización | Función |
|---|---|---|
| POST `/api/auth/linkedin/start` | Firebase requerida para connect; anónimo limitado para login | Crear transacción OAuth |
| GET `/api/auth/linkedin/callback` | State + cookie temporal | Validar retorno e intercambiar code |
| POST `/api/auth/linkedin/exchange` | Cookie temporal + CSRF/Origin | Canjear resultado login una vez |
| GET `/api/me/linkedin` | Firebase o sesión BFF | Resumen privado propio |
| POST `/api/me/linkedin/verification/refresh` | Firebase + control CSRF | Reconsultar reporte |
| POST `/api/me/linkedin/verification/start` | Firebase + control CSRF | Iniciar verificación externa |
| GET `/api/auth/linkedin/verification/callback` | State independiente + cookie temporal | Reconsultar reporte al regreso |
| DELETE `/api/me/linkedin` | Sesión reciente + CSRF | Desconectar |

`start` body propuesto:
```json
{
  "mode": "connect",
  "returnRoute": "profile",
  "capability": "oidc"
}
```

Usar enum returnRoute, no URL arbitraria. Ejemplo: profile → `/app/perfil`, onboarding → ruta real auditada. Los nombres son propuestas y no deben romper navegación existente.

Respuesta de estado propuesta:
```json
{
  "connected": true,
  "profile": {
    "displayName": "Ana Pérez",
    "pictureUrl": null,
    "profileUrl": null
  },
  "verification": {
    "availability": "enabled",
    "observation": "observed",
    "categories": ["IDENTITY"],
    "checkedAt": "2026-10-05T18:00:00.000Z",
    "freshness": "current",
    "reverificationRequired": false
  },
  "actions": {
    "canRefresh": true,
    "canStartVerification": false,
    "canDisconnect": true
  }
}
```

Este contrato es de RONDA, no un payload oficial LinkedIn. `profileUrl:null` es normal en OIDC; `checkedAt` es fecha de consulta. No inventar campo verifiedAt en Lite.

Formato de error propuesto:
```json
{
  "error": {
    "code": "LINKEDIN_REAUTH_REQUIRED",
    "message": "Vuelve a conectar LinkedIn para actualizar el estado.",
    "retryable": false,
    "requestId": "identificador-opaco"
  }
}
```

No devolver upstream body íntegro, stack trace, correo de otra cuenta, tokens ni URLs de verificación. Para operaciones en curso responder estado claro; no convertir excepciones en éxito silencioso.

## 7. Modelos TypeScript

```ts
export type LinkedInCategory = 'IDENTITY' | 'WORKPLACE';
export type VerificationAvailability =
  | 'disabled' | 'development_only' | 'approval_pending' | 'enabled';
export type ObservationState =
  | 'never_checked' | 'observed' | 'temporarily_unavailable' | 'reauth_required';
export type Freshness = 'unknown' | 'current' | 'stale';

export interface OidcUserInfo {
  sub: string;
  name?: string;
  given_name?: string;
  family_name?: string;
  picture?: string;
  locale?: string;
  email?: string;
  email_verified?: boolean;
}

export interface VerificationReport {
  id: string;
  verifications: string[];
  verificationUrl?: string;
}

export interface LinkedInTrustSummary {
  connected: boolean;
  availability: VerificationAvailability;
  observation: ObservationState;
  categories: LinkedInCategory[];
  checkedAt: string | null;
  freshness: Freshness;
  reverificationRequired: boolean;
}
```

Validar en runtime: TypeScript no valida una respuesta de red. Usar librería pequeña existente o validadores explícitos. Requerir sub no vacío en OIDC, id válido en reporte y array de strings en verifications. Ignorar categorías nuevas para badges conocidos y registrarlas de forma agregada sin bloquear todo el perfil. Limitar tamaños y cantidad de campos procesados.

Conservar separación de disponibilidad, observación y frescura. Un 429 no significa “no verificado”; un arreglo vacío después de respuesta válida sí significa que esa consulta no reportó categorías. Una categoría histórica no prueba que cumpla una política temporal más estricta.

## 8. Persistencia y aislamiento

### 8.1 Colecciones propuestas

| Ruta | Contenido | Lectura cliente | Escritura cliente |
|---|---|---|---|
| `users/{uid}` | Perfil actual, rol y campos existentes | Según reglas existentes | Solo campos permitidos auditados |
| `userTrust/{uid}` | Resumen LinkedIn y futuro resumen de otras fuentes | Solo propietario | Nunca |
| `privateLinkedInConnections/{uid}` | Identificadores externos, scopes concedidos, token cifrado, expiración | Nunca | Nunca |
| `externalIdentityIndex/{key}` | Identidad externa → UID | Nunca | Nunca |
| `oauthTransactions/{stateHash}` | Transacciones temporales | Nunca | Nunca |
| `identityAudit/{eventId}` | Eventos sanitizados | Backend autorizado | Nunca |

No otorgar automáticamente lectura de `userTrust` a staff. Si la operación necesita una proyección mínima para check-in, crear endpoint/proyección específica con permiso y motivo. No compartir categorías laborales con asistentes sin consentimiento y necesidad funcional.

### 8.2 Índice y unicidad

La clave OIDC debe derivarse de issuer + clientId + sub con codificación no ambigua y hash/HMAC según diseño. IDs están limitados a contexto de aplicación; no asumir unicidad global. No utilizar correo como clave principal ni nombre como deduplicación.

Para Verification guardar namespace propio del producto y clientId. No asumir que `sub` OIDC y `id` de `/identityMe` o `/verificationReport` son idénticos. Probar el comportamiento y documentarlo. Si no existe correspondencia oficialmente garantizada, tratar ambos grants por separado y exigir conexión explícita autenticada; mostrar divergencia o capacidad pendiente, no asignar arbitrariamente el reporte a un ID.

Cuando identityMe y verificationReport pertenezcan a un mismo grant, comprobar IDs según el contrato documentado; una discrepancia inesperada debe bloquear actualización y generar evento sanitizado.

Crear índice y asociación dentro de transacción de base de datos para evitar que dos UIDs se apropien simultáneamente de la misma identidad. Manejar carreras sin divulgar usuario propietario.

### 8.3 Tokens

Decidir explícitamente entre:
- Token efímero: usar para consulta y desechar; menos retención, más reautorizaciones.
- Token persistido: necesario para reconsultas posteriores; cifrado autenticado, claves separadas y política de rotación.

Persistir solo si existe necesidad y consentimiento. Si se cifra, registrar versión de clave y metadata no sensible; no almacenar clave en el mismo documento. No implementar AES manual ni cifrado casero. No asumir refresh token disponible: manejar expiry y solicitar reautorización cuando corresponda.

### 8.4 Tiempos

Distinguir:
- connectedAt: conexión local.
- checkedAt: consulta servidor.
- tokenExpiresAt: expiración del token.
- lastVerifiedAt: fecha upstream solo si tier/contrato realmente la entrega.

Utilizar timestamps servidor. Para un payload Lite, lastVerifiedAt debe ser ausente/null, jamás igual a checkedAt.

## 9. Reglas Firestore

Problema actual: la regla users protege role y hasTicket pero permite otros campos. También la creación exige rol client pero no restringe claves adicionales. No basta proteger updates: un atacante podría crear un usuario con indicadores de confianza falsos.

Recomendación: almacenar la fuente autoritativa fuera de users y bloquear campos reservados de identidad tanto en create como update; migrar cualquier campo histórico verificado con un plan, sin confiar en su procedencia.

Ejemplo de reglas nuevas para colecciones separadas:
```text
match /userTrust/{uid} {
  allow read: if request.auth != null && request.auth.uid == uid;
  allow write: if false;
}
match /privateLinkedInConnections/{uid} {
  allow read, write: if false;
}
match /externalIdentityIndex/{key} {
  allow read, write: if false;
}
match /oauthTransactions/{id} {
  allow read, write: if false;
}
match /identityAudit/{id} {
  allow read, write: if false;
}
```

Es un fragmento, no reemplazo completo de firestore.rules. El Admin SDK puede escribir por backend; por ello endpoints e IAM deben imponer permisos. Reglas restrictivas no compensan un endpoint Admin SDK que acepta UID arbitrario.

Para users elegir allowlist de campos cliente después de inventario. No inventar una allowlist que elimine funcionalidades legítimas. Proteger cualquier `verified`, `identityVerified`, `linkedin`, `trust`, `verificationStatus` o equivalente que exista y removerlo de lógica de autorización si no tiene procedencia confiable.

Pruebas mínimas: creación con trust falso rechazada; modificación de role rechazada; modificación de hasTicket rechazada; lectura de tokens rechazada; usuario A no lee userTrust B; staff ordinario no escribe ni lee secretos; cambios permitidos de perfil siguen funcionando.

## 10. Seguridad OAuth y OIDC

### 10.1 Transacciones

Generar state criptográfico con al menos 256 bits de aleatoriedad como política interna. Guardar hash, expiración propuesta de 10 minutos, modo, UID origen cuando exista, ruta interna aprobada y binding a cookie del navegador. El tiempo de 10 minutos es política de RONDA, no requisito anunciado de LinkedIn.

Cookie temporal: HttpOnly, Secure en producción, SameSite apropiado al retorno de navegación; preferir Lax para callback GET y probar navegador móvil. Scope mínimo y Path que permita los endpoints necesarios; si usa prefijo __Host-, respetar sus condiciones. No omitir state aunque exista cookie.

Rechazar state ausente, desconocido, vencido, consumido, asociado a otro navegador o modo. Consumir de forma atómica y evitar reintentos que creen usuarios duplicados. TTL de base de datos limpia registros, pero no sustituye verificación explícita de expiración.

### 10.2 ID token

Usar librería mantenida compatible con runtime. Verificar firma, algoritmo permitido RS256, issuer exacto, audience clientId, expiración y coherencia temporal. Soportar rotación JWKS con caché acotada. No aceptar alg none ni claves suministradas por el token.

Si se envía nonce y el proveedor lo soporta en el flujo documentado, verificar correspondencia; confirmar su soporte antes de depender de él. No afirmar soporte PKCE sin verificar documentación actual del producto. Si se habilita PKCE, no sustituye state ni validación de ID token y no autoriza exponer secret.

Si se consulta userinfo, exigir que userinfo.sub corresponda al subject del ID token. No usar un access token LinkedIn como token de sesión RONDA. No pasar ID token LinkedIn a Firebase como si fuera automáticamente una credencial nativa aceptada.

### 10.3 CSRF y navegador

POST/DELETE protegidos: validar Origin exacto y token CSRF cuando se usan cookies; no aceptar wildcard con credenciales. Bearer Firebase debe verificarse en servidor, incluido proyecto y firma usando SDK adecuado. Nunca confiar en UID remitido por frontend.

CORS: preferir mismo origen; si frontend y backend difieren, allowlist estricta y prueba real de cookies. Safari y bloqueos de cookies de terceros pueden invalidar diseños entre sitios; no asumir que un subdominio externo funcionará en todos los móviles.

Para redirect posterior aceptar enum de rutas, no returnTo arbitrario. Evitar open redirects, redirect a `//evil`, javascript URLs y concatenaciones inseguras. Para imágenes remotas no convertir URL en fetch backend sin política SSRF y revisión de necesidad.

### 10.4 Cabeceras y caché

En callbacks, canje y endpoints sensibles: Cache-Control no-store, Referrer-Policy apropiada y prohibición de indexación donde corresponda. El callback debe procesar y redirigir antes de cargar analítica o scripts de terceros, para no filtrar code/state.

Revisar CSP existente sin romper Firebase. Restringir conexiones e imágenes a dominios necesarios comprobados; no agregar comodines globales como solución rápida. Sanitizar textos y usar textContent o escaping, no innerHTML con datos externos.

### 10.5 Amenazas y defensa

| Amenaza | Defensa |
|---|---|
| Login CSRF | State, binding de navegador y consumo único |
| Vincular cuenta ajena | Sesión RONDA validada y UID derivado por servidor |
| Account takeover por correo | No fusión automática; autenticación previa y vinculación explícita |
| Replay del callback | Transacción atómica de uso único |
| Autoverificación Firestore | Colección server-only y protección create/update |
| Token exfiltrado por XSS | No tokens LinkedIn frontend; CSP y salida segura |
| Open redirect | Rutas internas enumeradas |
| URL de verificación maliciosa | Host exacto HTTPS permitido, sin userinfo ni puertos no autorizados |
| Doble vinculación concurrente | Índice transaccional |
| Falsos resultados por outage | Estados unknown/unavailable distintos de observado vacío |
| Elevación de rol | Autorización estricta backend y Firestore |

*(Nota: Documento cortado al final de la tabla por límite de caracteres)*
