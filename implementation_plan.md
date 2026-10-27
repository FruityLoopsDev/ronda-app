# 🛡️ PLAN DE REMEDIACIÓN Y BLINDAJE DE DUE DILIGENCE (RONDA v2.3.1)

> **Objetivo:** Resolver el 100% de las vulnerabilidades financieras, legales, narrativas y técnicas identificadas en la auditoría de Due Diligence, garantizando coherencia absoluta entre el código, los documentos maestras, la landing de inversión y el modelo financiero.

---

## 📋 MATRIZ DE PLAN DE ACCIÓN

| Categoría | Vulnerabilidad Detectada | Solución y Blindaje Aplicado | Archivos Afectados |
| :--- | :--- | :--- | :--- |
| **A. Legal** | Tasa del mutuo (9% a 90 días ≈ 41.8% E.A.) excede tope de usura (29.45% E.A.) | **Ajustar Tasa:** Reducir remuneración a 6.0% a 90 días (≈ 26.2% E.A.) o estructurar Nota Convertible en borrador legal. | `docs/ronda-maqueta-fixed.md`, `src/views/invest-view.ts` |
| **A. Legal** | Declaración bajo juramento de "100% auditado y concluido" | **Ajustar Cláusulas:** Modificar minuta para reflejar "Fase Piloto / MVP Verificado en Testnet con Auditoría de Código en Desarrollo". | `docs/contrato-mutuo-modelo.md`, `docs/MASTER_REFERENCE.md` |
| **A. Legal** | Captación masiva en `/invest` pública y datos simulados | **Blindar Landing:** Marcar explícitamente cifras como "Proyección / Modelo Ilustrativo Piloto", eliminar contadores simulados. | `invest.html`, `src/views/invest-view.ts` |
| **A. Legal** | Datos Sensibles (Ley 1581) en biometría y preferencias | **Consentimiento Explicito:** Añadir disclaimer y checkbox explícito de tratamiento de datos biométricos sensibles según Ley 1581 de 2012. | `src/views/auth-view.ts`, `src/verification.ts` |
| **B. Financiero** | Moneda desalineada (Euros € vs COP $) | **Unificación SSoT:** Convertir todo `ronda-logica-negocio.md` y documentos a COP puro (12.000 COP entrada base). | `docs/ronda-logica-negocio.md`, `docs/index.md` |
| **B. Financiero** | Omisión de IVA (19%) y Tarifas Reales Wompi | **Cálculo Neto Real:** Modelar ingreso neto post-IVA y costo pasarela ($2.100 - $2.500 COP por transacción Wompi). | `docs/ronda-logica-negocio.md`, `src/views/invest-view.ts` |
| **B. Financiero** | Tres CACs distintos (12k, 30-40k, 45.6k) | **Estandarización de CAC:** Establecer CAC SSoT en $35.000 COP (mezcla ponderada $45k Hombres / $25k Mujeres). | `docs/ronda-logica-negocio.md`, `docs/MASTER_REFERENCE.md` |
| **C. Narrativa** | Tres modelos de negocio contradictorios | **Modelo Único:** "Preventa Demand-First con Garantía de Consumo Mínimo al Bar en T-48h". | `docs/index.md`, `docs/MASTER_REFERENCE.md`, `landing.html` |
| **C. Narrativa** | Claim de "Algoritmo Patentable" (Prohibido por CAN 486) | **Re-framing:** Cambiar a "Algoritmo Propietario de Rotación con Memoria Local y Resguardo en Grafo". | `docs/index.md`, `docs/MASTER_REFERENCE.md`, `landing.html` |
| **C. Web3/Tech** | Mumbai deprecada, OpenZeppelin ^5 deprecado en contrato | **Actualización Web3:** Ajustar referencias a Polygon Amoy, Ethers v6 y desmarcar NFT como blocker inmediato (fase futura). | `scripts/register-proof.cjs`, `docs/MASTER_REFERENCE.md` |

---

## 🛠️ PASOS DE EJECUCIÓN INMEDIATA
 
1. **Paso 1 (Sincronización de Documentación & SSoT):** ✅ *COMPLETADO*
   - Tasa de mutuo unificada a 6.0% a 90 días (26.2% E.A., dentro del tope legal de usura) y repago a $8.480.000 COP en todo el kit documental (`CONTRATO_MUTUO_COMERCIAL_FFF.md`, `PAGARE_Y_CARTA_INSTRUCCIONES_FFF.md`, `GUIA_OPERATIVA_CIERRE_FFF.md`, `RONDA - Documento Maestro Ronda FFF`, `RONDA_MEMORANDUM_INVERSION_FFF.md`).
   - Moneda unificada en COP sin euros, CAC SSoT en $35.000 COP.
2. **Paso 2 (Blindaje de Landing Inversionista `/invest`):** ✅ *COMPLETADO*
   - Modificado `invest.html`: simulador a 6.0% con ganancia $60k y retorno $1.060.000, Data Room One-Pager, Proyecciones Financieras, generador de pagaré, exportador CSV y mensaje de WhatsApp actualizados.
   - Disclaimer explícito insertado señalando presentación privada a círculo FFF bajo Art. 1163 C.Co. y Ley 527/1999 (sin oferta pública ni captación masiva; modelos y slots como proyecciones ilustrativas de fase piloto).
3. **Paso 3 (Ajuste de Claims Técnicos y Legales):** ✅ *COMPLETADO*
   - Claims de desarrollo ajustados a "Fase Piloto / MVP Verificado en Testnet con Auditoría de Código en Desarrollo" en Memorando de Inversión y referencias de algoritmo a "Mecanismo Propietario con Memoria".
   - Consentimiento expreso bajo Ley 1581 de 2012 implementado con checkboxes obligatorios y validación en tiempo de ejecución en registro (`index.html` + `src/views/auth-view.ts`) y en verificación biométrica facial (`index.html` + `src/verification.ts`).
4. **Paso 4 (Delegación a Cline y Verificaciones):** ✅ *COMPLETADO*
   - Pruebas superadas al 100%: TypeScript (`tsc`), Benchmark (`mem-rr-v2/bench.ts`), KYC (`test:face`), Integridad (`test-integrity-zero-functions.cjs`), B2B (`test:b2b`), Bundle (`npm run build`).
