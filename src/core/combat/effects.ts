/**
 * Effect interpreter — executes the data DSL (docs/05) against the combat
 * state. Closed set of effect kinds; new mechanics = new kind + tests.
 *
 * All functions mutate the passed draft state; the reducer clones first,
 * so the reducer itself stays pure.
 */
import { combatConfig } from '../../data/combat';
import type {
  CombatState,
  Effect,
  EffectTarget,
  EnemyState,
  StatusMap,
} from './types';

/** The acting side, used to resolve 'self' and to read attacker statuses. */
export type Actor =
  | { side: 'player' }
  | { side: 'enemy'; enemy: EnemyState };

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

function performAttack(state: CombatState, actor: Actor, targetUnit: Unit, base: number): void {
  const attackerUnit: Unit = actor.side === 'player' ? state.player : actor.enemy;
  const damage = calculateAttackDamage(base, attackerUnit.statuses, targetUnit.statuses);
  dealBlockableDamage(targetUnit, damage);
  // Vergeltung X (docs/03): attacking a unit with retaliate deals X plain
  // damage to the attacker, absorbed by the attacker's block.
  const retaliate = targetUnit.statuses.retaliate ?? 0;
  if (retaliate > 0 && attackerUnit.hp > 0) {
    dealBlockableDamage(attackerUnit, retaliate);
  }
}

function drawOne(state: CombatState, shuffleFn: (cards: CombatState['discardPile']) => CombatState['discardPile']): void {
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
        for (let i = 0; i < times; i++) {
          for (const unit of resolveTargets(state, actor, effect.target, chosenEnemyId)) {
            performAttack(state, actor, unit, effect.amount);
          }
        }
        break;
      }
      case 'block':
        for (const unit of resolveTargets(state, actor, effect.target, chosenEnemyId)) {
          unit.block += effect.amount;
        }
        break;
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
    }
  }
}
