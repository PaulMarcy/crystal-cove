/**
 * NPC roster + personal quest chains (M5, docs/09 — Datenformat-Hinweis).
 * Pure data: arrival/quest rules live in core/quests (CLAUDE.md rule 2).
 *
 * Everything is DECLARATIVE — arrival triggers, quest requirements and
 * rewards are interpreted by core/quests against a store-composed context
 * (docs/09: "Trigger-Flags kommen aus dem Save-Modul, keine Sonderlogik
 * pro NPC"). Display names/texts live in shared/strings.ts.
 *
 * Quest XP (docs/09 Quest-Typen): einheitlich St. 1 = 30, St. 2 = 50,
 * St. 3 = 80 — questConfig.xpByStage, never hardcoded in logic.
 *
 * Requirements that later tasks fulfil (documented in docs/09 + task brief):
 * - bruna_2: flag `giant_catfish_caught` — set by the fishing task (M5
 *   Task 4, 5th catch while the quest is active).
 * - orin_2: flag `resonance_test_passed` — set by the shrine task (combat
 *   with ≥3 enchanted cards).
 * - Rewards recipe_splinter_bolt / recipe_crystal_shield: the shrine task
 *   adds those RecipeDefs; the unlock ids are reserved here.
 */
import type { BuildingSlotId } from './buildings';
import type { ResourceId } from './resources';

export type NpcId = 'lumen' | 'maro' | 'tilda' | 'bruna' | 'orin' | 'piya';

/** Declarative arrival trigger (docs/09: Ankunft durch Taten). */
export type NpcArrivalTrigger =
  | { kind: 'always' }
  | { kind: 'building'; slot: BuildingSlotId; stage: number }
  | { kind: 'npcRescued'; npc: NpcId }
  | { kind: 'flag'; flag: string };

/**
 * Declarative quest requirement. `items` are handed over at turn-in
 * (deducted from the inventory); `flag`/`building` are checked only;
 * `none` marks pure dialog quests (turn-in on the next talk).
 */
export type QuestRequirement =
  | { kind: 'items'; items: readonly { resource: ResourceId; amount: number }[] }
  | { kind: 'flag'; flag: string }
  | { kind: 'building'; slot: BuildingSlotId; stage: number }
  | { kind: 'none' };

/**
 * Declarative quest reward. XP and the friendship step (+1) are NOT listed
 * per quest — they follow uniformly from the stage (docs/09 Freundschafts-
 * regeln + Quest-Typen-Tabelle).
 */
export type QuestReward =
  | { kind: 'recipe'; recipeId: string }
  | { kind: 'talisman'; talismanId: string }
  | { kind: 'flag'; flag: string };

export interface QuestDef {
  id: string;
  npcId: NpcId;
  /** 1-based position in the chain — XP via questConfig.xpByStage. */
  stage: 1 | 2 | 3;
  requirement: QuestRequirement;
  rewards: readonly QuestReward[];
  /**
   * Extra availability gates BEYOND the chain order (previous stage done).
   * Used for the "nach Reinigung" quests (docs/09 Bruna 3 / Orin 3).
   */
  availability?: readonly QuestRequirement[];
  /** Dialog ids (data/dialogs) for the three quest talk states. */
  dialogs: { offer: string; reminder: string; turnIn: string };
}

export interface NpcDef {
  id: NpcId;
  arrivalTrigger: NpcArrivalTrigger;
  /** Building the NPC moves into (docs/09) — informational for UI/world. */
  buildingSlot?: BuildingSlotId;
  questChain: readonly QuestDef[];
  /** Recipes this NPC teaches over the chain (docs/09: Lektionen). */
  teaches?: readonly string[];
  /**
   * Story flag set by the arrival dialog — until it is set, talking to the
   * NPC plays `dialogs.arrival` (first-meeting flow, core/quests).
   */
  metFlag: string;
  dialogs: { arrival: string; default: string };
}

/** Quest balancing (docs/09: St. 1 = 30, St. 2 = 50, St. 3 = 80 XP). */
export const questConfig = {
  xpByStage: [30, 50, 80] as const,
} as const;

