import { combatConfig } from '../data/combat';
import { starterDeck } from '../data/cards/tier1';
import { shadowGull, shadowRat } from '../data/enemies/tier1';
import { strings } from '../shared/strings';
import { useGameStore } from '../shared/store';
import { CombatScreen } from './combat/CombatScreen';

/** React overlay root — menus, combat UI and inventory mount here. */
export function App() {
  const worldReady = useGameStore((s) => s.worldReady);
  const inCombat = useGameStore((s) => s.combat !== null);
  const startCombat = useGameStore((s) => s.startCombat);

  if (inCombat) return <CombatScreen />;

  return (
    <>
      <div className="overlay-badge">
        {strings.game.title} — {worldReady ? strings.ui.overlayReady : '…'}
      </div>
      {/* Dev entry until M2 wires encounters from the island (ROADMAP M1). */}
      <button
        className="dev-combat-button"
        onClick={() =>
          startCombat({
            playerHp: combatConfig.basePlayerHp,
            deck: [...starterDeck],
            enemies: [shadowRat, shadowGull],
          })
        }
      >
        {strings.ui.startTestCombat}
      </button>
    </>
  );
}
