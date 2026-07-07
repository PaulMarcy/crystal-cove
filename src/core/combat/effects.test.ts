/**
 * Tests for the completed effect interpreter (ROADMAP M1):
 * addCard, ignoresBlock, multi-hit, cost modifier, toolTier scaling and the
 * full status set (Stärke, Verwundbar, Schwäche, Gift, Vergeltung).
 */
import { describe, expect, it } from 'vitest';
import { combatConfig } from '../../data/combat';
import { axeStrike, exhaustion, woodenShield } from '../../data/cards/tier1';
import { copperBeetle, shadowRat } from '../../data/enemies/tier1';
import { combatReducer, createCombatState } from './reducer';
import { createRng } from './rng';
import type { CardDef, CombatState, EnemyDef } from './types';

const deckOf = (def: CardDef, count: number): CardDef[] => Array.from({ length: count }, () => def);

// ── Card fixtures (docs/10 excerpts, inline until content-smith lands) ────

const panzerbrecher: CardDef = {
  id: 'panzerbrecher',
  name: 'Panzerbrecher',
  type: 'attack',
  cost: 1,
  effects: [{ kind: 'damage', amount: 6, target: 'target', ignoresBlock: true }],
};

const kristallschild: CardDef = {
  id: 'kristallschild',
  name: 'Kristallschild',
  type: 'skill',
  cost: 1,
  effects: [
    { kind: 'block', amount: 5, target: 'self' },
    { kind: 'modifyNextCardCost', amount: -1 },
  ],
};

const doppelhieb: CardDef = {
  id: 'doppelhieb',
  name: 'Doppelhieb',
  type: 'attack',
  cost: 1,
  effects: [{ kind: 'damage', amount: 5, target: 'target', times: 2 }],
};

const scalingAxt: CardDef = {
  id: 'scaling_axt',
  name: 'Axtschlag (skaliert)',
  type: 'attack',
  cost: 1,
  effects: [{ kind: 'damage', amount: { base: 6, scaling: 'toolTier' }, target: 'target' }],
};

const wildwuchsTerror: EnemyDef = {
  id: 'thorn_terror_lite',
  name: 'Dornenschreck (Test)',
  tier: 1,
  hp: 38,
  pattern: {
    kind: 'cycle',
    steps: [
      {
        intent: 'deck',
        effects: [{ kind: 'addCard', card: exhaustion, zone: 'discard' }],
      },
    ],
  },
};

function newCombat(
  overrides: { deck?: CardDef[]; enemies?: EnemyDef[]; playerHp?: number; toolTier?: number } = {},
  seed = 42,
) {
  const rng = createRng(seed);
  const state = createCombatState(
    {
      playerHp: overrides.playerHp ?? 50,
      deck: overrides.deck ?? deckOf(axeStrike, 10),
      enemies: overrides.enemies ?? [shadowRat],
      ...(overrides.toolTier !== undefined ? { toolTier: overrides.toolTier } : {}),
    },
    rng,
  );
  return { state, rng };
}

function play(
  state: CombatState,
  rng: () => number,
  cardId: string,
  target = state.enemies[0]!.instanceId,
) {
  const card = state.hand.find((c) => c.def.id === cardId);
  if (!card) throw new Error(`card ${cardId} not in hand`);
  return combatReducer(
    state,
    { type: 'PLAY_CARD', cardInstanceId: card.instanceId, targetEnemyId: target },
    rng,
  );
}

describe('ignoresBlock (Panzerbrecher)', () => {
  it('deals full damage to hp and leaves block untouched', () => {
    const { state, rng } = newCombat({ enemies: [copperBeetle], deck: deckOf(panzerbrecher, 10) });
    const next = play(state, rng, 'panzerbrecher');
    expect(next.enemies[0]!.block).toBe(copperBeetle.startBlock);
    expect(next.enemies[0]!.hp).toBe(copperBeetle.hp - 6);
  });

  it('still applies status multipliers (vulnerable target)', () => {
    const { state, rng } = newCombat({ enemies: [copperBeetle], deck: deckOf(panzerbrecher, 10) });
    const vuln = structuredClone(state);
    vuln.enemies[0]!.statuses.vulnerable = 1;
    const next = play(vuln, rng, 'panzerbrecher');
    expect(next.enemies[0]!.hp).toBe(copperBeetle.hp - 9); // 6 × 1.5
    expect(next.enemies[0]!.block).toBe(copperBeetle.startBlock);
  });

  it('still triggers retaliation on the attacker', () => {
    const { state, rng } = newCombat({ deck: deckOf(panzerbrecher, 10) });
    const spiky = structuredClone(state);
    spiky.enemies[0]!.statuses.retaliate = 3;
    const next = play(spiky, rng, 'panzerbrecher');
    expect(next.player.hp).toBe(50 - 3);
  });
});

