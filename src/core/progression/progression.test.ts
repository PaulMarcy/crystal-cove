import { describe, expect, it } from 'vitest';
import { progressionConfig, xpSources } from '../../data/progression';
import { disenchantConfig } from '../../data/recipes';
import { talents } from '../../data/talents';
import type { CardDef } from '../combat/types';
import {
  availableTalentPoints,
  branchProgress,
  canUnlockTalent,
  deckLimitForLevel,
  effectiveLevelCap,
  levelForXp,
  maxHpForLevel,
  neutralTalentModifiers,
  scaleDishCard,
  scaleLoot,
  talentModifiers,
  talentPointsForLevel,
  talismanSlotsForLevel,
  totalXpForLevel,
  xpForEncounter,
  xpForLevelUp,
  xpProgress,
} from './progression';

describe('level curve (docs/02: round(100 × n^1.5))', () => {
  it('matches the documented curve values', () => {
    expect(xpForLevelUp(1)).toBe(100);
    expect(xpForLevelUp(2)).toBe(283);
    expect(xpForLevelUp(3)).toBe(520);
    expect(xpForLevelUp(4)).toBe(800);
    expect(xpForLevelUp(9)).toBe(2700);
  });

  it('cumulative XP: level 1 = 0, level 2 = 100, level 3 = 383', () => {
    expect(totalXpForLevel(1)).toBe(0);
    expect(totalXpForLevel(2)).toBe(100);
    expect(totalXpForLevel(3)).toBe(383);
  });

  it('levelForXp walks the curve and respects boundaries', () => {
    expect(levelForXp(0)).toBe(1);
    expect(levelForXp(99)).toBe(1);
    expect(levelForXp(100)).toBe(2);
    expect(levelForXp(382)).toBe(2);
    expect(levelForXp(383)).toBe(3);
  });

  it('caps at the M4 level cap — banked XP never exceeds it', () => {
    expect(effectiveLevelCap()).toBe(progressionConfig.levelCap);
    expect(levelForXp(Number.MAX_SAFE_INTEGER)).toBe(progressionConfig.levelCap);
  });

  it('xpProgress reports intoLevel/forNext and null at the cap', () => {
    expect(xpProgress(150)).toEqual({ level: 2, intoLevel: 50, forNext: 283 });
    const capXp = totalXpForLevel(progressionConfig.levelCap);
    expect(xpProgress(capXp + 5)).toEqual({
      level: progressionConfig.levelCap,
      intoLevel: 5,
      forNext: null,
    });
  });
});

describe('xpForEncounter (docs/07)', () => {
  it('grants base + 7 per additional enemy', () => {
    expect(xpForEncounter({ enemyCount: 1, elite: false })).toBe(15);
    expect(xpForEncounter({ enemyCount: 2, elite: false })).toBe(22);
    expect(xpForEncounter({ enemyCount: 3, elite: false })).toBe(29);
  });

  it('elite encounters are a flat 38 (docs/07, not the docs/02 formula)', () => {
    expect(xpForEncounter({ enemyCount: 1, elite: true })).toBe(38);
    expect(xpForEncounter({ enemyCount: 3, elite: true })).toBe(38);
  });

  it('boss encounters grant 300', () => {
    expect(xpForEncounter({ enemyCount: 1, elite: false, boss: true })).toBe(xpSources.boss);
  });
});

describe('level rewards (docs/02)', () => {
  it('max HP: 50 at level 1, +5 per level, plus talent bonus', () => {
    expect(maxHpForLevel(1)).toBe(50);
    expect(maxHpForLevel(10)).toBe(95);
    expect(maxHpForLevel(4, 5)).toBe(70);
  });

  it('deck limit: 12 until level 3, 15 from level 4', () => {
    expect(deckLimitForLevel(1)).toBe(12);
    expect(deckLimitForLevel(3)).toBe(12);
    expect(deckLimitForLevel(4)).toBe(15);
    expect(deckLimitForLevel(10)).toBe(15);
  });

  it('talisman slot 1 unlocks at level 8 (flag only in M4)', () => {
    expect(talismanSlotsForLevel(7)).toBe(0);
    expect(talismanSlotsForLevel(8)).toBe(1);
  });

  it('talent points: 1 per 3 levels (Lv 3/6/9 → 3 in M4)', () => {
    expect(talentPointsForLevel(1)).toBe(0);
    expect(talentPointsForLevel(3)).toBe(1);
    expect(talentPointsForLevel(6)).toBe(2);
    expect(talentPointsForLevel(9)).toBe(3);
    expect(talentPointsForLevel(10)).toBe(3);
  });
});

