import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("R1-R6 refactor boundaries", () => {
  it("keeps identity provider persistent and today cache-backed", () => {
    expect(source("app/layout.tsx")).toContain("LifeIdentityProvider");
    expect(source("components/life/LifeAppShell.tsx")).not.toContain("LifeIdentityProvider");
    expect(source("components/life/TodayLifePage.tsx")).toContain("useStaleQuery");
    expect(source("components/life/TodayLifePage.tsx")).toContain("life-day:");
  });

  it("only offers own mood and sleep editing", () => {
    const mood = source("components/life/today/TodayMoodCard.tsx");
    const sleep = source("components/life/today/TodaySleepCard.tsx");
    expect(mood).toContain('myMood ? "编辑" : "+ 记录"');
    expect(mood).toContain("mePartnerKey");
    expect(mood).not.toContain("MoodEditor label=\"Ta\"");
    expect(sleep).toContain("saveMine");
    expect(sleep).not.toContain('SleepEditor label="Ta"');
  });

  it("uses fixed meal slots and multi-snack entries", () => {
    const food = source("components/life/LifeFoodPage.tsx");
    const editor = source("components/life/LifeMealEditorPage.tsx");
    expect(food).toContain("FIXED_MEALS");
    expect(food).toContain("SNACK_OPTIONS");
    expect(food).toContain("+ 新增加餐");
    expect(editor).not.toContain("AppRoleSwitch");
    expect(editor).toContain("把这一餐轻轻记下来");
    expect(editor).not.toContain("记录这一餐的时间、照片和食物");
  });

  it("enforces meal ownership server-side", () => {
    expect(source("app/api/meals/route.ts")).toContain("authorizePersonalPartnerWrite");
    expect(source("app/api/meals/[id]/route.ts")).toContain("getMealOwner");
    expect(source("app/api/meals/[id]/photo/route.ts")).toContain("authorizePhotoWrite");
  });

  it("keeps empty mood dates visually empty and today sun-marked", () => {
    const calendar = source("components/life/LifeCalendarPage.tsx");
    expect(calendar).toContain("life-today-sun");
    expect(calendar).toContain("if (!visual) return null");
    expect(calendar).toContain("life-month:");
  });

  it("separates Nest from My and binds mailbox sender ownership", () => {
    const nest = source("components/life/LifeNestPage.tsx");
    const me = source("components/life/LifeMePage.tsx");
    expect(nest).toContain("life-nest-scene");
    expect(me).toContain("life-account-hero");
    expect(me).not.toContain('href="/calendar"');
    expect(source("app/api/life/mailbox/route.ts")).toContain("senderKey !== identity.partnerKey");
    expect(source("app/api/life/mailbox/[id]/route.ts")).toContain("getMailboxSender");
  });

  it("loads the unified visual adapters and keeps Vercel git deploy disabled", () => {
    expect(source("app/layout.tsx")).toContain("island-life-refactor.css");
    expect(source("app/layout.tsx")).toContain("r8-ui-closeout.css");
    expect(source("app/layout.tsx")).toContain("r8-3-visual-polish.css");
    const vercel = JSON.parse(source("vercel.json")) as { git?: { deploymentEnabled?: boolean } };
    expect(vercel.git?.deploymentEnabled).toBe(false);
  });
});
