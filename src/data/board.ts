/**
 * Schwarzes Brett — fixed V1 request pool (M5, docs/10 Münz-Ökonomie).
 * Pure data — rotation/fulfilment rules live in core/economy/board.
 *
 * docs/10: 6 feste Bitten (10–25 Münzen), je Schlafphase rotiert 1 zufällige
 * Bitte aktiv, wiederholbar, OHNE XP (Kein-Grind-Regel docs/02).
 */
import type { ResourceId } from './resources';

export interface BoardRequestDef {
  id: string;
  /** Items handed over on fulfilment (deducted from the inventory). */
  items: readonly { resource: ResourceId; amount: number }[];
  /** Coin reward — the ONLY reward (docs/09 Quest-Typen: kein XP). */
  coinReward: number;
}

export const boardRequests: readonly BoardRequestDef[] = [
  { id: 'board_wood', items: [{ resource: 'wood', amount: 5 }], coinReward: 10 },
  { id: 'board_berry', items: [{ resource: 'berry', amount: 3 }], coinReward: 10 },
  { id: 'board_stone', items: [{ resource: 'stone', amount: 3 }], coinReward: 10 },
  { id: 'board_fish', items: [{ resource: 'fish', amount: 2 }], coinReward: 15 },
  { id: 'board_resin', items: [{ resource: 'resin', amount: 2 }], coinReward: 20 },
  { id: 'board_beetle_shell', items: [{ resource: 'beetle_shell', amount: 1 }], coinReward: 25 },
];
