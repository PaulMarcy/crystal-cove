/**
 * Talismans (docs/02 Meilenstein Lv 8, docs/07 Beutetabelle "Dornenring"):
 * passive relics with a DATA effect descriptor — adding a talisman is a pure
 * data change in src/data/talismans.ts as long as its descriptor kind exists.
 *
 * Descriptor set (closed, like the combat effect DSL; M4 + M5/docs/09):
 * - 'combatStartStatus': the player starts every combat with the given
 *   status stacks (Dornenring → Vergeltung 1). Interpreted here into
 *   CombatSetup.playerStartStatuses; the combat core stays talisman-agnostic.
 * - 'combatStartHeal': heal N at combat start, capped at max HP
 *   (Warmer Bauch → 3). → CombatSetup.combatStartHeal (amounts stack).
 * - 'defenseCardBlockBonus': +N block whenever a defense card is played
 *   (Amboss-Herz → 1). → CombatSetup.defenseCardBlockBonus (amounts stack).
 * - 'firstDefenseCardFree': the first defense card each combat costs 0
 *   (Seemannsgarn). → CombatSetup.firstDefenseCardFree (boolean, no stacking).
 *
 * "Defense card" is defined by the combat core (isDefenseCard in
 * core/combat/effects.ts): a card with a 'block' effect on the player.
 * New descriptor kinds require an extension here plus unit tests plus a
 * doc note (CLAUDE.md rule 4 analog).
 */
import type { StatusId, StatusMap } from '../combat/types';

export type TalismanEffect =
  | { kind: 'combatStartStatus'; status: StatusId; amount: number }
  | { kind: 'combatStartHeal'; amount: number }
  | { kind: 'defenseCardBlockBonus'; amount: number }
  | { kind: 'firstDefenseCardFree' };

export interface TalismanDef {
  id: string;
  name: string;
  description: string;
  effect: TalismanEffect;
}

/**
 * Equips an owned talisman: returns the new equipped list, or null when the
 * talisman is unknown/not owned, already equipped, or all slots are taken.
 */
export function equipTalisman(
  equipped: readonly string[],
  owned: readonly string[],
  talismanId: string,
  slots: number,
  defs: Readonly<Record<string, TalismanDef>>,
): readonly string[] | null {
  if (!defs[talismanId]) return null;
  if (!owned.includes(talismanId)) return null;
  if (equipped.includes(talismanId)) return null;
  if (equipped.length >= slots) return null;
  return [...equipped, talismanId];
}

/** Unequips a talisman; null when it is not equipped. */
export function unequipTalisman(
  equipped: readonly string[],
  talismanId: string,
): readonly string[] | null {
  if (!equipped.includes(talismanId)) return null;
  return equipped.filter((id) => id !== talismanId);
}

/**
 * Player start statuses from the equipped talismans ('combatStartStatus'
 * descriptors, stacks of the same status add up). Unknown ids (stale save
 * entries) are ignored. Feeds CombatSetup.playerStartStatuses.
 */
export function combatStartStatuses(
  equipped: readonly string[],
  defs: Readonly<Record<string, TalismanDef>>,
): StatusMap {
  const statuses: StatusMap = {};
  for (const id of equipped) {
    const def = defs[id];
    if (!def || def.effect.kind !== 'combatStartStatus') continue;
    const { status, amount } = def.effect;
    statuses[status] = (statuses[status] ?? 0) + amount;
  }
  return statuses;
}

/** Combat modifiers from talisman descriptors, fed into CombatSetup. */
export interface TalismanCombatModifiers {
  /** Sum of 'combatStartHeal' amounts (Warmer Bauch). */
  combatStartHeal: number;
  /** Sum of 'defenseCardBlockBonus' amounts (Amboss-Herz). */
  defenseCardBlockBonus: number;
  /** True when any equipped talisman has 'firstDefenseCardFree' (Seemannsgarn). */
  firstDefenseCardFree: boolean;
}

/**
 * Aggregates the non-status combat descriptors of the equipped talismans.
 * Amount kinds stack across talismans; 'firstDefenseCardFree' is a flag
 * (equipping it twice would still free only one card). Unknown ids (stale
 * save entries) are ignored, mirroring combatStartStatuses.
 */
export function talismanCombatModifiers(
  equipped: readonly string[],
  defs: Readonly<Record<string, TalismanDef>>,
): TalismanCombatModifiers {
  const mods: TalismanCombatModifiers = {
    combatStartHeal: 0,
    defenseCardBlockBonus: 0,
    firstDefenseCardFree: false,
  };
  for (const id of equipped) {
    const effect = defs[id]?.effect;
    if (!effect) continue;
    switch (effect.kind) {
      case 'combatStartHeal':
        mods.combatStartHeal += effect.amount;
        break;
      case 'defenseCardBlockBonus':
        mods.defenseCardBlockBonus += effect.amount;
        break;
      case 'firstDefenseCardFree':
        mods.firstDefenseCardFree = true;
        break;
      case 'combatStartStatus':
        break;
    }
  }
  return mods;
}
