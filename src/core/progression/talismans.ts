/**
 * Talismans (docs/02 Meilenstein Lv 8, docs/07 Beutetabelle "Dornenring"):
 * passive relics with a DATA effect descriptor — adding a talisman is a pure
 * data change in src/data/talismans.ts as long as its descriptor kind exists.
 *
 * M4 descriptor set (closed, like the combat effect DSL):
 * - 'combatStartStatus': the player starts every combat with the given
 *   status stacks (Dornenring → Vergeltung 1). Interpreted here into
 *   CombatSetup.playerStartStatuses; the combat core stays talisman-agnostic.
 *
 * Later talismans (docs/09 Amboss-Herz, Seemannsgarn) need a modifier layer
 * and are deliberately NOT modeled in M4 — new kinds require an extension
 * here plus unit tests plus a doc note (CLAUDE.md rule 4 analog).
 */
import type { StatusId, StatusMap } from '../combat/types';

export type TalismanEffect = { kind: 'combatStartStatus'; status: StatusId; amount: number };

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
    if (!def) continue;
    const { status, amount } = def.effect;
    statuses[status] = (statuses[status] ?? 0) + amount;
  }
  return statuses;
}
