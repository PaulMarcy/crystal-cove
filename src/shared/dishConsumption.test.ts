import { beforeEach, describe, expect, it } from 'vitest';
import type { CombatState } from '../core/combat/types';
import { emptyInventory } from '../core/economy/inventory';
import { berrySnack, starterDeck, starterDeckIds } from '../data/cards/tier1';
import { combatConfig } from '../data/combat';
import { initialShadowDensity } from '../data/encounters/tier1';
import { shadowRat } from '../data/enemies/tier1';
import { gameStore } from './store';

/**
 * Store-level tests for the dish consumption loop (docs/03, docs/10):
 * dish played in combat → after endCombat it is gone from ownership and
 * deck until re-cooked at the kitchen.
 */

beforeEach(() => {
  gameStore.setState({
    inventory: emptyInventory,
    harvestedNodeIds: [],
    shadowDensity: initialShadowDensity,
    playerPosition: null,
    playerZone: null,
    collection: [],
    deck: [...starterDeckIds],
    consumedStarterDishes: [],
    toolTier: combatConfig.baseToolTier,
    activeStation: null,
    combat: null,
    combatSeed: null,
    combatLoot: null,
    lastCombatOutcome: null,
    lastLoot: null,
  });
});

/** Starts a combat, then marks the berry snack as consumed (played). */
function runCombatWithConsumedSnack(phase: CombatState['phase']): void {
  const state = gameStore.getState();
  state.startCombat({ playerHp: 30, deck: [...starterDeck], enemies: [shadowRat] }, 42);
  const combat = gameStore.getState().combat!;
  const snack = [...combat.drawPile, ...combat.hand].find((c) => c.def.id === 'berry_snack')!;
  gameStore.setState({
    combat: {
      ...combat,
      phase,
      drawPile: combat.drawPile.filter((c) => c !== snack),
      hand: combat.hand.filter((c) => c !== snack),
      consumed: [snack],
    },
  });
  gameStore.getState().endCombat();
}

describe('dish consumption at endCombat', () => {
  it('a played starter dish leaves deck and ownership (marker set)', () => {
    runCombatWithConsumedSnack('victory');
    const state = gameStore.getState();
    expect(state.deck).not.toContain('berry_snack');
    expect(state.deck.length).toBe(starterDeckIds.length - 1);
    expect(state.consumedStarterDishes).toEqual(['berry_snack']);
  });

  it('consumption sticks on defeat too (consumed on play, docs/03)', () => {
    runCombatWithConsumedSnack('defeat');
    expect(gameStore.getState().consumedStarterDishes).toEqual(['berry_snack']);
  });

  it('a crafted copy is consumed from the collection before the starter copy', () => {
    gameStore.setState({ collection: ['berry_snack'] });
    runCombatWithConsumedSnack('victory');
    const state = gameStore.getState();
    expect(state.collection).toEqual([]);
    expect(state.consumedStarterDishes).toEqual([]);
  });

  it('an unplayed dish stays in deck and ownership', () => {
    const state = gameStore.getState();
    state.startCombat({ playerHp: 30, deck: [...starterDeck], enemies: [shadowRat] }, 42);
    gameStore.setState({ combat: { ...gameStore.getState().combat!, phase: 'victory' } });
    gameStore.getState().endCombat();
    expect(gameStore.getState().deck).toContain('berry_snack');
    expect(gameStore.getState().consumedStarterDishes).toEqual([]);
  });

  it('an incomplete deck blocks the next encounter until re-cooked', () => {
    runCombatWithConsumedSnack('victory');
    expect(gameStore.getState().startEncounter('strand', 7)).toBe(false);
  });
});

describe('re-cooking at the kitchen', () => {
  it('craftRecipe clears the starter marker instead of growing the collection', () => {
    runCombatWithConsumedSnack('victory');
    gameStore.setState({ inventory: { berry: 3 }, activeStation: 'kitchen' });
    expect(gameStore.getState().craftRecipe('recipe_berry_snack')).toBe(true);
    const state = gameStore.getState();
    expect(state.consumedStarterDishes).toEqual([]);
    expect(state.collection).toEqual([]); // starter copy restored, not a crafted one
    expect(state.inventory['berry']).toBeUndefined();
  });

  it('after re-cooking and re-slotting the encounter starts again', () => {
    runCombatWithConsumedSnack('victory');
    gameStore.setState({ inventory: { berry: 3 }, activeStation: 'kitchen' });
    gameStore.getState().craftRecipe('recipe_berry_snack');
    gameStore.getState().closeStation();
    expect(gameStore.getState().addCardToDeck('berry_snack')).toBe(true);
    expect(gameStore.getState().startEncounter('strand', 7)).toBe(true);
    expect(gameStore.getState().combat?.drawPile.length).toBeGreaterThan(0);
  });

  it('without a marker craftRecipe adds a crafted collection copy', () => {
    gameStore.setState({ inventory: { berry: 3 }, activeStation: 'kitchen' });
    expect(gameStore.getState().craftRecipe('recipe_berry_snack')).toBe(true);
    expect(gameStore.getState().collection).toEqual(['berry_snack']);
  });
});

describe('sanity', () => {
  it('berry snack is a dish card (consumption applies)', () => {
    expect(berrySnack.type).toBe('dish');
  });
});
