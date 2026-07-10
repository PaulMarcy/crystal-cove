import { describe, expect, it } from 'vitest';
import { serialize, type SaveData } from './save';
import {
  BACKUP_KEY,
  clearSave,
  loadGame,
  PRIMARY_KEY,
  saveGame,
  type SaveStorage,
} from './storage';

function memoryStorage(initial: Record<string, string> = {}): SaveStorage & {
  map: Map<string, string>;
} {
  const map = new Map(Object.entries(initial));
  return {
    map,
    getItem: (key) => map.get(key) ?? null,
    setItem: (key, value) => void map.set(key, value),
    removeItem: (key) => void map.delete(key),
  };
}

const saveA: SaveData = {
  inventory: { wood: 1 },
  harvestedNodeIds: ['tree-1'],
  shadowDensity: 0,
  playerPosition: { x: 10, y: 20 },
  playerZone: 'strand',
};
const saveB: SaveData = { ...saveA, inventory: { wood: 2 }, playerZone: 'wiese' };

describe('save slots (double write + recovery)', () => {
  it('empty storage → no data, no recovery', () => {
    expect(loadGame(memoryStorage())).toEqual({ data: null, source: 'none', recovered: false });
  });

  it('save then load returns the primary slot', () => {
    const storage = memoryStorage();
    saveGame(storage, saveA);
    expect(loadGame(storage)).toEqual({ data: saveA, source: 'primary', recovered: false });
  });

  it('second save rotates the previous save into the backup slot', () => {
    const storage = memoryStorage();
    saveGame(storage, saveA);
    saveGame(storage, saveB);
    expect(storage.map.get(PRIMARY_KEY)).toBe(serialize(saveB));
    expect(storage.map.get(BACKUP_KEY)).toBe(serialize(saveA));
  });

  it('corrupt primary is NOT rotated into the backup on the next save', () => {
    const storage = memoryStorage();
    saveGame(storage, saveA); // good primary
    storage.map.set(PRIMARY_KEY, '{oops'); // primary corrupts on disk
    saveGame(storage, saveB); // must not push the corrupt blob into backup
    expect(storage.map.get(PRIMARY_KEY)).toBe(serialize(saveB));
    expect(storage.map.get(BACKUP_KEY)).toBe(undefined);
    // A good previous backup also survives a corrupt-primary rotation:
    const storage2 = memoryStorage();
    saveGame(storage2, saveA);
    saveGame(storage2, saveB); // backup = saveA
    storage2.map.set(PRIMARY_KEY, 'garbage');
    saveGame(storage2, saveB);
    expect(storage2.map.get(BACKUP_KEY)).toBe(serialize(saveA));
  });

  it('corrupt primary (broken JSON) → backup loads, recovery reported', () => {
    const storage = memoryStorage();
    saveGame(storage, saveA);
    saveGame(storage, saveB);
    storage.map.set(PRIMARY_KEY, '{oops');
    const result = loadGame(storage);
    expect(result.data).toEqual(saveA);
    expect(result.source).toBe('backup');
    expect(result.recovered).toBe(true);
    expect(result.primaryError).toBe('corrupt_json');
    // Primary slot is healed for the next boot.
    expect(storage.map.get(PRIMARY_KEY)).toBe(serialize(saveA));
  });

  it('checksum-corrupt primary → backup recovery', () => {
    const storage = memoryStorage();
    saveGame(storage, saveA);
    saveGame(storage, saveB);
    // Payload is an escaped JSON string inside the envelope.
    const tampered = storage.map.get(PRIMARY_KEY)!.replace('\\"wood\\":2', '\\"wood\\":5');
    expect(tampered).not.toBe(storage.map.get(PRIMARY_KEY));
    storage.map.set(PRIMARY_KEY, tampered);
    const result = loadGame(storage);
    expect(result).toMatchObject({
      data: saveA,
      source: 'backup',
      recovered: true,
      primaryError: 'checksum_mismatch',
    });
  });

  it('missing primary but intact backup → backup loads without recovery flag', () => {
    const storage = memoryStorage();
    saveGame(storage, saveA);
    saveGame(storage, saveB);
    storage.map.delete(PRIMARY_KEY);
    const result = loadGame(storage);
    expect(result).toMatchObject({ data: saveA, source: 'backup', recovered: false });
  });

  it('both slots corrupt → fresh start (data null), primary error surfaced', () => {
    const storage = memoryStorage({ [PRIMARY_KEY]: 'garbage', [BACKUP_KEY]: 'also garbage' });
    const result = loadGame(storage);
    expect(result.data).toBeNull();
    expect(result.source).toBe('none');
    expect(result.primaryError).toBe('corrupt_json');
  });

  it('clearSave removes both slots', () => {
    const storage = memoryStorage();
    saveGame(storage, saveA);
    saveGame(storage, saveB);
    clearSave(storage);
    expect(storage.map.size).toBe(0);
  });
});
