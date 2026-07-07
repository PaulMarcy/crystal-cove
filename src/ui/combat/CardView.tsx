import type { CombatCard } from '../../core/combat/types';
import { strings } from '../../shared/strings';
import { cardTypeIcons } from './icons';

/** Interaction state of a hand card (docs/11, 7 states — hover is pure CSS). */
export type CardUiState = 'playable' | 'unplayable' | 'selected' | 'flying';

export interface CardViewProps {
  card: CombatCard;
  cost: number;
  uiState: CardUiState;
  /** Fan rotation in degrees (max ±12, docs/11). Selected cards render at 0. */
  rotation: number;
  /** Draw-stagger index (60 ms per card, docs/11 Ablauf-Feedback). */
  drawIndex: number;
  wiggle: boolean;
  onClick: () => void;
  attachEl: (el: HTMLDivElement | null) => void;
}

/**
 * Card anatomy per docs/11: cost gem top left (orange affordable / grey too
 * expensive), name, icon center, type stripe bottom. Base ratio 86×120.
 */
export function CardView(props: CardViewProps) {
  const { card, cost, uiState, rotation, drawIndex, onClick, attachEl } = props;
  const def = card.def;
  const description =
    strings.cards[def.id as keyof typeof strings.cards]?.description ?? '';
  const classes = [
    'card',
    `card--${uiState}`,
    props.wiggle ? 'card--wiggle' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div
      className={classes}
      ref={attachEl}
      style={
        {
          '--card-rotation': `${uiState === 'selected' ? 0 : rotation}deg`,
          '--draw-delay': `${drawIndex * 60}ms`,
        } as React.CSSProperties
      }
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
    >
      <span className={`cost-gem${uiState === 'unplayable' ? ' cost-gem--grey' : ''}`}>
        {cost}
      </span>
      <span className="card-name">{def.name}</span>
      <span className="card-art" aria-hidden>
        {cardTypeIcons[def.type]}
      </span>
      <span className="card-text">{description}</span>
      <span className="type-stripe" data-card-type={def.type}>
        {strings.combat.cardTypes[def.type]}
      </span>
      <span className="tooltip tooltip--card" role="tooltip">
        <strong>{def.name}</strong> · {cost}⚡ · {strings.combat.cardTypes[def.type]}
        <br />
        {description}
        {def.type === 'status' && (
          <>
            <br />
            {strings.combat.unplayable}
          </>
        )}
      </span>
    </div>
  );
}
