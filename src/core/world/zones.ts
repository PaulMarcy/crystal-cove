/**
 * Zone lookup — pure, engine-free logic (see CLAUDE.md rule 1).
 * The world layer feeds it rectangles parsed from the Tiled "zones" object
 * layer; encounter tables (M2 follow-up) ask "which zone is the player in?".
 */

export const ZONE_IDS = ['strand', 'wiese', 'waldrand'] as const;
export type ZoneId = (typeof ZONE_IDS)[number];

export interface ZoneRect {
  id: ZoneId;
  /** Pixel-space rectangle (Tiled object coordinates). */
  x: number;
  y: number;
  width: number;
  height: number;
}

export function isZoneId(value: string): value is ZoneId {
  return (ZONE_IDS as readonly string[]).includes(value);
}

/**
 * Returns the zone containing the point, or null if none does
 * (e.g. standing over water). Edges: left/top inclusive, right/bottom
 * exclusive, so adjacent zones never overlap on their shared border.
 */
export function zoneAt(zones: readonly ZoneRect[], x: number, y: number): ZoneId | null {
  for (const z of zones) {
    if (x >= z.x && x < z.x + z.width && y >= z.y && y < z.y + z.height) {
      return z.id;
    }
  }
  return null;
}
