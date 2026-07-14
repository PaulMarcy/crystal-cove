import { useEffect, useState } from 'react';
import {
  availableTalentPoints,
  canUnlockTalent,
  talismanSlotsForLevel,
} from '../../core/progression/progression';
import { milestones } from '../../data/progression';
import { talismansById } from '../../data/talismans';
import { talentBranches, talents, type TalentDef } from '../../data/talents';
import { strings } from '../../shared/strings';
import { levelOf, useGameStore } from '../../shared/store';

/**
 * Talent tree overlay (M4, docs/02): 3 branches × 3 tiers, toggled with T.
 * Locked/unlocked state is always shown as TEXT, never only via color
 * (docs/11). All rules live in core/progression; this is a render layer.
 */
function TalentCell({
  talent,
  unlocked,
  level,
}: {
  talent: TalentDef;
  unlocked: readonly string[];
  level: number;
}) {
  const unlockTalent = useGameStore((s) => s.unlockTalent);
  const owned = unlocked.includes(talent.id);
  const check = canUnlockTalent(talent.id, unlocked, level, talents);

  let statusText: string;
  if (owned) {
    statusText = strings.talents.unlocked;
  } else if (check.ok) {
    statusText = strings.talents.unlock;
  } else if (check.error === 'previous_tier_locked') {
    statusText = strings.talents.lockedRequiresPrevious;
  } else {
    statusText = strings.talents.lockedNoPoints;
  }

  return (
    <li className={`talent-cell${owned ? ' talent-cell--owned' : ''}`}>
      <div className="talent-cell-head">
        <span className="talent-name">{talent.name}</span>
        <span className="talent-tier">
          {strings.talents.tierLabel.replace('{tier}', String(talent.tier))}
        </span>
      </div>
      <p className="talent-desc">{talent.description}</p>
      {!owned && check.ok ? (
        <button className="talent-unlock-button" onClick={() => unlockTalent(talent.id)}>
          {statusText}
        </button>
      ) : (
        <span className="talent-status">{statusText}</span>
      )}
    </li>
  );
}

/**
 * Talisman section (M4 Task 4, docs/02 Lv 8 / docs/07 Dornenring): owned
 * talismans with equip/unequip. Slot lock is communicated as TEXT
 * (docs/11: information never only via color).
 */
function TalismanSection({ level }: { level: number }) {
  const owned = useGameStore((s) => s.ownedTalismans);
  const equipped = useGameStore((s) => s.equippedTalismans);
  const equip = useGameStore((s) => s.equipTalisman);
  const unequip = useGameStore((s) => s.unequipTalisman);
  const slots = talismanSlotsForLevel(level);
  // First unlock level from data (docs/02: Slot 1 ab Lv 8) — no magic number.
  const firstSlotLevel = milestones.talismanSlots[0].level;
  const uniqueOwned = [...new Set(owned)].filter((id) => talismansById[id]);

  return (
    <div className="talisman-section">
      <h3>{strings.talismans.heading}</h3>
      {slots === 0 ? (
        <p className="talisman-locked">
          {strings.talismans.lockedHint.replace('{level}', String(firstSlotLevel))}
        </p>
      ) : (
        <p className="talisman-slots">
          {strings.talismans.slotsLabel
            .replace('{used}', String(equipped.length))
            .replace('{slots}', String(slots))}
        </p>
      )}
      {uniqueOwned.length === 0 ? (
        <p className="talisman-empty">{strings.talismans.noneOwned}</p>
      ) : (
        <ul className="talisman-list">
          {uniqueOwned.map((id) => {
            const def = talismansById[id]!;
            const isEquipped = equipped.includes(id);
            return (
              <li key={id} className="talisman-cell">
                <div className="talent-cell-head">
                  <span className="talent-name">{def.name}</span>
                  {isEquipped && (
                    <span className="talisman-status">{strings.talismans.equipped}</span>
                  )}
                </div>
                <p className="talent-desc">{def.description}</p>
                {isEquipped ? (
                  <button className="talent-unlock-button" onClick={() => unequip(id)}>
                    {strings.talismans.unequip}
                  </button>
                ) : slots > 0 && equipped.length < slots ? (
                  <button className="talent-unlock-button" onClick={() => equip(id)}>
                    {strings.talismans.equip}
                  </button>
                ) : (
                  <span className="talisman-status">
                    {slots === 0
                      ? strings.talismans.lockedHint.replace('{level}', String(firstSlotLevel))
                      : strings.talismans.slotsLabel
                          .replace('{used}', String(equipped.length))
                          .replace('{slots}', String(slots))}
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export function TalentPanel() {
  const xp = useGameStore((s) => s.xp);
  const unlocked = useGameStore((s) => s.unlockedTalents);
  const inCombat = useGameStore((s) => s.combat !== null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.repeat) return;
      if (event.key === 't' || event.key === 'T') setOpen((prev) => !prev);
      if (event.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  if (inCombat) return null;
  const level = levelOf({ xp });
  const points = availableTalentPoints(level, unlocked);

  return (
    <>
      <div className="talent-hint">{strings.talents.toggleHint}</div>
      {open && (
        <section className="talent-panel" aria-label={strings.talents.panelTitle}>
          <header className="workshop-header">
            <h2 className="workshop-title">{strings.talents.panelTitle}</h2>
            <button className="workshop-close" onClick={() => setOpen(false)}>
              {strings.workshop.close}
            </button>
          </header>
          <p className="talent-points">
            {strings.talents.pointsAvailable.replace('{points}', String(points))}
          </p>
          <div className="talent-branches">
            {talentBranches.map((branch) => (
              <div key={branch} className="talent-branch">
                <h3>{strings.talents.branches[branch]}</h3>
                <ul className="talent-list">
                  {talents
                    .filter((t) => t.branch === branch)
                    .map((talent) => (
                      <TalentCell
                        key={talent.id}
                        talent={talent}
                        unlocked={unlocked}
                        level={level}
                      />
                    ))}
                </ul>
              </div>
            ))}
          </div>
          <TalismanSection level={level} />
        </section>
      )}
    </>
  );
}
