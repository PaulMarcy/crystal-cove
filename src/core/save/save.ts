/**
 * Save codec — pure, engine-free (CLAUDE.md rule 1): versioned envelope,
 * checksum, schema validation and a migration scaffold starting at V1.
 * Storage access lives in ./storage behind an injectable interface;
 * this module never touches the DOM.
 *
 * Envelope format (docs/05 "Spielstand"):
 *   { "v": <int>, "checksum": "<fnv1a-hex of payload JSON>", "payload": {...} }
 *
 * V1 payload persists the M2 state: inventory, harvested nodes, shadow
 * density, player position/zone (collection/toolTier appeared as optional
 * late-V1 fields). V2 (M3 Deck-Truhe) makes collection/toolTier required
 * and adds the assembled combat deck.
 */

import { starterDeckIds } from '../../data/cards/tier1';
import { combatConfig } from '../../data/combat';
import { isCropId } from '../../data/farming';
import type { FarmPlots } from '../economy/farming';
import type { Inventory } from '../economy/inventory';
import type { ShadowDensity } from '../world/encounters';
import { isZoneId, type ZoneId } from '../world/zones';

export const SAVE_VERSION = 2;

export interface SaveDataV1 {
  inventory: Inventory;
  harvestedNodeIds: readonly string[];
  shadowDensity: ShadowDensity;
  playerPosition: { x: number; y: number } | null;
  playerZone: ZoneId | null;
  /**
   * M3 additive fields — OPTIONAL on purpose: pre-M3 saves lack them, and
   * additive-optional fields need no version bump (the bump to V2 comes with
   * the Deck-Truhe task, docs/12). Absent = starter defaults.
   */
  /** Crafted card ids (duplicates allowed — the collection is a multiset). */
  collection?: readonly string[];
  /** Equipped tool tier (docs/10 Werkzeugstufen), default baseToolTier. */
  toolTier?: number;
}

/** V2 (M3 Deck-Truhe): assembled combat deck + required collection/toolTier. */
export interface SaveDataV2 extends Omit<SaveDataV1, 'collection' | 'toolTier'> {
  collection: readonly string[];
  toolTier: number;
  /** Assembled combat deck as card ids (rules in core/deck, size in data/deck). */
  deck: readonly string[];
  /**
   * M3 dish consumption — additive-OPTIONAL late-V2 field (no version bump
   * needed: absent = [] on older V2 saves). Consumed-but-not-recooked
   * STARTER dish markers (core/deck/consumption).
   */
  consumedStarterDishes?: readonly string[];
  /**
   * M3 farming — additive-OPTIONAL late-V2 fields (no version bump needed:
   * absent = nothing planted / zero sleeps on older V2 saves).
   */
  farmPlots?: FarmPlots;
  /** Completed sleep cycles (tent/bed) — drives crop growth (docs/10). */
  sleepCount?: number;
  /**
   * M4 progression — additive-OPTIONAL late-V2 fields (no version bump
   * needed, same pattern as consumedStarterDishes: absent = level 1, no
   * talents on older saves).
   */
  /** Total XP ever earned (level is derived, core/progression). */
  xp?: number;
  /** Unlocked talent ids (docs/02 Talentbaum). */
  unlockedTalents?: readonly string[];
}

/** Current save shape — alias moves forward with each new version. */
export type SaveData = SaveDataV2;

export type SaveError =
  'corrupt_json' | 'invalid_envelope' | 'checksum_mismatch' | 'unknown_version' | 'invalid_payload';

export type DeserializeResult = { ok: true; data: SaveData } | { ok: false; error: SaveError };

