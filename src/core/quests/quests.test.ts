/**
 * Quest-core tests (M5 Task 3, docs/09): arrival triggers, chain
 * sequencing, declarative requirements, turn-in with item deduction and
 * reward outcome, dialog resolution priority and quest-node visibility.
 * Pure rules — store wiring is covered in shared/quests.test.ts.
 */
import { describe, expect, it } from 'vitest';
import {
  acceptQuest,
  canTurnIn,
  completeQuest,
  dialogIdForNpc,
  npcArrived,
  questAvailable,
  questIndicator,
  questNodeVisible,
  type QuestContext,
} from './quests';
import { allQuests, npcs, npcsById, questCollectNodes, questConfig } from '../../data/npcs';
import { allRecipes } from '../../data/recipes';
import { talismansById } from '../../data/talismans';
import { dialogsById } from '../../data/dialogs';

const maro = npcsById.maro!;
const tilda = npcsById.tilda!;
const bruna = npcsById.bruna!;
const orin = npcsById.orin!;
const piya = npcsById.piya!;
const lumen = npcsById.lumen!;

function ctx(overrides: Partial<QuestContext> = {}): QuestContext {
  return {
    inventory: {},
    flags: [],
    builtBuildings: { b1: 1, b2: 1, b3: 1 },
    rescuedNpcs: [],
    activeQuests: [],
    completedQuests: [],
    ...overrides,
  };
}

describe('NPC arrival (docs/09: Ankunft durch Taten)', () => {
  it('lumen is always there; building/rescue/flag triggers gate the rest', () => {
    const base = ctx();
    expect(npcArrived(lumen, base)).toBe(true);
    expect(npcArrived(maro, base)).toBe(true); // B3 St. 1 ist vorgebaut
    expect(npcArrived(tilda, base)).toBe(false);
    expect(npcArrived(bruna, base)).toBe(false);
    expect(npcArrived(orin, base)).toBe(false);
    expect(npcArrived(piya, base)).toBe(false);

    expect(npcArrived(tilda, ctx({ builtBuildings: { b4: 1 } }))).toBe(true);
    expect(npcArrived(bruna, ctx({ builtBuildings: { b5: 1 } }))).toBe(true);
    expect(npcArrived(orin, ctx({ rescuedNpcs: ['orin'] }))).toBe(true);
    expect(npcArrived(piya, ctx({ flags: ['island_cleansed'] }))).toBe(true);
  });
});

describe('quest availability & acceptance (chain order, docs/09)', () => {
  const maro1 = maro.questChain[0]!;
  const maro2 = maro.questChain[1]!;

  it('requires the arrival dialog (met flag) before offering quests', () => {
    expect(questAvailable(maro1, maro, ctx())).toBe(false);
    expect(questAvailable(maro1, maro, ctx({ flags: ['met_maro'] }))).toBe(true);
  });

  it('enforces strict chain order and rejects active/completed quests', () => {
    const met = ctx({ flags: ['met_maro'] });
    expect(questAvailable(maro2, maro, met)).toBe(false); // maro_1 first
    expect(
      questAvailable(maro2, maro, ctx({ flags: ['met_maro'], completedQuests: ['maro_1'] })),
    ).toBe(true);
    expect(questAvailable(maro1, maro, { ...met, activeQuests: ['maro_1'] })).toBe(false);
    expect(questAvailable(maro1, maro, { ...met, completedQuests: ['maro_1'] })).toBe(false);
  });

  it('honours extra availability gates (Bruna 3 / Orin 3 nach Reinigung)', () => {
    const bruna3 = bruna.questChain[2]!;
    const ready = ctx({
      builtBuildings: { b5: 1 },
      flags: ['met_bruna'],
      completedQuests: ['bruna_1', 'bruna_2'],
    });
    expect(questAvailable(bruna3, bruna, ready)).toBe(false);
    expect(
      questAvailable(bruna3, bruna, { ...ready, flags: ['met_bruna', 'island_cleansed'] }),
    ).toBe(true);
  });

  it('acceptQuest returns the extended active list, null when blocked', () => {
    const met = ctx({ flags: ['met_maro'] });
    expect(acceptQuest(maro1, maro, met)).toEqual(['maro_1']);
    expect(acceptQuest(maro2, maro, met)).toBeNull();
  });
});

