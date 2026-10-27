# Task: Refactorización y Optimización del Flujo KYC Biométrico

**Asignado a:** Cline (VS Code Agent)
**Orquestado por:** Antigravity (IDE Agent)

## 📌 Contexto
El usuario reporta que el flujo de verificación biométrica (KYC) "va mal y no funciona fluidamente". 
El código actual reside principalmente en `src/verification.ts` y `src/face-verify.js`. Se han detectado varias ineficiencias críticas que bloquean el hilo principal y arruinan la experiencia de usuario (UX):
1. Polling ineficiente de video (`while (!ready)` con `setTimeout`).
2. Cálculos pesados (Face-API.js y Tesseract.js) que bloquean la UI al intentar extraer descriptores en el bucle de validación.
3. Resoluciones de canvas excesivas para las inferencias iniciales.

## 🎯 Objetivos
Optimizar el flujo completo de validación de identidad (Liveness + Reconocimiento Facial + OCR) para garantizar fluidez, feedback instantáneo al usuario y evitar "congelamientos" del navegador.

## 🛠️ Instrucciones de Ejecución para Cline

1. **Revisar `src/verification.ts`:**
   - Ubica la función de captura y el bucle de validación (alrededor de la línea 390: `for (let attempt = 1; attempt <= maxRetries; attempt++)`).
   - Reemplaza los bloqueos asíncronos pesados y el polling estático por `requestAnimationFrame` o escuchadores directos en eventos de video (`onloadeddata`, `onplay`).
   
2. **Optimizar Descriptores Faciales (`src/face-verify.js` / `selfieDescriptor`):**
   - Asegúrate de reducir drásticamente el tamaño del `<canvas>` antes de pasarlo a `faceapi.detectSingleFace()`.
   - Verifica que los modelos de Face-API están pre-cargados o se cargan de forma diferida (lazy load) SIN bloquear la UI.

3. **Mejorar UX del Óvalo Guía (C-1) y Reto de Vida (C-2):**
   - El método `updateOvalFromFrame` no debe pausar la interfaz. Usa un "throttle" (ej. procesar solo 2 o 3 frames por segundo en lugar de procesar cada frame) mientras se da feedback visual ('ok'/'error').

4. **Optimización de Tesseract OCR:**
   - La llamada a `Tesseract.recognize` actual tiene un timeout duro de 8s. 
   - Añade retroalimentación proactiva: actualiza el DOM inmediatamente antes de llamar a Tesseract y asegúrate de limpiar cualquier worker adecuadamente.

5. **Pruebas y Verificación Local:**
   - Corre `npx tsc --noEmit` para asegurar que los cambios de tipado no introduzcan errores.
   - Ejecuta `npm run test:face` (si está disponible) o levanta `npm run dev` y prueba manualmente en modo responsivo (móvil).

## ⚠️ Reglas Especiales
- **No elimines el Fallback de Revisión Manual**: Es crítico para la auditoría (Due Diligence). Si la biometría falla repetidamente, el sistema debe seguir cayendo limpiamente en `submitKycReview` a Firestore.
- Respeta la jerarquía de `User` modificada recientemente (la interfaz ahora incluye `faceVerified?: boolean;`).
- Lee las Reglas de Caching ( `AGENTS.md` ) antes de tocar otros archivos XL.

> **Una vez terminado, actualiza `docs/HISTORIAL_INTERACCIONES.md` con los resultados del refactor.**
