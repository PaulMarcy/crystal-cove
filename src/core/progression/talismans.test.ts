import { describe, expect, it } from 'vitest';
import { talismansById, thornRing } from '../../data/talismans';
import {
  combatStartStatuses,
  equipTalisman,
  unequipTalisman,
  type TalismanDef,
} from './talismans';

const secondRing: TalismanDef = {
  id: 'test_second_ring',
  name: 'Testring',
  description: 'Test',
  effect: { kind: 'combatStartStatus', status: 'retaliate', amount: 2 },
};
const defs = { ...talismansById, [secondRing.id]: secondRing };

describe('equipTalisman', () => {
  it('equips an owned talisman into a free slot', () => {
    expect(equipTalisman([], ['thorn_ring'], 'thorn_ring', 1, defs)).toEqual(['thorn_ring']);
  });

  it('refuses unknown, unowned, duplicate and slot-overflow equips', () => {
    expect(equipTalisman([], ['nope'], 'nope', 1, defs)).toBeNull(); // unknown def
    expect(equipTalisman([], [], 'thorn_ring', 1, defs)).toBeNull(); // not owned
    expect(equipTalisman(['thorn_ring'], ['thorn_ring'], 'thorn_ring', 2, defs)).toBeNull();
    // slots full (Lv < 8 → 0 slots; docs/02 milestone)
    expect(equipTalisman([], ['thorn_ring'], 'thorn_ring', 0, defs)).toBeNull();
  });
});

describe('unequipTalisman', () => {
  it('removes an equipped talisman and refuses unequipped ids', () => {
    expect(unequipTalisman(['thorn_ring'], 'thorn_ring')).toEqual([]);
    expect(unequipTalisman([], 'thorn_ring')).toBeNull();
  });
});

describe('combatStartStatuses', () => {
  it('maps the Dornenring to Vergeltung 1 (docs/07)', () => {
    expect(thornRing.effect).toEqual({ kind: 'combatStartStatus', status: 'retaliate', amount: 1 });
    expect(combatStartStatuses(['thorn_ring'], defs)).toEqual({ retaliate: 1 });
  });

  it('stacks same-status descriptors and ignores unknown ids (stale saves)', () => {
    expect(combatStartStatuses(['thorn_ring', secondRing.id, 'gone'], defs)).toEqual({
      retaliate: 3,
    });
    expect(combatStartStatuses([], defs)).toEqual({});
  });
});
