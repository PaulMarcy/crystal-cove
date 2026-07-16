import { useCallback, useEffect, useMemo, useState } from 'react';
import { awaitingChoice } from '../../core/dialog/dialog';
import { MAX_DIALOG_CHOICES, dialogsById } from '../../data/dialogs';
import { strings } from '../../shared/strings';
import { useGameStore } from '../../shared/store';

/**
 * Typewriter speed (docs/13). HARD-CODED default — the setting
 * (sofort / schnell / normal) arrives with M6 (docs/12 Einstellungen).
 */
const TYPEWRITER_CHARS_PER_SECOND = 40;
const TYPEWRITER_TICK_MS = 1000 / TYPEWRITER_CHARS_PER_SECOND;

const dialogLines = strings.dialogLines as Readonly<Record<string, string>>;
const dialogChoices = strings.dialogChoices as Readonly<Record<string, string>>;
const npcNames = strings.npcs as Readonly<Record<string, string>>;

/** Reduced motion → text appears instantly (docs/12 „Effekte reduzieren"). */
function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

/**
 * Typewriter effect for one box: reveals the text at the fixed default
 * speed; `revealAll` (Klick/Leertaste während des Tippens) skips to the
 * full text instead of advancing (docs/13-übliches Verhalten).
 */
function useTypewriter(text: string): { shown: string; done: boolean; revealAll: () => void } {
  const initialCount = (t: string) => (prefersReducedMotion() ? t.length : 0);
  const [state, setState] = useState(() => ({ text, count: initialCount(text) }));
  // New box → reset during render (React "adjusting state on prop change").
  if (state.text !== text) setState({ text, count: initialCount(text) });

  useEffect(() => {
    if (prefersReducedMotion()) return undefined;
    const timer = window.setInterval(() => {
      setState((current) =>
        current.count >= current.text.length ? current : { ...current, count: current.count + 1 },
      );
    }, TYPEWRITER_TICK_MS);
    return () => window.clearInterval(timer);
  }, [text]);

  const revealAll = useCallback(
    () => setState((current) => ({ ...current, count: current.text.length })),
    [],
  );
  return {
    shown: text.slice(0, Math.min(state.count, text.length)),
    done: state.count >= text.length,
    revealAll,
  };
}

/**
 * Dialog overlay (M5, docs/13): portrait left (~96 px placeholder), name
 * plate above, full-width textbox at the bottom, blinking ▼ continue
 * indicator (with TEXT label — never a glyph/color alone, docs/11).
 * Weiter per Klick/Leertaste, KEIN Auto-Advance. Choices (max 3) render
 * vertically under the box, highlight orange = actionable (docs/04).
 * Pure render layer: flow lives in core/dialog, dispatched via the store.
 */
export function DialogOverlay() {
  const activeDialog = useGameStore((s) => s.activeDialog);
  const advanceDialog = useGameStore((s) => s.advanceDialog);
  const chooseDialogOption = useGameStore((s) => s.chooseDialogOption);

  const def = activeDialog ? dialogsById[activeDialog.dialogId] : undefined;
  const lineKey = def?.lines[activeDialog?.lineIndex ?? 0] ?? '';
  const text = dialogLines[lineKey] ?? lineKey;
  const { shown, done, revealAll } = useTypewriter(text);

  const atChoiceGate = useMemo(
    () => (def && activeDialog ? awaitingChoice(def, activeDialog) : false),
    [def, activeDialog],
  );
  // Choices appear only once the line is fully revealed.
  const choicesOpen = atChoiceGate && done;

  // Weiter per Leertaste/Enter (docs/13); typing first reveals the full box.
  useEffect(() => {
    if (!activeDialog) return undefined;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== ' ' && event.key !== 'Enter') return;
      event.preventDefault();
      if (!done) revealAll();
      else if (!atChoiceGate) advanceDialog();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [activeDialog, done, atChoiceGate, revealAll, advanceDialog]);

  if (!activeDialog || !def) return null;
  const speakerName = npcNames[def.speaker] ?? def.speaker;

  return (
    <div className="dialog-overlay">
      <section
        className="dialog-box"
        aria-label={speakerName}
        onClick={() => {
          if (!done) revealAll();
          else if (!atChoiceGate) advanceDialog();
        }}
      >
        <div className="dialog-portrait-column">
          <div className="dialog-nameplate">{speakerName}</div>
          {/* Portrait placeholder (grade 1 "Funktional", docs/04): initial
              letter as icon — real pixel-art portraits come later. */}
          <div
            className="dialog-portrait"
            role="img"
            aria-label={strings.dialog.portraitLabel.replace('{npc}', speakerName)}
          >
            {speakerName.charAt(0)}
          </div>
        </div>
        <div className="dialog-text-column">
          <p className="dialog-text">{shown}</p>
          {done && !atChoiceGate && (
            <div className="dialog-continue" title={strings.dialog.continueHint}>
              <span className="dialog-continue-label">{strings.dialog.continueLabel}</span>
              <span className="dialog-continue-indicator" aria-hidden="true">
                ▼
              </span>
            </div>
          )}
        </div>
      </section>
      {choicesOpen && (
        <div className="dialog-choices" role="group" aria-label={strings.dialog.choicesLabel}>
          {(def.choices ?? []).slice(0, MAX_DIALOG_CHOICES).map((choice, index) => (
            <button
              key={choice.labelKey}
              className="dialog-choice"
              onClick={() => chooseDialogOption(index)}
            >
              {dialogChoices[choice.labelKey] ?? choice.labelKey}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
