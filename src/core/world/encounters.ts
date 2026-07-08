/**
 * Encounter selection — pure, engine-free logic (CLAUDE.md rule 1).
 * Rolls an encounter from a data-driven zone table (src/data/encounters)
 * given the shadow density and an injected RNG (same contract as the
 * combat core, see core/combat/rng.ts). All balancing lives in src/data.
 *
 * Rules implemented (docs/02 + docs/07):
 * - Density 0–3; the encounter table has one bracket per column of the
 *   docs/07 table (0–1, 2, 3).
 * - Elites only appear at density >= 2 (docs/02). This is enforced here
 *   in addition to the data (density-0/1 brackets carry eliteChance 0).
 * - An elite spawned at density >= 2 always gets exactly 1 random affix
 *   (docs/07: "Ab Dichte 2: +1 zufälliges Affix").
 */
import type { Rng } from '../combat/rng';

export type ShadowDensity = 0 | 1 | 2 | 3;

/** One weighted normal-encounter option (list of enemy ids, spawn order). */
export interface EncounterOption {
  enemies: readonly string[];
  weight: number;
}

/** Table column for one density bracket. */
export interface EncounterBracket {
  options: readonly EncounterOption[];
  /** Probability that the encounter is the zone's elite instead. */
  eliteChance: number;
}

export interface ZoneEncounterTable {
  /** Brackets for density 0–1, 2, 3 (docs/07 table columns). */
  brackets: readonly [EncounterBracket, EncounterBracket, EncounterBracket];
  /** Elite group used when the elite roll succeeds. */
  eliteEnemies: readonly string[];
  /** Affix pool the elite draws exactly one entry from. */
  eliteAffixes: readonly string[];
}

export interface EncounterResult {
  enemies: readonly string[];
  elite: boolean;
  /** Affix id (from the table's pool); null for non-elite encounters. */
  affix: string | null;
}

/** Maps density 0|1 → bracket 0, 2 → 1, 3 → 2 (docs/07 columns). */
export function densityBracketIndex(density: ShadowDensity): 0 | 1 | 2 {
  return density <= 1 ? 0 : density === 2 ? 1 : 2;
}

function pickWeighted(options: readonly EncounterOption[], rng: Rng): EncounterOption {
  const total = options.reduce((sum, o) => sum + o.weight, 0);
  let roll = rng() * total;
  for (const option of options) {
    roll -= option.weight;
    if (roll < 0) return option;
  }
  return options[options.length - 1]!;
}

/**
 * Rolls one encounter. Deterministic for a given (table, density, rng seed).
 * RNG consumption order: elite roll (only at density >= 2 with a positive
 * chance) → affix pick (elite only) or weighted option pick.
 */
export function rollEncounter(
  table: ZoneEncounterTable,
  density: ShadowDensity,
  rng: Rng,
): EncounterResult {
  const bracket = table.brackets[densityBracketIndex(density)];

  if (density >= 2 && bracket.eliteChance > 0 && rng() < bracket.eliteChance) {
    const affix = table.eliteAffixes[Math.floor(rng() * table.eliteAffixes.length)] ?? null;
    return { enemies: table.eliteEnemies, elite: true, affix };
  }

  return { enemies: pickWeighted(bracket.options, rng).enemies, elite: false, affix: null };
}
