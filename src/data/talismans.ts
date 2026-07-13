/**
 * Talisman definitions (docs/02 Lv-8-Meilenstein, docs/07 Beutetabelle).
 * Pure data: each talisman is an effect DESCRIPTOR interpreted by
 * core/progression/talismans — adding a talisman with an existing descriptor
 * kind is a data-only change.
 *
 * Talisman ids double as loot ITEM ids (docs/07: Dornenschreck drops
 * 'thorn_ring' with 25 % chance) — the store converts a dropped talisman
 * item into talisman ownership instead of an inventory item.
 *
 * Amboss-Herz / Seemannsgarn (docs/09) are M5: they need a modifier layer
 * (auditor finding) and are intentionally absent here.
 */
import type { TalismanDef } from '../core/progression/talismans';
import { strings } from '../shared/strings';

export const thornRing: TalismanDef = {
  id: 'thorn_ring',
  name: strings.talismans.thorn_ring.name,
  description: strings.talismans.thorn_ring.description,
  // docs/07: „Spieler erhält Vergeltung 1 dauerhaft im Kampf" — retaliate
  // never decays (combat core), so a start status IS permanent in combat.
  effect: { kind: 'combatStartStatus', status: 'retaliate', amount: 1 },
};

export const allTalismans: readonly TalismanDef[] = [thornRing];

export const talismansById: Readonly<Record<string, TalismanDef>> = Object.fromEntries(
  allTalismans.map((t) => [t.id, t]),
);
