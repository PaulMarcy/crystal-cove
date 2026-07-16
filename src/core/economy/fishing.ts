/**
 * Fishing rules (M5, docs/09 V1) — pure, engine-free (CLAUDE.md rule 1).
 * Minigame-free: one pier interaction yields 1 fish per sleep phase
 * (reset pattern of the harvest nodes — the store clears the flag on
 * sleep). Balancing lives in data/fishing.
 *
 * Riesenwels (docs/09 Bruna 2): the Nth catch WHILE the quest is active is
 * the giant catfish. The counter counts ONLY catches during the active
 * quest — fishing before accepting it never advances the counter.
 */
import type { fishingConfig } from '../../data/fishing';
import { addItem, type Inventory } from './inventory';

export type FishingConfig = typeof fishingConfig;

export interface FishingOutcome {
  inventory: Inventory;
  /** Catfish-quest catches AFTER this catch (unchanged without the quest). */
  catfishCatches: number;
  /** True exactly on the catch that IS the Riesenwels (docs/09). */
  caughtGiantCatfish: boolean;
}

/** Is fishing possible right now? (Steg built, not yet fished this phase.) */
export function canFish(
  pierStage: number,
  fishedSinceSleep: boolean,
): boolean {
  return pierStage >= 1 && !fishedSinceSleep;
}

/**
 * One pier interaction: credits the fish and advances the catfish counter
 * while bruna_2 is active. Null when the Steg is missing or this sleep
 * phase's catch is already taken — callers must not mutate state then.
 */
export function fishAtPier(
  inventory: Inventory,
  pierStage: number,
  fishedSinceSleep: boolean,
  catfishCatches: number,
  catfishQuestActive: boolean,
  config: FishingConfig,
): FishingOutcome | null {
  if (!canFish(pierStage, fishedSinceSleep)) return null;
  const nextCatches = catfishQuestActive ? catfishCatches + 1 : catfishCatches;
  return {
    inventory: addItem(inventory, config.fishResource, config.fishPerCatch),
    catfishCatches: nextCatches,
    caughtGiantCatfish: catfishQuestActive && nextCatches === config.giantCatfishCatchNumber,
  };
}
