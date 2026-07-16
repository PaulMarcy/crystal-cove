/**
 * Schwarzes Brett (docs/10): deterministic per-sleep rotation, item
 * hand-over + coin reward, no XP anywhere in the outcome.
 */
import { describe, expect, it } from 'vitest';
import { boardRequests } from '../../data/board';
import { activeBoardRequest, fulfillBoardRequest } from './board';

describe('board request pool (docs/10: 6 feste Bitten, 10–25 Münzen)', () => {
  it('ships the quantified V1 pool', () => {
    const byId = Object.fromEntries(
      boardRequests.map((r) => [r.id, { items: [...r.items], coins: r.coinReward }]),
    );
    expect(byId).toEqual({
      board_wood: { items: [{ resource: 'wood', amount: 5 }], coins: 10 },
      board_berry: { items: [{ resource: 'berry', amount: 3 }], coins: 10 },
      board_stone: { items: [{ resource: 'stone', amount: 3 }], coins: 10 },
      board_fish: { items: [{ resource: 'fish', amount: 2 }], coins: 15 },
      board_resin: { items: [{ resource: 'resin', amount: 2 }], coins: 20 },
      board_beetle_shell: { items: [{ resource: 'beetle_shell', amount: 1 }], coins: 25 },
    });
  });
});

describe('activeBoardRequest (deterministic rotation per sleep phase)', () => {
  it('is deterministic: same sleep count → same request', () => {
    for (const sleepCount of [0, 1, 7, 42]) {
      expect(activeBoardRequest(boardRequests, sleepCount)).toBe(
        activeBoardRequest(boardRequests, sleepCount),
      );
    }
  });

  it('rotates across sleep phases (not stuck on one request)', () => {
    const seen = new Set<string>();
    for (let sleepCount = 0; sleepCount < 30; sleepCount++) {
      seen.add(activeBoardRequest(boardRequests, sleepCount)!.id);
    }
    expect(seen.size).toBeGreaterThan(1);
  });

  it('honours an injected RNG (seedable, CLAUDE.md rule 3)', () => {
    expect(activeBoardRequest(boardRequests, 5, () => () => 0)).toBe(boardRequests[0]);
    expect(activeBoardRequest(boardRequests, 5, () => () => 0.999)).toBe(
      boardRequests[boardRequests.length - 1],
    );
  });

  it('returns null for an empty pool', () => {
    expect(activeBoardRequest([], 0)).toBeNull();
  });
});

describe('fulfillBoardRequest', () => {
  const request = boardRequests.find((r) => r.id === 'board_fish')!;

  it('hands the items over and credits the coin reward', () => {
    const result = fulfillBoardRequest({ fish: 3, wood: 1 }, 5, request);
    expect(result).toEqual({ inventory: { fish: 1, wood: 1 }, coins: 20 });
  });

  it('refuses when the inventory does not cover the items', () => {
    expect(fulfillBoardRequest({ fish: 1 }, 0, request)).toBeNull();
  });

  it('rewards ONLY coins — no XP field exists on the outcome (docs/09)', () => {
    const result = fulfillBoardRequest({ fish: 2 }, 0, request)!;
    expect(Object.keys(result).sort()).toEqual(['coins', 'inventory']);
  });

  it('never mutates the input inventory', () => {
    const inventory = { fish: 2 };
    fulfillBoardRequest(inventory, 0, request);
    expect(inventory).toEqual({ fish: 2 });
  });
});
