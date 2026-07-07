/**
 * Headless combat simulator library (M1, ROADMAP "Headless-Simulator").
 *
 * Drives the real combat core (createCombatState + combatReducer) with a
 * simple deterministic bot policy — no combat logic is duplicated here.
 * The CLI lives in scripts/sim.ts; tests in scripts/sim.test.ts.
 *
 * Two built-in bot policies (swap via SimOptions.policy):
 *
 * "noise" (corridor baseline per docs/12, human proxy):
 *   plays a uniformly random playable card (via the injected sim RNG, so a
 *   fixed seed replays exactly) on a random living target until nothing is
 *   playable, then END_TURN. No intent-aware blocking, no heal priority,
 *   never RETREAT.
 *
 * "greedy" (upper-bound reference), per decision step, first match wins:
 *   1. Dish with a heal effect if player hp < 50 % of max hp.
 *   2. Block card (highest block first, then hand order) while the
 *      telegraphed incoming damage exceeds current block.
 *   3. Attack card in hand order, targeting the living enemy with the
 *      lowest hp.
 *   4. Any other playable non-dish card (draw etc.) in hand order.
 *   5. Nothing playable → END_TURN. RETREAT is never used.
 */
import { combatConfig } from '../src/data/combat';
import { resolveAmount } from '../src/core/combat/effects';
import { getIntentPreview } from '../src/core/combat/intent';
import { combatReducer, createCombatState } from '../src/core/combat/reducer';
import { createRng, type Rng } from '../src/core/combat/rng';
import { cardNeedsTarget, isCardPlayable } from '../src/core/combat/view';
import type {
  CardDef,
  CombatCard,
  CombatEvent,
  CombatState,
  EnemyDef,
} from '../src/core/combat/types';

/** Safety net against degenerate stalls; a capped combat counts as a loss. */
export const MAX_TURNS = 100;

/** Policies draw from the same injected RNG stream as the combat itself. */
export type Policy = (state: CombatState, rng: Rng) => CombatEvent;

export interface SimOptions {
  deck: readonly CardDef[];
  enemies: readonly EnemyDef[];
  n: number;
  /** Runs use seeds baseSeed, baseSeed+1, …, baseSeed+n−1. */
  baseSeed: number;
  policy?: Policy;
}

export interface SimResult {
  n: number;
  baseSeed: number;
  wins: number;
  defeats: number;
  /** Combats aborted after MAX_TURNS (counted as losses). */
  timeouts: number;
  winrate: number;
  avgTurns: number;
  /** Average player hp remaining after a win (NaN if no wins). */
  avgHpOnWin: number;
  /** First few seeds that ended in defeat/timeout — for replaying outliers. */
  defeatSeeds: number[];
  timeoutSeeds: number[];
}

// ── Policy helpers ────────────────────────────────────────────────────────

function effectSum(card: CombatCard, kind: 'block' | 'heal', state: CombatState): number {
  let sum = 0;
  for (const effect of card.def.effects) {
    if (effect.kind === kind) sum += resolveAmount(effect.amount, state);
  }
  return sum;
}

function telegraphedDamage(state: CombatState): number {
  let total = 0;
  for (const enemy of state.enemies) {
    if (enemy.hp <= 0) continue;
    const preview = getIntentPreview(state, enemy.instanceId);
    if (!preview) continue;
    for (const attack of preview.attacks) total += attack.total;
  }
  return total;
}

function lowestHpEnemyId(state: CombatState): string | undefined {
  let best: { id: string; hp: number } | undefined;
  for (const enemy of state.enemies) {
    if (enemy.hp <= 0) continue;
    if (!best || enemy.hp < best.hp) best = { id: enemy.instanceId, hp: enemy.hp };
  }
  return best?.id;
}

function playEvent(state: CombatState, card: CombatCard): CombatEvent {
  return {
    type: 'PLAY_CARD',
    cardInstanceId: card.instanceId,
    targetEnemyId: cardNeedsTarget(card.def) ? lowestHpEnemyId(state) : undefined,
  };
}

/**
 * Human-proxy baseline (module doc): random playable card, random living
 * target. Deterministic per seed — all randomness comes from the injected RNG.
 */
