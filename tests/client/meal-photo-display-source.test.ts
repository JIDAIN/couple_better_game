import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const foodPage = readFileSync(join(root, "components/life/LifeFoodPage.tsx"), "utf8");
const editor = readFileSync(join(root, "components/life/LifeMealEditorPage.tsx"), "utf8");
const frame = readFileSync(join(root, "components/life/MealPhotoFrame.tsx"), "utf8");
const photoRoute = readFileSync(join(root, "app/api/meals/[id]/photo/route.ts"), "utf8");
const compression = readFileSync(join(root, "lib/server/image-compression.ts"), "utf8");

describe("meal photo orientation and framing", () => {
  it("normalizes EXIF orientation before meal photo compression", () => {
    expect(compression).toContain(".rotate()");
    expect(compression).toContain("MEAL_PHOTO_MAX_EDGE = 600");
  });

  it("defaults portrait uploads to a landscape display rotation on the server", () => {
    expect(photoRoute).toContain("defaultMealPhotoDisplay(compressed.width, compressed.height)");
    expect(photoRoute).toContain("replaceMealPhotoState(id, path, display)");
  });

  it("renders uploaded photos with contain framing and blank surface fill instead of cropping", () => {
    expect(frame).toContain('className="object-contain"');
    expect(frame).toContain("bg-[var(--life-surface-warm)]");
    expect(frame).not.toContain("object-cover");
    expect(foodPage).toContain("<MealPhotoFrame");
  });

  it("lets the meal editor rotate and resize photos non-destructively", () => {
    expect(editor).toContain("rotatePhoto(-90)");
    expect(editor).toContain("rotatePhoto(90)");
    expect(editor).toContain('type="range"');
    expect(editor).toContain('min="60"');
    expect(editor).toContain('max="100"');
    expect(editor).toContain("updateMealPhotoDisplay");
    expect(editor).toContain("竖着显示也会完整保留照片内容");
  });
});
