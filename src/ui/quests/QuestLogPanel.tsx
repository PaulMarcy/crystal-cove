import { useEffect, useState } from 'react';
import { canTurnIn } from '../../core/quests/quests';
import { questsById } from '../../data/npcs';
import { strings } from '../../shared/strings';
import { questContextOf, useGameStore } from '../../shared/store';

/**
 * Minimal questlog (M5 Task 3, approved spec): toggle panel (key Q) next
 * to the inventory — active quests with name, giver, goal and reward text
 * plus a completed list. No tracking, no map markers (Nicht-Ziel V1).
 * Pure render layer: quest state lives in the store, rules in core/quests.
 */
export function QuestLogPanel() {
  const activeQuests = useGameStore((s) => s.activeQuests);
  const completedQuests = useGameStore((s) => s.completedQuests);
  const inventory = useGameStore((s) => s.inventory);
  const storyFlags = useGameStore((s) => s.storyFlags);
  const builtBuildings = useGameStore((s) => s.builtBuildings);
  const rescuedNpcs = useGameStore((s) => s.rescuedNpcs);
  const completedDungeons = useGameStore((s) => s.completedDungeons);
  // Composed OUTSIDE the selector (fresh object per call would re-render
  // on every store change) — inputs above are stable slices.
  const ctx = questContextOf({
    inventory,
    storyFlags,
    builtBuildings,
    rescuedNpcs,
    completedDungeons,
    activeQuests,
    completedQuests,
  });
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.repeat) return;
      if (event.key === 'q' || event.key === 'Q') setOpen((prev) => !prev);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const questTexts = strings.quests as Readonly<
    Record<string, { name: string; goal: string; reward: string }>
  >;
  const npcNames = strings.npcs as Readonly<Record<string, string>>;

  const active = activeQuests.flatMap((id) => {
    const quest = questsById[id];
    const texts = questTexts[id];
    return quest && texts ? [{ quest, texts }] : [];
  });
  const completed = completedQuests.flatMap((id) => (questTexts[id] ? [questTexts[id]] : []));

  return (
    <>
      <div className="questlog-hint">{strings.questLog.toggleHint}</div>
      {open && (
        <section className="questlog-panel" aria-label={strings.questLog.title}>
          <h2 className="questlog-title">{strings.questLog.title}</h2>
          {active.length === 0 && completed.length === 0 ? (
            <p className="questlog-empty">{strings.questLog.empty}</p>
          ) : (
            <>
              {active.length > 0 && (
                <>
                  <h3 className="questlog-heading">{strings.questLog.activeHeading}</h3>
                  <ul className="questlog-list">
                    {active.map(({ quest, texts }) => (
                      <li key={quest.id} className="questlog-entry">
                        <div className="questlog-entry-head">
                          <span className="questlog-name">{texts.name}</span>
                          {/* Turn-in-ready as TEXT (docs/11: nie nur Farbe). */}
                          {canTurnIn(quest, ctx) && (
                            <span className="questlog-ready-tag">{strings.questLog.readyTag}</span>
                          )}
                        </div>
                        <p className="questlog-giver">
                          {strings.questLog.giverLabel.replace(
                            '{npc}',
                            npcNames[quest.npcId] ?? quest.npcId,
                          )}
                        </p>
                        <p className="questlog-goal">{texts.goal}</p>
                        <p className="questlog-reward">
                          {strings.questLog.rewardLabel.replace('{reward}', texts.reward)}
                        </p>
                      </li>
                    ))}
                  </ul>
                </>
              )}
              {completed.length > 0 && (
                <>
                  <h3 className="questlog-heading">{strings.questLog.completedHeading}</h3>
                  <ul className="questlog-list questlog-list--completed">
                    {completed.map((texts) => (
                      <li key={texts.name} className="questlog-completed-row">
                        {texts.name}
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </>
          )}
        </section>
      )}
    </>
  );
}
