import { describe, expect, it } from 'vitest';
import { createRng } from '../../core/combat/rng';
import { rollEncounter, type ShadowDensity } from '../../core/world/encounters';
import { ZONE_IDS } from '../../core/world/zones';
import { allEnemies } from '../enemies/tier1';
import {
  densityThresholds,
  eliteAffixIds,
  eliteAffixes,
  encounterTables,
  initialShadowDensity,
} from './tier1';

const knownIds = new Set(allEnemies.map((e) => e.id));

describe('encounter tables (docs/07)', () => {
  it('covers every zone', () => {
    expect(Object.keys(encounterTables).sort()).toEqual([...ZONE_IDS].sort());
  });

  it('references only enemy ids that exist in src/data/enemies/tier1', () => {
    for (const table of Object.values(encounterTables)) {
      for (const id of table.eliteEnemies) expect(knownIds).toContain(id);
      for (const bracket of table.brackets) {
        for (const option of bracket.options) {
          expect(option.weight).toBeGreaterThan(0);
          expect(option.enemies.length).toBeGreaterThan(0);
          for (const id of option.enemies) expect(knownIds).toContain(id);
        }
      }
    }
  });

  it('has the elite chances from docs/07 per zone and density column', () => {
    const chances = (zone: keyof typeof encounterTables) =>
      encounterTables[zone].brackets.map((b) => b.eliteChance);
    expect(chances('strand')).toEqual([0, 0, 0]);
    expect(chances('wiese')).toEqual([0, 0.15, 0.3]);
    expect(chances('waldrand')).toEqual([0, 0.2, 0.35]);
  });

  it('density 0/1 brackets carry no elite chance', () => {
    for (const table of Object.values(encounterTables)) {
      expect(table.brackets[0].eliteChance).toBe(0);
    }
  });

  it('elite pool is the thorn_terror with the three docs/02 affixes', () => {
    for (const table of Object.values(encounterTables)) {
      expect(table.eliteEnemies).toEqual(['thorn_terror']);
      expect([...table.eliteAffixes].sort()).toEqual(['armored', 'draining', 'thorned']);
    }
  });
});

describe('elite affixes (docs/02)', () => {
  it('are quantified as data', () => {
    expect(eliteAffixes.armored.startBlock).toBe(10);
    // ASSUMPTION: docs/02 gives no number for Dornig — Vergeltung 2 (Dornenkriecher analog).
    expect(eliteAffixes.thorned.retaliate).toBe(2);
    expect(eliteAffixes.draining.exhaustionCards).toBe(1);
    for (const id of eliteAffixIds) {
      expect(eliteAffixes[id].name.length).toBeGreaterThan(0);
    }
  });
});

describe('density constants (docs/02)', () => {
  it('starts at 0 and rises at 25/50/75 % exploration', () => {
    expect(initialShadowDensity).toBe(0);
    expect(densityThresholds).toEqual([0.25, 0.5, 0.75]);
  });
});

describe('distribution sanity on real tables (seeded)', () => {
  it('density 0/1 never yields elites in any zone', () => {
    for (const table of Object.values(encounterTables)) {
      for (const density of [0, 1] as const satisfies readonly ShadowDensity[]) {
        const rng = createRng(1234);
        for (let i = 0; i < 500; i++) {
          expect(rollEncounter(table, density, rng).elite).toBe(false);
        }
      }
    }
  });

  it('wiese density 3 elite rate is ~30 %', () => {
    const rng = createRng(99);
    let elites = 0;
    const n = 10000;
    for (let i = 0; i < n; i++) {
      if (rollEncounter(encounterTables.wiese, 3, rng).elite) elites++;
    }
    expect(elites / n).toBeGreaterThan(0.27);
    expect(elites / n).toBeLessThan(0.33);
  });

  it('waldrand density 2 elite rate is ~20 % and elites carry an affix', () => {
    const rng = createRng(5);
    let elites = 0;
    const n = 10000;
    for (let i = 0; i < n; i++) {
      const result = rollEncounter(encounterTables.waldrand, 2, rng);
      if (result.elite) {
        elites++;
        expect(eliteAffixIds).toContain(result.affix!);
      } else {
        expect(result.affix).toBeNull();
      }
    }
    expect(elites / n).toBeGreaterThan(0.17);
    expect(elites / n).toBeLessThan(0.23);
  });

  it('strand density 0–1 picks all three options roughly equally', () => {
    const rng = createRng(2024);
    const counts = new Map<string, number>();
    const n = 9000;
    for (let i = 0; i < n; i++) {
      const key = rollEncounter(encounterTables.strand, 0, rng).enemies.join('+');
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    expect(counts.size).toBe(3);
    for (const count of counts.values()) {
      expect(count / n).toBeGreaterThan(0.3);
      expect(count / n).toBeLessThan(0.37);
    }
  });
});
