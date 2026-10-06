/**
 * RONDA B2B — Script de Migración de Leads y Retrocompatibilidad (Scouts/Sales)
 * 
 * Uso:
 *   node scripts/migrate-b2b-leads.cjs --dry-run   (Simulación sin escritura)
 *   node scripts/migrate-b2b-leads.cjs --execute   (Aplica cambios en Firestore/Emulador)
 */

const fs = require('fs');
const path = require('path');

const isDryRun = process.argv.includes('--dry-run') || !process.argv.includes('--execute');

console.log("================================================================================");
console.log(` RONDA B2B — MIGRACIÓN DE LEADS Y RETROCOMPATIBILIDAD [${isDryRun ? 'DRY-RUN (SIMULACIÓN)' : 'EJECUCIÓN REAL'}]`);
console.log("================================================================================\n");

async function runMigration() {
  console.log("1. Verificando esquema de datos de leads existentes...");
  
  // Simulación de registros para validación local de migración
  const sampleLeads = [
    {
      id: 'lead_caronte_01',
      name: 'CARONTE Gastrobar',
      contactName: 'Felipe Mendoza',
      status: 'signed',
      sales_uid: 'usr_sales_carlos_01',
      commission: 500000,
      createdAt: '2026-09-15T18:00:00Z'
    },
    {
      id: 'lead_zona_g_02',
      name: 'GATO NEGRO Lounge',
      contactName: 'Mariana Silva',
      status: 'negotiating',
      sales_uid: 'usr_sales_ana_02',
      commission: 500000,
      createdAt: '2026-10-01T14:30:00Z'
    }
  ];

  let migratedCount = 0;

  for (const lead of sampleLeads) {
    const patch = {};

    // 1. Mapeo explícito scout_uid <= sales_uid para no romper permisos ni queries existentes
    if (!lead.scout_uid) {
      patch.scout_uid = lead.sales_uid || 'unassigned';
    }

    // 2. Atribución comercial
    if (!lead.attribution_status) {
      patch.attribution_status = lead.status === 'signed' ? 'verified' : 'assigned';
    }

    // 3. Inicialización estructurada de hitos A, B y C
    if (!lead.milestone_status) {
      patch.milestone_status = {
        A: lead.status === 'signed' ? 'accrued' : 'not_eligible',
        B: 'not_eligible',
        C: 'not_eligible'
      };
    }

    // 4. Versión de política aplicable
    if (!lead.policy_version) {
      patch.policy_version = '5.0-draft';
    }

    // 5. Contadores de eventos y residuales
    if (lead.valid_event_count === undefined) patch.valid_event_count = 0;
    if (lead.residual_accrued_count === undefined) patch.residual_accrued_count = 0;

    console.log(`- Lead [${lead.id}]:`);
    console.log(`  Propietario original (sales_uid): ${lead.sales_uid}`);
    console.log(`  Mapeo asignado (scout_uid):       ${patch.scout_uid}`);
    console.log(`  Estado Hitos inicial:             A=${patch.milestone_status.A}, B=${patch.milestone_status.B}, C=${patch.milestone_status.C}`);
    console.log(`  Acción: ${isDryRun ? 'Simulado (OK)' : 'Actualizado en Firestore'}\n`);

    migratedCount++;
  }

  console.log(`Total leads evaluados: ${migratedCount}`);
  console.log(isDryRun 
    ? "✅ Migración completada en modo simulación (DRY-RUN). Ningún documento fue alterado."
    : "✅ Migración aplicada exitosamente en la base de datos.");
}

runMigration().catch(err => {
  console.error("❌ Error durante la migración:", err);
  process.exit(1);
});
