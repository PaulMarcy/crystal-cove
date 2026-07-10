/**
 * Combat core types: card/enemy definitions (data DSL, see docs/05 + docs/07)
 * and the runtime combat state. Pure TypeScript — no engine imports.
 */

// ── Statuses (docs/03 V1) ────────────────────────────────────────────────

export type StatusId = 'strength' | 'vulnerable' | 'weak' | 'poison' | 'retaliate';

export type StatusMap = Partial<Record<StatusId, number>>;

// ── Effect DSL (closed set, interpreted in effects.ts) ──────────────────

/**
 * Effect targets:
 * - 'target'     the enemy chosen when playing a player card
 * - 'allEnemies' every living enemy
 * - 'player'     the player (used by enemy actions and player self-effects)
 * - 'self'       the acting unit (player for cards, enemy for intents)
 */
export type EffectTarget = 'target' | 'allEnemies' | 'player' | 'self';

/** Card zones addressable by 'addCard' (deck zones exist only for the player). */
export type CardZone = 'hand' | 'discard' | 'draw';

/**
 * Amounts are either fixed or scaled by a combat context value
 * (docs/05: `{ base: 6, scaling: 'toolTier' }` — Axtschlag 6 → 8 at tier 2).
 */
export type ScalingSource = 'toolTier';
export type EffectAmount = number | { base: number; scaling: ScalingSource };

/**
 * Effect DSL notes:
 * - 'damage' with `times` = multi-hit (Sturzflug 2×2, Doppelhieb 2×5);
 *   strength counts per hit (StS convention).
 * - 'damage' with `ignoresBlock` = attack bypasses block (Panzerbrecher);
 *   status multipliers and retaliation still apply.
 * - Vergeltung (retaliate) needs no own kind — it is applied via
 *   `applyStatus` (Gegenhalten: { kind: 'applyStatus', status: 'retaliate', … })
 *   and triggered inside the damage interpreter.
 * - 'modifyNextCardCost' shifts the energy cost of the next card played
 *   (Kristallschild: amount −1); cost never drops below 0.
 * - 'conditionalDamage' (Riposte, docs/03 „Konditional geblockt diese Runde"):
 *   attacks for `amount`, plus `bonus` when the condition holds. The bonus is
 *   part of the base damage, so strength/weak/vulnerable modify it like any
 *   attack. Conditions are a closed set (currently only 'blockedThisTurn':
 *   the player gained ≥1 block from a card effect this player turn).
 */
export type EffectCondition = 'blockedThisTurn';

export type Effect =
  | {
      kind: 'damage';
      amount: EffectAmount;
      target: EffectTarget;
      times?: number;
      ignoresBlock?: boolean;
    }
  | { kind: 'block'; amount: EffectAmount; target: EffectTarget }
  | { kind: 'draw'; amount: number }
  | { kind: 'heal'; amount: number; target: EffectTarget }
  | { kind: 'applyStatus'; status: StatusId; amount: number; target: EffectTarget }
  | { kind: 'gainEnergy'; amount: number }
  | { kind: 'addCard'; card: CardDef; zone: CardZone; amount?: number }
  | { kind: 'modifyNextCardCost'; amount: number }
  | {
      kind: 'conditionalDamage';
      amount: EffectAmount;
      bonus: EffectAmount;
      condition: EffectCondition;
      target: EffectTarget;
    };

// ── Card definitions ─────────────────────────────────────────────────────

/** 'status' cards (Erschöpfung, Benommen) are unplayable and vanish at turn end. */
export type CardType = 'attack' | 'skill' | 'power' | 'dish' | 'status';

export interface CardDef {
  id: string;
  name: string;
  type: CardType;
  cost: number;
  school?: string;
  effects: Effect[];
}

// ── Enemy definitions (docs/07 data format) ──────────────────────────────

export type IntentKind = 'attack' | 'defend' | 'buff' | 'debuff' | 'deck';

export interface IntentStep {
  intent: IntentKind;
  effects: Effect[];
}

