import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("R8.5 startup prewarm", () => {
  it("uses a one-time startup gate instead of exposing partial first render", () => {
    const identity = source("components/life/LifeIdentityContext.tsx");
    const chrome = source("components/life/PersistentLifeChrome.tsx");
    expect(identity).toContain("bootstrapReady");
    expect(identity).toContain("warmLifeEssentials");
    expect(identity).toContain("Promise.race");
    expect(identity).toContain("2200");
    expect(chrome).toContain("LifeStartupSplash");
    expect(chrome).toContain("MIN_SPLASH_MS = 620");
    expect(chrome).toContain("小岛正在醒来");
  });

  it("warms today, meals, month, settings and visible image assets before reveal", () => {
    const identity = source("components/life/LifeIdentityContext.tsx");
    expect(identity).toContain("fetchLifeDay(date)");
    expect(identity).toContain("fetchLifeMonth(month)");
    expect(identity).toContain("fetchMeals({ mealDate: date, partnerKey: me })");
    expect(identity).toContain("fetchMeals({ mealDate: date, partnerKey: ta })");
    expect(identity).toContain("fetchLifeSettings");
    expect(identity).toContain("/illustrations/life/activity-girls.png");
    expect(identity).toContain("/illustrations/meals/breakfast.svg");
    expect(identity).toContain("mealPhotoUrl");
    expect(identity).toContain("preloadCurrentMealPhotos");
  });

  it("renders prewarmed local artwork through the same raw URLs", () => {
    const mood = source("components/ui/MoodIcon.tsx");
    const activity = source("components/life/today/TodayActivityCard.tsx");
    const nest = source("components/life/LifeNestPage.tsx");
    const food = source("components/life/LifeFoodPage.tsx");
    expect(mood).toContain("<Image unoptimized");
    expect(activity).toContain('<Image unoptimized loading="eager" src="/illustrations/life/activity-girls.png"');
    expect(nest).toContain('<Image unoptimized loading="eager" src="/illustrations/life/activity-girls.png"');
    expect(food).toContain("<Image unoptimized src={src}");
  });

  it("keeps heavier secondary screens warming after the app is interactive", () => {
    const identity = source("components/life/LifeIdentityContext.tsx");
    expect(identity).toContain("fetchWeights(me)");
    expect(identity).toContain("fetchMedicines");
    expect(identity).toContain("fetchMailboxLetters");
    expect(identity).toContain("void Promise.allSettled");
  });

  it("prewarms likely calendar detail bundles and warms a tapped day immediately", () => {
    const calendar = source("components/life/LifeCalendarPage.tsx");
    expect(calendar).toContain("const warmDay = useCallback");
    expect(calendar).toContain("slice(-8)");
    expect(calendar).toContain("onPointerDown={() => warmDay(date)}");
    expect(calendar).toContain("onPointerEnter={() => warmDay(date)}");
    expect(calendar).toContain("fetchLifeDay(date)");
    expect(calendar).toContain("fetchMeals({ mealDate: date, partnerKey: me })");
  });

  it("loads dedicated startup styling from the root layout", () => {
    const layout = source("app/layout.tsx");
    const css = source("app/r8-5-bootstrap.css");
    expect(layout).toContain('import "./r8-5-bootstrap.css"');
    expect(css).toContain(".life-startup-splash");
    expect(css).toContain("life-island-float");
    expect(css).toContain("prefers-reduced-motion");
  });
});