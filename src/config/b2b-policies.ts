/**
 * RONDA B2B — Políticas Económicas y de Compensación (Scouts y Hosters)
 * Versión: 5.0 (Consolidada)
 * 
 * IMPORTANTE:
 * - Los valores marcados como 'draft' son PROPUESTAS del modelo de diseño y NO
 *   obligaciones contractuales hasta la aprobación explícita del fundador.
 * - Los valores 'confirmed' son directrices ya fijadas por el fundador.
 */

export interface ScoutPolicy {
  version: string;
  status: 'draft' | 'approved';
  effective_from: string;
  approved_by?: string;
  
  // Hitos de Adquisición (Bounty Base = 450.000 COP)
  hit_a_cop: number; // 100.000 COP: Firma y verificación independiente
  hit_b_cop: number; // 250.000 COP: Primer evento válido >= 16 asistentes pagados con check-in
  hit_c_cop: number; // 100.000 COP: Evaluación desde día 90, bar activo y >= 8 eventos válidos
  
  // Reglas de Activación
  min_attendance_hit_b: number; // 16 asistentes únicos pagados con check-in
  min_retention_events_hit_c: number; // 8 eventos válidos
  retention_days_hit_c: number; // 90 días calendario
  b_review_days: number; // 7 días de ventana de revisión antes de desembolso
  
  // Residuales
  residual_standard_cop: number; // 30.000 COP por noche válida posterior
  tier3_residual_cop: number; // 40.000 COP para Tier 3 (7+ bares)
  residual_limit: number; // Máximo 12 residuales por bar
  residual_max_per_week: number; // Máximo 1 residual por semana (lunes a domingo America/Bogota)
  residual_window_months: number; // Ventana de 6 meses desde firma
  
  // Tiers y Aceleradores de Cohorte Mensual
  tier_threshold_2: number; // 4 a 6 bares activados en el mes
  tier_threshold_3: number; // 7 o más bares activados en el mes
  accelerator_bps: number; // 2000 bps = +20% sobre hitos base (A=120k, B=300k, C=120k)
}

export interface HostPolicy {
  version: string;
  status: 'draft' | 'approved';
  effective_from: string;
  approved_by?: string;
  
  default_fee_cop: number; // 250.000 COP por evento de 3 horas (CONFIRMADO)
  service_duration_hours: number; // 3 horas
  
  // Políticas propuestas desactivadas por defecto
  bonus_enabled: boolean; // false
  bonus_amount_cop: number; // 30.000 COP
  cancellation_comp_enabled: boolean; // false
  cancellation_comp_amount_cop: number; // 100.000 COP
  cancellation_notice_hours: number; // 24 horas
  
  frequency_alert_events_per_week: number; // 2 eventos/semana (Alerta de frecuencia, no bloqueo legal)
}

export interface EconomicsConfig {
  ticket_price_scenario_cop: number; // 75.000 COP (Ticket modelado)
  ticket_reference_previous_cop: number; // 65.000 COP
  bar_package_cap_cop: number; // 22.500 COP por asistente (CONFIRMADO)
  bar_price_tax_included: boolean; // true
  operational_weekdays: string[]; // ['tue', 'wed', 'thu'] (CONFIRMADO: martes, miércoles, jueves)
  timezone: string; // 'America/Bogota'
  forecast_tax_scenario: string; // 'conservative_19' (IVA 19% hipotético)
  forecast_only: boolean; // true (No inferir determinación tributaria automática)
  payment_gateway: {
    variable_pct: number; // 0.0265 (2.65%)
    fixed_cop: number; // 700 COP
    vat_multiplier: number; // 1.19
  };
}

export interface ComplianceConfig {
  rut_required: boolean; // Obligatorio para todos los colaboradores/prestadores
  pila_required: boolean; // Aporte a seguridad social verificado
  manual_superadmin_approval_required: boolean; // Desembolso exclusivamente manual aprobado por superadmin
}

export const DEFAULT_COMPLIANCE: ComplianceConfig = {
  rut_required: true,
  pila_required: true,
  manual_superadmin_approval_required: true
};

// Configuración por defecto (Versión 5.1 - Decisiones del Fundador Aplicadas)
export const DEFAULT_SCOUT_POLICY: ScoutPolicy = {
  version: '5.1-confirmed',
  status: 'approved',
  effective_from: '2026-10-05T00:00:00-05:00',
  hit_a_cop: 100000,
  hit_b_cop: 250000,
  hit_c_cop: 100000, // CONFIRMADO POR EL FUNDADOR
  min_attendance_hit_b: 16,
  min_retention_events_hit_c: 8, // CONFIRMADO: 8 eventos en 90 días
  retention_days_hit_c: 90,
  b_review_days: 7,
  residual_standard_cop: 30000,
  tier3_residual_cop: 40000,
  residual_limit: 12,
  residual_max_per_week: 1,
  residual_window_months: 6,
  tier_threshold_2: 4,
  tier_threshold_3: 7,
  accelerator_bps: 2000
};

export const DEFAULT_HOST_POLICY: HostPolicy = {
  version: '5.1-confirmed',
  status: 'approved',
  effective_from: '2026-10-05T00:00:00-05:00',
  default_fee_cop: 250000, // CONFIRMADO
  service_duration_hours: 3,
  bonus_enabled: false, // PROPUESTA DESACTIVADA
  bonus_amount_cop: 30000,
  cancellation_comp_enabled: false, // PROPUESTA DESACTIVADA
  cancellation_comp_amount_cop: 100000,
  cancellation_notice_hours: 24,
  frequency_alert_events_per_week: 2
};

export const DEFAULT_ECONOMICS: EconomicsConfig = {
  ticket_price_scenario_cop: 75000, // CONFIRMADO POR EL FUNDADOR: 75.000 COP
  ticket_reference_previous_cop: 65000,
  bar_package_cap_cop: 22500, // CONFIRMADO: 22.500 COP
  bar_price_tax_included: true,
  operational_weekdays: ['tue', 'wed', 'thu'], // CONFIRMADO: martes, miércoles, jueves
  timezone: 'America/Bogota',
  forecast_tax_scenario: 'conservative_19',
  forecast_only: true,
  payment_gateway: {
    variable_pct: 0.0265,
    fixed_cop: 700,
    vat_multiplier: 1.19
  }
};
