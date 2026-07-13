/**
 * Persistence wiring — connects the game store to the pure save module
 * (core/save). This is the only place that decides WHEN to save;
 * WHAT and HOW (format, checksum, slots) lives entirely in core/save.
 *
 * Autosave triggers (docs/05 "Spielstand"; docs have no fixed schedule,
 * chosen conservatively):
 *   - after every combat end (loot is in the inventory at that point)
 *   - after every harvest / inventory or shadow-density change
 *   - on page unload (captures the latest player position)
 * Never during a running combat — combats are not resumable (a reload
 * mid-combat restarts on the island, no progress except position is lost
 * because loot is only granted at endCombat).
 */

import type { SaveData } from '../core/save/save';
import { loadGame, saveGame, type LoadResult, type SaveStorage } from '../core/save/storage';
import { gameStore, type GameState } from './store';

export function snapshotFromState(state: GameState): SaveData {
  return {
    inventory: state.inventory,
    harvestedNodeIds: state.harvestedNodeIds,
    shadowDensity: state.shadowDensity,
    playerPosition: state.playerPosition,
    playerZone: state.playerZone,
    collection: state.collection,
    deck: state.deck,
    consumedStarterDishes: state.consumedStarterDishes,
    farmPlots: state.farmPlots,
    sleepCount: state.sleepCount,
    toolTier: state.toolTier,
    xp: state.xp,
    unlockedTalents: state.unlockedTalents,
    discoveredMarkers: state.discoveredMarkers,
    // Dungeon outcomes only — the RUNNING run is never saved (core/world/dungeon).
    rescuedNpcs: state.rescuedNpcs,
    completedDungeons: state.completedDungeons,
  };
}

/**
 * Loads the save (backup fallback happens inside core/save), hydrates the
 * store and subscribes the autosave triggers. Call once at boot, BEFORE
 * Phaser starts — HeimatbuchtScene reads harvestedNodeIds/playerPosition
 * from the store when it spawns.
 */
export function initPersistence(storage: SaveStorage): LoadResult {
  const result = loadGame(storage);
  if (result.data) {
    gameStore.getState().hydrateFromSave(result.data, result.recovered);
  }

  gameStore.subscribe((state, prev) => {
    if (state.combat !== null) return; // never persist mid-combat
    const combatJustEnded = prev.combat !== null && state.combat === null;
    const persistedSliceChanged =
      state.inventory !== prev.inventory ||
      state.harvestedNodeIds !== prev.harvestedNodeIds ||
      state.shadowDensity !== prev.shadowDensity ||
      state.collection !== prev.collection ||
      state.deck !== prev.deck ||
      state.consumedStarterDishes !== prev.consumedStarterDishes ||
      state.farmPlots !== prev.farmPlots ||
      state.sleepCount !== prev.sleepCount ||
      state.toolTier !== prev.toolTier ||
      state.xp !== prev.xp ||
      state.unlockedTalents !== prev.unlockedTalents ||
      state.discoveredMarkers !== prev.discoveredMarkers ||
      state.rescuedNpcs !== prev.rescuedNpcs ||
      state.completedDungeons !== prev.completedDungeons;
    if (combatJustEnded || persistedSliceChanged) {
      saveGame(storage, snapshotFromState(state));
    }
  });

  // Player position changes every tile — persist it once, on the way out.
  if (typeof window !== 'undefined') {
    window.addEventListener('beforeunload', () => {
      if (gameStore.getState().combat !== null) return;
      saveGame(storage, snapshotFromState(gameStore.getState()));
    });
  }

  return result;
}
