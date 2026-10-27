# 🛡️ Task: Blindaje Legal, Desindexación y Acceso Privado a `/invest` (P0-2, P0-3, P0-4)

**Asignado a:** Cline (VS Code Agent — Ejecutor Autónomo)  
**Orquestado por:** Antigravity (IDE Agent — Arquitecto)  
**Referencia:** [PLAN_LANZAMIENTO_FFF_LINKEDIN_WHATSAPP.md](file:///c:/Users/Cesar%20Dla%20Croix/Desktop/ronda-app/docs/PLAN_LANZAMIENTO_FFF_LINKEDIN_WHATSAPP.md) (§0 Guardarraíles Legales y §3.1 Bloqueantes Técnicos P0)

---

## 📌 Contexto y Justificación Legal
Para cumplir estrictamente con la normativa colombiana (Decreto 1981 de 1988 y Decreto 1068 de 2015 sobre prevención de captación masiva y habitual) y ejecutar con éxito el plan de lanzamiento de la Micro-Ronda FFF, la página `/invest` debe transformarse de una página semi-pública en un **portal estrictamente privado y confidencial para la Pista B (Founders Circle)**.

Quedan prohibidos los datos de tracción simulados y la indexación en motores de búsqueda. El acceso debe ser rastreable nominalmente por cada invitado.

---

## 🎯 Objetivos de la Tarea
1. **Sincerar la Barra de Tickets (P0-2):** Eliminar el estado artificial *"2 de 8 tickets confirmados · $2.000.000 COP"* y dejarlo en estado inicial real (0 de 8) o dinámicamente gobernable por configuración.
2. **Desindexación Total y Neutralización Social (P0-3):** Impedir que Google o buscadores indexen `/invest` (vía `robots.txt`, `<meta name="robots">` y cabeceras `X-Robots-Tag` en `firebase.json`). Neutralizar previews de Open Graph para evitar difusión pública no intencionada de términos financieros.
3. **Control de Acceso Nominal por Token / PIN Único (P0-4):** Proteger el acceso a los datos de la ronda con tokens o PINs nominales que registren la identidad del invitado (`leadId`, `nombre`) en la telemetría de GA4/RondaTracker.

---

## 🛠️ Instrucciones de Ejecución Paso a Paso

### 1. Sincerar la Barra de Tickets en `invest.html` (Líneas ~1358–1384)
- **Problema:** El HTML tiene actualmente quemado:
  ```html
  <span class="round-progress-status">🔥 <b>2 de 8 tickets confirmados</b> (25%)</span>
  ...
  <div class="ticket-dot filled" title="Ticket #1 — Confirmado">✓</div>
  <div class="ticket-dot filled" title="Ticket #2 — Confirmado">✓</div>
  ...
  <div class="round-progress-fill" style="width: 25%;"></div>
  ...
  <span>Recaudado: <b>$2.000.000 COP</b></span>
  <span>Disponibles: <b>6 tickets</b></span>
  ```
- **Acción:**
  1. Modificar el marcado inicial para reflejar el estado real de apertura de ronda:
     - Estado: `🌱 <b>0 de 8 tickets confirmados</b> (0%)`
     - Tickets: Todos los dots vacíos (`<div class="ticket-dot next" title="Ticket #1 — ¡Sé el primero!">1</div>` y del 2 al 8 como `ticket-dot empty`).
     - Barra de llenado: `style="width: 0%;"`
     - Subtítulos: `Recaudado: <b>$0 COP</b>` y `Disponibles: <b>8 tickets (Ronda Abierta)</b>`.
  2. Implementar un inicializador JavaScript configurable al inicio de los scripts de `invest.html`:
     ```javascript
     window.RONDA_INVEST_CONFIG = {
       ticketsConfirmed: 0,
       totalTickets: 8,
       ticketValueCOP: 1000000,
       goalCOP: 8000000
     };
     ```
     Crear una función `syncTicketProgressUI()` que actualice los dots, el ancho de `.round-progress-fill`, los textos de recaudado y tickets disponibles en base a `RONDA_INVEST_CONFIG`. Así, cuando un ticket real se desembolse, basta con cambiar el número en la configuración para que toda la UI se sincronice con exactitud.

---

### 2. Desindexación y Creación de `public/robots.txt`
1. **Crear archivo `public/robots.txt`:**
   Asegúrate de que exista `public/robots.txt` con las siguientes directivas:
   ```txt
   User-agent: *
   Disallow: /invest
   Disallow: /invest.html
   Disallow: /admin
   Disallow: /crm
   Disallow: /network
   Disallow: /superadmin
   Allow: /
   
   Sitemap: https://ronda.uno/sitemap.xml
   ```
2. **Actualizar `<head>` de `invest.html`:**
   - Inyectar debajo de `<meta name="viewport"...>`:
     ```html
     <meta name="robots" content="noindex, nofollow, noarchive, nosnippet">
     ```
   - Modificar las etiquetas Open Graph y Twitter para que sean institucionales y privadas (no revelen cifras ni promesas de inversión si alguien copia y pega el link en chats o redes):
     - `og:title` & `twitter:title`: `"RONDA — Portal Privado & Confidencial"`
     - `og:description` & `twitter:description`: `"Acceso exclusivo y restringido bajo credenciales de invitación privada. Documentación confidencial."`
     - Cambiar `<title>` a `"RONDA — Acceso Confidencial (Pista Privada FFF)"`.

3. **Configurar cabeceras de seguridad en `firebase.json`:**
   En el bloque `"hosting" -> "headers"`, agregar un item específico para `/invest`:
   ```json
   {
     "source": "/invest*",
     "headers": [
       {
         "key": "X-Robots-Tag",
         "value": "noindex, nofollow, noarchive, nosnippet"
       },
       {
         "key": "Cache-Control",
         "value": "no-store, no-cache, must-revalidate, private"
       }
     ]
   }
   ```

---

### 3. Sistema de Acceso Nominal y Registro de Leads (P0-4)
En `invest.html`:
1. **Detección automática por URL (`?token=` o `?pin=`):**
   Al cargar la página, leer si viene un parámetro `token` o `pin` en `window.location.search`.
2. **Catálogo de Invitados Nominales (`AUTHORIZED_GUESTS`):**
   Estructurar en JS un mapa extensible para mapear tokens con personas reales del CRM:
   ```javascript
   const AUTHORIZED_GUESTS = {
     'RND-A1-CES': { name: 'César (Fundador)', leadId: 'A1-000', role: 'founder' },
     'RND-A1-001': { name: 'Círculo Núcleo (A1)', leadId: 'A1-001', role: 'investor' },
     'RND-A2-002': { name: 'Amigo & Aliado (A2)', leadId: 'A2-002', role: 'investor' },
     'RND-A3-003': { name: 'Red Profesional (A3)', leadId: 'A3-003', role: 'investor' },
     '2026':       { name: 'Invitado Especial', leadId: 'GEN-2026', role: 'guest' }
   };
   ```
3. **Persistencia y Trazabilidad:**
   - Si el token es válido:
     - Guardar en `sessionStorage.setItem('ronda_invest_guest', JSON.stringify(guest))`
     - Enviar evento de telemetría:
       ```javascript
       if (window.RondaTracker) {
         RondaTracker.track('investor_portal_unlocked', {
           leadId: guest.leadId,
           guestName: guest.name
         });
       }
       ```
     - Si existe un elemento con id `investor-welcome-badge`, mostrar un saludo sutil: *"Acceso Autorizado: [Nombre del Invitado]"*.
   - El desbloqueo del portal debe desbloquear tanto la vista general como el visor de documentos del Data Room.
4. **Fallback si no tiene token:**
   Mantener el formulario de ingreso con PIN manual, con el botón de solicitud directa vía WhatsApp pre-redactado con el mensaje:
   `https://wa.me/573026543854?text=Hola%20C%C3%A9sar%2C%20quisiera%20mi%20c%C3%B3digo%20nominal%20de%20acceso%20para%20la%20sesi%C3%B3n%20privada%20de%20RONDA`

---

### 4. Limpieza de Métricas y Fallback en Contador de Visitas
En la función `initVisitorCounter` de `invest.html` (alrededor de la línea 2384):
- Reemplazar el fallback quemado `'28'` por `'1'` si falla el servicio de conteo, evitando simular tracción inflada.

---

## 🔍 Checklist de Validación (Definition of Done)
- [x] La barra de tickets en `invest.html` arranca en 0/8 tickets y $0 recaudados, con sincronizador UI limpio.
- [x] `public/robots.txt` creado y bloqueando explícitamente `/invest` y paneles administrativos.
- [x] `<meta name="robots" content="noindex, nofollow, noarchive, nosnippet">` presente en el `<head>` de `invest.html`.
- [x] Metadatos Open Graph / Twitter en `invest.html` anonimizados y libres de términos financieros.
- [x] Regla de `X-Robots-Tag` añadida en `firebase.json`.
- [x] Sistema de tokens nominales funcionando con soporte para URL param (`?token=...`) y trazabilidad de `leadId`.
- [x] Ejecutar `npm run build` sin errores de compilación de Vite.
- [x] Documentar la ejecución y hallazgos en `docs/HISTORIAL_INTERACCIONES.md`.

