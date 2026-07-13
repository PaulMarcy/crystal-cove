import { useCallback, useRef, useState } from 'react';
import { getIntentPreview } from '../../core/combat/intent';
import type { CombatCard, CombatState } from '../../core/combat/types';
import { cardNeedsTarget, getValidTargets, isCardPlayable } from '../../core/combat/view';
import { combatConfig } from '../../data/combat';
import { dungeonsById } from '../../data/dungeons/verwachseneHoehle';
import { useGameStore } from '../../shared/store';
import { strings } from '../../shared/strings';
import { EnemyView } from './EnemyView';
import { Hand } from './Hand';
import { EndTurnButton, EnergyOrb, PileBadge, RetreatButton } from './hud';
import { PlayerView } from './PlayerView';
import { TargetingLayer } from './TargetingLayer';

const FLY_DURATION_MS = 240;
const WIGGLE_DURATION_MS = 350;

interface Point {
  x: number;
  y: number;
}

/** Loot panel content: the actually rolled drops (store rolls them on victory). */
function LootList() {
  const loot = useGameStore((s) => s.combatLoot);
  return (
    <ul className="loot-list">
      {Object.entries(loot ?? {}).map(([item, amount]) => (
        <li key={item}>
          {strings.items[item as keyof typeof strings.items] ?? item} ×{amount}
        </li>
      ))}
    </ul>
  );
}

/** Victory / defeat / retreat overlay (docs/11 Ablauf-Feedback). */
function OutcomePanel({ state, onClose }: { state: CombatState; onClose: () => void }) {
  if (state.phase === 'victory') {
    return (
      <div className="outcome-backdrop">
        <div className="outcome-panel outcome-panel--victory">
          <h2>{strings.combat.victoryTitle}</h2>
          <h3>{strings.combat.lootHeading}</h3>
          <LootList />
          <button className="end-turn-button" onClick={onClose}>
            {strings.combat.backToIsland}
          </button>
        </div>
      </div>
    );
  }
  const title =
    state.phase === 'defeat' ? strings.combat.defeatTitle : strings.combat.retreatedTitle;
  const body = state.phase === 'defeat' ? strings.combat.defeatBody : strings.combat.retreatedBody;
  return (
    <div className={`outcome-backdrop${state.phase === 'defeat' ? ' outcome-backdrop--fade' : ''}`}>
      <div className="outcome-panel">
        <h2>{title}</h2>
        <p>{body}</p>
        <button className="end-turn-button" onClick={onClose}>
          {strings.combat.backToIsland}
        </button>
      </div>
    </div>
  );
}

/**
 * Combat screen (docs/11): reads ONLY store state, dispatches events to
 * core/combat via the store. All local useState here is presentation state
 * (selection, cursor, animation ticks) — never game rules.
 */
