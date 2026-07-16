/**
 * Market rules (M5, docs/10 Münz-Ökonomie) — pure, engine-free
 * (CLAUDE.md rule 1). Prices and Piya's stock are injected from src/data
 * (data/market); coins are a plain number OUTSIDE the item inventory —
 * they are not a ResourceId, never disenchant material and never part of
 * the defeat loot penalty (docs/03 penalty targets Run-BEUTE only).
 */
import type { MarketOfferDef } from '../../data/market';
import type { ResourceId } from '../../data/resources';
import { addItem, removeItem, type Inventory } from './inventory';

/** Coin price per unit, or null when the resource is unsellable (docs/10). */
export function sellPriceOf(
  resource: ResourceId,
  prices: Readonly<Partial<Record<ResourceId, number>>>,
): number | null {
  return prices[resource] ?? null;
}

export interface MarketOutcome {
  inventory: Inventory;
  coins: number;
}

/**
 * Sells `amount` units of a resource. Null when the resource is unsellable
 * (Spezial-/Questmaterial, docs/10), the amount is no positive integer, or
 * the inventory holds fewer units — callers must not mutate state then.
 */
export function sellResource(
  inventory: Inventory,
  coins: number,
  resource: ResourceId,
  amount: number,
  prices: Readonly<Partial<Record<ResourceId, number>>>,
): MarketOutcome | null {
  const price = sellPriceOf(resource, prices);
  if (price === null) return null;
  if (!Number.isInteger(amount) || amount <= 0) return null;
  const next = removeItem(inventory, resource, amount);
  if (next === null) return null;
  return { inventory: next, coins: coins + price * amount };
}

/**
 * Buys one of Piya's offers: deducts the coin price, credits the items.
 * Null when the coins do not cover the price.
 */
export function buyOffer(
  coins: number,
  inventory: Inventory,
  offer: MarketOfferDef,
): MarketOutcome | null {
  if (coins < offer.price) return null;
  return {
    inventory: addItem(inventory, offer.resource, offer.amount),
    coins: coins - offer.price,
  };
}
