import { beforeEach, describe, expect, it } from 'vitest';
import { emptyInventory } from '../core/economy/inventory';
import { maxHpForLevel } from '../core/progression/progression';
import { totalXpForLevel } from '../core/progression/progression';
import { starterDeckIds } from '../data/cards/tier1';
import { combatConfig } from '../data/combat';
import { initialShadowDensity } from '../data/encounters/tier1';
import { gameStore } from './store';

/**
 * Store wiring of the M4 Task 5 defeat flow (penalty logic in
 * core/economy/defeat): defeat → wake-up (heal, sleep cycle, 50 % run-loot
 * loss), dungeon abandon → same penalty without wake-up, HP persistence
 * between island combats, sleep resets the penalty window.
 */

beforeEach(() => {
  gameStore.setState({
    inventory: emptyInventory,
    harvestedNodeIds: [],
    shadowDensity: initialShadowDensity,
    playerPosition: null,
    playerZone: null,
    collection: [],
    deck: [...starterDeckIds],
    consumedStarterDishes: [],
    farmPlots: {},
    sleepCount: 0,
    toolTier: combatConfig.baseToolTier,
    activeStation: null,
    combat: null,
    combatSeed: null,
    combatLoot: null,
    currentEncounter: null,
    lastCombatOutcome: null,
    lastLoot: null,
    xp: 0,
    unlockedTalents: [],
    currentDungeonRun: null,
    rescuedNpcs: [],
    completedDungeons: [],
    lastRescuedNpc: null,
    playerHp: maxHpForLevel(1),
    lootSinceRest: emptyInventory,
    lastDefeatLoss: null,
  });
});

function endCombatWithPhase(phase: 'victory' | 'defeat' | 'retreated', remainingHp: number): void {
  const combat = gameStore.getState().combat!;
  gameStore.setState({
    combat: {
      ...combat,
      phase,
      player: { ...combat.player, hp: remainingHp },
      enemies:
        phase === 'victory' ? combat.enemies.map((e) => ({ ...e, hp: 0 })) : combat.enemies,
    },
  });
  gameStore.getState().endCombat();
}

