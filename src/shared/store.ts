import { createStore } from 'zustand/vanilla';
import { useStore } from 'zustand';
import { combatReducer, createCombatState } from '../core/combat/reducer';
import { createRng, type Rng } from '../core/combat/rng';
import type { CardDef, CombatEvent, CombatSetup, CombatState } from '../core/combat/types';
import {
  applyDishConsumption,
  clearsStarterMarker,
  ownedCountsAfterConsumption,
} from '../core/deck/consumption';
import { addToDeck, buildCombatDeck, removeFromDeck } from '../core/deck/deck';
import {
  canCraft,
  craft,
  discountedRecipe,
  isRecipeUnlocked,
  isRecipeVisible,
} from '../core/economy/crafting';
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
import {
  canUnlockTalent,
  deckLimitForLevel,
  levelForXp,
  maxHpForLevel,
  scaleDishCard,
  scaleLoot,
  talentModifiers,
  xpForEncounter,
  type TalentModifiers,
} from '../core/progression/progression';
import { rollEncounter, type EncounterResult, type ShadowDensity } from '../core/world/encounters';
import {
  densityForExploration,
  discoverMarker,
  explorationFraction,
  explorationXp,
} from '../core/world/exploration';
import { buildEncounterCombatSetup } from '../core/world/encounterCombat';
import {
  applyRoomVictory,
  currentRoom,
  roomEncounter,
  startDungeonRun,
  type DungeonRunState,
} from '../core/world/dungeon';
import { rollLoot, type LootResult } from '../core/world/loot';
import type { SaveData } from '../core/save/save';
import type { ZoneId } from '../core/world/zones';
import { cardsById, starterDeckIds } from '../data/cards/tier1';
import { combatConfig } from '../data/combat';
import { dungeonsById } from '../data/dungeons/verwachseneHoehle';
import {
  densityThresholds,
  eliteAffixIds,
  encounterTables,
  initialShadowDensity,
} from '../data/encounters/tier1';
import { heimatbuchtExplorationMarkers, zoneMarkerId } from '../data/exploration';
import { crops, harvestToolBonus, heimatbuchtFarmPlots, type CropId } from '../data/farming';
import { allRecipes } from '../data/recipes';
import { harvestNodeTypes, heimatbuchtHarvestNodes } from '../data/resources';
import { initialStationTiers, type WorldStationId } from '../data/stations';
import { talents } from '../data/talents';
import { xpSources, type XpSource } from '../data/progression';

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

  /**
   * Total XP ever earned (docs/02) — the level is always DERIVED via
   * core/progression.levelForXp. XP beyond the level cap stays banked.
   */
  xp: number;
  /** Unlocked talent ids (docs/02 Talentbaum 3×3; no respec in M4). */
  unlockedTalents: readonly string[];
  /**
   * Grants XP from any source — combat victory (automatic in endCombat),
   * exploration (M4 Task 2) or scripted grants (docs/06 tutorial, M6).
   * No special-case code per source; `source` is for logging/telemetry.
   */
  grantXp: (amount: number, source: XpSource) => void;
  /** Spends 1 talent point (rules in core/progression). False when blocked. */
  unlockTalent: (talentId: string) => boolean;

  combat: CombatState | null;
  /** Seed used for the current combat (deterministic replays, debugging). */
  combatSeed: number | null;
  startCombat: (setup: CombatSetup, seed?: number) => void;
  dispatchCombat: (event: CombatEvent) => void;
  endCombat: () => void;

  /**
   * Shadow density of the island (docs/02) — DERIVED from exploration
   * progress via densityForExploration whenever a marker is discovered.
   * Kept as state (not recomputed everywhere) so cleansing (M4 Task 4) can
   * pin it to 0 permanently.
   */
  shadowDensity: ShadowDensity;
  /** Discovered exploration marker ids (zones + shrines, data/exploration). */
  discoveredMarkers: readonly string[];
  /**
   * Discovers a marker (idempotent): grants exploration XP (docs/02: area
   * 25 / shrine 40, Kartenkenner +50 %) and re-derives the shadow density.
   * Returns false when the marker is unknown or already discovered.
   */
  discoverMarker: (markerId: string) => boolean;
  /**
   * Rolls an encounter for the zone and starts the combat (M2 loop
   * island → combat → island). Returns false if a combat is already running.
   */
  startEncounter: (zone: ZoneId, seed?: number) => boolean;
  /** Encounter behind the running combat (XP calculation at victory). */
  currentEncounter: EncounterResult | null;

  /**
   * Running dungeon expedition (M4, docs/03) — transient run state: room
   * index + HP carried between rooms. NOT persisted (reload = run lost,
   * documented in core/world/dungeon.ts).
   */
  currentDungeonRun: DungeonRunState | null;
  /** NPCs freed in dungeons (docs/09 Orin) — persisted, additive save field. */
  rescuedNpcs: readonly string[];
  /** Completed dungeon ids — persisted; cleansing (M4 Task 4) docks here. */
  completedDungeons: readonly string[];
  /** NPC freed by the LAST won room fight — panel feedback, cleared on continue. */
  lastRescuedNpc: string | null;
  /** Enters the dungeon (run at room 0, full HP). False mid-combat/mid-run. */
  enterDungeon: (dungeonId: string) => boolean;
  /** Starts the fight of the current room. False without run/invalid deck. */
  startDungeonRoomCombat: (seed?: number) => boolean;
  /** Aufgeben (docs/03: jederzeit möglich) — ends the run, back to island.
   * TODO(M4 Task 5): Beute-Malus des Durchgangs (docs/03) — kein Malus vorerst. */
  abandonDungeonRun: () => void;
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

