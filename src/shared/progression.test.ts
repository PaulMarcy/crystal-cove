import { beforeEach, describe, expect, it } from 'vitest';
import { totalXpForLevel } from '../core/progression/progression';
import { emptyInventory } from '../core/economy/inventory';
import { starterDeckIds } from '../data/cards/tier1';
import { combatConfig } from '../data/combat';
import { initialShadowDensity } from '../data/encounters/tier1';
import { gameStore } from './store';

/**
 * Store-level wiring tests for M4 progression: XP after encounter victory,
 * talent unlocks, level-dependent deck limit and talent-modified systems.
 */

beforeEach(() => {
  gameStore.setState({
    inventory: emptyInventory,
    harvestedNodeIds: [],
    shadowDensity: initialShadowDensity,
    playerPosition: null,
    playerZone: null,
    collection: [],
    deck: [...starterDeckIds],
    consumedStarterDishes: [],
    toolTier: combatConfig.baseToolTier,
    activeStation: null,
    combat: null,
    combatSeed: null,
    combatLoot: null,
    currentEncounter: null,
    lastCombatOutcome: null,
    lastLoot: null,
    xp: 0,
    unlockedTalents: [],
  });
});

describe('XP after combat victory', () => {
  it('grants 15 + 7 per extra enemy for a won encounter (docs/07)', () => {
    gameStore.getState().startEncounter('strand', 7);
    const combat = gameStore.getState().combat!;
    const enemyCount = combat.enemies.length;
    gameStore.setState({
      combat: {
        ...combat,
        phase: 'victory',
        enemies: combat.enemies.map((e) => ({ ...e, hp: 0 })),
      },
    });
    gameStore.getState().endCombat();
    expect(gameStore.getState().xp).toBe(15 + 7 * (enemyCount - 1));
    expect(gameStore.getState().currentEncounter).toBeNull();
  });

  it('grants nothing on defeat and for encounter-less dev combats', () => {
    gameStore.getState().startEncounter('strand', 7);
    gameStore.setState({ combat: { ...gameStore.getState().combat!, phase: 'defeat' } });
    gameStore.getState().endCombat();
    expect(gameStore.getState().xp).toBe(0);
  });

  it('grantXp supports scripted grants and ignores non-positive amounts', () => {
    gameStore.getState().grantXp(40, 'shrine');
    gameStore.getState().grantXp(-5, 'scripted');
    gameStore.getState().grantXp(0, 'scripted');
    expect(gameStore.getState().xp).toBe(40);
  });
});

describe('talent unlocks via the store', () => {
  it('unlocks sequentially within a branch and spends points', () => {
    gameStore.setState({ xp: totalXpForLevel(6) }); // 2 points
    expect(gameStore.getState().unlockTalent('toughness')).toBe(false);
    expect(gameStore.getState().unlockTalent('blade_hone')).toBe(true);
    expect(gameStore.getState().unlockTalent('toughness')).toBe(true);
    // Budget exhausted at level 6.
    expect(gameStore.getState().unlockTalent('bulwark')).toBe(false);
    expect(gameStore.getState().unlockedTalents).toEqual(['blade_hone', 'toughness']);
  });
});

describe('level-dependent deck limit (docs/02 Lv 4: 12 → 15)', () => {
  it('blocks card 13 below level 4 and allows it from level 4', () => {
    gameStore.setState({ collection: ['stone_throw'] });
    expect(gameStore.getState().addCardToDeck('stone_throw')).toBe(false);
    gameStore.setState({ xp: totalXpForLevel(4) });
    expect(gameStore.getState().addCardToDeck('stone_throw')).toBe(true);
    expect(gameStore.getState().deck.length).toBe(13);
    // A 13-card deck starts combats at level 4 (max 15, min 12).
    expect(gameStore.getState().startEncounter('strand', 7)).toBe(true);
  });
});

describe('talent modifiers wired into systems', () => {
  it('Sammlerglück adds +1 to harvest node yield', () => {
    gameStore.setState({
      xp: totalXpForLevel(3),
      unlockedTalents: ['gatherers_luck'],
    });
    const ok = gameStore.getState().harvestNode('hb-tree-1');
    expect(ok).toBe(true);
    // Base tree yield 2 (data/resources) + 1 talent bonus, no tool bonus.
    expect(gameStore.getState().inventory.wood).toBe(3);
  });

  it('Zähigkeit and level raise combat start HP (50 base, +5/level, +5 talent)', () => {
    gameStore.setState({
      xp: totalXpForLevel(4),
      unlockedTalents: ['blade_hone', 'toughness'],
    });
    gameStore.getState().startEncounter('strand', 7);
    const combat = gameStore.getState().combat!;
    expect(combat.player.maxHp).toBe(50 + 5 * 3 + 5);
    expect(combat.player.hp).toBe(combat.player.maxHp);
    // Klingenschliff arrives as first-attack bonus in the combat state.
    expect(combat.firstAttackBonus).toBe(2);
    gameStore.getState().endCombat();
  });
});
