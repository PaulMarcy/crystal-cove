/**
 * Crafting — pure, engine-free (CLAUDE.md rule 1). Consumes recipe data from
 * src/data/recipes.ts and the immutable inventory; UI layers only render the
 * results and dispatch craft calls through the store.
 *
 * Costs/outputs live entirely in data (docs/10); this module only checks and
 * applies them. Disenchant (50 % refund) is a separate M3 task (Deck-Truhe).
 */
import type { RecipeDef, RecipeOutput } from '../../data/recipes';
import { countOf, removeItem, type Inventory } from './inventory';

export interface IngredientStatus {
  resource: string;
  need: number;
  have: number;
}

/** Per-ingredient owned/needed counts — the UI renders these (e.g. „2/3"). */
export function ingredientStatus(inventory: Inventory, recipe: RecipeDef): IngredientStatus[] {
  return recipe.ingredients.map((ing) => ({
    resource: ing.resource,
    need: ing.amount,
    have: countOf(inventory, ing.resource),
  }));
}

/** True when the inventory covers every ingredient line of the recipe. */
export function canCraft(inventory: Inventory, recipe: RecipeDef): boolean {
  return recipe.ingredients.every((ing) => countOf(inventory, ing.resource) >= ing.amount);
}

/** True when the recipe is unlocked at the station's current tier. */
export function isRecipeUnlocked(recipe: RecipeDef, stationTier: number): boolean {
  return stationTier >= recipe.stationTier;
}

/**
 * Tool upgrades vanish from the list once the player owns that tier or higher
 * (docs/10 Werkzeugstufen — each upgrade is a one-time purchase).
 */
export function isRecipeVisible(recipe: RecipeDef, toolTier: number): boolean {
  if (recipe.output.kind !== 'toolUpgrade') return true;
  return toolTier < recipe.output.toolTier;
}

export interface CraftResult {
  inventory: Inventory;
  output: RecipeOutput;
}

/**
 * Applies the recipe: deducts all ingredients and returns the new inventory
 * plus the recipe output. Returns null if any ingredient is missing —
 * callers decide how to surface that (the UI disables the button anyway).
 */
export function craft(inventory: Inventory, recipe: RecipeDef): CraftResult | null {
  let next: Inventory = inventory;
  for (const ing of recipe.ingredients) {
    const removed = removeItem(next, ing.resource, ing.amount);
    if (removed === null) return null;
    next = removed;
  }
  return { inventory: next, output: recipe.output };
}
