/**
 * Intent preview selector (docs/11 Absichts-Chip): UI-ready data for the
 * chip above each enemy. Attack numbers are the "echte Zahl" — computed
 * through the full damage formula (base + enemy strength, ×0.75 while the
 * enemy is weak, ×1.5 while the PLAYER is vulnerable, floored).
 *
 * Pure selector: recomputed on demand from the current state, so the
 * preview can never go stale after a card changes statuses mid-turn.
 * No UI code — plain data only.
 */
import { calculateAttackDamage, resolveAmount } from './effects';
import type { CombatState, Effect, IntentKind } from './types';

/** One telegraphed attack line, e.g. Sturzflug 2×2 → { times: 2, amount: 2 }. */
export interface IntentAttackPreview {
  /** Number of hits (multi-hit shown as "times×amount", docs/11). */
  times: number;
  /** True damage per hit after all status multipliers. */
  amount: number;
  /** times × amount — convenience total for tooltips. */
  total: number;
  /** Attack bypasses player block (Panzerbrecher-style). */
  ignoresBlock: boolean;
}

export interface IntentPreview {
  enemyId: string;
  /** Icon vocabulary from docs/07: attack | defend | buff | debuff | deck. */
  kind: IntentKind;
  /** One entry per damage effect aimed at the player; empty for non-attacks. */
  attacks: IntentAttackPreview[];
  /** Raw DSL effects of the telegraphed step (for detailed tooltips). */
  effects: Effect[];
}

/**
 * Build the preview for one enemy's current intent.
 * Returns undefined for unknown or dead enemies (no chip is shown).
 */
export function getIntentPreview(
  state: CombatState,
  enemyInstanceId: string,
): IntentPreview | undefined {
  const enemy = state.enemies.find((e) => e.instanceId === enemyInstanceId);
  if (!enemy || enemy.hp <= 0) return undefined;

  const attacks: IntentAttackPreview[] = [];
  for (const effect of enemy.intent.effects) {
    if (effect.kind !== 'damage') continue;
    // Enemy intents target the player ('player' or 'self' would be odd here;
    // only player-directed damage is telegraphed as an attack number).
    if (effect.target !== 'player') continue;
    const times = effect.times ?? 1;
    const amount = calculateAttackDamage(
      resolveAmount(effect.amount, state),
      enemy.statuses,
      state.player.statuses,
    );
    attacks.push({
      times,
      amount,
      total: times * amount,
      ignoresBlock: effect.ignoresBlock ?? false,
    });
  }

  return {
    enemyId: enemy.instanceId,
    kind: enemy.intent.intent,
    attacks,
    effects: enemy.intent.effects,
  };
}
