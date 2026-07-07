import { describe, expect, it } from 'vitest';
import { combatConfig } from '../../data/combat';
import {
  axeStrike,
  berrySnack,
  exhaustion,
  woodenShield,
  stoneThrow,
  catchBreath,
} from '../../data/cards/tier1';
import { copperBeetle, shadowRat, thornCreeper } from '../../data/enemies/tier1';
import { calculateAttackDamage } from './effects';
import { combatReducer, createCombatState } from './reducer';
import { createRng } from './rng';
import type { CardDef, CombatEvent, CombatState, EnemyDef } from './types';

const deckOf = (def: CardDef, count: number): CardDef[] => Array.from({ length: count }, () => def);

function newCombat(
  overrides: {
    deck?: CardDef[];
    enemies?: EnemyDef[];
    playerHp?: number;
    retreatChance?: number;
  } = {},
  seed = 42,
) {
  const rng = createRng(seed);
  const state = createCombatState(
    {
      playerHp: overrides.playerHp ?? 50,
      deck: overrides.deck ?? [...deckOf(axeStrike, 5), ...deckOf(woodenShield, 5)],
      enemies: overrides.enemies ?? [shadowRat],
      ...(overrides.retreatChance !== undefined ? { retreatChance: overrides.retreatChance } : {}),
    },
    rng,
  );
  return { state, rng };
}

function handCard(state: CombatState, cardId: string) {
  const card = state.hand.find((c) => c.def.id === cardId);
  if (!card) throw new Error(`card ${cardId} not in hand`);
  return card;
}

function play(
  state: CombatState,
  rng: () => number,
  cardId: string,
  target = state.enemies[0]!.instanceId,
) {
  return combatReducer(
    state,
    {
      type: 'PLAY_CARD',
      cardInstanceId: handCard(state, cardId).instanceId,
      targetEnemyId: target,
    },
    rng,
  );
}

describe('combat start & turn start', () => {
  it('draws a full hand and refills energy on turn start', () => {
    const { state } = newCombat();
    expect(state.turn).toBe(1);
    expect(state.hand).toHaveLength(combatConfig.handSize);
    expect(state.player.energy).toBe(combatConfig.energyPerTurn);
  });

  it('applies enemy start block and sets the first intent at combat start', () => {
    const { state } = newCombat({ enemies: [copperBeetle] });
    expect(state.enemies[0]!.block).toBe(copperBeetle.startBlock);
    expect(state.enemies[0]!.intent.intent).toBe('defend');
  });
});

describe('card costs & energy', () => {
  it('deducts the card cost from energy', () => {
    const { state, rng } = newCombat();
    const next = play(state, rng, 'axe_strike');
    expect(next.player.energy).toBe(combatConfig.energyPerTurn - axeStrike.cost);
  });

  it('rejects a card the player cannot afford', () => {
    const expensive: CardDef = { ...axeStrike, id: 'teuer', cost: 4 };
    const { state, rng } = newCombat({ deck: deckOf(expensive, 5) });
    const next = play(state, rng, 'teuer');
    expect(next.player.energy).toBe(combatConfig.energyPerTurn);
    expect(next.hand).toHaveLength(combatConfig.handSize);
    expect(next.enemies[0]!.hp).toBe(shadowRat.hp);
  });

  it('rejects unplayable status cards without touching energy', () => {
    const { state, rng } = newCombat({ deck: deckOf(exhaustion, 5) });
    const next = play(state, rng, 'exhaustion');
    expect(next.hand).toHaveLength(combatConfig.handSize);
    expect(next.player.energy).toBe(combatConfig.energyPerTurn);
  });

  it('gainEnergy can push energy above the per-turn base', () => {
    const energize: CardDef = {
      id: 'energize',
      name: 'Energie',
      type: 'skill',
      cost: 0,
      effects: [{ kind: 'gainEnergy', amount: 2 }],
    };
    const { state, rng } = newCombat({ deck: deckOf(energize, 5) });
    const next = play(state, rng, 'energize');
    expect(next.player.energy).toBe(combatConfig.energyPerTurn + 2);
  });
});

describe('block', () => {
  it('grants block via skill and decays it at the start of the next player turn', () => {
    const { state, rng } = newCombat({ deck: deckOf(woodenShield, 10) });
    let s = play(state, rng, 'wooden_shield');
    expect(s.player.block).toBe(5);
    s = combatReducer(s, { type: 'END_TURN' }, rng);
    // shadow_rat hits for 5 into 5 block → no hp loss, block used up…
    expect(s.player.hp).toBe(50);
    // …but block decayed at the new turn start.
    expect(s.turn).toBe(2);
    expect(s.player.block).toBe(0);
  });

  it('decays enemy block at the start of the enemy action', () => {
    const { state, rng } = newCombat({ enemies: [copperBeetle], deck: deckOf(woodenShield, 10) });
    const next = combatReducer(state, { type: 'END_TURN' }, rng);
    // start block (4) decayed, then intent "Einigeln" grants 6 fresh block.
    expect(next.enemies[0]!.block).toBe(6);
  });
});

