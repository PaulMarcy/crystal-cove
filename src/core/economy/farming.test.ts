import { describe, expect, it } from 'vitest';
import { crops, harvestToolBonus } from '../../data/farming';
import {
  advanceSleep,
  emptyFarmPlots,
  harvestPlot,
  isRipe,
  plantCrop,
  toolYieldBonus,
  type FarmPlots,
} from './farming';
import { emptyInventory } from './inventory';

const sleepTimes = (plots: FarmPlots, n: number): FarmPlots => {
  let next = plots;
  for (let i = 0; i < n; i++) next = advanceSleep(next);
  return next;
};

describe('farming (docs/10 Farming & Zeit)', () => {
  it('plants a crop on an empty plot', () => {
    const plots = plantCrop(emptyFarmPlots, 'p1', 'berry');
    expect(plots).toEqual({ p1: { crop: 'berry', sleeps: 0 } });
  });

  it('refuses to plant on an occupied plot', () => {
    const plots = plantCrop(emptyFarmPlots, 'p1', 'berry')!;
    expect(plantCrop(plots, 'p1', 'chili')).toBeNull();
  });

  it.each([
    ['berry', 1],
    ['pumpkin', 2],
    ['chili', 3],
  ] as const)('%s ripens after exactly %i sleep cycles', (crop, n) => {
    let plots = plantCrop(emptyFarmPlots, 'p1', crop)!;
    plots = sleepTimes(plots, n - 1);
    expect(isRipe(plots.p1!, crops)).toBe(false);
    plots = advanceSleep(plots);
    expect(isRipe(plots.p1!, crops)).toBe(true);
  });

  it('nothing withers: extra sleeps keep the crop ripe (cozy rule)', () => {
    let plots = plantCrop(emptyFarmPlots, 'p1', 'berry')!;
    plots = sleepTimes(plots, 10);
    expect(isRipe(plots.p1!, crops)).toBe(true);
  });

  it('does not harvest an unripe or empty plot', () => {
    const plots = plantCrop(emptyFarmPlots, 'p1', 'pumpkin')!;
    expect(harvestPlot(emptyInventory, plots, 'p1', crops, 1, harvestToolBonus)).toBeNull();
    expect(harvestPlot(emptyInventory, plots, 'nope', crops, 1, harvestToolBonus)).toBeNull();
  });

  it('harvest adds the yield to the inventory and empties the plot', () => {
    let plots = plantCrop(emptyFarmPlots, 'p1', 'berry')!;
    plots = advanceSleep(plots);
    const outcome = harvestPlot(emptyInventory, plots, 'p1', crops, 1, harvestToolBonus);
    expect(outcome).not.toBeNull();
    expect(outcome!.inventory).toEqual({ berry: crops.berry.yield });
    expect(outcome!.plots).toEqual({});
  });

  it('tool tier 2 grants +1 yield (docs/10 Werkzeugstufen)', () => {
    let plots = plantCrop(emptyFarmPlots, 'p1', 'chili')!;
    plots = sleepTimes(plots, 3);
    const outcome = harvestPlot(emptyInventory, plots, 'p1', crops, 2, harvestToolBonus);
    expect(outcome!.inventory).toEqual({ chili: crops.chili.yield + 1 });
  });

  it('toolYieldBonus: 0 below minTier, bonus at and above', () => {
    expect(toolYieldBonus(1, harvestToolBonus)).toBe(0);
    expect(toolYieldBonus(2, harvestToolBonus)).toBe(1);
    expect(toolYieldBonus(3, harvestToolBonus)).toBe(1);
  });

  it('advanceSleep only touches planted plots and keeps others independent', () => {
    let plots = plantCrop(emptyFarmPlots, 'p1', 'berry')!;
    plots = advanceSleep(plots);
    plots = plantCrop(plots, 'p2', 'pumpkin')!;
    plots = advanceSleep(plots);
    expect(plots.p1!.sleeps).toBe(2);
    expect(plots.p2!.sleeps).toBe(1);
  });
});
