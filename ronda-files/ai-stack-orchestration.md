# RONDA: Orquestación del Stack de IA (Antigravity + Perplexity + DeepSeek Harness)

Este documento maestro sirve como **Sistema de Contexto y División de Tareas** para el lanzamiento y operación de RONDA. Define claramente qué responsabilidades tiene cada inteligencia artificial según sus fortalezas, y provee a Perplexity del contexto necesario ("System Prompts" o "Skills") para ejecutar con 100% de eficacia.

---

## 1. Contexto Base de RONDA (Para alimentar a Perplexity)
*Al iniciar un nuevo hilo en Perplexity, puedes copiar y pegar este bloque para darle contexto inmediato.*

> **CONTEXTO DEL PROYECTO (RONDA):**
> Soy parte del equipo fundador de RONDA, una plataforma B2B2C en Colombia (Bogotá). Nuestro modelo llena bares y gastrobares en días valle (martes a jueves) organizando eventos de *speed dating* de 90 minutos mediante tecnología. 
> **La clave de nuestro negocio:** El bar NUNCA nos paga una factura por publicidad ni mensualidades. Nosotros asumimos el riesgo de la convocatoria. El bar nos cobra un "Acuerdo de Cóctel" a precio cerrado por 24 personas (12 parejas) y se queda con el 100% de la ganancia por cualquier consumo adicional. Vendemos "salas llenas garantizadas sin riesgo", no software.
> **Tu rol (Perplexity):** Actuar como Analista B2B, Relacionista Público e Investigador en tiempo real. Tu objetivo es buscar datos vivos en la web, redes sociales y noticias recientes para alimentar nuestras bases de datos de clientes, redactar comunicaciones ultra-personalizadas y darnos ventajas competitivas.

---

## 2. División de Funciones (El Stack AI)

### 🤖 Antigravity / Gemini (IDE & Local Agent)
* **El Arquitecto y Creador:** Yo vivo dentro de tu código y tus archivos. 
* **Responsabilidades:** 
  1. Escribir, refactorizar y depurar el código de la App y el algoritmo `MEM-RR` en tiempo real.
  2. Generar documentos internos (como este), manuales, y contratos que se guarden en tu sistema (`ronda-files`).
  3. Ejecutar comandos de terminal, desplegar servidores locales y validar que la plataforma no se caiga.
  4. Mantener la lógica de negocio y arquitectura intacta.

### 🌐 Perplexity.ai (Web Engine & Research)
* **El Cazador y PR (Public Relations):** Vive en la web y extrae datos vivos al segundo.
* **Responsabilidades:**
  1. Extraer contactos B2B, nombres de gerentes y redes sociales de bares específicos hoy.
  2. Escribir *Cold Emails* y comunicados de prensa basados en tendencias actuales del sector nocturno en Bogotá.
  3. Investigar la competencia local (ej. reseñas de Tinder o eventos de Speed Dating actuales) y encontrar sus fallas inmediatas.
  4. Analizar noticias sobre la industria para hacer *"newsjacking"* (aprovechar noticias para hacer publicidad).

### 🧠 DeepSeek (Harness / Reasoner)
* **El Motor Matemático y Arquitecto Lógico:** Brilla en problemas de razonamiento duro, matemáticas puras y lógica de código compleja (ej. modelos de la serie V3 o R1).
* **Responsabilidades:**
  1. Optimizar matemáticamente el algoritmo `MEM-RR` (Round-Robin con Memoria) para asegurar que nunca haya colisiones.
  2. Procesar *Harness Testing* o pruebas de estrés con grandes volúmenes de datos simulados.
  3. Realizar análisis de datos duros: proyecciones financieras y optimización de precios dinámicos según ocupación.

---

## 3. "Skills" (Prompts Maestros) para Perplexity

Usa estos comandos exactos en Perplexity para ejecutar las tareas. Cada "Skill" está diseñado para forzar a Perplexity a usar su motor de búsqueda profunda y entregar formatos listos para usar (tablas, correos, reportes).

