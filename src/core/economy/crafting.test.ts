import { describe, expect, it } from 'vitest';
import type { RecipeDef } from '../../data/recipes';
import { allRecipes } from '../../data/recipes';
import {
  canCraft,
  craft,
  ingredientStatus,
  isRecipeUnlocked,
  isRecipeVisible,
} from './crafting';
import type { Inventory } from './inventory';

const cardRecipe: RecipeDef = {
  id: 'test_card',
  name: 'Testkarte',
  station: 'smithy',
  stationTier: 1,
  output: { kind: 'card', cardId: 'heavy_blow' },
  ingredients: [
    { resource: 'copper_ore', amount: 3 },
    { resource: 'stone', amount: 1 },
  ],
};

const toolRecipe: RecipeDef = {
  id: 'test_tool',
  name: 'Testwerkzeug',
  station: 'smithy',
  stationTier: 1,
  output: { kind: 'toolUpgrade', toolTier: 2 },
  ingredients: [
    { resource: 'copper_ore', amount: 3 },
    { resource: 'tough_leather', amount: 2 },
  ],
};

describe('canCraft', () => {
  it('is true with exactly enough material', () => {
    const inv: Inventory = { copper_ore: 3, stone: 1 };
    expect(canCraft(inv, cardRecipe)).toBe(true);
  });

  it('is false when one ingredient is short', () => {
    const inv: Inventory = { copper_ore: 2, stone: 5 };
    expect(canCraft(inv, cardRecipe)).toBe(false);
  });

  it('is false on an empty inventory', () => {
    expect(canCraft({}, cardRecipe)).toBe(false);
  });
});

describe('craft', () => {
  it('deducts exactly the recipe costs and returns the card output', () => {
    const inv: Inventory = { copper_ore: 5, stone: 2, wood: 4 };
    const result = craft(inv, cardRecipe);
    expect(result).not.toBeNull();
    expect(result?.inventory).toEqual({ copper_ore: 2, stone: 1, wood: 4 });
    expect(result?.output).toEqual({ kind: 'card', cardId: 'heavy_blow' });
    // Input inventory untouched (immutability contract).
    expect(inv.copper_ore).toBe(5);
  });

  it('drops stacks that reach zero', () => {
    const result = craft({ copper_ore: 3, stone: 1 }, cardRecipe);
    expect(result?.inventory).toEqual({});
  });

  it('returns null and leaves nothing deducted when material is missing', () => {
    const inv: Inventory = { copper_ore: 3 }; // stone missing
    expect(craft(inv, cardRecipe)).toBeNull();
    expect(inv).toEqual({ copper_ore: 3 });
  });

  it('returns the toolUpgrade output for tool recipes', () => {
    const result = craft({ copper_ore: 3, tough_leather: 2 }, toolRecipe);
    expect(result?.output).toEqual({ kind: 'toolUpgrade', toolTier: 2 });
    expect(result?.inventory).toEqual({});
  });
});

describe('ingredientStatus', () => {
  it('reports have/need per ingredient line', () => {
    const status = ingredientStatus({ copper_ore: 2 }, cardRecipe);
    expect(status).toEqual([
      { resource: 'copper_ore', need: 3, have: 2 },
      { resource: 'stone', need: 1, have: 0 },
    ]);
  });
});

describe('gating helpers', () => {
  it('locks tier-2 recipes at station tier 1', () => {
    const tier2 = allRecipes.find((r) => r.stationTier === 2);
    expect(tier2).toBeDefined();
    expect(isRecipeUnlocked(tier2 as RecipeDef, 1)).toBe(false);
    expect(isRecipeUnlocked(tier2 as RecipeDef, 2)).toBe(true);
  });

  it('hides a tool upgrade once the tier is owned', () => {
    expect(isRecipeVisible(toolRecipe, 1)).toBe(true);
    expect(isRecipeVisible(toolRecipe, 2)).toBe(false);
    expect(isRecipeVisible(toolRecipe, 3)).toBe(false);
  });

  it('always shows card recipes regardless of tool tier', () => {
    expect(isRecipeVisible(cardRecipe, 99)).toBe(true);
  });
});