export const npcs: readonly NpcDef[] = [
  {
    // Lumen (Kristallfuchs) — Mentor, KEINE Freundschaftsstufen (docs/09).
    id: 'lumen',
    arrivalTrigger: { kind: 'always' },
    questChain: [],
    // lumen_intro already ships the met flag (M5 dialog task) — reused.
    metFlag: 'lumen_greeted',
    dialogs: { arrival: 'lumen_intro', default: 'lumen_default' },
  },
  {
    // Maro (Schmied) — Ankunft: Schmiede-Ruine repariert (docs/09). B3
    // Stufe 1 ist vorgebaut (data/buildings, beat6-Gate kommt mit M6) —
    // bis dahin ist Maro faktisch von Beginn an da.
    id: 'maro',
    arrivalTrigger: { kind: 'building', slot: 'b3', stage: 1 },
    buildingSlot: 'b3',
    teaches: ['recipe_heavy_blow', 'recipe_armor_breaker'],
    metFlag: 'met_maro',
    dialogs: { arrival: 'maro_arrival', default: 'maro_default' },
    questChain: [
      {
        // „Mein altes Werkzeug" — Kiste am Strandwrack bergen (Quest-
        // Sammelpunkt, data questCollectNodes) → Rezept Schwerer Hieb;
        // Freundschaft 1 schaltet zugleich Schmiede St. 2 frei (docs/09 B3).
        id: 'maro_1',
        npcId: 'maro',
        stage: 1,
        requirement: { kind: 'items', items: [{ resource: 'old_tools', amount: 1 }] },
        rewards: [{ kind: 'recipe', recipeId: 'recipe_heavy_blow' }],
        dialogs: { offer: 'maro_1_offer', reminder: 'maro_1_reminder', turnIn: 'maro_1_done' },
      },
      {
        // „Käferpanzer" — 3 Käferpanzer (Kupferkäfer-Chance-Drop, docs/07).
        id: 'maro_2',
        npcId: 'maro',
        stage: 2,
        requirement: { kind: 'items', items: [{ resource: 'beetle_shell', amount: 3 }] },
        rewards: [{ kind: 'recipe', recipeId: 'recipe_armor_breaker' }],
        dialogs: { offer: 'maro_2_offer', reminder: 'maro_2_reminder', turnIn: 'maro_2_done' },
      },
      {
        // „Das Meisterstück" — 1 Herzdorn (Elite-Drop) → Amboss-Herz.
        id: 'maro_3',
        npcId: 'maro',
        stage: 3,
        requirement: { kind: 'items', items: [{ resource: 'heart_thorn', amount: 1 }] },
        rewards: [{ kind: 'talisman', talismanId: 'anvil_heart' }],
        dialogs: { offer: 'maro_3_offer', reminder: 'maro_3_reminder', turnIn: 'maro_3_done' },
      },
    ],
  },
  {
    // Tilda (Köchin) — Ankunft: Wohnhaus 1 gebaut (docs/09 B4).
    id: 'tilda',
    arrivalTrigger: { kind: 'building', slot: 'b4', stage: 1 },
    buildingSlot: 'b4',
    teaches: ['recipe_pumpkin_stew', 'recipe_chili_skewer'],
    metFlag: 'met_tilda',
    dialogs: { arrival: 'tilda_arrival', default: 'tilda_default' },
    questChain: [
      {
        id: 'tilda_1',
        npcId: 'tilda',
        stage: 1,
        requirement: {
          kind: 'items',
          items: [
            { resource: 'berry', amount: 5 },
            { resource: 'meat', amount: 2 },
          ],
        },
        rewards: [{ kind: 'recipe', recipeId: 'recipe_pumpkin_stew' }],
        dialogs: { offer: 'tilda_1_offer', reminder: 'tilda_1_reminder', turnIn: 'tilda_1_done' },
      },
      {
        // 3 Fische — braucht Steg/Bruna (docs/09: NPC-Vernetzung); Angeln
        // liefert Fische ab M5 Task 4.
        id: 'tilda_2',
        npcId: 'tilda',
        stage: 2,
        requirement: { kind: 'items', items: [{ resource: 'fish', amount: 3 }] },
        rewards: [{ kind: 'recipe', recipeId: 'recipe_chili_skewer' }],
        dialogs: { offer: 'tilda_2_offer', reminder: 'tilda_2_reminder', turnIn: 'tilda_2_done' },
      },
      {
        // Seltener Honig — quest-gespawnter Sammelpunkt auf der Wiese
        // (docs/09: erscheint nur solange die Quest aktiv ist).
        id: 'tilda_3',
        npcId: 'tilda',
        stage: 3,
        requirement: { kind: 'items', items: [{ resource: 'honey', amount: 1 }] },
        rewards: [{ kind: 'talisman', talismanId: 'warm_belly' }],
        dialogs: { offer: 'tilda_3_offer', reminder: 'tilda_3_reminder', turnIn: 'tilda_3_done' },
      },
    ],
  },
  {
    // Bruna (alte Fischerin) — Ankunft: Steg gebaut (docs/09 B5).
    id: 'bruna',
    arrivalTrigger: { kind: 'building', slot: 'b5', stage: 1 },
    buildingSlot: 'b5',
    teaches: ['recipe_counter_stance', 'recipe_riposte'],
    metFlag: 'met_bruna',
    dialogs: { arrival: 'bruna_arrival', default: 'bruna_default' },
    questChain: [
      {
        // „Alte Netze" — 4 Ranken (Kriecher-Drops).
        id: 'bruna_1',
        npcId: 'bruna',
        stage: 1,
        requirement: { kind: 'items', items: [{ resource: 'vine', amount: 4 }] },
        rewards: [{ kind: 'recipe', recipeId: 'recipe_counter_stance' }],
        dialogs: { offer: 'bruna_1_offer', reminder: 'bruna_1_reminder', turnIn: 'bruna_1_done' },
      },
      {
        // „Der Riesenwels" — Angel-Quest: das Flag setzt der Angel-Task
        // (M5 Task 4; 5. Fang während aktiver Quest, docs/09).
        id: 'bruna_2',
        npcId: 'bruna',
        stage: 2,
        requirement: { kind: 'flag', flag: 'giant_catfish_caught' },
        rewards: [{ kind: 'recipe', recipeId: 'recipe_riposte' }],
        dialogs: { offer: 'bruna_2_offer', reminder: 'bruna_2_reminder', turnIn: 'bruna_2_done' },
      },
      {
        // „Brunas Geschichte" — Dialog-Quest nach der Reinigung (docs/09).
        id: 'bruna_3',
        npcId: 'bruna',
        stage: 3,
        requirement: { kind: 'none' },
        availability: [{ kind: 'flag', flag: 'island_cleansed' }],
        rewards: [{ kind: 'talisman', talismanId: 'sailors_yarn' }],
        dialogs: { offer: 'bruna_3_offer', reminder: 'bruna_3_reminder', turnIn: 'bruna_3_done' },
      },
    ],
  },
  {
    // Orin (Einsiedler-Magier) — Ankunft: im Dungeon befreit (docs/09);
    // steht am Dorfplatz, bis Wohnhaus 2 (B7) steht.
    id: 'orin',
    arrivalTrigger: { kind: 'npcRescued', npc: 'orin' },
    buildingSlot: 'b7',
    teaches: ['recipe_splinter_bolt', 'recipe_crystal_shield'],
    metFlag: 'met_orin',
    dialogs: { arrival: 'orin_arrival', default: 'orin_default' },
    questChain: [
      {
        // Schrein errichten (B6, 10 Schattenstaub) → Rezept Splitterblitz.
        // Das RezeptDef selbst kommt mit dem Schrein-Task — hier wird nur
        // die Freischaltung (unlockedRecipes) vergeben.
        id: 'orin_1',
        npcId: 'orin',
        stage: 1,
        requirement: { kind: 'building', slot: 'b6', stage: 1 },
        rewards: [{ kind: 'recipe', recipeId: 'recipe_splinter_bolt' }],
        dialogs: { offer: 'orin_1_offer', reminder: 'orin_1_reminder', turnIn: 'orin_1_done' },
      },
      {
        // „Resonanzprobe" — 1 Kampf mit ≥3 verzauberten Karten; das Flag
        // setzt der Schrein-Task (Verzaubern existiert dort erst).
        id: 'orin_2',
        npcId: 'orin',
        stage: 2,
        requirement: { kind: 'flag', flag: 'resonance_test_passed' },
        rewards: [{ kind: 'flag', flag: 'card_upgrades_unlocked' }],
        dialogs: { offer: 'orin_2_offer', reminder: 'orin_2_reminder', turnIn: 'orin_2_done' },
      },
      {
        // Nach der Reinigung: Rezept Kristallschild (RecipeDef im Schrein-Task).
        id: 'orin_3',
        npcId: 'orin',
        stage: 3,
        requirement: { kind: 'none' },
        availability: [{ kind: 'flag', flag: 'island_cleansed' }],
        rewards: [{ kind: 'recipe', recipeId: 'recipe_crystal_shield' }],
        dialogs: { offer: 'orin_3_offer', reminder: 'orin_3_reminder', turnIn: 'orin_3_done' },
      },
    ],
  },
  {
    // Piya (Händlerin) — Ankunft: Insel gereinigt, Boot am Strand (docs/09).
    id: 'piya',
    arrivalTrigger: { kind: 'flag', flag: 'island_cleansed' },
    buildingSlot: 'b8',
    metFlag: 'met_piya',
    dialogs: { arrival: 'piya_arrival', default: 'piya_default' },
    questChain: [
      {
        // Boot-Reparatur 1 — 10 Holz + 4 Zähes Leder (docs/09/10 Fix:
        // kein Hartholz, das ist Insel-2-Material).
        id: 'piya_1',
        npcId: 'piya',
        stage: 1,
        requirement: {
          kind: 'items',
          items: [
            { resource: 'wood', amount: 10 },
            { resource: 'tough_leather', amount: 4 },
          ],
        },
        rewards: [],
        dialogs: { offer: 'piya_1_offer', reminder: 'piya_1_reminder', turnIn: 'piya_1_done' },
      },
      {
        // Boot-Reparatur 2 — 5 Harz (Kriecher-Chance-Drop).
        id: 'piya_2',
        npcId: 'piya',
        stage: 2,
        requirement: { kind: 'items', items: [{ resource: 'resin', amount: 5 }] },
        rewards: [],
        dialogs: { offer: 'piya_2_offer', reminder: 'piya_2_reminder', turnIn: 'piya_2_done' },
      },
      {
        // Probefahrt (Dialog-Quest) → piya_chain_complete schaltet B9
        // (Bootshaus) frei; Insel 2 bleibt in V1 gesperrt (docs/09).
        id: 'piya_3',
        npcId: 'piya',
        stage: 3,
        requirement: { kind: 'none' },
        rewards: [{ kind: 'flag', flag: 'piya_chain_complete' }],
        dialogs: { offer: 'piya_3_offer', reminder: 'piya_3_reminder', turnIn: 'piya_3_done' },
      },
    ],
  },
];