### Skill 1: Generación de Bases de Datos B2B (Hunter Assistant)
**Copia y pega en Perplexity:**
> "Actúa como un SDR (Sales Development Representative) experto en la industria nocturna de Bogotá. Haz una búsqueda web profunda (usando Instagram, Google Maps, y TripAdvisor) para crear una base de datos de 25 bares, gastrobares y speakeasies en las zonas de Chapinero, Quinta Camacho, Zona T y Usaquén. 
> Filtra solo aquellos que tengan una estética premium, luz moderada y donde se pueda conversar. 
> Preséntalo en formato de tabla con las siguientes columnas: 
> 1. Nombre del Bar | 2. Zona | 3. Enlace a su Instagram | 4. ¿Tienen sistema de reservas público? (Sí/No/Link) | 5. ¿Por qué es un buen fit para un evento de Speed Dating de RONDA?
> Asegúrate de que los lugares estén operativos actualmente."

### Skill 2: Redacción de Cold Email Contextual (El Gancho)
**Copia y pega en Perplexity:**
> "Busca artículos recientes o noticias sobre la caída de ventas, inflación o dificultades de los gastrobares y restaurantes en Bogotá en días entre semana (lunes a jueves). 
> Usando esa información como gancho, redacta un 'Cold Email' de máximo 150 palabras dirigido al gerente de un bar de Quinta Camacho. 
> El tono debe ser directo, de negocios y cero corporativo. El mensaje principal debe ser: 'Vi [menciona el dato de la noticia sobre las ventas]. En RONDA te llenamos el bar un martes con 24 personas garantizadas y no te cobramos publicidad, solo acordamos el precio de una bebida por persona. ¿Hacemos una prueba piloto la otra semana?'"

### Skill 3: Inteligencia Competitiva (Destruir a la competencia local)
**Copia y pega en Perplexity:**
> "Busca foros (Reddit Colombia), reseñas de Google o blogs sobre la experiencia de ir a eventos tradicionales de Speed Dating (citas rápidas) en Bogotá en los últimos 2 años. 
> Extrae los 5 problemas más frustrantes que mencionan los usuarios (por ejemplo: desbalance entre hombres y mujeres, lugares muy ruidosos, gente que no les gusta, formatos aburridos). 
> Luego, escribe un post para el Instagram de RONDA (formato carrusel de 3 slides) donde contrastemos esos 5 errores de la competencia contra nuestra propuesta: 'Equilibrio garantizado, match mediado por tecnología y sedes premium (sin ruido)."

### Skill 4: PR & Lanzamiento (Nota de Prensa Rápida)
**Copia y pega en Perplexity:**
> "Busca cuáles son los 3 medios de tecnología o estilo de vida más leídos por los jóvenes profesionales en Bogotá (ej. revistas de ocio, portales de startups, cuentas de TikTok de planes). 
> Redacta una Nota de Prensa de 300 palabras anunciando el lanzamiento de RONDA mañana. 
> El titular debe ser clickbait pero veraz. Enfócate en el ángulo: 'La app que usa un algoritmo matemático para revivir los bares vacíos de Bogotá los martes, mientras te consigue citas reales'."

---

## 4. "Skills" para DeepSeek (Razonamiento Duro)

### Skill 5: Stress Testing del Algoritmo (DeepSeek)
**Copia y pega en DeepSeek Harness / R1:**
> "Actúa como un Staff Engineer experto en algoritmia. Tenemos un algoritmo de rotación llamado 'MEM-RR' (Round-Robin con Memoria) para eventos de 24 personas (12 parejas) que deben rotar 9 veces en mesas de 2 o de 4 personas. 
> Teniendo en cuenta que debemos evitar que dos personas que ya se conocieron en un evento anterior se vuelvan a cruzar, escribe un script en Python para someter este algoritmo a una prueba de estrés (Stress Test) simulando 100 eventos seguidos. 
> Identifica los casos límite (edge cases) donde la matriz de rotación podría fallar o entrar en un bucle infinito, y propón la solución matemática."

---

## Cómo iterar juntos mañana (Flujo de Trabajo del Triunvirato IA)
1. **Perplexity** te genera la tabla de 25 bares (Skill 1) investigando la web en tiempo real.
2. Agarras esa tabla y me la pasas a mí (**Antigravity**) para que yo genere un script que automatice el envío de los correos a esos bares.
3. Si el crecimiento nos exige ajustar el tamaño de los eventos (ej. pasar de 24 a 40 personas), le pides a **DeepSeek** (Skill 5) que rediseñe la matriz matemática del algoritmo.
4. Le pasas la nueva fórmula matemática de DeepSeek a mí (**Antigravity**) y yo refactorizo el código de la plataforma sin romper la base de datos de Firebase.