/** FNV-1a 32-bit — cheap corruption detector, not a security feature. */
export function checksum(text: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

export function serialize(data: SaveData): string {
  const payload = JSON.stringify(data);
  return JSON.stringify({ v: SAVE_VERSION, checksum: checksum(payload), payload });
}

/**
 * Migration scaffold: index = source version, entry migrates to version + 1.
 * Add the next migration here when bumping SAVE_VERSION (docs/12: version
 * bump on every format change).
 */
const migrations: Record<number, (payload: unknown) => unknown> = {
  // V1 → V2 (M3 Deck-Truhe): old saves get the starter deck; the optional
  // late-V1 fields collection/toolTier become required with their defaults.
  1: (payload) => {
    const old = payload as Partial<SaveDataV1>;
    return {
      ...old,
      collection: old.collection ?? [],
      toolTier: old.toolTier ?? combatConfig.baseToolTier,
      deck: [...starterDeckIds],
    };
  },
};

export function deserialize(raw: string): DeserializeResult {
  let envelope: unknown;
  try {
    envelope = JSON.parse(raw);
  } catch {
    return { ok: false, error: 'corrupt_json' };
  }
  if (
    typeof envelope !== 'object' ||
    envelope === null ||
    typeof (envelope as { v?: unknown }).v !== 'number' ||
    typeof (envelope as { checksum?: unknown }).checksum !== 'string' ||
    typeof (envelope as { payload?: unknown }).payload !== 'string'
  ) {
    return { ok: false, error: 'invalid_envelope' };
  }
  const {
    v,
    checksum: sum,
    payload,
  } = envelope as { v: number; checksum: string; payload: string };
  if (checksum(payload) !== sum) return { ok: false, error: 'checksum_mismatch' };
  if (!Number.isInteger(v) || v < 1 || v > SAVE_VERSION) {
    // Saves from a NEWER build (or nonsense versions) are never guessed at.
    return { ok: false, error: 'unknown_version' };
  }
  let data: unknown;
  try {
    data = JSON.parse(payload);
  } catch {
    return { ok: false, error: 'corrupt_json' };
  }
  for (let from = v; from < SAVE_VERSION; from++) {
    const migrate = migrations[from];
    if (!migrate) return { ok: false, error: 'unknown_version' };
    data = migrate(data);
  }
  if (!isValidSaveData(data)) return { ok: false, error: 'invalid_payload' };
  return { ok: true, data };
}

function isValidSaveData(value: unknown): value is SaveData {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  if (typeof v.inventory !== 'object' || v.inventory === null) return false;
  if (!Object.values(v.inventory).every((n) => Number.isInteger(n) && (n as number) > 0)) {
    return false;
  }
  if (!Array.isArray(v.harvestedNodeIds)) return false;
  if (!v.harvestedNodeIds.every((id) => typeof id === 'string')) return false;
  if (![0, 1, 2, 3].includes(v.shadowDensity as number)) return false;
  if (v.playerPosition !== null) {
    if (typeof v.playerPosition !== 'object' || v.playerPosition === null) return false;
    const pos = v.playerPosition as Record<string, unknown>;
    if (!Number.isFinite(pos.x) || !Number.isFinite(pos.y)) return false;
  }
  if (v.playerZone !== null && (typeof v.playerZone !== 'string' || !isZoneId(v.playerZone))) {
    return false;
  }
  if (!Array.isArray(v.collection)) return false;
  if (!v.collection.every((id) => typeof id === 'string')) return false;
  if (!Number.isInteger(v.toolTier) || (v.toolTier as number) < 1) return false;
  if (!Array.isArray(v.deck)) return false;
  if (!v.deck.every((id) => typeof id === 'string')) return false;
  if (v.consumedStarterDishes !== undefined) {
    if (!Array.isArray(v.consumedStarterDishes)) return false;
    if (!v.consumedStarterDishes.every((id) => typeof id === 'string')) return false;
  }
  if (v.farmPlots !== undefined) {
    if (typeof v.farmPlots !== 'object' || v.farmPlots === null || Array.isArray(v.farmPlots)) {
      return false;
    }
    for (const plot of Object.values(v.farmPlots)) {
      if (typeof plot !== 'object' || plot === null) return false;
      const p = plot as Record<string, unknown>;
      if (!isCropId(p.crop)) return false;
      if (!Number.isInteger(p.sleeps) || (p.sleeps as number) < 0) return false;
    }
  }
  if (v.sleepCount !== undefined) {
    if (!Number.isInteger(v.sleepCount) || (v.sleepCount as number) < 0) return false;
  }
  if (v.xp !== undefined) {
    if (!Number.isInteger(v.xp) || (v.xp as number) < 0) return false;
  }
  if (v.unlockedTalents !== undefined) {
    if (!Array.isArray(v.unlockedTalents)) return false;
    if (!v.unlockedTalents.every((id) => typeof id === 'string')) return false;
  }
  return true;
}
