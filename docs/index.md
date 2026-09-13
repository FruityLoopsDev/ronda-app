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

- `docs/MASTER_REFERENCE.md` (Documento maestro de referencia técnica y arquitectura completa).
- `docs/architecture.md` (Arquitectura general).
- `docs/algorithm-v2-spec.md` (Teoría del motor mem-rr-v2).
- `docs/RONDA_MEMORANDUM_INVERSION_FFF.md` (Deck para inversores).
- `docs/ip-patent-strategy.md` (Estrategia de Propiedad Intelectual).
