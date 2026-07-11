/**
 * Farming data (M3) — pure data, logic in core/economy/farming.ts.
 *
 * docs/10 "Farming & Zeit": no real-time cycle; growth advances per sleep
 * phase (tent/bed). Growth durations are fixed by docs/10:
 * Beeren 1 · Kürbis 2 · Chili 3 sleep cycles. Nothing withers (cozy rule).
 *
 * BALANCE ASSUMPTIONS (docs define no seed source or yields):
 *  - Planting is FREE (no seed item). Farming is the only tier-1 source of
 *    Kürbis/Chili (docs/10 catalog), so a seed cost in the crop itself would
 *    deadlock. A seed item can be layered on later without logic changes.
 *  - Yields: one harvest ≈ one recipe batch (same rationale as harvest
 *    nodes in data/resources.ts): Beeren 3 (ein Beerensnack), Kürbis 2,
 *    Chili 2. Longer growth ⇒ 2 units of the rarer ingredient.
 */

export const FARM_CROP_IDS = ['berry', 'pumpkin', 'chili'] as const;
export type CropId = (typeof FARM_CROP_IDS)[number];

export function isCropId(value: unknown): value is CropId {
  return typeof value === 'string' && (FARM_CROP_IDS as readonly string[]).includes(value);
}

export interface CropDef {
  /** Sleep cycles from planting to ripe (docs/10 Farming & Zeit). */
  growthSleeps: number;
  /** Units harvested at base tool tier (assumption, see header). */
  yield: number;
}

export const crops: Readonly<Record<CropId, CropDef>> = {
  berry: { growthSleeps: 1, yield: 3 },
  pumpkin: { growthSleeps: 2, yield: 2 },
  chili: { growthSleeps: 3, yield: 2 },
};

/**
 * Tool-tier harvest bonus (docs/10 Werkzeugstufen: Stufe 2 "Ernten +1
 * Ertrag") — applies to harvest nodes AND farm plots.
 */
export const harvestToolBonus = { minTier: 2, amount: 1 } as const;

export interface FarmPlotPlacement {
  id: string;
  /** Tile coordinates on the Heimatbucht map (16 px tiles). */
  tileX: number;
  tileY: number;
}

/**
 * Fixed plots at the beach camp, next to the stations (docs/02 Basislager;
 * exact tiles are an assumption, tune here).
 */
export const heimatbuchtFarmPlots: readonly FarmPlotPlacement[] = [
  { id: 'hb-plot-1', tileX: 16, tileY: 19 },
  { id: 'hb-plot-2', tileX: 18, tileY: 19 },
  { id: 'hb-plot-3', tileX: 20, tileY: 19 },
  { id: 'hb-plot-4', tileX: 22, tileY: 19 },
];

/** Tent at the camp — sleeping advances growth (docs/10 Farming & Zeit). */
export const heimatbuchtTent = { tileX: 25, tileY: 17 } as const;

/** Max distance (px) at which plots/tent can be interacted with. */
export const farmInteractRange = 26;
