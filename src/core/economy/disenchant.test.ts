import { describe, expect, it } from 'vitest';
import { allRecipes } from '../../data/recipes';
import { starterDeckIds } from '../../data/cards/tier1';
import { disenchantCard, disenchantRefund } from './disenchant';

describe('disenchantRefund (docs/10: 50 %, floor per line, no special material)', () => {
  it('Schwerer Hieb (3 Kupfer + 1 Stein) → 1 Kupfer + 0 Stein', () => {
    expect(disenchantRefund('heavy_blow', allRecipes)).toEqual([
      { resource: 'copper_ore', amount: 1 },
      { resource: 'stone', amount: 0 },
    ]);
  });

  it('Riposte (2 Kupfer + 2 Ranken) → 1 Kupfer + 0 Ranken (Ranken = Kampf-Drop)', () => {
    expect(disenchantRefund('riposte', allRecipes)).toEqual([
      { resource: 'copper_ore', amount: 1 },
      { resource: 'vine', amount: 0 },
    ]);
  });

  it('Wurfbeil (2 Kupfer + 1 Feder) → 1 Kupfer + 0 Feder (Feder = Kampf-Drop)', () => {
    expect(disenchantRefund('throwing_axe', allRecipes)).toEqual([
      { resource: 'copper_ore', amount: 1 },
      { resource: 'feather', amount: 0 },
    ]);
  });

  it('cards without a recipe (starter cards) are not disenchantable', () => {
    expect(disenchantRefund('axe_strike', allRecipes)).toBeNull();
    expect(disenchantRefund('wooden_shield', allRecipes)).toBeNull();
  });
});

describe('disenchantCard', () => {
  it('removes one copy from collection, credits refund, leaves deck alone', () => {
    const result = disenchantCard(
      { wood: 1 },
      ['heavy_blow', 'heavy_blow'],
      starterDeckIds,
      'heavy_blow',
      allRecipes,
    );
    expect(result).not.toBeNull();
    expect(result!.inventory).toEqual({ wood: 1, copper_ore: 1 });
    expect(result!.collection).toEqual(['heavy_blow']);
    expect(result!.deck).toEqual(starterDeckIds);
  });

  it('removes the card from the deck too when slotted (deck may drop below 12)', () => {
    const deck = [...starterDeckIds.slice(1), 'heavy_blow'];
    const result = disenchantCard({}, ['heavy_blow'], deck, 'heavy_blow', allRecipes);
    expect(result!.deck).toEqual(starterDeckIds.slice(1));
    expect(result!.deck).toHaveLength(11);
    expect(result!.collection).toEqual([]);
  });

  it('fails when the card is not in the collection', () => {
    expect(disenchantCard({}, [], [], 'heavy_blow', allRecipes)).toBeNull();
  });

  it('fails for starter cards without a recipe', () => {
    expect(disenchantCard({}, ['axe_strike'], [], 'axe_strike', allRecipes)).toBeNull();
  });

  it('zero-only refunds add nothing to the inventory', () => {
    // Beerensnack: 3 Beeren → floor(1.5)=1 Beere refund (berry is gatherable)
    const result = disenchantCard({}, ['berry_snack'], [], 'berry_snack', allRecipes);
    expect(result!.inventory).toEqual({ berry: 1 });
  });
});
