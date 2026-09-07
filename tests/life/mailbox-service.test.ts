import { describe, expect, it } from "vitest";
import { parseMailboxPayload } from "../../lib/life/mailbox-service";

describe("mailbox payload", () => {
  it("accepts a letter between the two partners", () => {
    expect(parseMailboxPayload({ senderKey: "cat", recipientKey: "fish", format: "letter", body: "今天也辛苦啦" })).toEqual({
      ok: true,
      value: {
        senderKey: "cat",
        recipientKey: "fish",
        format: "letter",
        title: null,
        themeKey: "cream",
        body: "今天也辛苦啦",
        sentAt: null,
      },
    });
  });

  it("preserves letter title and theme metadata", () => {
    const parsed = parseMailboxPayload({
      senderKey: "fish",
      recipientKey: "cat",
      format: "letter",
      title: "今天想你",
      themeKey: "mint",
      body: "早点回来呀",
      status: "draft",
    });
    expect(parsed).toMatchObject({
      ok: true,
      value: { title: "今天想你", themeKey: "mint", status: "draft" },
    });
  });

  it("keeps postcards title-free", () => {
    const parsed = parseMailboxPayload({
      senderKey: "fish",
      recipientKey: "cat",
      format: "postcard",
      title: "不会作为明信片标题保存",
      themeKey: "mint",
      body: "早点回来呀",
    });
    expect(parsed).toMatchObject({ ok: true, value: { title: null, themeKey: "mint" } });
  });

  it("rejects self-addressed letters", () => {
    expect(parseMailboxPayload({ senderKey: "cat", recipientKey: "cat", body: "hi" }).ok).toBe(false);
  });

  it("rejects empty, overly long, and invalid-state content", () => {
    expect(parseMailboxPayload({ senderKey: "cat", recipientKey: "fish", body: " " }).ok).toBe(false);
    expect(parseMailboxPayload({ senderKey: "cat", recipientKey: "fish", body: "a".repeat(2001) }).ok).toBe(false);
    expect(parseMailboxPayload({ senderKey: "cat", recipientKey: "fish", body: "hi", status: "archived" }).ok).toBe(false);
  });
});
