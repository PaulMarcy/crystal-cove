import { useEffect, useState } from 'react';
import { sellPriceOf } from '../../core/economy/market';
import { marketSlot, piyaOffers, sellPrices, type MarketOfferDef } from '../../data/market';
import type { ResourceId } from '../../data/resources';
import { strings } from '../../shared/strings';
import { activeBoardRequestOf, useGameStore } from '../../shared/store';

const itemNames = strings.items as Readonly<Record<string, string>>;
const boardRequestTexts = strings.board.requests as Readonly<Record<string, string>>;

function itemName(id: string): string {
  return itemNames[id] ?? id;
}

interface SellRow {
  resource: string;
  count: number;
  price: number;
}

/**
 * Markt-Panel (M5 Task 4b, docs/09 B8 + docs/10 Münz-Ökonomie): Verkaufen
 * (nur verkäufliches Material — Preise aus data/market), Piyas Sortiment
 * und das Schwarze Brett (nur am gebauten B8, wie die Erfüllen-Regel im
 * Store). Blockierte Aktionen begründen sich als TEXT, nie nur über
 * Farbe/Disabled (docs/11). Pure render layer — Verkaufs-/Kauf-/Brett-Regeln
 * leben in core/economy, dispatched über den Store.
 */
export function MarketPanel() {
  const marketOpen = useGameStore((s) => s.marketOpen);
  // Content only mounts while open — its local action feedback (notice)
  // dies with the panel instead of leaking into the next visit.
  if (!marketOpen) return null;
  return <MarketPanelContent />;
}