/** Talent modifiers of the current state (pure derivation, cheap for 9 talents). */
export function modifiersOf(state: Pick<GameState, 'unlockedTalents'>): TalentModifiers {
  return talentModifiers(state.unlockedTalents, talents);
}

/** Current derived level (docs/02 curve, cap in data/progression). */
export function levelOf(state: Pick<GameState, 'xp'>): number {
  return levelForXp(state.xp);
}

/** Exploration progress 0..1 (markers in data/exploration, docs/02). */
export function explorationOf(state: Pick<GameState, 'discoveredMarkers'>): number {
  return explorationFraction(state.discoveredMarkers, heimatbuchtExplorationMarkers);
}

/**
 * Combat deck from the Deck-Truhe assembly incl. talent scaling ("Guter
 * Koch"); null when the deck is invalid (< min size after disenchant/dish
 * consumption, docs/03) — combat start is then refused.
 */
function buildScaledCombatDeck(state: GameState): CardDef[] | null {
  const owned = ownedCountsAfterConsumption(
    starterDeckIds,
    state.collection,
    state.consumedStarterDishes,
  );
  const combatDeck = buildCombatDeck(
    state.deck,
    owned,
    cardsById,
    deckLimitForLevel(levelOf(state)),
  );
  if (!combatDeck) return null;
  const mods = modifiersOf(state);
  return combatDeck.map((card) => scaleDishCard(card, mods.dishEffectMultiplier));
}

