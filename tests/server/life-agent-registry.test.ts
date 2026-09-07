import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createWeight: vi.fn(),
  listWeights: vi.fn(),
  updateWeight: vi.fn(),
  deleteWeight: vi.fn(),
  createMeal: vi.fn(),
  deleteMedicine: vi.fn(),
  createMailboxItem: vi.fn(),
  updateMailboxDraft: vi.fn(),
  sendMailboxDraft: vi.fn(),
  deleteMailboxDraft: vi.fn(),
  listMailboxItems: vi.fn(),
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
    createMailboxItem: mocks.createMailboxItem,
    updateMailboxDraft: mocks.updateMailboxDraft,
    sendMailboxDraft: mocks.sendMailboxDraft,
    deleteMailboxDraft: mocks.deleteMailboxDraft,
    listMailboxItems: mocks.listMailboxItems,
  };
});

vi.mock("../../lib/server/supabase-home-sync", async () => {
  const actual = await vi.importActual<typeof import("../../lib/server/supabase-home-sync")>("../../lib/server/supabase-home-sync");
  return { ...actual, saveHomeSyncSnapshot: mocks.saveHomeSyncSnapshot };
});

import { executeLifeAgentTool } from "../../lib/server/life-agent-registry";

const CAT = { partnerKey: "cat" as const, displayName: "猫猫" as const };
const LETTER_ID = "00000000-0000-4000-8000-000000000001";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("life internal AI registry guards", () => {
  it("rejects explicit Ta personal weight writes and permits current-account writes", async () => {
    mocks.createWeight.mockImplementation(async (payload) => payload);

    await expect(
      executeLifeAgentTool(
        "life_mutate",
        {
          resource: "weight",
          action: "create",
          data: {
            partnerKey: "fish",
            measurementDate: "2026-09-03",
            weightKg: 52.4,
          },
        },
        { identity: CAT, latestUserText: "帮我把对象体重记成52.4kg" },
      ),
    ).rejects.toThrow("不能指定 Ta");
    expect(mocks.createWeight).not.toHaveBeenCalled();

    const result = await executeLifeAgentTool(
      "life_mutate",
      {
        resource: "weight",
        action: "create",
        data: {
          measurementDate: "2026-09-03",
          weightKg: 52.4,
          note: "test",
        },
      },
      { identity: CAT, latestUserText: "帮我记一下今天 52.4kg" },
    );

    expect(result).toMatchObject({ partnerKey: "cat", weightKg: 52.4 });
    expect(mocks.createWeight).toHaveBeenCalledWith(
      expect.objectContaining({ partnerKey: "cat" }),
      "cat",
    );
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
        { resource: "medicine", action: "delete", id: LETTER_ID, data: {} },
        { identity: CAT, latestUserText: "这个药还有多少" },
      ),
    ).rejects.toThrow("明确要求删除");
    expect(mocks.deleteMedicine).not.toHaveBeenCalled();
  });

  it("creates mailbox content as a private draft by default", async () => {
    mocks.createMailboxItem.mockImplementation(async (_actor, payload, status) => ({
      id: LETTER_ID,
      ...payload,
      status,
      sentAt: null,
      source: "chatgpt",
      createdAt: "2026-09-07T00:00:00Z",
      updatedAt: "2026-09-07T00:00:00Z",
    }));

    const result = await executeLifeAgentTool(
      "life_mutate",
      {
        resource: "mailbox",
        action: "create",
        data: { format: "letter", title: "晚安", body: "今天也辛苦啦。" },
      },
      { identity: CAT, latestUserText: "帮我写一封给她的晚安小信，先存着" },
    );

    expect(result).toMatchObject({ status: "draft", senderKey: "cat", recipientKey: "fish" });
    expect(mocks.createMailboxItem).toHaveBeenCalledWith(
      "cat",
      expect.objectContaining({
        senderKey: "cat",
        recipientKey: "fish",
        title: "晚安",
        body: "今天也辛苦啦。",
      }),
      "draft",
      "chatgpt",
    );
  });

  it("only sends a new mailbox item when status is explicitly sent", async () => {
    mocks.createMailboxItem.mockImplementation(async (_actor, payload, status) => ({
      id: LETTER_ID,
      ...payload,
      status,
      sentAt: status === "sent" ? "2026-09-07T00:00:00Z" : null,
      source: "chatgpt",
      createdAt: "2026-09-07T00:00:00Z",
      updatedAt: "2026-09-07T00:00:00Z",
    }));

    await executeLifeAgentTool(
      "life_mutate",
      {
        resource: "mailbox",
        action: "create",
        data: { format: "postcard", body: "想你啦。", status: "sent" },
      },
      { identity: CAT, latestUserText: "帮我把这张明信片现在就寄给她" },
    );

    expect(mocks.createMailboxItem).toHaveBeenCalledWith(
      "cat",
      expect.objectContaining({ status: "sent", body: "想你啦。" }),
      "sent",
      "chatgpt",
    );
  });

  it("updates an existing draft and then sends the same draft", async () => {
    mocks.updateMailboxDraft.mockResolvedValue({ id: LETTER_ID, status: "draft" });
    mocks.sendMailboxDraft.mockResolvedValue({ id: LETTER_ID, status: "sent" });

    const result = await executeLifeAgentTool(
      "life_mutate",
      {
        resource: "mailbox",
        action: "update",
        id: LETTER_ID,
        data: {
          format: "letter",
          title: "晚安",
          body: "今天也辛苦啦。",
          status: "sent",
        },
      },
      { identity: CAT, latestUserText: "把这份待寄出现在寄出去" },
    );

    expect(mocks.updateMailboxDraft).toHaveBeenCalledWith(
      "cat",
      LETTER_ID,
      expect.objectContaining({ status: "sent" }),
      "chatgpt",
    );
    expect(mocks.sendMailboxDraft).toHaveBeenCalledWith("cat", LETTER_ID, "chatgpt");
    expect(result).toEqual({ id: LETTER_ID, status: "sent" });
  });

  it("deletes only through the draft-specific mailbox operation", async () => {
    mocks.deleteMailboxDraft.mockResolvedValue({ id: LETTER_ID, status: "draft" });

    await expect(
      executeLifeAgentTool(
        "life_mutate",
        { resource: "mailbox", action: "delete", id: LETTER_ID, data: {} },
        { identity: CAT, latestUserText: "删除这份待寄出草稿" },
      ),
    ).resolves.toEqual({ id: LETTER_ID, status: "draft" });

    expect(mocks.deleteMailboxDraft).toHaveBeenCalledWith("cat", LETTER_ID);
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
