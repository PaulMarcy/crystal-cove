import { describe, expect, it } from 'vitest';
import { addItem, countOf, emptyInventory, removeItem } from './inventory';
import { harvestNode } from './harvest';

describe('inventory', () => {
  it('adds a new item stack', () => {
    const inv = addItem(emptyInventory, 'wood', 2);
    expect(countOf(inv, 'wood')).toBe(2);
  });

  it('stacks onto an existing count', () => {
    const inv = addItem(addItem(emptyInventory, 'wood', 2), 'wood', 3);
    expect(countOf(inv, 'wood')).toBe(5);
  });

  it('does not mutate the previous inventory', () => {
    const before = addItem(emptyInventory, 'stone', 1);
    addItem(before, 'stone', 4);
    expect(countOf(before, 'stone')).toBe(1);
  });

  it('rejects non-positive or fractional amounts', () => {
    expect(() => addItem(emptyInventory, 'wood', 0)).toThrow();
    expect(() => addItem(emptyInventory, 'wood', -1)).toThrow();
    expect(() => addItem(emptyInventory, 'wood', 1.5)).toThrow();
    expect(() => removeItem(emptyInventory, 'wood', 0)).toThrow();
  });

  it('removes part of a stack', () => {
    const inv = removeItem(addItem(emptyInventory, 'berry', 3), 'berry', 2);
    expect(inv).not.toBeNull();
    expect(countOf(inv!, 'berry')).toBe(1);
  });

  it('drops a stack that reaches zero', () => {
    const inv = removeItem(addItem(emptyInventory, 'berry', 3), 'berry', 3);
    expect(inv).not.toBeNull();
    expect(Object.keys(inv!)).toHaveLength(0);
  });

  it('returns null when removing more than available', () => {
    const inv = addItem(emptyInventory, 'copper_ore', 1);
    expect(removeItem(inv, 'copper_ore', 2)).toBeNull();
    expect(removeItem(inv, 'wood', 1)).toBeNull();
    expect(countOf(inv, 'copper_ore')).toBe(1); // untouched
  });
});

describe('harvestNode', () => {
  it('adds the yield and marks the node depleted', () => {
    const result = harvestNode(emptyInventory, [], 'tree-1', 'wood', 2);
    expect(result).not.toBeNull();
    expect(countOf(result!.inventory, 'wood')).toBe(2);
    expect(result!.harvestedNodeIds).toContain('tree-1');
  });

  it('refuses to harvest the same node twice', () => {
    const first = harvestNode(emptyInventory, [], 'tree-1', 'wood', 2)!;
    const second = harvestNode(first.inventory, first.harvestedNodeIds, 'tree-1', 'wood', 2);
    expect(second).toBeNull();
  });

  it('keeps other depleted nodes in the list', () => {
    const result = harvestNode(emptyInventory, ['rock-1'], 'tree-1', 'wood', 2)!;
    expect(result.harvestedNodeIds).toEqual(['rock-1', 'tree-1']);
  });
});
