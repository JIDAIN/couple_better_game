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

  it("forces image-save requests through life_mutate even when the model cannot see image bytes", () => {
    expect(adapter).toContain("图片不可见也必须调用一次 life_mutate");
    expect(adapter).toContain("attachPhoto=true");
    expect(adapter).toContain("不要在调用工具前自行拒绝");
    expect(adapter).toContain("不要要求用户重新上传 PNG/JPG");
    expect(adapter).toContain("收到 MEDIA_ATTACHMENT_REQUIRED 后不要再次调用 life_mutate");
    expect(adapter).toContain("recovery.uploadUrl");
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
