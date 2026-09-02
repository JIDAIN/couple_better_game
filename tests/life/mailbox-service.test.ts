import { describe, expect, it } from "vitest";
import { parseMailboxPayload } from "../../lib/life/mailbox-service";

describe("mailbox payload", () => {
  it("accepts a letter between the two partners", () => {
    expect(parseMailboxPayload({ senderKey: "cat", recipientKey: "fish", format: "letter", body: "今天也辛苦啦" })).toEqual({ ok: true, value: { senderKey: "cat", recipientKey: "fish", format: "letter", body: "今天也辛苦啦", sentAt: null } });
  });
  it("rejects self-addressed letters", () => {
    expect(parseMailboxPayload({ senderKey: "cat", recipientKey: "cat", body: "hi" }).ok).toBe(false);
  });
  it("rejects empty and overly long content", () => {
    expect(parseMailboxPayload({ senderKey: "cat", recipientKey: "fish", body: " " }).ok).toBe(false);
    expect(parseMailboxPayload({ senderKey: "cat", recipientKey: "fish", body: "a".repeat(2001) }).ok).toBe(false);
  });
});
