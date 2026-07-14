import { describe, expect, it } from 'vitest';
import {
  buildings,
  buildingsBySlot,
  initialBuildingStages,
  villageConfig,
  BUILDING_SLOT_IDS,
} from '../../data/buildings';
import { build, canBuild, dishSlots, type BuildContext } from './buildings';

function ctx(overrides: Partial<BuildContext> = {}): BuildContext {
  return {
    inventory: {},
    flags: [],
    rescuedNpcs: [],
    friendshipLevels: {},
    ...overrides,
  };
}

describe('buildings data (docs/09 table)', () => {
  it('defines all 9 slots with at least one stage', () => {
    expect(buildings.map((b) => b.id)).toEqual([...BUILDING_SLOT_IDS]);
    for (const b of buildings) expect(b.stages.length).toBeGreaterThan(0);
  });

  it('starts with tent and starter stations built (B1–B3 stage 1)', () => {
    expect(initialBuildingStages.b1).toBe(1);
    expect(initialBuildingStages.b2).toBe(1);
    expect(initialBuildingStages.b3).toBe(1);
    expect(initialBuildingStages.b4).toBe(0);
  });
});

describe('canBuild', () => {
  it('allows a cost-only stage with enough material (B4 Wohnhaus 1)', () => {
    const check = canBuild(buildingsBySlot.b4, 0, ctx({ inventory: { wood: 10, stone: 6 } }));
    expect(check.allowed).toBe(true);
    expect(check.missing).toEqual([]);
  });

  it('reports material shortfall with have/need (UI text, docs/11)', () => {
    const check = canBuild(buildingsBySlot.b4, 0, ctx({ inventory: { wood: 3 } }));
    expect(check.allowed).toBe(false);
    expect(check.missing).toContainEqual({
      kind: 'material',
      resource: 'wood',
      have: 3,
      need: 10,
    });
    expect(check.missing).toContainEqual({
      kind: 'material',
      resource: 'stone',
      have: 0,
      need: 6,
    });
  });

  it('blocks B6 Kristallschrein until Orin is rescued (docs/09)', () => {
    const blocked = canBuild(buildingsBySlot.b6, 0, ctx({ inventory: { shadow_dust: 10 } }));
    expect(blocked.allowed).toBe(false);
    expect(blocked.missing).toEqual([
      { kind: 'requirement', requirement: { kind: 'npcRescued', npc: 'orin' } },
    ]);

    const allowed = canBuild(
      buildingsBySlot.b6,
      0,
      ctx({ inventory: { shadow_dust: 10 }, rescuedNpcs: ['orin'] }),
    );
    // B6 is independent of B7 (docs/09) — no building prerequisite exists.
    expect(allowed.allowed).toBe(true);
  });

  it('gates B2 kitchen upgrades on Tilda friendship (docs/09)', () => {
    const inventory = { wood: 6, stone: 4, resin: 2 };
    const blocked = canBuild(buildingsBySlot.b2, 1, ctx({ inventory }));
    expect(blocked.allowed).toBe(false);
    expect(blocked.missing).toEqual([
      { kind: 'requirement', requirement: { kind: 'friendship', npc: 'tilda', level: 1 } },
    ]);

    const allowed = canBuild(
      buildingsBySlot.b2,
      1,
      ctx({ inventory, friendshipLevels: { tilda: 1 } }),
    );
    expect(allowed.allowed).toBe(true);
  });

  it('gates B8 Markt on the island_cleansed flag (docs/09)', () => {
    const inventory = { wood: 12, stone: 4 };
    expect(canBuild(buildingsBySlot.b8, 0, ctx({ inventory })).allowed).toBe(false);
    expect(
      canBuild(buildingsBySlot.b8, 0, ctx({ inventory, flags: ['island_cleansed'] })).allowed,
    ).toBe(true);
  });

  it('allows B9 Bootshaus purely via the piya flag — no material (docs/09)', () => {
    expect(canBuild(buildingsBySlot.b9, 0, ctx()).allowed).toBe(false);
    expect(canBuild(buildingsBySlot.b9, 0, ctx({ flags: ['piya_chain_complete'] })).allowed).toBe(
      true,
    );
  });

  it('refuses beyond the final stage', () => {
    const check = canBuild(buildingsBySlot.b4, 1, ctx({ inventory: { wood: 99, stone: 99 } }));
    expect(check.allowed).toBe(false);
    expect(check.missing).toEqual([{ kind: 'max_stage' }]);
  });
});

describe('build', () => {
  it('deducts exactly the stage costs and advances the stage', () => {
    const result = build(
      buildingsBySlot.b1,
      1,
      ctx({ inventory: { wood: 10, stone: 4, berry: 2 } }),
    );
    // B1 stage 2 (Hütte): 8 Holz + 4 Stein (docs/09).
    expect(result).toEqual({ inventory: { wood: 2, berry: 2 }, stage: 2 });
  });

  it('returns null when blocked and leaves nothing mutated', () => {
    const inventory = { wood: 1 };
    expect(build(buildingsBySlot.b4, 0, ctx({ inventory }))).toBeNull();
    expect(inventory).toEqual({ wood: 1 });
  });

  it('builds the full B1 chain Zelt → Hütte → Haus (docs/09 costs)', () => {
    const hut = build(
      buildingsBySlot.b1,
      1,
      ctx({ inventory: { wood: 20, stone: 10, tough_leather: 2 } }),
    )!;
    expect(hut.stage).toBe(2);
    const house = build(buildingsBySlot.b1, hut.stage, ctx({ inventory: hut.inventory }))!;
    // Haus: 12 Holz + 6 Stein + 2 Zähes Leder.
    expect(house).toEqual({ inventory: {}, stage: 3 });
  });
});

describe('dishSlots (docs/09 B1 Haus effect)', () => {
  it('stays at the base without the finished house', () => {
    expect(dishSlots({ b1: 1 }, 1)).toBe(1);
    expect(dishSlots({ b1: 2 }, 1)).toBe(1);
  });

  it('adds +1 with the finished house (stage 3)', () => {
    expect(dishSlots({ b1: 3 }, 1)).toBe(2);
  });

  it('hard-caps at 2 — never additive with other bonuses (docs/09)', () => {
    // A future Lv-12 bonus raising the base cannot stack past the cap.
    expect(dishSlots({ b1: 3 }, 2)).toBe(villageConfig.dishSlotCap);
    expect(dishSlots({ b1: 3 }, 2)).toBe(2);
  });
});