describe('damage formula & statuses', () => {
  it('applies strength, weak and vulnerable with floor', () => {
    expect(calculateAttackDamage(6, {}, {})).toBe(6);
    expect(calculateAttackDamage(6, { strength: 2 }, {})).toBe(8);
    expect(calculateAttackDamage(6, { weak: 1 }, {})).toBe(4); // 4.5 → 4
    expect(calculateAttackDamage(6, {}, { vulnerable: 1 })).toBe(9);
    expect(calculateAttackDamage(6, { strength: 1, weak: 1 }, { vulnerable: 1 })).toBe(7); // 7×0.75×1.5 = 7.875 → 7
  });

  it('consumes block before hp', () => {
    const { state, rng } = newCombat({ enemies: [copperBeetle], deck: deckOf(axeStrike, 10) });
    const next = play(state, rng, 'axe_strike');
    expect(next.enemies[0]!.block).toBe(0);
    expect(next.enemies[0]!.hp).toBe(copperBeetle.hp - (6 - 4));
  });
});

describe('poison', () => {
  const poisonDart: CardDef = {
    id: 'giftpfeil',
    name: 'Giftpfeil',
    type: 'skill',
    cost: 0,
    effects: [{ kind: 'applyStatus', status: 'poison', amount: 3, target: 'target' }],
  };

  it('ticks on the enemy after its action, ignores block and decays by 1', () => {
    const { state, rng } = newCombat({ enemies: [copperBeetle], deck: deckOf(poisonDart, 10) });
    let s = play(state, rng, 'giftpfeil');
    s = combatReducer(s, { type: 'END_TURN' }, rng);
    // Beetle blocked 6 this turn, but poison ignores block: 16 − 3 = 13.
    expect(s.enemies[0]!.hp).toBe(copperBeetle.hp - 3);
    expect(s.enemies[0]!.block).toBe(6);
    expect(s.enemies[0]!.statuses.poison).toBe(2);
  });

  it('ticks on the player at turn end before enemies act', () => {
    const { state, rng } = newCombat({ deck: deckOf(woodenShield, 10) });
    const poisoned = structuredClone(state);
    poisoned.player.statuses.poison = 2;
    const s = combatReducer(poisoned, { type: 'END_TURN' }, rng);
    // 2 poison (ignores block) + 5 rat bite = 7.
    expect(s.player.hp).toBe(50 - 2 - 5);
    expect(s.player.statuses.poison).toBe(1);
  });
});

describe('draw pile & reshuffle', () => {
  it('reshuffles the discard pile when the draw pile runs out', () => {
    const deck = [...deckOf(axeStrike, 4), ...deckOf(woodenShield, 2)]; // 6 cards
    const { state, rng } = newCombat({ deck, enemies: [thornCreeper] });
    expect(state.drawPile).toHaveLength(1);
    const next = combatReducer(state, { type: 'END_TURN' }, rng);
    // turn 2 draw: 1 from draw pile, reshuffle 5 discarded, draw 4 more.
    expect(next.hand).toHaveLength(5);
    expect(next.drawPile).toHaveLength(1);
    expect(next.discardPile).toHaveLength(0);
  });

  it('draw effect reshuffles mid-turn', () => {
    const deck = [...deckOf(catchBreath, 5)];
    const { state, rng } = newCombat({ deck });
    expect(state.drawPile).toHaveLength(0);
    // No discard yet: first draw does nothing until cards are discarded.
    const s = play(state, rng, 'catch_breath');
    // the played card itself went to discard, then draw 2 → reshuffle pulls it back.
    expect(s.hand.length).toBeGreaterThanOrEqual(combatConfig.handSize - 1);
    expect(s.hand.length + s.drawPile.length + s.discardPile.length).toBe(5);
  });
});

describe('status cards & dishes at turn end', () => {
  it('status cards vanish at turn end instead of being discarded', () => {
    const deck = [...deckOf(exhaustion, 3), ...deckOf(woodenShield, 2)];
    const { state, rng } = newCombat({ deck });
    const next = combatReducer(state, { type: 'END_TURN' }, rng);
    const allCards = [...next.hand, ...next.drawPile, ...next.discardPile];
    expect(allCards.filter((c) => c.def.type === 'status')).toHaveLength(0);
    expect(allCards).toHaveLength(2);
  });

  it('dish cards are consumed, not discarded', () => {
    const deck = [...deckOf(berrySnack, 1), ...deckOf(woodenShield, 4)];
    const { state, rng } = newCombat({ deck, playerHp: 40 });
    const hurt = structuredClone(state);
    hurt.player.maxHp = 50;
    const next = play(hurt, rng, 'berry_snack');
    expect(next.player.hp).toBe(45);
    expect(next.consumed).toHaveLength(1);
    expect(next.discardPile).toHaveLength(0);
  });
});

