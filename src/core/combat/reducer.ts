/**
 * Combat state machine (docs/03 "Zug-Phasen & Reihenfolge", docs/05).
 *
 * Pure reducer: (state, event, rng) → state. The incoming state is never
 * mutated; the RNG is always injected, so a fixed seed replays a combat
 * deterministically.
 *
 * Flow: combatStart → turnStart → playerAction* → turnEnd → enemyTurn → …
 * → victory | defeat | retreated. combatStart/turnStart run inside
 * createCombatState; END_TURN chains turnEnd → enemyTurn → next turnStart.
 */
import { combatConfig } from '../../data/combat';
import { applyEffects, applyPoisonTick, decayTurnStatuses, drawCards, type Actor } from './effects';
import { shuffle, type Rng } from './rng';
import type {
  CombatCard,
  CombatEvent,
  CombatSetup,
  CombatState,
  EnemyDef,
  EnemyState,
  IntentStep,
} from './types';

// ── Intents ──────────────────────────────────────────────────────────────

/** Phase specificity: lower hpBelow = later phase; the default phase ranks last. */
function phaseRank(phase: { hpBelow?: number }): number {
  return phase.hpBelow ?? Number.POSITIVE_INFINITY;
}

/**
 * Pick the phase for the enemy's current hp. Monotonic: only advances to a
 * strictly lower-ranked (more damaged) phase — healing above a crossed
 * hpBelow threshold never reverts to an earlier phase (StS convention,
 * see EnemyState.phaseIndex).
 */
function selectPhaseIndex(enemy: Pick<EnemyState, 'def' | 'hp' | 'maxHp' | 'phaseIndex'>): number {
  const pattern = enemy.def.pattern;
  if (pattern.kind === 'cycle') return 0;
  const ratio = enemy.hp / enemy.maxHp;
  let best = enemy.phaseIndex;
  pattern.phases.forEach((phase, index) => {
    if (
      phase.hpBelow !== undefined &&
      ratio < phase.hpBelow &&
      phaseRank(phase) < phaseRank(pattern.phases[best]!)
    ) {
      best = index;
    }
  });
  return best;
}

/** Default phase at full hp: the one without hpBelow (highest rank). */
function initialPhaseIndex(pattern: EnemyDef['pattern']): number {
  if (pattern.kind === 'cycle') return 0;
  let best = 0;
  pattern.phases.forEach((phase, index) => {
    if (phaseRank(phase) > phaseRank(pattern.phases[best]!)) best = index;
  });
  return best;
}

function activeSteps(enemy: EnemyState): IntentStep[] {
  const pattern = enemy.def.pattern;
  if (pattern.kind === 'cycle') return pattern.steps;
  return pattern.phases[enemy.phaseIndex]!.steps;
}

function intentAt(enemy: EnemyState, index: number): IntentStep {
  const steps = activeSteps(enemy);
  return steps[index % steps.length]!;
}

/**
 * Determine the next telegraphed intent — runs AFTER the enemy action
 * (docs/11: first the action, then the new intent becomes visible).
 * Phase transitions are evaluated here: a crossed hpBelow threshold takes
 * effect with the next intent and restarts the new phase's step list.
 */
function advanceIntent(enemy: EnemyState): void {
  const nextPhase = selectPhaseIndex(enemy);
  if (nextPhase !== enemy.phaseIndex) {
    enemy.phaseIndex = nextPhase;
    enemy.patternIndex = 0;
  } else {
    enemy.patternIndex = (enemy.patternIndex + 1) % activeSteps(enemy).length;
  }
  enemy.intent = intentAt(enemy, enemy.patternIndex);
}

// ── Setup (combatStart + first turnStart) ────────────────────────────────

function createEnemyState(def: EnemyDef, index: number): EnemyState {
  const enemy: EnemyState = {
    instanceId: `${def.id}#${index}`,
    def,
    hp: def.hp,
    maxHp: def.hp,
    // combatStart: apply start block + start statuses (docs/03 step 1;
    // start statuses carry elite affixes like "Dornig" → retaliate).
    block: def.startBlock ?? 0,
    statuses: { ...def.startStatuses },
    phaseIndex: initialPhaseIndex(def.pattern),
    patternIndex: 0,
    intent: { intent: 'attack', effects: [] },
  };
  // combatStart: first intents are determined before the first player turn.
  enemy.intent = intentAt(enemy, 0);
  return enemy;
}

export function createCombatState(setup: CombatSetup, rng: Rng): CombatState {
  const deck: CombatCard[] = setup.deck.map((def, i) => ({
    instanceId: `${def.id}#${i}`,
    def,
  }));
  const state: CombatState = {
    phase: 'playerTurn',
    turn: 0,
    player: {
      hp: setup.playerHp,
      maxHp: setup.playerMaxHp ?? setup.playerHp,
      block: 0,
      energy: 0,
      // combatStart: talisman start statuses (docs/07 Dornenring →
      // Vergeltung 1) — same mechanism as EnemyDef.startStatuses.
      statuses: { ...setup.playerStartStatuses },
    },
    enemies: setup.enemies.map(createEnemyState),
    drawPile: shuffle(deck, rng),
    hand: [],
    // combatStart: affix "Zehrend" seeds the discard pile (docs/02); the 's'
    // in the instance id avoids collisions with deck instance ids.
    discardPile: (setup.startDiscard ?? []).map((def, i) => ({
      instanceId: `${def.id}#s${i}`,
      def,
    })),
    consumed: [],
    retreatChance: setup.retreatChance ?? combatConfig.retreatBaseChance,
    toolTier: setup.toolTier ?? combatConfig.baseToolTier,
    nextCardCostDelta: 0,
    addedCardCounter: 0,
    blockGainedThisTurn: false,
    firstAttackBonus: setup.firstAttackBonus ?? 0,
  };
  startPlayerTurn(state, rng);
  // combatStart: talent "Bollwerk" (docs/02) — start block is applied AFTER
  // the first turnStart (which zeroes block) and decays with the next one.
  state.player.block += setup.playerStartBlock ?? 0;
  return state;
}

