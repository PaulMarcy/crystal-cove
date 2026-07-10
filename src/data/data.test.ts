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
import { allRecipes, kitchenRecipes, smithyRecipes } from './recipes';
import { RESOURCE_IDS, resources } from './resources';

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

describe('recipe data (docs/10 Schmiede/Küche/Werkzeugstufen)', () => {
  it('has unique English snake_case IDs', () => {
    const ids = allRecipes.map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(/^[a-z][a-z0-9_]*$/);
  });

  it('every card output references an existing card', () => {
    const cardIds = new Set(allCards.map((c) => c.id));
    for (const recipe of allRecipes) {
      if (recipe.output.kind === 'card') {
        expect(cardIds.has(recipe.output.cardId), `${recipe.id} → ${recipe.output.cardId}`).toBe(
          true,
        );
      }
    }
  });

  it('every ingredient references a defined resource with a positive amount', () => {
    for (const recipe of allRecipes) {
      expect(recipe.ingredients.length, recipe.id).toBeGreaterThan(0);
      for (const ing of recipe.ingredients) {
        expect(RESOURCE_IDS, `${recipe.id}: ${ing.resource}`).toContain(ing.resource);
        expect(ing.amount, `${recipe.id}: ${ing.resource}`).toBeGreaterThan(0);
        expect(Number.isInteger(ing.amount), `${recipe.id}: ${ing.resource}`).toBe(true);
      }
    }
  });

  it('recipes sit on the right station with valid tiers', () => {
    for (const recipe of smithyRecipes) expect(recipe.station).toBe('smithy');
    for (const recipe of kitchenRecipes) expect(recipe.station).toBe('kitchen');
    for (const recipe of allRecipes) {
      expect([1, 2], recipe.id).toContain(recipe.stationTier);
    }
  });

  it('exactly one tool upgrade exists: Verstärkt (tier 2, 3 Kupfer + 2 Leder)', () => {
    const upgrades = allRecipes.filter((r) => r.output.kind === 'toolUpgrade');
    expect(upgrades).toHaveLength(1);
    const upgrade = upgrades[0]!;
    expect(upgrade.output).toEqual({ kind: 'toolUpgrade', toolTier: 2 });
    expect(upgrade.ingredients).toEqual([
      { resource: 'copper_ore', amount: 3 },
      { resource: 'tough_leather', amount: 2 },
    ]);
  });

  it('marks all combat drops as special material (docs/10: never refunded)', () => {
    const combatDrops = [
      'shadow_fiber',
      'tough_leather',
      'meat',
      'vine',
      'resin',
      'beetle_shell',
      'feather',
      'shiny_trinket',
      'heart_thorn',
      'shadow_dust',
    ] as const;
    for (const id of combatDrops) expect(resources[id].specialMaterial, id).toBe(true);
    for (const id of ['wood', 'stone', 'copper_ore', 'berry', 'pumpkin', 'chili', 'fish', 'honey'] as const) {
      expect(resources[id].specialMaterial, id).toBe(false);
    }
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