describe('victory & defeat', () => {
  it('reaches victory when the last enemy dies mid-turn', () => {
    const { state, rng } = newCombat({ deck: deckOf(axeStrike, 10) });
    let s = play(state, rng, 'axe_strike');
    s = play(s, rng, 'axe_strike'); // 12 damage → rat dead
    expect(s.phase).toBe('victory');
    // terminal state ignores further events
    expect(combatReducer(s, { type: 'END_TURN' }, rng)).toBe(s);
  });

  it('reaches defeat when enemy damage kills the player', () => {
    const { state, rng } = newCombat({ playerHp: 3, deck: deckOf(stoneThrow, 10) });
    const next = combatReducer(state, { type: 'END_TURN' }, rng);
    expect(next.phase).toBe('defeat');
    expect(next.player.hp).toBeLessThanOrEqual(0);
  });
});

describe('retaliation (Vergeltung)', () => {
  it('deals plain damage to the attacker when hitting a retaliating enemy', () => {
    const { state, rng } = newCombat({ enemies: [thornCreeper], deck: deckOf(axeStrike, 10) });
    // Creeper's first intent is Dornenpanzer — end turn so it gains retaliate 2.
    let s = combatReducer(state, { type: 'END_TURN' }, rng);
    expect(s.enemies[0]!.statuses.retaliate).toBe(2);
    const hpBefore = s.player.hp;
    s = play(s, rng, 'axe_strike');
    expect(s.player.hp).toBe(hpBefore - 2);
  });

  it('retaliation damage is absorbed by the attacker block', () => {
    const { state, rng } = newCombat({
      enemies: [thornCreeper],
      deck: [...deckOf(woodenShield, 5), ...deckOf(axeStrike, 5)],
    });
    let s = combatReducer(state, { type: 'END_TURN' }, rng);
    s = play(s, rng, 'wooden_shield'); // 5 block
    const hpBefore = s.player.hp;
    s = play(s, rng, 'axe_strike');
    expect(s.player.hp).toBe(hpBefore);
    expect(s.player.block).toBe(3);
  });
});

describe('retreat', () => {
  it('ends the combat immediately on success', () => {
    const { state } = newCombat();
    const alwaysLow = () => 0; // < retreatChance → success
    const next = combatReducer(state, { type: 'RETREAT' }, alwaysLow);
    expect(next.phase).toBe('retreated');
  });

  it('on failure the turn ends and enemies act', () => {
    const { state } = newCombat();
    const alwaysHigh = () => 0.99; // ≥ retreatChance → failure
    const next = combatReducer(state, { type: 'RETREAT' }, alwaysHigh);
    expect(next.phase).toBe('playerTurn');
    expect(next.turn).toBe(2); // enemies acted, new player turn started
    expect(next.player.hp).toBe(50 - 5); // rat bit for 5
  });

  it('uses the configured base chance from src/data', () => {
    const { state } = newCombat();
    expect(state.retreatChance).toBe(combatConfig.retreatBaseChance);
  });
});

