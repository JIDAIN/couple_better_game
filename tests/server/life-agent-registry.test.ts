import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createWeight: vi.fn(),
  listWeights: vi.fn(),
  updateWeight: vi.fn(),
  deleteWeight: vi.fn(),
  createMeal: vi.fn(),
  deleteMedicine: vi.fn(),
  getMailboxSender: vi.fn(),
  updateMailboxLetter: vi.fn(),
  saveHomeSyncSnapshot: vi.fn(),
}));

vi.mock("../../lib/server/supabase-weight", async () => {
  const actual = await vi.importActual<typeof import("../../lib/server/supabase-weight")>("../../lib/server/supabase-weight");
  return {
    ...actual,
    createWeight: mocks.createWeight,
    listWeights: mocks.listWeights,
    updateWeight: mocks.updateWeight,
    deleteWeight: mocks.deleteWeight,
  };
});

vi.mock("../../lib/server/supabase-nutrition", async () => {
  const actual = await vi.importActual<typeof import("../../lib/server/supabase-nutrition")>("../../lib/server/supabase-nutrition");
  return { ...actual, createMeal: mocks.createMeal };
});

vi.mock("../../lib/server/supabase-medicine", async () => {
  const actual = await vi.importActual<typeof import("../../lib/server/supabase-medicine")>("../../lib/server/supabase-medicine");
  return { ...actual, deleteMedicine: mocks.deleteMedicine };
});

vi.mock("../../lib/server/supabase-mailbox", async () => {
  const actual = await vi.importActual<typeof import("../../lib/server/supabase-mailbox")>("../../lib/server/supabase-mailbox");
  return {
    ...actual,
    getMailboxSender: mocks.getMailboxSender,
    updateMailboxLetter: mocks.updateMailboxLetter,
  };
});

vi.mock("../../lib/server/supabase-home-sync", async () => {
  const actual = await vi.importActual<typeof import("../../lib/server/supabase-home-sync")>("../../lib/server/supabase-home-sync");
  return { ...actual, saveHomeSyncSnapshot: mocks.saveHomeSyncSnapshot };
});

import { executeLifeAgentTool } from "../../lib/server/life-agent-registry";

const CAT = { partnerKey: "cat" as const, displayName: "猫猫" as const };

beforeEach(() => {
  vi.clearAllMocks();
});

describe("life internal AI registry guards", () => {
  it("forces personal weight writes to the authenticated account", async () => {
    mocks.createWeight.mockImplementation(async (payload) => payload);

    const result = await executeLifeAgentTool(
      "life_mutate",
      {
        resource: "weight",
        action: "create",
        data: {
          partnerKey: "fish",
          measurementDate: "2026-09-03",
          measuredAt: null,
          weightKg: 52.4,
          note: "test",
        },
      },
      { identity: CAT, latestUserText: "帮我记一下今天 52.4kg" },
    );

    expect(result).toMatchObject({ partnerKey: "cat", weightKg: 52.4 });
    expect(mocks.createWeight).toHaveBeenCalledWith(expect.objectContaining({ partnerKey: "cat" }));
  });

  it("normalizes natural meal item fields before the canonical parser", async () => {
    mocks.createMeal.mockImplementation(async (payload) => ({ id: "meal-1", ...payload }));

    const result = await executeLifeAgentTool(
      "life_mutate",
      {
        resource: "三餐",
        data: {
          mealType: "午饭",
          mealDate: "2026-09-05",
          items: [
            { name: "牛肉面", quantity: "1碗" },
            { foodName: "鸡蛋", amount: 1, unit: "个" },
          ],
        },
      },
      { identity: CAT, latestUserText: "帮我记录今天午饭：牛肉面一碗，鸡蛋一个", toolCallId: "meal-natural-test" },
    );

    expect(result).toMatchObject({
      partnerKey: "cat",
      mealDate: "2026-09-05",
      mealType: "lunch",
      items: [
        { rawName: "牛肉面", portionDescription: "1碗" },
        { rawName: "鸡蛋", portionDescription: "1个" },
      ],
    });
  });

  it("rejects delete calls when the latest user message did not ask to delete", async () => {
    await expect(
      executeLifeAgentTool(
        "life_mutate",
        { resource: "medicine", action: "delete", id: "00000000-0000-4000-8000-000000000001", data: {} },
        { identity: CAT, latestUserText: "这个药还有多少" },
      ),
    ).rejects.toThrow("明确要求删除");
    expect(mocks.deleteMedicine).not.toHaveBeenCalled();
  });

  it("cannot edit a letter sent by the other account", async () => {
    mocks.getMailboxSender.mockResolvedValue("fish");
    await expect(
      executeLifeAgentTool(
        "life_mutate",
        {
          resource: "mailbox",
          action: "update",
          id: "00000000-0000-4000-8000-000000000001",
          data: { body: "改一下", format: "letter" },
        },
        { identity: CAT, latestUserText: "把那封信改一下" },
      ),
    ).rejects.toThrow("只能修改当前账号自己发出的信");
    expect(mocks.updateMailboxLetter).not.toHaveBeenCalled();
  });

  it("requires the exact confirmation phrase for replacing the legacy game snapshot", async () => {
    await expect(
      executeLifeAgentTool(
        "life_mutate",
        { resource: "legacy_home", action: "replace", data: { wallet: { coins: 1 } } },
        { identity: CAT, latestUserText: "覆盖游戏数据" },
      ),
    ).rejects.toThrow("确认覆盖游戏数据");
    expect(mocks.saveHomeSyncSnapshot).not.toHaveBeenCalled();

    mocks.saveHomeSyncSnapshot.mockResolvedValue({ ok: true });
    await expect(
      executeLifeAgentTool(
        "life_mutate",
        { resource: "legacy_home", action: "replace", data: { wallet: { coins: 1 } } },
        { identity: CAT, latestUserText: "确认覆盖游戏数据" },
      ),
    ).resolves.toEqual({ ok: true });
  });
});
