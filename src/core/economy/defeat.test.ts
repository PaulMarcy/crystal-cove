import { describe, expect, it } from 'vitest';
import { applyLootPenalty } from './defeat';
import type { Inventory } from './inventory';

const HALF = 0.5;

describe('applyLootPenalty (docs/03: 50 % der Run-Beute, pro Item abgerundet)', () => {
  it('removes floor(gained/2) per item', () => {
    const inventory: Inventory = { wood: 10, stone: 4 };
    const result = applyLootPenalty(inventory, { wood: 5, stone: 4 }, HALF);
    // floor(5/2)=2 wood, floor(4/2)=2 stone
    expect(result.inventory).toEqual({ wood: 8, stone: 2 });
    expect(result.lost).toEqual({ wood: 2, stone: 2 });
  });

  it('floors: a single gained item loses nothing', () => {
    const result = applyLootPenalty({ berry: 1 }, { berry: 1 }, HALF);
    expect(result.inventory).toEqual({ berry: 1 });
    expect(result.lost).toEqual({});
  });

  it('caps at what the inventory still holds (spent items are just gone)', () => {
    // Gained 8 wood since rest but crafted 7 away — only 1 left.
    const result = applyLootPenalty({ wood: 1 }, { wood: 8 }, HALF);
    expect(result.inventory).toEqual({});
    expect(result.lost).toEqual({ wood: 1 });
  });

  it('never touches items not gained since rest', () => {
    const result = applyLootPenalty({ wood: 10, resin: 3 }, { resin: 2 }, HALF);
    expect(result.inventory).toEqual({ wood: 10, resin: 2 });
    expect(result.lost).toEqual({ resin: 1 });
  });

  it('empty run loot loses nothing', () => {
    const inventory: Inventory = { wood: 3 };
    const result = applyLootPenalty(inventory, {}, HALF);
    expect(result.inventory).toEqual({ wood: 3 });
    expect(result.lost).toEqual({});
  });

  it('is idempotent once the tracked loot is reset', () => {
    const first = applyLootPenalty({ wood: 9 }, { wood: 9 }, HALF);
    expect(first.inventory).toEqual({ wood: 5 });
    // Store resets lootSinceRest to {} after applying — second pass is a no-op.
    const second = applyLootPenalty(first.inventory, {}, HALF);
    expect(second.inventory).toEqual({ wood: 5 });
    expect(second.lost).toEqual({});
  });

  it('drops emptied stacks from the inventory map', () => {
    const result = applyLootPenalty({ stone: 1 }, { stone: 2 }, HALF);
    expect('stone' in result.inventory).toBe(false);
  });

  it('ignores non-positive or malformed tracked entries', () => {
    const result = applyLootPenalty({ wood: 5 }, { wood: 0, stone: -3 } as Inventory, HALF);
    expect(result.inventory).toEqual({ wood: 5 });
    expect(result.lost).toEqual({});
  });
});