describe('defeat flow (docs/03 Cozy-Anpassung 1)', () => {
  it('defeat removes 50 % of the run loot (floored, capped), heals fully, counts a sleep', () => {
    gameStore.setState({
      inventory: { wood: 5, stone: 1, resin: 3 },
      // wood: 5 gained → lose 2; stone: gained 3 but only 1 held → lose 1;
      // resin: not gained since rest → untouched.
      lootSinceRest: { wood: 5, stone: 3 },
    });
    expect(gameStore.getState().startEncounter('strand', 7)).toBe(true);
    endCombatWithPhase('defeat', 0);
    const s = gameStore.getState();
    expect(s.inventory).toEqual({ wood: 3, resin: 3 });
    expect(s.lastDefeatLoss).toEqual({ wood: 2, stone: 1 });
    expect(s.lootSinceRest).toEqual({});
    expect(s.playerHp).toBe(maxHpForLevel(1)); // wake up fully healed
    expect(s.sleepCount).toBe(1); // wake-up counts as a sleep cycle
    expect(s.harvestedNodeIds).toEqual([]);
    expect(s.lastCombatOutcome).toBe('defeat');
  });

  it('a second defeat right after has nothing left to take (no double penalty)', () => {
    gameStore.setState({ inventory: { wood: 4 }, lootSinceRest: { wood: 4 } });
    gameStore.getState().startEncounter('strand', 7);
    endCombatWithPhase('defeat', 0);
    expect(gameStore.getState().inventory).toEqual({ wood: 2 });
    gameStore.getState().startEncounter('strand', 7);
    endCombatWithPhase('defeat', 0);
    expect(gameStore.getState().inventory).toEqual({ wood: 2 });
    expect(gameStore.getState().lastDefeatLoss).toEqual({});
  });

  it('island victory persists remaining HP and the next combat starts from it', () => {
    gameStore.getState().startEncounter('strand', 7);
    endCombatWithPhase('victory', 13);
    expect(gameStore.getState().playerHp).toBe(13);
    gameStore.getState().startEncounter('strand', 8);
    expect(gameStore.getState().combat!.player.hp).toBe(13);
    endCombatWithPhase('retreated', 6);
    // Free-field retreat: HP persists, no loot penalty (docs/03).
    expect(gameStore.getState().playerHp).toBe(6);
    expect(gameStore.getState().lastDefeatLoss).toBeNull();
  });

  it('victory loot is tracked as run loot (defeat penalty basis)', () => {
    gameStore.getState().startEncounter('strand', 7);
    gameStore.setState({ combatLoot: { wood: 4 } });
    endCombatWithPhase('victory', 20);
    expect(gameStore.getState().lootSinceRest).toEqual({ wood: 4 });
  });

  it('sleep heals to full and closes the penalty window', () => {
    gameStore.setState({
      playerHp: 5,
      inventory: { wood: 8 },
      lootSinceRest: { wood: 8 },
    });
    gameStore.getState().sleep();
    const s = gameStore.getState();
    expect(s.playerHp).toBe(maxHpForLevel(1));
    expect(s.lootSinceRest).toEqual({});
    // Loot banked by resting is safe from a later defeat.
    gameStore.getState().startEncounter('strand', 7);
    endCombatWithPhase('defeat', 0);
    expect(gameStore.getState().inventory).toEqual({ wood: 8 });
  });

  it('harvesting tracks run loot', () => {
    expect(gameStore.getState().harvestNode('hb-tree-1')).toBe(true);
    const s = gameStore.getState();
    expect(s.lootSinceRest.wood).toBe(s.inventory.wood);
  });

  it('level-up heals by the max-HP difference (docs/02: +5 pro Level)', () => {
    gameStore.setState({ playerHp: 10 });
    gameStore.getState().grantXp(totalXpForLevel(2), 'combat');
    expect(gameStore.getState().playerHp).toBe(15);
  });

  it('abandonDungeonRun applies the penalty but keeps HP and position', () => {
    gameStore.setState({ inventory: { wood: 6 }, lootSinceRest: { wood: 6 }, playerHp: 22 });
    expect(gameStore.getState().enterDungeon('verwachsene_hoehle')).toBe(true);
    gameStore.getState().abandonDungeonRun();
    const s = gameStore.getState();
    expect(s.currentDungeonRun).toBeNull();
    expect(s.inventory).toEqual({ wood: 3 });
    expect(s.lastDefeatLoss).toEqual({ wood: 3 });
    expect(s.lootSinceRest).toEqual({});
    expect(s.playerHp).toBe(22); // no wake-up on Aufgeben (docs/03)
    expect(s.sleepCount).toBe(0);
  });

  it('defeat inside a dungeon ends the run with the same wake-up flow', () => {
    gameStore.setState({ inventory: { wood: 6 }, lootSinceRest: { wood: 6 }, playerHp: 30 });
    gameStore.getState().enterDungeon('verwachsene_hoehle');
    expect(gameStore.getState().startDungeonRoomCombat(7)).toBe(true);
    endCombatWithPhase('defeat', 0);
    const s = gameStore.getState();
    expect(s.currentDungeonRun).toBeNull();
    expect(s.inventory).toEqual({ wood: 3 });
    expect(s.playerHp).toBe(maxHpForLevel(1)); // fully healed in bed
    expect(s.sleepCount).toBe(1);
  });

  it('retreat inside a dungeon = Aufgeben: penalty, run ends, island HP untouched', () => {
    gameStore.setState({ inventory: { wood: 6 }, lootSinceRest: { wood: 6 }, playerHp: 17 });
    gameStore.getState().enterDungeon('verwachsene_hoehle');
    gameStore.getState().startDungeonRoomCombat(7);
    endCombatWithPhase('retreated', 12);
    const s = gameStore.getState();
    expect(s.currentDungeonRun).toBeNull();
    expect(s.inventory).toEqual({ wood: 3 });
    expect(s.playerHp).toBe(17);
    expect(s.sleepCount).toBe(0);
  });
});