export const gameStore = createStore<GameState>()((set, get) => ({
  worldReady: false,
  setWorldReady: (ready) => set({ worldReady: ready }),

  playerZone: null,
  playerPosition: null,
  setPlayerLocation: (position, zone) => {
    set({ playerPosition: position, playerZone: zone });
    // First entry into a zone reveals it (docs/02 "Neues Gebiet aufgedeckt").
    // discoverMarker is idempotent, so this is a cheap no-op afterwards.
    if (zone) get().discoverMarker(zoneMarkerId(zone));
  },

  inventory: emptyInventory,
  harvestedNodeIds: [],
  harvestNode: (nodeId) => {
    const placement = heimatbuchtHarvestNodes.find((n) => n.id === nodeId);
    if (!placement) return false;
    const def = harvestNodeTypes[placement.type];
    const { inventory, harvestedNodeIds, toolTier } = get();
    // Tool tier 2 adds +1 yield (docs/10 Werkzeugstufen "Ernten +1 Ertrag");
    // talent "Sammlerglück" adds +1 on top (docs/02).
    const amount =
      def.yield + toolYieldBonus(toolTier, harvestToolBonus) + modifiersOf(get()).harvestYieldBonus;
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
    // Deck max size is level-dependent (docs/02 milestone Lv 4: 12 → 15).
    const next = addToDeck(deck, cardId, owned, cardsById, deckLimitForLevel(levelOf(get())));
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
    // Talent "Effizientes Zerlegen": refund fraction 0.5 → 0.75 (docs/02).
    const result = disenchantCard(
      inventory,
      collection,
      deck,
      cardId,
      allRecipes,
      modifiersOf(get()).disenchantRefundFraction,
    );
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
    const baseRecipe = allRecipes.find((r) => r.id === recipeId);
    if (!baseRecipe || baseRecipe.station !== activeStation) return false;
    // Talent "Sparsame Hände": card recipes cost 1 base material less
    // (docs/02; rule in core/economy/crafting.discountedRecipe).
    const recipe = discountedRecipe(baseRecipe, modifiersOf(get()).craftBaseMaterialDiscount);
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

  xp: 0,
  unlockedTalents: [],
  // `source` exists for the API contract (scripted grants, docs/06) and
  // future logging — the XP math is source-agnostic on purpose.
  grantXp: (amount) => {
    if (!Number.isFinite(amount) || amount <= 0) return;
    set({ xp: get().xp + Math.floor(amount) });
  },
  unlockTalent: (talentId) => {
    const { unlockedTalents, xp } = get();
    const check = canUnlockTalent(talentId, unlockedTalents, levelForXp(xp), talents);
    if (!check.ok) return false;
    set({ unlockedTalents: [...unlockedTalents, talentId] });
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
    // Talent "Beutejäger" (docs/02): +25 % loot, rounded up — applied at
    // roll time so the victory panel shows the final amounts.
    const loot = justWon
      ? scaleLoot(
          rollLoot(
            next.enemies.map((enemy) => enemy.def),
            shadowDensity,
            combatRng,
          ),
          modifiersOf(get()).lootMultiplier,
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
    // XP for a won encounter (docs/07: 15 + 7×Zusatzgegner, Elite 38) —
    // dev/test combats without an encounter grant nothing.
    const { currentEncounter, xp, currentDungeonRun, rescuedNpcs, completedDungeons } = get();
    let xpGain =
      won && currentEncounter
        ? xpForEncounter({
            enemyCount: currentEncounter.enemies.length,
            elite: currentEncounter.elite,
          })
        : 0;

    // ── Dungeon run transition (M4, core/world/dungeon) ──────────────────
    let nextRun = currentDungeonRun;
    let nextRescuedNpcs = rescuedNpcs;
    let nextCompletedDungeons = completedDungeons;
    let lastRescuedNpc: string | null = null;
    if (currentDungeonRun) {
      const dungeon = dungeonsById[currentDungeonRun.dungeonId];
      if (won && dungeon && combat) {
        const result = applyRoomVictory(dungeon, currentDungeonRun, combat.player.hp);
        if (result.rescuedNpc && !rescuedNpcs.includes(result.rescuedNpc)) {
          // Orin-Rettung (docs/09, Raum 2) — persisted, additive save field.
          nextRescuedNpcs = [...rescuedNpcs, result.rescuedNpc];
        }
        lastRescuedNpc = result.rescuedNpc;
        if (result.kind === 'completed') {
          // Boss down: Boss-XP 300 statt Begegnungs-XP (docs/07); Abschluss-
          // Flag persistiert — die Reinigung (M4 Task 4) dockt hier an.
          xpGain = xpSources.boss;
          nextRun = null;
          if (!completedDungeons.includes(dungeon.id)) {
            nextCompletedDungeons = [...completedDungeons, dungeon.id];
          }
        } else {
          nextRun = result.run; // HP-Übertrag in den nächsten Raum (docs/03)
        }
      } else {
        // Niederlage/Rückzug im Dungeon: Run endet, zurück zur Insel.
        // TODO(M4 Task 5): Beute-Malus (docs/03) — vorerst wie Kampfabbruch.
        nextRun = null;
      }
    }
    // TODO(M4): defeat flow — for now the player just returns to the island
    // with full HP and no penalty (docs/12: Niederlage-Fluss ist M4).
    set({
      xp: xp + xpGain,
      currentDungeonRun: nextRun,
      rescuedNpcs: nextRescuedNpcs,
      completedDungeons: nextCompletedDungeons,
      lastRescuedNpc,
      currentEncounter: null,
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
  discoveredMarkers: [],
  discoverMarker: (markerId) => {
    const { discoveredMarkers, xp } = get();
    const next = discoverMarker(discoveredMarkers, markerId, heimatbuchtExplorationMarkers);
    if (!next) return false;
    const marker = heimatbuchtExplorationMarkers.find((m) => m.id === markerId)!;
    // XP: docs/02 area 25 / shrine 40, talent "Kartenkenner" +50 % (rounded,
    // core/world/exploration).
    const gained = explorationXp(
      marker.kind,
      { area: xpSources.areaRevealed, shrine: xpSources.shrineDiscovered },
      modifiersOf(get()).explorationXpMultiplier,
    );
    // One atomic set (markers + density + XP): subscribers (persistence,
    // world feedback) see the discovery as a single state transition.
    set({
      discoveredMarkers: next,
      // Density is DERIVED from exploration (docs/02 thresholds 25/50/75).
      // densityForExploration is monotone, so density only ever rises here;
      // cleansing (M4 Task 4) will pin it to 0 elsewhere.
      shadowDensity: densityForExploration(
        explorationFraction(next, heimatbuchtExplorationMarkers),
        densityThresholds,
      ),
      xp: xp + gained,
    });
    return true;
  },
  startEncounter: (zone, seed) => {
    const { combat, shadowDensity, startCombat, currentDungeonRun } = get();
    if (combat || currentDungeonRun) return false;
    // Combat uses the deck assembled at the Deck-Truhe; an invalid deck
    // (e.g. < 12 after a disenchant or dish consumption) blocks the
    // encounter (docs/03).
    const combatDeck = buildScaledCombatDeck(get());
    if (!combatDeck) return false;
    const mods = modifiersOf(get());
    const encounterSeed = seed ?? Math.floor(Math.random() * 0xffffffff);
    const encounter = rollEncounter(encounterTables[zone], shadowDensity, createRng(encounterSeed));
    // Max HP scales with level (+5/level, docs/02) plus talent "Zähigkeit";
    // combats start at full HP (HP persistence between combats is a later
    // M4 task — see sleep()).
    const playerHp = maxHpForLevel(levelOf(get()), mods.maxHpBonus);
    const setup = buildEncounterCombatSetup(encounter, shadowDensity, {
      playerHp,
      deck: combatDeck,
    });
    setup.toolTier = get().toolTier; // Axtschlag scaling (docs/10 Werkzeugstufen)
    // Talent "Klingenschliff": first attack per combat +2 damage (docs/02).
    if (mods.firstAttackBonus > 0) setup.firstAttackBonus = mods.firstAttackBonus;
    // Talent "Bollwerk" (dungeonStartBlock) applies to DUNGEON combats only
    // (startDungeonRoomCombat) — open-field encounters never get it.
    set({ currentEncounter: encounter });
    startCombat(setup, seed);
    return true;
  },
  currentEncounter: null,

  currentDungeonRun: null,
  rescuedNpcs: [],
  completedDungeons: [],
  lastRescuedNpc: null,
  enterDungeon: (dungeonId) => {
    const { combat, currentDungeonRun } = get();
    if (combat || currentDungeonRun) return false;
    const dungeon = dungeonsById[dungeonId];
    if (!dungeon) return false;
    // Full HP at the ENTRANCE; inside the run HP is carried between rooms
    // (docs/03: keine Heilung zwischen den Räumen).
    const maxHp = maxHpForLevel(levelOf(get()), modifiersOf(get()).maxHpBonus);
    set({ currentDungeonRun: startDungeonRun(dungeon, maxHp), lastRescuedNpc: null });
    return true;
  },
  startDungeonRoomCombat: (seed) => {
    const { combat, currentDungeonRun, shadowDensity, startCombat } = get();
    if (combat || !currentDungeonRun) return false;
    const dungeon = dungeonsById[currentDungeonRun.dungeonId];
    if (!dungeon) return false;
    const room = currentRoom(dungeon, currentDungeonRun);
    if (!room) return false;
    const combatDeck = buildScaledCombatDeck(get());
    if (!combatDeck) return false; // invalid deck blocks combat (docs/03)
    const mods = modifiersOf(get());
    const encounterSeed = seed ?? Math.floor(Math.random() * 0xffffffff);
    // Dungeon fights scale with shadow density like island fights
    // (DungeonDef.scalesWithDensity, assumption documented in data).
    const density = dungeon.scalesWithDensity ? shadowDensity : 0;
    // Elite room: affix rules from the encounter system (docs/02, ab Dichte 2).
    const encounter = roomEncounter(room, density, eliteAffixIds, createRng(encounterSeed));
    const setup = buildEncounterCombatSetup(encounter, density, {
      playerHp: currentDungeonRun.hp, // run HP — no healing between rooms
      playerMaxHp: currentDungeonRun.maxHp,
      deck: combatDeck,
    });
    setup.toolTier = get().toolTier;
    if (mods.firstAttackBonus > 0) setup.firstAttackBonus = mods.firstAttackBonus;
    // Talent "Bollwerk" (docs/02): Start-Block +3 in DUNGEON-Kämpfen.
    if (mods.dungeonStartBlock > 0) setup.playerStartBlock = mods.dungeonStartBlock;
    set({ currentEncounter: encounter, lastRescuedNpc: null });
    startCombat(setup, seed);
    return true;
  },
  abandonDungeonRun: () => {
    // Aufgeben (docs/03: jederzeit garantiert). TODO(M4 Task 5): Beute-Malus
    // des Durchgangs — vorerst konsequenzlos wie der heutige Kampfabbruch.
    if (get().combat) return; // mid-combat the retreat button owns this
    set({ currentDungeonRun: null, lastRescuedNpc: null });
  },
  combatLoot: null,
  lastCombatOutcome: null,
  lastLoot: null,
  clearLastLoot: () => set({ lastLoot: null }),

  hydrateFromSave: (data, recovered) =>
    set({
      inventory: data.inventory,
      harvestedNodeIds: data.harvestedNodeIds,
      // Exploration-derived density wins when it is higher (saves written
      // before this field existed keep their stored density).
      shadowDensity: Math.max(
        data.shadowDensity,
        densityForExploration(
          explorationFraction(data.discoveredMarkers ?? [], heimatbuchtExplorationMarkers),
          densityThresholds,
        ),
      ) as ShadowDensity,
      discoveredMarkers: data.discoveredMarkers ?? [],
      playerPosition: data.playerPosition,
      playerZone: data.playerZone,
      collection: data.collection,
      deck: data.deck,
      consumedStarterDishes: data.consumedStarterDishes ?? [],
      farmPlots: data.farmPlots ?? emptyFarmPlots,
      sleepCount: data.sleepCount ?? 0,
      toolTier: data.toolTier,
      xp: data.xp ?? 0,
      unlockedTalents: data.unlockedTalents ?? [],
      rescuedNpcs: data.rescuedNpcs ?? [],
      completedDungeons: data.completedDungeons ?? [],
      saveRecovered: recovered,
    }),
  saveRecovered: false,
  clearSaveRecovered: () => set({ saveRecovered: false }),
}));

export function useGameStore<T>(selector: (state: GameState) => T): T {
  return useStore(gameStore, selector);
}