export interface CyclePattern {
  kind: 'cycle';
  steps: IntentStep[];
}

export interface PhasedPattern {
  kind: 'phased';
  phases: {
    /** Phase is active when hp/maxHp < hpBelow; omit for the default phase. */
    hpBelow?: number;
    steps: IntentStep[];
  }[];
}

export type EnemyPattern = CyclePattern | PhasedPattern;

export interface LootEntry {
  item: string;
  min: number;
  max: number;
  p?: number;
}

export interface EnemyDef {
  id: string;
  name: string;
  tier: number;
  hp: number;
  startBlock?: number;
  /**
   * Statuses applied at combat start (e.g. elite affix "Dornig" → retaliate).
   * Uses the existing status mechanics — no new interpreter code.
   */
  startStatuses?: StatusMap;
  pattern: EnemyPattern;
  loot?: {
    guaranteed: LootEntry[];
    chance: LootEntry[];
  };
}

// ── Runtime state ────────────────────────────────────────────────────────

export interface CombatCard {
  /** Unique per combat instance (a deck can contain the same CardDef twice). */
  instanceId: string;
  def: CardDef;
}

export interface PlayerState {
  hp: number;
  maxHp: number;
  block: number;
  energy: number;
  statuses: StatusMap;
}

export interface EnemyState {
  /** Unique instance id within this combat (e.g. 'shadow_rat#0'). */
  instanceId: string;
  def: EnemyDef;
  hp: number;
  maxHp: number;
  block: number;
  statuses: StatusMap;
  /**
   * Index of the active phase in a 'phased' pattern (0 for 'cycle').
   * Monotonic: once a hpBelow threshold is crossed the enemy never falls
   * back to an earlier phase, even if healed above the threshold
   * (StS convention — docs/07 leaves this open, assumption documented here).
   */
  phaseIndex: number;
  /** Index of the current intent within the active pattern step list. */
  patternIndex: number;
  intent: IntentStep;
}

export type CombatPhase = 'playerTurn' | 'victory' | 'defeat' | 'retreated';

export interface CombatState {
  phase: CombatPhase;
  turn: number;
  player: PlayerState;
  enemies: EnemyState[];
  drawPile: CombatCard[];
  hand: CombatCard[];
  discardPile: CombatCard[];
  /** Consumed dish cards — gone until re-cooked (docs/03). */
  consumed: CombatCard[];
  /** Retreat success chance for this combat (base value from src/data). */
  retreatChance: number;
  /** Equipped tool tier — context for 'toolTier' scaling (docs/05). */
  toolTier: number;
  /**
   * Pending cost shift for the next card played ('modifyNextCardCost').
   * Negative = discount; consumed by the next successfully played card.
   */
  nextCardCostDelta: number;
  /** Monotonic counter for unique instance ids of cards added mid-combat. */
  addedCardCounter: number;
  /**
   * True once the player gained block from a card effect in the CURRENT
   * player turn (docs/03 Konditional „geblockt diese Runde"). Order matters:
   * the flag is set when the block effect resolves, so a conditional card
   * played earlier in the same turn does not see it. Reset at player turn
   * start — block from previous turns never counts.
   */
  blockGainedThisTurn: boolean;
}

// ── Events ───────────────────────────────────────────────────────────────

export type CombatEvent =
  | { type: 'PLAY_CARD'; cardInstanceId: string; targetEnemyId?: string }
  | { type: 'END_TURN' }
  | { type: 'RETREAT' };

export interface CombatSetup {
  playerHp: number;
  playerMaxHp?: number;
  deck: CardDef[];
  enemies: EnemyDef[];
  /** Override of the base retreat chance (e.g. Wanderer talent, docs/02). */
  retreatChance?: number;
  /** Equipped tool tier for 'toolTier'-scaled amounts (default in src/data). */
  toolTier?: number;
  /**
   * Cards placed in the discard pile at combat start (elite affix "Zehrend":
   * Erschöpfung in der Ablage, docs/02). They join the deck cycle on reshuffle.
   */
  startDiscard?: CardDef[];
}
