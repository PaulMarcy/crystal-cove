/**
 * Save slots — double-write strategy on an injectable key/value storage
 * (localStorage in the app, an in-memory map in tests; no DOM in core).
 *
 * Write: the previous primary rotates into the backup slot, then the new
 * save is written to primary. The backup therefore always holds the last
 * save that survived a full write.
 *
 * Load: primary first; if it is missing or fails ANY deserialize check
 * (JSON, envelope, checksum, version, schema) the backup is tried and a
 * recovery is reported. If both fail, the caller starts a fresh game.
 */

import { deserialize, serialize, type SaveData, type SaveError } from './save';

/** Minimal storage contract — structurally compatible with localStorage. */
export interface SaveStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export const PRIMARY_KEY = 'crystal-cove.save';
export const BACKUP_KEY = 'crystal-cove.save.backup';

export type LoadSource = 'primary' | 'backup' | 'none';

export interface LoadResult {
  data: SaveData | null;
  source: LoadSource;
  /** True when the primary slot was corrupt and the backup restored the game. */
  recovered: boolean;
  /** Why the primary slot was rejected (unset when primary loaded fine or was empty). */
  primaryError?: SaveError | undefined;
}

export function saveGame(storage: SaveStorage, data: SaveData): void {
  const previous = storage.getItem(PRIMARY_KEY);
  if (previous !== null) storage.setItem(BACKUP_KEY, previous);
  storage.setItem(PRIMARY_KEY, serialize(data));
}

export function loadGame(storage: SaveStorage): LoadResult {
  const primaryRaw = storage.getItem(PRIMARY_KEY);
  let primaryError: SaveError | undefined;
  if (primaryRaw !== null) {
    const primary = deserialize(primaryRaw);
    if (primary.ok) return { data: primary.data, source: 'primary', recovered: false };
    primaryError = primary.error;
  }
  const backupRaw = storage.getItem(BACKUP_KEY);
  if (backupRaw !== null) {
    const backup = deserialize(backupRaw);
    if (backup.ok) {
      // Heal the primary slot so the next boot loads cleanly again.
      storage.setItem(PRIMARY_KEY, backupRaw);
      return {
        data: backup.data,
        source: 'backup',
        recovered: primaryError !== undefined,
        primaryError,
      };
    }
  }
  return { data: null, source: 'none', recovered: false, primaryError };
}

export function clearSave(storage: SaveStorage): void {
  storage.removeItem(PRIMARY_KEY);
  storage.removeItem(BACKUP_KEY);
}