describe('requirements & turn-in (declarative, docs/09)', () => {
  const maro1 = maro.questChain[0]!;
  const bruna2 = bruna.questChain[1]!;
  const orin1 = orin.questChain[0]!;

  it('item requirement: fulfilled only with all items in the inventory', () => {
    const active = ctx({ activeQuests: ['maro_1'] });
    expect(canTurnIn(maro1, active)).toBe(false);
    expect(canTurnIn(maro1, { ...active, inventory: { old_tools: 1 } })).toBe(true);
  });

  it('flag requirement: Riesenwels-Flag kommt vom Angel-Task (M5 Task 4)', () => {
    const active = ctx({ activeQuests: ['bruna_2'] });
    expect(canTurnIn(bruna2, active)).toBe(false);
    expect(canTurnIn(bruna2, { ...active, flags: ['giant_catfish_caught'] })).toBe(true);
  });

  it('building requirement: Orin 1 braucht den Schrein (B6)', () => {
    const active = ctx({ activeQuests: ['orin_1'] });
    expect(canTurnIn(orin1, active)).toBe(false);
    expect(
      canTurnIn(orin1, { ...active, builtBuildings: { ...active.builtBuildings, b6: 1 } }),
    ).toBe(true);
  });

  it('completeQuest deducts items and returns the declarative rewards', () => {
    const result = completeQuest(
      maro1,
      ctx({
        activeQuests: ['maro_1'],
        inventory: { old_tools: 1, wood: 3 },
      }),
    );
    expect(result).not.toBeNull();
    expect(result!.inventory).toEqual({ wood: 3 }); // Kiste abgegeben
    expect(result!.activeQuests).toEqual([]);
    expect(result!.completedQuests).toEqual(['maro_1']);
    expect(result!.recipeIds).toEqual(['recipe_heavy_blow']);
    expect(result!.talismanIds).toEqual([]);
    expect(result!.xp).toBe(questConfig.xpByStage[0]); // St. 1 = 30
    expect(result!.friendshipLevel).toBe(1);
  });

  it('stage-3 quests grant the unique talisman (docs/09 Belohnungslogik)', () => {
    const maro3 = maro.questChain[2]!;
    const result = completeQuest(
      maro3,
      ctx({
        activeQuests: ['maro_3'],
        inventory: { heart_thorn: 1 },
      }),
    );
    expect(result!.talismanIds).toEqual(['anvil_heart']);
    expect(result!.xp).toBe(questConfig.xpByStage[2]); // St. 3 = 80
    expect(result!.friendshipLevel).toBe(3);
  });

  it('piya_3 rewards the piya_chain_complete flag (B9 Bootshaus, docs/09)', () => {
    const piya3 = piya.questChain[2]!;
    const result = completeQuest(piya3, ctx({ activeQuests: ['piya_3'] }));
    expect(result!.flags).toEqual(['piya_chain_complete']);
  });

  it('refuses turn-in when inactive or unfulfilled', () => {
    expect(completeQuest(maro1, ctx({ inventory: { old_tools: 1 } }))).toBeNull();
    expect(completeQuest(maro1, ctx({ activeQuests: ['maro_1'] }))).toBeNull();
  });
});

