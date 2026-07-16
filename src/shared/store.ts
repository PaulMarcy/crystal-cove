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
  isRecipeTaught,
  isRecipeUnlocked,
  isRecipeVisible,
} from '../core/economy/crafting';
import { applyLootPenalty } from '../core/economy/defeat';
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
import { buyOffer, sellResource } from '../core/economy/market';
import { activeBoardRequest, fulfillBoardRequest } from '../core/economy/board';
import { fishAtPier } from '../core/economy/fishing';
import {
  canUnlockTalent,
  deckLimitForLevel,
  levelForXp,
  maxHpForLevel,
  scaleDishCard,
  scaleLoot,
  talentModifiers,
  talismanSlotsForLevel,
  xpForEncounter,
  type TalentModifiers,
} from '../core/progression/progression';
import {
  combatStartStatuses,
  equipTalisman,
  talismanCombatModifiers,
  unequipTalisman,
} from '../core/progression/talismans';
import { build, canBuild, dishSlots, type BuildContext } from '../core/village/buildings';
import {
  advanceDialogRun,
  resolveDialogChoice,
  startDialogRun,
  type DialogRunState,
} from '../core/dialog/dialog';
import {
  acceptQuest as acceptQuestRules,
  completeQuest as completeQuestRules,
  dialogIdForNpc,
  npcArrived,
  questById,
  questIndicator,
  questNodeVisible,
  type QuestContext,
} from '../core/quests/quests';
import { rollEncounter, type EncounterResult, type ShadowDensity } from '../core/world/encounters';
import {
  densityForExploration,
  discoverMarker,
  effectiveShadowDensity,
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
import { defeatConfig } from '../data/defeat';
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
import {
  BUILDING_SLOT_IDS,
  buildingsBySlot,
  initialBuildingStages,
  type BuildingSlotId,
} from '../data/buildings';
import { dialogsById, type DialogActionDef } from '../data/dialogs';
import { marketSlot, piyaOffersById, sellPrices } from '../data/market';
import { boardRequests, type BoardRequestDef } from '../data/board';
import { fishingConfig } from '../data/fishing';
import { npcsById, questCollectNodes } from '../data/npcs';
import { deckConfig } from '../data/deck';
import { talents } from '../data/talents';
import { talismansById } from '../data/talismans';
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

  /**
   * Persisted player HP OUTSIDE combat (M4 Task 5): island encounters start
   * from this value; victory/retreat write the remaining HP back. Sleeping
   * and waking up after a defeat heal to full — HP can never be 0 outside
   * combat (no dead end). Dungeon-run HP stays run-internal (full at the
   * entrance, documented assumption in core/world/dungeon).
   */
  playerHp: number;
  /**
   * Run loot (docs/03 defeat penalty): every inventory GAIN since the last
   * rest (sleep or wake-up) — combat loot, harvest nodes, farm harvests.
   * Defeat/abandon removes 50 % of it (core/economy/defeat), then resets.
   */
  lootSinceRest: Inventory;
  /** Items lost to the last defeat/abandon penalty — UI feedback, cleared on continue. */
  lastDefeatLoss: Inventory | null;
  clearLastDefeatLoss: () => void;

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
   * Built stage per building slot (M5, docs/09 B1–B9). B1–B3 start at
   * stage 1 (tent + starter stations exist in the world); everything else
   * at 0. Persisted additive-optional (save V2, no version bump).
   */
  builtBuildings: Readonly<Record<BuildingSlotId, number>>;
  /**
   * Current workshop-station tiers (docs/10 Ausbaustufen). Starts at
   * initialStationTiers; building B2/B3 stages mirrors into it (docs/09 —
   * recipes unlock per tier). Persisted additive-optional.
   */
  stationTiers: Readonly<Record<string, number>>;
  /**
   * Story flags for build/arrival prerequisites (data/buildings
   * StoryFlagId + future quest flags). Set by later M5/M6 tasks
   * (setStoryFlag) — this task only consumes them. island_cleansed is NOT
   * stored here (derived via cleansedOf). Persisted additive-optional.
   */
  storyFlags: readonly string[];
  setStoryFlag: (flag: string) => void;
  /**
   * Friendship level 0–3 per NPC id (docs/09) — raised only by the personal
   * quest chains (M5 NPC task); this task only consumes the levels for
   * build prerequisites. Persisted additive-optional.
   */
  friendshipLevels: Readonly<Record<string, number>>;
  /** Build slot whose overlay UI is open (null = closed). */
  activeBuildSlot: BuildingSlotId | null;
  openBuildSlot: (slot: BuildingSlotId) => void;
  closeBuildSlot: () => void;
  /**
   * Builds the next stage of a slot: prerequisites + material via
   * core/village, then deducts material and (for B2/B3) mirrors the stage
   * into the station tier. Returns false when anything blocks the build.
   */
  buildBuilding: (slot: BuildingSlotId) => boolean;

  /**
   * Quests (M5 Task 3, docs/09): accepted-but-open and completed quest ids.
   * Friendship levels rise ONLY through completions (core/quests); NPC
   * arrival is DERIVED (npcArrivedOf), never stored. Persisted
   * additive-optional (save V2, no version bump).
   */
  activeQuests: readonly string[];
  completedQuests: readonly string[];
  /**
   * Recipe ids taught by NPC quest rewards (docs/09: NPCs lehren Rezepte).
   * Quest-gated recipes stay hidden at the station until listed here.
   * May contain ids whose RecipeDef arrives with a later task (Schrein).
   */
  unlockedRecipes: readonly string[];
  /** Accepts an available quest (rules in core/quests). False when blocked. */
  acceptQuest: (questId: string) => boolean;
  /**
   * Turns an active, fulfilled quest in: deducts requirement items and
   * applies the declarative rewards (recipes, talismans, flags, uniform
   * stage XP, friendship +1). False when the turn-in is blocked.
   */
  completeQuest: (questId: string) => boolean;
  /**
   * Collects a quest-spawned pickup (docs/09 Honig / Maros Kiste) — only
   * while its quest is active and the item is still missing (core/quests).
   */
  collectQuestNode: (nodeId: string) => boolean;
  /** Last quest accept/complete — brief UI feedback, cleared by the toast. */
  lastQuestEvent: { kind: 'accepted' | 'completed'; questId: string; xp: number } | null;
  clearLastQuestEvent: () => void;

  /**
   * Münzen (M5 Task 4, docs/10): plain counter OUTSIDE the item inventory —
   * no ResourceId, never disenchantable, never part of the defeat loot
   * penalty (docs/03 targets Run-Beute). Persisted additive-optional.
   */
  coins: number;
  /**
   * Sells surplus material at Piya's Markt (docs/10 prices, data/market).
   * False for unsellable material or too few units. The UI gates ACCESS
   * (Piya trade dialog / built Markt) — the math has no building gate.
   */
  sellResource: (resource: string, amount: number) => boolean;
  /** Buys one of Piya's offers (data/market). False when coins are short. */
  buyMarketOffer: (offerId: string) => boolean;
  /**
   * Schwarzes Brett (docs/10): the active request is DERIVED from
   * sleepCount (activeBoardRequestOf) — only "fulfilled this phase?" is
   * state. Repeatable across phases, at most once per phase (a request
   * pays above sell value, docs/10 — unlimited repeats would break the
   * coin flow), NO XP (Kein-Grind-Regel). Persisted additive-optional.
   */
  boardRequestFulfilled: boolean;
  /** Fulfils the active request (needs the built Markt B8). */
  fulfillActiveBoardRequest: () => boolean;
  /**
   * Markt-Panel open? (M5 Task 4b) — transient UI state like activeStation,
   * never persisted. Opened at the built Markt (B8) or via Piyas
   * openTrade-Dialog-Choice (docs/13); the world pauses while it is open.
   */
  marketOpen: boolean;
  openMarket: () => void;
  closeMarket: () => void;

  /**
   * Angeln (M5 Task 4, docs/09 V1): 1 Fisch pro Schlafphase am Steg (B5);
   * reset on sleep like harvest nodes. Persisted additive-optional.
   */
  fishedSinceSleep: boolean;
  /** Catches counted WHILE bruna_2 is active (Riesenwels-Regel, docs/09). */
  catfishCatches: number;
  /** One pier interaction. False without Steg or when already fished. */
  fishAtPier: () => boolean;
  /** Last catch — brief UI feedback (Riesenwels!), cleared by the toast. */
  lastFishCatch: { amount: number; giantCatfish: boolean } | null;
  clearLastFishCatch: () => void;

  /**
   * Running dialog (M5, docs/13) — transient UI/flow state, never persisted.
   * Flow rules live in core/dialog; this store only holds the run state and
   * interprets the declarative end actions (setStoryFlag, acceptQuest,
   * completeQuest; the openTrade hook docks onto the market task).
   */
  activeDialog: DialogRunState | null;
  /** Starts a dialog by id. False mid-combat/-run, with another overlay
   * open, while a dialog runs, or for unknown/empty dialogs. */
  startDialog: (dialogId: string) => boolean;
  /** Weiter (Klick/Leertaste): next box, or end + end actions. No-op at the
   * choice gate — the UI shows the options instead (docs/13). */
  advanceDialog: () => void;
  /** Picks a choice at the gate; applies its action and ends the dialog. */
  chooseDialogOption: (index: number) => void;

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

  /**
   * Talismans (M4 Task 4, docs/02 Lv 8): owned drops (multiset — duplicate
   * drops are kept) and the equipped subset (max talismanSlotsForLevel).
   * Equipped talismans apply their combatStartStatus at every combat start.
   */
  ownedTalismans: readonly string[];
  equippedTalismans: readonly string[];
  /** Equips an owned talisman (rules in core/progression/talismans). */
  equipTalisman: (talismanId: string) => boolean;
  /** Unequips an equipped talisman. */
  unequipTalisman: (talismanId: string) => boolean;
  /** NPC freed by the LAST won room fight — panel feedback, cleared on continue. */
  lastRescuedNpc: string | null;
  /** Enters the dungeon (run at room 0, full HP). False mid-combat/mid-run. */
  enterDungeon: (dungeonId: string) => boolean;
  /** Starts the fight of the current room. False without run/invalid deck. */
  startDungeonRoomCombat: (seed?: number) => boolean;
  /** Aufgeben (docs/03: jederzeit möglich) — ends the run with the 50 %
   * run-loot penalty; the player stays where they are. */
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

/** Full (max) HP of the current state — level curve + talent "Zähigkeit". */
export function fullHpOf(state: Pick<GameState, 'xp' | 'unlockedTalents'>): number {
  return maxHpForLevel(levelOf(state), modifiersOf(state).maxHpBonus);
}

/**
 * Level-up heal (docs/02: +5 max HP pro Level — der Zugewinn heilt mit):
 * current HP plus the max-HP difference the XP gain caused, clamped to the
 * new max. No level-up → HP is only clamped.
 */
function hpAfterXpGain(
  oldXp: number,
  newXp: number,
  currentHp: number,
  maxHpBonus: number,
): number {
  const oldMax = maxHpForLevel(levelForXp(oldXp), maxHpBonus);
  const newMax = maxHpForLevel(levelForXp(newXp), maxHpBonus);
  return Math.min(currentHp + Math.max(0, newMax - oldMax), newMax);
}

/** Positive per-item deltas between two inventories (run-loot tracking). */
function inventoryGains(before: Inventory, after: Inventory): Inventory {
  const gains: Record<string, number> = {};
  for (const [item, count] of Object.entries(after)) {
    const delta = count - (before[item] ?? 0);
    if (delta > 0) gains[item] = delta;
  }
  return gains;
}

/** Merges gains into the tracked run loot (lootSinceRest). */
function trackGains(lootSinceRest: Inventory, gains: Inventory): Inventory {
  let next = lootSinceRest;
  for (const [item, amount] of Object.entries(gains)) {
    if (amount > 0) next = addItem(next, item, amount);
  }
  return next;
}

/** Exploration progress 0..1 (markers in data/exploration, docs/02). */
export function explorationOf(state: Pick<GameState, 'discoveredMarkers'>): number {
  return explorationFraction(state.discoveredMarkers, heimatbuchtExplorationMarkers);
}

/**
 * Island cleansed? (docs/02: Inselboss besiegt → Dichte dauerhaft 0.)
 * Derived from completedDungeons: a dungeon with cleansesIsland set cleanses
 * its island (Wurzelwächter = Boss der Heimatbucht, data/dungeons).
 */
export function cleansedOf(state: Pick<GameState, 'completedDungeons'>): boolean {
  return state.completedDungeons.some((id) => dungeonsById[id]?.cleansesIsland === 'heimatbucht');
}

/**
 * Build-check context (core/village) composed from store state.
 * `onboarding`/`beat6` are granted by default until M6 wires the real
 * onboarding flags — they only gate stages that are pre-built anyway
 * (data/buildings initialBuildingStages); island_cleansed is derived.
 */
export function buildContextOf(
  state: Pick<
    GameState,
    'inventory' | 'storyFlags' | 'rescuedNpcs' | 'friendshipLevels' | 'completedDungeons'
  >,
): BuildContext {
  const flags = ['onboarding', 'beat6', ...state.storyFlags];
  if (cleansedOf(state)) flags.push('island_cleansed');
  return {
    inventory: state.inventory,
    flags,
    rescuedNpcs: state.rescuedNpcs,
    friendshipLevels: state.friendshipLevels,
  };
}

/**
 * Quest-check context (core/quests) composed from store state. Flags
 * include the DERIVED island_cleansed (same rule as buildContextOf) — the
 * data layer references it like any stored flag (Piya arrival, Bruna 3).
 */
export function questContextOf(
  state: Pick<
    GameState,
    | 'inventory'
    | 'storyFlags'
    | 'builtBuildings'
    | 'rescuedNpcs'
    | 'completedDungeons'
    | 'activeQuests'
    | 'completedQuests'
  >,
): QuestContext {
  const flags = [...state.storyFlags];
  if (cleansedOf(state)) flags.push('island_cleansed');
  return {
    inventory: state.inventory,
    flags,
    builtBuildings: state.builtBuildings,
    rescuedNpcs: state.rescuedNpcs,
    activeQuests: state.activeQuests,
    completedQuests: state.completedQuests,
  };
}

type QuestStateSlice = Parameters<typeof questContextOf>[0];

/** Has the NPC arrived? (docs/09 Ankunft durch Taten — derived, world layer.) */
export function npcArrivedOf(state: QuestStateSlice, npcId: string): boolean {
  const npc = npcsById[npcId];
  return npc ? npcArrived(npc, questContextOf(state)) : false;
}

/** Dialog that talking to the NPC opens right now (core/quests priority). */
export function npcDialogIdOf(state: QuestStateSlice, npcId: string): string | null {
  const npc = npcsById[npcId];
  return npc ? dialogIdForNpc(npc, questContextOf(state)) : null;
}

/** Overhead quest symbol for the NPC (docs/13: ! / ? — nie nur Farbe). */
export function questIndicatorOf(state: QuestStateSlice, npcId: string): '!' | '?' | null {
  const npc = npcsById[npcId];
  return npc ? questIndicator(npc, questContextOf(state)) : null;
}

/** Visibility of a quest-spawned collect point (docs/09, core/quests). */
export function questNodeVisibleOf(state: QuestStateSlice, nodeId: string): boolean {
  const node = questCollectNodes.find((n) => n.id === nodeId);
  return node ? questNodeVisible(node, questContextOf(state)) : false;
}

/**
 * Dish slots per expedition (docs/09 B1 Haus: +1, Cap 2 gesamt) — every
 * deck consumer (Deck-Truhe add, combat deck validation) must use this.
 */
export function dishSlotsOf(state: Pick<GameState, 'builtBuildings'>): number {
  return dishSlots(state.builtBuildings, deckConfig.dishSlots);
}

/**
 * Active Schwarzes-Brett request (docs/10) — DERIVED deterministically from
 * the persisted sleep counter (core/economy/board), so saves need no
 * rotation state and every consumer (UI, fulfil action) sees the same one.
 */
export function activeBoardRequestOf(state: Pick<GameState, 'sleepCount'>): BoardRequestDef | null {
  return activeBoardRequest(boardRequests, state.sleepCount);
}

/**
 * Shadow density every consumer must use (encounter rolls, dungeon scaling,
 * loot, HUD): exploration-derived density, permanently pinned to 0 once the
 * island is cleansed (core/world/exploration.effectiveShadowDensity).
 */
export function effectiveDensityOf(
  state: Pick<GameState, 'shadowDensity' | 'completedDungeons'>,
): ShadowDensity {
  return effectiveShadowDensity(state.shadowDensity, cleansedOf(state));
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
    dishSlotsOf(state),
  );
  if (!combatDeck) return null;
  const mods = modifiersOf(state);
  return combatDeck.map((card) => scaleDishCard(card, mods.dishEffectMultiplier));
}

