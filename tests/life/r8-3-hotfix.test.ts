import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("R8.3 production screenshot hotfix", () => {
  it("makes the together-days sentence readable with a brighter larger number and double-heart SVG", () => {
    const today = source("components/life/TodayLifePage.tsx");
    const css = source("app/r8-3-hotfix.css");
    expect(today).toContain('className="life-together-heart"');
    expect(today).toContain('<svg viewBox="0 0 28 22"');
    expect(today.match(/<path/g)?.length).toBeGreaterThanOrEqual(2);
    expect(today.indexOf("一起度过的第")).toBeLessThan(today.indexOf("life-together-heart"));
    expect(css).toContain("font-size: .9rem !important");
    expect(css).toContain("font-size: 1.08rem !important");
    expect(css).toContain("color: #d17f96 !important");
  });

  it("keeps the activity icon picker above navigation and makes every icon scrollable on mobile", () => {
    const activity = source("components/life/today/TodayActivityCard.tsx");
    const css = source("app/r8-3-hotfix.css");
    expect(activity).toContain("life-activity-icon-popover");
    expect(activity).toContain("life-activity-icon-grid");
    expect(css).toContain("z-index: 70 !important");
    expect(css).toContain("overflow-y: auto");
    expect(css).toContain("position: fixed !important");
    expect(css).toContain("bottom: calc(4.9rem + env(safe-area-inset-bottom)) !important");
    expect(css).toContain("max-height: min(21rem, calc(100dvh - 13rem))");
  });

  it("loads the hotfix after the R8.3 visual layer", () => {
    const layout = source("app/layout.tsx");
    expect(layout.indexOf("r8-3-visual-polish.css")).toBeLessThan(layout.indexOf("r8-3-hotfix.css"));
  });
});
