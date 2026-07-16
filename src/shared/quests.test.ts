/**
 * Store wiring for the M5 quest task (docs/09, docs/13): dialog-driven
 * accept/turn-in, reward application (recipes, talismane, flags, XP,
 * Freundschaft), quest-gated crafting, quest pickups and save roundtrip.
 * Pure rules live in core/quests with their own tests.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { deserialize, serialize } from '../core/save/save';
import { gameStore, npcArrivedOf, npcDialogIdOf, questIndicatorOf } from './store';
import { snapshotFromState } from './persistence';

function resetStore(): void {
  gameStore.setState({
    activeDialog: null,
    activeStation: null,
    activeBuildSlot: null,
    combat: null,
    currentDungeonRun: null,
    inventory: {},
    storyFlags: [],
    builtBuildings: { b1: 1, b2: 1, b3: 1, b4: 0, b5: 0, b6: 0, b7: 0, b8: 0, b9: 0 },
    rescuedNpcs: [],
    completedDungeons: [],
    friendshipLevels: {},
    activeQuests: [],
    completedQuests: [],
    unlockedRecipes: [],
    ownedTalismans: [],
    xp: 0,
    playerHp: 50,
    lastQuestEvent: null,
  });
}

beforeEach(resetStore);

/** Plays a dialog to its end (Weiter through every box). */
function playDialogThrough(dialogId: string): void {
  expect(gameStore.getState().startDialog(dialogId)).toBe(true);
  let guard = 0;
  while (gameStore.getState().activeDialog && guard++ < 10) {
    gameStore.getState().advanceDialog();
  }
}

/** Plays a dialog up to the choice gate, then picks the option. */
function playDialogAndChoose(dialogId: string, choiceIndex: number): void {
  expect(gameStore.getState().startDialog(dialogId)).toBe(true);
  // Advance until the choice gate blocks (advanceDialog is a no-op there).
  for (let i = 0; i < 10 && gameStore.getState().activeDialog; i++) {
    gameStore.getState().advanceDialog();
  }
  gameStore.getState().chooseDialogOption(choiceIndex);
}

describe('NPC arrival triggers (docs/09, derived)', () => {
  it('maro/lumen are present from the start; tilda arrives with Wohnhaus 1', () => {
    const state = gameStore.getState();
    expect(npcArrivedOf(state, 'lumen')).toBe(true);
    expect(npcArrivedOf(state, 'maro')).toBe(true);
    expect(npcArrivedOf(state, 'tilda')).toBe(false);
    gameStore.setState({ builtBuildings: { ...state.builtBuildings, b4: 1 } });
    expect(npcArrivedOf(gameStore.getState(), 'tilda')).toBe(true);
  });

  it('orin arrives once rescued (dungeon Raum 2, docs/09)', () => {
    expect(npcArrivedOf(gameStore.getState(), 'orin')).toBe(false);
    gameStore.setState({ rescuedNpcs: ['orin'] });
    expect(npcArrivedOf(gameStore.getState(), 'orin')).toBe(true);
  });
});

