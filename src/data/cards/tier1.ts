/**
 * Tier-1 card roster (Heimatbucht): starter deck (docs/03) plus all forge,
 * kitchen and shrine cards from docs/10, and the status cards from docs/03.
 *
 * IDs are English snake_case; German display names come from strings.ts.
 * Build purpose of each card is noted inline (docs/10 economy rules).
 *
 * Open points (deliberately NOT hacked into the DSL, see CLAUDE.md rule 4):
 * - Riposte: "+6 falls diese Runde geblockt" needs a conditional effect kind
 *   → core-engineer task; shipped here with its base effect (6 damage) only.
 * - Card upgrades (Karte+, docs/10 shrine): no upgrade field exists on
 *   CardDef → not representable as pure data today; shrine is M3 anyway.
 */
import type { CardDef } from '../../core/combat/types';
import { strings } from '../../shared/strings';

// ── Starter deck (docs/03) ───────────────────────────────────────────────

/** Baseline attack; scales with tool tier (docs/05: 6 → 8 at tier 2). */
export const axeStrike: CardDef = {
  id: 'axe_strike',
  name: strings.cards.axe_strike.name,
  type: 'attack',
  cost: 1,
  school: 'basics',
  effects: [{ kind: 'damage', amount: { base: 6, scaling: 'toolTier' }, target: 'target' }],
};

/** Baseline defense. */
export const woodenShield: CardDef = {
  id: 'wooden_shield',
  name: strings.cards.wooden_shield.name,
  type: 'skill',
  cost: 1,
  school: 'basics',
  effects: [{ kind: 'block', amount: 5, target: 'self' }],
};

/** Zero-cost chip damage — teaches energy economy. */
export const stoneThrow: CardDef = {
  id: 'stone_throw',
  name: strings.cards.stone_throw.name,
  type: 'attack',
  cost: 0,
  school: 'basics',
  effects: [{ kind: 'damage', amount: 3, target: 'target' }],
};

/** Card flow — smooths bad hands. */
export const catchBreath: CardDef = {
  id: 'catch_breath',
  name: strings.cards.catch_breath.name,
  type: 'skill',
  cost: 1,
  school: 'basics',
  effects: [{ kind: 'draw', amount: 2 }],
};

/** Kitchen stage 1 — sustain; consumed on use. */
export const berrySnack: CardDef = {
  id: 'berry_snack',
  name: strings.cards.berry_snack.name,
  type: 'dish',
  cost: 0,
  effects: [{ kind: 'heal', amount: 5, target: 'self' }],
};

// ── Forge (docs/10 Schmiede) ─────────────────────────────────────────────

/** Onboarding forge card — cheap damage plus card flow. */
export const sparkStrike: CardDef = {
  id: 'spark_strike',
  name: strings.cards.spark_strike.name,
  type: 'attack',
  cost: 1,
  school: 'forge',
  effects: [
    { kind: 'damage', amount: 4, target: 'target' },
    { kind: 'draw', amount: 1 },
  ],
};

/** Maro chain 1 — burst against tempo enemies (blighted_boar lesson). */
export const heavyBlow: CardDef = {
  id: 'heavy_blow',
  name: strings.cards.heavy_blow.name,
  type: 'attack',
  cost: 2,
  school: 'forge',
  effects: [{ kind: 'damage', amount: 10, target: 'target' }],
};

/** Efficient block upgrade over Holzschild. */
export const stoneWall: CardDef = {
  id: 'stone_wall',
  name: strings.cards.stone_wall.name,
  type: 'skill',
  cost: 1,
  school: 'forge',
  effects: [{ kind: 'block', amount: 7, target: 'self' }],
};

/** Zero-cost tempo attack — enables multi-card turns. */
export const throwingAxe: CardDef = {
  id: 'throwing_axe',
  name: strings.cards.throwing_axe.name,
  type: 'attack',
  cost: 0,
  school: 'forge',
  effects: [{ kind: 'damage', amount: 4, target: 'target' }],
};

/** Maro chain 2 — answers block-heavy enemies (copper_beetle lesson). */
export const armorBreaker: CardDef = {
  id: 'armor_breaker',
  name: strings.cards.armor_breaker.name,
  type: 'attack',
  cost: 1,
  school: 'forge',
  effects: [{ kind: 'damage', amount: 6, target: 'target', ignoresBlock: true }],
};

