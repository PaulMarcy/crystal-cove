import { describe, expect, it } from 'vitest';
import type { DialogDef } from '../../data/dialogs';
import {
  advanceDialogRun,
  awaitingChoice,
  resolveDialogChoice,
  startDialogRun,
} from './dialog';

/** Plain multi-line dialog with end actions (flag on close). */
const plainDialog: DialogDef = {
  id: 'test_plain',
  speaker: 'lumen',
  lines: ['l1', 'l2', 'l3'],
  endActions: [{ type: 'setStoryFlag', flag: 'greeted' }],
};

/** Quest-offer dialog — V1 choice case 1 (docs/13: Annehmen / Später). */
const questDialog: DialogDef = {
  id: 'test_quest',
  speaker: 'tilda',
  lines: ['q1', 'q2'],
  choices: [
    { labelKey: 'quest_accept', action: { type: 'acceptQuest', questId: 'tilda_1' } },
    { labelKey: 'quest_later' },
  ],
};

describe('startDialogRun', () => {
  it('starts at the first line', () => {
    expect(startDialogRun(plainDialog)).toEqual({ dialogId: 'test_plain', lineIndex: 0 });
  });

  it('refuses dialogs without lines', () => {
    expect(startDialogRun({ id: 'x', speaker: 'lumen', lines: [] })).toBeNull();
  });
});

describe('advanceDialogRun', () => {
  it('steps through the lines one box at a time (kein Auto-Advance)', () => {
    const run = startDialogRun(plainDialog)!;
    const step1 = advanceDialogRun(plainDialog, run);
    expect(step1).toEqual({ kind: 'line', run: { dialogId: 'test_plain', lineIndex: 1 } });
    if (step1.kind !== 'line') throw new Error('expected a line step');
    const step2 = advanceDialogRun(plainDialog, step1.run);
    expect(step2).toEqual({ kind: 'line', run: { dialogId: 'test_plain', lineIndex: 2 } });
  });

  it('ends after the last line and returns the declarative end actions', () => {
    const result = advanceDialogRun(plainDialog, { dialogId: 'test_plain', lineIndex: 2 });
    expect(result).toEqual({
      kind: 'end',
      actions: [{ type: 'setStoryFlag', flag: 'greeted' }],
    });
  });

  it('ends without actions when the dialog has none', () => {
    const def: DialogDef = { id: 'x', speaker: 'lumen', lines: ['a'] };
    expect(advanceDialogRun(def, { dialogId: 'x', lineIndex: 0 })).toEqual({
      kind: 'end',
      actions: [],
    });
  });

  it('blocks advancing at the choice gate (docs/13: erst wählen)', () => {
    const run = { dialogId: 'test_quest', lineIndex: 1 };
    expect(awaitingChoice(questDialog, run)).toBe(true);
    expect(advanceDialogRun(questDialog, run)).toEqual({ kind: 'awaitChoice' });
  });

  it('does not open choices before the last line', () => {
    const run = { dialogId: 'test_quest', lineIndex: 0 };
    expect(awaitingChoice(questDialog, run)).toBe(false);
    expect(advanceDialogRun(questDialog, run)).toEqual({
      kind: 'line',
      run: { dialogId: 'test_quest', lineIndex: 1 },
    });
  });
});

describe('resolveDialogChoice', () => {
  const gate = { dialogId: 'test_quest', lineIndex: 1 };

  it('returns the action of the picked option (quest acceptance)', () => {
    expect(resolveDialogChoice(questDialog, gate, 0)).toEqual({
      kind: 'end',
      actions: [{ type: 'acceptQuest', questId: 'tilda_1' }],
    });
  });

  it('ends without actions for a no-action option ("Später")', () => {
    expect(resolveDialogChoice(questDialog, gate, 1)).toEqual({ kind: 'end', actions: [] });
  });

  it('rejects invalid indices and non-gate states', () => {
    expect(resolveDialogChoice(questDialog, gate, 2)).toBeNull();
    expect(resolveDialogChoice(questDialog, gate, -1)).toBeNull();
    expect(resolveDialogChoice(questDialog, { dialogId: 'test_quest', lineIndex: 0 }, 0)).toBeNull();
    expect(resolveDialogChoice(plainDialog, { dialogId: 'test_plain', lineIndex: 2 }, 0)).toBeNull();
  });

  it('supports the second V1 case: openTrade (Piya-Handel)', () => {
    const trade: DialogDef = {
      id: 'piya_trade',
      speaker: 'piya',
      lines: ['t1'],
      choices: [
        { labelKey: 'trade_open', action: { type: 'openTrade', npcId: 'piya' } },
        { labelKey: 'quest_later' },
      ],
    };
    expect(resolveDialogChoice(trade, { dialogId: 'piya_trade', lineIndex: 0 }, 0)).toEqual({
      kind: 'end',
      actions: [{ type: 'openTrade', npcId: 'piya' }],
    });
  });
});
