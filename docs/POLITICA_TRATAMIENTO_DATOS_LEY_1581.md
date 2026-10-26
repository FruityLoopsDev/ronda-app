# Política de Tratamiento de Datos Personales (Habeas Data — Ley 1581 de 2012)

> **Responsable del Tratamiento:** RONDA System.  
> **Domicilio:** Bogotá D.C., Colombia.  
> **Canal de Protección de Datos:** legal@ronda.uno / soporte@ronda.uno  
> **Normativa Aplicable:** Constitución Política de Colombia (Art. 15), Ley Estatutaria 1581 de 2012, Decreto Reglamentario 1377 de 2013 y Circular Única de la Superintendencia de Industria y Comercio (SIC).

---

## 1. Principios Rectores del Tratamiento
En RONDA aplicamos de manera rigurosa los principios legales de:
- **Legalidad y Finalidad:** Los datos se recopilan únicamente para fines legítimos, transparentes e informados al titular.
- **Libertad y Consentimiento Previo:** El tratamiento solo se realiza previa autorización expresa, libre e informada del usuario.
- **Veracidad y Calidad:** La información debe ser veraz, completa, exacta y actualizada.
- **Acceso y Circulación Restringida:** Los datos no están disponibles indiscriminadamente en internet ni se comercializan con terceros.
- **Seguridad y Confidencialidad:** Implementamos medidas técnicas (cifrado, tokens, reglas de Firestore con privilegios mínimos) para impedir adulteración, pérdida o acceso no autorizado.

---

## 2. Tipos de Datos Recopilados y Tratamiento de Datos Sensibles

### 2.1 Datos Personales Generales
- Nombre completo, correo electrónico, número de teléfono móvil (WhatsApp).
- Perfil profesional público de LinkedIn (para verificación de identidad y estatus profesional).
- Edad y género (para balance de salas y mesas en el algoritmo de rotación).

### 2.2 Datos Sensibles (Biometría Facial)
- **Autorización Expresa:** Conforme al Artículo 6 de la Ley 1581 de 2012, el tratamiento de datos sensibles es de carácter facultativo. RONDA solicita consentimiento explícito antes de activar la cámara para el escaneo facial.
- **Finalidad Única:** La captura y vectorización facial (Face-ID) se utiliza de forma exclusiva para la prevención de suplantación de identidad y validación en puerta de los gastrobares aliados.
- **No Comercialización:** Los descriptores biométricos **jamás se venden, comparten ni transfieren** a centrales de riesgo, anunciantes ni entidades externas.

---

## 3. Finalidades Específicas del Tratamiento
1. Gestionar el registro, verificación y emisión de pasaportes digitales para los eventos presenciales.
2. Ejecutar el algoritmo matemático de emparejamiento y rotación (`mem-rr-v2`) evitando colisiones con personas ya conocidas.
3. Coordinar la logística de reserva, check-in en barra y entrega de consumos pactados en los locales aliados.
4. Notificar a las 10:00 AM del día siguiente las coincidencias mutuas (*Double Opt-In*) exclusivamente a quienes hayan manifestado interés recíproco.
5. Gestionar la facturación de tickets y comunicaciones operativas mediante WhatsApp y correo electrónico.

---

## 4. Derechos de los Titulares de la Información (Habeas Data)
El titular de los datos personales tiene derecho a:
1. **Conocer, actualizar y rectificar** sus datos personales en cualquier momento.
2. **Solicitar prueba de la autorización** otorgada al Responsable.
3. **Ser informado** sobre el uso que se ha dado a sus datos personales.
4. **Presentar quejas** ante la Superintendencia de Industria y Comercio (SIC) por infracciones a la ley.
5. **Revocar la autorización y/o solicitar la supresión de sus datos personales** cuando considere que no se respetan los principios, derechos y garantías constitucionales.

---

## 5. Procedimiento Ágil de Supresión de Datos («Derecho al Olvido / Darse de Baja»)

### 5.1 En la Aplicación Web (Autoservicio Inmediato)
El usuario puede solicitar la supresión total de su cuenta y datos personales directamente desde su perfil:
1. Ingresa a la sección **Perfil / Configuración de Privacidad**.
2. Presiona el botón **«Darse de baja y suprimir mis datos»**.
3. El sistema despliega un modal con la advertencia legal de irreversibilidad y un **cuestionario opcional de motivos de salida** (utilizado de forma 100% anonimizada para métricas de retención).
4. Al confirmar:
   - Se elimina de forma permanente su documento de usuario, descriptores faciales y fotos en Firestore y Storage.
   - Se elimina su usuario en Firebase Authentication.
   - Se borran cachés locales (`localforage` y `localStorage`).
   - Se cierra la sesión de inmediato.

### 5.2 Mediante Solicitud Escrita (PQRS)
El usuario también puede enviar un correo a **legal@ronda.uno** con el asunto *"Solicitud de Supresión de Datos Personales — Ley 1581"*. El equipo dará respuesta y ejecutará la baja en un término máximo de **diez (10) días hábiles**, conforme al Art. 15 de la Ley 1581.

---

## 6. Vigencia de las Bases de Datos
Los datos personales se conservarán mientras el usuario mantenga su cuenta activa en RONDA o no ejerza su derecho de supresión. Al eliminarse la cuenta, los datos son purgados de los servidores activos de producción.
