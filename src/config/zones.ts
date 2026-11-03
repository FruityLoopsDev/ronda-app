/**
 * Catálogo único de zonas operativas de Bogotá para RONDA B2B / CRM.
 */

export const BOGOTA_ZONES = [
  'Chapinero Alto',
  'Quinta Camacho',
  'Zona G',
  'Zona T / El Retiro',
  'Usaquén',
  'Parque 93',
  'Teusaquillo'
] as const;

export type BogotaZone = (typeof BOGOTA_ZONES)[number];

/**
 * Normaliza un texto para búsquedas insensibles a mayúsculas y tildes.
 */
export function normalizeSearchText(value?: string | null): string {
  if (!value) return '';
  return String(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