describe('enemy intents', () => {
  it('cycles through the pattern after each action', () => {
    const { state, rng } = newCombat({ deck: deckOf(woodenShield, 20) });
    expect(state.enemies[0]!.intent.effects).toEqual([
      { kind: 'damage', amount: 5, target: 'player' },
    ]);
    let s = combatReducer(state, { type: 'END_TURN' }, rng);
    s = combatReducer(s, { type: 'END_TURN' }, rng);
    // after two actions the rat telegraphs Nagen 6
    expect(s.enemies[0]!.intent.effects).toEqual([{ kind: 'damage', amount: 6, target: 'player' }]);
  });

  it('phased patterns switch when hp drops below the threshold', () => {
    const phasedEnemy: EnemyDef = {
      id: 'phaser_test',
      name: 'Phasenwesen',
      tier: 1,
      hp: 20,
      pattern: {
        kind: 'phased',
        phases: [
          {
            hpBelow: 0.5,
            steps: [
              { intent: 'attack', effects: [{ kind: 'damage', amount: 9, target: 'player' }] },
            ],
          },
          {
            steps: [
              { intent: 'attack', effects: [{ kind: 'damage', amount: 2, target: 'player' }] },
            ],
          },
        ],
      },
    };
    const { state, rng } = newCombat({ enemies: [phasedEnemy], deck: deckOf(axeStrike, 10) });
    let s = play(state, rng, 'axe_strike');
    s = play(s, rng, 'axe_strike'); // 20 − 12 = 8 → below 50 %
    s = combatReducer(s, { type: 'END_TURN' }, rng);
    // enraged phase intent after acting
    expect(s.enemies[0]!.intent.effects).toEqual([{ kind: 'damage', amount: 9, target: 'player' }]);
  });

  // Wurzelwächter-style fixture (docs/07 boss pre-spec): default cycle at
  // full hp, shortened/enraged cycle below 50 %. Two steps per phase so we
  // can also verify the step-index reset on transition.
  const twoPhaseEnemy: EnemyDef = {
    id: 'root_test',
    name: 'Wurzeltest',
    tier: 1,
    hp: 20,
    pattern: {
      kind: 'phased',
      phases: [
        {
          steps: [
            { intent: 'attack', effects: [{ kind: 'damage', amount: 2, target: 'player' }] },
            { intent: 'defend', effects: [{ kind: 'block', amount: 5, target: 'self' }] },
          ],
        },
        {
          hpBelow: 0.5,
          steps: [
            { intent: 'attack', effects: [{ kind: 'damage', amount: 7, target: 'player' }] },
            {
              intent: 'buff',
              effects: [{ kind: 'applyStatus', status: 'strength', amount: 1, target: 'self' }],
            },
          ],
        },
      ],
    },
  };

  it('restarts the new phase at its first step when the threshold is crossed', () => {
    const { state, rng } = newCombat({ enemies: [twoPhaseEnemy], deck: deckOf(axeStrike, 10) });
    // advance within phase 1 first, so patternIndex is 1
    let s = combatReducer(state, { type: 'END_TURN' }, rng);
    expect(s.enemies[0]!.patternIndex).toBe(1);
    s = play(s, rng, 'axe_strike');
    s = play(s, rng, 'axe_strike'); // 20 − 12 = 8 → below 50 %
    s = combatReducer(s, { type: 'END_TURN' }, rng);
    // phase 2 begins at step 0 (attack 7), not at the carried-over index.
    expect(s.enemies[0]!.patternIndex).toBe(0);
    expect(s.enemies[0]!.intent.effects).toEqual([{ kind: 'damage', amount: 7, target: 'player' }]);
  });

  it('never falls back to an earlier phase when healed above the threshold', () => {
    // Assumption (StS convention, docs/07 silent): phase transitions are
    // one-way — documented on EnemyState.phaseIndex.
    const { state, rng } = newCombat({ enemies: [twoPhaseEnemy], deck: deckOf(axeStrike, 10) });
    let s = play(state, rng, 'axe_strike');
    s = play(s, rng, 'axe_strike'); // hp 8 < 50 %
    s = combatReducer(s, { type: 'END_TURN' }, rng);
    expect(s.enemies[0]!.intent.effects).toEqual([{ kind: 'damage', amount: 7, target: 'player' }]);
    // heal the enemy back to full…
    const healed = structuredClone(s);
    healed.enemies[0]!.hp = healed.enemies[0]!.maxHp;
    const after = combatReducer(healed, { type: 'END_TURN' }, rng);
    // …it still rotates within phase 2 (buff step), no revert to phase 1.
    expect(after.enemies[0]!.intent.intent).toBe('buff');
    expect(after.enemies[0]!.phaseIndex).toBe(1);
  });
});

describe('determinism', () => {
  it('same seed and same events produce identical states', () => {
    const run = (seed: number) => {
      const rng = createRng(seed);
      let s = createCombatState(
        {
          playerHp: 50,
          deck: [...deckOf(axeStrike, 5), ...deckOf(woodenShield, 5)],
          enemies: [thornCreeper],
        },
        rng,
      );
      const events: CombatEvent[] = [
        {
          type: 'PLAY_CARD',
          cardInstanceId: s.hand[0]!.instanceId,
          targetEnemyId: s.enemies[0]!.instanceId,
        },
        { type: 'END_TURN' },
        { type: 'END_TURN' },
        { type: 'RETREAT' },
      ];
      for (const event of events) s = combatReducer(s, event, rng);
      return s;
    };
    expect(run(1234)).toEqual(run(1234));
    // different seed shuffles differently
    const a = run(1234);
    const b = run(9999);
    expect(JSON.stringify(a.drawPile) === JSON.stringify(b.drawPile) && a.phase === b.phase).toBe(
      false,
    );
  });

  it('the reducer never mutates the input state', () => {
    const { state, rng } = newCombat();
    const snapshot = structuredClone(state);
    combatReducer(state, { type: 'END_TURN' }, rng);
    expect(state).toEqual(snapshot);
  });
});
