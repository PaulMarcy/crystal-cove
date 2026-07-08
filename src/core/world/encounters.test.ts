import { describe, expect, it } from 'vitest';
import { createRng } from '../combat/rng';
import {
  densityBracketIndex,
  rollEncounter,
  type ShadowDensity,
  type ZoneEncounterTable,
} from './encounters';

const table: ZoneEncounterTable = {
  brackets: [
    {
      options: [
        { enemies: ['a'], weight: 1 },
        { enemies: ['b', 'b'], weight: 3 },
      ],
      eliteChance: 0,
    },
    { options: [{ enemies: ['c'], weight: 1 }], eliteChance: 0.5 },
    { options: [{ enemies: ['d', 'd'], weight: 1 }], eliteChance: 1 },
  ],
  eliteEnemies: ['boss'],
  eliteAffixes: ['x', 'y', 'z'],
};

describe('densityBracketIndex', () => {
  it('maps densities to docs/07 table columns', () => {
    expect(densityBracketIndex(0)).toBe(0);
    expect(densityBracketIndex(1)).toBe(0);
    expect(densityBracketIndex(2)).toBe(1);
    expect(densityBracketIndex(3)).toBe(2);
  });
});

describe('rollEncounter', () => {
  it('is deterministic for a given seed', () => {
    const a = rollEncounter(table, 2, createRng(42));
    const b = rollEncounter(table, 2, createRng(42));
    expect(a).toEqual(b);
  });

  it('never rolls an elite at density 0 or 1, even with a rigged table', () => {
    const rigged: ZoneEncounterTable = {
      ...table,
      brackets: [
        { options: [{ enemies: ['a'], weight: 1 }], eliteChance: 1 },
        table.brackets[1],
        table.brackets[2],
      ],
    };
    for (const density of [0, 1] as const satisfies readonly ShadowDensity[]) {
      for (let seed = 0; seed < 200; seed++) {
        const result = rollEncounter(rigged, density, createRng(seed));
        expect(result.elite).toBe(false);
        expect(result.affix).toBeNull();
      }
    }
  });

  it('elite roll at eliteChance 1 always yields the elite with exactly one affix', () => {
    for (let seed = 0; seed < 100; seed++) {
      const result = rollEncounter(table, 3, createRng(seed));
      expect(result.elite).toBe(true);
      expect(result.enemies).toEqual(['boss']);
      expect(table.eliteAffixes).toContain(result.affix!);
    }
  });

  it('respects option weights (1:3 within noise)', () => {
    const rng = createRng(7);
    let singles = 0;
    const n = 10000;
    for (let i = 0; i < n; i++) {
      if (rollEncounter(table, 0, rng).enemies.length === 1) singles++;
    }
    expect(singles / n).toBeGreaterThan(0.22);
    expect(singles / n).toBeLessThan(0.28);
  });

  it('hits the elite rate of the bracket (0.5 within noise)', () => {
    const rng = createRng(11);
    let elites = 0;
    const n = 10000;
    for (let i = 0; i < n; i++) {
      if (rollEncounter(table, 2, rng).elite) elites++;
    }
    expect(elites / n).toBeGreaterThan(0.47);
    expect(elites / n).toBeLessThan(0.53);
  });
});
