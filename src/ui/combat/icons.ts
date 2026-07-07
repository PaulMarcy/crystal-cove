/**
 * Text/Unicode icon vocabulary for combat (docs/11: information never via
 * color alone — every colored element also carries an icon or number).
 * Placeholder tier 1 (docs/04 Ausbaustufe 1); no image assets, no licenses.
 */
import type { IntentKind, StatusId, CardType } from '../../core/combat/types';

export const intentIcons: Record<IntentKind, string> = {
  attack: '⚔',
  defend: '🛡',
  buff: '↑',
  debuff: '↓',
  deck: '🂠',
};

export const statusIcons: Record<StatusId, string> = {
  strength: '💪',
  vulnerable: '💔',
  weak: '〰',
  poison: '☠',
  retaliate: '⚡',
};

export const cardTypeIcons: Record<CardType, string> = {
  attack: '⚔',
  skill: '🛡',
  power: '☀',
  dish: '🍲',
  status: '✖',
};
