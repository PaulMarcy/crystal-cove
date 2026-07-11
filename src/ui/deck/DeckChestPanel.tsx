import { useEffect, useState } from 'react';
import { countCards, ownedCounts } from '../../core/deck/deck';
import { disenchantRefund } from '../../core/economy/disenchant';
import { starterDeckIds } from '../../data/cards/tier1';
import { deckConfig } from '../../data/deck';
import { allRecipes } from '../../data/recipes';
import { strings } from '../../shared/strings';
import { useGameStore } from '../../shared/store';

const itemNames = strings.items as Readonly<Record<string, string>>;
const cardStrings = strings.cards as Readonly<
  Record<string, { name: string; description: string }>
>;

function cardName(cardId: string): string {
  return cardStrings[cardId]?.name ?? cardId;
}

/** "1× Kupfererz, 0× Stein" — every line shown, transparency over the 50 %/special rule. */
function refundText(cardId: string): string {
  const refund = disenchantRefund(cardId, allRecipes);
  if (!refund) return strings.deckChest.notDisenchantable;
  if (refund.length === 0) return strings.deckChest.refundNothing;
  const parts = refund.map((l) => `${l.amount}× ${itemNames[l.resource] ?? l.resource}`);
  return strings.deckChest.refundPreview.replace('{refund}', parts.join(', '));
}

interface CollectionRowProps {
  cardId: string;
  owned: number;
  inDeck: number;
  crafted: number;
}

function CollectionRow({ cardId, owned, inDeck, crafted }: CollectionRowProps) {
  const addCardToDeck = useGameStore((s) => s.addCardToDeck);
  const disenchant = useGameStore((s) => s.disenchant);
  const [confirming, setConfirming] = useState(false);
  const disenchantable = crafted > 0 && disenchantRefund(cardId, allRecipes) !== null;

  return (
    <li className="deck-chest-card">
      <div className="deck-chest-card-head">
        <span className="deck-chest-card-name">{cardName(cardId)}</span>
        <span className="deck-chest-card-counts">
          {strings.deckChest.ownedCopies.replace('{count}', String(owned))} ·{' '}
          {strings.deckChest.inDeckCopies.replace('{count}', String(inDeck))}
        </span>
      </div>
      <p className="deck-chest-card-desc">{cardStrings[cardId]?.description ?? ''}</p>
      <div className="deck-chest-card-actions">
        <button disabled={inDeck >= owned} onClick={() => addCardToDeck(cardId)}>
          {strings.deckChest.addToDeck}
        </button>
        {disenchantable && !confirming && (
          <button onClick={() => setConfirming(true)}>{strings.deckChest.disenchant}</button>
        )}
        {crafted > 0 && !disenchantable && (
          <span className="deck-chest-hint">{strings.deckChest.notDisenchantable}</span>
        )}
      </div>
      {confirming && (
        <div className="deck-chest-confirm" role="alertdialog">
          <span>
            {strings.deckChest.disenchantConfirm} {refundText(cardId)}
          </span>
          <button
            onClick={() => {
              disenchant(cardId);
              setConfirming(false);
            }}
          >
            {strings.deckChest.disenchantYes}
          </button>
          <button onClick={() => setConfirming(false)}>{strings.deckChest.disenchantNo}</button>
        </div>
      )}
    </li>
  );
}

/**
 * Deck-Truhe overlay (docs/03 "Deck = Rucksack"): collection on the left,
 * assembled combat deck (x/12) on the right; cards move between the two,
 * crafted cards can be disenchanted (docs/10, refund preview + confirm).
 * Pure render layer — all rules live in core/deck and core/economy.
 */
export function DeckChestPanel() {
  const activeStation = useGameStore((s) => s.activeStation);
  const closeStation = useGameStore((s) => s.closeStation);
  const collection = useGameStore((s) => s.collection);
  const deck = useGameStore((s) => s.deck);
  const removeCardFromDeck = useGameStore((s) => s.removeCardFromDeck);

  const open = activeStation === 'deck_chest';
  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeStation();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, closeStation]);

  if (!open) return null;

  const owned = ownedCounts(starterDeckIds, collection);
  const deckCounts = countCards(deck);
  const craftedCounts = countCards(collection);
  const ownedIds = Object.keys(owned).sort((a, b) => cardName(a).localeCompare(cardName(b)));
  const deckIds = Object.keys(deckCounts).sort((a, b) => cardName(a).localeCompare(cardName(b)));

  return (
    <section className="deck-chest-panel" aria-label={strings.stations.deck_chest}>
      <header className="workshop-header">
        <h2 className="workshop-title">{strings.stations.deck_chest}</h2>
        <button className="workshop-close" onClick={closeStation}>
          {strings.workshop.close}
        </button>
      </header>
      {deck.length !== deckConfig.deckSize && (
        <p className="deck-chest-warning" role="alert">
          {strings.deckChest.deckIncomplete.replace('{size}', String(deckConfig.deckSize))}
        </p>
      )}
      <div className="deck-chest-columns">
        <div className="deck-chest-column">
          <h3>{strings.deckChest.collectionHeading}</h3>
          <p className="deck-chest-hint">
            {strings.deckChest.dishSlotHint.replace('{slots}', String(deckConfig.dishSlots))}
          </p>
          {ownedIds.length === 0 && <p>{strings.deckChest.emptyCollection}</p>}
          <ul className="deck-chest-list">
            {ownedIds.map((id) => (
              <CollectionRow
                key={id}
                cardId={id}
                owned={owned[id] ?? 0}
                inDeck={deckCounts[id] ?? 0}
                crafted={craftedCounts[id] ?? 0}
              />
            ))}
          </ul>
        </div>
        <div className="deck-chest-column">
          <h3>
            {strings.deckChest.deckHeading
              .replace('{count}', String(deck.length))
              .replace('{size}', String(deckConfig.deckSize))}
          </h3>
          <ul className="deck-chest-list">
            {deckIds.map((id) => (
              <li key={id} className="deck-chest-card">
                <div className="deck-chest-card-head">
                  <span className="deck-chest-card-name">
                    {cardName(id)} ×{deckCounts[id]}
                  </span>
                  <button onClick={() => removeCardFromDeck(id)}>
                    {strings.deckChest.removeFromDeck}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
