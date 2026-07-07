import { strings } from '../../shared/strings';

/** Energy orb "3/3", orange (docs/11 Zonen-Layout, unten links). */
export function EnergyOrb({ energy, max }: { energy: number; max: number }) {
  return (
    <div className="energy-orb" title={strings.combat.energy}>
      <span aria-hidden>⚡</span>
      <span className="energy-value">
        {energy}/{max}
      </span>
    </div>
  );
}

/** Card-back pile badge with counter (draw bottom-left, discard bottom-right). */
export function PileBadge({ kind, count }: { kind: 'draw' | 'discard'; count: number }) {
  const label = kind === 'draw' ? strings.combat.drawPile : strings.combat.discardPile;
  return (
    <div className={`pile-badge pile-badge--${kind}`} title={label}>
      <span className="pile-back" aria-hidden>
        🂠
      </span>
      <span className="pile-count">{count}</span>
      <span className="pile-label">{label}</span>
    </div>
  );
}

/** Orange primary button (docs/11: Zug beenden, rechts über der Ablage). */
export function EndTurnButton({ onClick, disabled }: { onClick: () => void; disabled: boolean }) {
  return (
    <button className="end-turn-button" onClick={onClick} disabled={disabled}>
      {strings.combat.endTurn}
    </button>
  );
}

/** Retreat action, top right: "Rückzugsversuch (75 %)" — can fail (docs/03). */
export function RetreatButton({
  chance,
  onClick,
  disabled,
}: {
  chance: number;
  onClick: () => void;
  disabled: boolean;
}) {
  return (
    <button className="retreat-button" onClick={onClick} disabled={disabled}>
      {strings.combat.retreatAttempt} ({Math.round(chance * 100)} %)
    </button>
  );
}
