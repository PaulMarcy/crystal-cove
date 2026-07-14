import { describe, expect, it } from 'vitest';
import { createRng } from '../combat/rng';
import { applyRoomVictory, currentRoom, roomEncounter, startDungeonRun } from './dungeon';
import { verwachseneHoehle } from '../../data/dungeons/verwachseneHoehle';
import { eliteAffixIds } from '../../data/encounters/tier1';

describe('startDungeonRun', () => {
  it('starts at room 0 with full HP', () => {
    const run = startDungeonRun(verwachseneHoehle, 40);
    expect(run).toEqual({
      dungeonId: 'verwachsene_hoehle',
      roomIndex: 0,
      hp: 40,
      maxHp: 40,
    });
    expect(currentRoom(verwachseneHoehle, run)?.id).toBe('cave_entrance');
  });
});

describe('applyRoomVictory', () => {
  it('advances through the fixed room order and carries HP over (docs/03)', () => {
    let run = startDungeonRun(verwachseneHoehle, 40);
    const r1 = applyRoomVictory(verwachseneHoehle, run, 28);
    expect(r1.kind).toBe('advance');
    if (r1.kind !== 'advance') return;
    expect(r1.run.roomIndex).toBe(1);
    expect(r1.run.hp).toBe(28); // no healing between rooms
    expect(r1.rescuedNpc).toBeNull();
    run = r1.run;
    expect(currentRoom(verwachseneHoehle, run)?.id).toBe('root_chamber');
  });

  it('surfaces the rescueNpc flag after room 2 (docs/09: Orin)', () => {
    const run = { ...startDungeonRun(verwachseneHoehle, 40), roomIndex: 1 };
    const result = applyRoomVictory(verwachseneHoehle, run, 20);
    expect(result.kind).toBe('advance');
    expect(result.rescuedNpc).toBe('orin');
  });

  it('completes the dungeon when the boss room is won', () => {
    const run = { ...startDungeonRun(verwachseneHoehle, 40), roomIndex: 3 };
    const result = applyRoomVictory(verwachseneHoehle, run, 5);
    expect(result).toEqual({ kind: 'completed', rescuedNpc: null });
  });

  it('never carries less than 1 HP into the next room', () => {
    const run = startDungeonRun(verwachseneHoehle, 40);
    const result = applyRoomVictory(verwachseneHoehle, run, 0);
    if (result.kind !== 'advance') throw new Error('expected advance');
    expect(result.run.hp).toBe(1);
  });
});

describe('roomEncounter', () => {
  const rooms = verwachseneHoehle.rooms;

  it('normal rooms yield their enemies without elite or affix', () => {
    const result = roomEncounter(rooms[0]!, 3, eliteAffixIds, createRng(1));
    expect(result).toEqual({
      enemies: rooms[0]!.enemies,
      elite: false,
      affix: null,
    });
  });

  it('elite room rolls exactly one affix at density >= 2 (docs/02)', () => {
    const result = roomEncounter(rooms[2]!, 2, eliteAffixIds, createRng(7));
    expect(result.elite).toBe(true);
    expect(result.affix).not.toBeNull();
    expect(eliteAffixIds).toContain(result.affix);
  });

  it('elite room has no affix below density 2', () => {
    const result = roomEncounter(rooms[2]!, 1, eliteAffixIds, createRng(7));
    expect(result.elite).toBe(true);
    expect(result.affix).toBeNull();
  });

  it('boss room is a plain non-elite encounter (boss XP handled by the caller)', () => {
    const result = roomEncounter(rooms[3]!, 3, eliteAffixIds, createRng(1));
    expect(result).toEqual({ enemies: ['root_warden'], elite: false, affix: null });
  });
});
