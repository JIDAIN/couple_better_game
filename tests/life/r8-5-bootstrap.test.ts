import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("R8.7 non-blocking startup and prewarm", () => {
  it("renders the app immediately without a timed startup gate", () => {
    const identity = source("components/life/LifeIdentityContext.tsx");
    const chrome = source("components/life/PersistentLifeChrome.tsx");
    expect(identity).toContain("warmLifeEssentials");
    expect(identity).not.toContain("Promise.race");
    expect(identity).not.toContain("bootstrapReady");
    expect(chrome).not.toContain("LifeStartupSplash");
    expect(chrome).not.toContain("MIN_SPLASH_MS");
  });

  it("hydrates the whole current month into the canonical day and meal cache before reveal", () => {
    const identity = source("components/life/LifeIdentityContext.tsx");
    const bundle = source("lib/life/month-bundle.ts");
    expect(identity).toContain("fetchLifeMonthBundle(month)");
    expect(identity).toContain("hydrateLifeMonthBundle(bundle, me, ta)");
    expect(identity).toContain("fetchLifeSettings");
    expect(bundle).toContain("life-day:${item.date}");
    expect(bundle).toContain("meals:${me}:${item.date}");
    expect(bundle).toContain("meals:${ta}:${item.date}");
    expect(bundle).toContain("life-month:${bundle.month}");
    expect(identity).toContain("/illustrations/life/activity-girls.png");
    expect(identity).toContain("/illustrations/meals/breakfast.svg");
    expect(identity).toContain("preloadMealPhotos(meals, 1400)");
  });

  it("renders prewarmed local artwork through the same raw URLs", () => {
    const mood = source("components/ui/MoodIcon.tsx");
    const activity = source("components/life/today/TodayActivityCard.tsx");
    const nest = source("components/life/LifeNestPage.tsx");
    const food = source("components/life/LifeFoodPage.tsx");
    expect(mood).toContain("<Image unoptimized");
    expect(activity).toContain('<Image unoptimized loading="eager" src="/illustrations/life/activity-girls.png"');
    expect(nest).toContain('<Image unoptimized loading="eager" src="/illustrations/life/activity-girls.png"');
    expect(food).toContain("mealPhotoUrl(meal)");
    expect(food).toContain("unoptimized");
    expect(food).toContain("priority");
  });

  it("keeps heavier secondary screens warming after the app is interactive", () => {
    const identity = source("components/life/LifeIdentityContext.tsx");
    expect(identity).toContain("fetchWeights(me)");
    expect(identity).toContain("fetchMedicines");
    expect(identity).toContain("fetchMailboxLetters");
    expect(identity).toContain("void Promise.allSettled");
    expect(identity).toContain("}, 1200)");
  });

  it("hydrates every opened calendar month and warms a tapped day's real meal photos", () => {
    const calendar = source("components/life/LifeCalendarPage.tsx");
    expect(calendar).toContain("fetchLifeMonthBundle(month)");
    expect(calendar).toContain("hydrateLifeMonthBundle(bundle, mePartnerKey, taPartnerKey)");
    expect(calendar).toContain("const warmDay = useCallback");
    expect(calendar).toContain("preloadMealPhotos");
    expect(calendar).toContain("onPointerDown={() => warmDay(date)}");
    expect(calendar).toContain("onPointerEnter={() => warmDay(date)}");
  });

  it("calendar detail reuses the same life-day and meals cache keys as Today/Food instead of a private bundle key", () => {
    const detail = source("components/life/LifeCalendarDayPage.tsx");
    expect(detail).toContain("key: `life-day:${date}`");
    expect(detail).toContain("key: `meals:${mePartnerKey ?? \"pending\"}:${date}`");
    expect(detail).toContain("key: `meals:${taPartnerKey ?? \"pending\"}:${date}`");
    expect(detail).toContain("preloadMealPhotos");
    expect(detail).not.toContain("calendar-day:");
  });

  it("does not load the obsolete full-screen startup styling", () => {
    const layout = source("app/layout.tsx");
    expect(layout).not.toContain("r8-5-bootstrap.css");
    expect(layout).not.toContain("life-startup-splash");
  });
});
