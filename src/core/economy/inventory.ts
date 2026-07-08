/**
 * Inventory — pure, engine-free stacking logic (CLAUDE.md rule 1).
 * The inventory is an immutable map from item id to count; every operation
 * returns a new object. Item ids are plain strings so combat drops (M2+)
 * and gathered resources share one inventory.
 */

export type Inventory = Readonly<Record<string, number>>;

export const emptyInventory: Inventory = Object.freeze({});

/** Adds `amount` (must be > 0) of an item; stacks onto an existing count. */
export function addItem(inventory: Inventory, itemId: string, amount: number): Inventory {
  if (!Number.isInteger(amount) || amount <= 0) {
    throw new Error(`addItem: amount must be a positive integer, got ${amount}`);
  }
  return { ...inventory, [itemId]: (inventory[itemId] ?? 0) + amount };
}

/**
 * Removes `amount` of an item. Returns the new inventory, or null if the
 * inventory does not hold enough (callers decide how to surface that).
 * Stacks that reach 0 are dropped from the map.
 */
export function removeItem(
  inventory: Inventory,
  itemId: string,
  amount: number,
): Inventory | null {
  if (!Number.isInteger(amount) || amount <= 0) {
    throw new Error(`removeItem: amount must be a positive integer, got ${amount}`);
  }
  const current = inventory[itemId] ?? 0;
  if (current < amount) return null;
  const next: Record<string, number> = { ...inventory };
  if (current === amount) delete next[itemId];
  else next[itemId] = current - amount;
  return next;
}

export function countOf(inventory: Inventory, itemId: string): number {
  return inventory[itemId] ?? 0;
}
