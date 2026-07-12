import { describe, expect, it } from 'vitest';
import { cardsById, starterDeckIds } from '../../data/cards/tier1';
import { deckConfig } from '../../data/deck';
import {
  addToDeck,
  buildCombatDeck,
  countCards,
  ownedCounts,
  removeFromDeck,
  validateDeck,
} from './deck';

const starterOwned = ownedCounts(starterDeckIds, []);

describe('countCards / ownedCounts', () => {
  it('counts duplicates as a multiset', () => {
    expect(countCards(['a', 'b', 'a'])).toEqual({ a: 2, b: 1 });
  });

  it('owned = starter set plus collection', () => {
    const owned = ownedCounts(starterDeckIds, ['heavy_blow', 'heavy_blow']);
    expect(owned.axe_strike).toBe(4);
    expect(owned.heavy_blow).toBe(2);
  });
});

describe('validateDeck', () => {
  it('accepts the starter deck', () => {
    expect(validateDeck(starterDeckIds, starterOwned, cardsById)).toEqual({
      valid: true,
      errors: [],
    });
  });

  it('rejects a deck below the minimum size', () => {
    const short = starterDeckIds.slice(0, deckConfig.minSize - 1);
    expect(validateDeck(short, starterOwned, cardsById).errors).toContain('too_small');
  });

  it('rejects a deck above the level max size (min = max at level 1)', () => {
    const owned = ownedCounts(starterDeckIds, ['heavy_blow']);
    const over = [...starterDeckIds, 'heavy_blow'];
    expect(validateDeck(over, owned, cardsById, deckConfig.minSize).errors).toContain('too_large');
  });

  it('accepts 13 cards when the max size is raised (docs/02 Lv 4 → 15)', () => {
    const owned = ownedCounts(starterDeckIds, ['heavy_blow']);
    const bigger = [...starterDeckIds, 'heavy_blow'];
    expect(validateDeck(bigger, owned, cardsById, 15).valid).toBe(true);
  });

  it('rejects more copies than owned', () => {
    // 5× axe_strike but the player only owns 4 (drop the LAST starter card —
    // the first one is an axe_strike itself, dropping it would balance out)
    const deck = [...starterDeckIds.slice(0, -1), 'axe_strike'];
    const result = validateDeck(deck, starterOwned, cardsById);
    expect(result.errors).toContain('not_owned');
  });

  it('rejects more dishes than the expedition slot allows (docs/10: 1)', () => {
    const owned = ownedCounts(starterDeckIds, ['pumpkin_stew']);
    // replace one axe_strike with a second dish
    const deck = [...starterDeckIds.slice(1), 'pumpkin_stew'];
    expect(validateDeck(deck, owned, cardsById).errors).toContain('too_many_dishes');
  });

  it('rejects unknown card ids', () => {
    const deck = [...starterDeckIds.slice(1), 'nonsense'];
    expect(validateDeck(deck, starterOwned, cardsById).errors).toContain('unknown_card');
  });
});

describe('addToDeck / removeFromDeck', () => {
  it('add fails on a full deck', () => {
    const owned = ownedCounts(starterDeckIds, ['heavy_blow']);
    expect(addToDeck(starterDeckIds, 'heavy_blow', owned, cardsById)).toBeNull();
  });

  it('add succeeds beyond 12 with a raised max size (docs/02 Lv 4)', () => {
    const owned = ownedCounts(starterDeckIds, ['heavy_blow']);
    const bigger = addToDeck(starterDeckIds, 'heavy_blow', owned, cardsById, 15);
    expect(bigger).toHaveLength(deckConfig.minSize + 1);
  });

  it('remove then add swaps a card', () => {
    const owned = ownedCounts(starterDeckIds, ['heavy_blow']);
    const without = removeFromDeck(starterDeckIds, 'stone_throw');
    expect(without).toHaveLength(deckConfig.minSize - 1);
    const swapped = addToDeck(without!, 'heavy_blow', owned, cardsById);
    expect(swapped).toHaveLength(deckConfig.minSize);
    expect(validateDeck(swapped!, owned, cardsById).valid).toBe(true);
  });

  it('add fails when no free copy is owned', () => {
    const without = removeFromDeck(starterDeckIds, 'stone_throw')!;
    expect(addToDeck(without, 'heavy_blow', starterOwned, cardsById)).toBeNull();
  });

  it('add fails when the dish slot is already used', () => {
    const owned = ownedCounts(starterDeckIds, ['pumpkin_stew']);
    const without = removeFromDeck(starterDeckIds, 'stone_throw')!; // berry_snack still in
    expect(addToDeck(without, 'pumpkin_stew', owned, cardsById)).toBeNull();
  });

  it('add allows a dish once the old dish was removed', () => {
    const owned = ownedCounts(starterDeckIds, ['pumpkin_stew']);
    const without = removeFromDeck(starterDeckIds, 'berry_snack')!;
    expect(addToDeck(without, 'pumpkin_stew', owned, cardsById)).not.toBeNull();
  });

  it('remove fails when the card is not in the deck', () => {
    expect(removeFromDeck(starterDeckIds, 'heavy_blow')).toBeNull();
  });
});

describe('buildCombatDeck', () => {
  it('resolves a valid deck to CardDefs in order', () => {
    const defs = buildCombatDeck(starterDeckIds, starterOwned, cardsById);
    expect(defs).toHaveLength(deckConfig.minSize);
    expect(defs?.[0]?.id).toBe('axe_strike');
  });

  it('returns null for an invalid (incomplete) deck', () => {
    const short = starterDeckIds.slice(1);
    expect(buildCombatDeck(short, starterOwned, cardsById)).toBeNull();
  });
});
