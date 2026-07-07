import type { CombatCard, CombatState } from '../../core/combat/types';
import { getEffectiveCost, isCardPlayable } from '../../core/combat/view';
import { CardView, type CardUiState } from './CardView';

export interface HandProps {
  state: CombatState;
  selectedCardId: string | null;
  flyingCardId: string | null;
  wigglingCardId: string | null;
  onCardClick: (card: CombatCard) => void;
  attachCardEl: (instanceId: string, el: HTMLDivElement | null) => void;
}

/** Hand fan, max rotation ±12° with overlap (docs/11 Zonen-Layout). */
export function Hand(props: HandProps) {
  const { state } = props;
  const n = state.hand.length;
  return (
    <div className="hand">
      {state.hand.map((card, i) => {
        const spread = n > 1 ? (i / (n - 1)) * 2 - 1 : 0; // −1 … +1
        const rotation = spread * Math.min(12, n * 2.5);
        let uiState: CardUiState = isCardPlayable(state, card) ? 'playable' : 'unplayable';
        if (card.instanceId === props.selectedCardId) uiState = 'selected';
        if (card.instanceId === props.flyingCardId) uiState = 'flying';
        return (
          <CardView
            key={card.instanceId}
            card={card}
            cost={getEffectiveCost(state, card.def)}
            uiState={uiState}
            rotation={rotation}
            drawIndex={i}
            wiggle={card.instanceId === props.wigglingCardId}
            onClick={() => props.onCardClick(card)}
            attachEl={(el) => props.attachCardEl(card.instanceId, el)}
          />
        );
      })}
    </div>
  );
}
