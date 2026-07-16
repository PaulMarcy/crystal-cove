/**
 * Gatherable resources & harvest-node placements (Heimatbucht, M2).
 * Pure data — logic lives in core/economy (CLAUDE.md rule 2).
 *
 * Sources per docs/10 (Ressourcenkatalog Tier 1, Sammeln):
 * Holz, Stein, Kupfererz, Beeren. Yields are not specified in docs/10 —
 * chosen so one node ≈ one crafting ingredient batch (assumption, tune here).
 * No respawn timers by design (docs/10: no real-time cycle); replenishing on
 * sleep is a later milestone.
 */

export const GATHERABLE_RESOURCE_IDS = ['wood', 'stone', 'copper_ore', 'berry'] as const;
export type GatherableResourceId = (typeof GATHERABLE_RESOURCE_IDS)[number];

// ── Full tier-1 resource catalog (docs/10 Ressourcenkatalog) ─────────────
// `specialMaterial: true` = combat drop; per docs/10 disenchant rule these
// are NEVER refunded. Gathering/farming/fishing resources are refundable.

export const RESOURCE_IDS = [
  // Sammeln / Farming (docs/10)
  'wood',
  'stone',
  'copper_ore',
  'berry',
  'pumpkin',
  'chili',
  'honey',
  // Angeln (Steg)
  'fish',
  // Quest-Gegenstände (M5, docs/09: Maros Werkzeugkiste am Strandwrack) —
  // quest-gespawnte Sammelpunkte (data/npcs questCollectNodes), kein
  // Kampf-Drop und nie Rezept-Zutat.
  'old_tools',
  // Kampf-Drops (= Spezialmaterial, nie erstattet)
  'shadow_fiber',
  'tough_leather',
  'meat',
  'vine',
  'resin',
  'beetle_shell',
  'feather',
  'shiny_trinket',
  'heart_thorn',
  'shadow_dust',
] as const;
export type ResourceId = (typeof RESOURCE_IDS)[number];

export interface ResourceDef {
  id: ResourceId;
  /** Combat drop per docs/10 — never refunded on disenchant. */
  specialMaterial: boolean;
}

const COMBAT_DROP_IDS: readonly ResourceId[] = [
  'shadow_fiber',
  'tough_leather',
  'meat',
  'vine',
  'resin',
  'beetle_shell',
  'feather',
  'shiny_trinket',
  'heart_thorn',
  'shadow_dust',
];

export const resources: Readonly<Record<ResourceId, ResourceDef>> = Object.fromEntries(
  RESOURCE_IDS.map((id) => [id, { id, specialMaterial: COMBAT_DROP_IDS.includes(id) }]),
) as Record<ResourceId, ResourceDef>;

export const HARVEST_NODE_TYPES = ['tree', 'rock', 'copper_vein', 'berry_bush'] as const;
export type HarvestNodeType = (typeof HARVEST_NODE_TYPES)[number];

export interface HarvestNodeTypeDef {
  resource: GatherableResourceId;
  /** Units gained per harvest (tool tier 2 adds +1 later, docs/10). */
  yield: number;
}

export const harvestNodeTypes: Readonly<Record<HarvestNodeType, HarvestNodeTypeDef>> = {
  tree: { resource: 'wood', yield: 2 },
  rock: { resource: 'stone', yield: 2 },
  copper_vein: { resource: 'copper_ore', yield: 2 },
  berry_bush: { resource: 'berry', yield: 3 }, // 3 = one Beerensnack (docs/10)
};

export interface HarvestNodePlacement {
  id: string;
  type: HarvestNodeType;
  /** Tile coordinates on the Heimatbucht map (16 px tiles). */
  tileX: number;
  tileY: number;
}

/**
 * Zone-appropriate placement (docs/04 palette zones, docs/10 catalog):
 * trees + copper veins at the Waldrand (rows 2–4, near the rock outcrop),
 * rocks and berry bushes on the Wiese. Docs do not pin resources to zones
 * explicitly — placement follows the biome logic (assumption, see report).
 */
export const heimatbuchtHarvestNodes: readonly HarvestNodePlacement[] = [
  { id: 'hb-tree-1', type: 'tree', tileX: 5, tileY: 3 },
  { id: 'hb-tree-2', type: 'tree', tileX: 14, tileY: 2 },
  { id: 'hb-tree-3', type: 'tree', tileX: 24, tileY: 3 },
  { id: 'hb-tree-4', type: 'tree', tileX: 33, tileY: 2 },
  { id: 'hb-copper-1', type: 'copper_vein', tileX: 9, tileY: 4 },
  { id: 'hb-copper-2', type: 'copper_vein', tileX: 12, tileY: 4 },
  { id: 'hb-rock-1', type: 'rock', tileX: 11, tileY: 7 },
  { id: 'hb-rock-2', type: 'rock', tileX: 28, tileY: 9 },
  { id: 'hb-berry-1', type: 'berry_bush', tileX: 18, tileY: 12 },
  { id: 'hb-berry-2', type: 'berry_bush', tileX: 8, tileY: 15 },
  { id: 'hb-berry-3', type: 'berry_bush', tileX: 30, tileY: 14 },
];
