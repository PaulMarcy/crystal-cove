/**
 * Market rules (docs/10 Münz-Ökonomie): sell prices per tier, unsellable
 * special/quest material, Piya offer purchases and the too-few-coins guard.
 */
import { describe, expect, it } from 'vitest';
import { piyaOffers, piyaOffersById, sellPrices } from '../../data/market';
import { RESOURCE_IDS, resources } from '../../data/resources';
import { buyOffer, sellPriceOf, sellResource } from './market';

describe('sell prices (docs/10: 1 / 2 / 3 / Glanzstück 15)', () => {
  it('prices the base gathering tier at 1', () => {
    for (const id of ['wood', 'stone', 'berry', 'fish', 'vine'] as const) {
      expect(sellPriceOf(id, sellPrices), id).toBe(1);
    }
  });

  it('prices combat/chance drops at 2 and rare drops at 3', () => {
    for (const id of [
      'resin',
      'beetle_shell',
      'tough_leather',
      'meat',
      'feather',
      'copper_ore',
    ] as const) {
      expect(sellPriceOf(id, sellPrices), id).toBe(2);
    }
    expect(sellPriceOf('shadow_dust', sellPrices)).toBe(3);
    expect(sellPriceOf('honey', sellPrices)).toBe(3);
  });

  it('prices the Glanzstück at 15 (its only purpose, docs/10)', () => {
    expect(sellPriceOf('shiny_trinket', sellPrices)).toBe(15);
  });

  it('keeps quest/special material unsellable (docs/10)', () => {
    expect(sellPriceOf('heart_thorn', sellPrices)).toBeNull();
    expect(sellPriceOf('old_tools', sellPrices)).toBeNull();
  });

  it('only prices known resources, all positive integers', () => {
    for (const [id, price] of Object.entries(sellPrices)) {
      expect(RESOURCE_IDS, id).toContain(id);
      expect(Number.isInteger(price) && price! > 0, id).toBe(true);
    }
  });
});

describe('sellResource', () => {
  it('deducts the items and credits price × amount', () => {
    const result = sellResource({ wood: 5, stone: 2 }, 3, 'wood', 4, sellPrices);
    expect(result).toEqual({ inventory: { wood: 1, stone: 2 }, coins: 7 });
  });

  it('refuses unsellable material even when the inventory holds it', () => {
    expect(sellResource({ heart_thorn: 2 }, 0, 'heart_thorn', 1, sellPrices)).toBeNull();
  });

  it('refuses when the inventory holds fewer units', () => {
    expect(sellResource({ wood: 2 }, 0, 'wood', 3, sellPrices)).toBeNull();
  });

  it('refuses non-positive or fractional amounts', () => {
    expect(sellResource({ wood: 5 }, 0, 'wood', 0, sellPrices)).toBeNull();
    expect(sellResource({ wood: 5 }, 0, 'wood', -1, sellPrices)).toBeNull();
    expect(sellResource({ wood: 5 }, 0, 'wood', 1.5, sellPrices)).toBeNull();
  });

  it('never mutates the input inventory', () => {
    const inventory = { wood: 5 };
    sellResource(inventory, 0, 'wood', 5, sellPrices);
    expect(inventory).toEqual({ wood: 5 });
  });
});

describe('buyOffer (docs/10 Piya-Sortiment)', () => {
  it('deducts coins and credits the offer items', () => {
    const offer = piyaOffersById['offer_resin']!;
    const result = buyOffer(25, { wood: 1 }, offer);
    expect(result).toEqual({ inventory: { wood: 1, resin: 1 }, coins: 15 });
  });

  it('refuses when coins do not cover the price', () => {
    const offer = piyaOffersById['offer_heart_thorn']!;
    expect(buyOffer(59, {}, offer)).toBeNull();
    expect(buyOffer(60, {}, offer)).not.toBeNull();
  });

  it('ships the docs/10 stock: Käferpanzer 12, Harz 10, Herzdorn 60', () => {
    const byResource = Object.fromEntries(piyaOffers.map((o) => [o.resource, o.price]));
    expect(byResource).toEqual({ beetle_shell: 12, resin: 10, heart_thorn: 60 });
    // Buying stays a shortcut, never an exploit: every offer costs more
    // than selling it back would yield (docs/10 "teurer als Erspielen").
    for (const offer of piyaOffers) {
      const sellValue = (sellPrices[offer.resource] ?? 0) * offer.amount;
      expect(offer.price, offer.id).toBeGreaterThan(sellValue);
      expect(RESOURCE_IDS, offer.id).toContain(offer.resource);
      expect(resources[offer.resource], offer.id).toBeDefined();
    }
  });
});