describe('talent unlock rules (docs/02: sequential per branch, 1 point each)', () => {
  it('tier 1 unlocks with a free point', () => {
    expect(canUnlockTalent('blade_hone', [], 3, talents)).toEqual({ ok: true });
  });

  it('tier 2 is locked while tier 1 is not owned', () => {
    expect(canUnlockTalent('toughness', [], 6, talents)).toEqual({
      ok: false,
      error: 'previous_tier_locked',
    });
    expect(canUnlockTalent('toughness', ['blade_hone'], 6, talents)).toEqual({ ok: true });
  });

  it('branches are independent — fighter tier 1 does not unlock crafter tier 2', () => {
    expect(canUnlockTalent('good_cook', ['blade_hone'], 6, talents)).toEqual({
      ok: false,
      error: 'previous_tier_locked',
    });
  });

  it('rejects without a free talent point (budget = floor(level/3))', () => {
    expect(canUnlockTalent('blade_hone', [], 2, talents)).toEqual({
      ok: false,
      error: 'no_points',
    });
    expect(canUnlockTalent('thrifty_hands', ['blade_hone'], 3, talents)).toEqual({
      ok: false,
      error: 'no_points',
    });
  });

  it('rejects double unlock and unknown ids', () => {
    expect(canUnlockTalent('blade_hone', ['blade_hone'], 9, talents)).toEqual({
      ok: false,
      error: 'already_unlocked',
    });
    expect(canUnlockTalent('nonsense', [], 9, talents)).toEqual({
      ok: false,
      error: 'unknown_talent',
    });
  });

  it('availableTalentPoints subtracts spent points', () => {
    expect(availableTalentPoints(9, ['blade_hone', 'toughness'])).toBe(1);
  });

  it('branchProgress reports the highest owned tier', () => {
    expect(branchProgress('fighter', [], talents)).toBe(0);
    expect(branchProgress('fighter', ['blade_hone', 'toughness'], talents)).toBe(2);
  });
});

describe('talentModifiers', () => {
  it('neutral without talents (refund = base fraction from data)', () => {
    expect(talentModifiers([], talents)).toEqual(neutralTalentModifiers);
    expect(neutralTalentModifiers.disenchantRefundFraction).toBe(
      disenchantConfig.baseRefundFraction,
    );
  });

  it('folds all nine talents into the typed modifier object', () => {
    const mods = talentModifiers(
      talents.map((t) => t.id),
      talents,
    );
    expect(mods).toEqual({
      firstAttackBonus: 2,
      maxHpBonus: 5,
      dungeonStartBlock: 3,
      craftBaseMaterialDiscount: 1,
      dishEffectMultiplier: 1.25,
      disenchantRefundFraction: 0.75,
      harvestYieldBonus: 1,
      lootMultiplier: 1.25,
      explorationXpMultiplier: 1.5,
    });
  });

  it('ignores unknown ids (stale saves stay loadable)', () => {
    expect(talentModifiers(['ghost_talent'], talents)).toEqual(neutralTalentModifiers);
  });
});

describe('modifier helpers', () => {
  it('scaleLoot: +25 % rounded up per line, identity at ×1', () => {
    const loot = { vine: 2, resin: 1 };
    expect(scaleLoot(loot, 1.25)).toEqual({ vine: 3, resin: 2 });
    expect(scaleLoot(loot, 1)).toBe(loot);
  });

  it('scaleDishCard: dish heal/status amounts +25 % rounded up', () => {
    const dish: CardDef = {
      id: 'test_dish',
      name: 'Test',
      type: 'dish',
      cost: 0,
      effects: [
        { kind: 'heal', amount: 5, target: 'player' },
        { kind: 'applyStatus', status: 'strength', amount: 2, target: 'player' },
        { kind: 'draw', amount: 1 },
      ],
    };
    const scaled = scaleDishCard(dish, 1.25);
    expect(scaled.effects).toEqual([
      { kind: 'heal', amount: 7, target: 'player' },
      { kind: 'applyStatus', status: 'strength', amount: 3, target: 'player' },
      // draw is a count, not potency — unchanged (assumption in core/progression)
      { kind: 'draw', amount: 1 },
    ]);
  });

  it('scaleDishCard leaves non-dish cards untouched', () => {
    const attack: CardDef = {
      id: 'test_attack',
      name: 'Test',
      type: 'attack',
      cost: 1,
      effects: [{ kind: 'damage', amount: 6, target: 'target' }],
    };
    expect(scaleDishCard(attack, 1.25)).toBe(attack);
  });
});
