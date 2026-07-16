import { useEffect } from 'react';
import { combatConfig } from '../data/combat';
import { starterDeck } from '../data/cards/tier1';
import { shadowGull, shadowRat } from '../data/enemies/tier1';
import { strings } from '../shared/strings';
import { useGameStore } from '../shared/store';
import { CombatScreen } from './combat/CombatScreen';
import { DungeonPanel } from './dungeon/DungeonPanel';
import { InventoryPanel } from './inventory/InventoryPanel';
import { QuestLogPanel } from './quests/QuestLogPanel';
import { WorkshopPanel } from './workshop/WorkshopPanel';
import { BuildPanel } from './village/BuildPanel';
import { DialogOverlay } from './dialog/DialogOverlay';
import { DeckChestPanel } from './deck/DeckChestPanel';
import { ProgressionHud } from './progression/ProgressionHud';
import { TalentPanel } from './progression/TalentPanel';

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

/**
 * Island feedback after the defeat/abandon loot penalty (M4 Task 5,
 * docs/03): which items the shadows kept. Shown for defeats, dungeon
 * retreats and Aufgeben alike — the store sets lastDefeatLoss only when a
 * penalty was applied.
 */
function DefeatLossToast() {
  const lastDefeatLoss = useGameStore((s) => s.lastDefeatLoss);
  const clearLastDefeatLoss = useGameStore((s) => s.clearLastDefeatLoss);

  useEffect(() => {
    if (!lastDefeatLoss) return undefined;
    const timer = window.setTimeout(clearLastDefeatLoss, LOOT_TOAST_MS);
    return () => window.clearTimeout(timer);
  }, [lastDefeatLoss, clearLastDefeatLoss]);

  if (!lastDefeatLoss) return null;
  const entries = Object.entries(lastDefeatLoss);
  return (
    <div className="loot-toast loot-toast--loss" role="status">
      <strong>
        {entries.length > 0 ? strings.combat.defeatLossHeading : strings.combat.defeatNoLoss}
      </strong>
      {entries.length > 0 && (
        <ul className="loot-list">
          {entries.map(([item, amount]) => (
            <li key={item}>
              {strings.items[item as keyof typeof strings.items] ?? item} ×{amount}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/**
 * Brief island feedback after quest accept/turn-in (M5 Task 3, docs/13
 * Quest-Integration — minimal toast in place of the full reward panel).
 */
function QuestToast() {
  const lastQuestEvent = useGameStore((s) => s.lastQuestEvent);
  const clearLastQuestEvent = useGameStore((s) => s.clearLastQuestEvent);

  useEffect(() => {
    if (!lastQuestEvent) return undefined;
    const timer = window.setTimeout(clearLastQuestEvent, LOOT_TOAST_MS);
    return () => window.clearTimeout(timer);
  }, [lastQuestEvent, clearLastQuestEvent]);

  if (!lastQuestEvent) return null;
  const questTexts = strings.quests as Readonly<Record<string, { name: string }>>;
  const name = questTexts[lastQuestEvent.questId]?.name ?? lastQuestEvent.questId;
  const text =
    lastQuestEvent.kind === 'accepted'
      ? strings.questLog.questAcceptedToast.replace('{name}', name)
      : strings.questLog.questCompletedToast
          .replace('{name}', name)
          .replace('{xp}', String(lastQuestEvent.xp));
  return (
    <div className="loot-toast quest-toast" role="status">
      <strong>{text}</strong>
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
      {/* Dungeon-Panel between dungeon rooms (renders null without a run). */}
      <DungeonPanel />
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
      <DefeatLossToast />
      <ProgressionHud />
      <TalentPanel />
      <WorkshopPanel />
      <BuildPanel />
      <DialogOverlay />
      <DeckChestPanel />
      <QuestToast />
      <QuestLogPanel />
      <InventoryPanel />
      <SaveRecoveryNotice />
    </>
  );
}
