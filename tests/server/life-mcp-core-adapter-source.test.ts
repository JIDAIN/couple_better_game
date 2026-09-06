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

  it("passes MCP meal files through the existing compression/media boundary", () => {
    expect(adapter).toContain("compressMealPhoto");
    expect(adapter).toContain('"openai/fileParams": ["file"]');
    expect(adapter).toContain("forwarded.attachPhoto = true");
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
