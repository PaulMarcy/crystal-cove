import { strings } from '../shared/strings';
import { useGameStore } from '../shared/store';

/** React overlay root — menus, combat UI and inventory mount here later. */
export function App() {
  const worldReady = useGameStore((s) => s.worldReady);

  return (
    <div className="overlay-badge">
      {strings.game.title} — {worldReady ? strings.ui.overlayReady : '…'}
    </div>
  );
}