/** Multi-hit — scales double with strength (Chili-Spieß synergy). */
export const doubleStrike: CardDef = {
  id: 'double_strike',
  name: strings.cards.double_strike.name,
  type: 'attack',
  cost: 1,
  school: 'forge',
  effects: [{ kind: 'damage', amount: 4, target: 'target', times: 2 }],
};

/** Bruna chain 1 — block plus retaliation (counter school). */
export const counterStance: CardDef = {
  id: 'counter_stance',
  name: strings.cards.counter_stance.name,
  type: 'skill',
  cost: 1,
  school: 'counter',
  effects: [
    { kind: 'block', amount: 4, target: 'self' },
    { kind: 'applyStatus', status: 'retaliate', amount: 3, target: 'self' },
  ],
};

/**
 * Bruna chain 2 — counter-attack payoff. Base effect only:
 * the "+6 falls diese Runde geblockt" condition is an open DSL gap.
 */
export const riposte: CardDef = {
  id: 'riposte',
  name: strings.cards.riposte.name,
  type: 'attack',
  cost: 1,
  school: 'counter',
  effects: [{ kind: 'damage', amount: 6, target: 'target' }],
};

// ── Kitchen dishes (docs/10 Küche — consumables) ─────────────────────────

/** Tilda chain 1 — bigger heal for dungeon runs. */
export const pumpkinStew: CardDef = {
  id: 'pumpkin_stew',
  name: strings.cards.pumpkin_stew.name,
  type: 'dish',
  cost: 0,
  effects: [{ kind: 'heal', amount: 8, target: 'self' }],
};

/** Tilda chain 2 — combat-long strength buff (multi-hit synergy). */
export const chiliSkewer: CardDef = {
  id: 'chili_skewer',
  name: strings.cards.chili_skewer.name,
  type: 'dish',
  cost: 0,
  effects: [{ kind: 'applyStatus', status: 'strength', amount: 2, target: 'self' }],
};

/** Heal without losing card flow. */
export const friedFish: CardDef = {
  id: 'fried_fish',
  name: strings.cards.fried_fish.name,
  type: 'dish',
  cost: 0,
  effects: [
    { kind: 'heal', amount: 6, target: 'self' },
    { kind: 'draw', amount: 1 },
  ],
};

// ── Crystal shrine (docs/10 Kristallschrein) ─────────────────────────────

/** Shadow-dust sink — heavy hit that keeps the hand flowing. */
export const splinterBolt: CardDef = {
  id: 'splinter_bolt',
  name: strings.cards.splinter_bolt.name,
  type: 'attack',
  cost: 2,
  school: 'crystal',
  effects: [
    { kind: 'damage', amount: 8, target: 'target' },
    { kind: 'draw', amount: 1 },
  ],
};

/** Block plus energy tempo for the next card. */
export const crystalShield: CardDef = {
  id: 'crystal_shield',
  name: strings.cards.crystal_shield.name,
  type: 'skill',
  cost: 1,
  school: 'crystal',
  effects: [
    { kind: 'block', amount: 5, target: 'self' },
    { kind: 'modifyNextCardCost', amount: -1 },
  ],
};

// ── Status cards (docs/03 — unplayable, vanish at turn end) ──────────────

export const exhaustion: CardDef = {
  id: 'exhaustion',
  name: strings.cards.exhaustion.name,
  type: 'status',
  cost: 0,
  effects: [],
};

export const dazed: CardDef = {
  id: 'dazed',
  name: strings.cards.dazed.name,
  type: 'status',
  cost: 0,
  effects: [],
};

// ── Collections ──────────────────────────────────────────────────────────

export const allCards: readonly CardDef[] = [
  axeStrike,
  woodenShield,
  stoneThrow,
  catchBreath,
  berrySnack,
  sparkStrike,
  heavyBlow,
  stoneWall,
  throwingAxe,
  armorBreaker,
  doubleStrike,
  counterStance,
  riposte,
  pumpkinStew,
  chiliSkewer,
  friedFish,
  splinterBolt,
  crystalShield,
  exhaustion,
  dazed,
];

/** Starter deck, 12 cards (docs/03): 4× Axtschlag, 4× Holzschild, 2× Steinwurf, 1× Verschnaufen, 1× Beerensnack. */
export const starterDeck: readonly CardDef[] = [
  axeStrike,
  axeStrike,
  axeStrike,
  axeStrike,
  woodenShield,
  woodenShield,
  woodenShield,
  woodenShield,
  stoneThrow,
  stoneThrow,
  catchBreath,
  berrySnack,
];
