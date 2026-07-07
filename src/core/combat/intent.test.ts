import { describe, expect, it } from 'vitest';
import { copperBeetle, shadowGull, shadowRat } from '../../data/enemies/tier1';
import { getIntentPreview } from './intent';
import { combatReducer, createCombatState } from './reducer';
import { createRng } from './rng';
import type { CardDef, CombatState, EnemyDef } from './types';

const strike: CardDef = {
  id: 'strike',
  name: 'Hieb',
  type: 'attack',
  cost: 1,
  effects: [{ kind: 'damage', amount: 6, target: 'target' }],
};

const weaken: CardDef = {
  id: 'weaken',
  name: 'Schwächen',
  type: 'skill',
  cost: 1,
  effects: [{ kind: 'applyStatus', status: 'weak', amount: 2, target: 'target' }],
};

function newCombat(
  enemies: EnemyDef[],
  deck: CardDef[] = [strike, strike, strike, weaken, weaken],
) {
  const rng = createRng(7);
  return { state: createCombatState({ playerHp: 60, deck, enemies }, rng), rng };
}

function withEnemyStatuses(state: CombatState, statuses: CombatState['enemies'][0]['statuses']) {
  const clone = structuredClone(state);
  Object.assign(clone.enemies[0]!.statuses, statuses);
  return clone;
}

const previewOf = (state: CombatState) => getIntentPreview(state, state.enemies[0]!.instanceId)!;

describe('getIntentPreview — echte Zahl', () => {
  // shadow_rat telegraphs Biss 5 at combat start.
  it('shows the base damage without statuses', () => {
    const { state } = newCombat([shadowRat]);
    const preview = previewOf(state);
    expect(preview.kind).toBe('attack');
    expect(preview.attacks).toEqual([{ times: 1, amount: 5, total: 5, ignoresBlock: false }]);
  });

  it('adds enemy strength to the shown number', () => {
    const { state } = newCombat([shadowRat]);
    const preview = previewOf(withEnemyStatuses(state, { strength: 2 }));
    expect(preview.attacks[0]!.amount).toBe(7);
  });

  it('applies ×0.75 while the enemy is weak, floored', () => {
    const { state } = newCombat([shadowRat]);
    const preview = previewOf(withEnemyStatuses(state, { weak: 1 }));
    expect(preview.attacks[0]!.amount).toBe(3); // 5 × 0.75 = 3.75 → 3
  });

  it('applies ×1.5 while the PLAYER is vulnerable, floored', () => {
    const { state } = newCombat([shadowRat]);
    const clone = structuredClone(state);
    clone.player.statuses.vulnerable = 1;
    expect(previewOf(clone).attacks[0]!.amount).toBe(7); // 5 × 1.5 = 7.5 → 7
  });

  it('combines strength, weak and vulnerable with the exact formula', () => {
    const { state } = newCombat([shadowRat]);
    const clone = withEnemyStatuses(state, { strength: 1, weak: 1 });
    clone.player.statuses.vulnerable = 1;
    // (5 + 1) × 0.75 × 1.5 = 6.75 → 6
    expect(previewOf(clone).attacks[0]!.amount).toBe(6);
  });

  it('exposes multi-hit as times × amount (Sturzflug 2×3)', () => {
    const { state } = newCombat([shadowGull]);
    const preview = previewOf(state);
    expect(preview.attacks).toEqual([{ times: 2, amount: 3, total: 6, ignoresBlock: false }]);
  });

  it('applies strength per hit for multi-hit previews', () => {
    const { state } = newCombat([shadowGull]);
    const preview = previewOf(withEnemyStatuses(state, { strength: 2 }));
    expect(preview.attacks).toEqual([{ times: 2, amount: 5, total: 10, ignoresBlock: false }]);
  });

  it('passes through the ignoresBlock flag', () => {
    const piercer: EnemyDef = {
      id: 'piercer',
      name: 'Durchbohrer',
      tier: 1,
      hp: 10,
      pattern: {
        kind: 'cycle',
        steps: [
          {
            intent: 'attack',
            effects: [{ kind: 'damage', amount: 4, target: 'player', ignoresBlock: true }],
          },
        ],
      },
    };
    const { state } = newCombat([piercer]);
    expect(previewOf(state).attacks[0]!.ignoresBlock).toBe(true);
  });
});

describe('getIntentPreview — non-attacks & edge cases', () => {
  it('reports non-attack intents with empty attacks (copper beetle defends)', () => {
    const { state } = newCombat([copperBeetle]);
    const preview = previewOf(state);
    expect(preview.kind).toBe('defend');
    expect(preview.attacks).toEqual([]);
    expect(preview.effects).toEqual(state.enemies[0]!.intent.effects);
  });

  it('returns undefined for unknown or dead enemies', () => {
    const { state } = newCombat([shadowRat]);
    expect(getIntentPreview(state, 'nope#0')).toBeUndefined();
    const dead = structuredClone(state);
    dead.enemies[0]!.hp = 0;
    expect(getIntentPreview(dead, dead.enemies[0]!.instanceId)).toBeUndefined();
  });
});

describe('getIntentPreview — stays live after status changes', () => {
  it('recomputes after the player weakens the enemy mid-turn', () => {
    const { state, rng } = newCombat([shadowRat]);
    expect(previewOf(state).attacks[0]!.amount).toBe(5);
    const weakenCard = state.hand.find((c) => c.def.id === 'weaken')!;
    const next = combatReducer(
      state,
      {
        type: 'PLAY_CARD',
        cardInstanceId: weakenCard.instanceId,
        targetEnemyId: state.enemies[0]!.instanceId,
      },
      rng,
    );
    expect(previewOf(next).attacks[0]!.amount).toBe(3); // 5 × 0.75 → 3
  });

  it('recomputes after the player becomes vulnerable via a card', () => {
    const reckless: CardDef = {
      id: 'reckless',
      name: 'Waghalsig',
      type: 'skill',
      cost: 0,
      effects: [{ kind: 'applyStatus', status: 'vulnerable', amount: 1, target: 'player' }],
    };
    const { state, rng } = newCombat(
      [shadowRat],
      [reckless, reckless, reckless, reckless, reckless],
    );
    const card = state.hand[0]!;
    const next = combatReducer(state, { type: 'PLAY_CARD', cardInstanceId: card.instanceId }, rng);
    expect(previewOf(next).attacks[0]!.amount).toBe(7); // 5 × 1.5 → 7
  });
});
