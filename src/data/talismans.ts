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
 * The M5 NPC-chain talismans (docs/09 St.-3-Belohnungen) are DEFINED here;
 * ownership is granted by the quest reward wiring (M5 Task 3), not by loot.
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

export const warmBelly: TalismanDef = {
  id: 'warm_belly',
  name: strings.talismans.warm_belly.name,
  description: strings.talismans.warm_belly.description,
  // docs/09 Tilda St. 3: „Kampfstart: heile 3" — capped at max HP.
  effect: { kind: 'combatStartHeal', amount: 3 },
};

export const anvilHeart: TalismanDef = {
  id: 'anvil_heart',
  name: strings.talismans.anvil_heart.name,
  description: strings.talismans.anvil_heart.description,
  // docs/09 Maro St. 3: „+1 Block auf jede Verteidigungskarte" (per card).
  effect: { kind: 'defenseCardBlockBonus', amount: 1 },
};

export const sailorsYarn: TalismanDef = {
  id: 'sailors_yarn',
  name: strings.talismans.sailors_yarn.name,
  description: strings.talismans.sailors_yarn.description,
  // docs/09 Bruna St. 3: „erste Verteidigungskarte je Kampf kostet 0".
  effect: { kind: 'firstDefenseCardFree' },
};

export const allTalismans: readonly TalismanDef[] = [thornRing, warmBelly, anvilHeart, sailorsYarn];

export const talismansById: Readonly<Record<string, TalismanDef>> = Object.fromEntries(
  allTalismans.map((t) => [t.id, t]),
);
