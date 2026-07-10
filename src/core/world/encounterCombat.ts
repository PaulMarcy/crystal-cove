/**
 * Encounter → CombatSetup wiring (M2) — pure, engine-free (CLAUDE.md rule 1).
 * Turns an EncounterResult (core/world/encounters) into a CombatSetup for the
 * combat core:
 *
 * 1. Resolve enemy ids against the roster (src/data/enemies).
 * 2. Density scaling: +10 % HP & damage per density level (constant in
 *    src/data/encounters), multiplicative, rounded to whole numbers.
 * 3. Elite affixes (docs/02, density >= 2), all via existing mechanics:
 *    - armored  → extra start block (EnemyDef.startBlock)
 *    - thorned  → retaliate status at combat start (EnemyDef.startStatuses)
 *    - draining → Erschöpfung cards in the player's discard pile
 *                 (CombatSetup.startDiscard)
 *
 * Balancing values stay in src/data; this module only applies them.
 * (core → data imports follow the established pattern of combat/reducer.ts.)
 */
import type { CardDef, Effect, EffectAmount, EnemyDef } from '../combat/types';
import type { CombatSetup } from '../combat/types';
import {
  densityHpAndDamagePerLevel,
  eliteAffixes,
  type EliteAffixId,
} from '../../data/encounters/tier1';
import { enemiesById } from '../../data/enemies/tier1';
import { exhaustion } from '../../data/cards/tier1';
import type { EncounterResult, ShadowDensity } from './encounters';

/** Multiplier for HP and damage at the given density (density 0 → 1). */
export function densityMultiplier(density: ShadowDensity): number {
  return 1 + density * densityHpAndDamagePerLevel;
}

function scaleAmount(amount: EffectAmount, factor: number): EffectAmount {
  if (typeof amount === 'number') return Math.round(amount * factor);
  return { ...amount, base: Math.round(amount.base * factor) };
}

function scaleEffects(effects: Effect[], factor: number): Effect[] {
  return effects.map((effect) =>
    effect.kind === 'damage' ? { ...effect, amount: scaleAmount(effect.amount, factor) } : effect,
  );
}

/**
 * Returns a copy of the enemy definition with HP and damage scaled for the
 * shadow density (+10 % per level, docs/02). Only 'damage' effect amounts are
 * scaled — block/status values are unchanged by density per docs.
 */
export function scaleEnemyForDensity(def: EnemyDef, density: ShadowDensity): EnemyDef {
  const factor = densityMultiplier(density);
  if (factor === 1) return def;
  const pattern =
    def.pattern.kind === 'cycle'
      ? {
          kind: 'cycle' as const,
          steps: def.pattern.steps.map((s) => ({ ...s, effects: scaleEffects(s.effects, factor) })),
        }
      : {
          kind: 'phased' as const,
          phases: def.pattern.phases.map((phase) => ({
            ...phase,
            steps: phase.steps.map((s) => ({ ...s, effects: scaleEffects(s.effects, factor) })),
          })),
        };
  return { ...def, hp: Math.round(def.hp * factor), pattern };
}

interface AffixApplication {
  enemies: EnemyDef[];
  startDiscard: CardDef[];
}

/**
 * Applies one elite affix (docs/02) to the encounter's enemies. Unknown affix
 * ids are ignored (data tables own the pool; core stays forgiving).
 */
function applyEliteAffix(enemies: EnemyDef[], affixId: string): AffixApplication {
  const affix = eliteAffixes[affixId as EliteAffixId] as
    (typeof eliteAffixes)[EliteAffixId] | undefined;
  if (!affix) return { enemies, startDiscard: [] };

  const applied = enemies.map((def) => {
    let next = def;
    if (affix.startBlock !== undefined) {
      next = { ...next, startBlock: (next.startBlock ?? 0) + affix.startBlock };
    }
    if (affix.retaliate !== undefined) {
      next = {
        ...next,
        startStatuses: {
          ...next.startStatuses,
          retaliate: (next.startStatuses?.retaliate ?? 0) + affix.retaliate,
        },
      };
    }
    return next;
  });

  const startDiscard: CardDef[] =
    affix.exhaustionCards !== undefined
      ? Array.from({ length: affix.exhaustionCards }, () => exhaustion)
      : [];

  return { enemies: applied, startDiscard };
}

export interface EncounterCombatOptions {
  playerHp: number;
  playerMaxHp?: number;
  deck: readonly CardDef[];
}

/**
 * Builds the CombatSetup for a rolled encounter: id resolution → density
 * scaling → elite affix. Throws on unknown enemy ids (data error, fail loud).
 */
export function buildEncounterCombatSetup(
  encounter: EncounterResult,
  density: ShadowDensity,
  options: EncounterCombatOptions,
): CombatSetup {
  let enemies = encounter.enemies.map((id) => {
    const def = enemiesById[id];
    if (!def) throw new Error(`buildEncounterCombatSetup: unknown enemy id "${id}"`);
    return scaleEnemyForDensity(def, density);
  });

  let startDiscard: CardDef[] = [];
  if (encounter.elite && encounter.affix !== null) {
    const result = applyEliteAffix(enemies, encounter.affix);
    enemies = result.enemies;
    startDiscard = result.startDiscard;
  }

  return {
    playerHp: options.playerHp,
    ...(options.playerMaxHp !== undefined ? { playerMaxHp: options.playerMaxHp } : {}),
    deck: [...options.deck],
    enemies,
    ...(startDiscard.length > 0 ? { startDiscard } : {}),
  };
}
