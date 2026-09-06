import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const adapter = readFileSync(join(root, "lib/server/life-mcp-tools.ts"), "utf8");
const route = readFileSync(join(root, "app/mcp/route.ts"), "utf8");

describe("R11 MCP -> AI Access Core adapter source contract", () => {
  it("reuses the canonical life agent executor instead of maintaining a second business implementation", () => {
    expect(adapter).toContain('from "@/lib/server/life-agent-executor"');
    expect(adapter).toContain("LIFE_AGENT_TOOLS.map(mcpToolDefinition)");
    expect(adapter).toContain("executeLifeAgentTool(name, forwarded");
    expect(adapter).not.toContain('name: "life_write"');
  });

  it("exposes the unified life_query/life_mutate contract", () => {
    expect(route).toContain("Use life_query for normal reads and life_mutate for writes");
    expect(adapter).toContain('name === "life_mutate"');
    expect(adapter).toContain('required.push("userText")');
  });

  it("tells MCP models to complete meal nutrition by default without inventing unknown facts", () => {
    expect(adapter).toContain("LIFE_MUTATE_MEAL_NUTRITION_ORCHESTRATION");
    expect(adapter).toContain("默认目标不是只保存食物名称");
    expect(adapter).toContain("estimatedWeightG");
    expect(adapter).toContain("caloriesKcal");
    expect(adapter).toContain("proteinG");
    expect(adapter).toContain("carbsG");
    expect(adapter).toContain("fatG");
    expect(adapter).toContain("totalCaloriesKcal");
    expect(adapter).toContain("实际吃下去的量");
    expect(adapter).toContain("数据库仍允许真正无法判断的营养字段为 null");
  });

  it("keeps destructive safety in the core by forwarding the latest user message", () => {
    expect(adapter).toContain("latestUserText");
    expect(adapter).toContain("USER_TEXT_REQUIRED");
    expect(adapter).toContain("toolCallId: options.toolCallId");
  });

  it("preserves OAuth scope isolation and fixed identity binding", () => {
    expect(adapter).toContain('assertScope(identity, "life:write")');
    expect(adapter).toContain('assertScope(identity, "life:read")');
    expect(adapter).toContain("identityOf(identity)");
  });

  it("passes OpenAI MCP meal files through the existing compression/media boundary", () => {
    expect(adapter).toContain("compressMealPhoto");
    expect(adapter).toContain('"openai/fileParams": ["file"]');
    expect(adapter).toContain("prepareFileAttachment");
    expect(adapter).toContain("forwarded.attachPhoto = true");
  });

  it("adds a client-neutral inline image path without opening arbitrary remote URL fetching", () => {
    expect(adapter).toContain("INLINE_IMAGE_SCHEMA");
    expect(adapter).toContain("data_base64");
    expect(adapter).toContain("prepareInlineAttachment");
    expect(adapter).toContain("INVALID_IMAGE_MIME_TYPE");
    expect(adapter).toContain("PHOTO_TOO_LARGE");
    expect(adapter).not.toContain("properties.imageUrl");
    expect(adapter).not.toContain("properties.fileUrl");
  });

  it("fails explicitly and offers a non-retryable recovery when image bytes are missing", () => {
    expect(adapter).toContain("MEDIA_ATTACHMENT_REQUIRED");
    expect(adapter).toContain("photoRequested(args) && !attachment");
    expect(adapter).toContain("mutationExecuted: false");
    expect(adapter).toContain("retryable: false");
    expect(adapter).toContain('type: "browser_upload"');
    expect(adapter).toContain("不要重复 create/update");
  });

  it("does not allow two competing media sources in one mutation", () => {
    expect(adapter).toContain("MULTIPLE_MEDIA_INPUTS");
    expect(adapter).toContain("args.file != null && args.media != null");
  });

  it("returns canonical clarification details without converting them to schema debugging", () => {
    expect(adapter).toContain("LifeClarificationError");
    expect(adapter).toContain("clarification:");
    expect(adapter).toContain("question: error.question");
  });

  it("uses the JSON-RPC request id as the MCP tool call idempotency seed", () => {
    expect(route).toContain("toolCallId(message.id)");
    expect(route).toContain("mcp:${String(id)}");
  });
});
