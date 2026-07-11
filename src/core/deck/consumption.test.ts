import { describe, expect, it } from 'vitest';
import {
  applyDishConsumption,
  clearsStarterMarker,
  ownedCountsAfterConsumption,
} from './consumption';

const starter = ['strike', 'strike', 'berry_snack'];

describe('applyDishConsumption', () => {
  it('removes a crafted copy from collection and deck', () => {
    const result = applyDishConsumption(
      ['berry_snack'],
      ['berry_snack', 'stone_wall'],
      ['strike', 'berry_snack'],
      [],
      starter,
    );
    expect(result.collection).toEqual(['stone_wall']);
    expect(result.deck).toEqual(['strike']);
    expect(result.consumedStarterDishes).toEqual([]);
  });

  it('marks a starter copy as consumed when no crafted copy exists', () => {
    const result = applyDishConsumption(
      ['berry_snack'],
      [],
      ['strike', 'berry_snack'],
      [],
      starter,
    );
    expect(result.collection).toEqual([]);
    expect(result.deck).toEqual(['strike']);
    expect(result.consumedStarterDishes).toEqual(['berry_snack']);
  });

  it('prefers the crafted copy before touching the starter copy', () => {
    const result = applyDishConsumption(['berry_snack'], ['berry_snack'], [], [], starter);
    expect(result.collection).toEqual([]);
    expect(result.consumedStarterDishes).toEqual([]);
  });

  it('never marks more starter copies than the starter set holds', () => {
    const result = applyDishConsumption(['berry_snack', 'berry_snack'], [], [], [], starter);
    expect(result.consumedStarterDishes).toEqual(['berry_snack']);
  });

  it('leaves everything untouched when nothing was consumed', () => {
    const result = applyDishConsumption([], ['x'], ['x'], [], starter);
    expect(result.collection).toEqual(['x']);
    expect(result.deck).toEqual(['x']);
  });
});

describe('ownedCountsAfterConsumption', () => {
  it('subtracts consumed starter markers', () => {
    const owned = ownedCountsAfterConsumption(starter, [], ['berry_snack']);
    expect(owned['berry_snack']).toBeUndefined();
    expect(owned['strike']).toBe(2);
  });

  it('crafted copies stack on top of remaining starter copies', () => {
    const owned = ownedCountsAfterConsumption(starter, ['berry_snack'], ['berry_snack']);
    expect(owned['berry_snack']).toBe(1);
  });

  it('matches plain ownership when no markers exist', () => {
    const owned = ownedCountsAfterConsumption(starter, ['stone_wall'], []);
    expect(owned).toEqual({ strike: 2, berry_snack: 1, stone_wall: 1 });
  });
});

describe('clearsStarterMarker', () => {
  it('is true only while a marker for the card exists', () => {
    expect(clearsStarterMarker('berry_snack', ['berry_snack'])).toBe(true);
    expect(clearsStarterMarker('berry_snack', [])).toBe(false);
  });
});
