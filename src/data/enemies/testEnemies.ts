/**
 * Minimal enemy data for combat-core tests (docs/07 excerpts).
 * The full tier-1 roster is a separate content task.
 */
import type { EnemyDef } from '../../core/combat/types';

export const shadowRat: EnemyDef = {
  id: 'shadow_rat',
  name: 'Schattenratte',
  tier: 1,
  hp: 12,
  pattern: {
    kind: 'cycle',
    steps: [
      { intent: 'attack', effects: [{ kind: 'damage', amount: 3, target: 'player' }] },
      { intent: 'attack', effects: [{ kind: 'damage', amount: 3, target: 'player' }] },
      { intent: 'attack', effects: [{ kind: 'damage', amount: 4, target: 'player' }] },
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

export const thornCreeper: EnemyDef = {
  id: 'thorn_creeper',
  name: 'Dornenkriecher',
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
      { intent: 'attack', effects: [{ kind: 'damage', amount: 5, target: 'player' }] },
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

export const copperBeetle: EnemyDef = {
  id: 'copper_beetle',
  name: 'Kupferkäfer',
  tier: 1,
  hp: 16,
  startBlock: 4,
  pattern: {
    kind: 'cycle',
    steps: [
      { intent: 'defend', effects: [{ kind: 'block', amount: 6, target: 'self' }] },
      { intent: 'attack', effects: [{ kind: 'damage', amount: 4, target: 'player' }] },
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
