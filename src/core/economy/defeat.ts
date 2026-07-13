/**
 * Defeat loot penalty (M4 Task 5, docs/03 Cozy-Anpassung 1): on defeat the
 * player loses a fraction (data/defeat: 50 %) of the RUN LOOT — every
 * inventory gain since the last rest (sleep or wake-up), floored per item.
 *
 * "Run loot" is tracked by the store as a gains-only multiset
 * (lootSinceRest). Items already spent (crafted, cooked) are simply gone —
 * the removal is capped at what the inventory still holds, never negative.
 * Pure and engine-free (CLAUDE.md rule 1).
 */
import type { Inventory } from './inventory';

export interface LootPenaltyResult {
  inventory: Inventory;
  /** What was actually taken (only items with a loss > 0). */
  lost: Inventory;
}

/**
 * Removes floor(gained × fraction) of each since-rest item from the
 * inventory, capped at the amount actually held. Idempotence is the
 * caller's job: reset the tracked loot after applying the penalty.
 */
export function applyLootPenalty(
  inventory: Inventory,
  lootSinceRest: Inventory,
  fraction: number,
): LootPenaltyResult {
  const next: Record<string, number> = { ...inventory };
  const lost: Record<string, number> = {};
  for (const [item, gained] of Object.entries(lootSinceRest)) {
    if (!Number.isInteger(gained) || gained <= 0) continue;
    const toLose = Math.min(Math.floor(gained * fraction), next[item] ?? 0);
    if (toLose <= 0) continue;
    lost[item] = toLose;
    if (next[item] === toLose) delete next[item];
    else next[item] = (next[item] ?? 0) - toLose;
  }
  return { inventory: next, lost };
}
