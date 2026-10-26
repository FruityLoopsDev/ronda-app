# Protocolo Operativo: Cierre de Waitlist, Curaduría y Onboarding «Club Fundador 100»

> **Propósito:** Definir el flujo paso a paso de lo que ocurre una vez que se cierra la lista de espera (por fecha límite o al alcanzar los primeros 100 cupos verificados), transformando prospectos fríos en asistentes confirmados de la Noche Inaugural.  
> **Mercado Objetivo:** Bogotá D.C. (Chapinero Alto, Quinta Camacho, Zona G).  
> **Metodología:** Embudo de Scarcity, Validación de Identidad (LinkedIn + Biometría Face-ID) y Lock-in de Asistencia.

---

## 1. El Momento del Cierre (Trigger & Scarcity en la Web)

### 1.1 Criterio de Disparo
La lista de espera se declara oficialmente cerrada cuando ocurra la primera de estas dos condiciones:
1. **Tope Numérico:** Se alcanzan 100 postulaciones válidas en Firestore (`collection: waitlist`).
2. **Fecha de Corte:** Llegada de la fecha límite fijada para la cohorte inaugural (ej. 10 de noviembre de 2026).

### 1.2 Transformación Visual de la Landing (`landing.html`)
Al activarse el cierre, la landing pública transmuta para capitalizar el efecto psicológico de exclusividad (*FOMO*):
- **Hero Banner:** Pasa de *"🏆 Club Fundador 100 · Cupos Abiertos"* a:
  `🔒 CONVOCATORIA INAUGURAL CERRADA (100/100) · Cohorte Fundadora Bloqueada`.
- **Botón Principal:** Se actualiza a:
  `Lista de Espera Cohorte 2 (Próxima Fecha) ➔`.
- **Modal de Postulación:** Aclara que los nuevos registros entran en la **Lista de Reserva / Cohorte 2**, sirviendo de reemplazo inmediato en caso de bajas de última hora.

---

## 2. Fase de Triage, Curaduría y Asignación (24 Horas Post-Cierre)

### 2.1 Criterios de Selección y Scoring
El equipo fundador procesa la base de datos de `waitlist` aplicando 3 filtros de calidad:
1. **Verificación Profesional (LinkedIn):**
   - Perfil activo en Bogotá, fotografía real y trayectoria profesional coherente.
2. **Paridad Numérica (50% Mujeres / 50% Hombres):**
   - Asegura el balance perfecto de la sala para que las conversaciones fluyan de forma continua sin tiempos muertos.
3. **Agrupación por Cohortes Etarias:**
   - **Cohorte A:** 25 a 33 años.
   - **Cohorte B:** 34 a 42 años.

### 2.2 Asignación Nominal del Serial Fundador
A cada uno de los 100 seleccionados se le asigna su número oficial de serial:
- Formato: `Nº 001/100` a `Nº 100/100`.
- Este serial queda registrado en su perfil y coincide con el troquelado de su **Moneda de Barra física**.

---

## 3. Secuencia de Activación WhatsApp 1:1 (Día 1 a Día 4)

La conversión de lead a asistente confirmado se ejecuta mediante una secuencia de 3 mensajes personalizados:

### Mensaje 1: Notificación de Admisión & Estatus (Día 1)
```text
¡Hola [Nombre]! 🍸 Te escribe César, fundador de RONDA.

Revisamos tu postulación y tu perfil de LinkedIn ha sido admitido por nuestro comité para el Club Fundador 100 de RONDA.

Tu número oficial asignado es el: Nº [042]/100.

Tu Moneda de Barra conmemorativa en latón macizo ya está asignada en el taller de troquelado y te otorgará tu primer cóctel de cortesía vitalicio en cada uno de nuestros eventos.

Para asegurar tu mesa en la Noche Inaugural en Chapinero Alto, tienes una ventana exclusiva de 48 horas antes de que el cupo se libere al siguiente en la lista de reserva.

¿Te reservo tu pase inaugural hoy?
```

### Mensaje 2: Lock-in de Ticket & Pago Preferencial (Día 2)
- Se envía el enlace de cobro seguro nominal (Nequi / Wompi): **$45.000 COP** (Precio exclusivo Fundador, incluye 1 cóctel de autor + bono de retorno de -25%).
- Una vez pagado, el estado del lead pasa a `confirmed_founder` en Firestore.

