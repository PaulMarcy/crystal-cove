import { describe, expect, it } from 'vitest';
import { anvilHeart, sailorsYarn, talismansById, thornRing, warmBelly } from '../../data/talismans';
import {
  combatStartStatuses,
  equipTalisman,
  talismanCombatModifiers,
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

  it('ignores non-status descriptor kinds (M5 talismans)', () => {
    expect(combatStartStatuses(['warm_belly', 'anvil_heart', 'sailors_yarn'], defs)).toEqual({});
  });
});

describe('talismanCombatModifiers', () => {
  it('maps the docs/09 M5 talismans to their combat modifiers', () => {
    expect(warmBelly.effect).toEqual({ kind: 'combatStartHeal', amount: 3 });
    expect(anvilHeart.effect).toEqual({ kind: 'defenseCardBlockBonus', amount: 1 });
    expect(sailorsYarn.effect).toEqual({ kind: 'firstDefenseCardFree' });
    expect(talismanCombatModifiers(['warm_belly', 'anvil_heart', 'sailors_yarn'], defs)).toEqual({
      combatStartHeal: 3,
      defenseCardBlockBonus: 1,
      firstDefenseCardFree: true,
    });
  });

  it('stacks amount kinds, ignores status kinds and unknown ids', () => {
    const secondBelly: TalismanDef = {
      id: 'test_belly',
      name: 'Test',
      description: 'Test',
      effect: { kind: 'combatStartHeal', amount: 2 },
    };
    const withExtra = { ...defs, [secondBelly.id]: secondBelly };
    expect(
      talismanCombatModifiers(['warm_belly', 'test_belly', 'thorn_ring', 'gone'], withExtra),
    ).toEqual({ combatStartHeal: 5, defenseCardBlockBonus: 0, firstDefenseCardFree: false });
    expect(talismanCombatModifiers([], defs)).toEqual({
      combatStartHeal: 0,
      defenseCardBlockBonus: 0,
      firstDefenseCardFree: false,
    });
  });
});