export const npcsById: Readonly<Record<string, NpcDef>> = Object.fromEntries(
  npcs.map((n) => [n.id, n]),
);

export const allQuests: readonly QuestDef[] = npcs.flatMap((n) => n.questChain);

export const questsById: Readonly<Record<string, QuestDef>> = Object.fromEntries(
  allQuests.map((q) => [q.id, q]),
);

/**
 * Standing spots (16 px tiles) — near the building each NPC belongs to
 * (data/buildings coordinates); placeholder until real map dressing.
 */
export const npcPlacements: Readonly<Record<NpcId, { tileX: number; tileY: number }>> = {
  lumen: { tileX: 28, tileY: 20 },
  maro: { tileX: 19, tileY: 15 },
  tilda: { tileX: 15, tileY: 18 },
  bruna: { tileX: 13, tileY: 22 },
  orin: { tileX: 26, tileY: 18 },
  piya: { tileX: 20, tileY: 22 },
};

/**
 * Quest-spawned collect points (docs/09: Honig-Sammelpunkt auf der Wiese;
 * Maros Werkzeugkiste am Strandwrack). Visible ONLY while the quest is
 * active and the item is still missing (rule in core/quests) — density-
 * independent, so chains stay completable after the cleansing.
 */
export interface QuestCollectNode {
  id: string;
  questId: string;
  resource: ResourceId;
  amount: number;
  tileX: number;
  tileY: number;
}

export const questCollectNodes: readonly QuestCollectNode[] = [
  {
    id: 'quest-maro-toolbox',
    questId: 'maro_1',
    resource: 'old_tools',
    amount: 1,
    tileX: 6,
    tileY: 21,
  },
  {
    id: 'quest-tilda-honey',
    questId: 'tilda_3',
    resource: 'honey',
    amount: 1,
    tileX: 25,
    tileY: 12,
  },
];
