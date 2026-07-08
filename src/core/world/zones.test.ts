import { describe, expect, it } from 'vitest';
import { isZoneId, zoneAt, type ZoneRect } from './zones';

// Mirrors the Heimatbucht layout: waldrand top, wiese middle, strand bottom.
const zones: ZoneRect[] = [
  { id: 'waldrand', x: 0, y: 0, width: 640, height: 80 },
  { id: 'wiese', x: 0, y: 80, width: 640, height: 240 },
  { id: 'strand', x: 0, y: 320, width: 640, height: 80 },
];

describe('zoneAt', () => {
  it('finds the zone containing a point', () => {
    expect(zoneAt(zones, 320, 40)).toBe('waldrand');
    expect(zoneAt(zones, 320, 200)).toBe('wiese');
    expect(zoneAt(zones, 320, 350)).toBe('strand');
  });

  it('treats shared borders as belonging to the lower zone (top-inclusive)', () => {
    expect(zoneAt(zones, 100, 80)).toBe('wiese');
    expect(zoneAt(zones, 100, 320)).toBe('strand');
  });

  it('returns null outside all zones (e.g. water below the beach)', () => {
    expect(zoneAt(zones, 320, 450)).toBeNull();
    expect(zoneAt(zones, -1, 100)).toBeNull();
    expect(zoneAt(zones, 640, 100)).toBeNull();
  });

  it('returns null for an empty zone list', () => {
    expect(zoneAt([], 10, 10)).toBeNull();
  });
});

describe('isZoneId', () => {
  it('accepts the three Heimatbucht zones', () => {
    expect(isZoneId('strand')).toBe(true);
    expect(isZoneId('wiese')).toBe(true);
    expect(isZoneId('waldrand')).toBe(true);
  });

  it('rejects unknown names', () => {
    expect(isZoneId('wasser')).toBe(false);
    expect(isZoneId('')).toBe(false);
  });
});
