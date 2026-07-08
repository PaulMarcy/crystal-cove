/**
 * Harvest logic — pure, engine-free (CLAUDE.md rule 1).
 * A harvest node yields a resource once, then stays depleted. There is no
 * real-time respawn by design (docs/10: no day/night cycle); replenishing
 * on sleep phases is a later milestone — until then depleted nodes simply
 * stay marked in `harvestedNodeIds`.
 */

import { addItem, type Inventory } from './inventory';

export interface HarvestOutcome {
  inventory: Inventory;
  harvestedNodeIds: readonly string[];
}

/**
 * Harvests a node: adds its yield to the inventory and marks the node as
 * depleted. Returns null if the node was already harvested.
 */
export function harvestNode(
  inventory: Inventory,
  harvestedNodeIds: readonly string[],
  nodeId: string,
  resourceId: string,
  amount: number,
): HarvestOutcome | null {
  if (harvestedNodeIds.includes(nodeId)) return null;
  return {
    inventory: addItem(inventory, resourceId, amount),
    harvestedNodeIds: [...harvestedNodeIds, nodeId],
  };
}
