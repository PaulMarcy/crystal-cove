import { beforeEach, describe, expect, it } from 'vitest';
import { emptyInventory } from '../core/economy/inventory';
import { maxHpForLevel } from '../core/progression/progression';
import { starterDeckIds } from '../data/cards/tier1';
import { combatConfig } from '../data/combat';
import { initialShadowDensity } from '../data/encounters/tier1';
import { xpSources } from '../data/progression';
import { gameStore } from './store';

/**
 * Store wiring for the M4 dungeon run (core logic in core/world/dungeon):
 * enter → room fights → HP carry-over → Orin flag → boss completion + XP.
 * Combat outcomes are injected via setState (the reducer has its own tests).
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
  });
});

function winCurrentCombat(remainingHp: number): void {
  const combat = gameStore.getState().combat!;
  gameStore.setState({
    combat: {
      ...combat,
      phase: 'victory',
      player: { ...combat.player, hp: remainingHp },
      enemies: combat.enemies.map((e) => ({ ...e, hp: 0 })),
    },
  });
  gameStore.getState().endCombat();
}

describe('dungeon run flow', () => {
  it('enterDungeon starts a run at room 1 with full HP and blocks re-entry', () => {
    expect(gameStore.getState().enterDungeon('verwachsene_hoehle')).toBe(true);
    const run = gameStore.getState().currentDungeonRun!;
    expect(run.roomIndex).toBe(0);
    expect(run.hp).toBe(maxHpForLevel(1, 0));
    expect(gameStore.getState().enterDungeon('verwachsene_hoehle')).toBe(false);
    expect(gameStore.getState().enterDungeon('unknown')).toBe(false);
  });

  it('startEncounter is blocked while a dungeon run is active', () => {
    gameStore.getState().enterDungeon('verwachsene_hoehle');
    expect(gameStore.getState().startEncounter('strand', 7)).toBe(false);
  });

  it('room victory carries HP into the next room (docs/03: keine Heilung)', () => {
    gameStore.getState().enterDungeon('verwachsene_hoehle');
    expect(gameStore.getState().startDungeonRoomCombat(7)).toBe(true);
    winCurrentCombat(23);
    const run = gameStore.getState().currentDungeonRun!;
    expect(run.roomIndex).toBe(1);
    expect(run.hp).toBe(23);
    // Next room's combat starts at the carried HP, not full HP.
    gameStore.getState().startDungeonRoomCombat(7);
    expect(gameStore.getState().combat!.player.hp).toBe(23);
    expect(gameStore.getState().combat!.player.maxHp).toBe(run.maxHp);
  });

  it('room 2 victory rescues Orin (persisted flag + panel feedback)', () => {
    gameStore.getState().enterDungeon('verwachsene_hoehle');
    gameStore.getState().startDungeonRoomCombat(7);
    winCurrentCombat(30);
    gameStore.getState().startDungeonRoomCombat(7);
    winCurrentCombat(25);
    expect(gameStore.getState().rescuedNpcs).toContain('orin');
    expect(gameStore.getState().lastRescuedNpc).toBe('orin');
    // Starting the next fight clears the feedback flag.
    gameStore.getState().startDungeonRoomCombat(7);
    expect(gameStore.getState().lastRescuedNpc).toBeNull();
  });

  it('boss victory completes the dungeon and grants boss XP (docs/07: 300)', () => {
    gameStore.getState().enterDungeon('verwachsene_hoehle');
    for (let room = 0; room < 3; room++) {
      gameStore.getState().startDungeonRoomCombat(7);
      winCurrentCombat(30);
    }
    const xpBeforeBoss = gameStore.getState().xp;
    gameStore.getState().startDungeonRoomCombat(7);
    expect(gameStore.getState().combat!.enemies[0]!.def.id).toBe('root_warden');
    winCurrentCombat(10);
    expect(gameStore.getState().currentDungeonRun).toBeNull();
    expect(gameStore.getState().completedDungeons).toEqual(['verwachsene_hoehle']);
    expect(gameStore.getState().xp - xpBeforeBoss).toBe(xpSources.boss);
  });

  it('defeat ends the run (TODO M4 Task 5: Malus)', () => {
    gameStore.getState().enterDungeon('verwachsene_hoehle');
    gameStore.getState().startDungeonRoomCombat(7);
    gameStore.setState({ combat: { ...gameStore.getState().combat!, phase: 'defeat' } });
    gameStore.getState().endCombat();
    expect(gameStore.getState().currentDungeonRun).toBeNull();
    expect(gameStore.getState().completedDungeons).toEqual([]);
  });

  it('abandonDungeonRun ends the run between rooms (docs/03: jederzeit)', () => {
    gameStore.getState().enterDungeon('verwachsene_hoehle');
    gameStore.getState().abandonDungeonRun();
    expect(gameStore.getState().currentDungeonRun).toBeNull();
  });

  it('talent Bollwerk grants +3 start block in dungeon fights only (docs/02)', () => {
    gameStore.setState({ unlockedTalents: ['bulwark'] });
    gameStore.getState().startEncounter('strand', 7);
    expect(gameStore.getState().combat!.player.block).toBe(0);
    gameStore.getState().endCombat();
    gameStore.getState().enterDungeon('verwachsene_hoehle');
    gameStore.getState().startDungeonRoomCombat(7);
    expect(gameStore.getState().combat!.player.block).toBe(3);
  });

  it('elite room 3 fights the thorn_terror with an affix at density >= 2', () => {
    gameStore.setState({ shadowDensity: 2 });
    gameStore.getState().enterDungeon('verwachsene_hoehle');
    gameStore.getState().startDungeonRoomCombat(7);
    winCurrentCombat(30);
    gameStore.getState().startDungeonRoomCombat(7);
    winCurrentCombat(25);
    gameStore.getState().startDungeonRoomCombat(7);
    const state = gameStore.getState();
    expect(state.combat!.enemies).toHaveLength(1);
    expect(state.combat!.enemies[0]!.def.id).toBe('thorn_terror');
    expect(state.currentEncounter!.elite).toBe(true);
    expect(state.currentEncounter!.affix).not.toBeNull();
  });
});