// ── Phase helpers (operate on a draft, reducer clones first) ─────────────

function reshuffler(rng: Rng) {
  return (cards: CombatCard[]) => shuffle(cards, rng);
}

function startPlayerTurn(state: CombatState, rng: Rng): void {
  state.turn += 1;
  // turnStart (docs/03 step 2): player block decays, draw 5, energy to 3;
  // the "blocked this turn" conditional resets with the block decay.
  state.player.block = 0;
  state.blockGainedThisTurn = false;
  drawCards(state, combatConfig.handSize, reshuffler(rng));
  state.player.energy = combatConfig.energyPerTurn;
}

function checkOutcome(state: CombatState): void {
  if (state.player.hp <= 0) {
    state.phase = 'defeat';
  } else if (state.enemies.every((enemy) => enemy.hp <= 0)) {
    state.phase = 'victory';
  }
}

function endPlayerTurn(state: CombatState, rng: Rng): void {
  // turnEnd (docs/03 step 4): poison tick on player, then poison −1;
  // duration statuses (Schwäche/Verwundbar) lose 1 stack;
  // status cards vanish; remaining hand is discarded.
  applyPoisonTick(state.player);
  decayTurnStatuses(state.player);
  // Zustandskarten verschwinden am Zugende — they never reach the discard pile.
  state.discardPile.push(...state.hand.filter((card) => card.def.type !== 'status'));
  state.hand = [];
  checkOutcome(state);
  if (state.phase !== 'playerTurn') return;

  // enemyTurn (docs/03 step 5), per enemy: block decays, act, poison tick,
  // new intent becomes visible after the action.
  for (const enemy of state.enemies) {
    if (enemy.hp <= 0) continue;
    enemy.block = 0;
    const actor: Actor = { side: 'enemy', enemy };
    applyEffects(state, actor, enemy.intent.effects, reshuffler(rng));
    if (enemy.hp > 0) {
      applyPoisonTick(enemy);
      decayTurnStatuses(enemy);
    }
    if (enemy.hp > 0) {
      advanceIntent(enemy);
    }
    checkOutcome(state);
    if (state.phase !== 'playerTurn') return;
  }

  startPlayerTurn(state, rng);
}

// ── Event handlers ───────────────────────────────────────────────────────

function playCard(
  state: CombatState,
  rng: Rng,
  cardInstanceId: string,
  targetEnemyId?: string,
): void {
  const index = state.hand.findIndex((card) => card.instanceId === cardInstanceId);
  const card = state.hand[index];
  if (!card) return;
  // Zustandskarten sind unspielbar — keine Energie-Interaktion (docs/03).
  if (card.def.type === 'status') return;
  // Cost modifier (docs/10 Kristallschild „nächste Karte −1⚡"): the pending
  // delta shifts this card's cost (never below 0) and is consumed by it.
  const effectiveCost = Math.max(0, card.def.cost + state.nextCardCostDelta);
  if (effectiveCost > state.player.energy) return;
  const needsTarget = card.def.effects.some(
    (effect) => 'target' in effect && effect.target === 'target',
  );
  if (needsTarget) {
    const target = state.enemies.find((enemy) => enemy.instanceId === targetEnemyId);
    if (!target || target.hp <= 0) return;
  }

  state.player.energy -= effectiveCost;
  state.nextCardCostDelta = 0;
  state.hand.splice(index, 1);
  // Talent "Klingenschliff" (docs/02): the FIRST attack card played this
  // combat hits for +bonus. Implemented as temporary strength for exactly
  // this card's resolution (per hit, StS-Vigor convention), then consumed.
  const attackBonus = card.def.type === 'attack' ? state.firstAttackBonus : 0;
  if (attackBonus > 0) {
    state.player.statuses.strength = (state.player.statuses.strength ?? 0) + attackBonus;
    state.firstAttackBonus = 0;
  }
  applyEffects(state, { side: 'player' }, card.def.effects, reshuffler(rng), targetEnemyId);
  if (attackBonus > 0) {
    const remaining = (state.player.statuses.strength ?? 0) - attackBonus;
    if (remaining > 0) {
      state.player.statuses.strength = remaining;
    } else {
      delete state.player.statuses.strength;
    }
  }
  // Gerichte sind Verbrauchskarten (docs/03) — sie verlassen das Deck.
  if (card.def.type === 'dish') {
    state.consumed.push(card);
  } else {
    state.discardPile.push(card);
  }
  checkOutcome(state);
}

function attemptRetreat(state: CombatState, rng: Rng): void {
  // docs/03 Rückzug: success ends the combat immediately (no loot);
  // failure consumes the action, the turn ends and the enemies act.
  if (rng() < state.retreatChance) {
    state.phase = 'retreated';
  } else {
    endPlayerTurn(state, rng);
  }
}

// ── Reducer ──────────────────────────────────────────────────────────────

export function combatReducer(state: CombatState, event: CombatEvent, rng: Rng): CombatState {
  if (state.phase !== 'playerTurn') return state;
  const draft = structuredClone(state);
  switch (event.type) {
    case 'PLAY_CARD':
      playCard(draft, rng, event.cardInstanceId, event.targetEnemyId);
      break;
    case 'END_TURN':
      endPlayerTurn(draft, rng);
      break;
    case 'RETREAT':
      attemptRetreat(draft, rng);
      break;
  }
  return draft;
}
