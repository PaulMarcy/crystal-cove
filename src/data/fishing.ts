/**
 * Fishing balancing (M5, docs/09 Bruna / docs/10 Angeln am Steg).
 * Pure data — the fishing rule lives in core/economy/fishing.
 *
 * V1 (docs/09): minispiel-frei — one pier interaction gives 1 fish per
 * sleep phase (reset like harvest nodes). Köder/Beutetabellen are post-V1.
 */
import type { BuildingSlotId } from './buildings';
import type { ResourceId } from './resources';

export const fishingConfig = {
  /** Resource a catch yields. */
  fishResource: 'fish' as ResourceId,
  /** Units per catch (docs/09: 1 Fisch pro Schlafphase). */
  fishPerCatch: 1,
  /** Building that enables fishing (docs/09 B5 Steg). */
  pierSlot: 'b5' as BuildingSlotId,
  /**
   * Riesenwels rule (docs/09): the Nth catch WHILE bruna_2 is active is the
   * giant catfish — catches outside the active quest never count.
   */
  giantCatfishCatchNumber: 5,
  catfishQuestId: 'bruna_2',
  /** Flag bruna_2's requirement checks (data/npcs). */
  catfishFlag: 'giant_catfish_caught',
} as const;
