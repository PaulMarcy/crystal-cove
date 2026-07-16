import { maxHpForLevel, xpProgress } from '../../core/progression/progression';
import { explorationFraction } from '../../core/world/exploration';
import { heimatbuchtExplorationMarkers } from '../../data/exploration';
import { marketSlot } from '../../data/market';
import { strings } from '../../shared/strings';
import { cleansedOf, effectiveDensityOf, modifiersOf, useGameStore } from '../../shared/store';

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
  // HP outside combat (M4 Task 5) — persisted in the store, max from
  // level + talent "Zähigkeit" (core/progression).
  const playerHp = useGameStore((s) => s.playerHp);
  // Münzen (M5 Task 4b, docs/10): dezenter Chip-Eintrag, erst sichtbar
  // sobald Münzen existieren oder der Markt (B8) steht — vorher ist die
  // Münz-Ökonomie für den Spieler noch kein Thema.
  const coins = useGameStore((s) => s.coins);
  const marketBuilt = useGameStore((s) => (s.builtBuildings[marketSlot] ?? 0) >= 1);
  const maxHpBonus = useGameStore((s) => modifiersOf(s).maxHpBonus);
  const progress = xpProgress(xp);
  const maxHp = maxHpForLevel(progress.level, maxHpBonus);
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
      <span className="progression-hp">
        {strings.progression.hpLabel
          .replace('{hp}', String(Math.min(playerHp, maxHp)))
          .replace('{max}', String(maxHp))}
      </span>
      {(coins > 0 || marketBuilt) && (
        <span className="progression-coins">
          {strings.coins.label.replace('{count}', String(coins))}
        </span>
      )}
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
