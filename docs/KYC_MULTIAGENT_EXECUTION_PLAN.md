# 📋 KYC & Confianza Multi-Agente — Plan de Ejecución y Trazabilidad (RONDA)

> **Documento de Trazabilidad Activa**  
> **Estado:** En Ejecución  
> **Última Actualización:** 2026-10-05  
> **Arquitecto:** Antigravity (IDE Agent)  
> **Stack Operativo:** Antigravity · Cline · Perplexity · DeepSeek Harness  

---

## 1. Principios Rectores y Decisiones del Negocio

1. **Posicionamiento Inmutable:** Comunidad exclusiva para **profesionales de alto valor**.
2. **Requisito Mínimo de Entrada:** **Tier 2 (T2) obligatorio** para adquirir entradas, reservar y participar en la rotación de eventos. La seguridad y privacidad de las asistentes van primero.
3. **Costo de Infraestructura:** **$0.00 COP / mes.** 
   - Uso de la capa gratuita de Firebase Storage (Spark: 5 GB, 20.000 ops/día).
   - Eliminación automática de imágenes biométricas a las 72 horas.
   - Uso de la API gratuita *"Verified on LinkedIn"* (tier Development/Lite) para absorber el costo de verificación con Persona.
4. **Revisión Manual Centralizada:** Operada exclusivamente por el **Administrador Central** a través del panel `superadmin.html`.
5. **Higiene de Datos (Fase 0 Completada):** Eliminados todos los titulares inventados y asignaciones automáticas de `isVerified = true`. Todos los usuarios actuales han sido restablecidos a **T0**.

---

## 2. Definición de Trust Tiers

| Nivel | Nombre | Requisito de Acceso | Privilegios en RONDA |
|---|---|---|---|
| **T0** | Registrado | Email validado, perfil básico | Acceso al lobby, lectura de eventos. **No puede reservar.** |
| **T1** | Identidad Verificada | Biometría facial propia (Selfie + Cédula) aprobada | Perfil visible, habilitado para solicitar acreditación profesional. |
| **T2** | Profesional Verificado | T1 + Acreditación (LinkedIn OAuth / Correo Corporativo / Portafolio / Referido) | **Acceso total**: Comprar entradas, check-in, matches y chats. |
| **T3** | Miembro de Confianza | T2 + 3 eventos asistidos con calificación positiva y 0 reportes | Invitaciones con aval directo, prioridad en reservas de alta demanda. |

---

## 3. Matriz Maestra de Tareas y Trazabilidad

### Leyenda de Estados
- ⚪ **PENDIENTE**: Listo para ser abordado.
- 🟡 **EN PROGRESO**: Tarea asignada activamente.
- 🟢 **COMPLETADO**: Implementado, probado y fusionado.
- 🔴 **BLOQUEADO**: Requiere resolución previa.

| ID | Agente | Tarea | Dependencias | Estado | Entregable / Evidencia |
|---|---|---|---|:---:|---|
| **F0-1** | Antigravity | Saneamiento de código: titulares inventados y banderas falsas | — | 🟢 COMPLETADO | `src/verification.ts`, `app.ts`, `auth-view.ts` |
| **F0-2** | Antigravity | Script de migración y reseteo de usuarios a T0 en prod | — | 🟢 COMPLETADO | `scripts/migrate-users-to-t0.cjs` ejecutado en `ronda-uno` |
| **F0-3** | Antigravity | Corrección del bug de permisos en reservas de Firestore | — | 🟢 COMPLETADO | `firestore.rules` actualizado y desplegado |
| **P-1** | Perplexity | Especificación y términos de la API "Verified on LinkedIn" | — | 🟡 EN PROGRESO | Documento de endpoints, scopes y payloads de LinkedIn |
| **P-2** | Perplexity | Librerías ligeras para lectura de PDF417 y MRZ en browser/Vite | — | ⚪ PENDIENTE | Módulo / snippet de decodificación de código de barras |
| **A-1** | Antigravity | Reglas de Firebase Storage para fotos de verificación (`storage.rules`) | — | 🟡 EN PROGRESO | `storage.rules` desplegado con expiración 72h |
| **A-2** | Antigravity | Serverless function `verify-kyc.js` con validación de nonces | D-1, D-3 | ⚪ PENDIENTE | `functions-vercel/api/verify-kyc.js` |
| **A-3** | Antigravity | Serverless function `linkedin-oauth.js` para OIDC real | P-1 | ⚪ PENDIENTE | `functions-vercel/api/linkedin-oauth.js` |
| **D-1** | DeepSeek | Algoritmo de prueba de vida activa (EAR + Yaw/Pitch) | — | ⚪ PENDIENTE | Módulo matemático puro `src/kyc/liveness-math.ts` |
| **D-2** | DeepSeek | Validador de checksums ICAO 9303 / TD1 para Cédula Digital | — | ⚪ PENDIENTE | Función pura `validateMRZChecksums()` en TypeScript |
| **D-3** | DeepSeek | Función de calibración multivariable $S(d, l, o)$ y bandas de corte | D-1, D-2 | ⚪ PENDIENTE | Definición formal de umbrales automáticos vs manuales |
| **C-1** | Cline | UI de cámara con óvalo guía dinámico y feedback de luz | A-1 | ⚪ PENDIENTE | Componente visual en `src/verification.ts` |
| **C-2** | Cline | Flujo interactivo del reto de prueba de vida en pantalla | D-1, C-1 | ⚪ PENDIENTE | Integración visual de retos ("Parpadea", "Gira") |
| **C-3** | Cline | Lector de reverso de cédula (PDF417 / MRZ) | P-2, D-2 | ⚪ PENDIENTE | Captura y extracción de datos en cliente |
| **C-4** | Cline | Consola de revisión manual para el Administrador Central | A-2 | ⚪ PENDIENTE | Panel en `superadmin.html` con cola de `kycReviews` |
| **C-5** | Cline | Puerta de enlace T2 en compra y check-in | A-2 | ⚪ PENDIENTE | Bloqueo estricto en `client.ts` y `bar.ts` para T0/T1 |

