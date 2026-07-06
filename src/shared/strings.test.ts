import { describe, expect, it } from 'vitest';
import { strings } from './strings';

describe('strings', () => {
  it('provides the game title', () => {
    expect(strings.game.title).toBe('Crystal Cove');
  });
});
