import { describe, expect, it } from 'vitest';
import { createRng } from '../combat/rng';
import { densityThresholds } from '../../data/encounters/tier1';
import { heimatbuchtExplorationMarkers, zoneMarkerId } from '../../data/exploration';
import { encounterTables } from '../../data/encounters/tier1';
import { rollEncounter } from './encounters';
import {
  densityForExploration,
  discoverMarker,
  explorationFraction,
  explorationXp,
  type ExplorationMarkerDef,
} from './exploration';

const markers: readonly ExplorationMarkerDef[] = [
  { id: 'zone:a', kind: 'area' },
  { id: 'zone:b', kind: 'area' },
  { id: 'zone:c', kind: 'area' },
  { id: 'shrine:s', kind: 'shrine' },
];

describe('discoverMarker', () => {
  it('adds a known, new marker', () => {
    expect(discoverMarker([], 'zone:a', markers)).toEqual(['zone:a']);
  });

  it('is idempotent — a second discovery returns null', () => {
    const once = discoverMarker([], 'zone:a', markers)!;
    expect(discoverMarker(once, 'zone:a', markers)).toBeNull();
  });

  it('rejects unknown marker ids', () => {
    expect(discoverMarker([], 'zone:nope', markers)).toBeNull();
  });
});

describe('explorationFraction', () => {
  it('is 0 with nothing discovered and 1 with everything', () => {
    expect(explorationFraction([], markers)).toBe(0);
    expect(
      explorationFraction(
        markers.map((m) => m.id),
        markers,
      ),
    ).toBe(1);
  });

  it('ignores stale ids from old saves (never exceeds 1)', () => {
    const all = [...markers.map((m) => m.id), 'zone:removed'];
    expect(explorationFraction(all, markers)).toBe(1);
  });

  it('grows monotonically with each discovery', () => {
    let discovered: readonly string[] = [];
    let last = 0;
    for (const m of markers) {
      discovered = discoverMarker(discovered, m.id, markers)!;
      const fraction = explorationFraction(discovered, markers);
      expect(fraction).toBeGreaterThan(last);
      last = fraction;
    }
  });

  it('is 0 for an empty marker list (no div-by-zero)', () => {
    expect(explorationFraction([], [])).toBe(0);
  });
});

describe('densityForExploration (docs/02: 25/50/75 → 1/2/3)', () => {
  it('maps fractions to densities at the thresholds', () => {
    expect(densityForExploration(0, densityThresholds)).toBe(0);
    expect(densityForExploration(0.24, densityThresholds)).toBe(0);
    expect(densityForExploration(0.25, densityThresholds)).toBe(1);
    expect(densityForExploration(0.49, densityThresholds)).toBe(1);
    expect(densityForExploration(0.5, densityThresholds)).toBe(2);
    expect(densityForExploration(0.75, densityThresholds)).toBe(3);
    expect(densityForExploration(1, densityThresholds)).toBe(3);
  });

  it('is monotone: more exploration never lowers the density', () => {
    let last = -1;
    for (let f = 0; f <= 1.001; f += 0.01) {
      const d = densityForExploration(f, densityThresholds);
      expect(d).toBeGreaterThanOrEqual(last);
      last = d;
    }
  });
});

describe('explorationXp', () => {
  const base = { area: 25, shrine: 40 } as const;

  it('returns the base XP without talent', () => {
    expect(explorationXp('area', base, 1)).toBe(25);
    expect(explorationXp('shrine', base, 1)).toBe(40);
  });

  it('applies the Kartenkenner multiplier, rounded (docs/02: +50 %)', () => {
    expect(explorationXp('area', base, 1.5)).toBe(38); // 37.5 → 38
    expect(explorationXp('shrine', base, 1.5)).toBe(60);
  });
});

describe('Heimatbucht marker data → density brackets (docs/07 reachability)', () => {
  it('reaches every density 0–3 across the 5 markers (20 % steps)', () => {
    const ids = heimatbuchtExplorationMarkers.map((m) => m.id);
    const densities = ids.map((_, i) =>
      densityForExploration(
        explorationFraction(ids.slice(0, i + 1), heimatbuchtExplorationMarkers),
        densityThresholds,
      ),
    );
    expect(densities).toEqual([0, 1, 2, 3, 3]);
    expect(ids).toContain(zoneMarkerId('wiese'));
  });

  it('elites are rollable once the derived density hits 2', () => {
    // 3 markers discovered → 60 % → density 2; Wiese bracket has 15 % elite
    // chance (docs/07). Scan seeds — at least one roll must produce an elite
    // with exactly one affix.
    const discovered = heimatbuchtExplorationMarkers.slice(0, 3).map((m) => m.id);
    const density = densityForExploration(
      explorationFraction(discovered, heimatbuchtExplorationMarkers),
      densityThresholds,
    );
    expect(density).toBe(2);
    const elite = Array.from({ length: 100 }, (_, seed) =>
      rollEncounter(encounterTables.wiese, density, createRng(seed)),
    ).find((r) => r.elite);
    expect(elite).toBeDefined();
    expect(elite!.enemies).toEqual(['thorn_terror']);
    expect(elite!.affix).not.toBeNull();
  });
});
