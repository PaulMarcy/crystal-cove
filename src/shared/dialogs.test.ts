import { beforeEach, describe, expect, it } from 'vitest';
import { dialogs, MAX_DIALOG_CHOICES } from '../data/dialogs';
import { gameStore } from './store';
import { strings } from './strings';

/**
 * Store wiring for the M5 dialog task (docs/13): dialog start/advance/
 * choice dispatch and the declarative end-action interpreter. Pure flow
 * rules live in core/dialog with their own tests.
 */

beforeEach(() => {
  gameStore.setState({
    activeDialog: null,
    activeStation: null,
    activeBuildSlot: null,
    combat: null,
    currentDungeonRun: null,
    storyFlags: [],
  });
});

describe('dialog store flow (docs/13)', () => {
  it('starts the Lumen demo dialog at line 0', () => {
    expect(gameStore.getState().startDialog('lumen_intro')).toBe(true);
    expect(gameStore.getState().activeDialog).toEqual({
      dialogId: 'lumen_intro',
      lineIndex: 0,
    });
  });

  it('refuses unknown dialogs and double starts', () => {
    expect(gameStore.getState().startDialog('nope')).toBe(false);
    expect(gameStore.getState().startDialog('lumen_intro')).toBe(true);
    expect(gameStore.getState().startDialog('lumen_intro')).toBe(false);
  });

  it('refuses while another overlay is open (one overlay at a time)', () => {
    gameStore.setState({ activeStation: 'kitchen' });
    expect(gameStore.getState().startDialog('lumen_intro')).toBe(false);
    gameStore.setState({ activeStation: null, activeBuildSlot: 'b4' });
    expect(gameStore.getState().startDialog('lumen_intro')).toBe(false);
  });

  it('advances box by box and applies end actions on close', () => {
    gameStore.getState().startDialog('lumen_intro');
    gameStore.getState().advanceDialog();
    expect(gameStore.getState().activeDialog?.lineIndex).toBe(1);
    gameStore.getState().advanceDialog();
    // Dialog closed; declarative end action set the story flag.
    expect(gameStore.getState().activeDialog).toBeNull();
    expect(gameStore.getState().storyFlags).toContain('lumen_greeted');
  });

  it('chooseDialogOption on a choice-less dialog is a safe no-op', () => {
    // Choice-gate resolution itself is covered by core/dialog tests —
    // data has no choice dialog yet (V1 cases arrive with the quest task).
    gameStore.setState({ activeDialog: { dialogId: 'lumen_intro', lineIndex: 0 } });
    gameStore.getState().chooseDialogOption(0);
    expect(gameStore.getState().activeDialog).not.toBeNull();
  });

  it('advanceDialog / chooseDialogOption are no-ops without a dialog', () => {
    gameStore.getState().advanceDialog();
    gameStore.getState().chooseDialogOption(0);
    expect(gameStore.getState().activeDialog).toBeNull();
  });
});

describe('dialog data ↔ strings (docs/13: keine Literale in Dialogdaten)', () => {
  const lineKeys = strings.dialogLines as Readonly<Record<string, string>>;
  const choiceKeys = strings.dialogChoices as Readonly<Record<string, string>>;

  it('every dialog line key resolves to a German string', () => {
    for (const def of dialogs) {
      for (const key of def.lines) {
        expect(lineKeys[key], `missing strings.dialogLines.${key}`).toBeTruthy();
      }
    }
  });

  it('every choice label key resolves and choices stay within the max', () => {
    for (const def of dialogs) {
      const choices = def.choices ?? [];
      expect(choices.length).toBeLessThanOrEqual(MAX_DIALOG_CHOICES);
      for (const choice of choices) {
        expect(choiceKeys[choice.labelKey], `missing strings.dialogChoices.${choice.labelKey}`)
          .toBeTruthy();
      }
    }
  });

  it('every speaker has a display name (strings.npcs)', () => {
    const npcNames = strings.npcs as Readonly<Record<string, string>>;
    for (const def of dialogs) {
      expect(npcNames[def.speaker], `missing strings.npcs.${def.speaker}`).toBeTruthy();
    }
  });

  it('box texts follow docs/13 length rule (max 2 Zeilen à ~60 Zeichen)', () => {
    for (const def of dialogs) {
      for (const key of def.lines) {
        expect((lineKeys[key] ?? '').length).toBeLessThanOrEqual(120);
      }
    }
  });
});
