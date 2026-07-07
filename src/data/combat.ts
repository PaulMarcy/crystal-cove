/**
 * Combat balancing constants (docs/03). All tuning lives here, not in core.
 * Changes are `data:` commits.
 */
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
} as const;
