/**
 * Tier-1 enemy roster (Heimatbucht) — docs/07 is the source of truth.
 * Every enemy is a lesson (noted inline); all shadow creatures drop
 * shadow_dust (shrine currency). XP is NOT stored here — it is computed
 * per encounter in core/progression (docs/07).
 *
 * Boss (Wurzelwächter) is deliberately absent — M4 (docs/07).
 */
import type { EnemyDef } from '../../core/combat/types';
import { exhaustion } from '../cards/tier1';
import { strings } from '../../shared/strings';

// ── Normal enemies ───────────────────────────────────────────────────────

/** Lesson: baseline — pure attack cycle. */
export const shadowRat: EnemyDef = {
  id: 'shadow_rat',
  name: strings.enemies.shadow_rat.name,
  tier: 1,
  hp: 12,
  pattern: {
    kind: 'cycle',
    steps: [
      { intent: 'attack', effects: [{ kind: 'damage', amount: 5, target: 'player' }] },
      { intent: 'attack', effects: [{ kind: 'damage', amount: 5, target: 'player' }] },
      { intent: 'attack', effects: [{ kind: 'damage', amount: 6, target: 'player' }] },
    ],
  },
  loot: {
    guaranteed: [
      { item: 'shadow_fiber', min: 1, max: 2 },
      { item: 'shadow_dust', min: 1, max: 1 },
    ],
    chance: [{ item: 'berry', min: 1, max: 1, p: 0.3 }],
  },
};

/** Lesson: tempo — it buffs itself, kill it fast. */
export const blightedBoar: EnemyDef = {
  id: 'blighted_boar',
  name: strings.enemies.blighted_boar.name,
  tier: 1,
  hp: 22,
  pattern: {
    kind: 'cycle',
    steps: [
      {
        intent: 'buff',
        effects: [{ kind: 'applyStatus', status: 'strength', amount: 2, target: 'self' }],
      },
      { intent: 'attack', effects: [{ kind: 'damage', amount: 9, target: 'player' }] },
    ],
  },
  loot: {
    guaranteed: [
      { item: 'tough_leather', min: 1, max: 1 },
      { item: 'shadow_dust', min: 1, max: 1 },
    ],
    chance: [{ item: 'meat', min: 2, max: 2, p: 0.6 }],
  },
};

/** Lesson: retaliation & attack timing. */
export const thornCreeper: EnemyDef = {
  id: 'thorn_creeper',
  name: strings.enemies.thorn_creeper.name,
  tier: 1,
  hp: 18,
  pattern: {
    kind: 'cycle',
    steps: [
      {
        intent: 'defend',
        effects: [
          { kind: 'block', amount: 4, target: 'self' },
          { kind: 'applyStatus', status: 'retaliate', amount: 2, target: 'self' },
        ],
      },
      { intent: 'attack', effects: [{ kind: 'damage', amount: 8, target: 'player' }] },
      {
        intent: 'debuff',
        effects: [{ kind: 'applyStatus', status: 'weak', amount: 1, target: 'player' }],
      },
    ],
  },
  loot: {
    guaranteed: [
      { item: 'vine', min: 2, max: 2 },
      { item: 'shadow_dust', min: 1, max: 1 },
    ],
    chance: [{ item: 'resin', min: 1, max: 1, p: 0.4 }],
  },
};

/** Lesson: breaking block / burst damage. */
export const copperBeetle: EnemyDef = {
  id: 'copper_beetle',
  name: strings.enemies.copper_beetle.name,
  tier: 1,
  hp: 16,
  startBlock: 4,
  pattern: {
    kind: 'cycle',
    steps: [
      { intent: 'defend', effects: [{ kind: 'block', amount: 6, target: 'self' }] },
      { intent: 'attack', effects: [{ kind: 'damage', amount: 6, target: 'player' }] },
    ],
  },
  loot: {
    guaranteed: [
      { item: 'copper_ore', min: 1, max: 2 },
      { item: 'shadow_dust', min: 1, max: 1 },
    ],
    chance: [{ item: 'beetle_shell', min: 1, max: 1, p: 0.25 }],
  },
};

