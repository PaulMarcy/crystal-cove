/**
 * Encounter tables Heimatbucht (Tier 1) — docs/07 "Begegnungstabelle
 * Heimatbucht" is the source of truth; density rules and elite affixes
 * come from docs/02 (Schattendichte).
 *
 * Assumptions (docs leave these open; flagged, not silently doc-changed):
 * - docs/07 lists encounter options per column without weights → all
 *   options in a bracket are equally weighted (weight 1).
 * - Affix "Dornig" has no number in docs/02 → Vergeltung 2, analogous to
 *   Dornenkriecher (docs/07). "Gepanzert" = 10 Start-Block and "Zehrend" =
 *   1 Erschöpfung in die Spieler-Ablage are quantified in docs/02.
 */
import type { ZoneId } from '../../core/world/zones';
import type { ShadowDensity, ZoneEncounterTable } from '../../core/world/encounters';
import { strings } from '../../shared/strings';

// ── Shadow density (docs/02) ─────────────────────────────────────────────

/** Density starts at 0 ("Grundwerte") and rises with exploration progress. */
export const initialShadowDensity: ShadowDensity = 0;

/** Exploration progress (fraction) at which density rises to 1 / 2 / 3. */
export const densityThresholds = [0.25, 0.5, 0.75] as const;

/** Enemies get +10 % HP & damage per density level, multiplicative on top. */
export const densityHpAndDamagePerLevel = 0.1;

// ── Elite affixes (docs/02, density >= 2) ────────────────────────────────

export type EliteAffixId = 'armored' | 'thorned' | 'draining';

export interface EliteAffixDef {
  id: EliteAffixId;
  name: string;
  /** Gepanzert: extra starting block. */
  startBlock?: number;
  /** Dornig: Vergeltung stacks (whole combat). ASSUMPTION: 2, see header. */
  retaliate?: number;
  /** Zehrend: Erschöpfung cards shuffled into the player's discard pile. */
  exhaustionCards?: number;
}

export const eliteAffixes: Record<EliteAffixId, EliteAffixDef> = {
  armored: { id: 'armored', name: strings.affixes.armored.name, startBlock: 10 },
  thorned: { id: 'thorned', name: strings.affixes.thorned.name, retaliate: 2 },
  draining: { id: 'draining', name: strings.affixes.draining.name, exhaustionCards: 1 },
};

export const eliteAffixIds = Object.keys(eliteAffixes) as readonly EliteAffixId[];

// ── Encounter tables (docs/07) ───────────────────────────────────────────

const elite = {
  eliteEnemies: ['thorn_terror'],
  eliteAffixes: eliteAffixIds,
} as const;

export const encounterTables: Record<ZoneId, ZoneEncounterTable> = {
  strand: {
    ...elite,
    brackets: [
      {
        options: [
          { enemies: ['shadow_rat'], weight: 1 },
          { enemies: ['shadow_gull'], weight: 1 },
          { enemies: ['shadow_rat', 'shadow_rat'], weight: 1 },
        ],
        eliteChance: 0,
      },
      {
        options: [
          { enemies: ['shadow_gull', 'shadow_rat'], weight: 1 },
          { enemies: ['copper_beetle'], weight: 1 },
        ],
        eliteChance: 0,
      },
      {
        options: [{ enemies: ['shadow_gull', 'shadow_gull', 'shadow_rat'], weight: 1 }],
        eliteChance: 0,
      },
    ],
  },
  wiese: {
    ...elite,
    brackets: [
      {
        options: [
          { enemies: ['blighted_boar'], weight: 1 },
          { enemies: ['shadow_rat', 'shadow_rat'], weight: 1 },
        ],
        eliteChance: 0,
      },
      {
        // Möwe+Wildschwein: Kill-Order-Lektion (docs/07)
        options: [{ enemies: ['shadow_gull', 'blighted_boar'], weight: 1 }],
        eliteChance: 0.15,
      },
      {
        options: [{ enemies: ['blighted_boar', 'blighted_boar'], weight: 1 }],
        eliteChance: 0.3,
      },
    ],
  },
  waldrand: {
    ...elite,
    brackets: [
      {
        options: [
          { enemies: ['thorn_creeper'], weight: 1 },
          { enemies: ['thorn_creeper', 'shadow_rat'], weight: 1 },
        ],
        eliteChance: 0,
      },
      {
        options: [{ enemies: ['thorn_creeper', 'copper_beetle'], weight: 1 }],
        eliteChance: 0.2,
      },
      {
        options: [{ enemies: ['thorn_creeper', 'thorn_creeper', 'shadow_gull'], weight: 1 }],
        eliteChance: 0.35,
      },
    ],
  },
};
