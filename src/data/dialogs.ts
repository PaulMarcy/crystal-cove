/**
 * Dialog definitions (M5, docs/13 — "Dialoge sind Daten").
 * Pure data: the flow logic lives in core/dialog, the renderer in ui/dialog.
 *
 * Text NEVER lives here — `lines` and `labelKey` are keys into
 * shared/strings.ts (strings.dialogLines / strings.dialogChoices), checked
 * by shared/dialogs.test.ts. Content rules from docs/13 apply to the
 * strings: max 2 lines à ~60 chars per box, Lumen max 1 sentence (docs/06).
 *
 * Which dialog an NPC opens is decided in core/quests.dialogIdForNpc
 * (first meeting → turn-in → reminder → offer → default); the per-quest
 * dialog ids are wired in data/npcs (QuestDef.dialogs).
 */

/**
 * Declarative dialog-end effect (docs/13 "Flags/Quest-Folgen laufen als
 * Events durch core"). The store interprets these — no free-form callbacks
 * in data. `openTrade` is a PREPARED hook for the M5 market task.
 */
export type DialogActionDef =
  | { type: 'setStoryFlag'; flag: string }
  | { type: 'acceptQuest'; questId: string }
  | { type: 'completeQuest'; questId: string }
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

/** Quest-offer choices (docs/13 V1: „Annehmen" / „Später"). */
function offerChoices(questId: string): readonly DialogChoiceDef[] {
  return [
    { labelKey: 'quest_accept', action: { type: 'acceptQuest', questId } },
    { labelKey: 'quest_later' },
  ];
}

/** Standard quest dialog triple: offer (choice gate), reminder, turn-in. */
function questDialogs(
  speaker: string,
  questId: string,
  offerLines: number,
  doneLines: number,
): DialogDef[] {
  const lineKeys = (suffix: string, count: number) =>
    Array.from({ length: count }, (_, i) => `${questId}_${suffix}_${i + 1}`);
  return [
    {
      id: `${questId}_offer`,
      speaker,
      lines: lineKeys('offer', offerLines),
      choices: offerChoices(questId),
    },
    { id: `${questId}_reminder`, speaker, lines: lineKeys('reminder', 1) },
    {
      id: `${questId}_done`,
      speaker,
      lines: lineKeys('done', doneLines),
      endActions: [{ type: 'completeQuest', questId }],
    },
  ];
}

export const dialogs: readonly DialogDef[] = [
  // ── Lumen (Mentor, docs/09 — keine Kette) ────────────────────────────────
  {
    // First meeting (M5 dialog task). The real Lumen onboarding lines
    // arrive with M6 (docs/06 Beat 2). Sets the met flag (core/quests).
    id: 'lumen_intro',
    speaker: 'lumen',
    lines: ['lumen_intro_1', 'lumen_intro_2'],
    endActions: [{ type: 'setStoryFlag', flag: 'lumen_greeted' }],
  },
  { id: 'lumen_default', speaker: 'lumen', lines: ['lumen_default_1'] },

  // ── Maro (Schmied) ───────────────────────────────────────────────────────
  {
    id: 'maro_arrival',
    speaker: 'maro',
    lines: ['maro_arrival_1', 'maro_arrival_2'],
    endActions: [{ type: 'setStoryFlag', flag: 'met_maro' }],
  },
  { id: 'maro_default', speaker: 'maro', lines: ['maro_default_1'] },
  ...questDialogs('maro', 'maro_1', 2, 2),
  ...questDialogs('maro', 'maro_2', 2, 1),
  ...questDialogs('maro', 'maro_3', 2, 2),

  // ── Tilda (Köchin) ───────────────────────────────────────────────────────
  {
    id: 'tilda_arrival',
    speaker: 'tilda',
    lines: ['tilda_arrival_1', 'tilda_arrival_2'],
    endActions: [{ type: 'setStoryFlag', flag: 'met_tilda' }],
  },
  { id: 'tilda_default', speaker: 'tilda', lines: ['tilda_default_1'] },
  ...questDialogs('tilda', 'tilda_1', 2, 1),
  ...questDialogs('tilda', 'tilda_2', 2, 1),
  ...questDialogs('tilda', 'tilda_3', 2, 2),

  // ── Bruna (Fischerin) ────────────────────────────────────────────────────
  {
    id: 'bruna_arrival',
    speaker: 'bruna',
    lines: ['bruna_arrival_1', 'bruna_arrival_2'],
    endActions: [{ type: 'setStoryFlag', flag: 'met_bruna' }],
  },
  { id: 'bruna_default', speaker: 'bruna', lines: ['bruna_default_1'] },
  ...questDialogs('bruna', 'bruna_1', 2, 1),
  ...questDialogs('bruna', 'bruna_2', 2, 1),
  ...questDialogs('bruna', 'bruna_3', 2, 2),

  // ── Orin (Einsiedler-Magier) ─────────────────────────────────────────────
  {
    id: 'orin_arrival',
    speaker: 'orin',
    lines: ['orin_arrival_1', 'orin_arrival_2'],
    endActions: [{ type: 'setStoryFlag', flag: 'met_orin' }],
  },
  { id: 'orin_default', speaker: 'orin', lines: ['orin_default_1'] },
  ...questDialogs('orin', 'orin_1', 2, 2),
  ...questDialogs('orin', 'orin_2', 2, 1),
  ...questDialogs('orin', 'orin_3', 2, 2),

  // ── Piya (Händlerin) ─────────────────────────────────────────────────────
  {
    id: 'piya_arrival',
    speaker: 'piya',
    lines: ['piya_arrival_1', 'piya_arrival_2'],
    endActions: [{ type: 'setStoryFlag', flag: 'met_piya' }],
  },
  {
    // Handel (docs/13 V1 use case 2): „Zeig mir deine Waren" öffnet das
    // Markt-Panel (openTrade → store, M5 Task 4b); „Später" schließt nur.
    id: 'piya_default',
    speaker: 'piya',
    lines: ['piya_default_1'],
    choices: [
      { labelKey: 'trade_open', action: { type: 'openTrade', npcId: 'piya' } },
      { labelKey: 'quest_later' },
    ],
  },
  ...questDialogs('piya', 'piya_1', 2, 1),
  ...questDialogs('piya', 'piya_2', 2, 1),
  ...questDialogs('piya', 'piya_3', 2, 2),
];

export const dialogsById: Readonly<Record<string, DialogDef>> = Object.fromEntries(
  dialogs.map((d) => [d.id, d]),
);

/** Max distance (px) at which an NPC can be talked to. */
export const npcInteractRange = 26;
