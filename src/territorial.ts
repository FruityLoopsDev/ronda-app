/**
 * territorial.ts — Motor de exclusividad territorial de la Red de Bares (500 m).
 *
 * Se extrajo de `entry-network.ts` porque ese archivo arranca el portal de red
 * al importarse: cualquier otro módulo (por ejemplo el panel SuperAdmin) que
 * necesitara el cálculo Haversine terminaba montando el portal completo y su
 * ciclo de vida. Aquí vive únicamente el cálculo puro, sin efectos colaterales.
 */
import type { Venue } from './db.js';

export interface ExclusivityConflict {
  conflictingVenueId: string;
  conflictingVenueName: string;
  distanceMeters: number;
  zone: string;
}

export interface ExclusivityCheckResult {
  isCompliant: boolean; // true si respeta el radio de exclusividad (>= 500m)
  conflicts: ExclusivityConflict[];
  closestDistanceMeters: number;
}

export const EXCLUSIVITY_CONFIG = {
  MIN_DISTANCE_METERS: 500,
  EARTH_RADIUS_METERS: 6371000,
  // 500m representan aprox 0.0045 grados en Bogotá (~4.6°N)
  BOUNDING_BOX_DELTA_DEG: 0.006
};

/**
 * Calcula la distancia ortodrómica en metros entre dos coordenadas geográficas
 * mediante la fórmula de Haversine con estabilidad numérica.
 */
export function calculateHaversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  if (lat1 === lat2 && lon1 === lon2) return 0;

  const toRad = Math.PI / 180;
  const φ1 = lat1 * toRad;
  const φ2 = lat2 * toRad;
  const Δφ = (lat2 - lat1) * toRad;
  const Δλ = (lon2 - lon1) * toRad;

  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ / 2) * Math.sin(Δλ / 2);

  const c = 2 * Math.atan2(Math.sqrt(Math.max(0, Math.min(1, a))), Math.sqrt(Math.max(0, 1 - a)));

  return Math.round(EXCLUSIVITY_CONFIG.EARTH_RADIUS_METERS * c);
}

/**
 * Verifica si un punto geográfico candidato cumple con el radio de exclusividad
 * de 500m frente a los locales ya registrados y activos en la red.
 */
export function checkTerritorialExclusivity(
  candidate: { lat: number; lng: number; id?: string },
  existingVenues: Venue[],
  minRadiusMeters: number = EXCLUSIVITY_CONFIG.MIN_DISTANCE_METERS
): ExclusivityCheckResult {
  const conflicts: ExclusivityConflict[] = [];
  let closestDistanceMeters = Infinity;

  for (const venue of existingVenues) {
    // No comparar contra sí mismo si se está editando
    if (candidate.id && venue.id === candidate.id) continue;
    // Solo locales activos generan conflicto de exclusividad comercial
    if (venue.status !== 'active') continue;
    if (typeof venue.lat !== 'number' || typeof venue.lng !== 'number') continue;

    // Filtro rápido Bounding Box (evita cálculos trigonométricos costosos)
    if (
      Math.abs(venue.lat - candidate.lat) > EXCLUSIVITY_CONFIG.BOUNDING_BOX_DELTA_DEG ||
      Math.abs(venue.lng - candidate.lng) > EXCLUSIVITY_CONFIG.BOUNDING_BOX_DELTA_DEG
    ) {
      continue;
    }

    const distance = calculateHaversineDistance(candidate.lat, candidate.lng, venue.lat, venue.lng);
    if (distance < closestDistanceMeters) {
      closestDistanceMeters = distance;
    }

    if (distance < minRadiusMeters) {
      conflicts.push({
        conflictingVenueId: venue.id,
        conflictingVenueName: venue.name,
        distanceMeters: distance,
        zone: venue.zone || 'Bogotá'
      });
    }
  }

  return {
    isCompliant: conflicts.length === 0,
    conflicts,
    closestDistanceMeters: closestDistanceMeters === Infinity ? -1 : closestDistanceMeters
  };
}

/**
 * Detecta todos los pares en conflicto dentro de la red completa.
 */
export function detectAllNetworkCollisions(
  venues: Venue[],
  minRadiusMeters: number = EXCLUSIVITY_CONFIG.MIN_DISTANCE_METERS
): Map<string, ExclusivityConflict[]> {
  const collisions = new Map<string, ExclusivityConflict[]>();
  const activeVenues = venues.filter(v => v.status === 'active' && typeof v.lat === 'number' && typeof v.lng === 'number');

  for (let i = 0; i < activeVenues.length; i++) {
    for (let j = i + 1; j < activeVenues.length; j++) {
      const v1 = activeVenues[i];
      const v2 = activeVenues[j];

      // Bounding Box check
      if (
        Math.abs(v1.lat - v2.lat) > EXCLUSIVITY_CONFIG.BOUNDING_BOX_DELTA_DEG ||
        Math.abs(v1.lng - v2.lng) > EXCLUSIVITY_CONFIG.BOUNDING_BOX_DELTA_DEG
      ) {
        continue;
      }

      const dist = calculateHaversineDistance(v1.lat, v1.lng, v2.lat, v2.lng);
      if (dist < minRadiusMeters) {
        const c1: ExclusivityConflict = { conflictingVenueId: v2.id, conflictingVenueName: v2.name, distanceMeters: dist, zone: v2.zone };
        const c2: ExclusivityConflict = { conflictingVenueId: v1.id, conflictingVenueName: v1.name, distanceMeters: dist, zone: v1.zone };

        if (!collisions.has(v1.id)) collisions.set(v1.id, []);
        if (!collisions.has(v2.id)) collisions.set(v2.id, []);
        collisions.get(v1.id)!.push(c1);
        collisions.get(v2.id)!.push(c2);
      }
    }
  }

  return collisions;
}
