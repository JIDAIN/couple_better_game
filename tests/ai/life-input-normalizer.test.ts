import { describe, expect, it } from "vitest";
import {
  LifeClarificationError,
  normalizeLifeMutationArgs,
  normalizeLifeQueryArgs,
} from "../../lib/ai/life-input-normalizer";

const NOW = new Date("2026-09-05T08:00:00.000Z");
const context = (text: string, hasAttachment = false) => ({
  latestUserText: text,
  actor: "cat" as const,
  hasAttachment,
  now: NOW,
});

describe("life natural input query normalization", () => {
  it("defaults day queries to today and accepts Chinese resource aliases", () => {
    expect(normalizeLifeQueryArgs({ resource: "心情" }, context("看看我今天心情怎么样"))).toMatchObject({
      resource: "day",
      date: "2026-09-05",
    });
  });

  it("maps meal person aliases", () => {
    expect(normalizeLifeQueryArgs({ resource: "三餐", person: "对象" }, context("看看对象今天吃了什么"))).toMatchObject({
      resource: "meal",
      date: "2026-09-05",
      person: "ta",
    });
  });

  it("maps medicine search aliases", () => {
    expect(normalizeLifeQueryArgs({ resource: "药箱", keyword: "布洛芬" }, context("药箱有布洛芬吗"))).toMatchObject({
      resource: "medicine",
      name: "布洛芬",
    });
  });
});

describe("life natural input mutation normalization", () => {
  it("maps mood labels and defaults date/action", () => {
    expect(normalizeLifeMutationArgs({ resource: "心情", data: { mood: "心动" } }, context("帮我记一下今天心动"))).toMatchObject({
      resource: "mood",
      action: "upsert",
      data: { moodDate: "2026-09-05", moodKey: "neutral" },
    });
  });

  it("normalizes meal item aliases and portions", () => {
    const result = normalizeLifeMutationArgs({
      resource: "三餐",
      data: {
        mealType: "午饭",
        items: [
          { name: "牛肉面", quantity: "1碗" },
          { foodName: "鸡蛋", amount: 1, unit: "个" },
        ],
      },
    }, context("帮我记录今天午饭：牛肉面一碗，鸡蛋一个"));

    expect(result).toMatchObject({
      resource: "meal",
      action: "create",
      data: {
        mealDate: "2026-09-05",
        mealType: "lunch",
        items: [
          { rawName: "牛肉面", displayName: "牛肉面", portionDescription: "1碗" },
          { rawName: "鸡蛋", displayName: "鸡蛋", portionDescription: "1个" },
        ],
      },
    });
  });

  it("allows photo-only meal draft input without inventing foods", () => {
    const result = normalizeLifeMutationArgs({ resource: "meal", attachPhoto: true, data: { mealType: "lunch" } }, context("把这张午饭照片记进去", true));
    expect(result).toMatchObject({ data: { items: [], mealType: "lunch" } });
  });

  it("normalizes weight strings", () => {
    expect(normalizeLifeMutationArgs({ resource: "体重", data: { weight: "64.8kg" } }, context("今天64.8kg，帮我记一下"))).toMatchObject({
      resource: "weight",
      action: "create",
      data: { measurementDate: "2026-09-05", weightKg: 64.8 },
    });
  });

  it("defaults new medicine quantity to one and maps name aliases", () => {
    expect(normalizeLifeMutationArgs({ resource: "药品", data: { medicineName: "布洛芬" } }, context("药箱加一个布洛芬"))).toMatchObject({
      resource: "medicine",
      action: "create",
      data: { name: "布洛芬", quantity: 1 },
    });
  });

  it("maps mailbox content and postcard format", () => {
    expect(normalizeLifeMutationArgs({ resource: "信箱", data: { type: "明信片", content: "周末一起去散步吧" } }, context("给她写张明信片"))).toMatchObject({
      resource: "mailbox",
      action: "create",
      data: { format: "postcard", body: "周末一起去散步吧" },
    });
  });

  it("normalizes activity duration and participant scope", () => {
    expect(normalizeLifeMutationArgs({ resource: "活动", data: { name: "散步", person: "我们", duration: "1小时30分钟" } }, context("我们散步了一个半小时，记一下"))).toMatchObject({
      resource: "activity",
      action: "create",
      data: { activityDate: "2026-09-05", text: "散步", participantScope: "both", durationMinutes: 90 },
    });
  });

  it("normalizes settings aliases", () => {
    expect(normalizeLifeMutationArgs({ resource: "设置", data: { targetWeight: "55kg" } }, context("目标体重改成55kg"))).toMatchObject({
      resource: "settings",
      action: "update",
      data: { targetWeightKg: 55 },
    });
  });

  it("asks a user-facing clarification rather than exposing backend fields", () => {
    expect(() => normalizeLifeMutationArgs({ resource: "体重", data: {} }, context("帮我记一下体重"))).toThrow(LifeClarificationError);
    expect(() => normalizeLifeMutationArgs({ resource: "meal", data: { mealType: "lunch" } }, context("帮我记午饭"))).toThrow("需要向用户确认：这顿饭吃了什么？");
    expect(() => normalizeLifeMutationArgs({ resource: "medicine", data: {} }, context("药箱帮我记一下"))).toThrow("需要向用户确认：要记录哪种药？");
  });

  it("never guesses record ids for destructive operations", () => {
    const result = normalizeLifeMutationArgs({ resource: "medicine", action: "删除", data: { name: "布洛芬" } }, context("删除布洛芬"));
    expect(result.action).toBe("delete");
    expect(result.id).toBeUndefined();
  });
});
