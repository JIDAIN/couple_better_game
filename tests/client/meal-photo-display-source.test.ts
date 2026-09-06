import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const foodPage = readFileSync(join(root, "components/life/LifeFoodPage.tsx"), "utf8");
const compression = readFileSync(join(root, "lib/server/image-compression.ts"), "utf8");

describe("meal photo orientation and framing", () => {
  it("normalizes EXIF orientation before meal photo compression", () => {
    expect(compression).toContain(".rotate()");
    expect(compression).toContain("MEAL_PHOTO_MAX_EDGE = 600");
  });

  it("shows the complete uploaded photo instead of forcing a landscape crop", () => {
    expect(foodPage).toContain('className="object-contain"');
    expect(foodPage).toContain("blur-xl");
    expect(foodPage).toContain("scale-110 object-cover opacity-30");
  });

  it("keeps the fixed meal card frame while using a soft photo-derived background", () => {
    expect(foodPage).toContain("aspect-[4/3]");
    expect(foodPage).toContain("bg-white/15");
  });
});
