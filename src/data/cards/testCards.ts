/**
 * Minimal card data for combat-core tests (docs/03 starter deck excerpts).
 * Full card content is a separate content task (docs/10).
 */
import type { CardDef } from '../../core/combat/types';

export const axtschlag: CardDef = {
  id: 'axtschlag',
  name: 'Axtschlag',
  type: 'attack',
  cost: 1,
  school: 'basics',
  effects: [{ kind: 'damage', amount: 6, target: 'target' }],
};

export const holzschild: CardDef = {
  id: 'holzschild',
  name: 'Holzschild',
  type: 'skill',
  cost: 1,
  school: 'basics',
  effects: [{ kind: 'block', amount: 5, target: 'self' }],
};

export const steinwurf: CardDef = {
  id: 'steinwurf',
  name: 'Steinwurf',
  type: 'attack',
  cost: 0,
  school: 'basics',
  effects: [{ kind: 'damage', amount: 3, target: 'target' }],
};

export const verschnaufen: CardDef = {
  id: 'verschnaufen',
  name: 'Verschnaufen',
  type: 'skill',
  cost: 1,
  school: 'basics',
  effects: [{ kind: 'draw', amount: 2 }],
};

export const beerensnack: CardDef = {
  id: 'beerensnack',
  name: 'Beerensnack',
  type: 'dish',
  cost: 0,
  effects: [{ kind: 'heal', amount: 5, target: 'self' }],
};

export const erschoepfung: CardDef = {
  id: 'erschoepfung',
  name: 'Erschöpfung',
  type: 'status',
  cost: 0,
  effects: [],
};
