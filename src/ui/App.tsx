import { useEffect } from 'react';
import { combatConfig } from '../data/combat';
import { starterDeck } from '../data/cards/tier1';
import { shadowGull, shadowRat } from '../data/enemies/tier1';
import { strings } from '../shared/strings';
import { useGameStore } from '../shared/store';
import { CombatScreen } from './combat/CombatScreen';
import { InventoryPanel } from './inventory/InventoryPanel';

const LOOT_TOAST_MS = 4000;

/** Brief island feedback after a won combat: what just entered the inventory. */
function LootToast() {
  const lastLoot = useGameStore((s) => s.lastLoot);
  const clearLastLoot = useGameStore((s) => s.clearLastLoot);

  useEffect(() => {
    if (!lastLoot) return undefined;
    const timer = window.setTimeout(clearLastLoot, LOOT_TOAST_MS);
    return () => window.clearTimeout(timer);
  }, [lastLoot, clearLastLoot]);

  if (!lastLoot) return null;
  return (
    <div className="loot-toast" role="status">
      <strong>{strings.world.lootToastHeading}</strong>
      <ul className="loot-list">
        {Object.entries(lastLoot).map(([item, amount]) => (
          <li key={item}>
            {strings.items[item as keyof typeof strings.items] ?? item} ×{amount}
          </li>
        ))}
      </ul>
    </div>
  );
}

/** One-time notice when the corrupt primary save was restored from backup. */
function SaveRecoveryNotice() {
  const recovered = useGameStore((s) => s.saveRecovered);
  const dismiss = useGameStore((s) => s.clearSaveRecovered);
  if (!recovered) return null;
  return (
    <div className="save-recovery-notice" role="alert">
      <span>{strings.save.recoveryNotice}</span>
      <button onClick={dismiss}>{strings.save.recoveryDismiss}</button>
    </div>
  );
}

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
      <LootToast />
      <InventoryPanel />
      <SaveRecoveryNotice />
    </>
  );
}