function MarketPanelContent() {
  const closeMarket = useGameStore((s) => s.closeMarket);
  const inventory = useGameStore((s) => s.inventory);
  const coins = useGameStore((s) => s.coins);
  const sellResource = useGameStore((s) => s.sellResource);
  const buyMarketOffer = useGameStore((s) => s.buyMarketOffer);
  const fulfillActiveBoardRequest = useGameStore((s) => s.fulfillActiveBoardRequest);
  const boardRequestFulfilled = useGameStore((s) => s.boardRequestFulfilled);
  const marketBuilt = useGameStore((s) => (s.builtBuildings[marketSlot] ?? 0) >= 1);
  const request = useGameStore(activeBoardRequestOf);
  // Feedback of the LAST panel action (sold/bought/fulfilled) — transient
  // render state, no game logic (amounts come from the store transition).
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeMarket();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [closeMarket]);

  // Only sellable material is listed at all (docs/10: Spezial-/Questmaterial
  // taucht im Verkauf gar nicht auf) — prices are pure data (data/market).
  const sellRows: SellRow[] = Object.entries(inventory)
    .map(([resource, count]) => ({
      resource,
      count,
      price: sellPriceOf(resource as ResourceId, sellPrices),
    }))
    .filter((row): row is SellRow => row.count > 0 && row.price !== null);

  const handleSell = (row: SellRow, amount: number): void => {
    if (!sellResource(row.resource, amount)) return;
    setNotice(
      strings.market.soldToast
        .replace('{amount}', String(amount))
        .replace('{item}', itemName(row.resource))
        .replace('{coins}', String(row.price * amount)),
    );
  };

  const handleBuy = (offer: MarketOfferDef): void => {
    if (!buyMarketOffer(offer.id)) return;
    setNotice(
      strings.market.boughtToast
        .replace('{item}', itemName(offer.resource))
        .replace('{coins}', String(offer.price)),
    );
  };

  const handleFulfill = (): void => {
    if (!request) return;
    if (!fulfillActiveBoardRequest()) return;
    setNotice(strings.board.fulfilledToast.replace('{coins}', String(request.coinReward)));
  };

  // Render-only progress check ("habe X/Y") — the fulfil RULE stays in core.
  const canFulfill =
    request !== null && request.items.every((item) => (inventory[item.resource] ?? 0) >= item.amount);

  return (
    <section className="market-panel workshop-panel" aria-label={strings.market.title}>
      <header className="workshop-header">
        <h2 className="workshop-title">{strings.market.title}</h2>
        <button className="workshop-close" onClick={closeMarket}>
          {strings.workshop.close}
        </button>
      </header>
      {/* Münzstand als Wort + Zahl (docs/11: Information nie nur als Symbol). */}
      <p className="market-coins">{strings.coins.label.replace('{count}', String(coins))}</p>
      {notice && (
        <p className="market-notice" role="status">
          {notice}
        </p>
      )}

      {/* ── Verkaufen (docs/10 Überschussmaterial) ─────────────────────── */}
      <h3 className="market-heading">{strings.market.sellHeading}</h3>
      {sellRows.length === 0 ? (
        <p className="market-empty">{strings.market.nothingToSell}</p>
      ) : (
        <ul className="market-rows">
          {sellRows.map((row) => (
            <li key={row.resource} className="market-row">
              <span className="market-row-name">
                {itemName(row.resource)} ×{row.count}
              </span>
              <span className="market-row-price">
                {strings.market.sellPriceLabel.replace('{price}', String(row.price))}
              </span>
              <span className="market-row-actions">
                <button className="workshop-craft-button" onClick={() => handleSell(row, 1)}>
                  {strings.market.sellButton}
                </button>
                {row.count > 1 && (
                  <button
                    className="workshop-craft-button"
                    onClick={() => handleSell(row, row.count)}
                  >
                    {strings.market.sellAllButton}
                  </button>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}

      {/* ── Piyas Sortiment (docs/10 Senken; V1 fest, Rotation post-V1) ── */}
      <h3 className="market-heading">{strings.market.buyHeading}</h3>
      <ul className="market-rows">
        {piyaOffers.map((offer) => {
          const affordable = coins >= offer.price;
          return (
            <li key={offer.id} className="market-row">
              <span className="market-row-name">
                {itemName(offer.resource)} ×{offer.amount}
              </span>
              <span className="market-row-price">
                {strings.market.buyPriceLabel.replace('{price}', String(offer.price))}
              </span>
              <span className="market-row-actions">
                <button
                  className="workshop-craft-button"
                  disabled={!affordable}
                  onClick={() => handleBuy(offer)}
                >
                  {strings.market.buyButton}
                </button>
                {/* Grund als TEXT, nie nur Disabled/Farbe (docs/11). */}
                {!affordable && (
                  <span className="market-blocked">{strings.market.notEnoughCoins}</span>
                )}
              </span>
            </li>
          );
        })}
      </ul>
      <p className="market-hint">{strings.market.stockHint}</p>

      {/* ── Schwarzes Brett (docs/10) — hängt am gebauten Markt (B8) ───── */}
      {marketBuilt && request && (
        <>
          <h3 className="market-heading">{strings.board.title}</h3>
          <h4 className="board-active-heading">{strings.board.activeHeading}</h4>
          <p className="board-request-text">{boardRequestTexts[request.id] ?? request.id}</p>
          <p className="board-reward">
            {strings.board.rewardLabel.replace('{coins}', String(request.coinReward))}
          </p>
          {boardRequestFulfilled ? (
            // Einmal pro Schlafphase (docs/10) — Zustand als TEXT.
            <p className="board-fulfilled">{strings.board.alreadyFulfilled}</p>
          ) : (
            <>
              <ul className="market-rows board-progress">
                {request.items.map((item) => {
                  const have = inventory[item.resource] ?? 0;
                  const short = have < item.amount;
                  return (
                    <li
                      key={item.resource}
                      className={short ? 'workshop-ingredient--missing' : undefined}
                    >
                      {itemName(item.resource)} {Math.min(have, item.amount)}/{item.amount}
                      {/* Text marker so missing items are never color-only. */}
                      {short && (
                        <span className="workshop-missing-tag">
                          {' '}
                          ({strings.workshop.missingMaterial})
                        </span>
                      )}
                    </li>
                  );
                })}
              </ul>
              <button
                className="workshop-craft-button"
                disabled={!canFulfill}
                onClick={handleFulfill}
              >
                {strings.board.fulfillButton}
              </button>
              {!canFulfill && <span className="market-blocked"> {strings.board.missingItems}</span>}
            </>
          )}
        </>
      )}
    </section>
  );
}
