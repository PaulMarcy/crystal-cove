/**
 * Combat-core mechanics behind the M5 talisman descriptors (docs/09):
 * combatStartHeal (Warmer Bauch), defenseCardBlockBonus (Amboss-Herz),
 * firstDefenseCardFree (Seemannsgarn). The core is talisman-agnostic —
 * these tests drive the CombatSetup fields directly.
 */
import { describe, expect, it } from 'vitest';
import { combatConfig } from '../../data/combat';
import { axeStrike, crystalShield, woodenShield } from '../../data/cards/tier1';
import { shadowRat } from '../../data/enemies/tier1';
import { isDefenseCard } from './effects';
import { combatReducer, createCombatState } from './reducer';
import { createRng } from './rng';
import { getEffectiveCost } from './view';
import type { CardDef, CombatSetup, CombatState } from './types';

function newCombat(setup: Partial<CombatSetup> = {}, seed = 42) {
  const rng = createRng(seed);
  const state = createCombatState(
    {
      playerHp: 50,
      deck: setup.deck ?? [axeStrike, woodenShield],
      enemies: [shadowRat],
      ...setup,
    },
    rng,
  );
  return { state, rng };
}

function play(state: CombatState, rng: () => number, cardId: string) {
  const card = state.hand.find((c) => c.def.id === cardId);
  if (!card) throw new Error(`card ${cardId} not in hand`);
  return combatReducer(
    state,
    {
      type: 'PLAY_CARD',
      cardInstanceId: card.instanceId,
      targetEnemyId: state.enemies[0]!.instanceId,
    },
    rng,
  );
}

/** Test-only skill that arms a −1 discount (Kristallschild's tempo half). */
const discountOnly: CardDef = {
  id: 'test_discount',
  name: 'Test-Rabatt',
  type: 'skill',
  cost: 1,
  effects: [{ kind: 'modifyNextCardCost', amount: -1 }],
};

/** Test-only 0-cost defense card (free-flag consumption edge). */
const freeShield: CardDef = {
  id: 'test_free_shield',
  name: 'Test-Gratisschild',
  type: 'skill',
  cost: 0,
  effects: [{ kind: 'block', amount: 2, target: 'self' }],
};

describe('isDefenseCard', () => {
  it('detects player-directed block effects, nothing else', () => {
    expect(isDefenseCard(woodenShield)).toBe(true);
    expect(isDefenseCard(crystalShield)).toBe(true); // block + cost tempo
    expect(isDefenseCard(axeStrike)).toBe(false);
    expect(isDefenseCard(discountOnly)).toBe(false);
    // Hypothetical enemy-directed block would NOT make a defense card.
    const blockEnemy: CardDef = {
      id: 'test_block_enemy',
      name: 'Test',
      type: 'skill',
      cost: 1,
      effects: [{ kind: 'block', amount: 3, target: 'target' }],
    };
    expect(isDefenseCard(blockEnemy)).toBe(false);
  });
});

describe('combatStartHeal (Warmer Bauch)', () => {
  it('heals at combat start when below max HP', () => {
    const { state } = newCombat({ playerHp: 40, playerMaxHp: 50, combatStartHeal: 3 });
    expect(state.player.hp).toBe(43);
  });

  it('caps the heal at max HP', () => {
    const { state } = newCombat({ playerHp: 49, playerMaxHp: 50, combatStartHeal: 3 });
    expect(state.player.hp).toBe(50);
  });

  it('does nothing when absent', () => {
    const { state } = newCombat({ playerHp: 40, playerMaxHp: 50 });
    expect(state.player.hp).toBe(40);
  });
});