/** Lesson: debuffs & kill order in multi-enemy fights. */
export const shadowGull: EnemyDef = {
  id: 'shadow_gull',
  name: strings.enemies.shadow_gull.name,
  tier: 1,
  hp: 12,
  pattern: {
    kind: 'cycle',
    steps: [
      {
        intent: 'attack',
        effects: [{ kind: 'damage', amount: 3, target: 'player', times: 2 }],
      },
      {
        intent: 'debuff',
        effects: [{ kind: 'applyStatus', status: 'weak', amount: 1, target: 'player' }],
      },
    ],
  },
  loot: {
    guaranteed: [
      { item: 'feather', min: 2, max: 2 },
      { item: 'shadow_dust', min: 1, max: 1 },
    ],
    chance: [{ item: 'shiny_trinket', min: 1, max: 1, p: 0.2 }],
  },
};

// ── Elite ────────────────────────────────────────────────────────────────

/**
 * Lesson: everything at once — retaliation wall, burst, deck pollution.
 * Density-2+ affixes (Gepanzert/Dornig/Zehrend) are applied by the encounter
 * system (M2), not baked into this definition.
 */
export const thornTerror: EnemyDef = {
  id: 'thorn_terror',
  name: strings.enemies.thorn_terror.name,
  tier: 1,
  hp: 38,
  pattern: {
    kind: 'cycle',
    steps: [
      {
        intent: 'defend',
        effects: [
          { kind: 'block', amount: 8, target: 'self' },
          { kind: 'applyStatus', status: 'retaliate', amount: 3, target: 'self' },
        ],
      },
      {
        intent: 'attack',
        effects: [{ kind: 'damage', amount: 7, target: 'player', times: 2 }],
      },
      {
        intent: 'deck',
        effects: [{ kind: 'addCard', card: exhaustion, zone: 'discard' }],
      },
    ],
  },
  loot: {
    guaranteed: [
      { item: 'vine', min: 3, max: 3 },
      { item: 'heart_thorn', min: 1, max: 1 },
      { item: 'shadow_dust', min: 1, max: 1 },
    ],
    chance: [{ item: 'thorn_ring', min: 1, max: 1, p: 0.25 }],
  },
};

// ── Tutorial variants (docs/06 + docs/07) ────────────────────────────────

/** Tutorial fight 1: weakened rat, single repeating bite. */
export const shadowRatTutorial: EnemyDef = {
  id: 'shadow_rat_tutorial',
  name: strings.enemies.shadow_rat_tutorial.name,
  tier: 1,
  hp: 10,
  pattern: {
    kind: 'cycle',
    steps: [{ intent: 'attack', effects: [{ kind: 'damage', amount: 3, target: 'player' }] }],
  },
  loot: {
    guaranteed: [
      { item: 'shadow_fiber', min: 1, max: 1 },
      { item: 'shadow_dust', min: 1, max: 1 },
    ],
    chance: [],
  },
};

/** Tutorial fight 2 (×2): teaches intents beyond plain attacks. */
export const shadowMouse: EnemyDef = {
  id: 'shadow_mouse',
  name: strings.enemies.shadow_mouse.name,
  tier: 1,
  hp: 7,
  pattern: {
    kind: 'cycle',
    steps: [
      { intent: 'attack', effects: [{ kind: 'damage', amount: 2, target: 'player' }] },
      { intent: 'defend', effects: [{ kind: 'block', amount: 3, target: 'self' }] },
    ],
  },
  loot: {
    guaranteed: [
      { item: 'shadow_fiber', min: 1, max: 1 },
      { item: 'shadow_dust', min: 1, max: 1 },
    ],
    chance: [],
  },
};

// ── Collections ──────────────────────────────────────────────────────────

export const allEnemies: readonly EnemyDef[] = [
  shadowRat,
  blightedBoar,
  thornCreeper,
  copperBeetle,
  shadowGull,
  thornTerror,
  shadowRatTutorial,
  shadowMouse,
];