/**
 * Applies the equipped talismans to a combat setup (docs/07 Dornenring →
 * Vergeltung 1 ab Kampfstart; descriptor interpretation in core/progression).
 */
function applyEquippedTalismans(
  setup: CombatSetup,
  state: Pick<GameState, 'equippedTalismans'>,
): void {
  const statuses = combatStartStatuses(state.equippedTalismans, talismansById);
  if (Object.keys(statuses).length > 0) setup.playerStartStatuses = statuses;
  // M5 descriptor kinds (docs/09): Warmer Bauch / Amboss-Herz / Seemannsgarn.
  const mods = talismanCombatModifiers(state.equippedTalismans, talismansById);
  if (mods.combatStartHeal > 0) setup.combatStartHeal = mods.combatStartHeal;
  if (mods.defenseCardBlockBonus > 0) setup.defenseCardBlockBonus = mods.defenseCardBlockBonus;
  if (mods.firstDefenseCardFree) setup.firstDefenseCardFree = true;
}

/**
 * Interprets declarative dialog-end actions (docs/13: Flags/Quest-Folgen
 * als Events durch core) and closes the dialog. acceptQuest/completeQuest
 * dispatch to the quest actions (rules in core/quests); openTrade opens the
 * Markt-Panel (M5 Task 4b).
 */