---

## 4. Contratos de Arquitectura y Datos

### 4.1 Bucket de Almacenamiento (`firebase-storage`)
* **Ruta de Carga Temporal:** `kyc-temp/{userId}/{challengeId}_{type}.jpg`
  * `type`: `selfie_frame_1..N`, `doc_front`, `doc_back`.
* **Reglas de Acceso:**
  * **Escritura:** Solo el usuario autenticado para su propia carpeta `userId`.
  * **Lectura:** Exclusiva para administradores (`superadmin`). Clientes no pueden leer imágenes de otros ni las propias tras la subida.
  * **Ciclo de Vida:** TTL de 72 horas para eliminación automática en Google Cloud Storage.

### 4.2 Documento de Usuario en Firestore (`users/{uid}`)
```typescript
interface UserTrustProfile {
  trustTier: 0 | 1 | 2 | 3;
  isVerified: boolean;           // true si trustTier >= 1
  verifications: {
    identity?: {
      method: 'face_kyc' | 'linkedin_persona' | 'manual_admin';
      verifiedAt: string;
      confidenceScore?: number;
      reviewerUid?: string;
    };
    professional?: {
      method: 'linkedin_oauth' | 'corporate_email' | 'professional_card' | 'rut' | 'portfolio' | 'referral';
      verifiedAt: string;
      details?: {
        companyOrDomain?: string;
        sourceUrl?: string;
        referrerUid?: string;
      };
    };
  };
}
```

### 4.3 Cola de Revisión Manual (`kycReviews/{reviewId}`)
```typescript
interface KycReviewCase {
  reviewId: string;
  userId: string;
  userName: string;
  userEmail: string;
  registeredBirthDate: string;
  createdAt: string;
  status: 'pending' | 'approved' | 'rejected';
  reasonsForManual: string[];    // ej: ['banda_gris_facial', 'liveness_dudoso']
  metrics: {
    faceDistance: number;
    livenessScore: number;
    ocrExtractedName?: string;
    ocrExtractedNumber?: string;
  };
  imageUrls: {
    selfie: string;
    docFront: string;
    docBack?: string;
  };
  reviewedBy?: string;
  reviewedAt?: string;
  adminNotes?: string;
}
```

---

## 5. Bitácora de Ejecución (Log de Avance)

* **2026-10-05 — Sesión 1:**
  * Diagnóstico de vulnerabilidades de verificación y bug de reservas reportado en `ronda.uno`.
  * Corrección de `firestore.rules` (desbloqueo de `paymentPending` y `paymentMethod`).
  * Despliegue de reglas de Firestore a producción (`ronda-uno`).
  * Ejecución de **Fase 0**: Eliminación de headlines simulados y reseteo de usuarios en prod a T0 vía `scripts/migrate-users-to-t0.cjs`.
  * Creación del plan maestro de trazabilidad multi-agente (`docs/KYC_MULTIAGENT_EXECUTION_PLAN.md`).
  * Sincronización completa con repositorio remoto (`git push origin v0/maxiapp-recipe-to-cart` completado).
