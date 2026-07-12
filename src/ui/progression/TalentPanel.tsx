import { useEffect, useState } from 'react';
import {
  availableTalentPoints,
  canUnlockTalent,
} from '../../core/progression/progression';
import { talentBranches, talents, type TalentDef } from '../../data/talents';
import { strings } from '../../shared/strings';
import { levelOf, useGameStore } from '../../shared/store';

/**
 * Talent tree overlay (M4, docs/02): 3 branches × 3 tiers, toggled with T.
 * Locked/unlocked state is always shown as TEXT, never only via color
 * (docs/11). All rules live in core/progression; this is a render layer.
 */
function TalentCell({ talent, unlocked, level }: {
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
        </section>
      )}
    </>
  );
}
