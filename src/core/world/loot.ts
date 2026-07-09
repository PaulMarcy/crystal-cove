/**
 * Victory loot roll (docs/07 Beutetabellen) — pure, engine-free, RNG injected
 * (same contract as the combat core).
 *
 * Rules:
 * - Guaranteed entries always drop, amount uniform in [min, max].
 * - Chance entries drop with probability p.
 * - Density 3: amounts ×2 and chance +20 percentage points (docs/07;
 *   constants in src/data/encounters).
 *
 * RNG consumption order (deterministic per seed): per enemy in list order,
 * per entry in definition order — amount roll for guaranteed, chance roll
 * then amount roll for chance entries.
 */
import type { Rng } from '../combat/rng';
import type { EnemyDef, LootEntry } from '../combat/types';
import { density3ChanceBonus, density3LootMultiplier } from '../../data/encounters/tier1';
import type { ShadowDensity } from './encounters';

export type LootResult = Readonly<Record<string, number>>;

function rollAmount(entry: LootEntry, rng: Rng): number {
  return entry.min + Math.floor(rng() * (entry.max - entry.min + 1));
}

/** Rolls the combined loot of all defeated enemies into an item → count map. */
export function rollLoot(
  enemies: readonly EnemyDef[],
  density: ShadowDensity,
  rng: Rng,
): LootResult {
  const amountMultiplier = density === 3 ? density3LootMultiplier : 1;
  const chanceBonus = density === 3 ? density3ChanceBonus : 0;
  const loot: Record<string, number> = {};
  const add = (item: string, amount: number): void => {
    if (amount > 0) loot[item] = (loot[item] ?? 0) + amount;
  };

  for (const enemy of enemies) {
    if (!enemy.loot) continue;
    for (const entry of enemy.loot.guaranteed) {
      add(entry.item, rollAmount(entry, rng) * amountMultiplier);
    }
    for (const entry of enemy.loot.chance) {
      const hit = rng() < Math.min(1, (entry.p ?? 0) + chanceBonus);
      const amount = rollAmount(entry, rng); // always consumed → stable RNG stream
      if (hit) add(entry.item, amount * amountMultiplier);
    }
  }
  return loot;
}
