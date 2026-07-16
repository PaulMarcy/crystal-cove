/**
 * Quest & NPC-arrival rules (M5, docs/09) — pure, engine-free (CLAUDE.md
 * rule 1). Interprets the declarative NPC data (data/npcs) against a
 * store-composed context: arrival triggers, quest availability/acceptance,
 * requirement checks, turn-in (item deduction) and the declarative reward
 * outcome. No per-NPC special code — everything is data-driven.
 *
 * Friendship (docs/09): levels 0–3 rise ONLY through the chain — completing
 * stage n sets the level to n. The chain is strictly sequential: quest n is
 * available once quest n−1 is completed (and extra availability gates hold).
 */
import {
  questConfig,
  questsById,
  type NpcDef,
  type QuestCollectNode,
  type QuestDef,
  type QuestRequirement,
} from '../../data/npcs';
import { countOf, removeItem, type Inventory } from '../economy/inventory';

/** Everything quest checks need — composed by the store, pure here. */
export interface QuestContext {
  inventory: Inventory;
  /** Active story flags INCLUDING derived ones (island_cleansed). */
  flags: readonly string[];
  /** Built stage per building slot (docs/09 B1–B9). */
  builtBuildings: Readonly<Record<string, number>>;
  /** NPCs freed in dungeons (docs/09 Orin). */
  rescuedNpcs: readonly string[];
  activeQuests: readonly string[];
  completedQuests: readonly string[];
}

/** Has the NPC arrived at the Heimatbucht? (docs/09 Ankunft durch Taten.) */
export function npcArrived(npc: NpcDef, ctx: QuestContext): boolean {
  const trigger = npc.arrivalTrigger;
  switch (trigger.kind) {
    case 'always':
      return true;
    case 'building':
      return (ctx.builtBuildings[trigger.slot] ?? 0) >= trigger.stage;
    case 'npcRescued':
      return ctx.rescuedNpcs.includes(trigger.npc);
    case 'flag':
      return ctx.flags.includes(trigger.flag);
  }
}

/** Is a declarative requirement fulfilled? (Items are NOT deducted here.) */
export function requirementMet(requirement: QuestRequirement, ctx: QuestContext): boolean {
  switch (requirement.kind) {
    case 'items':
      return requirement.items.every((i) => countOf(ctx.inventory, i.resource) >= i.amount);
    case 'flag':
      return ctx.flags.includes(requirement.flag);
    case 'building':
      return (ctx.builtBuildings[requirement.slot] ?? 0) >= requirement.stage;
    case 'none':
      return true;
  }
}

/** First quest of the chain that is not completed yet (null = chain done). */
export function nextChainQuest(npc: NpcDef, ctx: QuestContext): QuestDef | null {
  return npc.questChain.find((q) => !ctx.completedQuests.includes(q.id)) ?? null;
}

/**
 * Can the quest be OFFERED right now? NPC arrived, met (arrival dialog
 * seen), chain order respected, extra availability gates fulfilled, and the
 * quest neither active nor completed.
 */
export function questAvailable(quest: QuestDef, npc: NpcDef, ctx: QuestContext): boolean {
  if (npc.id !== quest.npcId) return false;
  if (!npcArrived(npc, ctx)) return false;
  if (!ctx.flags.includes(npc.metFlag)) return false;
  if (ctx.activeQuests.includes(quest.id) || ctx.completedQuests.includes(quest.id)) return false;
  if (nextChainQuest(npc, ctx)?.id !== quest.id) return false;
  return (quest.availability ?? []).every((req) => requirementMet(req, ctx));
}

/** Accepts an available quest. Null when it cannot be accepted. */
export function acceptQuest(
  quest: QuestDef,
  npc: NpcDef,
  ctx: QuestContext,
): readonly string[] | null {
  if (!questAvailable(quest, npc, ctx)) return null;
  return [...ctx.activeQuests, quest.id];
}

/** Active and requirement fulfilled → the NPC takes the turn-in. */
export function canTurnIn(quest: QuestDef, ctx: QuestContext): boolean {
  return ctx.activeQuests.includes(quest.id) && requirementMet(quest.requirement, ctx);
}

