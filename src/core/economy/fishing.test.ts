/**
 * Fishing V1 (docs/09): 1 Fisch pro Schlafphase am Steg, Steg-Gate, und
 * die Riesenwels-Regel — der 5. Fang WÄHREND aktiver Bruna-Quest 2.
 */
import { describe, expect, it } from 'vitest';
import { fishingConfig } from '../../data/fishing';
import { canFish, fishAtPier } from './fishing';

describe('canFish (docs/09: Steg gebaut, 1 Fang pro Schlafphase)', () => {
  it('requires the built Steg', () => {
    expect(canFish(0, false)).toBe(false);
    expect(canFish(1, false)).toBe(true);
  });

  it('blocks a second catch in the same sleep phase', () => {
    expect(canFish(1, true)).toBe(false);
  });
});

describe('fishAtPier', () => {
  it('yields 1 fish per catch (docs/09 V1, data/fishing)', () => {
    const result = fishAtPier({}, 1, false, 0, false, fishingConfig);
    expect(result?.inventory).toEqual({ fish: fishingConfig.fishPerCatch });
    expect(fishingConfig.fishPerCatch).toBe(1);
  });

  it('returns null without the Steg or when already fished', () => {
    expect(fishAtPier({}, 0, false, 0, false, fishingConfig)).toBeNull();
    expect(fishAtPier({}, 1, true, 0, false, fishingConfig)).toBeNull();
  });

  it('counts catches ONLY while the catfish quest is active (docs/09)', () => {
    const inactive = fishAtPier({}, 1, false, 2, false, fishingConfig)!;
    expect(inactive.catfishCatches).toBe(2);
    expect(inactive.caughtGiantCatfish).toBe(false);
    const active = fishAtPier({}, 1, false, 2, true, fishingConfig)!;
    expect(active.catfishCatches).toBe(3);
  });

  it('flags the giant catfish exactly on the 5th quest-active catch', () => {
    expect(fishingConfig.giantCatfishCatchNumber).toBe(5);
    let catches = 0;
    for (let i = 1; i <= 6; i++) {
      const result = fishAtPier({}, 1, false, catches, true, fishingConfig)!;
      catches = result.catfishCatches;
      expect(result.caughtGiantCatfish, `catch ${i}`).toBe(
        i === fishingConfig.giantCatfishCatchNumber,
      );
    }
  });

  it('references the bruna_2 quest and its flag (data/npcs contract)', () => {
    expect(fishingConfig.catfishQuestId).toBe('bruna_2');
    expect(fishingConfig.catfishFlag).toBe('giant_catfish_caught');
  });
});
