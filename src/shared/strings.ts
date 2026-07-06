/**
 * Central string table (German first, see CLAUDE.md conventions).
 * All player-facing text must come from here — no literals in UI/world code.
 */
export const strings = {
  game: {
    title: 'Crystal Cove',
    helloIsland: 'Hallo Insel',
  },
  ui: {
    overlayReady: 'UI-Overlay aktiv',
  },
} as const;

export type Strings = typeof strings;