/** Declarative outcome of a completed quest — the store applies it. */
export interface QuestCompletion {
  /** Inventory AFTER handing over requirement items. */
  inventory: Inventory;
  activeQuests: readonly string[];
  completedQuests: readonly string[];
  /** Recipe unlock ids (store: unlockedRecipes). */
  recipeIds: readonly string[];
  /** Talisman ownership grants (store: ownedTalismans). */
  talismanIds: readonly string[];
  /** Story flags to set (e.g. piya_chain_complete). */
  flags: readonly string[];
  /** Uniform stage XP (docs/09: 30/50/80). */
  xp: number;
  /** New friendship level of the NPC (= quest stage, docs/09). */
  friendshipLevel: number;
}

/**
 * Turns a quest in: deducts requirement items and returns the declarative
 * reward outcome. Null when the quest is not active or the requirement is
 * unfulfilled — callers must not mutate state then.
 */
export function completeQuest(quest: QuestDef, ctx: QuestContext): QuestCompletion | null {
  if (!canTurnIn(quest, ctx)) return null;
  let inventory = ctx.inventory;
  if (quest.requirement.kind === 'items') {
    for (const item of quest.requirement.items) {
      const removed = removeItem(inventory, item.resource, item.amount);
      if (removed === null) return null; // canTurnIn verified — defensive
      inventory = removed;
    }
  }
  return {
    inventory,
    activeQuests: ctx.activeQuests.filter((id) => id !== quest.id),
    completedQuests: [...ctx.completedQuests, quest.id],
    recipeIds: quest.rewards.flatMap((r) => (r.kind === 'recipe' ? [r.recipeId] : [])),
    talismanIds: quest.rewards.flatMap((r) => (r.kind === 'talisman' ? [r.talismanId] : [])),
    flags: quest.rewards.flatMap((r) => (r.kind === 'flag' ? [r.flag] : [])),
    xp: questConfig.xpByStage[quest.stage - 1] ?? 0,
    friendshipLevel: quest.stage,
  };
}

/**
 * Which dialog does talking to the NPC open? (docs/13 Quest-Integration.)
 * Priority: first meeting → turn-in → reminder → offer → default.
 */
export function dialogIdForNpc(npc: NpcDef, ctx: QuestContext): string {
  if (!ctx.flags.includes(npc.metFlag)) return npc.dialogs.arrival;
  const active = npc.questChain.find((q) => ctx.activeQuests.includes(q.id));
  if (active) return canTurnIn(active, ctx) ? active.dialogs.turnIn : active.dialogs.reminder;
  const next = nextChainQuest(npc, ctx);
  if (next && questAvailable(next, npc, ctx)) return next.dialogs.offer;
  return npc.dialogs.default;
}

/**
 * Overhead symbol (docs/13: ! neue Quest · ? abschlussbereit — nie nur
 * Farbe). Null = nothing pending. The first meeting also shows '!' so a
 * newly arrived NPC is noticeable.
 */
export function questIndicator(npc: NpcDef, ctx: QuestContext): '!' | '?' | null {
  if (!npcArrived(npc, ctx)) return null;
  if (!ctx.flags.includes(npc.metFlag)) return '!';
  const active = npc.questChain.find((q) => ctx.activeQuests.includes(q.id));
  if (active) return canTurnIn(active, ctx) ? '?' : null;
  const next = nextChainQuest(npc, ctx);
  return next && questAvailable(next, npc, ctx) ? '!' : null;
}

/**
 * Quest-spawned collect point visibility (docs/09 Honig / Maros Kiste):
 * only while the quest is active AND the item is still missing — so the
 * point despawns after collecting and never respawns once turned in.
 */
export function questNodeVisible(node: QuestCollectNode, ctx: QuestContext): boolean {
  if (!ctx.activeQuests.includes(node.questId)) return false;
  return countOf(ctx.inventory, node.resource) < node.amount;
}

/** Looks a quest up by id (data/npcs); null for unknown ids. */
export function questById(questId: string): QuestDef | null {
  return questsById[questId] ?? null;
}