### Mensaje 3: Verificación Biométrica & Pasaporte Digital (Día 3)
```text
¡Ticket confirmado, [Nombre]! 🥂

El último paso toma 40 segundos: ingresa aquí [ronda.uno/index.html?token=...] para completar tu verificación biométrica rápida (Face-ID). 

Todo ocurre en tu propio navegador bajo la Ley 1581 (sin subir fotos a servidores externos). Al completarlo, se emitirá tu Pasaporte Digital con QR para el check-in en la barra.
```

---

## 4. Fase de Revelación Clandestina (48h Previas al Evento)

Para mantener la atmósfera de exclusividad y misterio:
- **T-48 Horas:** Se envía un mensaje con:
  1. **Locación Revelada:** Nombre y dirección exacta del gastrobar aliado (ej. *La Huerta Bar*, Calle 69a # 10-15, Zona G / Chapinero Alto).
  2. **Hora de Check-in:** 19:30 (puertas cierran puntuales a las 19:55 para iniciar las rondas).
  3. **Dress Code:** *Smart Casual / Nocturno Elegante*.

---

## 5. La Experiencia Física de la Noche Inaugural

```
┌────────────────────────────────────────────────────────────────────────┐
│                        FLUJO EN SALA (NOCHE CERO)                      │
└────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
       [19:30] Llegada al Gastrobar: Anfitrión escanea QR del Pasaporte
                                    │
                                    ▼
       [19:35] Entrega en mano del Sobre Negro Lino con Lacre Rojo Vino:
               - Moneda de Barra Troquelada (Nº XXX/100)
               - Comanda de Iniciación con Decálogo de 6 Minutos
                                    │
                                    ▼
       [19:40] "El Cóctel Cero": El soltero desliza su moneda en la barra
               y recibe su primer cóctel de autor de cortesía
                                    │
                                    ▼
       [20:00] Suena la Campana de Bronce: Inicio de las 9 rondas de 6 min
               (Dinámica inteligente de rotación sin repetir personas)
                                    │
                                    ▼
       [21:15] Votación Secreta en la App (Sí / No privado por cada persona)
                                    │
                                    ▼
       [21:30] Brindis Social & Barra Abierta
```

---

## 6. El Bucle de Retención y Cierre (Día Siguiente)

1. **10:00 AM del Día Siguiente:**
   - La plataforma envía notificación: *"Tus resultados de anoche ya están listos"*.
   - Si hubo coincidencia mutua (*Double Opt-In*), se desbloquea el chat directo y el número verificado de WhatsApp.
2. **Activación del Bono de Retorno B2B (-25%):**
   - Ambos reciben un cupón digital del **25% de descuento** válido por 15 días en el mismo gastrobar para tener su segunda cita formal a solas, asegurando la facturación recurrente para el bar aliado.
3. **Loop Viral de Invitación:**
   - Cada Miembro Fundador desbloquea **2 Invitaciones Doradas (Golden Passes)** para recomendar a dos amigos profesionales a la Lista de Espera de la Cohorte 2.

---

## 7. Resumen de Estados del Lead en Base de Datos

| Estado en Firestore | Significado | Siguiente Acción del Sistema |
| :--- | :--- | :--- |
| `waitlist_pending` | Registrado en landing, pendiente de corte. | Envío de mail de confirmación de postulación. |
| `founder_accepted` | Aprobado en triage (Cupo 1 a 100). | Disparo de Mensaje 1 de WhatsApp con serial asignado. |
| `ticket_paid` | Pagó su entrada ($45.000 COP). | Envío de link para Face-ID y emisión de Pasaporte QR. |
| `kyc_verified` | Rostro verificado y pasaporte emitido. | Envío de locación secreta en T-48 horas. |
| `attended` | Escaneado en puerta en la noche inaugural. | Entrega de Moneda física y Cóctel Cero. |
| `waitlist_cohort_2` | Registrado después del cupo 100 o no pagó en 48h. | Asignación prioritaria para la fecha del siguiente mes. |
