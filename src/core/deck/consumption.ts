/**
 * Dish consumption (docs/03 "Gericht … verlässt nach Nutzung das Deck bis
 * zum Nachkochen", docs/10 Küche) — pure, engine-free.
 *
 * A dish played in combat is consumed the moment it is played — the loss is
 * permanent regardless of the combat outcome (victory, defeat, retreat).
 * After the combat ends, each consumed dish leaves
 *   1. the assembled deck (one copy), and
 *   2. the player's ownership.
 *
 * Ownership removal has two sources:
 * - a crafted copy in the collection → remove one collection entry;
 * - a starter copy (starterDeckIds is a fixed data constant and cannot
 *   shrink) → record a marker in `consumedStarterDishes` instead.
 *   `ownedCounts` subtracts these markers. Re-cooking the recipe clears the
 *   marker first (before growing the collection), so a re-cooked starter
 *   dish stays a starter copy — i.e. it remains non-disenchantable, exactly
 *   like before it was eaten (docs/10: only crafted cards disenchant).
 */
import { countCards, type CardCounts } from './deck';

export interface ConsumptionResult {
  collection: readonly string[];
  deck: readonly string[];
  consumedStarterDishes: readonly string[];
}

/** Removes the first occurrence of `id`; returns null when absent. */
function removeOne(list: readonly string[], id: string): readonly string[] | null {
  const index = list.indexOf(id);
  if (index === -1) return null;
  return [...list.slice(0, index), ...list.slice(index + 1)];
}

/**
 * Applies the dishes consumed in one combat to collection, deck and starter
 * markers. Unknown/over-consumed ids are ignored defensively (the reducer
 * can only consume cards that were in the combat deck).
 */
export function applyDishConsumption(
  consumedCardIds: readonly string[],
  collection: readonly string[],
  deck: readonly string[],
  consumedStarterDishes: readonly string[],
  starterIds: readonly string[],
): ConsumptionResult {
  let nextCollection = collection;
  let nextDeck = deck;
  let nextMarkers = consumedStarterDishes;
  const starterCounts = countCards(starterIds);
  for (const id of consumedCardIds) {
    nextDeck = removeOne(nextDeck, id) ?? nextDeck;
    const withoutCrafted = removeOne(nextCollection, id);
    if (withoutCrafted) {
      nextCollection = withoutCrafted;
    } else {
      const consumedSoFar = nextMarkers.filter((m) => m === id).length;
      if (consumedSoFar < (starterCounts[id] ?? 0)) nextMarkers = [...nextMarkers, id];
    }
  }
  return { collection: nextCollection, deck: nextDeck, consumedStarterDishes: nextMarkers };
}

/**
 * Ownership including consumption: starter set + collection minus consumed
 * starter markers (clamped at 0, entries at 0 are dropped).
 */
export function ownedCountsAfterConsumption(
  starterIds: readonly string[],
  collection: readonly string[],
  consumedStarterDishes: readonly string[],
): CardCounts {
  const counts = { ...countCards([...starterIds, ...collection]) } as Record<string, number>;
  for (const id of consumedStarterDishes) {
    const left = (counts[id] ?? 0) - 1;
    if (left > 0) counts[id] = left;
    else delete counts[id];
  }
  return counts;
}

/**
 * True when re-cooking `cardId` should clear a starter marker instead of
 * adding a collection copy (see module doc).
 */
export function clearsStarterMarker(
  cardId: string,
  consumedStarterDishes: readonly string[],
): boolean {
  return consumedStarterDishes.includes(cardId);
}
