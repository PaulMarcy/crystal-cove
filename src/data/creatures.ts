/**
 * Shadow-creature spawns on the Heimatbucht map (M2). Pure data — the scene
 * renders them, contact triggers an encounter roll for the zone the player
 * stands in (tables in src/data/encounters, roll in core/world/encounters).
 *
 * A map creature is a trigger, not the combat enemy list: the actual enemies
 * come from the zone's encounter table (docs/07). Placement counts per zone
 * are an assumption (docs don't specify spawn counts) — tune here.
 */
import type { ZoneId } from '../core/world/zones';

export interface CreatureSpawn {
  id: string;
  /** Fallback zone for the encounter roll if the player stands in no zone. */
  zone: ZoneId;
  /** Tile coordinates on the Heimatbucht map (16 px tiles). */
  tileX: number;
  tileY: number;
}

/** Radius (px) around the spawn point within which a creature wanders. */
export const creatureWanderRadius = 28;
/** Wander speed in px/s (slow drift — creatures are avoidable, docs/02). */
export const creatureWanderSpeed = 30;
/** Idle pause between wander moves, min/max in ms. */
export const creatureIdleMs = { min: 900, max: 2600 } as const;
/** Contact distance (px) player ↔ creature that triggers the encounter. */
export const creatureContactRange = 14;
/** Grace period (ms) after a non-victory combat before creatures re-trigger. */
export const encounterGraceMs = 1500;

export const heimatbuchtCreatureSpawns: readonly CreatureSpawn[] = [
  { id: 'hb-creature-wald-1', zone: 'waldrand', tileX: 18, tileY: 3 },
  { id: 'hb-creature-wald-2', zone: 'waldrand', tileX: 28, tileY: 4 },
  { id: 'hb-creature-wiese-1', zone: 'wiese', tileX: 12, tileY: 10 },
  { id: 'hb-creature-wiese-2', zone: 'wiese', tileX: 25, tileY: 13 },
  { id: 'hb-creature-wiese-3', zone: 'wiese', tileX: 34, tileY: 9 },
  { id: 'hb-creature-strand-1', zone: 'strand', tileX: 10, tileY: 21 },
  { id: 'hb-creature-strand-2', zone: 'strand', tileX: 26, tileY: 22 },
];
