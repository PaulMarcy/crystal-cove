/**
 * Dialog definitions (M5, docs/13 — "Dialoge sind Daten").
 * Pure data: the flow logic lives in core/dialog, the renderer in ui/dialog.
 *
 * Text NEVER lives here — `lines` and `labelKey` are keys into
 * shared/strings.ts (strings.dialogLines / strings.dialogChoices), checked
 * by shared/dialogs.test.ts. Content rules from docs/13 apply to the
 * strings: max 2 lines à ~60 chars per box, Lumen max 1 sentence (docs/06).
 *
 * The M5 NPC/quest tasks (content-smith) only ADD entries here — the
 * format already covers the two V1 choice cases (docs/13): quest
 * acceptance ("Annehmen"/"Später") and opening Piya's trade.
 */

/**
 * Declarative dialog-end effect (docs/13 "Flags/Quest-Folgen laufen als
 * Events durch core"). The store interprets these — no free-form callbacks
 * in data. `acceptQuest` and `openTrade` are PREPARED hooks: the questlog
 * task and the market task (M5) dock their handling onto the existing
 * interpreter in shared/store.
 */
export type DialogActionDef =
  | { type: 'setStoryFlag'; flag: string }
  | { type: 'acceptQuest'; questId: string }
  | { type: 'openTrade'; npcId: string };

/** One selectable option (docs/13: max 3, shown after the last line). */
export interface DialogChoiceDef {
  /** Key into strings.dialogChoices. */
  labelKey: string;
  /** Effect of picking this option; omitted = just closes ("Später"). */
  action?: DialogActionDef;
}

export interface DialogDef {
  id: string;
  /** NPC id (strings.npcs) — name plate + portrait placeholder. */
  speaker: string;
  /** Keys into strings.dialogLines, one box per key (docs/13). */
  lines: readonly string[];
  /** Choices after the last line (docs/13: max 3; V1 only 2 use cases). */
  choices?: readonly DialogChoiceDef[];
  /** Effects when a choice-less dialog ends (e.g. story flags). */
  endActions?: readonly DialogActionDef[];
}

/** docs/13: max 3 options — enforced in core/dialog and by data tests. */
export const MAX_DIALOG_CHOICES = 3;

export const dialogs: readonly DialogDef[] = [
  {
    // Demo dialog (M5 dialog task): proves the flow end-to-end. The real
    // Lumen onboarding lines arrive with M6 (docs/06 Beat 2). Sets a flag
    // so the end-action path is exercised in the shipped game too.
    id: 'lumen_intro',
    speaker: 'lumen',
    lines: ['lumen_intro_1', 'lumen_intro_2'],
    endActions: [{ type: 'setStoryFlag', flag: 'lumen_greeted' }],
  },
];

export const dialogsById: Readonly<Record<string, DialogDef>> = Object.fromEntries(
  dialogs.map((d) => [d.id, d]),
);

/** A talkable NPC placed on the island (world layer renders + triggers). */
export interface DialogNpcPlacement {
  npcId: string;
  dialogId: string;
  /** Marker tile on the Heimatbucht map (16 px tiles, like buildings). */
  tileX: number;
  tileY: number;
}

/**
 * Placed dialog NPCs. Only the Lumen demo for now — NPC arrival triggers
 * (Tilda, Maro, …) are the next M5 task and will feed this list (or a
 * dynamic variant) from arrival state.
 */
export const dialogNpcPlacements: readonly DialogNpcPlacement[] = [
  { npcId: 'lumen', dialogId: 'lumen_intro', tileX: 28, tileY: 20 },
];

/** Max distance (px) at which an NPC can be talked to. */
export const npcInteractRange = 26;
