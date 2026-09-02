import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { invalidateStaleQuery, peekStaleQuery, setStaleQueryData } from "../../lib/client/use-stale-query";

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("life seamless synchronization", () => {
  it("keeps cached data available while marking it stale", () => {
    const key = `test:${crypto.randomUUID()}`;
    setStaleQueryData(key, { value: 1 });
    invalidateStaleQuery(key);
    expect(peekStaleQuery(key)).toEqual({ value: 1 });
  });

  it("uses stale-while-revalidate across every data-backed life screen", () => {
    for (const path of [
      "components/life/TodayLifePage.tsx",
      "components/life/LifeFoodPage.tsx",
      "components/life/LifeCalendarPage.tsx",
      "components/life/LifeCalendarDayPage.tsx",
      "components/life/LifeWeightPage.tsx",
      "components/life/LifeMailboxPage.tsx",
      "components/life/LifeMedicinePage.tsx",
    ]) {
      expect(source(path), path).toContain("useStaleQuery");
    }
  });

  it("does not insert visible background-refresh banners", () => {
    for (const path of [
      "components/life/TodayLifePage.tsx",
      "components/life/LifeFoodPage.tsx",
      "components/life/LifeCalendarPage.tsx",
    ]) {
      expect(source(path), path).not.toContain("life-sync-pill");
    }
  });

  it("hydrates meal editing from the list cache", () => {
    const editor = source("components/life/LifeMealEditorPage.tsx");
    expect(editor).toContain("peekStaleQuery");
    expect(editor).toContain("cachedMeal");
  });
});
