/**
 * Store wiring for M5 Task 4 (docs/09, docs/10): coins, Markt-Verkauf/-Kauf,
 * Schwarzes Brett (Rotation pro Schlafphase, einmal pro Phase, kein XP)
 * und Angeln am Steg (1 Fang pro Schlafphase, Riesenwels-Regel) inkl.
 * Save-Roundtrip. Pure rules live in core/economy with their own tests.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { boardRequests } from '../data/board';
import { fishingConfig } from '../data/fishing';
import { deserialize, serialize } from '../core/save/save';
import { snapshotFromState } from './persistence';
import { activeBoardRequestOf, gameStore } from './store';

function resetStore(): void {
  gameStore.setState({
    combat: null,
    currentDungeonRun: null,
    inventory: {},
    coins: 0,
    sleepCount: 0,
    boardRequestFulfilled: false,
    fishedSinceSleep: false,
    catfishCatches: 0,
    lastFishCatch: null,
    marketOpen: false,
    activeDialog: null,
    storyFlags: [],
    activeQuests: [],
    completedQuests: [],
    lootSinceRest: {},
    xp: 0,
    playerHp: 50,
    builtBuildings: { b1: 1, b2: 1, b3: 1, b4: 0, b5: 0, b6: 0, b7: 0, b8: 0, b9: 0 },
  });
}

beforeEach(resetStore);

function withBuildings(slots: Partial<Record<string, number>>): void {
  gameStore.setState({
    builtBuildings: { ...gameStore.getState().builtBuildings, ...slots },
  });
}

describe('coins + market (docs/10)', () => {
  it('starts at 0 coins and sells surplus at the data price', () => {
    expect(gameStore.getState().coins).toBe(0);
    gameStore.setState({ inventory: { wood: 5, heart_thorn: 1 } });
    expect(gameStore.getState().sellResource('wood', 3)).toBe(true);
    expect(gameStore.getState().coins).toBe(3);
    expect(gameStore.getState().inventory).toEqual({ wood: 2, heart_thorn: 1 });
  });

  it('refuses unsellable quest/special material (docs/10)', () => {
    gameStore.setState({ inventory: { heart_thorn: 1, old_tools: 1 } });
    expect(gameStore.getState().sellResource('heart_thorn', 1)).toBe(false);
    expect(gameStore.getState().sellResource('old_tools', 1)).toBe(false);
    expect(gameStore.getState().coins).toBe(0);
  });

  it('selling never shrinks the defeat-penalty basis (lootSinceRest)', () => {
    gameStore.setState({ inventory: { wood: 4 }, lootSinceRest: { wood: 4 } });
    gameStore.getState().sellResource('wood', 4);
    expect(gameStore.getState().lootSinceRest).toEqual({ wood: 4 });
  });

  it('buys a Piya offer and refuses when coins are short', () => {
    gameStore.setState({ coins: 11 });
    expect(gameStore.getState().buyMarketOffer('offer_resin')).toBe(true);
    expect(gameStore.getState().coins).toBe(1);
    expect(gameStore.getState().inventory).toEqual({ resin: 1 });
    expect(gameStore.getState().buyMarketOffer('offer_resin')).toBe(false);
    expect(gameStore.getState().buyMarketOffer('nonsense')).toBe(false);
  });
});

describe('Markt-Panel wiring (M5 Task 4b)', () => {
  it('opens via Piyas openTrade-Dialog-Choice („Zeig mir deine Waren")', () => {
    expect(gameStore.getState().startDialog('piya_default')).toBe(true);
    // piya_default has 1 line; the choice gate sits after it (docs/13).
    gameStore.getState().chooseDialogOption(0);
    expect(gameStore.getState().activeDialog).toBeNull();
    expect(gameStore.getState().marketOpen).toBe(true);
    gameStore.getState().closeMarket();
    expect(gameStore.getState().marketOpen).toBe(false);
  });

  it('„Später" only closes the dialog — no market', () => {
    expect(gameStore.getState().startDialog('piya_default')).toBe(true);
    gameStore.getState().chooseDialogOption(1);
    expect(gameStore.getState().activeDialog).toBeNull();
    expect(gameStore.getState().marketOpen).toBe(false);
  });

  it('one overlay at a time: no dialog over an open market', () => {
    gameStore.getState().openMarket();
    expect(gameStore.getState().marketOpen).toBe(true);
    expect(gameStore.getState().startDialog('piya_default')).toBe(false);
  });

  it('does not open mid-combat (same rule as stations)', () => {
    gameStore.setState({ combat: {} as never });
    gameStore.getState().openMarket();
    expect(gameStore.getState().marketOpen).toBe(false);
  });
});

describe('Schwarzes Brett (docs/10)', () => {
  function stockForActiveRequest(): number {
    const request = activeBoardRequestOf(gameStore.getState())!;
    const inventory = Object.fromEntries(request.items.map((i) => [i.resource, i.amount]));
    gameStore.setState({ inventory });
    return request.coinReward;
  }

  it('requires the built Markt (B8)', () => {
    const reward = stockForActiveRequest();
    expect(gameStore.getState().fulfillActiveBoardRequest()).toBe(false);
    withBuildings({ b8: 1 });
    expect(gameStore.getState().fulfillActiveBoardRequest()).toBe(true);
    expect(gameStore.getState().coins).toBe(reward);
    expect(gameStore.getState().inventory).toEqual({});
  });

  it('grants NO XP (Kein-Grind-Regel docs/02)', () => {
    withBuildings({ b8: 1 });
    stockForActiveRequest();
    const xpBefore = gameStore.getState().xp;
    expect(gameStore.getState().fulfillActiveBoardRequest()).toBe(true);
    expect(gameStore.getState().xp).toBe(xpBefore);
  });

  it('fulfils at most once per sleep phase; sleep re-arms the Brett', () => {
    withBuildings({ b8: 1 });
    stockForActiveRequest();
    expect(gameStore.getState().fulfillActiveBoardRequest()).toBe(true);
    stockForActiveRequest();
    expect(gameStore.getState().fulfillActiveBoardRequest()).toBe(false);
    gameStore.getState().sleep();
    expect(gameStore.getState().boardRequestFulfilled).toBe(false);
    const reward = stockForActiveRequest();
    const coinsBefore = gameStore.getState().coins;
    expect(gameStore.getState().fulfillActiveBoardRequest()).toBe(true);
    expect(gameStore.getState().coins).toBe(coinsBefore + reward);
  });

  it('derives the active request deterministically from sleepCount', () => {
    const first = activeBoardRequestOf({ sleepCount: 3 });
    expect(first).toBe(activeBoardRequestOf({ sleepCount: 3 }));
    expect(boardRequests).toContain(first);
  });

  it('refuses when the requested items are missing', () => {
    withBuildings({ b8: 1 });
    expect(gameStore.getState().fulfillActiveBoardRequest()).toBe(false);
  });
});

describe('Angeln am Steg (docs/09 V1)', () => {
  it('needs the built Steg (B5) and yields 1 fish per sleep phase', () => {
    expect(gameStore.getState().fishAtPier()).toBe(false);
    withBuildings({ b5: 1 });
    expect(gameStore.getState().fishAtPier()).toBe(true);
    expect(gameStore.getState().inventory).toEqual({ fish: 1 });
    expect(gameStore.getState().lastFishCatch).toEqual({ amount: 1, giantCatfish: false });
    // Second cast in the same phase: nothing biting.
    expect(gameStore.getState().fishAtPier()).toBe(false);
    gameStore.getState().sleep();
    expect(gameStore.getState().fishAtPier()).toBe(true);
    expect(gameStore.getState().inventory).toEqual({ fish: 2 });
  });

  it('tracks fish as run loot (defeat-penalty basis, docs/03)', () => {
    withBuildings({ b5: 1 });
    gameStore.getState().fishAtPier();
    expect(gameStore.getState().lootSinceRest).toEqual({ fish: 1 });
  });

  it('the 5th catch DURING bruna_2 sets giant_catfish_caught (docs/09)', () => {
    withBuildings({ b5: 1 });
    // Two catches before the quest — they must NOT count.
    for (let i = 0; i < 2; i++) {
      expect(gameStore.getState().fishAtPier()).toBe(true);
      gameStore.getState().sleep();
    }
    expect(gameStore.getState().catfishCatches).toBe(0);
    gameStore.setState({ activeQuests: ['bruna_2'] });
    for (let i = 1; i <= 5; i++) {
      expect(gameStore.getState().fishAtPier()).toBe(true);
      expect(gameStore.getState().catfishCatches).toBe(i);
      expect(gameStore.getState().storyFlags.includes(fishingConfig.catfishFlag)).toBe(i >= 5);
      expect(gameStore.getState().lastFishCatch?.giantCatfish).toBe(i === 5);
      gameStore.getState().sleep();
    }
  });
});

describe('save roundtrip (additive-optional V2 fields)', () => {
  it('persists coins, Brett- and Angel-Zustand', () => {
    withBuildings({ b5: 1, b8: 1 });
    gameStore.setState({ coins: 42, catfishCatches: 3, activeQuests: ['bruna_2'] });
    gameStore.getState().fishAtPier();
    const snapshot = snapshotFromState(gameStore.getState());
    const result = deserialize(serialize(snapshot));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.coins).toBe(42);
    expect(result.data.fishedSinceSleep).toBe(true);
    expect(result.data.catfishCatches).toBe(4);
    expect(result.data.boardRequestFulfilled).toBe(false);
  });

  it('hydrates older saves without the fields to safe defaults', () => {
    const older = { ...snapshotFromState(gameStore.getState()) };
    delete older.coins;
    delete older.boardRequestFulfilled;
    delete older.fishedSinceSleep;
    delete older.catfishCatches;
    gameStore.setState({ coins: 99, fishedSinceSleep: true, catfishCatches: 9 });
    gameStore.getState().hydrateFromSave(older, false);
    expect(gameStore.getState().coins).toBe(0);
    expect(gameStore.getState().boardRequestFulfilled).toBe(false);
    expect(gameStore.getState().fishedSinceSleep).toBe(false);
    expect(gameStore.getState().catfishCatches).toBe(0);
  });
});
