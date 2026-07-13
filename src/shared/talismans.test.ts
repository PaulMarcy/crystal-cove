import { beforeEach, describe, expect, it } from 'vitest';
import { emptyInventory } from '../core/economy/inventory';
import { levelForXp, talismanSlotsForLevel } from '../core/progression/progression';
import { deserialize, serialize } from '../core/save/save';
import { starterDeckIds } from '../data/cards/tier1';
import { combatConfig } from '../data/combat';
import { initialShadowDensity } from '../data/encounters/tier1';
import { snapshotFromState } from './persistence';
import { cleansedOf, effectiveDensityOf, gameStore } from './store';

/**
 * Store wiring for M4 Task 4: cleansing (permanent density 0 via
 * completedDungeons) and functional talismans (Dornenring — ownership from
 * loot, equip slots from level, Vergeltung 1 at combat start).
 * Pure rules live in core (exploration/talismans) with their own tests.
 */

/** Enough XP for level 8+ (talisman slot 1, docs/02). */
const XP_LEVEL_8 = 100_000;

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
    ownedTalismans: [],
    equippedTalismans: [],
  });
});

describe('cleansing (docs/02: Inselboss besiegt → Dichte dauerhaft 0)', () => {
  it('completing the Wurzelwächter dungeon cleanses the Heimatbucht', () => {
    expect(cleansedOf(gameStore.getState())).toBe(false);
    gameStore.setState({ completedDungeons: ['verwachsene_hoehle'], shadowDensity: 3 });
    expect(cleansedOf(gameStore.getState())).toBe(true);
    expect(effectiveDensityOf(gameStore.getState())).toBe(0);
  });

  it('cleansed encounters spawn UNSCALED enemies without elites/affixes', () => {
    gameStore.setState({ completedDungeons: ['verwachsene_hoehle'], shadowDensity: 3 });
    expect(gameStore.getState().startEncounter('waldrand', 7)).toBe(true);
    const state = gameStore.getState();
    // Density 0: base HP (no +30 %), never elite, never an affix (docs/02).
    for (const enemy of state.combat!.enemies) {
      expect(enemy.maxHp).toBe(enemy.def.hp);
    }
    expect(state.currentEncounter!.elite).toBe(false);
    expect(state.currentEncounter!.affix).toBeNull();
  });

  it('an uncleansed island keeps its exploration-derived density', () => {
    gameStore.setState({ shadowDensity: 3 });
    expect(effectiveDensityOf(gameStore.getState())).toBe(3);
  });

  it('repeat dungeon rooms on a cleansed island scale at density 0', () => {
    gameStore.setState({ completedDungeons: ['verwachsene_hoehle'], shadowDensity: 3 });
    gameStore.getState().enterDungeon('verwachsene_hoehle');
    gameStore.getState().startDungeonRoomCombat(7);
    for (const enemy of gameStore.getState().combat!.enemies) {
      expect(enemy.maxHp).toBe(enemy.def.hp);
    }
  });
});

describe('talisman ownership from loot (docs/07: Dornenschreck → Dornenring)', () => {
  it('a dropped talisman item becomes ownership, not an inventory item', () => {
    gameStore.getState().startEncounter('strand', 7);
    const combat = gameStore.getState().combat!;
    gameStore.setState({
      combat: {
        ...combat,
        phase: 'victory',
        enemies: combat.enemies.map((e) => ({ ...e, hp: 0 })),
      },
      combatLoot: { thorn_ring: 1, vine: 3 },
    });
    gameStore.getState().endCombat();
    const state = gameStore.getState();
    expect(state.ownedTalismans).toEqual(['thorn_ring']);
    expect(state.inventory.thorn_ring).toBeUndefined();
    expect(state.inventory.vine).toBe(3);
  });
});

describe('equipping talismans (docs/02: Slot 1 ab Lv 8)', () => {
  it('equip is blocked below level 8 (0 slots)', () => {
    gameStore.setState({ ownedTalismans: ['thorn_ring'] });
    expect(talismanSlotsForLevel(levelForXp(0))).toBe(0);
    expect(gameStore.getState().equipTalisman('thorn_ring')).toBe(false);
  });

  it('equip/unequip works at level 8+ and respects ownership', () => {
    gameStore.setState({ ownedTalismans: ['thorn_ring'], xp: XP_LEVEL_8 });
    expect(levelForXp(XP_LEVEL_8)).toBeGreaterThanOrEqual(8);
    expect(gameStore.getState().equipTalisman('unowned')).toBe(false);
    expect(gameStore.getState().equipTalisman('thorn_ring')).toBe(true);
    expect(gameStore.getState().equippedTalismans).toEqual(['thorn_ring']);
    expect(gameStore.getState().equipTalisman('thorn_ring')).toBe(false); // duplicate
    expect(gameStore.getState().unequipTalisman('thorn_ring')).toBe(true);
    expect(gameStore.getState().equippedTalismans).toEqual([]);
  });

  it('an equipped Dornenring starts every combat with Vergeltung 1', () => {
    gameStore.setState({
      ownedTalismans: ['thorn_ring'],
      equippedTalismans: ['thorn_ring'],
      xp: XP_LEVEL_8,
    });
    gameStore.getState().startEncounter('strand', 7);
    expect(gameStore.getState().combat!.player.statuses.retaliate).toBe(1);
    gameStore.getState().endCombat();
    // Dungeon fights get it too.
    gameStore.getState().enterDungeon('verwachsene_hoehle');
    gameStore.getState().startDungeonRoomCombat(7);
    expect(gameStore.getState().combat!.player.statuses.retaliate).toBe(1);
  });

  it('without equipped talismans combats start status-free', () => {
    gameStore.setState({ ownedTalismans: ['thorn_ring'] });
    gameStore.getState().startEncounter('strand', 7);
    expect(gameStore.getState().combat!.player.statuses).toEqual({});
  });
});

describe('persistence (additive-optional V2 fields, no version bump)', () => {
  it('round-trips owned/equipped talismans through the save codec', () => {
    gameStore.setState({ ownedTalismans: ['thorn_ring'], equippedTalismans: ['thorn_ring'] });
    const result = deserialize(serialize(snapshotFromState(gameStore.getState())));
    expect(result.ok && result.data.ownedTalismans).toEqual(['thorn_ring']);
    expect(result.ok && result.data.equippedTalismans).toEqual(['thorn_ring']);
  });

  it('hydrates missing talisman fields (old saves) to empty lists', () => {
    const snapshot = snapshotFromState(gameStore.getState());
    delete (snapshot as { ownedTalismans?: unknown }).ownedTalismans;
    delete (snapshot as { equippedTalismans?: unknown }).equippedTalismans;
    gameStore.setState({ ownedTalismans: ['stale'], equippedTalismans: ['stale'] });
    gameStore.getState().hydrateFromSave(snapshot, false);
    expect(gameStore.getState().ownedTalismans).toEqual([]);
    expect(gameStore.getState().equippedTalismans).toEqual([]);
  });
});
