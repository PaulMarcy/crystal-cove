import { useEffect, useRef, useState } from 'react';
import type { EnemyState } from '../../core/combat/types';
import type { IntentPreview } from '../../core/combat/intent';
import { strings } from '../../shared/strings';
import { intentIcons } from './icons';
import { StatusRow } from './StatusRow';

/** HP bar without numbers (docs/11) — exact values live in the hover tooltip. */
function HpBar({ hp, maxHp, poisoned }: { hp: number; maxHp: number; poisoned: boolean }) {
  const ratio = Math.max(0, hp / maxHp);
  return (
    <div className={`hp-bar${poisoned ? ' hp-bar--poison' : ''}`}>
      <div className="hp-bar-fill" style={{ width: `${ratio * 100}%` }} />
    </div>
  );
}

/**
 * Intent chip above the enemy (docs/11): icon vocabulary from docs/07,
 * attack numbers are the true numbers incl. buffs, multi-hit as "2×2".
 * Remounts on intent change → fade-in AFTER the enemy action (CSS delay).
 */
function IntentChip({ preview }: { preview: IntentPreview }) {
  return (
    <div
      className={`intent-chip${preview.emphasis ? ' intent-chip--emphasis' : ''}`}
      data-intent={preview.kind}
    >
      <span aria-hidden>{intentIcons[preview.kind]}</span>
      <span className="intent-label">{strings.combat.intents[preview.kind]}</span>
      {preview.attacks.map((attack, i) => (
        <span key={i} className="intent-number">
          {attack.times > 1 ? `${attack.times}×${attack.amount}` : attack.amount}
          {attack.ignoresBlock ? '!' : ''}
        </span>
      ))}
      {preview.emphasis && (
        // Boss telegraph (docs/07): extra large AND explicit text — the
        // warning is never conveyed by size/color alone (docs/11).
        <span className="intent-emphasis-text">{strings.combat.intentEmphasis}</span>
      )}
    </div>
  );
}

export interface EnemyViewProps {
  enemy: EnemyState;
  intentPreview: IntentPreview | undefined;
  /** Combat turn — keys the intent chip so it re-animates each enemy action. */
  turn: number;
  isValidTarget: boolean;
  isHoveredTarget: boolean;
  onHover: (hovering: boolean) => void;
  onClick: () => void;
  attachEl: (el: HTMLDivElement | null) => void;
}

/** One enemy on the stage: sprite placeholder, intent, hp bar, statuses. */
export function EnemyView(props: EnemyViewProps) {
  const { enemy, intentPreview, turn, isValidTarget, onHover, onClick, attachEl } = props;
  const dead = enemy.hp <= 0;

  // Hit feedback (docs/11): flinch 4 px + white flash 80 ms when hp drops.
  const prevHp = useRef(enemy.hp);
  const [hitTick, setHitTick] = useState(0);
  useEffect(() => {
    if (enemy.hp < prevHp.current) setHitTick((t) => t + 1);
    prevHp.current = enemy.hp;
  }, [enemy.hp]);

  return (
    <div
      className={`enemy-view${dead ? ' enemy-view--dead' : ''}${isValidTarget ? ' enemy-view--targetable' : ''}`}
      ref={attachEl}
      onMouseEnter={() => onHover(true)}
      onMouseLeave={() => onHover(false)}
      onClick={onClick}
    >
      {!dead && intentPreview && (
        <IntentChip key={`${turn}-${enemy.patternIndex}`} preview={intentPreview} />
      )}
      <div key={hitTick} className={`enemy-sprite${hitTick > 0 ? ' hit-flash' : ''}`}>
        <span className="sprite-glyph" aria-hidden>
          {dead ? '✕' : '👾'}
        </span>
        <span className="sprite-name">{enemy.def.name}</span>
      </div>
      {!dead && (
        <>
          <HpBar hp={enemy.hp} maxHp={enemy.maxHp} poisoned={(enemy.statuses.poison ?? 0) > 0} />
          <div className="enemy-substatus">
            {enemy.block > 0 && <BlockChip block={enemy.block} />}
            <StatusRow statuses={enemy.statuses} />
          </div>
          <span className="tooltip tooltip--enemy" role="tooltip">
            <strong>{enemy.def.name}</strong>
            <br />
            {strings.combat.hp}: {enemy.hp}/{enemy.maxHp}
            {enemy.block > 0 && (
              <>
                <br />
                {strings.combat.block}: {enemy.block}
              </>
            )}
          </span>
        </>
      )}
    </div>
  );
}

/** Shield chip with number — pops when the value changes (docs/11). */
export function BlockChip({ block }: { block: number }) {
  return (
    <span key={block} className="block-chip">
      <span aria-hidden>🛡</span> {block}
    </span>
  );
}
