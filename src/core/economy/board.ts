/**
 * Schwarzes Brett rules (M5, docs/10) — pure, engine-free (CLAUDE.md
 * rule 1). One request from the fixed pool (data/board) is active per
 * sleep phase; fulfilling it hands the items over and credits coins.
 * NO XP by design (docs/09 Quest-Typen, Kein-Grind-Regel docs/02).
 *
 * Rotation is DETERMINISTIC from the persisted sleep counter: the active
 * request is derived via an injected RNG seeded with sleepCount, so no
 * extra rotation state needs saving and a reload always shows the same
 * request (save-compatible by construction).
 */
import type { BoardRequestDef } from '../../data/board';
import { createRng, type Rng } from '../combat/rng';
import { removeItem, type Inventory } from './inventory';

/**
 * The request active during the given sleep phase. The RNG factory is
 * injectable for tests; the default seeds mulberry32 with the sleep count
 * (deterministic across sessions — docs/10 "je Schlafphase rotiert
 * 1 zufällige Bitte aktiv").
 */
export function activeBoardRequest(
  requests: readonly BoardRequestDef[],
  sleepCount: number,
  rngForSleep: (sleepCount: number) => Rng = createRng,
): BoardRequestDef | null {
  if (requests.length === 0) return null;
  const index = Math.floor(rngForSleep(sleepCount)() * requests.length);
  return requests[index]!;
}

export interface BoardOutcome {
  inventory: Inventory;
  coins: number;
}

/**
 * Fulfils a request: deducts the requested items, credits the coin reward.
 * Null when the inventory does not cover the items. Once-per-phase and
 * "is this the active request?" are the caller's responsibility (store) —
 * this function is pure item/coin math.
 */
export function fulfillBoardRequest(
  inventory: Inventory,
  coins: number,
  request: BoardRequestDef,
): BoardOutcome | null {
  let next: Inventory = inventory;
  for (const item of request.items) {
    const removed = removeItem(next, item.resource, item.amount);
    if (removed === null) return null;
    next = removed;
  }
  return { inventory: next, coins: coins + request.coinReward };
}
