import { describe, expect, it } from 'vitest';
import { starterDeckIds } from '../../data/cards/tier1';
import { checksum, deserialize, serialize, SAVE_VERSION, type SaveData } from './save';

const sample: SaveData = {
  inventory: { wood: 3, stone: 1 },
  harvestedNodeIds: ['tree-1', 'rock-2'],
  shadowDensity: 0,
  playerPosition: { x: 120, y: 240 },
  playerZone: 'wiese',
  collection: ['stone_wall'],
  toolTier: 1,
  deck: [...starterDeckIds],
};

describe('save codec', () => {
  it('round-trips serialize → deserialize', () => {
    const result = deserialize(serialize(sample));
    expect(result).toEqual({ ok: true, data: sample });
  });

  it('round-trips empty/null fields (fresh game state)', () => {
    const fresh: SaveData = {
      inventory: {},
      harvestedNodeIds: [],
      shadowDensity: 0,
      playerPosition: null,
      playerZone: null,
      collection: [],
      toolTier: 1,
      deck: [...starterDeckIds],
    };
    expect(deserialize(serialize(fresh))).toEqual({ ok: true, data: fresh });
  });

  it('round-trips the optional consumedStarterDishes field (late-V2, no bump)', () => {
    const withDishes: SaveData = { ...sample, consumedStarterDishes: ['berry_snack'] };
    expect(deserialize(serialize(withDishes))).toEqual({ ok: true, data: withDishes });
    // Older V2 saves without the field stay valid (additive-optional).
    expect(deserialize(serialize(sample))).toEqual({ ok: true, data: sample });
  });

  it('embeds the current save version', () => {
    const envelope = JSON.parse(serialize(sample)) as { v: number };
    expect(envelope.v).toBe(SAVE_VERSION);
  });

  it('checksum is stable and input-sensitive', () => {
    expect(checksum('abc')).toBe(checksum('abc'));
    expect(checksum('abc')).not.toBe(checksum('abd'));
  });

  it('rejects broken JSON', () => {
    expect(deserialize('{not json')).toEqual({ ok: false, error: 'corrupt_json' });
  });

  it('rejects JSON that is not a save envelope', () => {
    expect(deserialize('42')).toEqual({ ok: false, error: 'invalid_envelope' });
    expect(deserialize('{"foo":1}')).toEqual({ ok: false, error: 'invalid_envelope' });
  });

  it('rejects a tampered payload via checksum', () => {
    const raw = serialize(sample);
    const envelope = JSON.parse(raw) as { v: number; checksum: string; payload: string };
    envelope.payload = envelope.payload.replace('"wood":3', '"wood":9999');
    expect(deserialize(JSON.stringify(envelope))).toEqual({
      ok: false,
      error: 'checksum_mismatch',
    });
  });

  it('rejects saves from an unknown (newer) version', () => {
    const envelope = JSON.parse(serialize(sample)) as {
      v: number;
      checksum: string;
      payload: string;
    };
    envelope.v = SAVE_VERSION + 1;
    expect(deserialize(JSON.stringify(envelope))).toEqual({
      ok: false,
      error: 'unknown_version',
    });
  });

  it('rejects payloads with missing or invalid fields (valid checksum)', () => {
    const cases: unknown[] = [
      { ...sample, inventory: undefined },
      { ...sample, inventory: { wood: -2 } },
      { ...sample, harvestedNodeIds: 'tree-1' },
      { ...sample, harvestedNodeIds: [1, 2] },
      { ...sample, shadowDensity: 7 },
      { ...sample, playerPosition: { x: 'a', y: 1 } },
      { ...sample, playerZone: 'atlantis' },
      { ...sample, consumedStarterDishes: 'berry_snack' },
      { ...sample, consumedStarterDishes: [1] },
    ];
    for (const broken of cases) {
      const payload = JSON.stringify(broken);
      const raw = JSON.stringify({ v: SAVE_VERSION, checksum: checksum(payload), payload });
      expect(deserialize(raw)).toEqual({ ok: false, error: 'invalid_payload' });
    }
  });

  it('migrates V1 saves: starter deck, empty collection, base tool tier', () => {
    const v1 = {
      inventory: { wood: 3 },
      harvestedNodeIds: ['tree-1'],
      shadowDensity: 0,
      playerPosition: { x: 5, y: 6 },
      playerZone: 'wiese',
    };
    const payload = JSON.stringify(v1);
    const raw = JSON.stringify({ v: 1, checksum: checksum(payload), payload });
    const result = deserialize(raw);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.deck).toEqual([...starterDeckIds]);
      expect(result.data.collection).toEqual([]);
      expect(result.data.toolTier).toBe(1);
      expect(result.data.inventory).toEqual(v1.inventory);
    }
  });

  it('migrates late-V1 saves keeping optional collection/toolTier values', () => {
    const v1 = {
      inventory: {},
      harvestedNodeIds: [],
      shadowDensity: 0,
      playerPosition: null,
      playerZone: null,
      collection: ['stone_wall'],
      toolTier: 2,
    };
    const payload = JSON.stringify(v1);
    const raw = JSON.stringify({ v: 1, checksum: checksum(payload), payload });
    const result = deserialize(raw);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.collection).toEqual(['stone_wall']);
      expect(result.data.toolTier).toBe(2);
      expect(result.data.deck).toEqual([...starterDeckIds]);
    }
  });
});