export const noisePolicy: Policy = (state, rng) => {
  const playable = state.hand.filter((card) => isCardPlayable(state, card));
  if (playable.length === 0) return { type: 'END_TURN' };
  const card = playable[Math.floor(rng() * playable.length)]!;
  let targetEnemyId: string | undefined;
  if (cardNeedsTarget(card.def)) {
    const living = state.enemies.filter((enemy) => enemy.hp > 0);
    targetEnemyId = living[Math.floor(rng() * living.length)]!.instanceId;
  }
  return { type: 'PLAY_CARD', cardInstanceId: card.instanceId, targetEnemyId };
};

/** Near-optimal reference bot (see module doc for the rule order). */
export const greedyPolicy: Policy = (state) => {
  const playable = state.hand.filter((card) => isCardPlayable(state, card));

  if (state.player.hp < state.player.maxHp / 2) {
    const dish = playable.find(
      (card) => card.def.type === 'dish' && effectSum(card, 'heal', state) > 0,
    );
    if (dish) return playEvent(state, dish);
  }

  if (telegraphedDamage(state) > state.player.block) {
    const blockers = playable
      .filter((card) => effectSum(card, 'block', state) > 0)
      .sort((a, b) => effectSum(b, 'block', state) - effectSum(a, 'block', state));
    if (blockers[0]) return playEvent(state, blockers[0]);
  }

  const attack = playable.find((card) => card.def.type === 'attack');
  if (attack) return playEvent(state, attack);

  const other = playable.find((card) => card.def.type !== 'dish');
  if (other) return playEvent(state, other);

  return { type: 'END_TURN' };
};

// ── Simulation loop ───────────────────────────────────────────────────────

export interface SingleRunResult {
  outcome: 'victory' | 'defeat' | 'timeout';
  turns: number;
  playerHp: number;
}

export function runCombat(
  deck: readonly CardDef[],
  enemies: readonly EnemyDef[],
  seed: number,
  policy: Policy = noisePolicy,
): SingleRunResult {
  const rng = createRng(seed);
  let state = createCombatState(
    {
      playerHp: combatConfig.basePlayerHp,
      deck: deck.slice(),
      enemies: enemies.slice(),
      toolTier: combatConfig.baseToolTier,
    },
    rng,
  );

  while (state.phase === 'playerTurn' && state.turn <= MAX_TURNS) {
    const event = policy(state, rng);
    const next = combatReducer(state, event, rng);
    if (next === state && event.type !== 'END_TURN') {
      // Policy proposed an unplayable move — force end turn to avoid stalls.
      state = combatReducer(state, { type: 'END_TURN' }, rng);
    } else {
      state = next;
    }
  }

  const outcome =
    state.phase === 'victory' ? 'victory' : state.phase === 'defeat' ? 'defeat' : 'timeout';
  return { outcome, turns: state.turn, playerHp: Math.max(0, state.player.hp) };
}

export function runSimulation(options: SimOptions): SimResult {
  const { deck, enemies, n, baseSeed, policy = noisePolicy } = options;
  let wins = 0;
  let defeats = 0;
  let timeouts = 0;
  let turnSum = 0;
  let hpOnWinSum = 0;
  const defeatSeeds: number[] = [];
  const timeoutSeeds: number[] = [];

  for (let i = 0; i < n; i++) {
    const seed = baseSeed + i;
    const run = runCombat(deck, enemies, seed, policy);
    turnSum += run.turns;
    if (run.outcome === 'victory') {
      wins += 1;
      hpOnWinSum += run.playerHp;
    } else if (run.outcome === 'defeat') {
      defeats += 1;
      if (defeatSeeds.length < 10) defeatSeeds.push(seed);
    } else {
      timeouts += 1;
      if (timeoutSeeds.length < 10) timeoutSeeds.push(seed);
    }
  }

  return {
    n,
    baseSeed,
    wins,
    defeats,
    timeouts,
    winrate: wins / n,
    avgTurns: turnSum / n,
    avgHpOnWin: wins > 0 ? hpOnWinSum / wins : NaN,
    defeatSeeds,
    timeoutSeeds,
  };
}
