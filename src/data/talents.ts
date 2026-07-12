/**
 * Talent tree V1 (M4): 3 branches × 3 tiers (docs/02 — human-approved M4
 * table; expansion to 3×6 is post-release). Pure data: every talent carries
 * a declarative effect descriptor; core/progression folds unlocked talents
 * into a typed TalentModifiers object that other systems consume.
 *
 * Rules (docs/02): 1 point per talent, tiers within a branch unlock
 * sequentially (tier 2 requires tier 1), 1 talent point every 3 levels.
 * No respec in M4.
 */
import { strings } from '../shared/strings';

export type TalentBranch = 'fighter' | 'crafter' | 'wanderer';

/**
 * Declarative talent effects — interpreted in core/progression
 * (talentModifiers) and applied by the owning systems:
 * - firstAttackBonus     → combat core (CombatSetup.firstAttackBonus)
 * - maxHpBonus           → core/progression maxHp
 * - dungeonStartBlock    → combat setup, dungeon fights only (TODO(M4):
 *                          dungeons arrive in Task 3 — until then inert)
 * - craftBaseMaterialDiscount → core/economy/crafting (card recipes only)
 * - dishEffectPercent    → dish card effect scaling (rounded up)
 * - disenchantRefundFraction  → core/economy/disenchant (replaces base 50 %)
 * - harvestYieldBonus    → harvest nodes (store wiring)
 * - lootPercent          → combat loot scaling (rounded up)
 * - explorationXpPercent → area/shrine XP (TODO(M4-Task2): exploration XP
 *                          is granted there — modifier is ready, unused)
 */
export type TalentEffect =
  | { kind: 'firstAttackBonus'; amount: number }
  | { kind: 'maxHpBonus'; amount: number }
  | { kind: 'dungeonStartBlock'; amount: number }
  | { kind: 'craftBaseMaterialDiscount'; amount: number }
  | { kind: 'dishEffectPercent'; percent: number }
  | { kind: 'disenchantRefundFraction'; fraction: number }
  | { kind: 'harvestYieldBonus'; amount: number }
  | { kind: 'lootPercent'; percent: number }
  | { kind: 'explorationXpPercent'; percent: number };

export interface TalentDef {
  id: string;
  branch: TalentBranch;
  /** Tier within the branch (1–3); unlocks sequentially. */
  tier: 1 | 2 | 3;
  name: string;
  description: string;
  effect: TalentEffect;
}

export const talents: readonly TalentDef[] = [
  // ── Kämpfer ────────────────────────────────────────────────────────────
  {
    id: 'blade_hone',
    branch: 'fighter',
    tier: 1,
    name: strings.talents.blade_hone.name,
    description: strings.talents.blade_hone.description,
    effect: { kind: 'firstAttackBonus', amount: 2 },
  },
  {
    id: 'toughness',
    branch: 'fighter',
    tier: 2,
    name: strings.talents.toughness.name,
    description: strings.talents.toughness.description,
    effect: { kind: 'maxHpBonus', amount: 5 },
  },
  {
    id: 'bulwark',
    branch: 'fighter',
    tier: 3,
    name: strings.talents.bulwark.name,
    description: strings.talents.bulwark.description,
    effect: { kind: 'dungeonStartBlock', amount: 3 },
  },
  // ── Handwerker ─────────────────────────────────────────────────────────
  {
    id: 'thrifty_hands',
    branch: 'crafter',
    tier: 1,
    name: strings.talents.thrifty_hands.name,
    description: strings.talents.thrifty_hands.description,
    effect: { kind: 'craftBaseMaterialDiscount', amount: 1 },
  },
  {
    id: 'good_cook',
    branch: 'crafter',
    tier: 2,
    name: strings.talents.good_cook.name,
    description: strings.talents.good_cook.description,
    effect: { kind: 'dishEffectPercent', percent: 25 },
  },
  {
    id: 'efficient_salvage',
    branch: 'crafter',
    tier: 3,
    name: strings.talents.efficient_salvage.name,
    description: strings.talents.efficient_salvage.description,
    effect: { kind: 'disenchantRefundFraction', fraction: 0.75 },
  },
  // ── Wanderer ───────────────────────────────────────────────────────────
  {
    id: 'gatherers_luck',
    branch: 'wanderer',
    tier: 1,
    name: strings.talents.gatherers_luck.name,
    description: strings.talents.gatherers_luck.description,
    effect: { kind: 'harvestYieldBonus', amount: 1 },
  },
  {
    id: 'loot_hunter',
    branch: 'wanderer',
    tier: 2,
    name: strings.talents.loot_hunter.name,
    description: strings.talents.loot_hunter.description,
    effect: { kind: 'lootPercent', percent: 25 },
  },
  {
    id: 'map_savant',
    branch: 'wanderer',
    tier: 3,
    name: strings.talents.map_savant.name,
    description: strings.talents.map_savant.description,
    effect: { kind: 'explorationXpPercent', percent: 50 },
  },
];

export const talentsById: ReadonlyMap<string, TalentDef> = new Map(
  talents.map((t) => [t.id, t]),
);

export const talentBranches: readonly TalentBranch[] = ['fighter', 'crafter', 'wanderer'];
