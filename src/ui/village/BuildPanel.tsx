import { useEffect } from 'react';
import { canBuild, type BuildBlocker } from '../../core/village/buildings';
import { buildingsBySlot, type BuildRequirement } from '../../data/buildings';
import { strings } from '../../shared/strings';
import { buildContextOf, useGameStore } from '../../shared/store';

const itemNames = strings.items as Readonly<Record<string, string>>;
const npcNames = strings.npcs as Readonly<Record<string, string>>;

function npcName(id: string): string {
  return npcNames[id] ?? id;
}

/** Human-readable requirement text (docs/09 Voraussetzung column). */
function requirementLabel(requirement: BuildRequirement): string {
  switch (requirement.kind) {
    case 'flag':
      return strings.build.requirements[requirement.flag];
    case 'npcRescued':
      return strings.build.requirements.npcRescued.replace('{npc}', npcName(requirement.npc));
    case 'friendship':
      return strings.build.requirements.friendship
        .replace('{npc}', npcName(requirement.npc))
        .replace('{level}', String(requirement.level));
  }
}

function isRequirementMissing(missing: readonly BuildBlocker[], req: BuildRequirement): boolean {
  return missing.some((m) => m.kind === 'requirement' && m.requirement === req);
}

/**
 * Build overlay (M5 Task 1, docs/09): shows the slot's current stage, the
 * next stage's costs and prerequisites — missing entries carry a TEXT
 * marker, never color alone (docs/11). Blocked builds stay fully visible
 * with their reason (sichtbar-verwehrtes-Ziel-Muster, docs/12).
 * Pure render layer — build rules live in core/village, dispatched through
 * the store.
 */
export function BuildPanel() {
  const activeBuildSlot = useGameStore((s) => s.activeBuildSlot);
  const closeBuildSlot = useGameStore((s) => s.closeBuildSlot);
  const buildBuilding = useGameStore((s) => s.buildBuilding);
  const builtBuildings = useGameStore((s) => s.builtBuildings);
  const inventory = useGameStore((s) => s.inventory);
  const storyFlags = useGameStore((s) => s.storyFlags);
  const rescuedNpcs = useGameStore((s) => s.rescuedNpcs);
  const friendshipLevels = useGameStore((s) => s.friendshipLevels);
  const completedDungeons = useGameStore((s) => s.completedDungeons);

  useEffect(() => {
    if (!activeBuildSlot) return undefined;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeBuildSlot();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [activeBuildSlot, closeBuildSlot]);

  if (!activeBuildSlot) return null;
  const def = buildingsBySlot[activeBuildSlot];
  const slotStrings = strings.buildings[activeBuildSlot];
  const stage = builtBuildings[activeBuildSlot] ?? 0;
  const maxStage = def.stages.length;
  const atMax = stage >= maxStage;
  const ctx = buildContextOf({
    inventory,
    storyFlags,
    rescuedNpcs,
    friendshipLevels,
    completedDungeons,
  });
  const check = canBuild(def, stage, ctx);
  const nextStage = atMax ? null : def.stages[stage];
  const costEntries = nextStage ? Object.entries(nextStage.costs) : [];

  return (
    <section className="build-panel workshop-panel" aria-label={strings.build.panelTitle}>
      <header className="workshop-header">
        <h2 className="workshop-title">
          {strings.build.panelTitle}: {slotStrings.name}
        </h2>
        <button className="workshop-close" onClick={closeBuildSlot}>
          {strings.workshop.close}
        </button>
      </header>
      {/* Current state: stage x/max plus the stage name — always as text. */}
      <p className="build-stage">
        {stage > 0
          ? `${strings.build.stageLabel
              .replace('{stage}', String(stage))
              .replace('{max}', String(maxStage))} — ${slotStrings.stages[stage - 1] ?? ''}`
          : strings.build.notBuilt}
      </p>
      <p className="build-effect">{strings.buildingEffects[activeBuildSlot]}</p>
      {atMax ? (
        <p className="build-max">{strings.build.maxStage}</p>
      ) : (
        <>
          <h3 className="build-next-heading">
            {strings.build.nextStageHeading.replace('{name}', slotStrings.stages[stage] ?? '')}
          </h3>
          {nextStage && nextStage.requirements.length > 0 && (
            <>
              <h4 className="build-subheading">{strings.build.requirementsHeading}</h4>
              <ul className="build-requirements">
                {nextStage.requirements.map((req, i) => {
                  const missing = isRequirementMissing(check.missing, req);
                  return (
                    <li
                      key={i}
                      className={`build-requirement${missing ? ' build-requirement--missing' : ''}`}
                    >
                      {requirementLabel(req)}{' '}
                      {/* Text marker so state is never color-only (docs/11). */}
                      <span className="build-requirement-state">
                        ({missing ? strings.build.requirementMissing : strings.build.requirementMet}
                        )
                      </span>
                    </li>
                  );
                })}
              </ul>
            </>
          )}
          <h4 className="build-subheading">{strings.build.costsHeading}</h4>
          {costEntries.length === 0 ? (
            <p className="build-no-costs">{strings.build.noCosts}</p>
          ) : (
            <ul className="build-costs">
              {costEntries.map(([resource, need]) => {
                const have = inventory[resource] ?? 0;
                const short = have < (need ?? 0);
                return (
                  <li
                    key={resource}
                    className={`build-cost${short ? ' build-cost--missing' : ''}`}
                  >
                    {itemNames[resource] ?? resource} {Math.min(have, need ?? 0)}/{need}
                    {/* Text marker so missing material is never color-only. */}
                    {short && (
                      <span className="build-missing-tag">
                        {' '}
                        ({strings.workshop.missingMaterial})
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
          <button
            className="build-button workshop-craft-button"
            disabled={!check.allowed}
            onClick={() => buildBuilding(activeBuildSlot)}
          >
            {strings.build.buildButton}
          </button>
        </>
      )}
    </section>
  );
}