describe('quest flow through dialogs (docs/13 Quest-Integration)', () => {
  it('runs Maros Kette 1 end-to-end: arrival → accept → collect → turn-in', () => {
    // First talk: arrival dialog sets the met flag.
    expect(npcDialogIdOf(gameStore.getState(), 'maro')).toBe('maro_arrival');
    playDialogThrough('maro_arrival');
    expect(gameStore.getState().storyFlags).toContain('met_maro');
    expect(questIndicatorOf(gameStore.getState(), 'maro')).toBe('!');

    // Offer → Annehmen (choice 0) creates the questlog entry.
    expect(npcDialogIdOf(gameStore.getState(), 'maro')).toBe('maro_1_offer');
    playDialogAndChoose('maro_1_offer', 0);
    expect(gameStore.getState().activeQuests).toEqual(['maro_1']);
    expect(gameStore.getState().lastQuestEvent).toEqual({
      kind: 'accepted',
      questId: 'maro_1',
      xp: 0,
    });

    // Quest pickup at the Strandwrack (quest-spawned, docs/09).
    expect(gameStore.getState().collectQuestNode('quest-maro-toolbox')).toBe(true);
    expect(gameStore.getState().inventory.old_tools).toBe(1);
    expect(gameStore.getState().collectQuestNode('quest-maro-toolbox')).toBe(false); // despawned
    expect(questIndicatorOf(gameStore.getState(), 'maro')).toBe('?');

    // Turn-in dialog completes the quest and applies the rewards.
    expect(npcDialogIdOf(gameStore.getState(), 'maro')).toBe('maro_1_done');
    playDialogThrough('maro_1_done');
    const state = gameStore.getState();
    expect(state.activeQuests).toEqual([]);
    expect(state.completedQuests).toEqual(['maro_1']);
    expect(state.inventory.old_tools).toBeUndefined(); // Kiste abgegeben
    expect(state.unlockedRecipes).toContain('recipe_heavy_blow');
    expect(state.friendshipLevels.maro).toBe(1); // schaltet Schmiede St. 2 frei (B3)
    expect(state.xp).toBe(30); // docs/09: St. 1 = 30 XP
    expect(state.lastQuestEvent).toEqual({ kind: 'completed', questId: 'maro_1', xp: 30 });
  });

  it('„Später" declines without accepting', () => {
    playDialogThrough('maro_arrival');
    playDialogAndChoose('maro_1_offer', 1);
    expect(gameStore.getState().activeQuests).toEqual([]);
  });

  it('stage 3 grants talisman ownership (Dornenring-Drop-Muster)', () => {
    gameStore.setState({
      storyFlags: ['met_maro'],
      completedQuests: ['maro_1', 'maro_2'],
      activeQuests: ['maro_3'],
      inventory: { heart_thorn: 1 },
      friendshipLevels: { maro: 2 },
    });
    playDialogThrough('maro_3_done');
    const state = gameStore.getState();
    expect(state.ownedTalismans).toContain('anvil_heart');
    expect(state.friendshipLevels.maro).toBe(3);
    expect(state.xp).toBe(80); // docs/09: St. 3 = 80 XP
  });

  it('completes Piyas Kette 3 → piya_chain_complete (B9-Voraussetzung)', () => {
    gameStore.setState({
      storyFlags: ['met_piya'],
      completedQuests: ['piya_1', 'piya_2'],
      activeQuests: ['piya_3'],
    });
    playDialogThrough('piya_3_done');
    expect(gameStore.getState().storyFlags).toContain('piya_chain_complete');
  });

  it('turn-in dialog without fulfilled requirement leaves the quest open', () => {
    // Defensive: completeQuest re-validates even if the dialog is forced.
    gameStore.setState({ storyFlags: ['met_maro'], activeQuests: ['maro_1'] });
    playDialogThrough('maro_1_done');
    expect(gameStore.getState().activeQuests).toEqual(['maro_1']);
    expect(gameStore.getState().completedQuests).toEqual([]);
  });
});

describe('quest-gated crafting (docs/09: NPCs lehren Rezepte)', () => {
  it('refuses quest-gated recipes until taught, then crafts', () => {
    gameStore.setState({
      activeStation: 'smithy',
      inventory: { copper_ore: 3, stone: 1 },
      collection: [],
    });
    expect(gameStore.getState().craftRecipe('recipe_heavy_blow')).toBe(false);
    gameStore.setState({ unlockedRecipes: ['recipe_heavy_blow'] });
    expect(gameStore.getState().craftRecipe('recipe_heavy_blow')).toBe(true);
    expect(gameStore.getState().collection).toContain('heavy_blow');
  });

  it('non-gated recipes stay craftable without quest unlocks', () => {
    gameStore.setState({
      activeStation: 'smithy',
      inventory: { copper_ore: 2, wood: 2 },
      collection: [],
    });
    expect(gameStore.getState().craftRecipe('recipe_spark_strike')).toBe(true);
  });
});

describe('save roundtrip (additive-optional, no version bump)', () => {
  it('persists and rehydrates quest state', () => {
    gameStore.setState({
      activeQuests: ['tilda_1'],
      completedQuests: ['maro_1'],
      unlockedRecipes: ['recipe_heavy_blow'],
    });
    const raw = serialize(snapshotFromState(gameStore.getState()));
    const result = deserialize(raw);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.activeQuests).toEqual(['tilda_1']);
    expect(result.data.completedQuests).toEqual(['maro_1']);
    expect(result.data.unlockedRecipes).toEqual(['recipe_heavy_blow']);

    resetStore();
    gameStore.getState().hydrateFromSave(result.data, false);
    const state = gameStore.getState();
    expect(state.activeQuests).toEqual(['tilda_1']);
    expect(state.completedQuests).toEqual(['maro_1']);
    expect(state.unlockedRecipes).toEqual(['recipe_heavy_blow']);
  });

  it('pre-quest saves hydrate to a clean quest state', () => {
    const snapshot = snapshotFromState(gameStore.getState());
    const raw = snapshot as unknown as Record<string, unknown>;
    delete raw.activeQuests;
    delete raw.completedQuests;
    delete raw.unlockedRecipes;
    const result = deserialize(serialize(snapshot));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    gameStore.setState({ activeQuests: ['x'], completedQuests: ['y'], unlockedRecipes: ['z'] });
    gameStore.getState().hydrateFromSave(result.data, false);
    expect(gameStore.getState().activeQuests).toEqual([]);
    expect(gameStore.getState().completedQuests).toEqual([]);
    expect(gameStore.getState().unlockedRecipes).toEqual([]);
  });
});
