/**
 * Market prices & Piya's stock (M5, docs/10 Münz-Ökonomie).
 * Pure data — sell/buy rules live in core/economy/market (CLAUDE.md rule 2).
 *
 * Sell prices (docs/10, 1–3 per unit): Basis-Sammelgut 1 · Kampf-/Chance-
 * Drops 2 · seltene Drops 3 · Glanzstück 15. Resources ABSENT from the map
 * are unsellable — per docs/10 that is Spezial-/Questmaterial (Herzdorn,
 * Maros Werkzeug) plus everything the doc does not price (Schattenfaser,
 * Kürbis, Chili — not listed under "Überschussmaterial").
 */
import type { BuildingSlotId } from './buildings';
import type { ResourceId } from './resources';

/** Building slot whose built stage enables Markt + Schwarzes Brett (docs/09 B8). */
export const marketSlot: BuildingSlotId = 'b8';

export const sellPrices: Readonly<Partial<Record<ResourceId, number>>> = {
  // Basis-Sammelgut (docs/10: Holz/Stein/Beere/Fisch/Ranken 1)
  wood: 1,
  stone: 1,
  berry: 1,
  fish: 1,
  vine: 1,
  // Kampf-/Chance-Drops (docs/10: Harz/Käferpanzer/Leder/Fleisch/Feder/Kupfer 2)
  resin: 2,
  beetle_shell: 2,
  tough_leather: 2,
  meat: 2,
  feather: 2,
  copper_ore: 2,
  // Seltene Drops (docs/10: Schattenstaub/Honig 3)
  shadow_dust: 3,
  honey: 3,
  // Glanzstück (docs/10: existiert nur, um verkauft zu werden)
  shiny_trinket: 15,
};

/** One purchasable line in Piya's stock (buy rules in core/economy/market). */
export interface MarketOfferDef {
  id: string;
  resource: ResourceId;
  /** Units credited per purchase. */
  amount: number;
  /** Coin price per purchase. */
  price: number;
}

/**
 * Piya's stock (docs/10 Senken: Käferpanzer 12, Harz 10, Herzdorn 60 —
 * teurer als Erspielen, Kaufen ist Abkürzung, nie Pflicht).
 *
 * V1: FIXED stock. docs/09/10 specify a rotation per world-map VISIT —
 * the world map ships post-V1, so rotation docks here later (the offer-id
 * indirection in core/economy/market is rotation-ready).
 */
export const piyaOffers: readonly MarketOfferDef[] = [
  { id: 'offer_beetle_shell', resource: 'beetle_shell', amount: 1, price: 12 },
  { id: 'offer_resin', resource: 'resin', amount: 1, price: 10 },
  { id: 'offer_heart_thorn', resource: 'heart_thorn', amount: 1, price: 60 },
];

export const piyaOffersById: Readonly<Record<string, MarketOfferDef>> = Object.fromEntries(
  piyaOffers.map((o) => [o.id, o]),
);
