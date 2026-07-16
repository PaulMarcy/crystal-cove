/**
 * Building slots B1–B9 at the Heimatbucht camp (M5, docs/09 Bauplätze).
 * Pure data — build rules live in core/village/buildings.ts (CLAUDE.md rule 2).
 *
 * Costs and prerequisites follow the docs/09 table verbatim (commit daacc2b).
 * Prerequisites are DECLARATIVE conditions; the store composes the context
 * (flags, rescued NPCs, friendship levels) and core evaluates them — no
 * per-building special logic.
 *
 * B2/B3 dock onto the EXISTING workshop stations (data/stations.ts): their
 * world sprite is the station itself, and building a stage mirrors into the
 * station tier (recipes unlock per tier, docs/10). Initial stages match
 * initialStationTiers — no duplication.
 */
import type { ResourceId } from './resources';
import type { StationId } from './recipes';

export const BUILDING_SLOT_IDS = ['b1', 'b2', 'b3', 'b4', 'b5', 'b6', 'b7', 'b8', 'b9'] as const;
export type BuildingSlotId = (typeof BUILDING_SLOT_IDS)[number];

export function isBuildingSlotId(value: unknown): value is BuildingSlotId {
  return typeof value === 'string' && (BUILDING_SLOT_IDS as readonly string[]).includes(value);
}

/**
 * Story flags used by building prerequisites. `onboarding` and `beat6`
 * arrive with M6 (docs/06); until then the store grants them by default —
 * they only gate stages that are pre-built anyway (B1/B2/B3 stage 1).
 * `island_cleansed` is DERIVED from completedDungeons (store cleansedOf),
 * `piya_chain_complete` is set by the M5 quest task (docs/09 Piya-Kette).
 */
export type StoryFlagId = 'onboarding' | 'beat6' | 'island_cleansed' | 'piya_chain_complete';

/** Declarative build prerequisite (docs/09 Voraussetzung column). */
export type BuildRequirement =
  | { kind: 'flag'; flag: StoryFlagId }
  | { kind: 'npcRescued'; npc: string }
  | { kind: 'friendship'; npc: string; level: number };

export interface BuildingStageDef {
  /** Material costs to REACH this stage (docs/09; empty = quest-gated only). */
  costs: Readonly<Partial<Record<ResourceId, number>>>;
  /** Non-material prerequisites to reach this stage. */
  requirements: readonly BuildRequirement[];
}

export interface BuildingDef {
  id: BuildingSlotId;
  /** stages[i] describes the upgrade FROM stage i TO stage i+1. */
  stages: readonly BuildingStageDef[];
  /** Workshop station whose tier mirrors the built stage (B2/B3, docs/10). */
  station?: StationId;
  /** Marker tile on the Heimatbucht map (16 px tiles; assumption, tune here). */
  tileX: number;
  tileY: number;
}

