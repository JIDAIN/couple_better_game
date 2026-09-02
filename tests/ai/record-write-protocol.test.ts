import { describe, expect, it } from "vitest";
import {
  buildChatgptWriteIdempotencyKey,
  isChatgptWriteIdempotencyKey,
} from "../../lib/ai/record-write-protocol";

describe("record-write-protocol", () => {
  it("builds domain-scoped ChatGPT retry keys", () => {
    const key = buildChatgptWriteIdempotencyKey({
      domain: "mood",
      scope: "fish",
      recordDate: "2026-09-02",
      confirmationNonce: "turn-123",
    });

    expect(key).toBe("chatgpt:mood:fish:2026-09-02:turn-123");
    expect(isChatgptWriteIdempotencyKey(key, "mood")).toBe(true);
    expect(isChatgptWriteIdempotencyKey(key, "sleep")).toBe(false);
  });

  it("supports domains that do not belong to one partner", () => {
    const key = buildChatgptWriteIdempotencyKey({
      domain: "medicine",
      scope: "household",
      recordDate: "2026-09-02",
      confirmationNonce: "new-box-1",
    });
    expect(key.startsWith("chatgpt:medicine:household:")).toBe(true);
  });

  it("rejects empty normalized segments", () => {
    expect(() =>
      buildChatgptWriteIdempotencyKey({
        domain: "weight",
        scope: "fish",
        recordDate: "2026-09-02",
        confirmationNonce: "   ",
      }),
    ).toThrow();
  });
});
