# RONDA — Índice del proyecto y Reglas de Caching (Mapa de Archivos)

> **PROMPT CACHING PROTOCOL (CRÍTICO)**
> Este archivo `docs/index.md` junto con `AGENTS.md` forman el bloque estático de la sesión.
> - **DEBEN** leerse al mismo tiempo en el turno 1 de cualquier agente (Antigravity o Cline).
> - Evita leer los archivos grandes (L/XL) salvo necesidad estricta para mantener la ventana limpia.
> - Coste de tokens por lectura: S < 1k · M ~1–3k · L ~5–10k · XL > 15k.

## 1. Stack Tecnológico
Vanilla TS + Vite (SPA multi-vista) · Firebase (Auth/Firestore/Hosting) · Vercel (Serverless Backend) · Web3 (ERC-721/Polygon) · Wompi (Web Checkout) · localforage (Offline cache).

## 2. Entradas Principales
- `index.html` (XL) — SPA con vistas combinadas (auth/lobby/profile/client/admin). **No leer entero**. Usa grep.
- `landing.html` (M) — Landing externa de marketing.
- `src/app.ts` (M) — Orquestador y render de vistas. Conecta Auth → Views → Check-in.

## 3. Módulos clave `src/` (S = pequeño, M = medio)
| Archivo | Rol | Coste |
|---|---|---|
| `firebase-config.ts` | Inicialización Firebase, variables de entorno. | S |
| `db.ts` | Abstracción Firestore, perfil, y fallback matches locales. | M |
| `auth.ts` | Firebase Auth. | S |
| `ronda-core.ts` | Motor v1 teórico. | S |
| `bar.ts` | Lógica consola del anfitrión (panel admin). | M |
| `client.ts` | Dashboard cliente. **Archivo XL, no leer completo.** | XL |
| `payment.ts` | Pasarela Web Wompi y fallback Nequi. | M |
| `api-client.ts` | Cliente POST con ID Token Auth para Vercel API. | S |
| `profile.ts`, `verification.ts` | Manejo de UI de perfil y KYC/Geo. | M / S |

## 4. Motor de rotación (Matches Mutuos) `src/mem-rr-v2/`
Módulo puro (Zero dependencias de DOM/Firebase). Testable localmente:
- `weights.ts` (modelo de pesos), `exact.ts` (solución DP exacta), `flow.ts`, `general.ts`.
- **Comando clave de validación local:** `node src/mem-rr-v2/bench.ts`.

## 5. Backend (Serverless & Web3)
- **Vercel API:** `functions-vercel/api/` contiene `wompi-webhook.js`, `mint-nft.js`, `process-matches.js`. (Remplaza a Firebase Cloud Functions).
- **Web3:** `scripts/register-proof.cjs` (keccak256 proof of existence local, modo reserva, 0 gas).

- `docs/HISTORIAL_INTERACCIONES.md` (Registro persistente de decisiones y contexto entre sesiones de chat).
- `docs/MASTER_REFERENCE.md` (Documento maestro de referencia técnica y arquitectura completa).
- `docs/architecture.md` (Arquitectura general).
- `docs/algorithm-v2-spec.md` (Teoría del motor mem-rr-v2).
- `docs/RONDA_MEMORANDUM_INVERSION_FFF.md` (Deck para inversores).
- `docs/RONDA_PITCH_VIDEO_CREATIVE_BRIEF.md` (Brief y guion técnico para el video de inversión).
- `docs/KIT_BIENVENIDA_CLUB_FUNDADOR_100.md` (Especificación y costeo del Kit Club Fundador 100).
- `docs/DEBATE_EVENTOS_ESPECIALES_SUBASTA_SOLTEROS.md` (Dossier y prompt de research para Perplexity sobre eventos VIP de ticket alto y dinámica de Subasta de Citas).
- `docs/TERMINOS_Y_CONDICIONES.md` (Términos y Condiciones de Uso del Servicio y Eventos en Colombia).
- `docs/POLITICA_TRATAMIENTO_DATOS_LEY_1581.md` (Política de Privacidad y Habeas Data Ley 1581 / Procedimiento de Supresión).
- `docs/PROTOCOLO_CIERRE_WAITLIST_Y_ONBOARDING_FUNDADORES.md` (Protocolo operativo de cierre de waitlist, triage, secuencias de activación WhatsApp y noche inaugural).
- `docs/ip-patent-strategy.md` (Estrategia de Propiedad Intelectual).
- `docs/REVISION_MODULO_FACE_VERIFY_ARGON.md` (Auditoría forense de fallos en producción móvil y blueprint de refactorización biométrica para Argon de Gemini/Google).
- `docs/AUDITORIA_SEGURIDAD_BUGS_CLINE.md` (Auditoría integral de seguridad, vulnerabilidades de Firestore, XSS, código duplicado y bugs para ejecución por Cline).
