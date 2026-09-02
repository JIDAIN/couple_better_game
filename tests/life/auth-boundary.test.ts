import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("V2 fixed account boundary", () => {
  it("uses a normal username and password form without account chooser", () => {
    const login = source("components/life/LifeLoginPage.tsx");
    expect(login).toContain('autoComplete="username"');
    expect(login).toContain('autoComplete="current-password"');
    expect(login).toContain('JSON.stringify({ username, password })');
    expect(login).toContain('fetch("/api/auth/login"');
    expect(login).not.toContain("选择账号");
    expect(login).not.toContain('(["cat", "fish"] as const)');
    expect(login).not.toContain("signup");
  });

  it("authenticates username and password against the server-only Supabase RPC", () => {
    const fixedAuth = source("lib/server/fixed-life-auth.ts");
    expect(fixedAuth).toContain("LIFE_ACCOUNT_COOKIE");
    expect(fixedAuth).toContain('partnerKey: LifePartnerKey');
    expect(fixedAuth).toContain('rpc/authenticate_fixed_life_account');
    expect(fixedAuth).toContain('p_username: normalizedUsername');
    expect(fixedAuth).toContain('p_password: password');
    expect(fixedAuth).toContain('createHmac("sha256"');
    expect(fixedAuth).not.toContain("LIFE_ACCOUNT_PASSWORD");
    expect(fixedAuth).not.toContain("DATA_EDIT_PASSWORD");
  });

  it("keeps credential rows server-only and password hashes out of source data", () => {
    const migration = source("supabase/migrations/20260903112500_add_fixed_life_account_credentials.sql");
    expect(migration).toContain("life_fixed_accounts");
    expect(migration).toContain("password_hash");
    expect(migration).toContain("extensions.crypt");
    expect(migration).toContain("grant execute on function public.authenticate_fixed_life_account(text, text) to service_role");
    expect(migration).not.toContain("jidain@163.com");
    expect(migration).not.toContain("15535373352@163.com");
  });

  it("does not show the legacy sync-password gate on Today", () => {
    const today = source("components/life/TodayLifePage.tsx");
    expect(today).not.toContain("LifeCloudGate");
    expect(today).toContain('router.replace("/login")');
  });

  it("enforces personal ownership on mood, sleep and weight writes", () => {
    for (const path of [
      "app/api/life/mood/route.ts",
      "app/api/life/sleep/route.ts",
      "app/api/life/weights/route.ts",
    ]) {
      expect(source(path)).toContain("authorizePersonalPartnerWrite");
    }
    expect(source("lib/server/life-api.ts")).toContain("OWN_RECORD_ONLY");
  });

  it("still prevents Git-triggered Vercel deployments", () => {
    const config = JSON.parse(source("vercel.json")) as { git?: { deploymentEnabled?: boolean } };
    expect(config.git?.deploymentEnabled).toBe(false);
  });
});
