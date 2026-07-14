import { beforeEach, describe, expect, it } from 'vitest';
import { emptyInventory } from '../core/economy/inventory';
import { deserialize, serialize } from '../core/save/save';
import { initialBuildingStages } from '../data/buildings';
import { initialStationTiers } from '../data/stations';
import { snapshotFromState } from './persistence';
import { dishSlotsOf, gameStore } from './store';

/**
 * Store wiring for M5 Task 1: building slots B1–B9 (docs/09) — material
 * deduction, station-tier mirroring (B2/B3 ↔ docs/10 Ausbaustufen), the
 * B1-Haus dish-slot effect and save persistence. Pure build rules live in
 * core/village with their own tests.
 */

beforeEach(() => {
  gameStore.setState({
    inventory: emptyInventory,
    builtBuildings: initialBuildingStages,
    stationTiers: initialStationTiers,
    storyFlags: [],
    friendshipLevels: {},
    rescuedNpcs: [],
    completedDungeons: [],
    activeBuildSlot: null,
    combat: null,
  });
});

describe('buildBuilding (docs/09)', () => {
  it('builds B4 Wohnhaus 1 and deducts exactly the docs/09 costs', () => {
    gameStore.setState({ inventory: { wood: 12, stone: 6 } });
    expect(gameStore.getState().buildBuilding('b4')).toBe(true);
    expect(gameStore.getState().builtBuildings.b4).toBe(1);
    expect(gameStore.getState().inventory).toEqual({ wood: 2 });
  });

  it('refuses without material and mutates nothing', () => {
    expect(gameStore.getState().buildBuilding('b4')).toBe(false);
    expect(gameStore.getState().builtBuildings.b4).toBe(0);
  });

  it('B3 upgrade mirrors the stage into the smithy station tier (docs/10)', () => {
    gameStore.setState({
      inventory: { stone: 6, copper_ore: 4 },
      friendshipLevels: { maro: 1 },
    });
    expect(gameStore.getState().buildBuilding('b3')).toBe(true);
    expect(gameStore.getState().builtBuildings.b3).toBe(2);
    expect(gameStore.getState().stationTiers.smithy).toBe(2);
  });

  it('B6 Kristallschrein needs Orin — independent of B7 (docs/09)', () => {
    gameStore.setState({ inventory: { shadow_dust: 10 } });
    expect(gameStore.getState().buildBuilding('b6')).toBe(false);
    gameStore.setState({ rescuedNpcs: ['orin'] });
    expect(gameStore.getState().buildBuilding('b6')).toBe(true);
    expect(gameStore.getState().builtBuildings.b7).toBe(0);
  });

  it('B8 Markt unlocks via the DERIVED island_cleansed flag', () => {
    gameStore.setState({ inventory: { wood: 12, stone: 4 } });
    expect(gameStore.getState().buildBuilding('b8')).toBe(false);
    gameStore.setState({ completedDungeons: ['verwachsene_hoehle'] });
    expect(gameStore.getState().buildBuilding('b8')).toBe(true);
  });

  it('B9 Bootshaus unlocks via setStoryFlag (piya_chain_complete)', () => {
    expect(gameStore.getState().buildBuilding('b9')).toBe(false);
    gameStore.getState().setStoryFlag('piya_chain_complete');
    expect(gameStore.getState().buildBuilding('b9')).toBe(true);
  });
});

describe('B1-Haus dish slots (docs/09: +1, Cap 2 gesamt)', () => {
  it('grants the second dish slot only with the finished house', () => {
    expect(dishSlotsOf(gameStore.getState())).toBe(1);
    gameStore.setState({ builtBuildings: { ...initialBuildingStages, b1: 3 } });
    expect(dishSlotsOf(gameStore.getState())).toBe(2);
  });
});

describe('persistence (additive-optional save fields)', () => {
  it('round-trips built stages, station tiers and flags through the save', () => {
    gameStore.setState({
      inventory: { stone: 6, copper_ore: 4 },
      friendshipLevels: { maro: 1 },
    });
    gameStore.getState().buildBuilding('b3');
    gameStore.getState().setStoryFlag('piya_chain_complete');
    const snapshot = snapshotFromState(gameStore.getState());
    const result = deserialize(serialize(snapshot));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    gameStore.setState({
      builtBuildings: initialBuildingStages,
      stationTiers: initialStationTiers,
      storyFlags: [],
    });
    gameStore.getState().hydrateFromSave(result.data, false);
    expect(gameStore.getState().builtBuildings.b3).toBe(2);
    expect(gameStore.getState().stationTiers.smithy).toBe(2);
    expect(gameStore.getState().storyFlags).toEqual(['piya_chain_complete']);
    expect(gameStore.getState().friendshipLevels).toEqual({ maro: 1 });
  });

  it('hydrates pre-M5 saves with the initial stages (B1–B3 = 1)', () => {
    const snapshot = snapshotFromState(gameStore.getState());
    const legacy = { ...snapshot };
    delete legacy.builtBuildings;
    delete legacy.stationTiers;
    delete legacy.storyFlags;
    delete legacy.friendshipLevels;
    const result = deserialize(serialize(legacy));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    gameStore.getState().hydrateFromSave(result.data, false);
    expect(gameStore.getState().builtBuildings).toEqual(initialBuildingStages);
    expect(gameStore.getState().stationTiers).toEqual(initialStationTiers);
  });
});
