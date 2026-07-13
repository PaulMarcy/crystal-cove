/**
 * Dungeon „Verwachsene Höhle" (docs/03: Dungeon Heimatbucht = 3 Kämpfe +
 * Boss, keine Heilung zwischen den Räumen, Aufgeben jederzeit möglich;
 * docs/07: Boss Wurzelwächter; docs/09: Orin wird in Raum 2 befreit —
 * vor dem Boss, emotionale Belohnung des Dungeons).
 *
 * Pure data — the dungeon flow/scene is built by ui-engineer (M4).
 *
 * Assumptions (docs leave these open; flagged, not silently doc-changed):
 * - docs/07 names no concrete room encounters → picked from the Tier-1
 *   pool with rising difficulty: R1 Käfer+Ratte (28 HP), R2
 *   Kriecher+Käfer (34 HP), R3 Elite Dornenschreck (35 HP + affix rules).
 * - Dungeon fights scale WITH shadow density, consistent with the island
 *   (docs/02 defines density scaling globally, no dungeon exception).
 * - Room names are flavor strings only (strings.dungeons.*).
 */
import type { EnemyDef } from '../../core/combat/types';
import { enemiesById } from '../enemies/tier1';
import { strings } from '../../shared/strings';

export interface DungeonRoomDef {
  id: string;
  name: string;
  /** Enemy ids resolved through enemiesById (must all exist). */
  enemies: readonly string[];
  /** Elite room: elite affix rules from the encounter system apply. */
  elite?: boolean;
  /** Boss room: ends the dungeon, awards boss XP (progression data). */
  boss?: boolean;
  /**
   * NPC freed AFTER winning this room's fight (docs/09: Orin, Raum 2).
   * Data flag only — the rescue scene is ui-engineer's M4 task.
   */
  rescueNpc?: string;
}

export interface DungeonDef {
  id: string;
  name: string;
  /** Rooms in fixed order; no healing between rooms (docs/03). */
  rooms: readonly DungeonRoomDef[];
  /** Dungeon fights scale with shadow density like island fights (assumption, see header). */
  scalesWithDensity: boolean;
}

const roomStrings = strings.dungeons.verwachsene_hoehle.rooms;

export const verwachseneHoehle: DungeonDef = {
  id: 'verwachsene_hoehle',
  name: strings.dungeons.verwachsene_hoehle.name,
  scalesWithDensity: true,
  rooms: [
    {
      id: 'cave_entrance',
      name: roomStrings.cave_entrance,
      enemies: ['copper_beetle', 'shadow_rat'],
    },
    {
      id: 'root_chamber',
      name: roomStrings.root_chamber,
      enemies: ['thorn_creeper', 'copper_beetle'],
      rescueNpc: 'orin',
    },
    {
      id: 'thorn_passage',
      name: roomStrings.thorn_passage,
      enemies: ['thorn_terror'],
      elite: true,
    },
    {
      id: 'heart_of_the_cave',
      name: roomStrings.heart_of_the_cave,
      enemies: ['root_warden'],
      boss: true,
    },
  ],
};

/** Sanity export for tests/wiring: every referenced enemy id must resolve. */
export const allDungeons: readonly DungeonDef[] = [verwachseneHoehle];

export const dungeonsById: Record<string, DungeonDef> = Object.fromEntries(
  allDungeons.map((d) => [d.id, d]),
);

/** World placement of a dungeon entrance (Phaser sprite + interact prompt). */
export interface DungeonEntrancePlacement {
  dungeonId: string;
  tileX: number;
  tileY: number;
}

/**
 * Cave mouth in the Waldrand treeline (rows 0–2 are solid trees on the map,
 * so the entrance sits embedded in row 2 and is approached from row 3).
 */
export const heimatbuchtDungeonEntrances: readonly DungeonEntrancePlacement[] = [
  { dungeonId: 'verwachsene_hoehle', tileX: 23, tileY: 2 },
];

/** Max distance (px) at which the entrance prompt appears (like stations). */
export const dungeonEntranceInteractRange = 28;

// Fail fast in dev if data drifts (also covered by tests).
for (const dungeon of allDungeons) {
  for (const room of dungeon.rooms) {
    for (const enemyId of room.enemies) {
      const def: EnemyDef | undefined = enemiesById[enemyId];
      if (!def) throw new Error(`Dungeon ${dungeon.id}: unknown enemy '${enemyId}'`);
    }
  }
}
