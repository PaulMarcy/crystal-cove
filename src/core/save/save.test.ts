import { describe, expect, it } from 'vitest';
import { checksum, deserialize, serialize, SAVE_VERSION, type SaveData } from './save';

const sample: SaveData = {
  inventory: { wood: 3, stone: 1 },
  harvestedNodeIds: ['tree-1', 'rock-2'],
  shadowDensity: 0,
  playerPosition: { x: 120, y: 240 },
  playerZone: 'wiese',
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
    };
    expect(deserialize(serialize(fresh))).toEqual({ ok: true, data: fresh });
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
    ];
    for (const broken of cases) {
      const payload = JSON.stringify(broken);
      const raw = JSON.stringify({ v: SAVE_VERSION, checksum: checksum(payload), payload });
      expect(deserialize(raw)).toEqual({ ok: false, error: 'invalid_payload' });
    }
  });
});
