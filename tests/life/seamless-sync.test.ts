import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { invalidateStaleQuery, peekStaleQuery, setStaleQueryData } from "../../lib/client/use-stale-query";
import { syncLifeDayCaches } from "../../lib/life/month-bundle";
import type { LifeDayRecord } from "../../lib/life/life-service";

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

  it("persists safe read caches per cat/fish browser scope", () => {
    const cache = source("lib/client/use-stale-query.ts");
    expect(cache).toContain("window.localStorage");
    expect(cache).toContain("window.localStorage.getItem(SCOPE_HINT_KEY)");
    expect(cache).toContain("rememberStaleQueryScope");
    expect(cache).toContain("MAX_PERSISTED_AGE_MS");
    expect(cache).toContain('key === "medicines"');
    expect(cache).toContain('key === "mailbox"');
    expect(cache).toContain('key === "life-settings"');
  });

  it("updates the visible month cache immediately after a mood write", () => {
    const date = "2098-11-03";
    const monthKey = "life-month:2098-11";
    setStaleQueryData(monthKey, { month: "2098-11", days: [{ date, moods: [] }] });
    const day: LifeDayRecord = {
      date,
      moods: [{
        id: crypto.randomUUID(), partnerKey: "cat", moodDate: date, moodKey: "happy",
        source: "manual", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
      }],
      sleeps: [],
      activities: [],
    };
    syncLifeDayCaches(date, day);
    expect(peekStaleQuery<{ days: Array<{ moods: Array<{ moodKey: string }> }> }>(monthKey)?.days[0].moods[0].moodKey).toBe("happy");
  });

  it("does not treat a temporary session fetch failure as logout", () => {
    const identity = source("components/life/LifeIdentityContext.tsx");
    expect(identity).toContain("const fallback = partnerRef.current ?? readStaleQueryScopeHint()");
    expect(identity).toContain("next = fallback");
    expect(identity).toContain("rememberStaleQueryScope");
    expect(identity).toContain("window.addEventListener(\"online\"");
    expect(identity).toContain('key: "life-settings"');
  });

  it("keeps the bottom navigation in root chrome instead of remounting it per page", () => {
    const layout = source("app/layout.tsx");
    const shell = source("components/life/LifeAppShell.tsx");
    const chrome = source("components/life/PersistentLifeChrome.tsx");
    expect(layout).toContain("PersistentLifeChrome");
    expect(shell).not.toContain("AppLifeBottomNav");
    expect(chrome).toContain("<AppLifeBottomNav />");
    expect(chrome).toContain("router.prefetch(route)");
  });

  it("registers an app-shell service worker without caching API responses", () => {
    const register = source("components/life/LifeServiceWorker.tsx");
    const worker = source("public/life-sw.js");
    expect(register).toContain('navigator.serviceWorker.register("/life-sw.js"');
    expect(worker).toContain('url.pathname.startsWith("/api/")');
    expect(worker).toContain("NETWORK_TIMEOUT_MS = 2500");
    expect(worker).toContain("/nest/medicine");
    expect(worker).toContain("networkFirst(request)");
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

  it("keeps versioned meal photos in the private browser cache", () => {
    const photoRoute = source("app/api/meals/[id]/photo/route.ts");
    const client = source("lib/nutrition/meal-client.ts");
    expect(client).toContain("?v=${encodeURIComponent(meal.updatedAt)}");
    expect(photoRoute).toContain('private, max-age=31536000, immutable');
  });

  it("hydrates meal editing from the list cache", () => {
    const editor = source("components/life/LifeMealEditorPage.tsx");
    expect(editor).toContain("peekStaleQuery");
    expect(editor).toContain("cachedMeal");
  });
});