export const buildings: readonly BuildingDef[] = [
  {
    // B1 Zelt → Hütte → Haus (docs/09): Haus = +1 Gericht-Slot (Cap 2 gesamt).
    id: 'b1',
    stages: [
      { costs: {}, requirements: [{ kind: 'flag', flag: 'onboarding' }] },
      { costs: { wood: 8, stone: 4 }, requirements: [] },
      { costs: { wood: 12, stone: 6, tough_leather: 2 }, requirements: [] },
    ],
    tileX: 27,
    tileY: 17,
  },
  {
    // B2 Kochstelle → Küche St. 2/3 (docs/09) — docks onto station 'kitchen'.
    id: 'b2',
    stages: [
      { costs: {}, requirements: [{ kind: 'flag', flag: 'onboarding' }] },
      {
        costs: { wood: 6, stone: 4, resin: 2 },
        requirements: [{ kind: 'friendship', npc: 'tilda', level: 1 }],
      },
      {
        costs: { wood: 6, stone: 4, resin: 2 },
        requirements: [{ kind: 'friendship', npc: 'tilda', level: 2 }],
      },
    ],
    station: 'kitchen',
    tileX: 23,
    tileY: 14,
  },
  {
    // B3 Schmiede St. 1→3 (docs/09) — docks onto station 'smithy'.
    id: 'b3',
    stages: [
      { costs: {}, requirements: [{ kind: 'flag', flag: 'beat6' }] },
      {
        costs: { stone: 6, copper_ore: 4 },
        requirements: [{ kind: 'friendship', npc: 'maro', level: 1 }],
      },
      {
        costs: { stone: 6, copper_ore: 4 },
        requirements: [{ kind: 'friendship', npc: 'maro', level: 2 }],
      },
    ],
    station: 'smithy',
    tileX: 17,
    tileY: 14,
  },
  {
    // B4 Wohnhaus 1 (docs/09): Tilda zieht ein (arrival flag, later M5 task).
    id: 'b4',
    stages: [{ costs: { wood: 10, stone: 6 }, requirements: [] }],
    tileX: 14,
    tileY: 16,
  },
  {
    // B5 Steg (docs/09): Bruna zieht ein; Angeln (function in a later task).
    id: 'b5',
    stages: [{ costs: { wood: 4, vine: 4 }, requirements: [] }],
    tileX: 12,
    tileY: 21,
  },
  {
    // B6 Kristallschrein (docs/09): Orin befreit + 10 Schattenstaub —
    // explicitly INDEPENDENT of B7 (docs/09, commit daacc2b).
    id: 'b6',
    stages: [{ costs: { shadow_dust: 10 }, requirements: [{ kind: 'npcRescued', npc: 'orin' }] }],
    tileX: 30,
    tileY: 15,
  },
  {
    // B7 Wohnhaus 2 (docs/09): Orin zieht ein.
    id: 'b7',
    stages: [
      {
        costs: { wood: 10, stone: 8, tough_leather: 2 },
        requirements: [{ kind: 'npcRescued', npc: 'orin' }],
      },
    ],
    tileX: 30,
    tileY: 18,
  },
  {
    // B8 Markt (docs/09): Piya; Handel + Schwarzes Brett (function later M5).
    id: 'b8',
    stages: [
      { costs: { wood: 12, stone: 4 }, requirements: [{ kind: 'flag', flag: 'island_cleansed' }] },
    ],
    tileX: 24,
    tileY: 20,
  },
  {
    // B9 Bootshaus (docs/09): quest-gated only — no material costs in docs.
    id: 'b9',
    stages: [{ costs: {}, requirements: [{ kind: 'flag', flag: 'piya_chain_complete' }] }],
    tileX: 33,
    tileY: 21,
  },
];

export const buildingsBySlot: Readonly<Record<BuildingSlotId, BuildingDef>> = Object.fromEntries(
  buildings.map((b) => [b.id, b]),
) as Record<BuildingSlotId, BuildingDef>;

/**
 * Stages already built at game start: B1 tent and the two starter stations
 * exist in the world (data/stations initialStationTiers, tent in
 * data/farming) — the onboarding/beat6 gates of their stage 1 never
 * evaluate at runtime.
 */
export const initialBuildingStages: Readonly<Record<BuildingSlotId, number>> = {
  b1: 1,
  b2: 1,
  b3: 1,
  b4: 0,
  b5: 0,
  b6: 0,
  b7: 0,
  b8: 0,
  b9: 0,
};

/**
 * Village-wide effect values (docs/09 Effekt column, B1 Haus):
 * "+1 Gericht-Slot auf Expedition (Cap 2 gesamt — nicht additiv mit Lv 12)".
 * The cap is authoritative: house bonus and any future level bonus never
 * stack past dishSlotCap (rule in core/village/buildings.dishSlots).
 */
export const villageConfig = {
  /** Slot whose top stage grants the dish-slot bonus (B1 Haus). */
  houseSlot: 'b1' as BuildingSlotId,
  /** Stage at which the bonus applies (Haus = Stufe 3). */
  houseStage: 3,
  houseDishSlotBonus: 1,
  /** Hard cap on dish slots per expedition (docs/09: Cap 2 gesamt). */
  dishSlotCap: 2,
} as const;

/** Max distance (px) at which a build slot can be interacted with. */
export const buildSlotInteractRange = 26;
