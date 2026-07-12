import { beforeEach, describe, expect, it } from 'vitest';
import { emptyInventory } from '../core/economy/inventory';
import { initialShadowDensity } from '../data/encounters/tier1';
import { heimatbuchtShrines, zoneMarkerId } from '../data/exploration';
import { xpSources } from '../data/progression';
import { explorationOf, gameStore } from './store';

/**
 * Store wiring tests for M4 Task 2: exploration markers, derived shadow
 * density and exploration XP (incl. Kartenkenner talent).
 */

beforeEach(() => {
  gameStore.setState({
    inventory: emptyInventory,
    harvestedNodeIds: [],
    shadowDensity: initialShadowDensity,
    discoveredMarkers: [],
    playerPosition: null,
    playerZone: null,
    combat: null,
    xp: 0,
    unlockedTalents: [],
  });
});

const shrine = heimatbuchtShrines[0]!;

describe('discoverMarker (store)', () => {
  it('grants area XP for a new zone and shrine XP for a shrine (docs/02)', () => {
    expect(gameStore.getState().discoverMarker(zoneMarkerId('strand'))).toBe(true);
    expect(gameStore.getState().xp).toBe(xpSources.areaRevealed);
    expect(gameStore.getState().discoverMarker(shrine.markerId)).toBe(true);
    expect(gameStore.getState().xp).toBe(xpSources.areaRevealed + xpSources.shrineDiscovered);
  });

  it('is idempotent — re-discovery grants nothing and changes nothing', () => {
    gameStore.getState().discoverMarker(zoneMarkerId('strand'));
    const before = gameStore.getState();
    expect(gameStore.getState().discoverMarker(zoneMarkerId('strand'))).toBe(false);
    expect(gameStore.getState().xp).toBe(before.xp);
    expect(gameStore.getState().discoveredMarkers).toBe(before.discoveredMarkers);
    expect(gameStore.getState().shadowDensity).toBe(before.shadowDensity);
  });

  it('rejects unknown markers', () => {
    expect(gameStore.getState().discoverMarker('zone:atlantis')).toBe(false);
    expect(gameStore.getState().xp).toBe(0);
  });

  it('applies the Kartenkenner multiplier (+50 %, rounded) to exploration XP', () => {
    gameStore.setState({ unlockedTalents: ['gatherers_luck', 'loot_hunter', 'map_savant'] });
    gameStore.getState().discoverMarker(zoneMarkerId('strand'));
    expect(gameStore.getState().xp).toBe(Math.round(xpSources.areaRevealed * 1.5)); // 38
  });
});

describe('derived shadow density (docs/02: 25/50/75 % → 1/2/3)', () => {
  it('rises with discoveries: 5 Heimatbucht markers → 0,1,2,3,3', () => {
    const markerIds = [
      zoneMarkerId('strand'),
      zoneMarkerId('wiese'),
      zoneMarkerId('waldrand'),
      ...heimatbuchtShrines.map((s) => s.markerId),
    ];
    const densities = markerIds.map((id) => {
      gameStore.getState().discoverMarker(id);
      return gameStore.getState().shadowDensity;
    });
    expect(densities).toEqual([0, 1, 2, 3, 3]);
    expect(explorationOf(gameStore.getState())).toBe(1);
  });

  it('never falls through further exploration (monotone)', () => {
    gameStore.getState().discoverMarker(zoneMarkerId('strand'));
    gameStore.getState().discoverMarker(zoneMarkerId('wiese'));
    const before = gameStore.getState().shadowDensity;
    gameStore.getState().discoverMarker(shrine.markerId);
    expect(gameStore.getState().shadowDensity).toBeGreaterThanOrEqual(before);
  });
});

describe('zone entry discovers the zone (setPlayerLocation)', () => {
  it('first entry grants area XP; later entries are no-ops', () => {
    gameStore.getState().setPlayerLocation({ x: 10, y: 330 }, 'strand');
    expect(gameStore.getState().discoveredMarkers).toContain(zoneMarkerId('strand'));
    expect(gameStore.getState().xp).toBe(xpSources.areaRevealed);
    gameStore.getState().setPlayerLocation({ x: 12, y: 332 }, 'strand');
    expect(gameStore.getState().xp).toBe(xpSources.areaRevealed);
  });

  it('outside all zones (null) nothing is discovered', () => {
    gameStore.getState().setPlayerLocation({ x: 0, y: 470 }, null);
    expect(gameStore.getState().discoveredMarkers).toEqual([]);
  });
});

describe('elites reachable through the derived density', () => {
  it('at density 2 an elite encounter with an affix can start (docs/07)', () => {
    // 3 discoveries → 60 % → density 2 (Wiese elite chance 15 %).
    gameStore.getState().discoverMarker(zoneMarkerId('strand'));
    gameStore.getState().discoverMarker(zoneMarkerId('wiese'));
    gameStore.getState().discoverMarker(zoneMarkerId('waldrand'));
    expect(gameStore.getState().shadowDensity).toBe(2);
    // Scan seeds until the encounter roll yields the elite.
    let found = false;
    for (let seed = 0; seed < 200 && !found; seed++) {
      expect(gameStore.getState().startEncounter('wiese', seed)).toBe(true);
      const encounter = gameStore.getState().currentEncounter!;
      if (encounter.elite) {
        expect(encounter.enemies).toEqual(['thorn_terror']);
        expect(encounter.affix).not.toBeNull();
        found = true;
      }
      gameStore.setState({ combat: null, currentEncounter: null, combatLoot: null });
    }
    expect(found).toBe(true);
  });
});
