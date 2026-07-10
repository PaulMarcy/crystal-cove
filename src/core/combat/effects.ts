/**
 * Effect interpreter — executes the data DSL (docs/05) against the combat
 * state. Closed set of effect kinds; new mechanics = new kind + tests.
 *
 * All functions mutate the passed draft state; the reducer clones first,
 * so the reducer itself stays pure.
 */
import { combatConfig } from '../../data/combat';
import type {
  CardDef,
  CardZone,
  CombatState,
  Effect,
  EffectAmount,
  EffectTarget,
  EnemyState,
  StatusMap,
} from './types';

/** The acting side, used to resolve 'self' and to read attacker statuses. */
export type Actor = { side: 'player' } | { side: 'enemy'; enemy: EnemyState };

interface Unit {
  hp: number;
  maxHp: number;
  block: number;
  statuses: StatusMap;
}

function livingEnemies(state: CombatState): EnemyState[] {
  return state.enemies.filter((e) => e.hp > 0);
}

function resolveTargets(
  state: CombatState,
  actor: Actor,
  target: EffectTarget,
  chosenEnemyId?: string,
): Unit[] {
  switch (target) {
    case 'player':
      return [state.player];
    case 'self':
      return actor.side === 'player' ? [state.player] : [actor.enemy];
    case 'allEnemies':
      return livingEnemies(state);
    case 'target': {
      const enemy = livingEnemies(state).find((e) => e.instanceId === chosenEnemyId);
      return enemy ? [enemy] : [];
    }
  }
}

/**
 * Resolve a DSL amount against combat context (docs/05):
 * 'toolTier' scaling adds a per-tier bonus above the base tool tier.
 */
export function resolveAmount(amount: EffectAmount, state: CombatState): number {
  if (typeof amount === 'number') return amount;
  switch (amount.scaling) {
    case 'toolTier':
      return (
        amount.base +
        (state.toolTier - combatConfig.baseToolTier) * combatConfig.toolTierBonusPerTier
      );
  }
}

/**
 * Damage formula (docs/03): (base + strength) × 0.75 if attacker weak
 * × 1.5 if target vulnerable, floored, then applied against block.
 */
export function calculateAttackDamage(
  base: number,
  attackerStatuses: StatusMap,
  targetStatuses: StatusMap,
): number {
  let amount = base + (attackerStatuses.strength ?? 0);
  if ((attackerStatuses.weak ?? 0) > 0) amount *= combatConfig.weakMultiplier;
  if ((targetStatuses.vulnerable ?? 0) > 0) amount *= combatConfig.vulnerableMultiplier;
  return Math.max(0, Math.floor(amount));
}

/** Plain damage against block (no status multipliers) — retaliation etc. */
export function dealBlockableDamage(unit: Unit, amount: number): void {
  const blocked = Math.min(unit.block, amount);
  unit.block -= blocked;
  unit.hp -= amount - blocked;
}

/** Poison tick: poison ignores block (docs/03). */
export function applyPoisonTick(unit: Unit): void {
  const poison = unit.statuses.poison ?? 0;
  if (poison <= 0) return;
  unit.hp -= poison;
  const remaining = poison - combatConfig.poisonDecayPerTick;
  if (remaining > 0) {
    unit.statuses.poison = remaining;
  } else {
    delete unit.statuses.poison;
  }
}

/** Damage bypassing block entirely (Panzerbrecher „ignoriert Block", docs/10). */
export function dealUnblockableDamage(unit: Unit, amount: number): void {
  unit.hp -= amount;
}

function performAttack(
  state: CombatState,
  actor: Actor,
  targetUnit: Unit,
  base: number,
  ignoresBlock = false,
): void {
  const attackerUnit: Unit = actor.side === 'player' ? state.player : actor.enemy;
  const damage = calculateAttackDamage(base, attackerUnit.statuses, targetUnit.statuses);
  if (ignoresBlock) {
    dealUnblockableDamage(targetUnit, damage);
  } else {
    dealBlockableDamage(targetUnit, damage);
  }
  // Vergeltung X (docs/03): attacking a unit with retaliate deals X plain
  // damage to the attacker, absorbed by the attacker's block.
  const retaliate = targetUnit.statuses.retaliate ?? 0;
  if (retaliate > 0 && attackerUnit.hp > 0) {
    dealBlockableDamage(attackerUnit, retaliate);
  }
}

function drawOne(
  state: CombatState,
  shuffleFn: (cards: CombatState['discardPile']) => CombatState['discardPile'],
): void {
  if (state.drawPile.length === 0) {
    if (state.discardPile.length === 0) return;
    state.drawPile = shuffleFn(state.discardPile);
    state.discardPile = [];
  }
  const card = state.drawPile.shift();
  if (card) state.hand.push(card);
}

