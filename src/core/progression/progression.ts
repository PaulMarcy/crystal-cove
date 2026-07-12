/**
 * Progression core (M4) — pure, engine-free (CLAUDE.md rule 1): level curve,
 * talent points, talent unlock rules and the TalentModifiers object other
 * systems consume. All balancing values live in src/data/progression.ts and
 * src/data/talents.ts; this module only interprets them.
 *
 * XP model: the store keeps one monotonically growing `totalXp`; the level
 * is always derived (levelForXp). XP beyond the current level cap stays
 * banked — raising the cap later retro-grants the levels (data-only change).
 */
import { milestones, progressionConfig, xpSources } from '../../data/progression';
import { disenchantConfig } from '../../data/recipes';
import type { TalentBranch, TalentDef } from '../../data/talents';
import type { CardDef, Effect, EffectAmount } from '../combat/types';

// ── Level curve ──────────────────────────────────────────────────────────

/** XP required to go from level n to n+1 (docs/02: round(100 × n^1.5)). */
export function xpForLevelUp(level: number): number {
  return Math.round(progressionConfig.curveBase * level ** progressionConfig.curveExponent);
}

/** Total XP required to HAVE reached the given level (level 1 → 0). */
export function totalXpForLevel(level: number): number {
  let total = 0;
  for (let n = 1; n < level; n++) total += xpForLevelUp(n);
  return total;
}

/** Effective cap: the M4 level cap, never above the generic curve maximum. */
export function effectiveLevelCap(): number {
  return Math.min(progressionConfig.levelCap, progressionConfig.maxLevel);
}

/** Level for a total XP amount, capped at the current level cap. */
export function levelForXp(totalXp: number): number {
  const cap = effectiveLevelCap();
  let level = 1;
  while (level < cap && totalXp >= totalXpForLevel(level + 1)) level++;
  return level;
}

export interface XpProgress {
  level: number;
  /** XP gathered within the current level. */
  intoLevel: number;
  /** XP needed from level start to the next level; null at the cap. */
  forNext: number | null;
}

/** Progress view for HUD display (level, XP into level, XP to next). */
export function xpProgress(totalXp: number): XpProgress {
  const level = levelForXp(totalXp);
  const atCap = level >= effectiveLevelCap();
  return {
    level,
    intoLevel: totalXp - totalXpForLevel(level),
    forNext: atCap ? null : xpForLevelUp(level),
  };
}

// ── XP sources ───────────────────────────────────────────────────────────

export interface EncounterXpInput {
  enemyCount: number;
  elite: boolean;
  boss?: boolean;
}

/**
 * XP for a won encounter (docs/07 "XP", Tier 1): base + per-extra-enemy;
 * elite encounters are a flat constant (overrides the count formula);
 * bosses are flat as well.
 */
export function xpForEncounter(input: EncounterXpInput): number {
  if (input.boss) return xpSources.boss;
  if (input.elite) return xpSources.elite;
  const extra = Math.max(0, input.enemyCount - 1);
  return xpSources.combatBase + xpSources.combatPerExtraEnemy * extra;
}

// ── Level rewards ────────────────────────────────────────────────────────

/** Max HP at a level (docs/02: 50 + 5×(Level−1)), plus talent bonus. */
export function maxHpForLevel(level: number, maxHpBonus = 0): number {
  return progressionConfig.baseMaxHp + progressionConfig.hpPerLevel * (level - 1) + maxHpBonus;
}

/** Combat deck UPPER limit for a level (docs/02 milestone Lv 4: 12 → 15). */
export function deckLimitForLevel(level: number): number {
  let limit: number = milestones.deckSize[0].maxSize;
  for (const step of milestones.deckSize) {
    if (level >= step.level) limit = step.maxSize;
  }
  return limit;
}

/** Unlocked talisman slots (docs/02 Lv 8) — data/flag only in M4. */
export function talismanSlotsForLevel(level: number): number {
  let slots = 0;
  for (const step of milestones.talismanSlots) {
    if (level >= step.level) slots = step.slots;
  }
  return slots;
}

// ── Talent points & unlock rules ─────────────────────────────────────────

/** Total talent points earned at a level (docs/02: 1 every 3 levels). */
export function talentPointsForLevel(level: number): number {
  return Math.floor(level / progressionConfig.levelsPerTalentPoint);
}

/** Points not yet spent (each talent costs exactly 1 point). */
export function availableTalentPoints(level: number, unlocked: readonly string[]): number {
  return talentPointsForLevel(level) - unlocked.length;
}

export type TalentUnlockError =
  'unknown_talent' | 'already_unlocked' | 'previous_tier_locked' | 'no_points';

/**
 * Checks whether a talent can be unlocked now: it must exist, not be owned,
 * its lower branch tiers must all be owned (sequential unlock, docs/02) and
 * a free talent point must be available.
 */
export function canUnlockTalent(
  talentId: string,
  unlocked: readonly string[],
  level: number,
  talents: readonly TalentDef[],
): { ok: true } | { ok: false; error: TalentUnlockError } {
  const talent = talents.find((t) => t.id === talentId);
  if (!talent) return { ok: false, error: 'unknown_talent' };
  if (unlocked.includes(talentId)) return { ok: false, error: 'already_unlocked' };
  const previousTiersOwned = talents
    .filter((t) => t.branch === talent.branch && t.tier < talent.tier)
    .every((t) => unlocked.includes(t.id));
  if (!previousTiersOwned) return { ok: false, error: 'previous_tier_locked' };
  if (availableTalentPoints(level, unlocked) <= 0) return { ok: false, error: 'no_points' };
  return { ok: true };
}

// ── Talent modifiers ─────────────────────────────────────────────────────

