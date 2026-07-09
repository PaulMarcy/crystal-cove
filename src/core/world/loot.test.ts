import { describe, expect, it } from 'vitest';
import type { Rng } from '../combat/rng';
import type { EnemyDef } from '../combat/types';
import { rollLoot } from './loot';

/** RNG that replays a fixed sequence (then repeats the last value). */
function seq(values: number[]): Rng {
  let i = 0;
  return () => values[Math.min(i++, values.length - 1)]!;
}

const rat: EnemyDef = {
  id: 'rat',
  name: 'Ratte',
  tier: 1,
  hp: 1,
  pattern: { kind: 'cycle', steps: [] },
  loot: {
    guaranteed: [
      { item: 'fiber', min: 1, max: 2 },
      { item: 'dust', min: 1, max: 1 },
    ],
    chance: [{ item: 'berry', min: 1, max: 1, p: 0.3 }],
  },
};

describe('rollLoot', () => {
  it('drops guaranteed loot with uniform amounts and rolls chance drops', () => {
    // amount fiber → 0.99 ⇒ 2; amount dust ⇒ 1; chance 0.2 < 0.3 hit; amount 1.
    const loot = rollLoot([rat], 0, seq([0.99, 0, 0.2, 0]));
    expect(loot).toEqual({ fiber: 2, dust: 1, berry: 1 });
  });

  it('omits failed chance drops but keeps the RNG stream stable', () => {
    const loot = rollLoot([rat], 0, seq([0, 0, 0.9, 0]));
    expect(loot).toEqual({ fiber: 1, dust: 1 });
  });

  it('stacks loot across multiple enemies', () => {
    const loot = rollLoot([rat, rat], 0, seq([0, 0, 0.9, 0, 0.99, 0, 0.9, 0]));
    expect(loot).toEqual({ fiber: 3, dust: 2 });
  });

  it('density 3 doubles amounts and adds +20pp to chance drops (docs/07)', () => {
    // chance roll 0.45 fails at p=0.3 but hits at 0.5.
    const loot = rollLoot([rat], 3, seq([0, 0, 0.45, 0]));
    expect(loot).toEqual({ fiber: 2, dust: 2, berry: 2 });
  });

  it('handles enemies without loot definitions', () => {
    const bare: EnemyDef = {
      id: 'bare',
      name: 'Ohne Beute',
      tier: 1,
      hp: 1,
      pattern: { kind: 'cycle', steps: [] },
    };
    expect(rollLoot([bare], 0, seq([0]))).toEqual({});
  });
});
