/**
 * Defeat-flow balancing (docs/03 Cozy-Anpassung 1, docs/01):
 * on defeat (and on abandoning a dungeon run) the shadow creature keeps
 * HALF of the loot gathered since the last rest, floored per item.
 */
export const defeatConfig = {
  /** Fraction of the since-rest loot lost per item (floored). */
  lootPenaltyFraction: 0.5,
} as const;
