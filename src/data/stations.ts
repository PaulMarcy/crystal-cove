/**
 * Workshop stations on the Heimatbucht map (M3). Pure data — the scene
 * renders the sprites, interaction opens the workshop UI (recipes in
 * src/data/recipes.ts, craft logic in core/economy/crafting.ts).
 *
 * Placement: at the beach camp near the map center/spawn (docs/02 —
 * Basislager an der Heimatbucht). Exact tiles are an assumption, tune here.
 */
import type { StationId } from './recipes';

export interface StationPlacement {
  station: StationId;
  /** Tile coordinates on the Heimatbucht map (16 px tiles). */
  tileX: number;
  tileY: number;
}

export const heimatbuchtStations: readonly StationPlacement[] = [
  { station: 'smithy', tileX: 18, tileY: 15 },
  { station: 'kitchen', tileX: 22, tileY: 15 },
];

/** Max distance (px) at which a station can be interacted with. */
export const stationInteractRange = 26;

/**
 * Built-out tier per station at game start (docs/10 St. column; upgrades to
 * tier 2 are an M5 build feature — until then tier-2 recipes show as locked).
 */
export const initialStationTiers: Readonly<Record<StationId, number>> = {
  smithy: 1,
  kitchen: 1,
};
