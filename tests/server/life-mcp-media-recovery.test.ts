import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createLifeMediaRecovery,
  resolveLifeMediaRecovery,
} from "../../lib/server/life-mcp-media-recovery";

describe("life MCP media recovery token", () => {
  const previousSecret = process.env.LIFE_MCP_SIGNING_SECRET;
  const previousBaseUrl = process.env.LIFE_PUBLIC_BASE_URL;

  beforeEach(() => {
    process.env.LIFE_MCP_SIGNING_SECRET = "test-secret-that-is-definitely-longer-than-thirty-two-bytes";
    process.env.LIFE_PUBLIC_BASE_URL = "https://example.test";
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-06T04:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
    if (previousSecret == null) delete process.env.LIFE_MCP_SIGNING_SECRET;
    else process.env.LIFE_MCP_SIGNING_SECRET = previousSecret;
    if (previousBaseUrl == null) delete process.env.LIFE_PUBLIC_BASE_URL;
    else process.env.LIFE_PUBLIC_BASE_URL = previousBaseUrl;
  });

  it("creates an opaque ten-minute browser recovery URL and resolves the signed payload", () => {
    const recovery = createLifeMediaRecovery({
      partnerKey: "cat",
      args: {
        resource: "meal",
        action: "create",
        attachPhoto: true,
        data: { mealType: "breakfast", items: [{ rawName: "鸡蛋", quantity: 2 }] },
      },
      userText: "把这张早餐照片记录下来，图片也要保存。",
      toolCallId: "call-123",
    });

    expect(recovery.expiresInSeconds).toBe(600);
    const url = new URL(recovery.uploadUrl);
    expect(url.origin).toBe("https://example.test");
    expect(url.pathname).toBe("/ai-media-upload");
    const token = url.searchParams.get("token");
    expect(token).toBeTruthy();
    expect(token).not.toContain("breakfast");
    expect(token).not.toContain("鸡蛋");

    const payload = resolveLifeMediaRecovery(token!);
    expect(payload?.partnerKey).toBe("cat");
    expect(payload?.operationId).toBe("call-123");
    expect(payload?.userText).toContain("早餐照片");
    expect(payload?.args).toMatchObject({ resource: "meal", action: "create", attachPhoto: true });
  });

  it("rejects tampering and expiry", () => {
    const recovery = createLifeMediaRecovery({
      partnerKey: "fish",
      args: { resource: "meal", action: "create", attachPhoto: true },
      userText: "记录照片",
    });
    const token = new URL(recovery.uploadUrl).searchParams.get("token")!;
    const changed = `${token.slice(0, -1)}${token.endsWith("a") ? "b" : "a"}`;
    expect(resolveLifeMediaRecovery(changed)).toBeNull();

    vi.advanceTimersByTime(601_000);
    expect(resolveLifeMediaRecovery(token)).toBeNull();
  });
});