/**
 * Typed aggregate of all unlocked talent effects — the single object other
 * systems read. Neutral defaults mean "no talent": multipliers 1, bonuses 0,
 * refund fraction = base value from data.
 */
export interface TalentModifiers {
  /** Klingenschliff: bonus damage on the first attack card per combat. */
  firstAttackBonus: number;
  /** Zähigkeit: additional max HP. */
  maxHpBonus: number;
  /** Bollwerk: player start block in DUNGEON combats (TODO(M4): Task 3). */
  dungeonStartBlock: number;
  /** Sparsame Hände: base-material discount on card recipes. */
  craftBaseMaterialDiscount: number;
  /** Guter Koch: dish effect multiplier (1 = neutral, 1.25 with talent). */
  dishEffectMultiplier: number;
  /** Effizientes Zerlegen: refund fraction (base 0.5 → 0.75 with talent). */
  disenchantRefundFraction: number;
  /** Sammlerglück: extra yield at harvest nodes. */
  harvestYieldBonus: number;
  /** Beutejäger: combat loot multiplier (1 = neutral, 1.25 with talent). */
  lootMultiplier: number;
  /** Kartenkenner: area/shrine XP multiplier (core/world/exploration). */
  explorationXpMultiplier: number;
}

export const neutralTalentModifiers: TalentModifiers = {
  firstAttackBonus: 0,
  maxHpBonus: 0,
  dungeonStartBlock: 0,
  craftBaseMaterialDiscount: 0,
  dishEffectMultiplier: 1,
  disenchantRefundFraction: disenchantConfig.baseRefundFraction,
  harvestYieldBonus: 0,
  lootMultiplier: 1,
  explorationXpMultiplier: 1,
};

/** Folds the unlocked talents' effect descriptors into one modifier object. */
export function talentModifiers(
  unlocked: readonly string[],
  talents: readonly TalentDef[],
): TalentModifiers {
  const mods = { ...neutralTalentModifiers };
  for (const id of unlocked) {
    const talent = talents.find((t) => t.id === id);
    if (!talent) continue; // forgiving: stale save ids are ignored
    const effect = talent.effect;
    switch (effect.kind) {
      case 'firstAttackBonus':
        mods.firstAttackBonus += effect.amount;
        break;
      case 'maxHpBonus':
        mods.maxHpBonus += effect.amount;
        break;
      case 'dungeonStartBlock':
        mods.dungeonStartBlock += effect.amount;
        break;
      case 'craftBaseMaterialDiscount':
        mods.craftBaseMaterialDiscount += effect.amount;
        break;
      case 'dishEffectPercent':
        mods.dishEffectMultiplier *= 1 + effect.percent / 100;
        break;
      case 'disenchantRefundFraction':
        mods.disenchantRefundFraction = Math.max(mods.disenchantRefundFraction, effect.fraction);
        break;
      case 'harvestYieldBonus':
        mods.harvestYieldBonus += effect.amount;
        break;
      case 'lootPercent':
        mods.lootMultiplier *= 1 + effect.percent / 100;
        break;
      case 'explorationXpPercent':
        mods.explorationXpMultiplier *= 1 + effect.percent / 100;
        break;
    }
  }
  return mods;
}

/** Highest tier of a branch that is fully unlocked (0 = none). */
export function branchProgress(
  branch: TalentBranch,
  unlocked: readonly string[],
  talents: readonly TalentDef[],
): number {
  const owned = talents
    .filter((t) => t.branch === branch && unlocked.includes(t.id))
    .map((t) => t.tier);
  return owned.length === 0 ? 0 : Math.max(...owned);
}

// ── Modifier application helpers (pure) ──────────────────────────────────

/** Loot scaling (Beutejäger, docs/02: +25 % aufgerundet) per item line. */
export function scaleLoot(
  loot: Readonly<Record<string, number>>,
  multiplier: number,
): Readonly<Record<string, number>> {
  if (multiplier === 1) return loot;
  const scaled: Record<string, number> = {};
  for (const [item, amount] of Object.entries(loot)) {
    scaled[item] = Math.ceil(amount * multiplier);
  }
  return scaled;
}

function scaleEffectAmount(amount: EffectAmount, multiplier: number): EffectAmount {
  if (typeof amount === 'number') return Math.ceil(amount * multiplier);
  return { ...amount, base: Math.ceil(amount.base * multiplier) };
}

/**
 * Guter Koch (docs/02: Gerichte wirken +25 %, aufgerundet): scales the
 * numeric potency of a DISH card's effects — damage, block, heal and status
 * amounts. Draw/energy/cost effects are counts, not potency, and stay
 * unchanged (assumption: "+25 % Wirkung" reads as strength of the effect,
 * not extra card draws).
 */
export function scaleDishCard(card: CardDef, multiplier: number): CardDef {
  if (card.type !== 'dish' || multiplier === 1) return card;
  const effects: Effect[] = card.effects.map((effect) => {
    switch (effect.kind) {
      case 'damage':
        return { ...effect, amount: scaleEffectAmount(effect.amount, multiplier) };
      case 'block':
        return { ...effect, amount: scaleEffectAmount(effect.amount, multiplier) };
      case 'heal':
        return { ...effect, amount: Math.ceil(effect.amount * multiplier) };
      case 'applyStatus':
        return { ...effect, amount: Math.ceil(effect.amount * multiplier) };
      case 'conditionalDamage':
        return {
          ...effect,
          amount: scaleEffectAmount(effect.amount, multiplier),
          bonus: scaleEffectAmount(effect.bonus, multiplier),
        };
      default:
        return effect;
    }
  });
  return { ...card, effects };
}