describe('multi-hit damage (times)', () => {
  it('applies each hit against block separately (Doppelhieb 2×5)', () => {
    const { state, rng } = newCombat({ enemies: [copperBeetle], deck: deckOf(doppelhieb, 10) });
    const next = play(state, rng, 'doppelhieb');
    // hit 1: 5 into 4 block → 1 hp; hit 2: 5 hp.
    expect(next.enemies[0]!.block).toBe(0);
    expect(next.enemies[0]!.hp).toBe(copperBeetle.hp - 6);
  });

  it('counts strength once per hit (StS convention)', () => {
    const gull: EnemyDef = {
      id: 'shadow_gull_lite',
      name: 'Schattenmöwe (Test)',
      tier: 1,
      hp: 12,
      pattern: {
        kind: 'cycle',
        steps: [
          {
            intent: 'attack',
            effects: [{ kind: 'damage', amount: 2, target: 'player', times: 2 }],
          },
        ],
      },
    };
    const { state, rng } = newCombat({ enemies: [gull], deck: deckOf(woodenShield, 10) });
    const buffed = structuredClone(state);
    buffed.enemies[0]!.statuses.strength = 2; // Schnauben-style +2 Stärke
    const next = combatReducer(buffed, { type: 'END_TURN' }, rng);
    expect(next.player.hp).toBe(50 - 2 * (2 + 2)); // Sturzflug 2×(2+2)
  });

  it('stops hitting once the target is dead', () => {
    const bigHit: CardDef = {
      ...doppelhieb,
      id: 'triplehieb',
      effects: [{ kind: 'damage', amount: 10, target: 'target', times: 3 }],
    };
    const { state, rng } = newCombat({ deck: deckOf(bigHit, 10) }); // rat: 12 hp
    const next = play(state, rng, 'triplehieb');
    expect(next.enemies[0]!.hp).toBe(12 - 20); // 2 hits, third fizzles
    expect(next.phase).toBe('victory');
  });
});

