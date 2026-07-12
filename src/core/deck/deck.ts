/**
 * Deck assembly (Deck-Truhe, docs/03 "Deck = Rucksack") — pure, engine-free.
 *
 * The player owns a multiset of cards: the fixed starter set plus every
 * crafted card in the collection. The combat deck is a list of card ids
 * (duplicates allowed) that must
 *   1. contain between `deckConfig.minSize` and `maxSize` cards — the max
 *      is level-dependent (docs/02 milestone Lv 4: 12 → 15; callers resolve
 *      it via core/progression.deckLimitForLevel),
 *   2. be a sub-multiset of the owned cards,
 *   3. hold at most `deckConfig.dishSlots` dish cards (docs/10 Küche).
 *
 * All rule values live in src/data (deck.ts, progression.ts); card
 * definitions are resolved through a caller-supplied id → CardDef map.
 */
import { deckConfig } from '../../data/deck';
import type { CardDef } from '../combat/types';

export type CardCounts = Readonly<Record<string, number>>;

/** Multiset view of a card id list. */
export function countCards(ids: readonly string[]): CardCounts {
  const counts: Record<string, number> = {};
  for (const id of ids) counts[id] = (counts[id] ?? 0) + 1;
  return counts;
}

/** Everything the player owns: starter set + crafted collection (multiset). */
export function ownedCounts(
  starterIds: readonly string[],
  collection: readonly string[],
): CardCounts {
  return countCards([...starterIds, ...collection]);
}

export type DeckError = 'too_small' | 'too_large' | 'not_owned' | 'too_many_dishes' | 'unknown_card';

export interface DeckValidation {
  valid: boolean;
  errors: readonly DeckError[];
}

function dishCount(deck: readonly string[], cardsById: ReadonlyMap<string, CardDef>): number {
  return deck.filter((id) => cardsById.get(id)?.type === 'dish').length;
}

/** Full deck check — combat may only start with a valid deck. */
export function validateDeck(
  deck: readonly string[],
  owned: CardCounts,
  cardsById: ReadonlyMap<string, CardDef>,
  maxSize: number = deckConfig.minSize,
): DeckValidation {
  const errors: DeckError[] = [];
  if (deck.length < deckConfig.minSize) errors.push('too_small');
  if (deck.length > maxSize) errors.push('too_large');
  if (deck.some((id) => !cardsById.has(id))) errors.push('unknown_card');
  const deckCounts = countCards(deck);
  if (Object.entries(deckCounts).some(([id, n]) => n > (owned[id] ?? 0))) {
    errors.push('not_owned');
  }
  if (dishCount(deck, cardsById) > deckConfig.dishSlots) errors.push('too_many_dishes');
  return { valid: errors.length === 0, errors };
}

/**
 * Adds one copy of a card. Returns the new deck, or null when the deck is
 * already at the level's max size, the player owns no free copy, the id is
 * unknown, or the dish slot limit would be exceeded.
 */
export function addToDeck(
  deck: readonly string[],
  cardId: string,
  owned: CardCounts,
  cardsById: ReadonlyMap<string, CardDef>,
  maxSize: number = deckConfig.minSize,
): readonly string[] | null {
  const card = cardsById.get(cardId);
  if (!card) return null;
  if (deck.length >= maxSize) return null;
  const inDeck = deck.filter((id) => id === cardId).length;
  if (inDeck >= (owned[cardId] ?? 0)) return null;
  if (card.type === 'dish' && dishCount(deck, cardsById) >= deckConfig.dishSlots) return null;
  return [...deck, cardId];
}

/** Removes one copy of a card; null when the deck holds none. */
export function removeFromDeck(deck: readonly string[], cardId: string): readonly string[] | null {
  const index = deck.indexOf(cardId);
  if (index === -1) return null;
  return [...deck.slice(0, index), ...deck.slice(index + 1)];
}

/**
 * Resolves the id list into CardDefs for a combat setup. Returns null when
 * the deck is invalid — the caller must not start the combat then
 * (docs/03: expeditions launch with a complete deck).
 */
export function buildCombatDeck(
  deck: readonly string[],
  owned: CardCounts,
  cardsById: ReadonlyMap<string, CardDef>,
  maxSize: number = deckConfig.minSize,
): CardDef[] | null {
  if (!validateDeck(deck, owned, cardsById, maxSize).valid) return null;
  return deck.map((id) => cardsById.get(id)!);
}
