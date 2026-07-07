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

export type Effect =
  | { kind: 'damage'; amount: number; target: EffectTarget; times?: number }
  | { kind: 'block'; amount: number; target: EffectTarget }
  | { kind: 'draw'; amount: number }
  | { kind: 'heal'; amount: number; target: EffectTarget }
  | { kind: 'applyStatus'; status: StatusId; amount: number; target: EffectTarget }
  | { kind: 'gainEnergy'; amount: number };

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
}
