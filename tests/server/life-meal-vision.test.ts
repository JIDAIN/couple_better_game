import { describe, expect, it } from "vitest";
import { normalizeMealVisionPayload } from "../../lib/server/life-meal-vision";

describe("R11.4 phase 3 meal vision normalization", () => {
  it("keeps only reasonably confident visible food items", () => {
    expect(normalizeMealVisionPayload({
      items: [
        { rawName: "鸡蛋", portionDescription: "2个", confidence: 0.96 },
        { rawName: "红薯", portionDescription: "约半个", confidence: 0.72 },
        { rawName: "看不清的配菜", confidence: 0.32 },
      ],
      summary: "鸡蛋、红薯",
    })).toEqual({
      ok: true,
      items: [
        { rawName: "鸡蛋", portionDescription: "2个", confidence: 0.96 },
        { rawName: "红薯", portionDescription: "约半个", confidence: 0.72 },
      ],
      summary: "鸡蛋、红薯",
    });
  });

  it("does not claim success when nothing reliable is recognized", () => {
    const result = normalizeMealVisionPayload({
      items: [{ rawName: "未知", confidence: 0.2 }],
      summary: "",
    });
    expect(result.ok).toBe(false);
    expect(result.items).toEqual([]);
    expect(result.summary).toContain("未可靠识别");
  });
});
