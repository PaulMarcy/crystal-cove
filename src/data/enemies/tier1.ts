/**
 * Tier-1 enemy roster (Heimatbucht) — docs/07 is the source of truth.
 * Every enemy is a lesson (noted inline); all shadow creatures drop
 * shadow_dust (shrine currency). XP is NOT stored here — it is computed
 * per encounter in core/progression (docs/07).
 */
import type { EnemyDef } from '../../core/combat/types';
import { exhaustion, rooted } from '../cards/tier1';
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
  hp: 35,
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

// ── Boss (docs/07 — M4, Dungeon „Verwachsene Höhle") ─────────────────────

/**
 * Lesson: hand economy under pressure — Verwurzelt clogs the HAND (zone
 * 'hand', vanishes at turn end), the telegraphed Erdstampfer forces block
 * planning, Rindenhaut punishes slow damage. Below 50 % HP the cycle drops
 * Rindenhaut and Erdstampfer hits 14 (Zorn-Modus, kind 'phased'/hpBelow).
 * The `emphasis` flag on Erdstampfer is the data hook for the "1 Runde
 * vorher groß telegrafiert" UI treatment (docs/07 assumption: intent
 * display handles it, no new DSL mechanic).
 * Loot: docs define no boss loot table — minimal Schattenstaub drop; the
 * Kristall/story flag is dungeon cleanup (M4 Task 4), not enemy loot.
 */
export const rootWarden: EnemyDef = {
  id: 'root_warden',
  name: strings.enemies.root_warden.name,
  tier: 1,
  hp: 90,
  pattern: {
    kind: 'phased',
    phases: [
      {
        steps: [
          {
            intent: 'deck',
            effects: [{ kind: 'addCard', card: rooted, zone: 'hand' }],
          },
          {
            intent: 'attack',
            emphasis: true,
            effects: [{ kind: 'damage', amount: 12, target: 'player' }],
          },
          {
            intent: 'defend',
            effects: [{ kind: 'block', amount: 10, target: 'self' }],
          },
        ],
      },
      {
        // Zorn-Modus (docs/07): below 50 % HP the cycle shortens.
        hpBelow: 0.5,
        steps: [
          {
            intent: 'deck',
            effects: [{ kind: 'addCard', card: rooted, zone: 'hand' }],
          },
          {
            intent: 'attack',
            emphasis: true,
            effects: [{ kind: 'damage', amount: 14, target: 'player' }],
          },
        ],
      },
    ],
  },
  loot: {
    guaranteed: [{ item: 'shadow_dust', min: 5, max: 5 }],
    chance: [],
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
  rootWarden,
  shadowRatTutorial,
  shadowMouse,
];

/** Lookup by id — used by the encounter → combat wiring (core/world). */
export const enemiesById: Readonly<Record<string, EnemyDef>> = Object.fromEntries(
  allEnemies.map((enemy) => [enemy.id, enemy]),
);
