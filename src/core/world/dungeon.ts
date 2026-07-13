/**
 * Dungeon run logic (M4, docs/03): a dungeon is a fixed sequence of rooms
 * (3 fights + boss in the Verwachsene Höhle) WITHOUT healing between rooms —
 * the player's HP is carried across the run. Aufgeben is possible at any
 * time; defeat or retreat inside a room ends the run.
 *
 * Pure, engine-free (CLAUDE.md rule 1): the store owns the run state and
 * calls these transition functions; the UI only renders store state.
 *
 * The run is intentionally NOT saved: a reload mid-run drops the run and the
 * player restarts it from the island (documented assumption — simplest
 * dead-end-free behavior; docs/03 only guarantees "Aufgeben jederzeit").
 */
import type { Rng } from '../combat/rng';
import type { EncounterResult, ShadowDensity } from './encounters';
import type { DungeonDef, DungeonRoomDef } from '../../data/dungeons/verwachseneHoehle';

/** Transient state of a running dungeon expedition (store-owned, unsaved). */
export interface DungeonRunState {
  dungeonId: string;
  /** 0-based index into DungeonDef.rooms. */
  roomIndex: number;
  /** HP carried into the next room (docs/03: no healing between rooms). */
  hp: number;
  /** Max HP at run start (level + talents) — fixed for the whole run. */
  maxHp: number;
}

/** Starts a run at room 0 with full HP (healing happens on the island only). */
export function startDungeonRun(dungeon: DungeonDef, maxHp: number): DungeonRunState {
  return { dungeonId: dungeon.id, roomIndex: 0, hp: maxHp, maxHp };
}

/** Room the run currently stands in front of (undefined = corrupt index). */
export function currentRoom(dungeon: DungeonDef, run: DungeonRunState): DungeonRoomDef | undefined {
  return dungeon.rooms[run.roomIndex];
}

/**
 * Builds the EncounterResult for a dungeon room. Elite rooms follow the
 * encounter-system affix rule (docs/02: exactly 1 random affix at density
 * >= 2, none below); normal and boss rooms carry no affix.
 */
export function roomEncounter(
  room: DungeonRoomDef,
  density: ShadowDensity,
  affixPool: readonly string[],
  rng: Rng,
): EncounterResult {
  const elite = room.elite === true;
  const affix =
    elite && density >= 2 && affixPool.length > 0
      ? (affixPool[Math.floor(rng() * affixPool.length)] ?? null)
      : null;
  return { enemies: room.enemies, elite, affix };
}

export type RoomVictoryResult =
  | { kind: 'advance'; run: DungeonRunState; rescuedNpc: string | null }
  | { kind: 'completed'; rescuedNpc: string | null };

/**
 * Applies a won room fight: HP is carried over (docs/03), the rescueNpc flag
 * of the room surfaces (docs/09: Orin, Raum 2), and winning the boss room
 * completes the dungeon (the caller grants boss XP and persists the flag).
 */
export function applyRoomVictory(
  dungeon: DungeonDef,
  run: DungeonRunState,
  remainingHp: number,
): RoomVictoryResult {
  const room = currentRoom(dungeon, run);
  const rescuedNpc = room?.rescueNpc ?? null;
  const isLastRoom = run.roomIndex >= dungeon.rooms.length - 1;
  if (room?.boss || isLastRoom) return { kind: 'completed', rescuedNpc };
  return {
    kind: 'advance',
    run: { ...run, roomIndex: run.roomIndex + 1, hp: Math.max(1, remainingHp) },
    rescuedNpc,
  };
}
