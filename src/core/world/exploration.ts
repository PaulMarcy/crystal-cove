/**
 * Exploration progress — pure, engine-free logic (CLAUDE.md rule 1).
 *
 * docs/02 "Schattendichte": per uncleansed island the density 0–3 rises at
 * 25 % / 50 % / 75 % exploration progress. "Erkundungs-%" is operationalized
 * as discovered markers / total markers (V1 assumption, see docs/02 and
 * src/data/exploration.ts). Marker lists and thresholds are data
 * (src/data); this module only interprets them.
 *
 * XP: area = 25, shrine/secret = 40 (docs/02), scaled by the Kartenkenner
 * talent multiplier (docs/02: +50 % on exploration XP, rounded).
 */
import type { ShadowDensity } from './encounters';

export type ExplorationMarkerKind = 'area' | 'shrine';

export interface ExplorationMarkerDef {
  id: string;
  kind: ExplorationMarkerKind;
}

/**
 * Discovers a marker: returns the grown list, or null when the marker is
 * unknown or already discovered (idempotent — double discovery is a no-op
 * for the caller: no XP, no density change).
 */
export function discoverMarker(
  discovered: readonly string[],
  markerId: string,
  markers: readonly ExplorationMarkerDef[],
): readonly string[] | null {
  if (!markers.some((m) => m.id === markerId)) return null;
  if (discovered.includes(markerId)) return null;
  return [...discovered, markerId];
}

/**
 * Exploration progress as a fraction 0..1. Unknown ids in `discovered`
 * (e.g. stale save entries) are ignored, so the fraction never exceeds 1.
 */
export function explorationFraction(
  discovered: readonly string[],
  markers: readonly ExplorationMarkerDef[],
): number {
  if (markers.length === 0) return 0;
  const known = markers.filter((m) => discovered.includes(m.id)).length;
  return known / markers.length;
}

/**
 * Shadow density for an exploration fraction (docs/02): density rises to
 * 1 / 2 / 3 AT the thresholds (25 % reached ⇒ density 1). Monotone in the
 * fraction; never exceeds 3.
 */
export function densityForExploration(
  fraction: number,
  thresholds: readonly [number, number, number],
): ShadowDensity {
  let density: ShadowDensity = 0;
  thresholds.forEach((threshold, index) => {
    if (fraction >= threshold) density = (index + 1) as ShadowDensity;
  });
  return density;
}

/**
 * Effective shadow density (docs/02 "Reinigung"): once the island boss is
 * defeated the island is cleansed and its density is PERMANENTLY 0 —
 * regardless of exploration progress. Cleansing beats the exploration-derived
 * density; elites/affixes disappear automatically (they require density ≥ 2).
 */
export function effectiveShadowDensity(density: ShadowDensity, cleansed: boolean): ShadowDensity {
  return cleansed ? 0 : density;
}

/**
 * XP for discovering a marker: base value per kind (data/progression via
 * caller) times the exploration XP multiplier (Kartenkenner), rounded.
 */
export function explorationXp(
  kind: ExplorationMarkerKind,
  baseXp: Readonly<Record<ExplorationMarkerKind, number>>,
  multiplier: number,
): number {
  return Math.round(baseXp[kind] * multiplier);
}
