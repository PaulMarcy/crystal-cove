/**
 * Dialog flow logic (M5, docs/13) — pure, engine-free state machine.
 *
 * A running dialog is `{ dialogId, lineIndex }`; advancing and choice
 * resolution are pure functions over the DialogDef. Effects (story flags,
 * quest acceptance, trade) are returned as DECLARATIVE actions — the store
 * interprets them (docs/13: "Flags/Quest-Folgen laufen als Events durch
 * core"). No auto-advance lives here either: the UI decides WHEN to call
 * advance (docs/13: Weiter per Klick/Leertaste, kein Auto-Advance).
 */
import { MAX_DIALOG_CHOICES, type DialogActionDef, type DialogDef } from '../../data/dialogs';

export interface DialogRunState {
  dialogId: string;
  /** Index into def.lines — always a valid line while the dialog runs. */
  lineIndex: number;
}

/** Starts a dialog at its first line. Null for defs without lines. */
export function startDialogRun(def: DialogDef): DialogRunState | null {
  if (def.lines.length === 0) return null;
  return { dialogId: def.id, lineIndex: 0 };
}

/**
 * True when the run shows the LAST line of a dialog that has choices —
 * the UI must render the options and `advanceDialogRun` is blocked
 * (docs/13: Auswahl unter der Textbox, Weiter erst nach Wahl).
 */
export function awaitingChoice(def: DialogDef, run: DialogRunState): boolean {
  return run.lineIndex >= def.lines.length - 1 && (def.choices?.length ?? 0) > 0;
}

export type DialogAdvanceResult =
  /** More text: show the next line. */
  | { kind: 'line'; run: DialogRunState }
  /** Last line has choices — advancing is blocked until one is picked. */
  | { kind: 'awaitChoice' }
  /** Dialog over: apply the returned actions, then close. */
  | { kind: 'end'; actions: readonly DialogActionDef[] };

/** Weiter (Klick/Leertaste): next line, choice gate, or end + end actions. */
export function advanceDialogRun(def: DialogDef, run: DialogRunState): DialogAdvanceResult {
  if (awaitingChoice(def, run)) return { kind: 'awaitChoice' };
  if (run.lineIndex < def.lines.length - 1) {
    return { kind: 'line', run: { dialogId: run.dialogId, lineIndex: run.lineIndex + 1 } };
  }
  return { kind: 'end', actions: def.endActions ?? [] };
}

/**
 * Resolves a picked option. Null when the run is not at the choice gate or
 * the index is invalid (defensive — the UI only renders valid buttons).
 * A choice without action just ends the dialog ("Später", docs/13).
 */
export function resolveDialogChoice(
  def: DialogDef,
  run: DialogRunState,
  choiceIndex: number,
): { kind: 'end'; actions: readonly DialogActionDef[] } | null {
  if (!awaitingChoice(def, run)) return null;
  const choices = def.choices ?? [];
  const choice = choices.slice(0, MAX_DIALOG_CHOICES)[choiceIndex];
  if (!choice) return null;
  return { kind: 'end', actions: choice.action ? [choice.action] : [] };
}
