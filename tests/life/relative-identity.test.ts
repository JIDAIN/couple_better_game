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

  it("refreshes identity in place, preserves weak-network scope, and warms shared page data", () => {
    const identity = source("components/life/LifeIdentityContext.tsx");
    const login = source("components/life/LifeLoginPage.tsx");
    const me = source("components/life/LifeMePage.tsx");
    expect(identity).toContain("rememberStaleQueryScope(next)");
    expect(identity).toContain("forgetStaleQueryScope()");
    expect(identity).toContain("const fallback = partnerRef.current ?? readStaleQueryScopeHint()");
    expect(identity).toContain("startInitialWarmup(next)");
    expect(identity).toContain("warmLifeEssentials");
    expect(identity).not.toContain("bootstrapReady");
    expect(identity).toContain('key: "medicines"');
    expect(identity).toContain('key: "mailbox"');
    expect(identity).toContain('key: "life-settings"');
    expect(login).toContain("await refreshIdentity()");
    expect(me).toContain("await refreshIdentity()");
    expect(login).not.toContain("router.refresh()");
    expect(me).not.toContain("router.refresh()");
  });

  it("uses larger unframed moods and actor-filtered three-box mailbox previews", () => {
    const today = source("components/life/today/TodayMoodCard.tsx");
    const mailbox = source("components/life/LifeMailboxPage.tsx");
    const css = source("app/island-life-refactor.css");
    expect(today).toContain('className="life-person-state-orb"');
    expect(css).toContain(".life-person-state-orb { width: 5.4rem; height: 5.4rem;");
    expect(css).toContain(".life-calendar-mood { width: 2.35rem; height: 2.35rem;");
    expect(mailbox).toContain('type Tab = "inbox" | "sent" | "draft"');
    expect(mailbox).toContain('value === "all" ? "所有"');
    expect(mailbox).toContain("life-letter-preview");
    expect(mailbox).toContain('monthKey(item.sentAt) === month');
    expect(mailbox).toContain('item.status === "draft" && item.senderKey === mePartnerKey');
    expect(mailbox).toContain('item.status === "sent" && item.recipientKey === mePartnerKey');
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