/** Draw n cards, reshuffling the discard pile (via injected RNG) when empty. */
export function drawCards(
  state: CombatState,
  amount: number,
  shuffleFn: (cards: CombatState['discardPile']) => CombatState['discardPile'],
): void {
  for (let i = 0; i < amount; i++) drawOne(state, shuffleFn);
}

/**
 * Add freshly created cards to a player zone (docs/07 Wildwuchs: shuffle
 * 1 Erschöpfung into the player's discard pile). Deck zones exist only on
 * the player side. Cards added to the draw pile are shuffled in via the
 * injected RNG to keep their position unpredictable but seeded.
 */
export function addCards(
  state: CombatState,
  card: CardDef,
  zone: CardZone,
  amount: number,
  shuffleFn: (cards: CombatState['drawPile']) => CombatState['drawPile'],
): void {
  for (let i = 0; i < amount; i++) {
    state.addedCardCounter += 1;
    const instance = { instanceId: `${card.id}+${state.addedCardCounter}`, def: card };
    switch (zone) {
      case 'hand':
        state.hand.push(instance);
        break;
      case 'discard':
        state.discardPile.push(instance);
        break;
      case 'draw':
        state.drawPile.push(instance);
        break;
    }
  }
  if (zone === 'draw') state.drawPile = shuffleFn(state.drawPile);
}

/**
 * End-of-turn decay for duration statuses (Schwäche, Verwundbar): −1 stack
 * at the end of the affected unit's turn. List lives in src/data.
 */
export function decayTurnStatuses(unit: Unit): void {
  for (const status of combatConfig.decayingStatuses) {
    const stacks = unit.statuses[status];
    if (stacks === undefined) continue;
    if (stacks > 1) {
      unit.statuses[status] = stacks - 1;
    } else {
      delete unit.statuses[status];
    }
  }
}

/**
 * Interpret a list of effects for one actor.
 * `shuffleFn` carries the injected RNG for draw-triggered reshuffles.
 */
export function applyEffects(
  state: CombatState,
  actor: Actor,
  effects: Effect[],
  shuffleFn: (cards: CombatState['discardPile']) => CombatState['discardPile'],
  chosenEnemyId?: string,
): void {
  for (const effect of effects) {
    switch (effect.kind) {
      case 'damage': {
        const times = effect.times ?? 1;
        // Multi-hit: targets are re-resolved and strength re-applied per hit
        // (StS convention — Sturzflug 2×2 with +2 strength deals 2×4);
        // dead targets stop absorbing the remaining hits.
        for (let i = 0; i < times; i++) {
          for (const unit of resolveTargets(state, actor, effect.target, chosenEnemyId)) {
            performAttack(
              state,
              actor,
              unit,
              resolveAmount(effect.amount, state),
              effect.ignoresBlock,
            );
          }
        }
        break;
      }
      case 'block':
        for (const unit of resolveTargets(state, actor, effect.target, chosenEnemyId)) {
          unit.block += resolveAmount(effect.amount, state);
          // Konditional „geblockt diese Runde" (docs/03): the player gaining
          // block from a card effect arms conditional cards for this turn.
          if (actor.side === 'player' && unit === state.player) {
            state.blockGainedThisTurn = true;
          }
        }
        break;
      case 'conditionalDamage': {
        // Riposte (docs/03/docs/10): base + bonus when the condition holds;
        // the sum runs through the normal attack formula, so strength/weak/
        // vulnerable modify the bonus like regular damage.
        const conditionMet = effect.condition === 'blockedThisTurn' && state.blockGainedThisTurn;
        const base =
          resolveAmount(effect.amount, state) +
          (conditionMet ? resolveAmount(effect.bonus, state) : 0);
        for (const unit of resolveTargets(state, actor, effect.target, chosenEnemyId)) {
          performAttack(state, actor, unit, base);
        }
        break;
      }
      case 'draw':
        drawCards(state, effect.amount, shuffleFn);
        break;
      case 'heal':
        for (const unit of resolveTargets(state, actor, effect.target, chosenEnemyId)) {
          unit.hp = Math.min(unit.maxHp, unit.hp + effect.amount);
        }
        break;
      case 'applyStatus':
        for (const unit of resolveTargets(state, actor, effect.target, chosenEnemyId)) {
          unit.statuses[effect.status] = (unit.statuses[effect.status] ?? 0) + effect.amount;
        }
        break;
      case 'gainEnergy':
        state.player.energy += effect.amount;
        break;
      case 'addCard':
        addCards(state, effect.card, effect.zone, effect.amount ?? 1, shuffleFn);
        break;
      case 'modifyNextCardCost':
        state.nextCardCostDelta += effect.amount;
        break;
    }
  }
}
