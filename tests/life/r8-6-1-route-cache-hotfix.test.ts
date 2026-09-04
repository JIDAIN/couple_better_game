import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("R8.6.1 client-only history navigation", () => {
  it("opens calendar days through router.push instead of a native anchor fallback", () => {
    const calendar = source("components/life/LifeCalendarPage.tsx");
    expect(calendar).toContain('import { useRouter } from "next/navigation"');
    expect(calendar).toContain("router.prefetch(`/calendar/${date}`)");
    expect(calendar).toContain("router.push(`/calendar/${date}`)");
    expect(calendar).toContain('type="button"');
    expect(calendar).not.toContain('import Link from "next/link"');
  });

  it("reuses the canonical day and meal cache keys in calendar detail", () => {
    const day = source("components/life/LifeCalendarDayPage.tsx");
    expect(day).toContain('key: `life-day:${date}`');
    expect(day).toContain('key: `meals:${mePartnerKey ?? "pending"}:${date}`');
    expect(day).toContain('key: `meals:${taPartnerKey ?? "pending"}:${date}`');
    expect(day).not.toContain("calendar-day:");
  });

  it("opens historical food through the client router after warming the same meal cache/photos", () => {
    const day = source("components/life/LifeCalendarDayPage.tsx");
    expect(day).toContain('const foodHref = `/food?date=${encodeURIComponent(date)}`');
    expect(day).toContain("router.prefetch(foodHref)");
    expect(day).toContain("router.push(foodHref)");
    expect(day).toContain("preloadMealPhotos([...meMeals, ...taMeals])");
    expect(day).not.toContain('href={`/food?date=${encodeURIComponent(date)}`}');
  });
});