/**
 * Simulator smoke tests: deterministic (same seed → same result) and
 * structurally plausible output. Balancing corridors themselves are
 * checked via the manual M1 report (n=1000), not asserted here.
 */
import { describe, expect, it } from 'vitest';
import { starterDeck } from '../src/data/cards/tier1';
import { blightedBoar, shadowRat } from '../src/data/enemies/tier1';
import { greedyPolicy, noisePolicy, runSimulation } from './simlib';

describe('headless simulator', () => {
  it('is deterministic for a fixed seed (greedy policy)', () => {
    const options = {
      deck: starterDeck,
      enemies: [blightedBoar],
      n: 10,
      baseSeed: 42,
      policy: greedyPolicy,
    };
    const a = runSimulation(options);
    const b = runSimulation(options);
    expect(a).toEqual(b);
  });

  it('is deterministic for a fixed seed (noise policy, the corridor baseline)', () => {
    const options = {
      deck: starterDeck,
      enemies: [blightedBoar],
      n: 10,
      baseSeed: 42,
      policy: noisePolicy,
    };
    const a = runSimulation(options);
    const b = runSimulation(options);
    expect(a).toEqual(b);
  });

  it('produces a plausible result structure', () => {
    const result = runSimulation({ deck: starterDeck, enemies: [shadowRat], n: 10, baseSeed: 7 });
    expect(result.n).toBe(10);
    expect(result.wins + result.defeats + result.timeouts).toBe(10);
    expect(result.winrate).toBeGreaterThanOrEqual(0);
    expect(result.winrate).toBeLessThanOrEqual(1);
    expect(result.avgTurns).toBeGreaterThan(0);
    if (result.wins > 0) {
      expect(result.avgHpOnWin).toBeGreaterThan(0);
      expect(result.avgHpOnWin).toBeLessThanOrEqual(50);
    }
  });

  it('differs across different seeds (RNG actually wired)', () => {
    const a = runSimulation({ deck: starterDeck, enemies: [blightedBoar], n: 50, baseSeed: 1 });
    const b = runSimulation({ deck: starterDeck, enemies: [blightedBoar], n: 50, baseSeed: 5000 });
    // Not identical in every field with overwhelming probability.
    expect(a.avgTurns === b.avgTurns && a.wins === b.wins && a.avgHpOnWin === b.avgHpOnWin).toBe(
      false,
    );
  });
});
