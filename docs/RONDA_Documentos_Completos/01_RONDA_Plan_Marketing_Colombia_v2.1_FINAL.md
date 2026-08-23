# RONDA - Plan de Marketing Estratégico 12 Meses
**Versión 2.1 Final | Bogotá 2026 | Adaptado Completamente al Contexto Colombiano**

---

## RESUMEN EJECUTIVO

### ¿Qué es RONDA?
Plataforma B2B2C que llena bares y gastrobares en días valle (martes a jueves) con **eventos de speed dating de 90 minutos**. Resuelve dos dolores simultáneamente:

- **Para usuarios:** Citas reales con personas verificadas, sin infinitos perfiles de apps; ambiente controlado, seguro y social
- **Para locales:** Facturación garantizada en sus peores noches (martes-jueves) con consumo seguro, sin inversión en captación

### Modelo Financiero (COP/USD)
- **Entrada Usuario:** 45.600–68.400 COP ($12–$18 USD)
- **Margen Contribución/Evento (24 asistentes):** 492.024 COP (~$129.50)
- **Estructura Mensual:** 35.720.000 COP (~$9.400 USD)
- **Revenue Mes 12 (Densidad 12 locales):** ~53.000.000 COP (~$13.950 USD/mes)

---

## OBSESIONES CLAVE (12 MESES)

1. **Densidad Antes Que Cobertura:** 12 locales en 1 barrio concentrado, no 3 ciudades a medias
2. **Adquisición B2B es el Cuello de Botella:** Cada bar nuevo = cohort de usuarios verificados
3. **Equilibrio de Lados Gobierna Todo:** Ratio 1,0–1,15 M:F (o lado escaso). Sin equilibrio = producto roto

---

## PROCESAMIENTO DE PAGOS: WOMPI

### Por Qué WOMPI vs Stripe/PayPal
- **Regulación Local:** Fintech colombiana respaldada por Bancolombia; cumple ACH y PSE
- **Costo:** 2.9% + 500 COP (~$0.13) vs Stripe 3.49% + $0.30; **ahorro ~380 COP/transacción**
- **PSE Nativa:** Tasa conversión +18% (colombianos pagan directo de cuenta bancaria)
- **Payouts Rápidos:** 24h a cuenta local vs 3-5 días Stripe
- **Soporte Local:** Chat/teléfono en español; equipo entiende mercado

### Arquitectura de Integración
1. **Registro & KYC:** 5 min + 1-2h verificación
2. **API Setup:** 1h (sandbox + production keys)
3. **Integración:** Typeform+Zapier | Bubble | React/Node.js custom
4. **Testing:** 1 día (6 test cases)
5. **Go Live:** 1 día + monitoreo 24/7

### Checklist Pre-Lanzamiento
- ✓ Cuenta WOMPI verificada (KYC)
- ✓ 6 sandbox transactions exitosas
- ✓ Webhook HMAC SHA256 validación
- ✓ Primera transacción real en producción
- ✓ Email confirmación automática
- ✓ QR generado y descargable
- ✓ Dashboard monitoreado diariamente
- ✓ Soporte 24h WOMPI escalado

---

## OBJETIVOS 12 MESES

| Métrica | Target |
|---------|--------|
| **Locales Contratados** | 12 |
| **Ocupación Media** | ≥85% |
| **Repeat Users (90d)** | ≥35% |
| **Matches → Citas Reales** | ≥18% |
| **Retención Locales (6m)** | ≥80% |
| **CAC / LTV** | <45.600 COP / >170.000 COP |
| **Revenue Mes 12** | ~53.000.000 COP |

---

## STACK OPERATIVO (COSTOS MES 1-6)

| Etapa | Herramienta | Mes 1 | Mes 3 | Mes 6 |
|-------|------------|-------|-------|-------|
| **Signup** | Typeform + Stripe | Free | Free | Free |
| **Email/Push** | Brevo | 114.000 | 114.000 | 114.000 |
| **Social** | Instagram + Later | 95.000 | 95.000 | 95.000 |
| **Analytics** | GA4 + Mixpanel | Free | 760.000 | 760.000 |
| **CRM Bares** | Airtable + Zapier | 76.000 | 76.000 | 76.000 |
| **Pagos** | WOMPI | ~18.000/evento | ~18.000/evento | ~18.000/evento |
| **TOTAL** | — | ~304.000 | ~1.140.000 | ~3.800.000 |

---

## PRÓXIMOS PASOS INMEDIATOS

### Mes 1 (Semanas 1-4)
- Cerrar 4-6 bares Zona G + Quinta Camacho (pitch in-person)
- Activar WOMPI (KYC + sandbox testing completado)
- 50+ usuarios verificados via embajadoras
- Validar equilibrio de lados M:F en primeros 3 eventos

### Mes 2-4 (Onda 2)
- Escalar a 12 locales
- App MVP live (Typeform → Bubble o React)
- 200+ usuarios base
- CAC <45.600 COP validado

### Mes 5-9 (Onda 3)
- Expansión geográfica solo si Zona G está densa (85%+ ocupación)
- Repeat rate 35%+ consolidado
- 80%+ local retention validado

### Mes 10-12 (Onda 4)
- SaaS + merchandise + patrocinio
- Preparar Serie A para años 2-3

---

## CURRENCY REFERENCE
- **Base:** COP (Pesos Colombianos) para operaciones locales
- **Reporting:** USD para reportes corporativos
- **Tasa Base:** 1 USD = 3.800 COP

**Documento confidencial | Uso interno | Lanzamiento Bogotá 2026**
