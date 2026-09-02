import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("relative me / Ta identity", () => {
  it("defines Ta as the opposite of the current login", () => {
    const identity = source("components/life/LifeIdentityContext.tsx");
    expect(identity).toContain('return key === "cat" ? "fish" : "cat"');
    expect(identity).toContain("mePartnerKey: partnerKey");
    expect(identity).toContain("taPartnerKey: partnerKey ? oppositePartnerKey(partnerKey) : null");
  });

  it("keeps the login screen identity-neutral before authentication", () => {
    const login = source("components/life/LifeLoginPage.tsx");
    expect(login).toContain('autoComplete="username"');
    expect(login).toContain('autoComplete="current-password"');
    expect(login).not.toContain('account === "cat" ? "我" : "Ta"');
    expect(login).not.toContain("选择账号");
  });

  it("refreshes identity in place and warms shared page data before login navigation", () => {
    const identity = source("components/life/LifeIdentityContext.tsx");
    const login = source("components/life/LifeLoginPage.tsx");
    const me = source("components/life/LifeMePage.tsx");
    expect(identity).toContain("clearStaleQueries()");
    expect(identity).toContain("await warmLifeData(next)");
    expect(identity).toContain('key: "medicines"');
    expect(identity).toContain('key: "mailbox"');
    expect(login).toContain("await refreshIdentity()");
    expect(me).toContain("await refreshIdentity()");
    expect(login).not.toContain("router.refresh()");
    expect(me).not.toContain("router.refresh()");
  });

  it("uses larger unframed moods and month-filtered mailbox cards", () => {
    const today = source("components/life/today/TodayMoodCard.tsx");
    const mailbox = source("components/life/LifeMailboxPage.tsx");
    const css = source("app/island-life-refactor.css");
    expect(today).toContain('className="life-person-state-orb"');
    expect(css).toContain(".life-person-state-orb { width: 5.4rem; height: 5.4rem;");
    expect(css).toContain(".life-calendar-mood { width: 2.35rem; height: 2.35rem;");
    expect(mailbox).toContain("全部信件");
    expect(mailbox).toContain("life-letter-date");
    expect(mailbox).toContain("monthKey(letter.sentAt) === month");
  });

  it("uses relative identity on key life pages", () => {
    for (const path of [
      "components/life/today/TodayMoodCard.tsx",
      "components/life/today/TodaySleepCard.tsx",
      "components/life/LifeFoodPage.tsx",
      "components/life/LifeWeightPage.tsx",
      "components/life/LifeCalendarPage.tsx",
      "components/life/LifeCalendarDayPage.tsx",
      "components/life/LifeMailboxPage.tsx",
    ]) {
      expect(source(path)).toContain("useLifeIdentity");
    }
  });

  it("keeps git-triggered Vercel deployment disabled", () => {
    const config = JSON.parse(source("vercel.json")) as { git?: { deploymentEnabled?: boolean } };
    expect(config.git?.deploymentEnabled).toBe(false);
  });
});
