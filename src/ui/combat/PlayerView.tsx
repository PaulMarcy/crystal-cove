import { useEffect, useRef, useState } from 'react';
import type { PlayerState } from '../../core/combat/types';
import { strings } from '../../shared/strings';
import { BlockChip } from './EnemyView';
import { StatusRow } from './StatusRow';

/** HP as number + heart (docs/11 Spieler-Status: "42/55" + Herz). */
function HpPlate({ hp, maxHp }: { hp: number; maxHp: number }) {
  return (
    <span className="hp-plate">
      <span aria-hidden>❤</span> {hp}/{maxHp}
    </span>
  );
}

/** Player figure on the stage with HP plate, block chip and status row. */
export function PlayerView({ player }: { player: PlayerState }) {
  const prevHp = useRef(player.hp);
  const [hitTick, setHitTick] = useState(0);
  useEffect(() => {
    if (player.hp < prevHp.current) setHitTick((t) => t + 1);
    prevHp.current = player.hp;
  }, [player.hp]);

  return (
    <div className="player-view">
      <div key={hitTick} className={`player-sprite${hitTick > 0 ? ' hit-flash' : ''}`}>
        <span className="sprite-glyph" aria-hidden>
          🧑‍🌾
        </span>
        <span className="sprite-name">{strings.combat.playerName}</span>
      </div>
      <div className="player-status">
        <HpPlate hp={player.hp} maxHp={player.maxHp} />
        {player.block > 0 && <BlockChip block={player.block} />}
        <StatusRow statuses={player.statuses} />
      </div>
    </div>
  );
}
