# Replicabilidad y Despliegue en Otras Verticales (White-Labeling)

## Visión de Negocio
El desarrollo actual de **RONDA** no solo se concibe para eventos de citas en bares, sino como un motor de rotación y networking que puede ser extrapolado (White-Label) a otras industrias y verticales B2B2C.

## Verticales Potenciales
1. **Ronda Corporate (Networking B2B)**: En conferencias o eventos de cámaras de comercio, el algoritmo `MEM-RR` se ajusta para emparejar inversionistas con startups, cambiando la variable "orientación sexual" por "sector industrial" o "ticket de inversión".
2. **Ronda Académica (Ferias Universitarias)**: Rotación entre estudiantes y representantes de universidades o empresas para ferias de empleo.
3. **Ronda Gamers**: Torneos express presenciales donde los equipos rotan sin repetir contrincantes.

## Estrategia Técnica para Replicación

Para lanzar RONDA en otra vertical, el proyecto se estructura bajo el siguiente flujo de modificación:

1. **Configuración de Dominio (Firebase Projects)**:
   - Clonar las reglas de `firestore.rules` y `firebase.json`.
   - Inicializar un nuevo proyecto en Firebase apuntando al nuevo dominio.

2. **Personalización del Motor (Override en ronda-core.js)**:
   - Se redefine el método `getAffinityScore(p1, p2)` dentro de `ronda-core.js`.
   - La lógica matemática principal (`Weight = Afinity - (C * Collision)`) permanece idéntica. Se modifica únicamente la heurística de cálculo de Afinidad.

3. **Modificación Estética**:
   - Variables CSS y plantillas de Tailwind (si se integran) cambian a nivel de paleta.
   - El resto de la estructura `client.js` y `bar.js` sigue manejando entidades genéricas de "Evento", "Participante" y "Mesa".

## Defensa Tecnológica (Foso / Moat)
La documentacion presente sumada al modelo matemático MEM-RR, junto a los módulos modulares de KYC (Conoce a tu cliente) con `Tesseract/MediaPipe`, conforman una solución llave en mano (SaaS) altamente difícil de clonar en corto tiempo por competidores orgánicos.
