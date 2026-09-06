import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const route = readFileSync(join(root, "app/ai-media-upload/route.ts"), "utf8");
const vision = readFileSync(join(root, "lib/server/life-meal-vision.ts"), "utf8");

describe("R11.4 phase 3 server-side vision source contract", () => {
  it("recognizes the compressed image before completing the recovered meal mutation", () => {
    expect(route).toContain("recognizeMealPhoto");
    expect(route).toContain("mergeVisionItems");
    expect(route).toContain("AI图片识别，建议核对");
    expect(route).toContain("内部数据库字段不会在这里展示");
    expect(route).not.toContain("JSON.stringify(result)");
  });

  it("uses a server-only configurable vision provider and degrades without breaking photo save", () => {
    expect(vision).toContain('LIFE_VISION_API_KEY');
    expect(vision).toContain('OPENAI_API_KEY');
    expect(vision).toContain('LIFE_VISION_MODEL');
    expect(vision).toContain('VISION_NOT_CONFIGURED');
    expect(vision).toContain('input_image');
    expect(vision).toContain('confidence < MIN_CONFIDENCE');
  });
});
