/**
 * Exploration data Heimatbucht (M4 Task 2, docs/02 "Schattendichte").
 *
 * V1 definition of "Erkundungs-%" (documented as an assumption in docs/02):
 * each island has a fixed list of exploration markers — its zones (revealed
 * on first entry) plus shrine/secret spots (revealed on approach). The
 * exploration percentage is discovered markers / total markers; the shadow
 * density is derived from it via the thresholds in data/encounters/tier1
 * (25 % / 50 % / 75 % → density 1 / 2 / 3).
 *
 * Heimatbucht has 5 markers → 20 % per discovery: 1 marker = 20 % (density
 * 0), 2 = 40 % (1), 3 = 60 % (2, elites), 4 = 80 % (3), 5 = 100 %.
 */
import type { ZoneId } from '../core/world/zones';
import type { ExplorationMarkerDef } from '../core/world/exploration';

/** Marker id for a zone — first entry into the zone discovers it. */
export function zoneMarkerId(zone: ZoneId): string {
  return `zone:${zone}`;
}

/** Shrine/secret spots placed on the Heimatbucht map (tile coordinates). */
export interface ShrinePlacement {
  markerId: string;
  /** 'shrine' and 'secret' render differently but share the XP source. */
  kind: 'shrine' | 'secret';
  tileX: number;
  tileY: number;
}

/**
 * Placements: shrine at the eastern forest edge (Waldrand), secret at the
 * western beach tip (Strand) — docs pin no positions, chosen to reward
 * walking the map corners.
 */
export const heimatbuchtShrines: readonly ShrinePlacement[] = [
  { markerId: 'shrine:hb-waldschrein', kind: 'shrine', tileX: 37, tileY: 3 },
  { markerId: 'secret:hb-strandgut', kind: 'secret', tileX: 3, tileY: 22 },
];

/** Max distance (px) at which a shrine/secret is discovered on approach. */
export const shrineDiscoverRange = 24;

/** All exploration markers of the Heimatbucht (zones + shrines/secrets). */
export const heimatbuchtExplorationMarkers: readonly ExplorationMarkerDef[] = [
  { id: zoneMarkerId('strand'), kind: 'area' },
  { id: zoneMarkerId('wiese'), kind: 'area' },
  { id: zoneMarkerId('waldrand'), kind: 'area' },
  ...heimatbuchtShrines.map((s) => ({ id: s.markerId, kind: 'shrine' as const })),
];
