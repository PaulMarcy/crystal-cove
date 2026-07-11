import { createStore } from 'zustand/vanilla';
import { useStore } from 'zustand';
import { combatReducer, createCombatState } from '../core/combat/reducer';
import { createRng, type Rng } from '../core/combat/rng';
import type { CombatEvent, CombatSetup, CombatState } from '../core/combat/types';
import {
  applyDishConsumption,
  clearsStarterMarker,
  ownedCountsAfterConsumption,
} from '../core/deck/consumption';
import { addToDeck, buildCombatDeck, removeFromDeck } from '../core/deck/deck';
import { canCraft, craft, isRecipeUnlocked, isRecipeVisible } from '../core/economy/crafting';
import { disenchantCard } from '../core/economy/disenchant';
import {
  advanceSleep,
  emptyFarmPlots,
  harvestPlot,
  plantCrop,
  toolYieldBonus,
  type FarmPlots,
} from '../core/economy/farming';
import { harvestNode } from '../core/economy/harvest';
import { addItem, emptyInventory, type Inventory } from '../core/economy/inventory';
import { rollEncounter, type ShadowDensity } from '../core/world/encounters';
import { buildEncounterCombatSetup } from '../core/world/encounterCombat';
import { rollLoot, type LootResult } from '../core/world/loot';
import type { SaveData } from '../core/save/save';
import type { ZoneId } from '../core/world/zones';
import { cardsById, starterDeckIds } from '../data/cards/tier1';
import { combatConfig } from '../data/combat';
import { encounterTables, initialShadowDensity } from '../data/encounters/tier1';
import { crops, harvestToolBonus, heimatbuchtFarmPlots, type CropId } from '../data/farming';
import { allRecipes } from '../data/recipes';
import { harvestNodeTypes, heimatbuchtHarvestNodes } from '../data/resources';
import { initialStationTiers, type WorldStationId } from '../data/stations';

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

  /** Farm plots (M3) — plot id → planted state; empty plots are absent. */
  farmPlots: FarmPlots;
  /** Completed sleep cycles — crop growth is bound to these (docs/10). */
  sleepCount: number;
  /** Plants a crop on an empty placed plot. False when unknown or occupied. */
  plantCrop: (plotId: string, crop: CropId) => boolean;
  /** Harvests a ripe plot into the inventory (tool bonus applies). */
  harvestFarmPlot: (plotId: string) => boolean;
  /**
   * Sleep (tent/bed, docs/10): crops advance one cycle, harvest nodes
   * respawn. Full heal is a no-op until M4 — HP is not persisted between
   * combats yet (every combat starts at basePlayerHp).
   */
  sleep: () => void;

  /** Crafted card ids (multiset) — the Deck-Truhe assembles the deck from these + starter set. */
  collection: readonly string[];
  /**
   * Assembled combat deck as card ids (rules in core/deck: size 12, max 1
   * dish, only owned copies). May drop below size after a disenchant —
   * combat start then refuses until the player refills it.
   */
  deck: readonly string[];
  /**
   * Consumed-but-not-yet-recooked STARTER dish markers (core/deck/consumption).
   * Crafted dishes leave the collection directly; starter copies live in the
   * immutable starterDeckIds constant, so their consumption is tracked here.
   * Re-cooking the recipe clears a marker before growing the collection.
   */
  consumedStarterDishes: readonly string[];
  /** Adds one owned copy to the deck (core/deck rules). False when blocked. */
  addCardToDeck: (cardId: string) => boolean;
  /** Removes one copy from the deck. False when the deck holds none. */
  removeCardFromDeck: (cardId: string) => boolean;
  /**
   * Disenchants one crafted copy (docs/10: 50 % refund, floored per line,
   * special material never refunded). Removes it from collection and deck.
   */
  disenchant: (cardId: string) => boolean;
  /** Equipped tool tier (docs/10 Werkzeugstufen) — feeds 'toolTier' scaling in combat. */
  toolTier: number;
  /** Station whose overlay UI is open (null = closed). */
  activeStation: WorldStationId | null;
  openStation: (station: WorldStationId) => void;
  closeStation: () => void;
  /**
   * Crafts a recipe at the open station: checks visibility, station tier and
   * material (all pure core logic), then deducts material and applies the
   * output (card → collection, toolUpgrade → toolTier). Returns false when
   * anything blocks the craft.
   */
  craftRecipe: (recipeId: string) => boolean;

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

  /** Replaces the persisted slice with a loaded save (boot, before Phaser). */
  hydrateFromSave: (data: SaveData, recovered: boolean) => void;
  /** True when the primary save slot was corrupt and the backup restored it. */
  saveRecovered: boolean;
  clearSaveRecovered: () => void;
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
    const { inventory, harvestedNodeIds, toolTier } = get();
    // Tool tier 2 adds +1 yield (docs/10 Werkzeugstufen "Ernten +1 Ertrag").
    const amount = def.yield + toolYieldBonus(toolTier, harvestToolBonus);
    const outcome = harvestNode(inventory, harvestedNodeIds, nodeId, def.resource, amount);
    if (!outcome) return false;
    set({ inventory: outcome.inventory, harvestedNodeIds: outcome.harvestedNodeIds });
    return true;
  },

  farmPlots: emptyFarmPlots,
  sleepCount: 0,
  plantCrop: (plotId, crop) => {
    if (!heimatbuchtFarmPlots.some((p) => p.id === plotId)) return false;
    const next = plantCrop(get().farmPlots, plotId, crop);
    if (!next) return false;
    set({ farmPlots: next });
    return true;
  },
  harvestFarmPlot: (plotId) => {
    const { inventory, farmPlots, toolTier } = get();
    const outcome = harvestPlot(inventory, farmPlots, plotId, crops, toolTier, harvestToolBonus);
    if (!outcome) return false;
    set({ inventory: outcome.inventory, farmPlots: outcome.plots });
    return true;
  },
  sleep: () => {
    const { farmPlots, sleepCount } = get();
    // Full heal is intentionally absent: HP is not persisted outside combat
    // until M4 (every combat starts at basePlayerHp) — nothing to heal here.
    set({
      farmPlots: advanceSleep(farmPlots),
      sleepCount: sleepCount + 1,
      // Harvest nodes respawn on sleep (docs/10 — closes the M2 "no respawn
      // until sleep exists" gap in data/resources.ts / core/economy/harvest).
      harvestedNodeIds: [],
    });
  },

  collection: [],
  deck: [...starterDeckIds],
  consumedStarterDishes: [],
  addCardToDeck: (cardId) => {
    const { deck, collection, consumedStarterDishes } = get();
    const owned = ownedCountsAfterConsumption(starterDeckIds, collection, consumedStarterDishes);
    const next = addToDeck(deck, cardId, owned, cardsById);
    if (!next) return false;
    set({ deck: next });
    return true;
  },
  removeCardFromDeck: (cardId) => {
    const next = removeFromDeck(get().deck, cardId);
    if (!next) return false;
    set({ deck: next });
    return true;
  },
  disenchant: (cardId) => {
    const { inventory, collection, deck } = get();
    const result = disenchantCard(inventory, collection, deck, cardId, allRecipes);
    if (!result) return false;
    set({ inventory: result.inventory, collection: result.collection, deck: result.deck });
    return true;
  },
  toolTier: combatConfig.baseToolTier,
  activeStation: null,
  openStation: (station) => {
    if (get().combat) return; // no workshop mid-combat
    set({ activeStation: station });
  },
  closeStation: () => set({ activeStation: null }),
  craftRecipe: (recipeId) => {
    const { activeStation, inventory, toolTier, collection } = get();
    const recipe = allRecipes.find((r) => r.id === recipeId);
    if (!recipe || recipe.station !== activeStation) return false;
    if (!isRecipeVisible(recipe, toolTier)) return false;
    if (!isRecipeUnlocked(recipe, initialStationTiers[recipe.station])) return false;
    if (!canCraft(inventory, recipe)) return false;
    const result = craft(inventory, recipe);
    if (!result) return false;
    if (result.output.kind === 'card') {
      // Re-cooking a consumed starter dish restores the starter copy
      // (marker cleared) instead of adding a crafted, disenchantable copy.
      const { consumedStarterDishes } = get();
      if (clearsStarterMarker(result.output.cardId, consumedStarterDishes)) {
        const cardId = result.output.cardId;
        const index = consumedStarterDishes.indexOf(cardId);
        set({
          inventory: result.inventory,
          consumedStarterDishes: [
            ...consumedStarterDishes.slice(0, index),
            ...consumedStarterDishes.slice(index + 1),
          ],
        });
      } else {
        set({ inventory: result.inventory, collection: [...collection, result.output.cardId] });
      }
    } else {
      set({ inventory: result.inventory, toolTier: Math.max(toolTier, result.output.toolTier) });
    }
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
    const { combat, combatLoot, inventory, collection, deck, consumedStarterDishes } = get();
    combatRng = null;
    const won = combat?.phase === 'victory';
    let nextInventory = inventory;
    if (won && combatLoot) {
      for (const [item, amount] of Object.entries(combatLoot)) {
        nextInventory = addItem(nextInventory, item, amount);
      }
    }
    // Dishes consumed in combat leave collection + deck permanently until
    // re-cooked (docs/03, docs/10). Consumption happens on play — it sticks
    // regardless of outcome (victory, defeat, retreat).
    const consumption = applyDishConsumption(
      combat?.consumed.map((card) => card.def.id) ?? [],
      collection,
      deck,
      consumedStarterDishes,
      starterDeckIds,
    );
    // TODO(M4): defeat flow — for now the player just returns to the island
    // with full HP and no penalty (docs/12: Niederlage-Fluss ist M4).
    set({
      collection: consumption.collection,
      deck: consumption.deck,
      consumedStarterDishes: consumption.consumedStarterDishes,
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
    const { combat, shadowDensity, startCombat, deck, collection, consumedStarterDishes } = get();
    if (combat) return false;
    // Combat uses the deck assembled at the Deck-Truhe; an invalid deck
    // (e.g. < 12 after a disenchant or dish consumption) blocks the
    // encounter (docs/03).
    const combatDeck = buildCombatDeck(
      deck,
      ownedCountsAfterConsumption(starterDeckIds, collection, consumedStarterDishes),
      cardsById,
    );
    if (!combatDeck) return false;
    const encounterSeed = seed ?? Math.floor(Math.random() * 0xffffffff);
    const encounter = rollEncounter(encounterTables[zone], shadowDensity, createRng(encounterSeed));
    const setup = buildEncounterCombatSetup(encounter, shadowDensity, {
      playerHp: combatConfig.basePlayerHp,
      deck: combatDeck,
    });
    setup.toolTier = get().toolTier; // Axtschlag scaling (docs/10 Werkzeugstufen)
    startCombat(setup, seed);
    return true;
  },
  combatLoot: null,
  lastCombatOutcome: null,
  lastLoot: null,
  clearLastLoot: () => set({ lastLoot: null }),

  hydrateFromSave: (data, recovered) =>
    set({
      inventory: data.inventory,
      harvestedNodeIds: data.harvestedNodeIds,
      shadowDensity: data.shadowDensity,
      playerPosition: data.playerPosition,
      playerZone: data.playerZone,
      collection: data.collection,
      deck: data.deck,
      consumedStarterDishes: data.consumedStarterDishes ?? [],
      farmPlots: data.farmPlots ?? emptyFarmPlots,
      sleepCount: data.sleepCount ?? 0,
      toolTier: data.toolTier,
      saveRecovered: recovered,
    }),
  saveRecovered: false,
  clearSaveRecovered: () => set({ saveRecovered: false }),
}));

export function useGameStore<T>(selector: (state: GameState) => T): T {
  return useStore(gameStore, selector);
}
