/**
 * Combat balancing constants (docs/03). All tuning lives here, not in core.
 * Changes are `data:` commits.
 */
import type { StatusId } from '../core/combat/types';

export const combatConfig = {
  /** Cards drawn at the start of each player turn. */
  handSize: 5,
  /** Energy refilled at the start of each player turn. */
  energyPerTurn: 3,
  /** Base success chance of retreating in the open field (docs/03 Rückzug). */
  retreatBaseChance: 0.75,
  /** Outgoing damage multiplier while the attacker has Schwäche. */
  weakMultiplier: 0.75,
  /** Incoming damage multiplier while the target has Verwundbar. */
  vulnerableMultiplier: 1.5,
  /** Poison stacks lost after each poison tick. */
  poisonDecayPerTick: 1,
  /** Tool tier without upgrades (baseline for 'toolTier' scaling). */
  baseToolTier: 1,
  /** Extra amount per tool tier above baseline (M3: Axtschlag 6 → 8 at tier 2). */
  toolTierBonusPerTier: 2,
  /**
   * Duration statuses losing 1 stack at the end of the affected unit's turn
   * (StS convention). Strength is permanent, poison has its own tick rule,
   * retaliate explicitly lasts the whole combat (docs/03).
   */
  decayingStatuses: ['weak', 'vulnerable'] as readonly StatusId[],
} as const;
