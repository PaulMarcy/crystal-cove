import { createStore } from 'zustand/vanilla';
import { useStore } from 'zustand';
import { combatReducer, createCombatState } from '../core/combat/reducer';
import { createRng, type Rng } from '../core/combat/rng';
import type { CombatEvent, CombatSetup, CombatState } from '../core/combat/types';

/**
 * Shared game store — the single bridge between Phaser (world) and React (ui).
 * Vanilla store so Phaser code can read/write without React.
 *
 * Combat: the store only forwards events to the pure reducer in core/combat.
 * The RNG lives here (seeded per combat) — components never touch it.
 */
export interface GameState {
  worldReady: boolean;
  setWorldReady: (ready: boolean) => void;

  combat: CombatState | null;
  /** Seed used for the current combat (deterministic replays, debugging). */
  combatSeed: number | null;
  startCombat: (setup: CombatSetup, seed?: number) => void;
  dispatchCombat: (event: CombatEvent) => void;
  endCombat: () => void;
}

/** RNG of the running combat — module-scoped, injected into every reducer call. */
let combatRng: Rng | null = null;

export const gameStore = createStore<GameState>()((set, get) => ({
  worldReady: false,
  setWorldReady: (ready) => set({ worldReady: ready }),

  combat: null,
  combatSeed: null,
  startCombat: (setup, seed) => {
    const usedSeed = seed ?? Math.floor(Math.random() * 0xffffffff);
    combatRng = createRng(usedSeed);
    set({ combat: createCombatState(setup, combatRng), combatSeed: usedSeed });
  },
  dispatchCombat: (event) => {
    const { combat } = get();
    if (!combat || !combatRng) return;
    set({ combat: combatReducer(combat, event, combatRng) });
  },
  endCombat: () => {
    combatRng = null;
    set({ combat: null, combatSeed: null });
  },
}));

export function useGameStore<T>(selector: (state: GameState) => T): T {
  return useStore(gameStore, selector);
}
