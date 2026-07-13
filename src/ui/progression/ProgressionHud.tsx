import { xpProgress } from '../../core/progression/progression';
import { explorationFraction } from '../../core/world/exploration';
import { heimatbuchtExplorationMarkers } from '../../data/exploration';
import { strings } from '../../shared/strings';
import { cleansedOf, effectiveDensityOf, useGameStore } from '../../shared/store';

/**
 * Island HUD chip (M4): current level + XP progress + exploration % and
 * shadow density as TEXT (information never color-only, docs/11). Level and
 * progress are derived from the single persisted xp value (core/progression);
 * exploration % from the discovered markers (core/world/exploration).
 */
export function ProgressionHud() {
  const xp = useGameStore((s) => s.xp);
  const discoveredMarkers = useGameStore((s) => s.discoveredMarkers);
  // Effective density: permanently 0 once the island is cleansed (docs/02);
  // the HUD then says "Gereinigt" AS TEXT (never number/color alone, docs/11).
  const shadowDensity = useGameStore(effectiveDensityOf);
  const cleansed = useGameStore(cleansedOf);
  const progress = xpProgress(xp);
  const explorationPercent = Math.round(
    explorationFraction(discoveredMarkers, heimatbuchtExplorationMarkers) * 100,
  );

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
      <span className="progression-exploration">
        {strings.progression.explorationLabel.replace('{percent}', String(explorationPercent))}
      </span>
      <span className="progression-density">
        {cleansed
          ? strings.progression.cleansedLabel
          : strings.progression.densityLabel.replace('{density}', String(shadowDensity))}
      </span>
    </div>
  );
}
