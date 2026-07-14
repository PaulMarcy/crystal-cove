/**
 * View selectors for the combat UI (docs/11). Pure derivations from
 * CombatState — the UI never re-implements these rules (docs/05, Regel 1).
 */
import { isDefenseCard } from './effects';
import type { CardDef, CombatCard, CombatState } from './types';

/**
 * Effective energy cost of a card: the "Seemannsgarn" free-defense override
 * (docs/09) wins, otherwise cost plus the pending delta (never < 0).
 * Mirrors the reducer's PLAY_CARD cost logic.
 */
export function getEffectiveCost(state: CombatState, card: CardDef): number {
  if (state.firstDefenseCardFree && isDefenseCard(card)) return 0;
  return Math.max(0, card.cost + state.nextCardCostDelta);
}

/** True when any effect requires a chosen enemy ('target'). */
export function cardNeedsTarget(card: CardDef): boolean {
  return card.effects.some((effect) => 'target' in effect && effect.target === 'target');
}

/** Instance ids of living enemies a targeted card may be played on. */
export function getValidTargets(state: CombatState, card: CardDef): string[] {
  if (!cardNeedsTarget(card)) return [];
  return state.enemies.filter((enemy) => enemy.hp > 0).map((enemy) => enemy.instanceId);
}

/**
 * Playable = player turn, not a status card, affordable, and (for targeted
 * cards) at least one living enemy. Mirrors the reducer's PLAY_CARD guards.
 */
export function isCardPlayable(state: CombatState, card: CombatCard): boolean {
  if (state.phase !== 'playerTurn') return false;
  if (card.def.type === 'status') return false;
  if (getEffectiveCost(state, card.def) > state.player.energy) return false;
  if (cardNeedsTarget(card.def) && getValidTargets(state, card.def).length === 0) return false;
  return true;
}
