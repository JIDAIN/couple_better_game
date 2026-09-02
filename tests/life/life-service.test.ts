import { describe, expect, it } from "vitest";
import {
  parseActivityWritePayload,
  parseLifeDayDate,
  parseMoodWritePayload,
  parseSleepWritePayload,
} from "../../lib/life/life-service";

describe("life-service", () => {
  it("accepts a simple manual mood record", () => {
    const result = parseMoodWritePayload({
      partnerKey: "fish",
      moodDate: "2026-09-02",
      moodKey: "calm",
      source: "manual",
    });
    expect(result).toEqual({
      ok: true,
      value: {
        partnerKey: "fish",
        moodDate: "2026-09-02",
        moodKey: "calm",
        source: "manual",
      },
    });
  });

  it("rejects invalid calendar dates", () => {
    expect(parseLifeDayDate("2026-02-31").ok).toBe(false);
  });

  it("normalizes sleep timestamps and requires wake after sleep", () => {
    const valid = parseSleepWritePayload({
      partnerKey: "cat",
      sleepDate: "2026-09-02",
      fellAsleepAt: "2026-09-01T16:30:00.000Z",
      wokeAt: "2026-09-02T00:15:00.000Z",
      source: "manual",
    });
    expect(valid.ok).toBe(true);

    const invalid = parseSleepWritePayload({
      partnerKey: "cat",
      sleepDate: "2026-09-02",
      fellAsleepAt: "2026-09-02T00:15:00.000Z",
      wokeAt: "2026-09-01T16:30:00.000Z",
      source: "manual",
    });
    expect(invalid.ok).toBe(false);
  });

  it("keeps activity entry lightweight while preserving optional structure", () => {
    const result = parseActivityWritePayload({
      activityDate: "2026-09-02",
      text: " 晚上散步半小时 ",
      participantScope: "both",
      durationMinutes: 30,
      activityType: "walk",
      source: "manual",
    });
    expect(result).toEqual({
      ok: true,
      value: {
        activityDate: "2026-09-02",
        occurredAt: null,
        text: "晚上散步半小时",
        participantScope: "both",
        durationMinutes: 30,
        activityType: "walk",
        source: "manual",
      },
    });
  });

  it("does not allow browser-style manual records to carry external idempotency keys", () => {
    const result = parseMoodWritePayload({
      partnerKey: "fish",
      moodDate: "2026-09-02",
      moodKey: "happy",
      source: "manual",
      idempotencyKey: "chatgpt:mood:fish:2026-09-02:test",
    });
    expect(result.ok).toBe(false);
  });
});
