/**
 * Building rules (M5, docs/09 Bauplätze) — pure, engine-free (CLAUDE.md
 * rule 1). Evaluates the declarative prerequisites from data/buildings.ts
 * against a caller-supplied context and performs the material deduction.
 * No per-building special code — everything is data-driven.
 */
import {
  villageConfig,
  type BuildingDef,
  type BuildRequirement,
} from '../../data/buildings';
import type { Inventory } from '../economy/inventory';

/** Everything a build check needs — composed by the store, pure here. */
export interface BuildContext {
  inventory: Inventory;
  /** Active story flags (island_cleansed, piya_chain_complete, …). */
  flags: readonly string[];
  /** NPCs freed in dungeons (docs/09 Orin). */
  rescuedNpcs: readonly string[];
  /** Friendship level per NPC id (0–3, docs/09); absent = 0. */
  friendshipLevels: Readonly<Record<string, number>>;
}

export type BuildBlocker =
  /** Slot is already at its final stage — nothing left to build. */
  | { kind: 'max_stage' }
  /** A non-material prerequisite is not met (quest/flag/friendship). */
  | { kind: 'requirement'; requirement: BuildRequirement }
  /** Material shortfall — have/need for UI text (never color-only, docs/11). */
  | { kind: 'material'; resource: string; have: number; need: number };

export interface BuildCheck {
  allowed: boolean;
  missing: readonly BuildBlocker[];
}

function requirementMet(requirement: BuildRequirement, ctx: BuildContext): boolean {
  switch (requirement.kind) {
    case 'flag':
      return ctx.flags.includes(requirement.flag);
    case 'npcRescued':
      return ctx.rescuedNpcs.includes(requirement.npc);
    case 'friendship':
      return (ctx.friendshipLevels[requirement.npc] ?? 0) >= requirement.level;
  }
}

/**
 * Checks whether the NEXT stage of the slot can be built. Always returns
 * the full blocker list (docs/12 sichtbar-verwehrtes-Ziel-Muster: the UI
 * shows WHY, not just that it is blocked).
 */
export function canBuild(def: BuildingDef, currentStage: number, ctx: BuildContext): BuildCheck {
  if (currentStage >= def.stages.length) {
    return { allowed: false, missing: [{ kind: 'max_stage' }] };
  }
  const stage = def.stages[currentStage]!; // bounds checked above
  const missing: BuildBlocker[] = [];
  for (const requirement of stage.requirements) {
    if (!requirementMet(requirement, ctx)) missing.push({ kind: 'requirement', requirement });
  }
  for (const [resource, need] of Object.entries(stage.costs)) {
    const have = ctx.inventory[resource] ?? 0;
    if (have < need) missing.push({ kind: 'material', resource, have, need });
  }
  return { allowed: missing.length === 0, missing };
}

export interface BuildResult {
  inventory: Inventory;
  /** New stage of the slot after the build. */
  stage: number;
}

/**
 * Builds the next stage: deducts the material costs and returns the new
 * stage. Null when canBuild refuses — callers must not mutate state then.
 */
export function build(
  def: BuildingDef,
  currentStage: number,
  ctx: BuildContext,
): BuildResult | null {
  if (!canBuild(def, currentStage, ctx).allowed) return null;
  const stage = def.stages[currentStage]!; // canBuild verified the bounds
  const inventory: Record<string, number> = { ...ctx.inventory };
  for (const [resource, need] of Object.entries(stage.costs)) {
    const rest = (inventory[resource] ?? 0) - need;
    if (rest > 0) inventory[resource] = rest;
    else delete inventory[resource]; // inventory keeps only positive counts
  }
  return { inventory, stage: currentStage + 1 };
}

/**
 * Dish slots per expedition (docs/09 B1 Haus): base 1, +1 with the finished
 * house, HARD-capped at villageConfig.dishSlotCap — the cap wins over any
 * combination of bonuses (docs/09: "Cap 2 gesamt — nicht additiv mit Lv 12").
 */
export function dishSlots(
  builtStages: Readonly<Record<string, number>>,
  baseSlots: number,
): number {
  const houseBuilt = (builtStages[villageConfig.houseSlot] ?? 0) >= villageConfig.houseStage;
  const slots = baseSlots + (houseBuilt ? villageConfig.houseDishSlotBonus : 0);
  return Math.min(slots, villageConfig.dishSlotCap);
}
