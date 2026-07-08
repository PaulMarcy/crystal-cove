import { describe, expect, it } from 'vitest';
import {
  harvestNodeTypes,
  heimatbuchtHarvestNodes,
  HARVEST_NODE_TYPES,
} from './resources';

describe('resource data', () => {
  it('every node type has a positive yield', () => {
    for (const type of HARVEST_NODE_TYPES) {
      expect(harvestNodeTypes[type].yield).toBeGreaterThan(0);
    }
  });

  it('node placements have unique ids', () => {
    const ids = heimatbuchtHarvestNodes.map((n) => n.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('placements stay inside the Heimatbucht map bounds (40x30 tiles)', () => {
    for (const n of heimatbuchtHarvestNodes) {
      expect(n.tileX).toBeGreaterThanOrEqual(0);
      expect(n.tileX).toBeLessThan(40);
      expect(n.tileY).toBeGreaterThanOrEqual(0);
      expect(n.tileY).toBeLessThan(30);
    }
  });

  it('all four gatherable resources are reachable on the map', () => {
    const resources = new Set(
      heimatbuchtHarvestNodes.map((n) => harvestNodeTypes[n.type].resource),
    );
    expect(resources).toEqual(new Set(['wood', 'stone', 'copper_ore', 'berry']));
  });
});
