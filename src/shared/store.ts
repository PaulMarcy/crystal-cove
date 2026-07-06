import { createStore } from 'zustand/vanilla';
import { useStore } from 'zustand';

/**
 * Shared game store — the single bridge between Phaser (world) and React (ui).
 * Vanilla store so Phaser code can read/write without React.
 */
export interface GameState {
  worldReady: boolean;
  setWorldReady: (ready: boolean) => void;
}

export const gameStore = createStore<GameState>()((set) => ({
  worldReady: false,
  setWorldReady: (ready) => set({ worldReady: ready }),
}));

export function useGameStore<T>(selector: (state: GameState) => T): T {
  return useStore(gameStore, selector);
}
