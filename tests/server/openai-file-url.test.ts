import { describe, expect, it } from "vitest";
import { isAllowedOpenAiFileUrl } from "../../lib/server/openai-file-url";

describe("OpenAI MCP file URL allowlist", () => {
  it("keeps the existing OpenAI and ChatGPT download hosts trusted", () => {
    expect(isAllowedOpenAiFileUrl("https://files.oaiusercontent.com/file-123")).toBe(true);
    expect(isAllowedOpenAiFileUrl("https://chatgpt.com/backend-api/files/file-123")).toBe(true);
    expect(isAllowedOpenAiFileUrl("https://api.openai.com/files/file-123/content")).toBe(true);
  });

  it("accepts the narrowly scoped OpenAI runtime Azure Blob host pattern", () => {
    expect(
      isAllowedOpenAiFileUrl(
        "https://oaisdmntpreastus2.blob.core.windows.net/runtime/file-123?sv=2026-01-01&sig=test",
      ),
    ).toBe(true);
    expect(
      isAllowedOpenAiFileUrl(
        "https://oaisdmntprjapaneast.blob.core.windows.net/runtime/file-456?sv=2026-01-01&sig=test",
      ),
    ).toBe(true);
  });

  it("does not trust arbitrary Azure Blob accounts or lookalike hosts", () => {
    expect(isAllowedOpenAiFileUrl("https://evil.blob.core.windows.net/runtime/file-123")).toBe(false);
    expect(isAllowedOpenAiFileUrl("https://oaisdmntpr.blob.core.windows.net/runtime/file-123")).toBe(false);
    expect(isAllowedOpenAiFileUrl("https://oaisdmntpreastus2.blob.core.windows.net.evil.example/file")).toBe(false);
    expect(isAllowedOpenAiFileUrl("http://oaisdmntpreastus2.blob.core.windows.net/runtime/file-123")).toBe(false);
  });
});
