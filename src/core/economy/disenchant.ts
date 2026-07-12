/**
 * Disenchant (Zerlegen, docs/10) — pure, engine-free.
 *
 * Rules (docs/10 "Zerlegen"):
 * - Refund = 50 % of the BASE minting recipe (fraction in data/recipes;
 *   the talent "Effizientes Zerlegen" raises it to 75 %), floored PER
 *   ingredient line
 *   (Schwerer Hieb: floor(3/2)=1 Kupfer + floor(1/2)=0 Stein).
 * - Special material (= combat drops, `specialMaterial` flag in
 *   src/data/resources.ts) is never refunded.
 * - Basis are always the base-card minting costs; upgrade costs are lost
 *   (upgrades are a later milestone anyway).
 * - Cards without a recipe (starter cards) cannot be disenchanted.
 * - The disenchanted card leaves the collection and, if slotted, the deck —
 *   the deck may then be < deckSize until the player refills it; combat
 *   start requires a valid deck (core/deck).
 */
import { disenchantConfig, type RecipeDef } from '../../data/recipes';
import { resources } from '../../data/resources';
import { addItem, type Inventory } from './inventory';

export interface RefundLine {
  resource: string;
  /** Refunded amount — 0 for special material and floored half-lines. */
  amount: number;
}

/** Base minting recipe of a card (first card-output match), or null. */
export function baseRecipeFor(cardId: string, recipes: readonly RecipeDef[]): RecipeDef | null {
  return recipes.find((r) => r.output.kind === 'card' && r.output.cardId === cardId) ?? null;
}

/**
 * Refund preview per ingredient line (UI shows every line, including the
 * zero lines, so the 50 %/special rule stays transparent). Null when the
 * card has no minting recipe (starter cards — not disenchantable).
 */
export function disenchantRefund(
  cardId: string,
  recipes: readonly RecipeDef[],
  refundFraction: number = disenchantConfig.baseRefundFraction,
): RefundLine[] | null {
  const recipe = baseRecipeFor(cardId, recipes);
  if (!recipe) return null;
  return recipe.ingredients.map((ing) => ({
    resource: ing.resource,
    amount: resources[ing.resource].specialMaterial
      ? 0
      : Math.floor(ing.amount * refundFraction),
  }));
}

export interface DisenchantResult {
  inventory: Inventory;
  collection: readonly string[];
  deck: readonly string[];
}

/**
 * Disenchants one copy: removes it from the collection (and the deck, if
 * slotted) and credits the refund. Null when the card is not in the
 * collection or has no recipe.
 */
export function disenchantCard(
  inventory: Inventory,
  collection: readonly string[],
  deck: readonly string[],
  cardId: string,
  recipes: readonly RecipeDef[],
  refundFraction: number = disenchantConfig.baseRefundFraction,
): DisenchantResult | null {
  const refund = disenchantRefund(cardId, recipes, refundFraction);
  if (!refund) return null;
  const collectionIndex = collection.indexOf(cardId);
  if (collectionIndex === -1) return null;

  let nextInventory = inventory;
  for (const line of refund) {
    if (line.amount > 0) nextInventory = addItem(nextInventory, line.resource, line.amount);
  }
  const nextCollection = [
    ...collection.slice(0, collectionIndex),
    ...collection.slice(collectionIndex + 1),
  ];
  const deckIndex = deck.indexOf(cardId);
  const nextDeck =
    deckIndex === -1 ? deck : [...deck.slice(0, deckIndex), ...deck.slice(deckIndex + 1)];
  return { inventory: nextInventory, collection: nextCollection, deck: nextDeck };
}