describe('dialog resolution (docs/13: Erstkontakt → Abgabe → Erinnerung → Angebot → Standard)', () => {
  it('walks the full priority for Maro', () => {
    expect(dialogIdForNpc(maro, ctx())).toBe('maro_arrival');
    const met = ctx({ flags: ['met_maro'] });
    expect(dialogIdForNpc(maro, met)).toBe('maro_1_offer');
    expect(dialogIdForNpc(maro, { ...met, activeQuests: ['maro_1'] })).toBe('maro_1_reminder');
    expect(
      dialogIdForNpc(maro, { ...met, activeQuests: ['maro_1'], inventory: { old_tools: 1 } }),
    ).toBe('maro_1_done');
    expect(
      dialogIdForNpc(maro, {
        ...met,
        completedQuests: ['maro_1', 'maro_2', 'maro_3'],
      }),
    ).toBe('maro_default');
  });

  it('quest indicator: ! for offer/first meeting, ? when turn-in-ready', () => {
    expect(questIndicator(maro, ctx())).toBe('!');
    const met = ctx({ flags: ['met_maro'] });
    expect(questIndicator(maro, met)).toBe('!');
    expect(questIndicator(maro, { ...met, activeQuests: ['maro_1'] })).toBeNull();
    expect(
      questIndicator(maro, { ...met, activeQuests: ['maro_1'], inventory: { old_tools: 1 } }),
    ).toBe('?');
    expect(questIndicator(tilda, ctx())).toBeNull(); // not arrived
  });
});

describe('quest collect nodes (docs/09 Honig / Maros Kiste)', () => {
  const honey = questCollectNodes.find((n) => n.id === 'quest-tilda-honey')!;

  it('visible only while the quest is active and the item missing', () => {
    expect(questNodeVisible(honey, ctx())).toBe(false);
    expect(questNodeVisible(honey, ctx({ activeQuests: ['tilda_3'] }))).toBe(true);
    expect(
      questNodeVisible(honey, ctx({ activeQuests: ['tilda_3'], inventory: { honey: 1 } })),
    ).toBe(false);
  });
});

describe('quest data integrity (docs/09 ↔ data)', () => {
  it('every chain has 3 stages in order (Lumen none, docs/09)', () => {
    for (const npc of npcs) {
      if (npc.id === 'lumen') {
        expect(npc.questChain).toHaveLength(0);
        continue;
      }
      expect(npc.questChain).toHaveLength(3);
      npc.questChain.forEach((quest, index) => {
        expect(quest.stage, quest.id).toBe(index + 1);
        expect(quest.npcId, quest.id).toBe(npc.id);
      });
    }
  });

  it('quest ids are unique English snake_case', () => {
    const ids = allQuests.map((q) => q.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(/^[a-z][a-z0-9_]*$/);
  });

  it('talisman rewards exist; every quest dialog id resolves', () => {
    for (const quest of allQuests) {
      for (const reward of quest.rewards) {
        if (reward.kind === 'talisman') {
          expect(talismansById[reward.talismanId], quest.id).toBeDefined();
        }
      }
      for (const dialogId of Object.values(quest.dialogs)) {
        expect(dialogsById[dialogId], `${quest.id} → ${dialogId}`).toBeDefined();
      }
    }
  });

  it('every questGated recipe is taught by exactly one quest reward', () => {
    const rewardedRecipeIds = allQuests.flatMap((q) =>
      q.rewards.flatMap((r) => (r.kind === 'recipe' ? [r.recipeId] : [])),
    );
    for (const recipe of allRecipes.filter((r) => r.questGated)) {
      expect(
        rewardedRecipeIds.filter((id) => id === recipe.id),
        recipe.id,
      ).toHaveLength(1);
    }
  });

  it('collect nodes point at active quests with matching item requirements', () => {
    for (const node of questCollectNodes) {
      const quest = allQuests.find((q) => q.id === node.questId);
      expect(quest, node.id).toBeDefined();
      expect(quest!.requirement.kind, node.id).toBe('items');
      if (quest!.requirement.kind === 'items') {
        const line = quest!.requirement.items.find((i) => i.resource === node.resource);
        expect(line, node.id).toBeDefined();
        expect(node.amount, node.id).toBe(line!.amount);
      }
    }
  });
});
