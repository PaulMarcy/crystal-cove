/**
 * Farming logic — pure, engine-free (CLAUDE.md rule 1).
 *
 * Model (docs/10 "Farming & Zeit"): growth is measured in sleep cycles, not
 * real time. A planted plot stores how many sleeps it has seen; a crop is
 * ripe once that count reaches the crop's growthSleeps. Nothing withers —
 * ripe crops wait indefinitely (cozy rule: absence is never punished).
 *
 * All balancing (durations, yields, tool bonus) lives in src/data/farming.ts.
 */

import type { CropDef, CropId } from '../../data/farming';
import { addItem, type Inventory } from './inventory';

export interface PlantedPlot {
  crop: CropId;
  /** Sleep cycles since planting. */
  sleeps: number;
}

/** Plot id → planted state. Empty plots are simply absent. */
export type FarmPlots = Readonly<Record<string, PlantedPlot>>;

export const emptyFarmPlots: FarmPlots = {};

/** Plants a crop on an empty plot. Null when the plot is already planted. */
export function plantCrop(plots: FarmPlots, plotId: string, crop: CropId): FarmPlots | null {
  if (plots[plotId]) return null;
  return { ...plots, [plotId]: { crop, sleeps: 0 } };
}

/** One sleep cycle: every planted plot advances by one (docs/10). */
export function advanceSleep(plots: FarmPlots): FarmPlots {
  return Object.fromEntries(
    Object.entries(plots).map(([id, plot]) => [id, { ...plot, sleeps: plot.sleeps + 1 }]),
  );
}

export function isRipe(plot: PlantedPlot, cropDefs: Readonly<Record<CropId, CropDef>>): boolean {
  return plot.sleeps >= cropDefs[plot.crop].growthSleeps;
}

/**
 * Extra units per harvest from the equipped tool (docs/10 Werkzeugstufen,
 * tier 2 "Ernten +1 Ertrag") — shared by harvest nodes and farm plots.
 */
export function toolYieldBonus(
  toolTier: number,
  bonus: { readonly minTier: number; readonly amount: number },
): number {
  return toolTier >= bonus.minTier ? bonus.amount : 0;
}

export interface FarmHarvestOutcome {
  inventory: Inventory;
  plots: FarmPlots;
}

/**
 * Harvests a ripe plot: crop yield (+ tool bonus) goes to the inventory,
 * the plot becomes empty again. Null when the plot is empty or not ripe.
 */
export function harvestPlot(
  inventory: Inventory,
  plots: FarmPlots,
  plotId: string,
  cropDefs: Readonly<Record<CropId, CropDef>>,
  toolTier: number,
  bonus: { readonly minTier: number; readonly amount: number },
): FarmHarvestOutcome | null {
  const plot = plots[plotId];
  if (!plot || !isRipe(plot, cropDefs)) return null;
  const amount = cropDefs[plot.crop].yield + toolYieldBonus(toolTier, bonus);
  const rest = { ...plots } as Record<string, PlantedPlot>;
  delete rest[plotId];
  return { inventory: addItem(inventory, plot.crop, amount), plots: rest };
}