export function CombatScreen() {
  const state = useGameStore((s) => s.combat);
  const dispatch = useGameStore((s) => s.dispatchCombat);
  const endCombat = useGameStore((s) => s.endCombat);
  const density = useGameStore((s) => s.shadowDensity);
  const dungeonRun = useGameStore((s) => s.currentDungeonRun);

  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [hoveredEnemyId, setHoveredEnemyId] = useState<string | null>(null);
  const [cursor, setCursor] = useState<Point | null>(null);
  const [wigglingCardId, setWigglingCardId] = useState<string | null>(null);
  const [flyingCardId, setFlyingCardId] = useState<string | null>(null);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const enemyRefs = useRef(new Map<string, HTMLDivElement>());
  const cardRefs = useRef(new Map<string, HTMLDivElement>());

  const registerCardRef = useCallback((id: string, el: HTMLDivElement | null) => {
    if (el) cardRefs.current.set(id, el);
    else cardRefs.current.delete(id);
  }, []);

  const toLocal = useCallback((clientX: number, clientY: number): Point => {
    const rect = containerRef.current?.getBoundingClientRect();
    return rect ? { x: clientX - rect.left, y: clientY - rect.top } : { x: clientX, y: clientY };
  }, []);

  const centerOf = useCallback(
    (el: HTMLElement | undefined | null): Point | null => {
      if (!el || !containerRef.current) return null;
      const rect = el.getBoundingClientRect();
      return toLocal(rect.left + rect.width / 2, rect.top + rect.height / 2);
    },
    [toLocal],
  );

  // Targeting geometry (arrow origin, target ring) is measured in event
  // handlers, never during render (react-hooks/refs).
  const [arrowOrigin, setArrowOrigin] = useState<Point | null>(null);
  const [ringCenter, setRingCenter] = useState<Point | null>(null);

  if (!state) return null;

  const selectedCard = state.hand.find((c) => c.instanceId === selectedCardId) ?? null;
  const selectedNeedsTarget = selectedCard ? cardNeedsTarget(selectedCard.def) : false;
  const validTargets = selectedCard ? getValidTargets(state, selectedCard.def) : [];
  const busy = flyingCardId !== null || state.phase !== 'playerTurn';

  const wiggle = (cardId: string) => {
    setWigglingCardId(cardId);
    window.setTimeout(
      () => setWigglingCardId((id) => (id === cardId ? null : id)),
      WIGGLE_DURATION_MS,
    );
  };

  /** Confirmed play: card flies to its destination, then the event fires. */
  const playWithFlight = (card: CombatCard, targetEnemyId?: string) => {
    const cardEl = cardRefs.current.get(card.instanceId);
    const from = centerOf(cardEl);
    const to = targetEnemyId ? centerOf(enemyRefs.current.get(targetEnemyId)) : null;
    if (cardEl && from) {
      const dx = to ? to.x - from.x : 0;
      const dy = to ? to.y - from.y : -140;
      cardEl.style.setProperty('--fly-x', `${dx}px`);
      cardEl.style.setProperty('--fly-y', `${dy}px`);
    }
    setFlyingCardId(card.instanceId);
    setSelectedCardId(null);
    setArrowOrigin(null);
    setRingCenter(null);
    window.setTimeout(() => {
      dispatch({
        type: 'PLAY_CARD',
        cardInstanceId: card.instanceId,
        ...(targetEnemyId !== undefined ? { targetEnemyId } : {}),
      });
      setFlyingCardId(null);
    }, FLY_DURATION_MS);
  };

  const selectCard = (instanceId: string | null) => {
    setSelectedCardId(instanceId);
    const def =
      instanceId !== null
        ? (state.hand.find((c) => c.instanceId === instanceId)?.def ?? null)
        : null;
    const needsTarget = def !== null && cardNeedsTarget(def);
    setArrowOrigin(needsTarget && instanceId ? centerOf(cardRefs.current.get(instanceId)) : null);
    if (!needsTarget) setRingCenter(null);
  };

  const onCardClick = (card: CombatCard) => {
    if (busy) return;
    if (!isCardPlayable(state, card)) {
      wiggle(card.instanceId); // Kopfschütteln (docs/11, nicht spielbar)
      return;
    }
    if (card.instanceId === selectedCardId) {
      // Second click on a selected targetless card plays it (docs/11).
      if (!cardNeedsTarget(card.def)) playWithFlight(card);
      else selectCard(null);
      return;
    }
    selectCard(card.instanceId);
  };

  const onEnemyClick = (enemyInstanceId: string) => {
    if (busy || !selectedCard || !selectedNeedsTarget) return;
    if (!validTargets.includes(enemyInstanceId)) return;
    playWithFlight(selectedCard, enemyInstanceId);
  };

  return (
    <div
      className="combat-screen"
      ref={containerRef}
      onMouseMove={(e) => {
        if (selectedNeedsTarget) setCursor(toLocal(e.clientX, e.clientY));
      }}
      onClick={() => selectCard(null)}
    >
      <div className="combat-stage">
        <div className="location-chip">
          {dungeonRun
            ? // Dungeon fight: dungeon name + room progress instead of the zone chip.
              strings.combat.dungeonLocationChip
                .replace('{dungeon}', dungeonsById[dungeonRun.dungeonId]?.name ?? '')
                .replace('{room}', String(dungeonRun.roomIndex + 1))
                .replace(
                  '{total}',
                  String(dungeonsById[dungeonRun.dungeonId]?.rooms.length ?? 0),
                )
            : strings.combat.locationChip.replace('{density}', String(density))}
        </div>
        <RetreatButton
          chance={state.retreatChance}
          disabled={busy}
          onClick={() => dispatch({ type: 'RETREAT' })}
        />
        <PlayerView player={state.player} />
        <div className="enemy-group">
          {state.enemies.map((enemy) => (
            <EnemyView
              key={enemy.instanceId}
              enemy={enemy}
              intentPreview={getIntentPreview(state, enemy.instanceId)}
              turn={state.turn}
              isValidTarget={validTargets.includes(enemy.instanceId)}
              isHoveredTarget={hoveredEnemyId === enemy.instanceId}
              onHover={(hovering) => {
                setHoveredEnemyId((id) =>
                  hovering ? enemy.instanceId : id === enemy.instanceId ? null : id,
                );
                if (hovering && validTargets.includes(enemy.instanceId)) {
                  setRingCenter(centerOf(enemyRefs.current.get(enemy.instanceId)));
                } else {
                  setRingCenter(null);
                }
              }}
              onClick={() => onEnemyClick(enemy.instanceId)}
              attachEl={(el) => {
                if (el) enemyRefs.current.set(enemy.instanceId, el);
                else enemyRefs.current.delete(enemy.instanceId);
              }}
            />
          ))}
        </div>
      </div>

      <div className="combat-bottom">
        <div className="combat-bottom-left">
          <EnergyOrb energy={state.player.energy} max={combatConfig.energyPerTurn} />
          <PileBadge kind="draw" count={state.drawPile.length} />
        </div>
        <Hand
          state={state}
          selectedCardId={selectedCardId}
          flyingCardId={flyingCardId}
          wigglingCardId={wigglingCardId}
          onCardClick={onCardClick}
          attachCardEl={registerCardRef}
        />
        <div className="combat-bottom-right">
          <EndTurnButton disabled={busy} onClick={() => dispatch({ type: 'END_TURN' })} />
          <PileBadge kind="discard" count={state.discardPile.length} />
        </div>
      </div>

      <TargetingLayer
        origin={arrowOrigin}
        cursor={cursor}
        targetRing={ringCenter ? { ...ringCenter, r: 56 } : null}
      />

      {state.phase !== 'playerTurn' && <OutcomePanel state={state} onClose={endCombat} />}
    </div>
  );
}
