import { describe, expect, it } from 'vitest';
import { createCombatState } from '../combat/reducer';
import { createRng } from '../combat/rng';
import type { Effect } from '../combat/types';
import { starterDeck } from '../../data/cards/tier1';
import { combatConfig } from '../../data/combat';
import { shadowRat, thornTerror } from '../../data/enemies/tier1';
import type { EncounterResult } from './encounters';
import {
  buildEncounterCombatSetup,
  densityMultiplier,
  scaleEnemyForDensity,
} from './encounterCombat';

const options = { playerHp: combatConfig.basePlayerHp, deck: starterDeck };

function encounter(overrides: Partial<EncounterResult> = {}): EncounterResult {
  return { enemies: ['shadow_rat'], elite: false, affix: null, ...overrides };
}

function firstDamageAmount(effects: Effect[]): number {
  const damage = effects.find((e) => e.kind === 'damage');
  if (!damage || damage.kind !== 'damage' || typeof damage.amount !== 'number') {
    throw new Error('expected plain damage amount');
  }
  return damage.amount;
}

describe('scaleEnemyForDensity', () => {
  it('returns the definition unchanged at density 0', () => {
    expect(scaleEnemyForDensity(shadowRat, 0)).toBe(shadowRat);
  });

  it('scales hp and damage by +10 % per density level, rounded', () => {
    const scaled = scaleEnemyForDensity(shadowRat, 2); // ×1.2
    expect(densityMultiplier(2)).toBeCloseTo(1.2);
    expect(scaled.hp).toBe(Math.round(12 * 1.2)); // 14
    if (scaled.pattern.kind !== 'cycle') throw new Error('expected cycle');
    expect(firstDamageAmount(scaled.pattern.steps[0]!.effects)).toBe(6); // round(5×1.2)
    expect(firstDamageAmount(scaled.pattern.steps[2]!.effects)).toBe(7); // round(6×1.2)
  });

  it('scales scaled amounts on their base and leaves block/status untouched', () => {
    const scaled = scaleEnemyForDensity(thornTerror, 3); // ×1.3
    expect(scaled.hp).toBe(Math.round(38 * 1.3)); // 49
    if (scaled.pattern.kind !== 'cycle') throw new Error('expected cycle');
    const defend = scaled.pattern.steps[0]!.effects;
    expect(defend[0]).toEqual({ kind: 'block', amount: 8, target: 'self' }); // unchanged
    expect(defend[1]).toEqual({
      kind: 'applyStatus',
      status: 'retaliate',
      amount: 3,
      target: 'self',
    }); // unchanged
    expect(firstDamageAmount(scaled.pattern.steps[1]!.effects)).toBe(9); // round(7×1.3)
  });

  it('does not mutate the original definition', () => {
    scaleEnemyForDensity(shadowRat, 3);
    expect(shadowRat.hp).toBe(12);
  });
});

describe('buildEncounterCombatSetup', () => {
  it('resolves enemy ids in spawn order', () => {
    const setup = buildEncounterCombatSetup(
      encounter({ enemies: ['shadow_gull', 'shadow_rat'] }),
      0,
      options,
    );
    expect(setup.enemies.map((e) => e.id)).toEqual(['shadow_gull', 'shadow_rat']);
    expect(setup.playerHp).toBe(combatConfig.basePlayerHp);
    expect(setup.deck).toEqual([...starterDeck]);
  });

  it('throws on unknown enemy ids (data error must fail loud)', () => {
    expect(() => buildEncounterCombatSetup(encounter({ enemies: ['nope'] }), 0, options)).toThrow(
      /unknown enemy id/,
    );
  });

  it('armored elite gets extra start block on top of its own', () => {
    const setup = buildEncounterCombatSetup(
      encounter({ enemies: ['thorn_terror'], elite: true, affix: 'armored' }),
      2,
      options,
    );
    expect(setup.enemies[0]!.startBlock).toBe(10); // 0 + affix 10
    expect(setup.startDiscard).toBeUndefined();
  });

  it('thorned elite starts with retaliate stacks', () => {
    const setup = buildEncounterCombatSetup(
      encounter({ enemies: ['thorn_terror'], elite: true, affix: 'thorned' }),
      2,
      options,
    );
    expect(setup.enemies[0]!.startStatuses).toEqual({ retaliate: 2 });
  });

  it('draining elite puts Erschöpfung into the player start discard', () => {
    const setup = buildEncounterCombatSetup(
      encounter({ enemies: ['thorn_terror'], elite: true, affix: 'draining' }),
      2,
      options,
    );
    expect(setup.startDiscard?.map((c) => c.id)).toEqual(['exhaustion']);
  });

  it('affix and density flow into the combat state via the reducer', () => {
    const setup = buildEncounterCombatSetup(
      encounter({ enemies: ['thorn_terror'], elite: true, affix: 'thorned' }),
      2,
      options,
    );
    const state = createCombatState(setup, createRng(42));
    expect(state.enemies[0]!.hp).toBe(Math.round(38 * 1.2)); // 46
    expect(state.enemies[0]!.statuses.retaliate).toBe(2);
  });

  it('non-elite encounters ignore the affix field', () => {
    const setup = buildEncounterCombatSetup(
      encounter({ enemies: ['shadow_rat'], elite: false, affix: null }),
      0,
      options,
    );
    expect(setup.enemies[0]!.startBlock).toBeUndefined();
    expect(setup.startDiscard).toBeUndefined();
  });
});
