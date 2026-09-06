import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const adapter = readFileSync(join(root, "lib/server/life-mcp-tools.ts"), "utf8");
const route = readFileSync(join(root, "app/ai-media-upload/route.ts"), "utf8");

 describe("R11.4 phase 2 media recovery source contract", () => {
  it("returns a non-retryable browser upload recovery instead of repeating the mutation", () => {
    expect(adapter).toContain("createLifeMediaRecovery");
    expect(adapter).toContain('"MEDIA_ATTACHMENT_REQUIRED"');
    expect(adapter).toContain("retryable: false");
    expect(adapter).toContain("mutationExecuted: false");
    expect(adapter).toContain('type: "browser_upload"');
    expect(adapter).toContain("uploadUrl: recovery.uploadUrl");
    expect(adapter).toContain("不要重复 create/update");
  });

  it("uses the signed actor and stable operation id when the user uploads the missing image", () => {
    expect(route).toContain("resolveLifeMediaRecovery");
    expect(route).toContain("compressMealPhoto");
    expect(route).toContain('executeLifeAgentTool("life_mutate"');
    expect(route).toContain("partnerKey: payload.partnerKey");
    expect(route).toContain("toolCallId: payload.operationId");
    expect(route).toContain("MEAL_PHOTO_MAX_INPUT_BYTES");
  });
});