describe('defenseCardBlockBonus (Amboss-Herz)', () => {
  it('adds the bonus once per defense card played', () => {
    const { state, rng } = newCombat({
      deck: [woodenShield, woodenShield],
      defenseCardBlockBonus: 1,
    });
    let s = play(state, rng, 'wooden_shield');
    expect(s.player.block).toBe(5 + 1);
    s = play(s, rng, 'wooden_shield');
    expect(s.player.block).toBe(2 * (5 + 1));
  });

  it('does not trigger on non-defense cards', () => {
    const { state, rng } = newCombat({ deck: [axeStrike], defenseCardBlockBonus: 1 });
    const s = play(state, rng, 'axe_strike');
    expect(s.player.block).toBe(0);
  });

  it('counts as card-granted block for the blocked-this-turn conditional', () => {
    const { state, rng } = newCombat({ deck: [woodenShield], defenseCardBlockBonus: 1 });
    expect(state.blockGainedThisTurn).toBe(false);
    const s = play(state, rng, 'wooden_shield');
    expect(s.blockGainedThisTurn).toBe(true);
  });
});

describe('firstDefenseCardFree (Seemannsgarn)', () => {
  it('makes only the first defense card free; the second costs normally', () => {
    const { state, rng } = newCombat({
      deck: [woodenShield, woodenShield],
      firstDefenseCardFree: true,
    });
    let s = play(state, rng, 'wooden_shield');
    expect(s.player.energy).toBe(combatConfig.energyPerTurn); // free
    expect(s.firstDefenseCardFree).toBe(false);
    s = play(s, rng, 'wooden_shield');
    expect(s.player.energy).toBe(combatConfig.energyPerTurn - woodenShield.cost);
  });

  it('does not discount non-defense cards', () => {
    const { state, rng } = newCombat({ deck: [axeStrike], firstDefenseCardFree: true });
    const s = play(state, rng, 'axe_strike');
    expect(s.player.energy).toBe(combatConfig.energyPerTurn - axeStrike.cost);
    expect(s.firstDefenseCardFree).toBe(true); // still armed
  });

  it('is consumed even by a defense card that already costs 0', () => {
    const { state, rng } = newCombat({
      deck: [freeShield, woodenShield],
      firstDefenseCardFree: true,
    });
    let s = play(state, rng, 'test_free_shield');
    expect(s.player.energy).toBe(combatConfig.energyPerTurn);
    expect(s.firstDefenseCardFree).toBe(false);
    s = play(s, rng, 'wooden_shield');
    expect(s.player.energy).toBe(combatConfig.energyPerTurn - woodenShield.cost);
  });

  it('preserves a pending cost discount (Kristallschild) for the NEXT card', () => {
    const { state, rng } = newCombat({
      deck: [discountOnly, woodenShield, axeStrike],
      firstDefenseCardFree: true,
    });
    // Arm the −1 discount (costs 1).
    let s = play(state, rng, 'test_discount');
    expect(s.player.energy).toBe(combatConfig.energyPerTurn - discountOnly.cost);
    expect(s.nextCardCostDelta).toBe(-1);
    // Free defense card: cost 0 via override, the discount stays armed.
    s = play(s, rng, 'wooden_shield');
    expect(s.player.energy).toBe(combatConfig.energyPerTurn - discountOnly.cost);
    expect(s.nextCardCostDelta).toBe(-1);
    // The discount then applies to the attack (1 − 1 = 0) and is consumed.
    s = play(s, rng, 'axe_strike');
    expect(s.player.energy).toBe(combatConfig.energyPerTurn - discountOnly.cost);
    expect(s.nextCardCostDelta).toBe(0);
  });

  it('is reflected by getEffectiveCost for the UI', () => {
    const { state, rng } = newCombat({
      deck: [woodenShield, woodenShield],
      firstDefenseCardFree: true,
    });
    expect(getEffectiveCost(state, woodenShield)).toBe(0);
    expect(getEffectiveCost(state, axeStrike)).toBe(axeStrike.cost);
    const s = play(state, rng, 'wooden_shield');
    expect(getEffectiveCost(s, woodenShield)).toBe(woodenShield.cost);
  });
});
