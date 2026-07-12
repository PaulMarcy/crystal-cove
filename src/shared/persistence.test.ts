import { beforeEach, describe, expect, it } from 'vitest';
import { deserialize, serialize, type SaveData } from '../core/save/save';
import { PRIMARY_KEY, saveGame, type SaveStorage } from '../core/save/storage';
import { initPersistence, snapshotFromState } from './persistence';
import { gameStore } from './store';
import { emptyInventory } from '../core/economy/inventory';
import { initialShadowDensity } from '../data/encounters/tier1';
import { starterDeck, starterDeckIds } from '../data/cards/tier1';
import { shadowRat } from '../data/enemies/tier1';

function memoryStorage(): SaveStorage & { map: Map<string, string> } {
  const map = new Map<string, string>();
  return {
    map,
    getItem: (key) => map.get(key) ?? null,
    setItem: (key, value) => void map.set(key, value),
    removeItem: (key) => void map.delete(key),
  };
}

const savedGame: SaveData = {
  inventory: { wood: 4 },
  harvestedNodeIds: ['tree-1'],
  shadowDensity: 1,
  playerPosition: { x: 100, y: 200 },
  playerZone: 'strand',
  collection: ['stone_wall'],
  toolTier: 2,
  deck: [...starterDeckIds],
};

/** Reset the singleton store's persisted slice between tests. */
beforeEach(() => {
  gameStore.setState({
    inventory: emptyInventory,
    harvestedNodeIds: [],
    shadowDensity: initialShadowDensity,
    playerPosition: null,
    playerZone: null,
    combat: null,
    saveRecovered: false,
    xp: 0,
    unlockedTalents: [],
    discoveredMarkers: [],
  });
});

describe('persistence wiring', () => {
  it('hydrates the store from an existing save', () => {
    const storage = memoryStorage();
    saveGame(storage, savedGame);
    const result = initPersistence(storage);
    expect(result.source).toBe('primary');
    const state = gameStore.getState();
    expect(state.inventory).toEqual(savedGame.inventory);
    expect(state.harvestedNodeIds).toEqual(savedGame.harvestedNodeIds);
    expect(state.playerPosition).toEqual(savedGame.playerPosition);
    expect(state.playerZone).toBe('strand');
    expect(state.saveRecovered).toBe(false);
  });

  it('sets the recovery flag when the backup restored the game', () => {
    const storage = memoryStorage();
    saveGame(storage, savedGame);
    saveGame(storage, { ...savedGame, inventory: { wood: 5 } });
    storage.map.set(PRIMARY_KEY, 'corrupted!!');
    initPersistence(storage);
    expect(gameStore.getState().saveRecovered).toBe(true);
    expect(gameStore.getState().inventory).toEqual({ wood: 4 });
  });

  it('starts fresh (no hydration) when storage is empty', () => {
    initPersistence(memoryStorage());
    expect(gameStore.getState().inventory).toEqual({});
    expect(gameStore.getState().saveRecovered).toBe(false);
  });

  it('autosaves when the inventory changes (harvest trigger)', () => {
    const storage = memoryStorage();
    initPersistence(storage);
    gameStore.setState({ inventory: { stone: 2 } });
    const raw = storage.map.get(PRIMARY_KEY);
    expect(raw).toBeDefined();
    const loaded = deserialize(raw!);
    expect(loaded.ok && loaded.data.inventory).toEqual({ stone: 2 });
  });

  it('does not autosave while a combat is running', () => {
    const storage = memoryStorage();
    initPersistence(storage);
    gameStore.getState().startCombat(
      {
        playerHp: 30,
        deck: [...starterDeck],
        enemies: [shadowRat],
      },
      42,
    );
    expect(storage.map.has(PRIMARY_KEY)).toBe(false);
    gameStore.getState().endCombat();
    // Combat end is an autosave trigger.
    expect(storage.map.has(PRIMARY_KEY)).toBe(true);
  });

  it('hydrates progression fields and defaults them on older saves (M4, additive)', () => {
    const storage = memoryStorage();
    saveGame(storage, { ...savedGame, xp: 450, unlockedTalents: ['blade_hone'] });
    initPersistence(storage);
    expect(gameStore.getState().xp).toBe(450);
    expect(gameStore.getState().unlockedTalents).toEqual(['blade_hone']);

    // Older save without the fields: defaults, no error (no version bump).
    const legacy = memoryStorage();
    saveGame(legacy, savedGame);
    gameStore.setState({ xp: 999, unlockedTalents: ['toughness'] });
    initPersistence(legacy);
    expect(gameStore.getState().xp).toBe(0);
    expect(gameStore.getState().unlockedTalents).toEqual([]);
  });

  it('autosaves when xp or talents change (progression trigger)', () => {
    const storage = memoryStorage();
    initPersistence(storage);
    gameStore.getState().grantXp(25, 'area');
    const raw = storage.map.get(PRIMARY_KEY);
    expect(raw).toBeDefined();
    const loaded = deserialize(raw!);
    expect(loaded.ok && loaded.data.xp).toBe(25);
  });

  it('hydrates discovered markers and derives density; older saves default (M4 Task 2)', () => {
    const storage = memoryStorage();
    // 3 of 5 markers → 60 % → derived density 2 wins over the stored 1.
    saveGame(storage, {
      ...savedGame,
      discoveredMarkers: ['zone:strand', 'zone:wiese', 'zone:waldrand'],
    });
    initPersistence(storage);
    expect(gameStore.getState().discoveredMarkers).toEqual([
      'zone:strand',
      'zone:wiese',
      'zone:waldrand',
    ]);
    expect(gameStore.getState().shadowDensity).toBe(2);

    // Older save without the field: empty markers, stored density kept.
    const legacy = memoryStorage();
    saveGame(legacy, savedGame);
    initPersistence(legacy);
    expect(gameStore.getState().discoveredMarkers).toEqual([]);
    expect(gameStore.getState().shadowDensity).toBe(savedGame.shadowDensity);
  });

  it('autosaves when a marker is discovered (exploration trigger)', () => {
    const storage = memoryStorage();
    initPersistence(storage);
    gameStore.getState().discoverMarker('zone:wiese');
    const raw = storage.map.get(PRIMARY_KEY);
    expect(raw).toBeDefined();
    const loaded = deserialize(raw!);
    expect(loaded.ok && loaded.data.discoveredMarkers).toEqual(['zone:wiese']);
  });

  it('snapshotFromState mirrors serialize round-trip', () => {
    gameStore.setState({
      inventory: { berry: 1 },
      harvestedNodeIds: ['rock-3'],
      playerPosition: { x: 5, y: 6 },
      playerZone: 'wiese',
    });
    const snap = snapshotFromState(gameStore.getState());
    expect(deserialize(serialize(snap))).toEqual({ ok: true, data: snap });
  });
});
