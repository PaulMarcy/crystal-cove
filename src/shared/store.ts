import { createStore } from 'zustand/vanilla';
import { useStore } from 'zustand';
import { combatReducer, createCombatState } from '../core/combat/reducer';
import { createRng, type Rng } from '../core/combat/rng';
import type { CombatEvent, CombatSetup, CombatState } from '../core/combat/types';
import { harvestNode } from '../core/economy/harvest';
import { addItem, emptyInventory, type Inventory } from '../core/economy/inventory';
import { rollEncounter, type ShadowDensity } from '../core/world/encounters';
import { buildEncounterCombatSetup } from '../core/world/encounterCombat';
import { rollLoot, type LootResult } from '../core/world/loot';
import type { ZoneId } from '../core/world/zones';
import { starterDeck } from '../data/cards/tier1';
import { combatConfig } from '../data/combat';
import { encounterTables, initialShadowDensity } from '../data/encounters/tier1';
import { harvestNodeTypes, heimatbuchtHarvestNodes } from '../data/resources';

/**
 * Shared game store — the single bridge between Phaser (world) and React (ui).
 * Vanilla store so Phaser code can read/write without React.
 *
 * Combat: the store only forwards events to the pure reducer in core/combat.
 * The RNG lives here (seeded per combat) — components never touch it.
 */
export interface GameState {
  worldReady: boolean;
  setWorldReady: (ready: boolean) => void;

  /** Zone the player currently stands in (null = no zone, e.g. over water). */
  playerZone: ZoneId | null;
  /** Player world position in pixels — updated on tile change, not per frame. */
  playerPosition: { x: number; y: number } | null;
  setPlayerLocation: (position: { x: number; y: number }, zone: ZoneId | null) => void;

  /** Player inventory — item id → count (resources + combat drops). */
  inventory: Inventory;
  /** Depleted harvest nodes (no respawn until sleep exists, docs/10). */
  harvestedNodeIds: readonly string[];
  /** Harvests a placed node; returns false if unknown or already depleted. */
  harvestNode: (nodeId: string) => boolean;

  combat: CombatState | null;
  /** Seed used for the current combat (deterministic replays, debugging). */
  combatSeed: number | null;
  startCombat: (setup: CombatSetup, seed?: number) => void;
  dispatchCombat: (event: CombatEvent) => void;
  endCombat: () => void;

  /** Shadow density of the island (docs/02; rises with exploration, M4+). */
  shadowDensity: ShadowDensity;
  /**
   * Rolls an encounter for the zone and starts the combat (M2 loop
   * island → combat → island). Returns false if a combat is already running.
   */
  startEncounter: (zone: ZoneId, seed?: number) => boolean;
  /** Loot rolled at the moment of victory (shown in the victory panel). */
  combatLoot: LootResult | null;
  /** Outcome of the last finished combat — world layer reacts (despawn etc.). */
  lastCombatOutcome: CombatState['phase'] | null;
  /** Loot of the last won combat — brief island feedback, then cleared. */
  lastLoot: LootResult | null;
  clearLastLoot: () => void;
}

/** RNG of the running combat — module-scoped, injected into every reducer call. */
let combatRng: Rng | null = null;

export const gameStore = createStore<GameState>()((set, get) => ({
  worldReady: false,
  setWorldReady: (ready) => set({ worldReady: ready }),

  playerZone: null,
  playerPosition: null,
  setPlayerLocation: (position, zone) => set({ playerPosition: position, playerZone: zone }),

  inventory: emptyInventory,
  harvestedNodeIds: [],
  harvestNode: (nodeId) => {
    const placement = heimatbuchtHarvestNodes.find((n) => n.id === nodeId);
    if (!placement) return false;
    const def = harvestNodeTypes[placement.type];
    const { inventory, harvestedNodeIds } = get();
    const outcome = harvestNode(inventory, harvestedNodeIds, nodeId, def.resource, def.yield);
    if (!outcome) return false;
    set({ inventory: outcome.inventory, harvestedNodeIds: outcome.harvestedNodeIds });
    return true;
  },

  combat: null,
  combatSeed: null,
  startCombat: (setup, seed) => {
    const usedSeed = seed ?? Math.floor(Math.random() * 0xffffffff);
    combatRng = createRng(usedSeed);
    set({ combat: createCombatState(setup, combatRng), combatSeed: usedSeed });
  },
  dispatchCombat: (event) => {
    const { combat, shadowDensity } = get();
    if (!combat || !combatRng) return;
    const next = combatReducer(combat, event, combatRng);
    // Loot is rolled exactly once, at the victory transition, with the
    // combat RNG — a seeded combat replays to identical loot.
    const justWon = combat.phase !== 'victory' && next.phase === 'victory';
    const loot = justWon
      ? rollLoot(
          next.enemies.map((enemy) => enemy.def),
          shadowDensity,
          combatRng,
        )
      : get().combatLoot;
    set({ combat: next, combatLoot: loot });
  },
  endCombat: () => {
    const { combat, combatLoot, inventory } = get();
    combatRng = null;
    const won = combat?.phase === 'victory';
    let nextInventory = inventory;
    if (won && combatLoot) {
      for (const [item, amount] of Object.entries(combatLoot)) {
        nextInventory = addItem(nextInventory, item, amount);
      }
    }
    // TODO(M4): defeat flow — for now the player just returns to the island
    // with full HP and no penalty (docs/12: Niederlage-Fluss ist M4).
    set({
      combat: null,
      combatSeed: null,
      combatLoot: null,
      inventory: nextInventory,
      lastCombatOutcome: combat?.phase ?? null,
      lastLoot: won ? combatLoot : null,
    });
  },

  shadowDensity: initialShadowDensity,
  startEncounter: (zone, seed) => {
    const { combat, shadowDensity, startCombat } = get();
    if (combat) return false;
    const encounterSeed = seed ?? Math.floor(Math.random() * 0xffffffff);
    const encounter = rollEncounter(
      encounterTables[zone],
      shadowDensity,
      createRng(encounterSeed),
    );
    const setup = buildEncounterCombatSetup(encounter, shadowDensity, {
      playerHp: combatConfig.basePlayerHp,
      deck: starterDeck,
    });
    startCombat(setup, seed);
    return true;
  },
  combatLoot: null,
  lastCombatOutcome: null,
  lastLoot: null,
  clearLastLoot: () => set({ lastLoot: null }),
}));

export function useGameStore<T>(selector: (state: GameState) => T): T {
  return useStore(gameStore, selector);
}
