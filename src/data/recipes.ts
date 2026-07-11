/**
 * Crafting recipes for Schmiede (smithy) and Küche (kitchen), M3 data layer.
 * Source of truth: docs/10-oekonomie.md (Schmiede/Küche tables + Werkzeugstufen).
 * Pure data — craft/disenchant logic lives in core/economy (CLAUDE.md rule 2).
 *
 * Economy notes (docs/10):
 * - Costs follow the rarity formula (common = 4–6 gather units; the 3-unit
 *   dish recipes are consumables, priced below permanent cards by design).
 * - Disenchant = 50 % refund per ingredient line, floored, based on these
 *   base minting costs; ingredients with specialMaterial (combat drops,
 *   see resources.ts) are never refunded. That rule is enforced in core,
 *   not here — recipes only carry the base costs.
 * - stationTier 2 recipes exist as data now but are gated by workshop tier
 *   (UI shows them locked until the station is upgraded).
 */
import { strings } from '../shared/strings';
import type { ResourceId } from './resources';

export type StationId = 'smithy' | 'kitchen';

export interface RecipeIngredient {
  resource: ResourceId;
  amount: number;
}

export type RecipeOutput =
  { kind: 'card'; cardId: string } | { kind: 'toolUpgrade'; toolTier: number };

export interface RecipeDef {
  id: string;
  /** German display name (strings.ts). */
  name: string;
  station: StationId;
  /** Minimum workshop tier required to craft (docs/10 St. column). */
  stationTier: number;
  output: RecipeOutput;
  ingredients: readonly RecipeIngredient[];
}

// ── Schmiede (docs/10 Schmiede table) ────────────────────────────────────

export const smithyRecipes: readonly RecipeDef[] = [
  {
    id: 'recipe_spark_strike',
    name: strings.cards.spark_strike.name,
    station: 'smithy',
    stationTier: 1,
    output: { kind: 'card', cardId: 'spark_strike' },
    ingredients: [
      { resource: 'copper_ore', amount: 2 },
      { resource: 'wood', amount: 2 },
    ],
  },
  {
    id: 'recipe_heavy_blow',
    name: strings.cards.heavy_blow.name,
    station: 'smithy',
    stationTier: 1,
    output: { kind: 'card', cardId: 'heavy_blow' },
    ingredients: [
      { resource: 'copper_ore', amount: 3 },
      { resource: 'stone', amount: 1 },
    ],
  },
  {
    id: 'recipe_stone_wall',
    name: strings.cards.stone_wall.name,
    station: 'smithy',
    stationTier: 1,
    output: { kind: 'card', cardId: 'stone_wall' },
    ingredients: [
      { resource: 'stone', amount: 2 },
      { resource: 'wood', amount: 1 },
    ],
  },
  {
    id: 'recipe_throwing_axe',
    name: strings.cards.throwing_axe.name,
    station: 'smithy',
    stationTier: 1,
    output: { kind: 'card', cardId: 'throwing_axe' },
    ingredients: [
      { resource: 'copper_ore', amount: 2 },
      { resource: 'feather', amount: 1 },
    ],
  },
  {
    id: 'recipe_armor_breaker',
    name: strings.cards.armor_breaker.name,
    station: 'smithy',
    stationTier: 2,
    output: { kind: 'card', cardId: 'armor_breaker' },
    ingredients: [
      { resource: 'copper_ore', amount: 2 },
      { resource: 'beetle_shell', amount: 2 },
    ],
  },
  {
    id: 'recipe_double_strike',
    name: strings.cards.double_strike.name,
    station: 'smithy',
    stationTier: 2,
    output: { kind: 'card', cardId: 'double_strike' },
    ingredients: [
      { resource: 'copper_ore', amount: 4 },
      { resource: 'tough_leather', amount: 1 },
    ],
  },
  {
    id: 'recipe_counter_stance',
    name: strings.cards.counter_stance.name,
    station: 'smithy',
    stationTier: 2, // plus Bruna quest chain 1 (docs/09/10) — quest gate lives in quest data later
    output: { kind: 'card', cardId: 'counter_stance' },
    ingredients: [
      { resource: 'wood', amount: 2 },
      { resource: 'vine', amount: 2 },
    ],
  },
  {
    id: 'recipe_riposte',
    name: strings.cards.riposte.name,
    station: 'smithy',
    stationTier: 2, // plus Bruna quest chain 2 (docs/09/10)
    output: { kind: 'card', cardId: 'riposte' },
    ingredients: [
      { resource: 'copper_ore', amount: 2 },
      { resource: 'vine', amount: 2 },
    ],
  },
  // Werkzeugstufe 2 „Verstärkt" (docs/10 Werkzeugstufen): Axtschlag 6→8, Ernten +1
  {
    id: 'recipe_tool_reinforced',
    name: strings.recipes.tool_reinforced.name,
    station: 'smithy',
    stationTier: 1, // craftable at smithy 1 via Maro (docs/10: "3 Kupfer + 2 Leder (Maro)")
    output: { kind: 'toolUpgrade', toolTier: 2 },
    ingredients: [
      { resource: 'copper_ore', amount: 3 },
      { resource: 'tough_leather', amount: 2 },
    ],
  },
];

// ── Küche (docs/10 Küche table — dishes are consumables) ─────────────────

export const kitchenRecipes: readonly RecipeDef[] = [
  {
    id: 'recipe_berry_snack',
    name: strings.cards.berry_snack.name,
    station: 'kitchen',
    stationTier: 1,
    output: { kind: 'card', cardId: 'berry_snack' },
    ingredients: [{ resource: 'berry', amount: 3 }],
  },
  {
    id: 'recipe_pumpkin_stew',
    name: strings.cards.pumpkin_stew.name,
    station: 'kitchen',
    stationTier: 1, // Tilda chain 1 (docs/10)
    output: { kind: 'card', cardId: 'pumpkin_stew' },
    ingredients: [
      { resource: 'pumpkin', amount: 1 },
      { resource: 'meat', amount: 1 },
    ],
  },
  {
    id: 'recipe_chili_skewer',
    name: strings.cards.chili_skewer.name,
    station: 'kitchen',
    stationTier: 2, // Tilda chain 2 (docs/10)
    output: { kind: 'card', cardId: 'chili_skewer' },
    ingredients: [
      { resource: 'chili', amount: 1 },
      { resource: 'meat', amount: 2 },
    ],
  },
  {
    id: 'recipe_fried_fish',
    name: strings.cards.fried_fish.name,
    station: 'kitchen',
    stationTier: 2,
    output: { kind: 'card', cardId: 'fried_fish' },
    ingredients: [{ resource: 'fish', amount: 2 }],
  },
];

export const allRecipes: readonly RecipeDef[] = [...smithyRecipes, ...kitchenRecipes];
