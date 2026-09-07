import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  canonicalExecute: vi.fn(),
  getLifeExport: vi.fn(),
  listMedicines: vi.fn(),
  listWeights: vi.fn(),
  listMailboxLetters: vi.fn(),
}));

vi.mock("../../lib/server/life-agent-registry", () => ({
  LIFE_AGENT_TOOLS: [],
  executeLifeAgentTool: mocks.canonicalExecute,
}));

vi.mock("../../lib/server/life-data-management", () => ({
  getLifeExport: mocks.getLifeExport,
}));

vi.mock("../../lib/server/supabase-medicine", () => ({
  listMedicines: mocks.listMedicines,
}));

vi.mock("../../lib/server/supabase-weight", () => ({
  listWeights: mocks.listWeights,
}));

vi.mock("../../lib/server/supabase-mailbox", () => ({
  listMailboxLetters: mocks.listMailboxLetters,
}));

import { executeLifeAgentTool } from "../../lib/server/life-agent-executor";

const CAT = { partnerKey: "cat" as const, displayName: "猫猫" as const };
const ID = "00000000-0000-4000-8000-000000000001";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.canonicalExecute.mockImplementation(async (_name, args) => args);
});

describe("AI partial update hydration", () => {
  it("merges a medicine quantity-only update with the stored canonical record", async () => {
    mocks.listMedicines.mockResolvedValue([
      {
        id: ID,
        name: "布洛芬",
        productionDate: "2026-01-01",
        shelfLifeMonths: 24,
        packageExpiryDate: "2028-01-01",
        openedDate: null,
        openedShelfLifeDays: null,
        quantity: 1,
        note: "饭后",
      },
    ]);

    await executeLifeAgentTool(
      "life_mutate",
      { resource: "药品", action: "修改", id: ID, data: { count: 2 } },
      { identity: CAT, latestUserText: "把这盒布洛芬数量改成2" },
    );

    expect(mocks.canonicalExecute).toHaveBeenCalledWith(
      "life_mutate",
      expect.objectContaining({
        resource: "medicine",
        action: "update",
        id: ID,
        data: expect.objectContaining({
          name: "布洛芬",
          quantity: 2,
          productionDate: "2026-01-01",
          note: "饭后",
        }),
      }),
      expect.any(Object),
    );
  });

  it("preserves meal items when only the meal note changes", async () => {
    mocks.getLifeExport.mockResolvedValue({
      user: {
        meals: [
          {
            id: ID,
            partner_key: "cat",
            meal_date: "2026-09-05",
            meal_type: "lunch",
            snack_period: null,
            eaten_at: null,
            note: "旧备注",
            deleted_at: null,
          },
        ],
        meal_items: [
          {
            id: "item-1",
            meal_id: ID,
            raw_name: "牛肉面",
            display_name: "牛肉面",
            portion_description: "1碗",
            sort_order: 0,
          },
        ],
      },
    });

    await executeLifeAgentTool(
      "life_mutate",
      { resource: "三餐", action: "update", id: ID, data: { note: "少辣" } },
      { identity: CAT, latestUserText: "把这顿午饭备注改成少辣" },
    );

    expect(mocks.canonicalExecute).toHaveBeenCalledWith(
      "life_mutate",
      expect.objectContaining({
        resource: "meal",
        action: "update",
        data: expect.objectContaining({
          mealDate: "2026-09-05",
          mealType: "lunch",
          note: "少辣",
          items: [expect.objectContaining({ rawName: "牛肉面", portionDescription: "1碗" })],
        }),
      }),
      expect.any(Object),
    );
  });

  it("does not hydrate deletes", async () => {
    await executeLifeAgentTool(
      "life_mutate",
      { resource: "药品", action: "删除", id: ID, data: {} },
      { identity: CAT, latestUserText: "删除这盒药" },
    );

    expect(mocks.listMedicines).not.toHaveBeenCalled();
    expect(mocks.canonicalExecute).toHaveBeenCalledWith(
      "life_mutate",
      { resource: "药品", action: "删除", id: ID, data: {} },
      expect.any(Object),
    );
  });
});

describe("AI Cat/Fish activity boundary", () => {
  it("rejects Cat updating a Fish-only activity", async () => {
    mocks.getLifeExport.mockResolvedValue({
      user: {
        activity_entries: [
          {
            id: ID,
            activity_date: "2026-09-07",
            text: "鱼鱼散步",
            participant_scope: "fish",
            source: "manual",
            deleted_at: null,
          },
        ],
      },
    });

    await expect(
      executeLifeAgentTool(
        "life_mutate",
        { resource: "activity", action: "update", id: ID, data: { text: "被越权修改" } },
        { identity: CAT, latestUserText: "修改这条活动" },
      ),
    ).rejects.toThrow("当前账号无权修改");
    expect(mocks.canonicalExecute).not.toHaveBeenCalled();
  });

  it("rejects Cat deleting a Fish-only activity", async () => {
    mocks.getLifeExport.mockResolvedValue({
      user: {
        activity_entries: [
          {
            id: ID,
            activity_date: "2026-09-07",
            text: "鱼鱼散步",
            participant_scope: "fish",
            source: "manual",
            deleted_at: null,
          },
        ],
      },
    });

    await expect(
      executeLifeAgentTool(
        "life_mutate",
        { resource: "activity", action: "delete", id: ID, data: {} },
        { identity: CAT, latestUserText: "删除这条活动" },
      ),
    ).rejects.toThrow("当前账号无权删除");
    expect(mocks.canonicalExecute).not.toHaveBeenCalled();
  });

  it("allows a shared activity to remain shared", async () => {
    mocks.getLifeExport.mockResolvedValue({
      user: {
        activity_entries: [
          {
            id: ID,
            activity_date: "2026-09-07",
            text: "一起散步",
            participant_scope: "both",
            source: "manual",
            deleted_at: null,
          },
        ],
      },
    });

    await executeLifeAgentTool(
      "life_mutate",
      { resource: "activity", action: "update", id: ID, data: { text: "一起逛公园" } },
      { identity: CAT, latestUserText: "把这条共同活动改成一起逛公园" },
    );

    expect(mocks.canonicalExecute).toHaveBeenCalledWith(
      "life_mutate",
      expect.objectContaining({
        resource: "activity",
        action: "update",
        data: expect.objectContaining({ participantScope: "both", text: "一起逛公园" }),
      }),
      expect.any(Object),
    );
  });

  it("does not allow one actor to privatize a shared activity", async () => {
    mocks.getLifeExport.mockResolvedValue({
      user: {
        activity_entries: [
          {
            id: ID,
            activity_date: "2026-09-07",
            text: "一起散步",
            participant_scope: "both",
            source: "manual",
            deleted_at: null,
          },
        ],
      },
    });

    await expect(
      executeLifeAgentTool(
        "life_mutate",
        { resource: "activity", action: "update", id: ID, data: { participantScope: "cat" } },
        { identity: CAT, latestUserText: "把它改成我的活动" },
      ),
    ).rejects.toThrow("双方共同活动不能由一方改成单方活动");
    expect(mocks.canonicalExecute).not.toHaveBeenCalled();
  });
});