describe('addCard (Wildwuchs etc.)', () => {
  it('enemy intent shuffles an Erschöpfung into the player discard pile', () => {
    const { state, rng } = newCombat({ enemies: [wildwuchsTerror], deck: deckOf(woodenShield, 10) });
    const next = combatReducer(state, { type: 'END_TURN' }, rng);
    expect(next.discardPile.filter((c) => c.def.id === 'exhaustion')).toHaveLength(1);
  });

  it('adds cards to hand and draw pile with unique instance ids', () => {
    const summon: CardDef = {
      id: 'summon',
      name: 'Beschwörung',
      type: 'skill',
      cost: 0,
      effects: [
        { kind: 'addCard', card: exhaustion, zone: 'hand', amount: 2 },
        { kind: 'addCard', card: exhaustion, zone: 'draw' },
      ],
    };
    const { state, rng } = newCombat({ deck: [...deckOf(summon, 5), ...deckOf(axeStrike, 5)] });
    const next = play(state, rng, 'summon');
    expect(next.hand.filter((c) => c.def.id === 'exhaustion')).toHaveLength(2);
    expect(next.drawPile.filter((c) => c.def.id === 'exhaustion')).toHaveLength(1);
    const ids = [...next.hand, ...next.drawPile, ...next.discardPile].map((c) => c.instanceId);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('cost modifier (Kristallschild „nächste Karte −1⚡")', () => {
  it('discounts exactly the next card and is then consumed', () => {
    const { state, rng } = newCombat({
      deck: [...deckOf(kristallschild, 5), ...deckOf(axeStrike, 5)],
    });
    let s = play(state, rng, 'kristallschild'); // pays 1
    expect(s.nextCardCostDelta).toBe(-1);
    s = play(s, rng, 'axe_strike'); // 1 − 1 → free
    expect(s.player.energy).toBe(combatConfig.energyPerTurn - kristallschild.cost);
    expect(s.nextCardCostDelta).toBe(0);
    s = play(s, rng, 'axe_strike'); // full price again
    expect(s.player.energy).toBe(combatConfig.energyPerTurn - kristallschild.cost - axeStrike.cost);
  });

  it('stacks and never pushes a cost below zero', () => {
    const { state, rng } = newCombat({
      deck: [...deckOf(kristallschild, 3), ...deckOf(axeStrike, 3)],
    });
    let s = play(state, rng, 'kristallschild');
    s = play(s, rng, 'kristallschild'); // second one pays 1 − 1 = 0
    expect(s.nextCardCostDelta).toBe(-1);
    const energyBefore = s.player.energy;
    s = play(s, rng, 'axe_strike'); // max(0, 1 − 1) = 0
    expect(s.player.energy).toBe(energyBefore);
  });
});

describe('toolTier scaling (docs/05 Axtschlag)', () => {
  it('uses the base amount at the base tool tier', () => {
    const { state, rng } = newCombat({ deck: deckOf(scalingAxt, 10) });
    const next = play(state, rng, 'scaling_axt');
    expect(next.enemies[0]!.hp).toBe(shadowRat.hp - 6);
  });

  it('adds the per-tier bonus above the base tier (6 → 8 at tier 2)', () => {
    const { state, rng } = newCombat({ deck: deckOf(scalingAxt, 10), toolTier: 2 });
    const next = play(state, rng, 'scaling_axt');
    expect(next.enemies[0]!.hp).toBe(shadowRat.hp - 8);
  });
});

describe('status durations', () => {
  it('weak and vulnerable decay by 1 at the end of the player turn', () => {
    const { state, rng } = newCombat({ deck: deckOf(woodenShield, 10) });
    const cursed = structuredClone(state);
    cursed.player.statuses.weak = 2;
    cursed.player.statuses.vulnerable = 1;
    const next = combatReducer(cursed, { type: 'END_TURN' }, rng);
    expect(next.player.statuses.weak).toBe(1);
    expect(next.player.statuses.vulnerable).toBeUndefined();
  });

  it('enemy weak lasts through its action, then decays', () => {
    const weakCurse: CardDef = {
      id: 'kreischen',
      name: 'Kreischen',
      type: 'skill',
      cost: 0,
      effects: [{ kind: 'applyStatus', status: 'weak', amount: 1, target: 'target' }],
    };
    const { state, rng } = newCombat({
      deck: [...deckOf(weakCurse, 5), ...deckOf(woodenShield, 5)],
    });
    let s = play(state, rng, 'kreischen');
    s = combatReducer(s, { type: 'END_TURN' }, rng);
    // rat bite 5 × 0.75 → 3 while weak; weak gone afterwards.
    expect(s.player.hp).toBe(50 - 3);
    expect(s.enemies[0]!.statuses.weak).toBeUndefined();
  });

  it('strength and retaliate persist across turns (docs/03)', () => {
    const { state, rng } = newCombat({ deck: deckOf(woodenShield, 10) });
    const buffed = structuredClone(state);
    buffed.player.statuses.strength = 2;
    buffed.enemies[0]!.statuses.retaliate = 3;
    const next = combatReducer(buffed, { type: 'END_TURN' }, rng);
    expect(next.player.statuses.strength).toBe(2);
    expect(next.enemies[0]!.statuses.retaliate).toBe(3);
  });
});

describe('retaliate stays applyStatus (Gegenhalten)', () => {
  it('a player card applies Vergeltung via applyStatus — no own effect kind', () => {
    const gegenhalten: CardDef = {
      id: 'gegenhalten',
      name: 'Gegenhalten',
      type: 'skill',
      cost: 1,
      effects: [
        { kind: 'block', amount: 4, target: 'self' },
        { kind: 'applyStatus', status: 'retaliate', amount: 3, target: 'self' },
      ],
    };
    const { state, rng } = newCombat({ deck: deckOf(gegenhalten, 10) });
    let s = play(state, rng, 'gegenhalten');
    expect(s.player.statuses.retaliate).toBe(3);
    s = combatReducer(s, { type: 'END_TURN' }, rng);
    // rat attacked into 4 block (bite 5, 1 gets through) and took 3 retaliation.
    expect(s.enemies[0]!.hp).toBe(shadowRat.hp - 3);
    expect(s.player.hp).toBe(49);
  });
});
