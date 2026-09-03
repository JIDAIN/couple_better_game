import { describe, expect, it } from "vitest";
import {
  buildWechatReminderMessage,
  harborAiName,
  parseClaimedLifeReminder,
} from "../../lib/server/life-wechat-reminders";

const DELIVERY_ID = "123e4567-e89b-42d3-a456-426614174000";

describe("life WeChat reminders", () => {
  it("binds Harbor aliases to fixed actors", () => {
    expect(harborAiName("cat")).toBe("团子");
    expect(harborAiName("fish")).toBe("仔仔");
  });

  it("builds a low-pressure daily reminder for cat", () => {
    const message = buildWechatReminderMessage("cat", {
      deliveryId: DELIVERY_ID,
      kind: "daily_record",
      localDate: "2026-09-03",
      targetDate: null,
      daysUntil: null,
    });

    expect(message.title).toBe("团子提醒｜今天还没记录");
    expect(message.content).toContain("记一点就好");
    expect(message.content).toContain("不用补全");
    expect(message.content).toContain("不用和 Ta 比较");
    expect(message.content).toContain("——团子");
  });

  it("builds fish anniversary reminders for seven days, tomorrow, and today", () => {
    const sevenDays = buildWechatReminderMessage("fish", {
      deliveryId: DELIVERY_ID,
      kind: "anniversary",
      localDate: "2026-09-03",
      targetDate: "2026-09-10",
      daysUntil: 7,
    });
    const tomorrow = buildWechatReminderMessage("fish", {
      deliveryId: DELIVERY_ID,
      kind: "anniversary",
      localDate: "2026-09-09",
      targetDate: "2026-09-10",
      daysUntil: 1,
    });
    const today = buildWechatReminderMessage("fish", {
      deliveryId: DELIVERY_ID,
      kind: "anniversary",
      localDate: "2026-09-10",
      targetDate: "2026-09-10",
      daysUntil: 0,
    });

    expect(sevenDays.title).toBe("仔仔提醒｜纪念日还有 7 天");
    expect(sevenDays.content).toContain("——仔仔");
    expect(tomorrow.title).toBe("仔仔提醒｜明天是你们的纪念日");
    expect(today.title).toBe("仔仔提醒｜今天是你们的纪念日");
  });

  it("parses valid reminder claims and rejects malformed claims", () => {
    expect(
      parseClaimedLifeReminder({
        deliveryId: DELIVERY_ID,
        kind: "anniversary",
        localDate: "2026-09-03",
        targetDate: "2026-09-10",
        daysUntil: 7,
      }),
    ).toEqual({
      deliveryId: DELIVERY_ID,
      kind: "anniversary",
      localDate: "2026-09-03",
      targetDate: "2026-09-10",
      daysUntil: 7,
    });

    expect(parseClaimedLifeReminder({ deliveryId: "bad", kind: "daily_record", localDate: "2026-09-03" })).toBeNull();
    expect(parseClaimedLifeReminder({ deliveryId: DELIVERY_ID, kind: "unknown", localDate: "2026-09-03" })).toBeNull();
    expect(parseClaimedLifeReminder({ deliveryId: DELIVERY_ID, kind: "daily_record", localDate: "09/03/2026" })).toBeNull();
  });
});
