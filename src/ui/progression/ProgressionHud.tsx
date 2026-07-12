import { xpProgress } from '../../core/progression/progression';
import { strings } from '../../shared/strings';
import { useGameStore } from '../../shared/store';

/**
 * Island HUD chip (M4): current level + XP progress as TEXT (information
 * never color-only, docs/11). Level and progress are derived from the
 * single persisted xp value (core/progression).
 */
export function ProgressionHud() {
  const xp = useGameStore((s) => s.xp);
  const progress = xpProgress(xp);

  const xpText =
    progress.forNext === null
      ? strings.progression.xpMax
      : strings.progression.xpLabel
          .replace('{current}', String(progress.intoLevel))
          .replace('{next}', String(progress.forNext));

  return (
    <div className="progression-hud">
      <span className="progression-level">
        {strings.progression.levelLabel.replace('{level}', String(progress.level))}
      </span>
      <span className="progression-xp">{xpText}</span>
    </div>
  );
}
