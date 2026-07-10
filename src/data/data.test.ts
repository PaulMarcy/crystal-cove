/**
 * Data validation for the tier-1 content (ROADMAP M1):
 * effect kinds, cost range, unique IDs, loot invariants, non-empty cycles,
 * plus a seeded smoke test: starter deck vs shadow_rat runs to a terminal
 * phase through the real combat core.
 */
import { describe, expect, it } from 'vitest';
import { combatReducer, createCombatState } from '../core/combat/reducer';
import { createRng } from '../core/combat/rng';
import type { CombatState, Effect } from '../core/combat/types';
import { allCards, starterDeck } from './cards/tier1';
import { allEnemies, shadowRat } from './enemies/tier1';

const KNOWN_EFFECT_KINDS: readonly Effect['kind'][] = [
  'damage',
  'block',
  'draw',
  'heal',
  'applyStatus',
  'gainEnergy',
  'addCard',
  'modifyNextCardCost',
  'conditionalDamage',
];

describe('card data (docs/03 + docs/10)', () => {
  it('has unique English snake_case IDs', () => {
    const ids = allCards.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(/^[a-z][a-z0-9_]*$/);
  });

  it('keeps costs in the 0–3 energy range', () => {
    for (const card of allCards) {
      expect(card.cost, card.id).toBeGreaterThanOrEqual(0);
      expect(card.cost, card.id).toBeLessThanOrEqual(3);
    }
  });

  it('only references existing effect kinds', () => {
    for (const card of allCards) {
      for (const effect of card.effects) {
        expect(KNOWN_EFFECT_KINDS, `${card.id}: ${effect.kind}`).toContain(effect.kind);
      }
    }
  });

  it('status cards are effect-free and unplayable by type', () => {
    for (const card of allCards.filter((c) => c.type === 'status')) {
      expect(card.effects).toHaveLength(0);
    }
  });

  it('ships the 12-card starter deck composition from docs/03', () => {
    expect(starterDeck).toHaveLength(12);
    const count = (id: string) => starterDeck.filter((c) => c.id === id).length;
    expect(count('axe_strike')).toBe(4);
    expect(count('wooden_shield')).toBe(4);
    expect(count('stone_throw')).toBe(2);
    expect(count('catch_breath')).toBe(1);
    expect(count('berry_snack')).toBe(1);
  });
});

describe('enemy data (docs/07)', () => {
  it('has unique English snake_case IDs', () => {
    const ids = allEnemies.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(/^[a-z][a-z0-9_]*$/);
  });

  it('every pattern cycle has at least one step with effects of known kinds', () => {
    for (const enemy of allEnemies) {
      const steps =
        enemy.pattern.kind === 'cycle'
          ? enemy.pattern.steps
          : enemy.pattern.phases.flatMap((p) => p.steps);
      expect(steps.length, enemy.id).toBeGreaterThan(0);
      for (const step of steps) {
        expect(step.effects.length, enemy.id).toBeGreaterThan(0);
        for (const effect of step.effects) {
          expect(KNOWN_EFFECT_KINDS, `${enemy.id}: ${effect.kind}`).toContain(effect.kind);
        }
      }
    }
  });

  it('every enemy has guaranteed loot including shadow_dust (shrine currency)', () => {
    for (const enemy of allEnemies) {
      expect(enemy.loot, enemy.id).toBeDefined();
      expect(enemy.loot!.guaranteed.length, enemy.id).toBeGreaterThan(0);
      expect(
        enemy.loot!.guaranteed.some((l) => l.item === 'shadow_dust'),
        `${enemy.id} must drop shadow_dust`,
      ).toBe(true);
      for (const entry of [...enemy.loot!.guaranteed, ...enemy.loot!.chance]) {
        expect(entry.min, enemy.id).toBeGreaterThan(0);
        expect(entry.max, enemy.id).toBeGreaterThanOrEqual(entry.min);
        if (entry.p !== undefined) {
          expect(entry.p, enemy.id).toBeGreaterThan(0);
          expect(entry.p, enemy.id).toBeLessThanOrEqual(1);
        }
      }
    }
  });

  it('does not include the M4 boss', () => {
    expect(allEnemies.some((e) => e.id === 'root_warden')).toBe(false);
  });
});

describe('smoke test: starter deck vs shadow_rat (seeded)', () => {
  it('runs to victory or defeat without errors', () => {
    const rng = createRng(1337);
    let state: CombatState = createCombatState(
      { playerHp: 50, deck: [...starterDeck], enemies: [shadowRat] },
      rng,
    );
    let guard = 0;
    while (state.phase === 'playerTurn' && guard++ < 200) {
      const playable = state.hand.find(
        (c) => c.def.type !== 'status' && c.def.cost <= state.player.energy,
      );
      if (playable) {
        state = combatReducer(
          state,
          {
            type: 'PLAY_CARD',
            cardInstanceId: playable.instanceId,
            targetEnemyId: state.enemies.find((e) => e.hp > 0)?.instanceId ?? '',
          },
          rng,
        );
      } else {
        state = combatReducer(state, { type: 'END_TURN' }, rng);
      }
    }
    expect(['victory', 'defeat']).toContain(state.phase);
  });
});
