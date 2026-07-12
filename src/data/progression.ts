/**
 * Progression balancing data (docs/02) — XP curve, XP sources, level
 * rewards and milestones. Pure data; the logic lives in core/progression
 * (CLAUDE.md rule 2).
 *
 * Sources:
 * - docs/02 "XP-System": curve round(100 × n^1.5), max level 30.
 * - docs/07 "XP" (Tier 1): 15 base + 7 per extra enemy, Elite = flat 38
 *   (docs/07 is authoritative over the docs/02 ×2.5 formula — human-approved
 *   M4 decision, noted in docs/02), Boss 300.
 * - docs/02 "Level-Belohnungen": +5 max HP per level (start 50),
 *   1 talent point every 3 levels, milestones Lv 4 (deck 15) and
 *   Lv 8 (talisman slot 1).
 */

export const progressionConfig = {
  /** XP for level n → n+1 = round(curveBase × n^curveExponent) (docs/02). */
  curveBase: 100,
  curveExponent: 1.5,
  /** Generic curve ceiling (docs/02: Maximallevel 30). */
  maxLevel: 30,
  /** M4 level cap — raised in later milestones, data-only change. */
  levelCap: 10,
  /** Max HP = baseMaxHp + hpPerLevel × (level − 1) (docs/02, docs/03). */
  baseMaxHp: 50,
  hpPerLevel: 5,
  /** 1 talent point every N levels (docs/02: Lv 3/6/9 → 3 points in M4). */
  levelsPerTalentPoint: 3,
} as const;

/** XP sources (docs/07 "XP" for Tier 1; docs/02 for exploration). */
export const xpSources = {
  /** Won combat, Tier 1 base (single enemy). */
  combatBase: 15,
  /** Per additional enemy in the encounter. */
  combatPerExtraEnemy: 7,
  /** Elite encounter — flat constant (docs/07, overrides docs/02 formula). */
  elite: 38,
  /** Tier 1 boss. */
  boss: 300,
  /** New area revealed (docs/02) — granted from M4 Task 2 (exploration). */
  areaRevealed: 25,
  /** Shrine / secret discovered (docs/02) — granted from M4 Task 2. */
  shrineDiscovered: 40,
} as const;

export type XpSource = 'combat' | 'elite' | 'boss' | 'area' | 'shrine' | 'scripted';

/**
 * Level milestones (docs/02 table). Only the M4-relevant entries are data
 * here; later milestones (Lv 12+) arrive with their features.
 */
export const milestones = {
  /** Lv 4: combat deck max size 12 → 15 (docs/02). */
  deckSize: [
    { level: 1, maxSize: 12 },
    { level: 4, maxSize: 15 },
  ],
  /**
   * Lv 8: talisman slot 1 (docs/02). Flag only — talisman functionality is
   * a later task; the progression layer just reports the unlocked slots.
   */
  talismanSlots: [{ level: 8, slots: 1 }],
} as const;