function endDialog(
  actions: readonly DialogActionDef[],
  set: (partial: Partial<GameState>) => void,
  get: () => GameState,
): void {
  set({ activeDialog: null });
  for (const action of actions) {
    switch (action.type) {
      case 'setStoryFlag':
        get().setStoryFlag(action.flag);
        break;
      case 'acceptQuest':
        get().acceptQuest(action.questId);
        break;
      case 'completeQuest':
        get().completeQuest(action.questId);
        break;
      case 'openTrade':
        // Piyas „Zeig mir deine Waren" (docs/13) → Markt-Panel (M5 Task 4b).
        get().openMarket();
        break;
    }
  }
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

  playerHp: maxHpForLevel(1),
  lootSinceRest: emptyInventory,
  lastDefeatLoss: null,
  clearLastDefeatLoss: () => set({ lastDefeatLoss: null }),

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
    set({
      inventory: outcome.inventory,
      harvestedNodeIds: outcome.harvestedNodeIds,
      // Run-loot tracking (defeat penalty basis, docs/03).
      lootSinceRest: trackGains(get().lootSinceRest, inventoryGains(inventory, outcome.inventory)),
    });
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
    set({
      inventory: outcome.inventory,
      farmPlots: outcome.plots,
      // Run-loot tracking (defeat penalty basis, docs/03).
      lootSinceRest: trackGains(get().lootSinceRest, inventoryGains(inventory, outcome.inventory)),
    });
    return true;
  },
  sleep: () => {
    const { farmPlots, sleepCount } = get();
    set({
      farmPlots: advanceSleep(farmPlots),
      sleepCount: sleepCount + 1,
      // Harvest nodes respawn on sleep (docs/10 — closes the M2 "no respawn
      // until sleep exists" gap in data/resources.ts / core/economy/harvest).
      harvestedNodeIds: [],
      // Sleep heals to full (docs/10) and closes the loot-penalty window:
      // rested loot is banked, a later defeat cannot touch it (docs/03).
      playerHp: fullHpOf(get()),
      lootSinceRest: emptyInventory,
      // New sleep phase: next pier catch is free (docs/09) and the Brett
      // rotates (derived from the incremented sleepCount, docs/10).
      fishedSinceSleep: false,
      boardRequestFulfilled: false,
    });
  },

  collection: [],
  deck: [...starterDeckIds],
  consumedStarterDishes: [],
  addCardToDeck: (cardId) => {
    const { deck, collection, consumedStarterDishes } = get();
    const owned = ownedCountsAfterConsumption(starterDeckIds, collection, consumedStarterDishes);
    // Deck max size is level-dependent (docs/02 milestone Lv 4: 12 → 15).
    const next = addToDeck(
      deck,
      cardId,
      owned,
      cardsById,
      deckLimitForLevel(levelOf(get())),
      dishSlotsOf(get()),
    );
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

  builtBuildings: initialBuildingStages,
  stationTiers: initialStationTiers,
  storyFlags: [],
  setStoryFlag: (flag) => {
    const { storyFlags } = get();
    if (storyFlags.includes(flag)) return; // idempotent
    set({ storyFlags: [...storyFlags, flag] });
  },
  friendshipLevels: {},
  activeBuildSlot: null,
  openBuildSlot: (slot) => {
    if (get().combat) return; // no building mid-combat (same rule as stations)
    set({ activeBuildSlot: slot });
  },
  closeBuildSlot: () => set({ activeBuildSlot: null }),
  buildBuilding: (slot) => {
    const def = buildingsBySlot[slot];
    if (!def) return false;
    const { builtBuildings, stationTiers } = get();
    const currentStage = builtBuildings[slot] ?? 0;
    const ctx = buildContextOf(get());
    if (!canBuild(def, currentStage, ctx).allowed) return false;
    const result = build(def, currentStage, ctx);
    if (!result) return false;
    set({
      inventory: result.inventory,
      builtBuildings: { ...builtBuildings, [slot]: result.stage },
      // B2/B3 dock onto the workshop stations: the built stage IS the
      // station tier (docs/09 ↔ docs/10 Ausbaustufen, never lowered).
      ...(def.station
        ? {
            stationTiers: {
              ...stationTiers,
              [def.station]: Math.max(stationTiers[def.station] ?? 1, result.stage),
            },
          }
        : {}),
    });
    return true;
  },
  craftRecipe: (recipeId) => {
    const { activeStation, inventory, toolTier, collection } = get();
    const baseRecipe = allRecipes.find((r) => r.id === recipeId);
    if (!baseRecipe || baseRecipe.station !== activeStation) return false;
    // Talent "Sparsame Hände": card recipes cost 1 base material less
    // (docs/02; rule in core/economy/crafting.discountedRecipe).
    const recipe = discountedRecipe(baseRecipe, modifiersOf(get()).craftBaseMaterialDiscount);
    if (!isRecipeVisible(recipe, toolTier)) return false;
    // Quest-gated recipes need their NPC lesson first (docs/09, M5 Task 3).
    if (!isRecipeTaught(recipe, get().unlockedRecipes)) return false;
    // Station tier is store state now (M5: B2/B3 builds raise it).
    if (!isRecipeUnlocked(recipe, get().stationTiers[recipe.station] ?? 1)) return false;
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

  activeQuests: [],
  completedQuests: [],
  unlockedRecipes: [],
  acceptQuest: (questId) => {
    const quest = questById(questId);
    if (!quest) return false;
    const npc = npcsById[quest.npcId];
    if (!npc) return false;
    const next = acceptQuestRules(quest, npc, questContextOf(get()));
    if (!next) return false;
    set({
      activeQuests: next,
      lastQuestEvent: { kind: 'accepted', questId, xp: 0 },
    });
    return true;
  },
  completeQuest: (questId) => {
    const quest = questById(questId);
    if (!quest) return false;
    const result = completeQuestRules(quest, questContextOf(get()));
    if (!result) return false;
    const { unlockedRecipes, ownedTalismans, friendshipLevels, storyFlags } = get();
    set({
      inventory: result.inventory,
      activeQuests: result.activeQuests,
      completedQuests: result.completedQuests,
      // Rewards are declarative (docs/09): recipe unlocks, talisman
      // OWNERSHIP (same channel as loot drops), story flags.
      unlockedRecipes: [
        ...unlockedRecipes,
        ...result.recipeIds.filter((id) => !unlockedRecipes.includes(id)),
      ],
      ownedTalismans: [...ownedTalismans, ...result.talismanIds],
      storyFlags: [...storyFlags, ...result.flags.filter((f) => !storyFlags.includes(f))],
      // Friendship = completed chain stages (docs/09; never lowered).
      friendshipLevels: {
        ...friendshipLevels,
        [quest.npcId]: Math.max(friendshipLevels[quest.npcId] ?? 0, result.friendshipLevel),
      },
      lastQuestEvent: { kind: 'completed', questId, xp: result.xp },
    });
    // Uniform stage XP (docs/09: 30/50/80) — level-up heal via grantXp.
    get().grantXp(result.xp, 'quest');
    return true;
  },
  collectQuestNode: (nodeId) => {
    const node = questCollectNodes.find((n) => n.id === nodeId);
    if (!node) return false;
    if (!questNodeVisible(node, questContextOf(get()))) return false;
    // Quest pickups are NOT tracked as run loot (lootSinceRest): losing a
    // quest item to the defeat penalty would soft-lock cozy chains.
    set({ inventory: addItem(get().inventory, node.resource, node.amount) });
    return true;
  },
  lastQuestEvent: null,
  clearLastQuestEvent: () => set({ lastQuestEvent: null }),

  coins: 0,
  sellResource: (resource, amount) => {
    const { inventory, coins } = get();
    // Price map keys are ResourceIds — unknown strings fall out as null.
    const result = sellResource(inventory, coins, resource as never, amount, sellPrices);
    if (!result) return false;
    // Selling only REMOVES items — lootSinceRest (defeat penalty basis)
    // stays untouched; coins are never penalized (docs/03).
    set({ inventory: result.inventory, coins: result.coins });
    return true;
  },
  buyMarketOffer: (offerId) => {
    const offer = piyaOffersById[offerId];
    if (!offer) return false;
    const result = buyOffer(get().coins, get().inventory, offer);
    if (!result) return false;
    // Purchases are NOT run loot (lootSinceRest): they are paid for, not
    // Beute — losing them to the defeat penalty would double-charge.
    set({ inventory: result.inventory, coins: result.coins });
    return true;
  },
  boardRequestFulfilled: false,
  fulfillActiveBoardRequest: () => {
    const { builtBuildings, boardRequestFulfilled, inventory, coins } = get();
    // The Brett hangs at the Markt (docs/09 B8) — no Markt, no Bitten.
    if ((builtBuildings[marketSlot] ?? 0) < 1) return false;
    if (boardRequestFulfilled) return false; // once per sleep phase
    const request = activeBoardRequestOf(get());
    if (!request) return false;
    const result = fulfillBoardRequest(inventory, coins, request);
    if (!result) return false;
    // Coins only, NO XP (docs/09 Quest-Typen: Kein-Grind-Regel docs/02).
    set({ inventory: result.inventory, coins: result.coins, boardRequestFulfilled: true });
    return true;
  },
  marketOpen: false,
  openMarket: () => {
    if (get().combat) return; // no market mid-combat (same rule as stations)
    set({ marketOpen: true });
  },
  closeMarket: () => set({ marketOpen: false }),

  fishedSinceSleep: false,
  catfishCatches: 0,
  fishAtPier: () => {
    const { inventory, builtBuildings, fishedSinceSleep, catfishCatches, activeQuests } = get();
    const result = fishAtPier(
      inventory,
      builtBuildings[fishingConfig.pierSlot] ?? 0,
      fishedSinceSleep,
      catfishCatches,
      // Riesenwels counter runs ONLY while bruna_2 is active (docs/09).
      activeQuests.includes(fishingConfig.catfishQuestId),
      fishingConfig,
    );
    if (!result) return false;
    set({
      inventory: result.inventory,
      fishedSinceSleep: true,
      catfishCatches: result.catfishCatches,
      lastFishCatch: { amount: fishingConfig.fishPerCatch, giantCatfish: result.caughtGiantCatfish },
      // Fish are gathered goods → run-loot tracking like harvest nodes.
      lootSinceRest: trackGains(
        get().lootSinceRest,
        inventoryGains(inventory, result.inventory),
      ),
    });
    // The 5th quest-active catch IS the Riesenwels (docs/09) — the flag is
    // bruna_2's turn-in requirement (data/npcs); setStoryFlag is idempotent.
    if (result.caughtGiantCatfish) get().setStoryFlag(fishingConfig.catfishFlag);
    return true;
  },
  lastFishCatch: null,
  clearLastFishCatch: () => set({ lastFishCatch: null }),

  activeDialog: null,
  startDialog: (dialogId) => {
    const { combat, currentDungeonRun, activeStation, activeBuildSlot, activeDialog, marketOpen } =
      get();
    // One overlay at a time — dialogs follow the station/build rule.
    if (combat || currentDungeonRun || activeStation || activeBuildSlot || activeDialog || marketOpen) {
      return false;
    }
    const def = dialogsById[dialogId];
    if (!def) return false;
    const run = startDialogRun(def);
    if (!run) return false;
    set({ activeDialog: run });
    return true;
  },
  advanceDialog: () => {
    const { activeDialog } = get();
    if (!activeDialog) return;
    const def = dialogsById[activeDialog.dialogId];
    if (!def) {
      set({ activeDialog: null }); // defensive: data vanished mid-run
      return;
    }
    const result = advanceDialogRun(def, activeDialog);
    if (result.kind === 'line') set({ activeDialog: result.run });
    else if (result.kind === 'end') endDialog(result.actions, set, get);
    // 'awaitChoice': blocked — the UI renders the options (docs/13).
  },
  chooseDialogOption: (index) => {
    const { activeDialog } = get();
    if (!activeDialog) return;
    const def = dialogsById[activeDialog.dialogId];
    if (!def) {
      set({ activeDialog: null });
      return;
    }
    const result = resolveDialogChoice(def, activeDialog, index);
    if (result) endDialog(result.actions, set, get);
  },

  xp: 0,
  unlockedTalents: [],
  // `source` exists for the API contract (scripted grants, docs/06) and
  // future logging — the XP math is source-agnostic on purpose.
  grantXp: (amount) => {
    if (!Number.isFinite(amount) || amount <= 0) return;
    const { xp, playerHp } = get();
    const nextXp = xp + Math.floor(amount);
    // Level-up heals by the max-HP gain (docs/02: +5 max HP pro Level).
    set({
      xp: nextXp,
      playerHp: hpAfterXpGain(xp, nextXp, playerHp, modifiersOf(get()).maxHpBonus),
    });
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
    const { combat } = get();
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
            // Cleansed island → effective density 0: no ×2/loot bonus.
            effectiveDensityOf(get()),
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
    let nextOwnedTalismans = get().ownedTalismans;
    if (won && combatLoot) {
      for (const [item, amount] of Object.entries(combatLoot)) {
        // Talisman drops (ids double as loot item ids, data/talismans)
        // become talisman OWNERSHIP, not inventory items (docs/07
        // Dornenschreck → 25 % Dornenring).
        if (talismansById[item]) {
          nextOwnedTalismans = [...nextOwnedTalismans, ...(Array(amount).fill(item) as string[])];
        } else {
          nextInventory = addItem(nextInventory, item, amount);
        }
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
    let dungeonEndedWithoutVictory = false;
    let dungeonCompleted = false;
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
          dungeonCompleted = true;
          if (!completedDungeons.includes(dungeon.id)) {
            nextCompletedDungeons = [...completedDungeons, dungeon.id];
          }
        } else {
          nextRun = result.run; // HP-Übertrag in den nächsten Raum (docs/03)
        }
      } else {
        // Niederlage/Rückzug im Dungeon: Run endet, zurück zur Insel.
        nextRun = null;
        dungeonEndedWithoutVictory = true;
      }
    }

    // ── Defeat flow (M4 Task 5, docs/03 Cozy-Anpassung 1) ────────────────
    // Defeat ANYWHERE: wake up at the tent (world layer moves the sprite),
    // lose 50 % of the run loot, wake-up counts as a sleep cycle (crops
    // grow, nodes respawn), fully healed — never a dead end.
    // Dungeon retreat = Aufgeben (docs/03: "Beute-Malus wie gehabt") — same
    // penalty, but the player stays where they are, no sleep cycle.
    // Free-field retreat stays penalty-free (docs/03: "keine Beute" only).
    const defeated = combat?.phase === 'defeat';
    const penalized = defeated || (dungeonEndedWithoutVictory && combat?.phase === 'retreated');
    const { lootSinceRest, playerHp, farmPlots, sleepCount, harvestedNodeIds } = get();
    let lastDefeatLoss: Inventory | null = null;
    let nextLootSinceRest = lootSinceRest;
    if (penalized) {
      const penalty = applyLootPenalty(
        nextInventory,
        lootSinceRest,
        defeatConfig.lootPenaltyFraction,
      );
      nextInventory = penalty.inventory;
      lastDefeatLoss = penalty.lost;
      nextLootSinceRest = emptyInventory; // penalty applied exactly once
    } else if (won && combatLoot) {
      // Victory loot joins the run loot (items only — talisman ownership is
      // permanent progression, never part of the defeat penalty, docs/03).
      const itemLoot = Object.fromEntries(
        Object.entries(combatLoot).filter(([item]) => !talismansById[item]),
      );
      nextLootSinceRest = trackGains(lootSinceRest, itemLoot);
    }

    // ── HP persistence outside combat (M4 Task 5) ─────────────────────────
    const nextXp = xp + xpGain;
    const maxHpBonus = modifiersOf(get()).maxHpBonus;
    let nextPlayerHp: number;
    if (defeated) {
      // Waking up in the bed = fully healed (docs/03: kein Game Over).
      nextPlayerHp = maxHpForLevel(levelForXp(nextXp), maxHpBonus);
    } else if (combat && (!currentDungeonRun || dungeonCompleted)) {
      // Island victory/retreat and a finished dungeon carry the remaining
      // HP back to the island (level-up heal applies, docs/02).
      nextPlayerHp = hpAfterXpGain(xp, nextXp, combat.player.hp, maxHpBonus);
    } else {
      // Mid-run room win or dungeon abandon: island HP untouched (run HP is
      // run-internal, core/world/dungeon).
      nextPlayerHp = hpAfterXpGain(xp, nextXp, playerHp, maxHpBonus);
    }

    set({
      xp: nextXp,
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
      ownedTalismans: nextOwnedTalismans,
      lastCombatOutcome: combat?.phase ?? null,
      lastLoot: won ? combatLoot : null,
      playerHp: nextPlayerHp,
      lootSinceRest: nextLootSinceRest,
      lastDefeatLoss,
      // Waking up after a defeat counts as sleeping (consistent with
      // sleep()): crops advance, harvest nodes respawn.
      ...(defeated
        ? {
            farmPlots: advanceSleep(farmPlots),
            sleepCount: sleepCount + 1,
            harvestedNodeIds: [] as readonly string[],
            // Same sleep-phase resets as sleep(): fishing and Brett.
            fishedSinceSleep: false,
            boardRequestFulfilled: false,
          }
        : { farmPlots, sleepCount, harvestedNodeIds }),
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
      // Level-up heals by the max-HP gain (docs/02), same rule as grantXp.
      playerHp: hpAfterXpGain(xp, xp + gained, get().playerHp, modifiersOf(get()).maxHpBonus),
    });
    return true;
  },
  startEncounter: (zone, seed) => {
    const { combat, startCombat, currentDungeonRun } = get();
    if (combat || currentDungeonRun) return false;
    // Cleansed island: permanent density 0 (docs/02) — encounters stay
    // possible, but without scaling/elites/affixes.
    const density = effectiveDensityOf(get());
    // Combat uses the deck assembled at the Deck-Truhe; an invalid deck
    // (e.g. < 12 after a disenchant or dish consumption) blocks the
    // encounter (docs/03).
    const combatDeck = buildScaledCombatDeck(get());
    if (!combatDeck) return false;
    const mods = modifiersOf(get());
    const encounterSeed = seed ?? Math.floor(Math.random() * 0xffffffff);
    const encounter = rollEncounter(encounterTables[zone], density, createRng(encounterSeed));
    // Island encounters start from the PERSISTED HP (M4 Task 5) — clamped
    // to the level/talent max in case talents or levels changed since.
    const maxHp = maxHpForLevel(levelOf(get()), mods.maxHpBonus);
    const setup = buildEncounterCombatSetup(encounter, density, {
      playerHp: Math.min(get().playerHp, maxHp),
      playerMaxHp: maxHp,
      deck: combatDeck,
    });
    setup.toolTier = get().toolTier; // Axtschlag scaling (docs/10 Werkzeugstufen)
    // Talent "Klingenschliff": first attack per combat +2 damage (docs/02).
    if (mods.firstAttackBonus > 0) setup.firstAttackBonus = mods.firstAttackBonus;
    applyEquippedTalismans(setup, get());
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
  ownedTalismans: [],
  equippedTalismans: [],
  equipTalisman: (talismanId) => {
    const { ownedTalismans, equippedTalismans } = get();
    // Slots per level (docs/02: Slot 1 ab Lv 8); rules in core/progression.
    const next = equipTalisman(
      equippedTalismans,
      ownedTalismans,
      talismanId,
      talismanSlotsForLevel(levelOf(get())),
      talismansById,
    );
    if (!next) return false;
    set({ equippedTalismans: next });
    return true;
  },
  unequipTalisman: (talismanId) => {
    const next = unequipTalisman(get().equippedTalismans, talismanId);
    if (!next) return false;
    set({ equippedTalismans: next });
    return true;
  },
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
    const { combat, currentDungeonRun, startCombat } = get();
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
    // (DungeonDef.scalesWithDensity, assumption documented in data);
    // effective density — a cleansed island's repeat dungeon runs at 0.
    const density = dungeon.scalesWithDensity ? effectiveDensityOf(get()) : 0;
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
    applyEquippedTalismans(setup, get());
    set({ currentEncounter: encounter, lastRescuedNpc: null });
    startCombat(setup, seed);
    return true;
  },
  abandonDungeonRun: () => {
    // Aufgeben (docs/03: jederzeit garantiert, Beute-Malus wie gehabt):
    // 50 % of the run loot is lost, the player stays where they are.
    if (get().combat) return; // mid-combat the retreat button owns this
    const { inventory, lootSinceRest } = get();
    const penalty = applyLootPenalty(inventory, lootSinceRest, defeatConfig.lootPenaltyFraction);
    set({
      currentDungeonRun: null,
      lastRescuedNpc: null,
      inventory: penalty.inventory,
      lastDefeatLoss: penalty.lost,
      lootSinceRest: emptyInventory,
    });
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
      ownedTalismans: data.ownedTalismans ?? [],
      equippedTalismans: data.equippedTalismans ?? [],
      // HP persistence (M4 Task 5, additive-optional): older saves wake up
      // at full HP; loaded values are clamped to the level/talent max.
      playerHp: Math.min(
        data.playerHp ?? Number.POSITIVE_INFINITY,
        maxHpForLevel(
          levelForXp(data.xp ?? 0),
          talentModifiers(data.unlockedTalents ?? [], talents).maxHpBonus,
        ),
      ),
      lootSinceRest: data.lootSinceRest ?? emptyInventory,
      // Buildings (M5, additive-optional): pre-M5 saves get the initial
      // stages; stored stages never drop below the initial ones (B1–B3
      // exist in the world from the start).
      builtBuildings: Object.fromEntries(
        BUILDING_SLOT_IDS.map((id) => [
          id,
          Math.max(initialBuildingStages[id], data.builtBuildings?.[id] ?? 0),
        ]),
      ) as Record<BuildingSlotId, number>,
      // Station tiers never drop below the starter tiers (data/stations).
      stationTiers: Object.fromEntries(
        Object.entries(initialStationTiers).map(([station, tier]) => [
          station,
          Math.max(tier, data.stationTiers?.[station] ?? 0),
        ]),
      ),
      storyFlags: data.storyFlags ?? [],
      friendshipLevels: data.friendshipLevels ?? {},
      // Quests (M5 Task 3, additive-optional): pre-quest saves start clean.
      activeQuests: data.activeQuests ?? [],
      completedQuests: data.completedQuests ?? [],
      unlockedRecipes: data.unlockedRecipes ?? [],
      // Coins/Brett/Angeln (M5 Task 4, additive-optional): pre-market saves
      // start at 0 coins, nothing fulfilled, nothing fished.
      coins: data.coins ?? 0,
      boardRequestFulfilled: data.boardRequestFulfilled ?? false,
      fishedSinceSleep: data.fishedSinceSleep ?? false,
      catfishCatches: data.catfishCatches ?? 0,
      saveRecovered: recovered,
    }),
  saveRecovered: false,
  clearSaveRecovered: () => set({ saveRecovered: false }),
}));

export function useGameStore<T>(selector: (state: GameState) => T): T {
  return useStore(gameStore, selector);
}
